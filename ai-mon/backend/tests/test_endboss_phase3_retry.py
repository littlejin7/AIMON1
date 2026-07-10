import os
import sys
import asyncio

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.endboss as E
import routers.utils as U
from routers.battle_session import make_battle_token, create_endboss_session


def _phase3_unlocked_token(user, level, project="account"):
    """phase3 진입 게이트(boss_hp<=0)를 통과한 active 세션을 심고 battle_token 반환."""
    token, sid = make_battle_token(E.MODE, None, level, user["id"])
    create_endboss_session(user, sid, level, project, E.BOSS_HP_INIT, E.MY_HP_INIT, E.PHASE3_MAX_TRIES)
    sess = user["battle_sessions"][sid]
    sess["boss_hp"] = 0
    sess["phase3_unlocked"] = True
    return token


def _phase3_q(qid: str, answer: str):
    return {
        "question_id": qid,
        "project": "account",
        "phase": 3,
        "type": "fill_in_blank",
        "question": f"Question {qid}",
        "answer": answer,
        "feedback": {"wrong": "wrong feedback"},
        "hint": "hint",
        "explanation": "explanation",
    }


def test_endboss_phase3_retry_reopens_pool_when_seen_is_exhausted(tmp_path, monkeypatch):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)
    questions = [_phase3_q("p3_q1", "A"), _phase3_q("p3_q2", "B")]
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: questions)

    user = {
        "id": "user-1",
        "username": "endboss-user",
        "nickname": "EndBossUser",
        "email": "endboss@example.com",
        "course_level": "beginner",
        "seen_questions": {
            "endboss_beginner_account": ["p3_q1", "p3_q2"],
            "endboss": ["p3_q1", "p3_q2"],
        },
    }
    token = _phase3_unlocked_token(user, "beginner")
    U.save_users([user])

    req = E.AnswerRequest(
        question_id="p3_q1",
        user_answer="wrong",
        phase=3,
        battle_token=token,
        project="account",
    )

    result = asyncio.run(E.endboss_answer(None, req, user=user))

    assert result["is_correct"] is False
    assert result["next_phase3_question"]["question_id"] == "p3_q2"
    assert result["hint"] == "hint"
    assert result["correct_answer"] == "A"
