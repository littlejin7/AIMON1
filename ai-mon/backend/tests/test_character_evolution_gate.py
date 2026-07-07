"""캐릭터 저장 게이트가 evolution_stage 기준으로 동작하는지 검증(진화-레벨 분리 후속 수정).

배경:
  routers/user.py 의 _allowed_characters 가 예전엔 lv(10/20/30) 기준이었다. lv 은
  3차 진화 전에는 동결되므로, evolution_stage 가 올라간 유저도 캐릭터 저장 시
  400 으로 거부되는 버그가 있었다(진화-레벨 분리의 부작용). evolution_stage 기준으로
  전환해 lv 값과 무관하게 올바른 게이트가 걸리는지 확인한다.
"""
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
    monkeypatch.setattr(USER, "serialize_user", lambda user: user.copy())


def test_allowed_characters_derives_from_stage_not_lv():
    assert USER._allowed_characters(0) == {"slime"}
    assert USER._allowed_characters(1) == {"slime", "robot"}
    assert USER._allowed_characters(2) == {"slime", "robot", "speech_bubble"}
    assert USER._allowed_characters(3) == {"slime", "robot", "speech_bubble", "final_ghost"}


@pytest.mark.parametrize("character", ["robot", "speech_bubble"])
def test_stage2_user_can_save_robot_and_speech_bubble(monkeypatch, character):
    """evolution_stage 2 유저 → robot/speech_bubble 저장 성공."""
    stored_user = {
        "id": "u-stage2", "evolution_stage": 2, "character": "slime",
        "lv": 1,  # 3차 전 동결된 낮은 lv — 게이트가 lv 을 보면 안 된다는 것의 근거
    }
    _patch_update_me_storage(monkeypatch, stored_user)

    response = USER.update_me(USER.UpdateProfileRequest(character=character), stored_user.copy())

    assert response["character"] == character
    assert stored_user["character"] == character


def test_stage2_user_cannot_save_final_ghost(monkeypatch):
    """evolution_stage 2 유저 → final_ghost(3차 전용)는 거부."""
    stored_user = {"id": "u-stage2b", "evolution_stage": 2, "character": "slime", "lv": 1}
    _patch_update_me_storage(monkeypatch, stored_user)

    with pytest.raises(USER.HTTPException) as exc:
        USER.update_me(USER.UpdateProfileRequest(character="final_ghost"), stored_user.copy())

    assert exc.value.status_code == 400
    assert stored_user["character"] == "slime"  # 변경 없음


@pytest.mark.parametrize("character", ["robot", "speech_bubble", "final_ghost"])
def test_stage0_user_rejected_for_any_evolved_character(monkeypatch, character):
    """evolution_stage 0 유저 → 상위 캐릭터 전부 거부, slime 만 허용."""
    stored_user = {"id": "u-stage0", "evolution_stage": 0, "character": "slime", "lv": 1}
    _patch_update_me_storage(monkeypatch, stored_user)

    with pytest.raises(USER.HTTPException) as exc:
        USER.update_me(USER.UpdateProfileRequest(character=character), stored_user.copy())

    assert exc.value.status_code == 400
    assert stored_user["character"] == "slime"


def test_stage0_user_can_save_slime():
    stored_user = {"id": "u-stage0b", "evolution_stage": 0, "character": "slime", "lv": 1}
    assert "slime" in USER._allowed_characters(U.get_evolution_stage(stored_user))


def test_frozen_low_lv_does_not_block_stage_based_unlock(monkeypatch):
    """핵심 회귀: 3차 진화 후에도 lv 이 낮게 동결돼 있으면(예: 신규 유저가 보스만
    깨고 GP 를 못 모은 경우) 예전 버그는 lv 기준으로 거부했지만, 이제는
    evolution_stage 만 보고 final_ghost 저장을 허용해야 한다."""
    stored_user = {
        "id": "u-frozen", "evolution_stage": 3, "character": "speech_bubble",
        "lv": 1,  # 과거 lv 기준(10/20/30)이었다면 final_ghost(lv>=30) 거부됐을 값
    }
    _patch_update_me_storage(monkeypatch, stored_user)

    response = USER.update_me(USER.UpdateProfileRequest(character="final_ghost"), stored_user.copy())

    assert response["character"] == "final_ghost"


def test_legacy_user_without_evolution_stage_field_falls_back_to_character():
    """evolution_stage 필드가 아직 없는(3단계 backfill 전) 레거시 유저도
    get_evolution_stage 의 character 파생 폴백으로 올바르게 게이트된다."""
    legacy_robot_user = {"id": "u-legacy", "character": "robot"}  # evolution_stage 필드 없음
    stage = U.get_evolution_stage(legacy_robot_user)
    assert stage == 1
    allowed = USER._allowed_characters(stage)
    assert "robot" in allowed
    assert "speech_bubble" not in allowed
