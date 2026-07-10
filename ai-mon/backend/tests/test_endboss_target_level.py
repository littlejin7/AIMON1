import os
import sys
import json
import asyncio
import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

from fastapi import HTTPException

import routers.endboss as E
import routers.utils as U
from routers.battle_session import make_battle_token, create_endboss_session


def _won_battle_token(user, level, project="account"):
    """엔드보스 won 세션을 user(파일 저장 전)에 심고 대응 battle_token 을 반환."""
    token, sid = make_battle_token(E.MODE, None, level, user["id"])
    create_endboss_session(user, sid, level, project, E.BOSS_HP_INIT, E.MY_HP_INIT, E.PHASE3_MAX_TRIES)
    user["battle_sessions"][sid]["status"] = "won"
    return token


def _make_user(**overrides):
    user = {
        "id": "u1",
        "username": "endboss-user",
        "nickname": "EndBossUser",
        "email": "endboss@example.com",
        "course_level": "beginner",
        "crowns": 10,
        "endboss_cleared_levels": [],
        "max_unlocked_unit": {"beginner": 9, "intermediate": 9, "advanced": 9},
        "seen_questions": {},
    }
    user.update(overrides)
    return user


# ── A) 하위호환: target_level=None → course_level 그대로, 게이트 없음 ──────────

def test_resolve_level_none_returns_course_level_without_gate():
    # endboss_cleared_levels=[] 라 derive 상으로는 advanced 가 언락 아니지만,
    # target_level 미지정이면 게이트 없이 course_level 을 그대로 반환해야 한다.
    user = {"course_level": "advanced", "endboss_cleared_levels": []}
    assert E.resolve_level(user, None) == "advanced"


def test_endboss_info_without_target_level_is_200_for_ungated_course_level(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    # 레벨테스트로 course_level 만 앞선(엔드보스/유닛보스 이력 없는) 유저.
    user = _make_user(course_level="advanced", endboss_cleared_levels=[], max_unlocked_unit={})

    res = E.endboss_info(target_level=None, user=user)  # 예외 없이 200 상당 응답이어야 함

    assert res["course_level"] == "advanced"
    assert res["unlocked_levels"] == ["beginner"]
    assert res["is_unlocked"] is False  # 실제 유닛8 미돌파 → is_unlocked 는 False 이지만 403 은 아님


# ── B) 게이트: target_level 명시 시에만 적용 ────────────────────────────────

def test_beginner_user_cannot_target_intermediate():
    user = _make_user(course_level="beginner", endboss_cleared_levels=[])
    with pytest.raises(HTTPException) as exc:
        E.endboss_info(target_level="intermediate", user=user)
    assert exc.value.status_code == 403


def test_invalid_target_level_value_rejected():
    user = _make_user()
    with pytest.raises(HTTPException) as exc:
        E.endboss_info(target_level="pro", user=user)
    assert exc.value.status_code == 400


def test_cleared_beginner_user_can_target_intermediate():
    user = _make_user(course_level="beginner", endboss_cleared_levels=["beginner"])
    res = E.endboss_info(target_level="intermediate", user=user)
    assert res["course_level"] == "intermediate"


# ── C) 누출 차단(이슈3): target_level 기준으로만 로드/채점/seen/기록 ──────────

def test_target_level_intermediate_leaks_no_beginner_data(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)

    # 계정 기본 course_level 은 beginner 지만, intermediate 를 명시 도전.
    user = _make_user(
        id="u-leak",
        course_level="beginner",
        endboss_cleared_levels=["beginner"],
        max_unlocked_unit={"beginner": 9, "intermediate": 9},
        crowns=10,
    )
    U.save_users([user])

    start_res = E.endboss_start(
        E.StartRequest(project="todo", target_level="intermediate"), user=user
    )

    all_ids = (
        [q["question_id"] for q in start_res["phase1_questions"]]
        + [q["question_id"] for q in start_res["phase2_questions"]]
        + ([start_res["phase3_first_question"]["question_id"]] if start_res["phase3_first_question"] else [])
    )
    assert all(qid.startswith("endboss_mid_") for qid in all_ids)
    assert sum(qid.startswith("endboss_beg_") for qid in all_ids) == 0

    # endboss_start 는 mutate_user_atomic 로 파일만 갱신(in-memory user 불변) → 재조회.
    user = U.get_user_by_id("u-leak")

    # seen 키가 intermediate 로 기록되고 beginner 키는 전혀 생기지 않아야 함.
    seen = user["seen_questions"]
    assert "endboss_p1_intermediate_todo" in seen
    assert "endboss_p2_intermediate_todo" in seen
    assert "endboss_intermediate_todo" in seen
    assert not any("beginner" in k for k in seen)

    answer_res = asyncio.run(E.endboss_answer(
        None,
        E.AnswerRequest(
            question_id="endboss_mid_todo_p1_001",
            user_answer="B",
            phase=1,
            battle_token=start_res["battle_token"],
            project="todo",
            target_level="intermediate",
        ),
        user=user,
    ))
    assert answer_res["is_correct"] is True  # 정답("B")으로 채점 경로까지 확인

    attempts = json.loads((tmp_path / "attempts.json").read_text(encoding="utf-8"))
    assert attempts[-1]["level"] == "intermediate"  # save_attempt_item 의 level 이 target 기준


# ── D) 승급: target clear 시 요청 level append + 한 단계만 승급 ──────────────

def test_target_level_clear_appends_requested_level_and_promotes_one_step(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(id="u-promote", course_level="beginner", endboss_cleared_levels=[])
    token = _won_battle_token(user, "beginner")
    U.save_users([user])

    result = E.endboss_clear(
        E.ClearRequest(project="account", target_level="beginner", battle_token=token), user=user
    )

    assert result["already_cleared"] is False
    assert result["cleared_levels"] == ["beginner"]

    persisted = U.get_user_by_id("u-promote")
    assert persisted["endboss_cleared_levels"] == ["beginner"]
    assert persisted["course_level"] == "intermediate"  # beginner→intermediate 한 단계만


# ── E) ★역행 방지(#4c): 상위 course_level 유저의 하위 클리어가 강등시키지 않음 ─

def test_advanced_course_level_user_clearing_beginner_does_not_demote(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    # 레벨테스트로 advanced 까지 앞섰지만 실제 엔드보스/유닛보스 이력은 없고,
    # beginner 유닛8 만 돌파해 target_level="beginner" 로 도전/클리어 가능한 유저.
    user = _make_user(
        id="u-no-demote",
        course_level="advanced",
        endboss_cleared_levels=[],
        max_unlocked_unit={"beginner": 9, "advanced": 1},
    )
    token = _won_battle_token(user, "beginner")
    U.save_users([user])

    result = E.endboss_clear(
        E.ClearRequest(project="account", target_level="beginner", battle_token=token), user=user
    )

    assert result["cleared_levels"] == ["beginner"]

    persisted = U.get_user_by_id("u-no-demote")
    assert persisted["endboss_cleared_levels"] == ["beginner"]
    assert persisted["course_level"] == "advanced"  # 강등되지 않고 그대로 유지


# ── F) 순서 결합: target_level 게이트가 왕관 부족 게이트보다 먼저 평가됨 ──────

def test_target_gate_fires_before_crown_check_even_when_crowns_insufficient():
    user = _make_user(course_level="beginner", endboss_cleared_levels=[], crowns=0)
    with pytest.raises(HTTPException) as exc:
        E.endboss_start(
            E.StartRequest(project="account", target_level="advanced"), user=user
        )
    # 언락 게이트(resolve_level) 메시지여야 함 — 왕관 부족 메시지로 가려지면 안 됨.
    assert exc.value.status_code == 403
    assert exc.value.detail == "해금되지 않은 레벨입니다."


def test_crown_gate_fires_after_level_gate_passes(monkeypatch, tmp_path):
    # 왕관 가드는 이제 임계구역(mutate_user_atomic) 안에서 fresh user 로 평가된다
    # (TOCTOU 방어, CLAUDE.md §3) → 유저가 스토어에 존재해야 하므로 저장 후 호출한다.
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(course_level="beginner", endboss_cleared_levels=[], crowns=0)
    U.save_users([user])
    with pytest.raises(HTTPException) as exc:
        E.endboss_start(
            E.StartRequest(project="account", target_level="beginner"), user=user
        )
    assert exc.value.status_code == 400
    assert "왕관이 부족합니다" in exc.value.detail


# ── 사다리 Phase 1: selectable / status / 직행 인정 ─────────────────────────────

# G) endboss_selectable_levels — 배치별
def test_selectable_beginner_fresh_only_beginner():
    user = _make_user(course_level="beginner", endboss_cleared_levels=[])
    assert E.endboss_selectable_levels(user) == ["beginner"]


def test_selectable_intermediate_placed_includes_beginner_and_intermediate():
    user = _make_user(course_level="intermediate", endboss_cleared_levels=[])
    assert E.endboss_selectable_levels(user) == ["beginner", "intermediate"]


def test_selectable_advanced_placed_includes_all_three():
    user = _make_user(course_level="advanced", endboss_cleared_levels=[])
    assert E.endboss_selectable_levels(user) == ["beginner", "intermediate", "advanced"]


# H) is_endboss_unlocked — 티어 위치별
def test_is_unlocked_lower_tier_bypasses_unit_gate():
    # 배치가 advanced 인데 beginner 유닛은 하나도 안 깬(=1) 상태여도 직행 True.
    user = _make_user(course_level="advanced", max_unlocked_unit={"beginner": 1})
    assert E.is_endboss_unlocked(user, "beginner") is True


def test_is_unlocked_current_tier_requires_unit8():
    ready = _make_user(course_level="intermediate", max_unlocked_unit={"intermediate": 9})
    not_ready = _make_user(course_level="intermediate", max_unlocked_unit={"intermediate": 5})
    assert E.is_endboss_unlocked(ready, "intermediate") is True
    assert E.is_endboss_unlocked(not_ready, "intermediate") is False


def test_is_unlocked_higher_tier_is_locked():
    user = _make_user(course_level="beginner", max_unlocked_unit={"advanced": 1})
    assert E.is_endboss_unlocked(user, "advanced") is False


# I) resolve_level — selectable 게이트 반영
def test_resolve_advanced_placed_can_target_intermediate():
    user = _make_user(course_level="advanced", endboss_cleared_levels=[])
    assert E.resolve_level(user, "intermediate") == "intermediate"


def test_resolve_beginner_placed_rejects_intermediate_target():
    user = _make_user(course_level="beginner", endboss_cleared_levels=[])
    with pytest.raises(HTTPException) as exc:
        E.resolve_level(user, "intermediate")
    assert exc.value.status_code == 403


def test_resolve_none_returns_course_level_no_gate_backcompat():
    # 하위호환: None 이면 selectable 게이트를 타지 않고 course_level 그대로.
    user = _make_user(course_level="advanced", endboss_cleared_levels=[])
    assert E.resolve_level(user, None) == "advanced"


# J) endboss_info["levels"] — 4상태 + cleared 최우선
def test_info_levels_four_states_for_intermediate_placed():
    user = _make_user(
        course_level="intermediate",
        endboss_cleared_levels=[],
        max_unlocked_unit={"beginner": 9, "intermediate": 5, "advanced": 1},
    )
    levels = {d["level"]: d for d in E.endboss_info(target_level=None, user=user)["levels"]}
    assert levels["beginner"] == {"level": "beginner", "status": "recognized", "enterable": True}
    # intermediate = 현재 목표, 유닛8 미달(5) → enterable False
    assert levels["intermediate"] == {"level": "intermediate", "status": "current", "enterable": False}
    assert levels["advanced"] == {"level": "advanced", "status": "locked", "enterable": False}


def test_info_levels_current_becomes_enterable_after_unit8():
    user = _make_user(
        course_level="intermediate",
        endboss_cleared_levels=[],
        max_unlocked_unit={"intermediate": 9},
    )
    levels = {d["level"]: d for d in E.endboss_info(target_level=None, user=user)["levels"]}
    assert levels["intermediate"]["status"] == "current"
    assert levels["intermediate"]["enterable"] is True


def test_info_levels_cleared_takes_priority():
    # 이미 깬 레벨은 인덱스 비교보다 우선해 항상 cleared.
    user = _make_user(course_level="intermediate", endboss_cleared_levels=["beginner"])
    levels = {d["level"]: d for d in E.endboss_info(target_level=None, user=user)["levels"]}
    assert levels["beginner"] == {"level": "beginner", "status": "cleared", "enterable": True}


def test_cleared_level_can_be_replayed_without_reward(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(
        id="u-replay",
        course_level="advanced",
        endboss_cleared_levels=["beginner"],
        max_unlocked_unit={"beginner": 1, "advanced": 1},
    )
    U.save_users([user])

    assert E.is_endboss_unlocked(user, "beginner") is True

    result = E.endboss_clear(
        E.ClearRequest(project="account", target_level="beginner"), user=user
    )

    assert result["already_cleared"] is True
    assert result["xp_awarded"] == 0
    assert result["crowns_awarded"] == 0


# K) 엣지 — 레벨테스트 재응시로 course_level < 클리어 이력
def test_edge_course_level_below_clear_history_keeps_cleared_selectable():
    # course_level 은 beginner 로 낮아졌지만 실제로 beginner·intermediate 엔보를 깼음.
    user = _make_user(course_level="beginner", endboss_cleared_levels=["beginner", "intermediate"])
    # base(클리어 이력)로 advanced 까지 열려 'L in base' 절이 상위 레벨을 지켜준다.
    assert E.endboss_selectable_levels(user) == ["beginner", "intermediate", "advanced"]
    status = {d["level"]: d["status"] for d in E.endboss_info(target_level=None, user=user)["levels"]}
    # 깬 레벨은 course_level 보다 위여도 cleared 최우선.
    assert status["beginner"] == "cleared"
    assert status["intermediate"] == "cleared"
    # 안 깬 advanced 는 course_level(beginner) 위 → locked.
    assert status["advanced"] == "locked"


# L) info 기존 필드 하위호환 — 신규 필드만 추가되고 기존 키/값 유지
def test_info_backward_compatible_fields_intact():
    user = _make_user(course_level="beginner", endboss_cleared_levels=[])
    resp = E.endboss_info(target_level=None, user=user)
    for key in ("is_unlocked", "crowns", "retry_cost", "cleared_levels",
                "already_cleared", "course_level", "unlocked_levels"):
        assert key in resp
    # None 경로 → course_level 그대로, unlocked_levels 는 derive(클리어 이력) 그대로.
    assert resp["course_level"] == "beginner"
    assert resp["unlocked_levels"] == U.derive_unlocked_course_levels(user)
