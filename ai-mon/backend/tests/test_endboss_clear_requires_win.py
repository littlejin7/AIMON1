"""P0 회귀: 엔드보스 클리어 보상은 '서버 세션 승리(status=="won")' 없이 지급되지 않는다.

이전 버그: /boss/endboss/clear 가 실제 phase3 승리를 확인하지 않아, 엔드보스가 해금된
유저가 API 를 직접 호출하면 코인/랭킹 15,000·왕관 15·진화·칭호를 전투 없이 받을 수
있었다. 서버 권위 전투 세션(battle_session)으로 다음을 강제한다:
  - /start 가 세션 생성 → /answer 가 서버 채점으로 HP/페이즈 갱신 → phase3 정답만 won
  - /clear 는 won 세션일 때만 보상, 지급 후 세션 consume(리플레이 방어)
  - phase3 진입은 phase1~2 게이트(boss_hp<=0) 통과 후에만(우회 차단)
"""
import os
import sys
import asyncio

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import pytest
from fastapi import HTTPException

import routers.endboss as E
import routers.utils as U
from routers.battle_session import make_battle_token, create_endboss_session, get_endboss_session


def _make_user(**overrides):
    user = {
        "id": "u1",
        "username": "endboss-user",
        "nickname": "EndBossUser",
        "email": "endboss@example.com",
        "course_level": "beginner",
        "crowns": 20,
        "endboss_cleared_levels": [],
        "max_unlocked_unit": {"beginner": 9},
        "seen_questions": {},
    }
    user.update(overrides)
    return user


def _session(user, level="beginner", project="account", status="active", phase3_unlocked=False, boss_hp=None):
    token, sid = make_battle_token(E.MODE, None, level, user["id"])
    create_endboss_session(user, sid, level, project, E.BOSS_HP_INIT, E.MY_HP_INIT, E.PHASE3_MAX_TRIES)
    sess = user["battle_sessions"][sid]
    sess["status"] = status
    sess["phase3_unlocked"] = phase3_unlocked
    if boss_hp is not None:
        sess["boss_hp"] = boss_hp
    return token, sid


# ── 1) 세션/토큰 없이 /clear 직접 호출 → 403, 아무것도 지급 안 됨 (핵심 P0) ────
def test_clear_without_session_grants_nothing(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(id="u-nosess")
    U.save_users([user])

    with pytest.raises(HTTPException) as exc:
        E.endboss_clear(E.ClearRequest(project="account", target_level="beginner"), user=user)
    assert exc.value.status_code == 403

    p = U.get_user_by_id("u-nosess")
    assert (p.get("endboss_cleared_levels") or []) == []   # 미클리어
    assert (p.get("coin_balance") or 0) == 0                # 코인 미지급
    assert (p.get("ranking_score") or 0) == 0               # 랭킹 미지급
    assert (p.get("crowns") or 0) == 20                     # 왕관 보상 없음(원래값 유지)
    assert U.get_evolution_stage(p) == 0                    # 진화 없음


# ── 2) active(미승리) 세션으로 /clear → 403 ──────────────────────────────────
def test_clear_with_active_not_won_session_is_rejected(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(id="u-active")
    token, _ = _session(user, status="active")
    U.save_users([user])

    with pytest.raises(HTTPException) as exc:
        E.endboss_clear(
            E.ClearRequest(project="account", target_level="beginner", battle_token=token), user=user
        )
    assert exc.value.status_code == 403
    p = U.get_user_by_id("u-active")
    assert (p.get("endboss_cleared_levels") or []) == []


# ── 3) won 세션으로 /clear → 보상 지급 + 세션 consume(리플레이 차단) ──────────
def test_clear_with_won_session_grants_and_consumes(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = _make_user(id="u-won")
    token, sid = _session(user, status="won", phase3_unlocked=True, boss_hp=0)
    U.save_users([user])

    result = E.endboss_clear(
        E.ClearRequest(project="account", target_level="beginner", battle_token=token), user=user
    )
    assert result["already_cleared"] is False
    assert result["reward"]["coin_delta"] == E.BOSS_CLEAR_REWARD
    assert result["reward"]["ranking_score_delta"] == E.BOSS_CLEAR_REWARD

    p = U.get_user_by_id("u-won")
    assert "beginner" in p["endboss_cleared_levels"]
    assert p["coin_balance"] == E.BOSS_CLEAR_REWARD
    # 세션 소비 → 같은 won 세션 재사용 불가. 재클리어는 already_cleared 로만 멱등.
    assert get_endboss_session(p, sid) is None
    replay = E.endboss_clear(
        E.ClearRequest(project="account", target_level="beginner", battle_token=token), user=user
    )
    assert replay["already_cleared"] is True
    assert replay["reward"]["coin_delta"] == 0


# ── 4) 다른 레벨 won 세션을 상위 레벨 클리어에 재사용 불가 ────────────────────
def test_won_session_level_must_match_clear_target(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    # beginner 승리 세션을 들고 advanced 클리어를 시도.
    user = _make_user(
        id="u-mismatch",
        course_level="advanced",
        endboss_cleared_levels=["beginner", "intermediate"],
        max_unlocked_unit={"advanced": 9},
    )
    token, _ = _session(user, level="beginner", status="won", phase3_unlocked=True, boss_hp=0)
    U.save_users([user])

    with pytest.raises(HTTPException) as exc:
        E.endboss_clear(
            E.ClearRequest(project="account", target_level="advanced", battle_token=token), user=user
        )
    assert exc.value.status_code == 403
    p = U.get_user_by_id("u-mismatch")
    assert "advanced" not in (p.get("endboss_cleared_levels") or [])


# ── 5) phase1~2 게이트 미통과 상태에서 phase3 정답 제출 → 400, won 되지 않음 ──
def test_phase3_answer_before_gate_cannot_win(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)
    q = {
        "question_id": "p3", "project": "account", "phase": 3, "type": "fill_in_blank",
        "question": "Q", "answer": "A", "feedback": {}, "hint": "", "explanation": "",
    }
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: [q])

    user = _make_user(id="u-bypass")
    token, sid = _session(user, status="active", phase3_unlocked=False)  # boss_hp 미소진
    U.save_users([user])

    # 정답("A")을 보내도 게이트 미통과라 400 으로 차단되고 세션이 won 으로 넘어가지 않는다.
    with pytest.raises(HTTPException) as exc:
        asyncio.run(E.endboss_answer(
            None,
            E.AnswerRequest(question_id="p3", user_answer="A", phase=3,
                            battle_token=token, project="account"),
            user=user,
        ))
    assert exc.value.status_code == 400

    p = U.get_user_by_id("u-bypass")
    assert get_endboss_session(p, sid)["status"] == "active"  # 승리로 전환 안 됨


# ── 6) 게이트 통과(boss_hp<=0) 후 phase3 정답 → won ──────────────────────────
def test_phase3_answer_after_gate_wins(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)
    q = {
        "question_id": "p3", "project": "account", "phase": 3, "type": "fill_in_blank",
        "question": "Q", "answer": "A", "feedback": {}, "hint": "", "explanation": "",
    }
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: [q])

    user = _make_user(id="u-gatewin")
    token, sid = _session(user, status="active", phase3_unlocked=True, boss_hp=0)
    U.save_users([user])

    res = asyncio.run(E.endboss_answer(
        None,
        E.AnswerRequest(question_id="p3", user_answer="A", phase=3,
                        battle_token=token, project="account"),
        user=user,
    ))
    assert res["is_correct"] is True
    assert res["is_clear"] is True

    p = U.get_user_by_id("u-gatewin")
    assert get_endboss_session(p, sid)["status"] == "won"


# ── 7) 실제 풀 플로우: start → phase1~2 정답 누적 → phase3 정답 → clear 보상 ──
def _mc_q(phase, i, answer="A"):
    return {
        "question_id": f"p{phase}_q{i}", "project": "account", "phase": phase,
        "type": "multiple_choice", "question": f"Q{phase}-{i}", "answer": answer,
        "feedback": {"correct": "ok", "incorrect": "no"}, "hint": "h", "explanation": "e",
    }


def test_full_flow_start_answer_clear(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)

    questions = [_mc_q(1, i) for i in range(1, 6)] + [_mc_q(2, i) for i in range(1, 5)] + [_mc_q(3, 1)]
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: questions)

    user = _make_user(id="u-flow")
    U.save_users([user])

    start = E.endboss_start(E.StartRequest(project="account"), user=user)
    token = start["battle_token"]
    assert token
    assert U.get_user_by_id("u-flow")["crowns"] == 20 - E.RETRY_CROWN_COST  # 입장 비용 차감

    # phase1~2 문제를 정답으로 누적 — boss_hp(1400)/delta(200)=7 정답이면 게이트 개방.
    p12 = start["phase1_questions"] + start["phase2_questions"]
    needed = E.BOSS_HP_INIT // E.BOSS_HP_DELTA  # 7
    phase3_ready = False
    for q in p12[:needed]:
        phase = 1 if q["question_id"].startswith("p1") else 2
        res = asyncio.run(E.endboss_answer(
            None,
            E.AnswerRequest(question_id=q["question_id"], user_answer="A", phase=phase,
                            battle_token=token, project="account"),
            user=user,
        ))
        assert res["is_correct"] is True
        phase3_ready = phase3_ready or res["phase3_ready"]
    assert phase3_ready is True  # 게이트 개방됨

    # phase3 정답 → 승리
    p3q = start["phase3_first_question"]
    res = asyncio.run(E.endboss_answer(
        None,
        E.AnswerRequest(question_id=p3q["question_id"], user_answer="A", phase=3,
                        battle_token=token, project="account"),
        user=user,
    ))
    assert res["is_clear"] is True

    # clear → 보상 지급
    result = E.endboss_clear(
        E.ClearRequest(project="account", battle_token=token), user=user
    )
    assert result["already_cleared"] is False
    assert result["reward"]["coin_delta"] == E.BOSS_CLEAR_REWARD

    p = U.get_user_by_id("u-flow")
    assert "beginner" in p["endboss_cleared_levels"]
