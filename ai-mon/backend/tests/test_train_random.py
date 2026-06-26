"""
GET /train/random 동작 검증.

  R0. 잠금해제 유닛 없음 → 빈 목록 (폴백 없음)
  R1. 유닛 2 클리어 → 유닛 1·2 문제만 출제
  R2. n 파라미터로 개수 제한 확인
  R3. 비로그인 → 빈 목록
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
from main import app

TEST_USER = {"id": "u1", "course_level": "beginner", "lv": 1, "xp": 0, "crowns": 0}

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolate(monkeypatch, tmp_path):
    for attr, name in [
        ("ATTEMPTS_FILE",     "attempts.json"),
        ("WRONG_ANSWERS_FILE","wrong_answers.json"),
        ("USERS_FILE",        "users.json"),
        ("PROGRESS_FILE",     "progress.json"),
    ]:
        monkeypatch.setattr(U, attr, str(tmp_path / name))
    monkeypatch.setattr(U, "USE_SUPABASE", False)

    app.dependency_overrides[U.get_current_user]          = lambda: dict(TEST_USER)
    app.dependency_overrides[U.get_current_user_optional] = lambda: dict(TEST_USER)
    yield
    app.dependency_overrides.clear()


def _seed_progress(rows):
    with open(U.PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(rows, f)


def _make_pool(units):
    """unit 목록 각각 3문제씩 가짜 풀 생성."""
    return [
        {"question_id": f"q{u}-{i}", "question": f"Q{u}-{i}", "unit": u}
        for u in units for i in range(3)
    ]


# ─────────────────────────────────────────────────────────────────────────────
# R0. 클리어 유닛 없음 → 빈 목록
# ─────────────────────────────────────────────────────────────────────────────
def test_random_no_unlocked_returns_empty(monkeypatch):
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _make_pool([unit] if unit else [1, 2]))
    # progress 비어 있음 (잠금해제 유닛 0개)
    _seed_progress([])

    r = client.get("/train/random", params={"course_level": "beginner"})
    assert r.status_code == 200
    assert r.json() == [], r.json()
    print("\n[R0] 잠금해제 유닛 없음 → 빈 목록 OK")


# ─────────────────────────────────────────────────────────────────────────────
# R1. 유닛 1·2 클리어 → 해당 유닛 문제만 포함
# ─────────────────────────────────────────────────────────────────────────────
def test_random_only_from_unlocked_units(monkeypatch):
    # 잠금해제 유닛 = 1, 2 (is_completed=True 스테이지 존재)
    # 유닛 3는 미클리어
    all_pool = _make_pool([1, 2, 3])

    def fake_load(cat, course_level=None, unit=None):
        return [q for q in all_pool if unit is None or q["unit"] == unit]

    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    _seed_progress([
        {"user_id": "u1", "unit": 1, "stage": "1-1",    "is_completed": True,  "course_level": "beginner"},
        {"user_id": "u1", "unit": 1, "stage": "1-boss",  "is_completed": True,  "course_level": "beginner"},
        {"user_id": "u1", "unit": 2, "stage": "2-1",    "is_completed": True,  "course_level": "beginner"},
        {"user_id": "u1", "unit": 3, "stage": "3-1",    "is_completed": False, "course_level": "beginner"},
    ])

    r = client.get("/train/random", params={"n": 20, "course_level": "beginner"})
    assert r.status_code == 200
    units_in_result = {q["unit"] for q in r.json()}
    assert units_in_result == {1, 2}, f"예상 유닛 {{1,2}}, 실제 {units_in_result}"
    print("[R1] 잠금해제 유닛 1·2만 출제:", units_in_result)


# ─────────────────────────────────────────────────────────────────────────────
# R2. n 파라미터로 개수 제한
# ─────────────────────────────────────────────────────────────────────────────
def test_random_n_param_limits_count(monkeypatch):
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _make_pool([unit] if unit else []))

    _seed_progress([
        {"user_id": "u1", "unit": 1, "stage": "1-boss", "is_completed": True, "course_level": "beginner"},
    ])

    r = client.get("/train/random", params={"n": 2, "course_level": "beginner"})
    assert r.status_code == 200
    assert len(r.json()) == 2, len(r.json())
    print("[R2] n=2 → 결과 2개:", len(r.json()))


# ─────────────────────────────────────────────────────────────────────────────
# R3. 비로그인 → 빈 목록
# ─────────────────────────────────────────────────────────────────────────────
def test_random_unauthenticated_returns_empty(monkeypatch):
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _make_pool([1]))
    _seed_progress([
        {"user_id": "u1", "unit": 1, "stage": "1-boss", "is_completed": True, "course_level": "beginner"},
    ])

    # 비로그인 상태 — optional 의존성을 None 반환으로 오버라이드
    app.dependency_overrides[U.get_current_user_optional] = lambda: None
    try:
        r = client.get("/train/random", params={"course_level": "beginner"})
        assert r.status_code == 200
        assert r.json() == []
    finally:
        app.dependency_overrides[U.get_current_user_optional] = lambda: dict(TEST_USER)
    print("[R3] 비로그인 → 빈 목록 OK")
