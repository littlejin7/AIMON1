import os
import sys
import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import user as USER
from routers import utils as U


def _patch_update_me_storage(monkeypatch, stored_user):
    def fake_mutate_user_atomic(user_id, mutator):
        assert user_id == stored_user["id"]
        result = mutator(stored_user)
        return stored_user, result

    monkeypatch.setattr(USER, "mutate_user_atomic", fake_mutate_user_atomic)
    monkeypatch.setattr(
        USER,
        "serialize_user",
        lambda user: {
            **user.copy(),
            "unlocked_course_levels": U.derive_unlocked_course_levels(user),
        },
    )


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


def test_get_me_keeps_selected_level_and_serializes_unlocks(monkeypatch):
    stored_user = {
        "id": "u1",
        "course_level": "beginner",
        "endboss_cleared_levels": ["beginner"],
    }

    monkeypatch.setattr(
        USER,
        "serialize_user",
        lambda user: {
            **user.copy(),
            "unlocked_course_levels": U.derive_unlocked_course_levels(user),
        },
    )

    response = USER.get_me(stored_user.copy())

    assert response["course_level"] == "beginner"
    assert response["unlocked_course_levels"] == ["beginner", "intermediate"]


def test_unlocked_course_levels_are_derived_from_endboss_clears():
    assert U.derive_unlocked_course_levels({"endboss_cleared_levels": []}) == ["beginner"]
    assert U.derive_unlocked_course_levels({"endboss_cleared_levels": ["beginner"]}) == [
        "beginner",
        "intermediate",
    ]
    assert U.derive_unlocked_course_levels(
        {"endboss_cleared_levels": ["beginner", "intermediate"]}
    ) == ["beginner", "intermediate", "advanced"]


def test_unlocked_course_levels_ignore_progress_use_boss_clears_only(monkeypatch):
    # progress 기반 언락은 제거됨 — 언락 판정은 endboss/unitboss 이력만 사용한다.
    # progress 에 상위 레벨 완료 기록이 있어도 무시되어 beginner 만 언락되어야 한다.
    monkeypatch.setattr(
        U,
        "get_progress_by_user",
        lambda user_id, course_level=None: [
            {"user_id": user_id, "course_level": "intermediate", "is_completed": True},
            {"user_id": user_id, "course_level": "advanced", "is_completed": True},
        ],
    )
    user = {
        "id": "u1",
        "course_level": "advanced",
        "endboss_cleared_levels": None,
    }

    assert U.derive_unlocked_course_levels(user) == ["beginner"]


def test_update_me_allows_beginner_even_without_unlocks(monkeypatch):
    stored_user = {"id": "u1", "course_level": "advanced", "endboss_cleared_levels": []}
    _patch_update_me_storage(monkeypatch, stored_user)

    response = USER.update_me(USER.UpdateProfileRequest(course_level="beginner"), stored_user.copy())

    assert response["course_level"] == "beginner"


@pytest.mark.parametrize("locked_level", ["intermediate", "advanced"])
def test_update_me_rejects_locked_levels_without_endboss_clears(monkeypatch, locked_level):
    stored_user = {"id": "u1", "course_level": "beginner", "endboss_cleared_levels": []}
    _patch_update_me_storage(monkeypatch, stored_user)

    with pytest.raises(USER.HTTPException) as exc:
        USER.update_me(USER.UpdateProfileRequest(course_level=locked_level), stored_user.copy())

    assert exc.value.status_code == 400
    assert stored_user["course_level"] == "beginner"


def test_update_me_allows_intermediate_after_beginner_endboss_clear(monkeypatch):
    stored_user = {
        "id": "u1",
        "course_level": "beginner",
        "endboss_cleared_levels": ["beginner"],
    }
    _patch_update_me_storage(monkeypatch, stored_user)

    response = USER.update_me(USER.UpdateProfileRequest(course_level="intermediate"), stored_user.copy())

    assert response["course_level"] == "intermediate"
    assert response["unlocked_course_levels"] == ["beginner", "intermediate"]


def test_advanced_unlock_survives_switch_to_beginner_and_back(monkeypatch):
    stored_user = {
        "id": "u1",
        "course_level": "advanced",
        "endboss_cleared_levels": ["beginner", "intermediate"],
    }
    _patch_update_me_storage(monkeypatch, stored_user)

    beginner_response = USER.update_me(
        USER.UpdateProfileRequest(course_level="beginner"),
        stored_user.copy(),
    )
    advanced_response = USER.update_me(
        USER.UpdateProfileRequest(course_level="advanced"),
        stored_user.copy(),
    )

    assert beginner_response["course_level"] == "beginner"
    assert beginner_response["unlocked_course_levels"] == ["beginner", "intermediate", "advanced"]
    assert stored_user["endboss_cleared_levels"] == ["beginner", "intermediate"]
    assert advanced_response["course_level"] == "advanced"
