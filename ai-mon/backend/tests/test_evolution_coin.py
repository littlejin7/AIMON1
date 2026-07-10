"""2단계 A파트 회귀 테스트: 진화-레벨 분리 + 상점 코인화.

검증 정책:
- 진화는 엔드보스 클리어(evolution_stage 증가)로만 발생한다.
  초급→1 / 중급→2 / 고급→3. 보스 클리어 보상으로 GP 는 지급하지 않는다(gp_delta=0).
- apply_xp 는 더 이상 자동 진화를 하지 않는다(XP 만 쌓아도 진화 안 됨).
- 상점 구매는 coin_balance 만 차감하고 gp/ranking_score/evolution_stage/crowns/xp 는 불변.
- 잔액 부족 시 구매 실패하고 값이 전혀 변하지 않는다.
"""
import os
import sys
import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

from fastapi import HTTPException

import routers.endboss as E
import routers.user as UR
import routers.utils as U
from routers.battle_session import make_battle_token, create_endboss_session


def _won_battle_token(user, level, project="account"):
    """엔드보스 won 세션을 user(파일 저장 전)에 심고 대응 battle_token 을 반환.

    서버 권위 클리어 게이트(status=="won")를 통과시키기 위한 테스트 픽스처.
    caller 가 이후 U.save_users([user]) 로 세션을 영속해야 clear mutator 가 읽는다.
    """
    token, sid = make_battle_token(E.MODE, None, level, user["id"])
    create_endboss_session(user, sid, level, project, E.BOSS_HP_INIT, E.MY_HP_INIT, E.PHASE3_MAX_TRIES)
    user["battle_sessions"][sid]["status"] = "won"
    return token


def _make_user(**overrides):
    user = {
        "id": "u1",
        "username": "evo-user",
        "nickname": "EvoUser",
        "email": "evo@example.com",
        "course_level": "beginner",
        "character": "slime",
        "lv": 1,
        "xp": 0,
        "crowns": 20,
        "endboss_cleared_levels": [],
        "max_unlocked_unit": {"beginner": 9, "intermediate": 9, "advanced": 9},
        "seen_questions": {},
    }
    user.update(overrides)
    return user


# ── evolution_stage 매핑/게이트 헬퍼 ─────────────────────────────────────────

def test_get_evolution_stage_derives_from_character_when_field_absent():
    assert U.get_evolution_stage({"character": "slime"}) == 0
    assert U.get_evolution_stage({"character": "robot"}) == 1
    assert U.get_evolution_stage({"character": "speech_bubble"}) == 2
    assert U.get_evolution_stage({"character": "final_ghost"}) == 3
    # 필드가 있으면 그 값이 우선
    assert U.get_evolution_stage({"character": "slime", "evolution_stage": 3}) == 3


def test_character_for_stage_roundtrip_and_clamp():
    assert U.character_for_stage(0) == "slime"
    assert U.character_for_stage(3) == "final_ghost"
    assert U.character_for_stage(99) == "final_ghost"   # 상한 클램프
    assert U.character_for_stage(-5) == "slime"          # 하한 클램프


def test_gp_gate_blocks_gp_before_stage3():
    assert U.gp_gate({"evolution_stage": 0}, 100) == 0
    assert U.gp_gate({"evolution_stage": 2}, 100) == 0
    # 3차 진화 이후에만 통과
    assert U.gp_gate({"evolution_stage": 3}, 100) == 100


# ── 엔드보스 클리어 = 진화 트리거 (초/중/고급 → stage 1/2/3, gp 불변) ─────────

@pytest.mark.parametrize("level,expected_stage,expected_char", [
    ("beginner", 1, "robot"),
    ("intermediate", 2, "speech_bubble"),
    ("advanced", 3, "final_ghost"),
])
def test_endboss_clear_increments_evolution_stage(monkeypatch, tmp_path, level, expected_stage, expected_char):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(id=f"u-{level}", course_level=level, endboss_cleared_levels=[])
    token = _won_battle_token(user, level)
    U.save_users([user])

    result = E.endboss_clear(
        E.ClearRequest(project="account", target_level=level, battle_token=token), user=user
    )

    # 진화 발생 + gp 미지급
    assert result["already_cleared"] is False
    assert result["gp_delta"] == 0
    assert result["evolution_stage"] == expected_stage
    assert result["character"] == expected_char
    assert result["evolution"] == {"evolved": True, "from_stage": 0, "to_stage": expected_stage}

    # 2-C: 보상은 coin + ranking_score 분리 발급, gp 는 0
    assert result["reward"] == {
        "coin_delta": E.BOSS_CLEAR_REWARD,
        "gp_delta": 0,
        "ranking_score_delta": E.BOSS_CLEAR_REWARD,
    }
    assert result["user_state"]["coin_balance"] == E.BOSS_CLEAR_REWARD
    assert result["user_state"]["ranking_score"] == E.BOSS_CLEAR_REWARD
    assert result["user_state"]["gp"] == 0
    # 진화 정보가 보상보다 앞 순서(프론트 표시 우선순위)
    keys = list(result.keys())
    assert keys.index("evolution") < keys.index("reward")

    persisted = U.get_user_by_id(f"u-{level}")
    assert persisted["evolution_stage"] == expected_stage
    assert persisted["character"] == expected_char
    assert (persisted.get("gp") or 0) == 0    # 보스 클리어로 GP 절대 미발생
    assert persisted["coin_balance"] == E.BOSS_CLEAR_REWARD
    assert persisted["ranking_score"] == E.BOSS_CLEAR_REWARD


def test_endboss_clear_does_not_demote_evolution_stage(monkeypatch, tmp_path):
    """이미 3차인 유저가 하위(beginner) 재도전/클리어해도 stage 는 강등되지 않는다."""
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(
        id="u-nodemote",
        course_level="advanced",
        character="final_ghost",
        evolution_stage=3,
        endboss_cleared_levels=[],
        max_unlocked_unit={"beginner": 9, "advanced": 1},
    )
    token = _won_battle_token(user, "beginner")
    U.save_users([user])

    result = E.endboss_clear(
        E.ClearRequest(project="account", target_level="beginner", battle_token=token), user=user
    )

    assert result["evolution_stage"] == 3
    assert result["character"] == "final_ghost"
    assert result["evolution"]["evolved"] is False  # 이미 상위 → 진화 없음
    persisted = U.get_user_by_id("u-nodemote")
    assert persisted["evolution_stage"] == 3
    assert persisted["character"] == "final_ghost"


# ── XP 만 쌓아도 진화 안 됨 (자동진화 제거 검증) ─────────────────────────────

def test_xp_accumulation_never_evolves_or_levels():
    user = {"id": "u-xp", "xp": 0, "lv": 1, "character": "slime", "titles": []}
    # 2-B: xp 로는 진화도 레벨업도 없다. lv 동결(1), character slime, evolved None.
    events = U.apply_xp(user, 435000)  # 과거 lv30 상당 XP
    assert user["lv"] == 1
    assert user["character"] == "slime"
    assert events["evolved"] is None
    assert U.get_evolution_stage(user) == 0  # 진화 단계 0 유지


# ── 상점 구매: coin_balance 만 차감, 그 외 불변 ──────────────────────────────

def test_purchase_theme_success_only_deducts_coin(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(
        id="u-buy",
        coin_balance=1000,
        gp=0,
        ranking_score=555,
        evolution_stage=2,
        character="speech_bubble",
        crowns=7,
        xp=1234,
        purchased_themes=["dark"],
    )
    U.save_users([user])

    resp = UR.purchase_theme(UR.PurchaseThemeRequest(theme_id="ocean"), user=user)  # cost 500

    assert resp["success"] is True
    assert resp["coin_spent"] == 500
    assert resp["coin_remaining"] == 500
    assert "ocean" in resp["purchased_themes"]

    p = U.get_user_by_id("u-buy")
    assert p["coin_balance"] == 500              # 코인만 차감
    assert (p.get("gp") or 0) == 0               # gp 불변
    assert p["ranking_score"] == 555             # ranking_score 불변
    assert p["evolution_stage"] == 2             # evolution_stage 불변
    assert p["crowns"] == 7                       # crowns 불변
    assert p["xp"] == 1234                        # xp 불변(차감 안 함)


def test_purchase_theme_insufficient_coin_changes_nothing(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(
        id="u-poor",
        coin_balance=100,
        gp=0,
        ranking_score=555,
        evolution_stage=1,
        crowns=7,
        xp=1234,
        purchased_themes=["dark"],
    )
    U.save_users([user])

    with pytest.raises(HTTPException) as exc:
        UR.purchase_theme(UR.PurchaseThemeRequest(theme_id="ocean"), user=user)  # cost 500 > 100
    assert exc.value.status_code == 400
    assert "코인" in exc.value.detail

    p = U.get_user_by_id("u-poor")
    assert p["coin_balance"] == 100              # 값 전부 불변
    assert p["ranking_score"] == 555
    assert p["evolution_stage"] == 1
    assert p["crowns"] == 7
    assert p["xp"] == 1234
    assert p.get("purchased_themes", ["dark"]) == ["dark"]  # 미보유 상태 유지
