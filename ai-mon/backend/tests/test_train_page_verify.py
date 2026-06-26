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


# ═══════════════════════════════════════════════════════════════════
# V6. 오답복습이 quiz 네임스페이스 오답과 매칭된다 (id 네임스페이스 버그 회귀 방지)
#
# 레슨/스테이지 퀴즈 오답은 attempts에 mode='quiz', question_id='q001'(quiz 풀
# 네임스페이스)로 기록된다. 과거 /train/review 는 train 풀(u1_q001~)에서만 매칭해
# 교집합이 0 → 오답 0건 → 랜덤 폴백으로 빠졌다. 이제 quiz+miniboss(+train) 풀을
# 합쳐 인덱싱하므로 실제 quiz 오답이 정확히 잡혀야 한다.
# ═══════════════════════════════════════════════════════════════════

def _quiz_pool(unit, n=5):
    """quiz 네임스페이스(q001~) 풀 — train 풀(u1_q001~)과 id가 겹치지 않는다."""
    return [{"question_id": f"q00{i}", "unit": unit, "quiz_category": "quiz"}
            for i in range(1, n + 1)]


def _fake_load_by_cat(quiz_pool):
    """cat=='quiz'면 quiz_pool, miniboss/train 등은 빈 풀(실제 데이터 구조 모사)."""
    def fake_load(cat, course_level=None, unit=None):
        if cat != "quiz":
            return []
        return [q for q in quiz_pool if unit is None or q["unit"] == unit]
    return fake_load


def _record_wrong(question_id, unit, is_correct=False, level="beginner"):
    r = client.post("/attempts", json={
        "question_id": question_id, "unit": unit, "stage": "1-1",
        "level": level, "mode": "quiz", "is_correct": is_correct,
    })
    assert r.status_code == 200, r.text


def test_V6a_only_wrong_matches_quiz_namespace_attempts(monkeypatch):
    """quiz 오답(q002·q004) 기록 → only_wrong=True 가 정확히 그 문제들만 반환."""
    quiz_pool = _quiz_pool(unit=1)
    fake_load = _fake_load_by_cat(quiz_pool)
    # 오답 기록(attempts)·복습 조회(train) 양쪽에서 같은 로더를 쓰도록 모두 패치
    monkeypatch.setattr(ATT, "load_questions_by_category", fake_load)
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    _record_wrong("q001", unit=1, is_correct=True)   # 정답 → 제외
    _record_wrong("q002", unit=1, is_correct=False)  # 오답
    _record_wrong("q004", unit=1, is_correct=False)  # 오답

    r = client.get("/train/review", params={"unit": 1, "course_level": "beginner",
                                            "only_wrong": True, "limit": 15})
    assert r.status_code == 200
    ids = [q["question_id"] for q in r.json()]
    assert set(ids) == {"q002", "q004"}, f"오답 매칭 실패(랜덤 폴백?): {ids}"
    print(f"\n[V6a] quiz 오답 정확히 매칭: {ids}")


def test_V6b_only_wrong_is_deterministic_not_random(monkeypatch):
    """only_wrong=True 를 반복 호출해도 결과(내용·순서)가 동일 — 랜덤 아님."""
    quiz_pool = _quiz_pool(unit=1)
    fake_load = _fake_load_by_cat(quiz_pool)
    monkeypatch.setattr(ATT, "load_questions_by_category", fake_load)
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    for qid in ("q001", "q002", "q003"):
        _record_wrong(qid, unit=1, is_correct=False)

    params = {"unit": 1, "course_level": "beginner", "only_wrong": True, "limit": 15}
    first = [q["question_id"] for q in client.get("/train/review", params=params).json()]
    for _ in range(5):
        again = [q["question_id"] for q in client.get("/train/review", params=params).json()]
        assert again == first, f"반복 호출 결과 불일치(랜덤): {first} != {again}"
    assert set(first) == {"q001", "q002", "q003"}
    assert len(first) == 3, f"오답 외 랜덤 패딩 발생: {first}"
    print(f"[V6b] 반복 호출 동일(랜덤 아님): {first}")


def test_V6c_only_wrong_empty_when_no_quiz_wrong(monkeypatch):
    """오답이 하나도 없으면 only_wrong=True 는 [] (랜덤 15 폴백 절대 없음)."""
    quiz_pool = _quiz_pool(unit=1)
    fake_load = _fake_load_by_cat(quiz_pool)
    monkeypatch.setattr(ATT, "load_questions_by_category", fake_load)
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    _record_wrong("q001", unit=1, is_correct=True)  # 정답만 존재

    r = client.get("/train/review", params={"unit": 1, "course_level": "beginner",
                                            "only_wrong": True, "limit": 15})
    assert r.status_code == 200
    assert r.json() == [], f"오답 없는데 폴백 발생: {len(r.json())}개"
    print("[V6c] 오답 없음 → [] (랜덤 폴백 없음)")


# ═══════════════════════════════════════════════════════════════════
# V7. 레슨 재시도 정답이 오답을 지우지 않는다 (오답 발생/해소 분리)
#
# 레슨(quiz/miniboss)에서 한 번이라도 틀리면 오답으로 남고, 복습모드
# (train/random/boss_rush)에서 정답을 내야만 오답에서 빠진다. 레슨 '다시 풀기'로
# 늦게 기록된 정답(quiz correct)으로는 오답이 사라지지 않아야 한다.
# ═══════════════════════════════════════════════════════════════════

def _record(question_id, unit, mode, is_correct, level="beginner"):
    r = client.post("/attempts", json={
        "question_id": question_id, "unit": unit, "stage": "1-1",
        "level": level, "mode": mode, "is_correct": is_correct,
    })
    assert r.status_code == 200, r.text


def test_V7a_lesson_wrong_shows_before_review_clear(monkeypatch):
    """quiz로 오답 기록(복습 정답 전) → only_wrong=True 에 뜬다."""
    fake_load = _fake_load_by_cat(_quiz_pool(unit=1))
    monkeypatch.setattr(ATT, "load_questions_by_category", fake_load)
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    _record("q002", unit=1, mode="quiz", is_correct=False)

    r = client.get("/train/review", params={"unit": 1, "course_level": "beginner",
                                            "only_wrong": True, "limit": 15})
    ids = [q["question_id"] for q in r.json()]
    assert ids == ["q002"], f"오답 미표시: {ids}"
    print(f"\n[V7a] 레슨 오답(복습 전) 표시: {ids}")


def test_V7b_lesson_retry_correct_does_not_clear(monkeypatch):
    """같은 qid를 quiz wrong→correct(재시도) 두 건 기록해도 여전히 오답으로 뜬다."""
    fake_load = _fake_load_by_cat(_quiz_pool(unit=1))
    monkeypatch.setattr(ATT, "load_questions_by_category", fake_load)
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    _record("q002", unit=1, mode="quiz", is_correct=False)  # 처음 오답
    _record("q002", unit=1, mode="quiz", is_correct=True)   # 레슨 재시도 정답

    r = client.get("/train/review", params={"unit": 1, "course_level": "beginner",
                                            "only_wrong": True, "limit": 15})
    ids = [q["question_id"] for q in r.json()]
    assert ids == ["q002"], f"레슨 재시도 정답이 오답을 지움(버그): {ids}"
    print(f"[V7b] 레슨 재시도 정답으로 안 지워짐: {ids}")


@pytest.mark.parametrize("review_mode", ["train", "random", "boss_rush"])
def test_V7c_review_correct_clears_wrong(monkeypatch, review_mode):
    """복습모드(train/random/boss_rush) 정답을 내면 그 qid가 오답에서 사라진다."""
    fake_load = _fake_load_by_cat(_quiz_pool(unit=1))
    monkeypatch.setattr(ATT, "load_questions_by_category", fake_load)
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    _record("q002", unit=1, mode="quiz", is_correct=False)       # 레슨 오답
    _record("q002", unit=1, mode=review_mode, is_correct=True)   # 복습 정답 → 해소

    r = client.get("/train/review", params={"unit": 1, "course_level": "beginner",
                                            "only_wrong": True, "limit": 15})
    ids = [q["question_id"] for q in r.json()]
    assert ids == [], f"복습({review_mode}) 정답인데 오답 잔존: {ids}"
    print(f"[V7c] 복습({review_mode}) 정답 → 오답 해소: {ids}")


def test_V7d_unit_accuracy_unchanged_latest_based(monkeypatch):
    """get_unit_accuracy 는 기존 latest-기반 유지 — quiz 재시도 정답이 정답률에 반영된다."""
    # accuracy 는 문제 로더를 쓰지 않으므로 attempts 기록만으로 검증
    _record("q001", unit=1, mode="quiz", is_correct=False)  # 최초 오답
    _record("q001", unit=1, mode="quiz", is_correct=True)   # 재시도 정답 → 최신=정답
    _record("q002", unit=1, mode="quiz", is_correct=False)  # 계속 오답

    r = client.get("/train/accuracy", params={"course_level": "beginner"})
    assert r.status_code == 200
    unit1 = next(x for x in r.json() if x["unit"] == 1)
    # latest-기반: q001=정답(최신), q002=오답 → 2문제 중 1정답 = 50%
    assert unit1 == {"unit": 1, "correct": 1, "total": 2, "pct": 50}, unit1
    print(f"[V7d] get_unit_accuracy latest-기반 유지: {unit1}")


# ═══════════════════════════════════════════════════════════════════
# V8. 랜덤퀴즈(/train/random) 풀 = train 문항 + 레슨 오답 (quiz-only 폐지)
# ═══════════════════════════════════════════════════════════════════

def _fake_load_train_quiz(unlocked_units, n=5):
    """cat별 네임스페이스 분리 로더: train=u{u}_q*, quiz=q*, miniboss=[]."""
    def fake_load(cat, course_level=None, unit=None):
        if cat == "train":
            return [{"question_id": f"u{u}_q00{i}", "unit": u}
                    for u in unlocked_units for i in range(1, n + 1)
                    if unit is None or u == unit]
        if cat == "quiz":
            return [{"question_id": f"q00{i}", "unit": u}
                    for u in unlocked_units for i in range(1, n + 1)
                    if unit is None or u == unit]
        return []  # miniboss 등
    return fake_load


def test_V8a_random_pool_is_train_plus_wrong(monkeypatch):
    """train 문항 + 레슨 오답(q002)이 한 풀에 섞여 출제된다 (quiz 전체가 아님)."""
    fake_load = _fake_load_train_quiz([1])
    monkeypatch.setattr(ATT, "load_questions_by_category", fake_load)
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)
    _seed_progress([
        {"user_id": "u1", "unit": 1, "stage": "1-1", "is_completed": True, "course_level": "beginner"},
    ])
    _record("q002", unit=1, mode="quiz", is_correct=False)  # 레슨 오답

    r = client.get("/train/random", params={"n": 50, "course_level": "beginner"})
    assert r.status_code == 200
    ids = {q["question_id"] for q in r.json()}
    # train 문항(u1_q*) 포함
    assert any(i.startswith("u1_q") for i in ids), f"train 문항 미포함: {ids}"
    # 레슨 오답 q002 포함
    assert "q002" in ids, f"레슨 오답 미포함: {ids}"
    # 오답 아닌 quiz 문제(q001 등)는 풀에 없음 — quiz-only 폐지 확인
    assert not any(i in ids for i in ("q001", "q003", "q004", "q005")), f"오답 아닌 quiz 혼입: {ids}"
    print(f"\n[V8a] 랜덤풀 = train + 오답: {sorted(ids)}")


def test_V8b_random_empty_pool_no_fallback(monkeypatch):
    """잠금해제 유닛은 있으나 train 문항·오답이 모두 없으면 [] (폴백 없음)."""
    def fake_load(cat, course_level=None, unit=None):
        return []  # 어떤 카테고리도 비어 있음
    monkeypatch.setattr(ATT, "load_questions_by_category", fake_load)
    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)
    _seed_progress([
        {"user_id": "u1", "unit": 1, "stage": "1-1", "is_completed": True, "course_level": "beginner"},
    ])
    r = client.get("/train/random", params={"course_level": "beginner"})
    assert r.status_code == 200
    assert r.json() == []
    print("[V8b] 빈 풀 → [] (폴백 없음)")
