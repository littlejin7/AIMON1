"""
훈련 페이지 전체 검증 (5개 항목).

V1. 랜덤퀴즈 — 잠금해제 유닛에서만 출제, 미학습 유닛 제외
V2. 보스특훈 — miniboss 클리어 유닛만, 클리어 0개면 [] (폴백 없음)
V3. 유닛선택(unit=None/int) · 레벨칩(course_level) 파라미터 전달
V4. attempts mode 값 — quiz/train/random/boss_rush/miniboss/unitboss 각각 정확히 기록
V5. 빈 결과 시 셔플-15 폴백 없음 — only_wrong/random/boss_rush 모두
"""
import sys, os, json

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import pytest
from fastapi.testclient import TestClient

import routers.utils as U
import routers.train as TRAIN
import routers.attempts as ATT
import routers.boss as BOSS
import routers.miniboss as MINI
from main import app

client = TestClient(app)

BASE_USER = {"id": "u1", "course_level": "beginner", "lv": 1, "xp": 0, "crowns": 0,
             "miniboss_cleared_stages": [], "seen_questions": {}}


@pytest.fixture(autouse=True)
def isolate(monkeypatch, tmp_path):
    for attr, name in [
        ("ATTEMPTS_FILE",      "attempts.json"),
        ("WRONG_ANSWERS_FILE", "wrong_answers.json"),
        ("USERS_FILE",         "users.json"),
        ("PROGRESS_FILE",      "progress.json"),
    ]:
        monkeypatch.setattr(U, attr, str(tmp_path / name))
    monkeypatch.setattr(U, "USE_SUPABASE", False)

    app.dependency_overrides[U.get_current_user]          = lambda: dict(BASE_USER)
    app.dependency_overrides[U.get_current_user_optional] = lambda: dict(BASE_USER)
    yield
    app.dependency_overrides.clear()


def _seed_progress(rows):
    with open(U.PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(rows, f)

def _read_attempts():
    try:
        with open(U.ATTEMPTS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def _pool(units, category="quiz"):
    return [{"question_id": f"{category}{u}-{i}", "unit": u,
             "quiz_category": category} for u in units for i in range(5)]


# ═══════════════════════════════════════════════════════════════════
# V1. 랜덤퀴즈 — 잠금해제 유닛만
# ═══════════════════════════════════════════════════════════════════

def test_V1a_random_only_unlocked_units(monkeypatch):
    """is_completed=True 유닛(1·2)만 출제, 미학습 유닛(3) 제외."""
    all_pool = _pool([1, 2, 3])
    def fake_load(cat, course_level=None, unit=None):
        return [q for q in all_pool if unit is None or q["unit"] == unit]
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    _seed_progress([
        {"user_id": "u1", "unit": 1, "stage": "1-1",   "is_completed": True,  "course_level": "beginner"},
        {"user_id": "u1", "unit": 2, "stage": "2-boss", "is_completed": True,  "course_level": "beginner"},
        {"user_id": "u1", "unit": 3, "stage": "3-1",   "is_completed": False, "course_level": "beginner"},
    ])
    r = client.get("/train/random", params={"n": 30, "course_level": "beginner"})
    assert r.status_code == 200
    units = {q["unit"] for q in r.json()}
    assert 3 not in units, f"미학습 유닛 3이 포함됨: {units}"
    assert units == {1, 2}
    print(f"\n[V1a] 잠금해제 유닛만 출제: {units}")


def test_V1b_random_no_unlocked_returns_empty(monkeypatch):
    """진행도 없음 → 빈 결과, 폴백 없음."""
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _pool([1, 2, 3]))
    _seed_progress([])
    r = client.get("/train/random", params={"course_level": "beginner"})
    assert r.status_code == 200
    assert r.json() == []
    print("[V1b] 잠금해제 유닛 없음 → [] (폴백 없음)")


def test_V1c_random_never_crosses_completed_false(monkeypatch):
    """is_completed=False 스테이지만 있는 유닛은 제외."""
    all_pool = _pool([1, 2])
    def fake_load(cat, course_level=None, unit=None):
        return [q for q in all_pool if unit is None or q["unit"] == unit]
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    _seed_progress([
        {"user_id": "u1", "unit": 1, "stage": "1-1", "is_completed": True,  "course_level": "beginner"},
        {"user_id": "u1", "unit": 2, "stage": "2-1", "is_completed": False, "course_level": "beginner"},
    ])
    r = client.get("/train/random", params={"n": 30, "course_level": "beginner"})
    assert r.status_code == 200
    units = {q["unit"] for q in r.json()}
    assert units == {1}, f"is_completed=False 유닛 포함: {units}"
    print(f"[V1c] is_completed=False 유닛 2 제외 확인: {units}")


# ═══════════════════════════════════════════════════════════════════
# V2. 보스특훈 — miniboss 클리어 유닛만, 빈 결과 폴백 없음
# ═══════════════════════════════════════════════════════════════════

def test_V2a_boss_rush_only_miniboss_cleared(monkeypatch):
    """cleared_stages = ["1-1","2-1"] → 유닛 1·2 miniboss만, 유닛 3 제외."""
    user = {**BASE_USER, "miniboss_cleared_stages": ["1-1", "1-2", "2-1"]}
    app.dependency_overrides[U.get_current_user_optional] = lambda: dict(user)

    all_pool = _pool([1, 2, 3], category="miniboss")
    def fake_load(cat, course_level=None, unit=None):
        return [q for q in all_pool if unit is None or q["unit"] == unit]
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    r = client.get("/train/boss_rush", params={"n": 30})
    assert r.status_code == 200
    units = {q["unit"] for q in r.json()}
    assert 3 not in units, f"미클리어 유닛 3 포함: {units}"
    assert units == {1, 2}
    print(f"\n[V2a] 클리어 유닛 1·2만 출제: {units}")


def test_V2b_boss_rush_zero_cleared_returns_empty(monkeypatch):
    """miniboss_cleared_stages=[] → 빈 결과, 폴백 없음."""
    app.dependency_overrides[U.get_current_user_optional] = lambda: dict(BASE_USER)
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _pool([1, 2, 3], "miniboss"))

    r = client.get("/train/boss_rush")
    assert r.status_code == 200
    assert r.json() == []
    print("[V2b] 클리어 0개 → [] (폴백 없음)")


def test_V2c_boss_rush_beginner_fixed_regardless_of_user_level(monkeypatch):
    """user.course_level=intermediate여도 beginner miniboss 풀에서만 출제."""
    intermediate_user = {**BASE_USER, "course_level": "intermediate",
                         "miniboss_cleared_stages": ["1-1"]}
    app.dependency_overrides[U.get_current_user_optional] = lambda: dict(intermediate_user)

    captured = []
    def fake_load(cat, course_level=None, unit=None):
        captured.append(course_level)
        return [{"question_id": f"mb1-{i}", "unit": 1} for i in range(3)]
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    r = client.get("/train/boss_rush")
    assert r.status_code == 200
    assert all(lv == "beginner" for lv in captured), f"beginner 고정 위반: {captured}"
    print(f"[V2c] intermediate 유저여도 beginner 고정 확인: {set(captured)}")


# ═══════════════════════════════════════════════════════════════════
# V3. 유닛선택 · 레벨칩 파라미터 전달
# ═══════════════════════════════════════════════════════════════════

def test_V3a_unit_none_returns_all_units(monkeypatch):
    """unit=None(전체) → 전체 유닛 문제 포함, unit=7만 지정 시 유닛 7만."""
    pool_all = _pool([5, 6, 7, 8])
    def fake_load(cat, course_level=None, unit=None):
        return [q for q in pool_all if unit is None or q["unit"] == unit]
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    r_all  = client.get("/train/review", params={"course_level": "beginner", "limit": 100})
    r_unit = client.get("/train/review", params={"unit": 7, "course_level": "beginner", "limit": 100})

    units_all  = {q["unit"] for q in r_all.json()}
    units_unit = {q["unit"] for q in r_unit.json()}

    assert units_unit == {7}, f"unit=7 지정인데 다른 유닛 포함: {units_unit}"
    assert len(units_all) > 1,  f"unit=None(전체)인데 유닛 1개만: {units_all}"
    print(f"[V3a] unit=None → {units_all} | unit=7 → {units_unit}")


def test_V3b_level_chip_course_level_param(monkeypatch):
    """course_level=beginner vs intermediate 파라미터가 loader에 정확히 전달된다."""
    captured = []
    def fake_load(cat, course_level=None, unit=None):
        captured.append(course_level)
        return [{"question_id": f"q{course_level}-{i}", "unit": 1} for i in range(3)]
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    client.get("/train/review", params={"unit": 1, "course_level": "beginner"})
    client.get("/train/review", params={"unit": 1, "course_level": "intermediate"})

    assert "beginner"     in captured
    assert "intermediate" in captured
    print(f"[V3b] level 파라미터 정확히 전달: {captured}")


def test_V3c_unit_selector_zero_is_not_valid(monkeypatch):
    """/train/review는 unit=0을 전체로 처리하지 않는다 — None만 전체."""
    pool = _pool([1, 2, 3])
    def fake_load(cat, course_level=None, unit=None):
        return [q for q in pool if unit is None or q["unit"] == unit]
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    # unit=0 → FastAPI는 int로 파싱하므로 unit=0 필터 적용 → 결과 없어야 함 (unit 0은 존재하지 않음)
    r = client.get("/train/review", params={"unit": 0, "course_level": "beginner", "limit": 100})
    assert r.status_code == 200
    # unit 0인 문제는 없으므로 빈 목록
    ids = [q["unit"] for q in r.json()]
    assert all(u == 0 for u in ids) or ids == [], f"unit=0 필터 위반: {ids}"
    print(f"[V3c] unit=0 → {len(ids)}개 (전체 아님, 전체는 unit=None)")


# ═══════════════════════════════════════════════════════════════════
# V4. attempts mode 값 정확성
# ═══════════════════════════════════════════════════════════════════

def test_V4a_quiz_mode_recorded(monkeypatch):
    """POST /attempts?mode=quiz → mode='quiz' 저장."""
    monkeypatch.setattr(ATT, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: [{"question_id": "q1"}])
    r = client.post("/attempts", json={
        "question_id": "q1", "unit": 1, "stage": "1-1",
        "level": "beginner", "mode": "quiz", "is_correct": True,
    })
    assert r.status_code == 200
    rows = _read_attempts()
    assert rows[0]["mode"] == "quiz"
    print(f"\n[V4a] mode=quiz → '{rows[0]['mode']}'")


def test_V4b_train_mode_recorded(monkeypatch):
    """POST /attempts?mode=train → mode='train' 저장."""
    monkeypatch.setattr(ATT, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: [{"question_id": "q1"}])
    r = client.post("/attempts", json={
        "question_id": "q1", "unit": 1, "stage": None,
        "level": "beginner", "mode": "train", "is_correct": False,
    })
    assert r.status_code == 200
    rows = _read_attempts()
    assert rows[0]["mode"] == "train"
    print(f"[V4b] mode=train → '{rows[0]['mode']}'")


def test_V4c_random_mode_recorded(monkeypatch):
    """POST /attempts?mode=random → mode='random' 저장 (ALLOWED_MODES에 포함)."""
    monkeypatch.setattr(ATT, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: [{"question_id": "q1"}])
    r = client.post("/attempts", json={
        "question_id": "q1", "unit": 2, "stage": None,
        "level": "beginner", "mode": "random", "is_correct": True,
    })
    assert r.status_code == 200
    rows = _read_attempts()
    assert rows[0]["mode"] == "random", f"'random' 미허용 → '{rows[0]['mode']}' 강등됨"
    print(f"[V4c] mode=random → '{rows[0]['mode']}'")


def test_V4d_boss_rush_mode_recorded(monkeypatch):
    """POST /attempts?mode=boss_rush → mode='boss_rush' 저장 (ALLOWED_MODES에 포함)."""
    monkeypatch.setattr(ATT, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: [{"question_id": "mb1"}])
    r = client.post("/attempts", json={
        "question_id": "mb1", "unit": 1, "stage": None,
        "level": "beginner", "mode": "boss_rush", "is_correct": False,
    })
    assert r.status_code == 200
    rows = _read_attempts()
    assert rows[0]["mode"] == "boss_rush", f"'boss_rush' 미허용 → '{rows[0]['mode']}' 강등됨"
    print(f"[V4d] mode=boss_rush → '{rows[0]['mode']}'")


def test_V4e_unknown_mode_falls_back_to_quiz(monkeypatch):
    """ALLOWED_MODES에 없는 mode → 'quiz'로 저장 (안전 폴백)."""
    monkeypatch.setattr(ATT, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: [{"question_id": "q1"}])
    r = client.post("/attempts", json={
        "question_id": "q1", "unit": 1, "stage": None,
        "level": "beginner", "mode": "UNKNOWN_MODE", "is_correct": True,
    })
    assert r.status_code == 200
    rows = _read_attempts()
    assert rows[0]["mode"] == "quiz"
    print(f"[V4e] 미허용 mode → 'quiz' 폴백: '{rows[0]['mode']}'")


def test_V4f_miniboss_mode_via_server(monkeypatch):
    """미니보스 서버 채점 → mode='miniboss' 저장."""
    monkeypatch.setattr(MINI, "load_miniboss_questions",
                        lambda level, unit: [{"question_id": "mb1", "stage": "1-1",
                                              "type": "multiple_choice", "question": "Q?",
                                              "options": ["A", "B", "C", "D"], "answer": "A"}])
    r = client.post("/boss/miniboss/answer", json={
        "question_id": "mb1", "user_answer": "A", "unit": 1, "stage": "1-1",
    })
    assert r.status_code == 200
    rows = _read_attempts()
    assert len(rows) == 1 and rows[0]["mode"] == "miniboss"
    print(f"[V4f] 미니보스 서버채점 → mode='{rows[0]['mode']}'")


# ═══════════════════════════════════════════════════════════════════
# V5. 빈 결과 시 셔플-15 폴백 없음
# ═══════════════════════════════════════════════════════════════════

def test_V5a_only_wrong_empty_no_fallback(monkeypatch):
    """오답복습(only_wrong=True) + 오답 없음 → [] (15개 셔플 폴백 없음)."""
    pool = _pool([7])
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: list(pool))
    # attempts 없음 → 오답도 없음
    r = client.get("/train/review", params={"unit": 7, "course_level": "beginner", "only_wrong": True})
    assert r.status_code == 200
    assert r.json() == [], f"폴백 발생: {len(r.json())}개 반환됨"
    print(f"\n[V5a] only_wrong=True + 오답 없음 → [] (폴백 없음)")


def test_V5b_only_wrong_false_shuffles_intentionally(monkeypatch):
    """only_wrong=False(유닛반복)는 셔플이 의도된 동작 — 빈 오답이어도 전체 풀 반환."""
    pool = _pool([7])  # 5개
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: list(pool))
    r = client.get("/train/review", params={"unit": 7, "course_level": "beginner",
                                            "only_wrong": False, "limit": 15})
    assert r.status_code == 200
    assert len(r.json()) == 5  # 풀 전체 (15개 중 있는 만큼)
    print(f"[V5b] only_wrong=False → 풀 전체 {len(r.json())}개 (유닛반복 의도된 동작)")


def test_V5c_random_empty_no_fallback(monkeypatch):
    """랜덤퀴즈 잠금해제 유닛 없음 → [], 셔플 폴백 없음."""
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _pool([1, 2, 3]))
    _seed_progress([])
    r = client.get("/train/random", params={"course_level": "beginner"})
    assert r.status_code == 200
    assert r.json() == []
    print("[V5c] 랜덤 잠금해제 없음 → [] (폴백 없음)")


def test_V5d_boss_rush_empty_no_fallback(monkeypatch):
    """보스특훈 클리어 없음 → [], 셔플 폴백 없음."""
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _pool([1, 2], "miniboss"))
    r = client.get("/train/boss_rush")
    assert r.status_code == 200
    assert r.json() == []
    print("[V5d] 보스특훈 클리어 없음 → [] (폴백 없음)")


def test_V5e_review_unit_not_found_no_fallback(monkeypatch):
    """존재하지 않는 unit=99 → [], 다른 유닛 폴백 없음."""
    pool = _pool([1, 2, 3])
    def fake_load(cat, course_level=None, unit=None):
        return [q for q in pool if unit is None or q["unit"] == unit]
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    r = client.get("/train/review", params={"unit": 99, "course_level": "beginner", "limit": 15})
    assert r.status_code == 200
    assert r.json() == [], f"없는 유닛인데 결과 있음: {len(r.json())}개"
    print("[V5e] unit=99(없음) → [] (타 유닛 폴백 없음)")
