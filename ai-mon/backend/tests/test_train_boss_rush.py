"""
GET /train/boss_rush 동작 검증.

  B0. miniboss_cleared_stages 없음 → 빈 목록 (폴백 없음)
  B1. 유닛 1·2 클리어 → 해당 유닛 miniboss 문제만, 초급 고정
  B2. n 파라미터 개수 제한
  B3. 비로그인 → 빈 목록
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

client = TestClient(app)


def _user(cleared_stages=None):
    return {
        "id": "u1", "course_level": "intermediate",  # 레벨과 무관하게 beginner 고정 확인용
        "lv": 5, "xp": 0, "crowns": 0,
        "miniboss_cleared_stages": cleared_stages or [],
    }


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

    app.dependency_overrides[U.get_current_user]          = lambda: _user()
    app.dependency_overrides[U.get_current_user_optional] = lambda: _user()
    yield
    app.dependency_overrides.clear()


def _pool(units):
    return [{"question_id": f"mb{u}-{i}", "unit": u, "quiz_category": "miniboss"} for u in units for i in range(4)]


# ─────────────────────────────────────────────────────────────────────────────
# B0. 클리어한 미니보스 없음 → 빈 목록
# ─────────────────────────────────────────────────────────────────────────────
def test_boss_rush_no_cleared_returns_empty(monkeypatch):
    app.dependency_overrides[U.get_current_user_optional] = lambda: _user(cleared_stages=[])
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _pool([unit] if unit else []))

    r = client.get("/train/boss_rush")
    assert r.status_code == 200
    assert r.json() == []
    print("\n[B0] 클리어 없음 → 빈 목록 OK")


# ─────────────────────────────────────────────────────────────────────────────
# B1. 유닛 1·2 클리어 → 해당 유닛 문제만 / course_level 무관 beginner 고정 확인
# ─────────────────────────────────────────────────────────────────────────────
def test_boss_rush_only_cleared_units(monkeypatch):
    # stage_key 형식: "1-1", "1-2", "2-1"  → 유닛 1·2 클리어
    app.dependency_overrides[U.get_current_user_optional] = lambda: _user(
        cleared_stages=["1-1", "1-2", "2-1"]
    )
    all_pool = _pool([1, 2, 3])
    captured_levels = []

    def fake_load(cat, course_level=None, unit=None):
        captured_levels.append(course_level)
        return [q for q in all_pool if unit is None or q["unit"] == unit]

    monkeypatch.setattr(TRAIN, "load_questions_by_category", fake_load)

    r = client.get("/train/boss_rush", params={"n": 20})
    assert r.status_code == 200
    units_in_result = {q["unit"] for q in r.json()}
    assert units_in_result == {1, 2}, f"예상 {{1,2}}, 실제 {units_in_result}"
    # 초급 고정 확인
    assert all(lv == "beginner" for lv in captured_levels), f"beginner 고정 위반: {captured_levels}"
    print("[B1] 유닛 1·2만 출제 OK | course_level:", set(captured_levels))


# ─────────────────────────────────────────────────────────────────────────────
# B2. n 파라미터로 개수 제한
# ─────────────────────────────────────────────────────────────────────────────
def test_boss_rush_n_param(monkeypatch):
    app.dependency_overrides[U.get_current_user_optional] = lambda: _user(cleared_stages=["1-1"])
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _pool([unit] if unit else []))

    r = client.get("/train/boss_rush", params={"n": 3})
    assert r.status_code == 200
    assert len(r.json()) == 3
    print("[B2] n=3 → 결과 3개 OK")


# ─────────────────────────────────────────────────────────────────────────────
# B3. 비로그인 → 빈 목록
# ─────────────────────────────────────────────────────────────────────────────
def test_boss_rush_unauthenticated(monkeypatch):
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda cat, course_level=None, unit=None: _pool([1]))
    app.dependency_overrides[U.get_current_user_optional] = lambda: None

    r = client.get("/train/boss_rush")
    assert r.status_code == 200
    assert r.json() == []
    print("[B3] 비로그인 → 빈 목록 OK")
