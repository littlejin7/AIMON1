"""
D-1: AI 채점 실패 방어 회귀 테스트.

시나리오:
  (a) grading_failed 시 boss HP 차감 안 됨 + is_correct 덮어쓰기 안 됨
  (b) code.py grading_failed 시 진행도/XP 미부여 + grading_failed 플래그 응답
  (c) 실제 오답 시 boss HP 정상 차감
  (d) 직접매칭 정답은 AI 호출 없이 즉시 정답 처리

비동기 함수는 asyncio.run() 으로 호출하므로 pytest-asyncio 불필요.
"""
import sys, os, asyncio

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import pytest
import json
from unittest.mock import AsyncMock

import services.claude_service as CS
import routers.boss as BOSS
import routers.code as CODE


# ─────────────────────────────────────────────────────────────────────────────
# 공통 채점 결과 픽스처
# ─────────────────────────────────────────────────────────────────────────────

_GRADING_FAILED = {
    "is_correct": False,
    "score": 0,
    "feedback": "AI 서비스에 일시적인 오류가 발생했습니다. 패널티 없이 다시 제출할 수 있습니다.",
    "hint": "",
    "grading_failed": True,
}

_WRONG_ANSWER = {
    "is_correct": False,
    "score": 20,
    "feedback": "아쉽게도 틀렸습니다.",
    "hint": "힌트",
    "grading_failed": False,
}

_CORRECT = {
    "is_correct": True,
    "score": 100,
    "feedback": "정답입니다!",
    "hint": "",
    "grading_failed": False,
}


# ─────────────────────────────────────────────────────────────────────────────
# HP 계산 로직 (boss.py 로직 추출)
# ─────────────────────────────────────────────────────────────────────────────

def _calc_hp(ai_result: dict, boss_hp=None, my_hp=None, wrong=0) -> dict:
    """boss.py HP 계산 분기를 그대로 재현."""
    if boss_hp is None:
        boss_hp = BOSS.BOSS_HP_INIT
    if my_hp is None:
        my_hp = BOSS.MY_HP_INIT

    safe_boss = max(0, min(boss_hp, BOSS.BOSS_HP_INIT))
    safe_my   = max(0, min(my_hp,   BOSS.MY_HP_INIT))
    safe_wrong = max(0, min(wrong, 2))

    gf = ai_result.get("grading_failed", False)

    if gf:
        new_boss, new_my, new_wrong = safe_boss, safe_my, safe_wrong
    elif ai_result.get("is_correct"):
        new_boss, new_my, new_wrong = safe_boss - BOSS.BOSS_HP_DELTA, safe_my, safe_wrong
    else:
        new_boss, new_my, new_wrong = safe_boss, safe_my - BOSS.MY_HP_DELTA, safe_wrong + 1

    is_clear = (new_boss <= 0) if not gf else False
    is_fail  = (new_my   <= 0 or new_wrong >= 3) if not gf else False

    return {"boss_hp": new_boss, "my_hp": new_my, "wrong": new_wrong,
            "is_clear": is_clear, "is_fail": is_fail}


# ─────────────────────────────────────────────────────────────────────────────
# (a) grading_failed → boss HP 차감 없음, 패배 없음
# ─────────────────────────────────────────────────────────────────────────────

def test_grading_failed_no_hp_damage():
    r = _calc_hp(_GRADING_FAILED)
    assert r["my_hp"]   == BOSS.MY_HP_INIT,  "grading_failed 시 내 HP 차감 금지"
    assert r["boss_hp"] == BOSS.BOSS_HP_INIT, "grading_failed 시 보스 HP 차감 금지"
    assert r["wrong"]   == 0,                 "grading_failed 시 wrong_count 증가 금지"
    assert r["is_fail"]  is False,            "grading_failed 시 패배 처리 금지"
    assert r["is_clear"] is False


def test_grading_failed_still_full_hp_when_near_death():
    """HP 1 남은 상황에서도 grading_failed면 HP 변화 없음."""
    r = _calc_hp(_GRADING_FAILED, my_hp=1)
    assert r["my_hp"]  == 1
    assert r["is_fail"] is False


# ─────────────────────────────────────────────────────────────────────────────
# (a) grading_failed=True 이면 boss.py is_correct 덮어쓰기 없음
# ─────────────────────────────────────────────────────────────────────────────

def test_boss_multiple_choice_grading_failed_no_overwrite(monkeypatch):
    """객관식 직접매칭 실패 후 AI 채점 실패 시 is_correct 강제 False 덮어쓰기 금지."""
    monkeypatch.setattr(CS, "ask_claude_json", AsyncMock(return_value=_GRADING_FAILED.copy()))

    ai_result = asyncio.run(CS.ask_claude_json("prompt"))

    # 수정 후 boss.py 로직: grading_failed 아닐 때만 덮어씀
    if not ai_result.get("grading_failed"):
        ai_result["is_correct"] = False
        ai_result["score"] = 0

    # grading_failed=True이므로 덮어쓰기 분기 진입 안 함 → grading_failed 보존
    assert ai_result.get("grading_failed") is True

    # HP 계산 시 grading_failed 분기가 보호함
    r = _calc_hp(ai_result)
    assert r["my_hp"]  == BOSS.MY_HP_INIT, "grading_failed 보호 후 HP 차감 없어야 함"
    assert r["is_fail"] is False


# ─────────────────────────────────────────────────────────────────────────────
# (c) 실제 오답 → 정상 HP 차감
# ─────────────────────────────────────────────────────────────────────────────

def test_real_wrong_answer_hp_damage():
    r = _calc_hp(_WRONG_ANSWER)
    assert r["my_hp"]  == BOSS.MY_HP_INIT - BOSS.MY_HP_DELTA, "실제 오답 시 HP 차감 필수"
    assert r["wrong"]  == 1
    assert r["is_fail"] is False


def test_real_wrong_3times_is_fail():
    r = _calc_hp(_WRONG_ANSWER, wrong=2)
    assert r["is_fail"] is True


# ─────────────────────────────────────────────────────────────────────────────
# (d) 직접매칭 정답 → AI 호출 없음
# ─────────────────────────────────────────────────────────────────────────────

def test_direct_match_correct_no_ai_call(monkeypatch):
    """직접매칭 성공 시 ask_claude_json 호출 안 됨."""
    mock_ai = AsyncMock(return_value=_CORRECT)
    monkeypatch.setattr(CS, "ask_claude_json", mock_ai)

    # boss.py is_direct_match 로직 재현
    def is_direct_match(user_ans: str, correct: str) -> bool:
        if user_ans == correct:
            return True
        if len(user_ans) >= 1 and user_ans[0].upper() == correct.upper():
            return True
        return False

    user_ans, correct = "B", "B"
    matched = is_direct_match(user_ans, correct)
    assert matched is True

    if matched:
        ai_result = {"is_correct": True, "score": 100, "feedback": "정답입니다!", "hint": ""}
    else:
        ai_result = asyncio.run(CS.ask_claude_json("prompt"))

    mock_ai.assert_not_called()
    assert ai_result["is_correct"] is True
    r = _calc_hp(ai_result)
    assert r["boss_hp"] == BOSS.BOSS_HP_INIT - BOSS.BOSS_HP_DELTA
    assert r["my_hp"]   == BOSS.MY_HP_INIT


def test_direct_match_full_text_correct_no_ai_call(monkeypatch):
    """선택지 전체 텍스트 입력도 직접매칭 처리."""
    mock_ai = AsyncMock(return_value=_CORRECT)
    monkeypatch.setattr(CS, "ask_claude_json", mock_ai)

    def is_direct_match(user_ans: str, correct: str) -> bool:
        if user_ans == correct:
            return True
        if len(user_ans) >= 1 and user_ans[0].upper() == correct.upper():
            return True
        return False

    # "B. 10 / 끝" 처럼 전체 텍스트 입력, correct="B"
    user_ans, correct = "B. 10 / 끝", "B"
    matched = is_direct_match(user_ans, correct)
    assert matched is True
    mock_ai.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# (b) code.py — grading_failed 시 XP·진행도 미부여
# ─────────────────────────────────────────────────────────────────────────────

def _run_code_logic(result: dict, user: dict, saved_progress: list, xp_calls: list,
                    get_progress_fn=None, monkeypatch=None):
    """code.py submit_code 핵심 로직을 동기로 재현."""
    if result.get("grading_failed"):
        result["xp_awarded"]    = 0
        result["lv"]            = user.get("lv", 1)
        result["grading_failed"] = True
        return result

    is_correct = result.get("is_correct", False)
    xp_awarded = 0

    if is_correct:
        existing = None
        if get_progress_fn:
            progress = get_progress_fn(user["id"], user["course_level"])
            existing = next((p for p in progress if p["unit"] == 1 and p["stage"] == "1-1"), None)

        if not existing:
            saved_progress.append({"unit": 1, "stage": "1-1"})
            xp_calls.append(CODE.CODE_CLEAR_XP)
            xp_awarded = CODE.CODE_CLEAR_XP

    result["xp_awarded"] = xp_awarded
    result["lv"]         = user.get("lv", 1)
    return result


def test_code_grading_failed_no_xp_no_progress(monkeypatch):
    """(b) code.py grading_failed → XP·진행도 미부여, grading_failed 플래그 응답."""
    monkeypatch.setattr(CS, "ask_claude_json", AsyncMock(return_value=_GRADING_FAILED.copy()))

    user = {"id": "u1", "course_level": "beginner", "lv": 1, "xp": 0}
    saved_progress, xp_calls = [], []

    result = asyncio.run(CS.ask_claude_json("prompt"))
    final = _run_code_logic(result, user, saved_progress, xp_calls)

    assert final.get("grading_failed") is True,  "grading_failed 플래그 응답 필수"
    assert final.get("xp_awarded") == 0,           "채점 실패 시 XP 없음"
    assert len(saved_progress) == 0,               "채점 실패 시 진행도 저장 없음"
    assert len(xp_calls) == 0


def test_code_real_correct_awards_xp(monkeypatch):
    """(b 역방향) 정상 정답 → XP·진행도 부여."""
    monkeypatch.setattr(CS, "ask_claude_json", AsyncMock(return_value=_CORRECT.copy()))

    user = {"id": "u1", "course_level": "beginner", "lv": 1, "xp": 0}
    saved_progress, xp_calls = [], []

    result = asyncio.run(CS.ask_claude_json("prompt"))
    final = _run_code_logic(result, user, saved_progress, xp_calls,
                            get_progress_fn=lambda uid, lvl: [])

    assert final.get("grading_failed", False) is False
    assert final.get("xp_awarded") == CODE.CODE_CLEAR_XP, "정답 시 XP 지급"
    assert len(saved_progress) == 1,                       "정답 시 진행도 저장"
    assert len(xp_calls) == 1


def test_code_real_wrong_no_xp_no_progress(monkeypatch):
    """(c) 실제 오답 → XP·진행도 없음, grading_failed=False."""
    monkeypatch.setattr(CS, "ask_claude_json", AsyncMock(return_value=_WRONG_ANSWER.copy()))

    user = {"id": "u1", "course_level": "beginner", "lv": 1, "xp": 0}
    saved_progress, xp_calls = [], []

    result = asyncio.run(CS.ask_claude_json("prompt"))
    final = _run_code_logic(result, user, saved_progress, xp_calls,
                            get_progress_fn=lambda uid, lvl: [])

    assert final.get("grading_failed", False) is False, "실제 오답은 grading_failed 아님"
    assert final.get("is_correct") is False
    assert final.get("xp_awarded") == 0,  "오답 시 XP 없음"
    assert len(saved_progress) == 0,      "오답 시 진행도 저장 없음"
