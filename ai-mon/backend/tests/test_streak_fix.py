"""버그1(streak) 회귀 테스트 — /auth/touch + KST dedup 검증."""
import os, sys
import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import auth as A
from routers.utils import UserSaveError


def _today_yesterday():
    today = A.now_kst().strftime("%Y-%m-%d")
    yesterday = (A.now_kst() - A.timedelta(days=1)).strftime("%Y-%m-%d")
    return today, yesterday


def test_streak_increments_on_consecutive_day():
    today, yesterday = _today_yesterday()
    user = {"streak": 3, "last_login": yesterday, "xp": 0,
            "earned_streak_milestones": [], "missions": {}}
    updated, _ = A.update_login_streak(user)
    assert updated["streak"] == 4
    assert updated["last_login"] == today


def test_streak_resets_after_gap():
    user = {"streak": 9, "last_login": "2000-01-01", "xp": 0,
            "earned_streak_milestones": [], "missions": {}}
    updated, _ = A.update_login_streak(user)
    assert updated["streak"] == 1


def test_streak_no_double_increment_same_day():
    today, _ = _today_yesterday()
    user = {"streak": 5, "last_login": today, "xp": 0,
            "earned_streak_milestones": [], "missions": {}}
    updated, reward = A.update_login_streak(user)
    assert updated["streak"] == 5, "같은 날 재호출에 streak 중복 증가"
    assert reward is None


def test_touch_returns_current_user_when_save_conflict(monkeypatch):
    user = {"id": "u1", "streak": 2, "last_login": "2026-01-01", "username": "tester"}
    monkeypatch.setattr(
        A,
        "mutate_user_atomic",
        lambda uid, fn: (_ for _ in ()).throw(UserSaveError(uid)),
    )
    monkeypatch.setattr(A, "serialize_user", lambda u: {k: v for k, v in u.items() if k != "password"})

    res = A.touch(user)

    assert res["streak"] == 2
    assert res["user"]["id"] == "u1"
    assert "streak_reward" not in res
