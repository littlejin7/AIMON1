import os
import sys

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import user as USER
from routers import utils as U


def test_beginner_endboss_clear_promotes_to_intermediate():
    user = {
        "id": "u1",
        "course_level": "beginner",
        "endboss_cleared_levels": ["beginner"],
    }

    changed = U.promote_course_level_from_endboss(user)

    assert changed is True
    assert user["course_level"] == "intermediate"


def test_intermediate_endboss_clear_promotes_to_advanced():
    user = {
        "id": "u1",
        "course_level": "intermediate",
        "endboss_cleared_levels": ["intermediate"],
    }

    changed = U.promote_course_level_from_endboss(user)

    assert changed is True
    assert user["course_level"] == "advanced"


def test_existing_multi_clear_user_promotes_to_highest_unlocked_level():
    user = {
        "id": "u1",
        "course_level": "beginner",
        "endboss_cleared_levels": ["beginner", "intermediate"],
    }

    changed = U.promote_course_level_from_endboss(user)

    assert changed is True
    assert user["course_level"] == "advanced"


def test_get_me_backfills_existing_endboss_clear(monkeypatch):
    stored_user = {
        "id": "u1",
        "course_level": "beginner",
        "endboss_cleared_levels": ["beginner"],
    }
    calls = []

    def fake_mutate_user_atomic(user_id, mutator):
        calls.append(user_id)
        result = mutator(stored_user)
        return stored_user, result

    monkeypatch.setattr(USER, "mutate_user_atomic", fake_mutate_user_atomic)
    monkeypatch.setattr(USER, "serialize_user", lambda user: user.copy())

    response = USER.get_me(stored_user.copy())

    assert calls == ["u1"]
    assert response["course_level"] == "intermediate"
