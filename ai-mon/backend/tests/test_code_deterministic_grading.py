import asyncio
import os
import sys
from unittest.mock import AsyncMock

from starlette.requests import Request

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import routers.code as CODE


def _base_user():
    return {"id": "u1", "course_level": "beginner", "lv": 3, "xp": 0, "crowns": 0}


def _request():
    return Request({"type": "http", "method": "POST", "path": "/code/submit", "headers": []})


def test_expected_output_match_skips_claude(monkeypatch):
    question = {
        "type": "code_input",
        "expected_output": "ok\n",
        "feedback": {"correct": "bundle hit"},
    }
    mock_ai = AsyncMock(return_value={"is_correct": False})

    monkeypatch.setattr(CODE, "find_question", lambda *args, **kwargs: question)
    monkeypatch.setattr(CODE, "ask_claude_json", mock_ai)

    req = CODE.SubmitRequest(
        question_id="q1",
        code="print('ok')",
        output="ok\r\n",
        error="",
        award=False,
    )
    result = asyncio.run(CODE.submit_code.__wrapped__(_request(), req, _base_user()))

    assert result["is_correct"] is True
    assert result["score"] == 100
    assert result["feedback"] == "bundle hit"
    assert result["xp_awarded"] == 0
    mock_ai.assert_not_awaited()


def test_expected_output_miss_falls_back_to_claude(monkeypatch):
    question = {
        "type": "code_input",
        "expected_output": "ok\n",
        "feedback": {"correct": "bundle hit"},
        "question": "Print ok",
        "answer": "print('ok')",
    }
    mock_ai = AsyncMock(return_value={
        "is_correct": False,
        "score": 25,
        "feedback": "wrong",
        "hint": "retry",
        "grading_failed": False,
    })

    monkeypatch.setattr(CODE, "find_question", lambda *args, **kwargs: question)
    monkeypatch.setattr(CODE, "ask_claude_json", mock_ai)

    req = CODE.SubmitRequest(
        question_id="q1",
        code="print('bad')",
        output="bad\n",
        error="",
        award=False,
    )
    result = asyncio.run(CODE.submit_code.__wrapped__(_request(), req, _base_user()))

    assert result["is_correct"] is False
    assert result["score"] == 25
    assert result["feedback"] == "wrong"
    mock_ai.assert_awaited_once()


def test_award_false_does_not_persist_even_on_deterministic_match(monkeypatch):
    question = {
        "type": "code_input",
        "expected_output": "ok\n",
        "feedback": {"correct": "bundle hit"},
    }

    monkeypatch.setattr(CODE, "find_question", lambda *args, **kwargs: question)
    monkeypatch.setattr(CODE, "ask_claude_json", AsyncMock())
    monkeypatch.setattr(CODE, "get_progress_by_user", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("progress should not load")))
    monkeypatch.setattr(CODE, "save_progress_item", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("progress should not save")))
    monkeypatch.setattr(CODE, "apply_xp", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("xp should not apply")))
    monkeypatch.setattr(CODE, "save_user", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("user should not save")))

    req = CODE.SubmitRequest(
        question_id="q1",
        code="print('ok')",
        output="ok\n",
        error="",
        award=False,
    )
    result = asyncio.run(CODE.submit_code.__wrapped__(_request(), req, _base_user()))

    assert result["is_correct"] is True
    assert result["xp_awarded"] == 0


def test_award_true_preserves_existing_reward_flow(monkeypatch):
    question = {
        "type": "code_input",
        "expected_output": "ok\n",
        "feedback": {"correct": "bundle hit"},
    }
    saved_progress = []
    saved_users = []

    def _apply_xp(user, xp_gain):
        user["xp"] = user.get("xp", 0) + xp_gain

    monkeypatch.setattr(CODE, "find_question", lambda *args, **kwargs: question)
    monkeypatch.setattr(CODE, "ask_claude_json", AsyncMock())
    monkeypatch.setattr(CODE, "get_progress_by_user", lambda *args, **kwargs: [])
    monkeypatch.setattr(CODE, "save_progress_item", lambda item: saved_progress.append(item.copy()))
    monkeypatch.setattr(CODE, "apply_xp", _apply_xp)
    monkeypatch.setattr(CODE, "save_user", lambda user: saved_users.append(user.copy()))

    user = _base_user()
    req = CODE.SubmitRequest(
        question_id="q1",
        code="print('ok')",
        output="ok\n",
        error="",
        unit=2,
        stage="2-1",
        course_level="beginner",
        award=True,
    )
    result = asyncio.run(CODE.submit_code.__wrapped__(_request(), req, user))

    assert result["is_correct"] is True
    assert result["xp_awarded"] == CODE.CODE_CLEAR_XP
    assert len(saved_progress) == 1
    assert saved_progress[0]["unit"] == 2
    assert saved_progress[0]["stage"] == "2-1"
    assert len(saved_users) == 1
    assert saved_users[0]["xp"] == CODE.CODE_CLEAR_XP
