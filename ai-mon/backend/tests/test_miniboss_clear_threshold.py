"""미니보스 통과 기준 = 5문항 중 4정답(2오답=패배) 스펙 회귀 테스트.

근본수정 스펙:
- 미니보스 통과 = 스테이지 완료 = 4정답(REQUIRED_CORRECT=4).
- 2오답이면 남은 문제로 4정답 불가 → 패배(MAX_WRONG=2).
- 완료(is_completed) 판정은 오직 '서버 세션 승리(status==won)' → miniboss_clear 에서만.
- HP 표시 상수는 위 기준과 일관: 4정답=boss_hp0, 2오답=my_hp0.
"""
import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import pytest
from fastapi import HTTPException

import routers.miniboss as M
import routers.quiz as Q


def _user():
    return {
        "id": "u1",
        "course_level": "beginner",
        "seen_questions": {},
        "battle_sessions": {},
    }


def _install_mutator(monkeypatch, user):
    def fake_mutate_user_atomic(user_id, mutator):
        assert user_id == user["id"]
        return user, mutator(user)

    monkeypatch.setattr(M, "mutate_user_atomic", fake_mutate_user_atomic)


def _questions(stage="1-1"):
    # 5문항 전부 정답 "A" — user_answer="A"→정답, "Z"→오답.
    return [
        {"question_id": f"q{i}", "stage": stage, "quiz_set": "A",
         "question": f"Q{i}", "answer": "A",
         "feedback": {"correct": "o", "wrong": "x"}, "hint": "h"}
        for i in range(1, 6)
    ]


def _battle(monkeypatch, correct_flags, stage="1-1"):
    """미니보스 배틀을 start→answer* 로 재생하고 answer 응답 리스트를 반환."""
    user = _user()
    _install_mutator(monkeypatch, user)
    monkeypatch.setattr(M, "load_miniboss_questions", lambda *a, **k: _questions(stage))
    monkeypatch.setattr(M, "save_attempt_item", lambda *a, **k: None)

    start = M.miniboss_start(unit=1, stage=stage, attempt=1, user=user)
    assert start["required"] == 4  # 5문항 → 4정답 필요

    token = start["battle_token"]
    out = []
    for i, correct in enumerate(correct_flags):
        qid = start["questions"][i]["question_id"]
        req = M.AnswerRequest(
            question_id=qid,
            user_answer="A" if correct else "Z",
            battle_token=token, unit=1, stage=stage,
        )
        out.append(M.miniboss_answer(req, user=user))
    return user, start, out


# ── 상수/HP 일관성 ────────────────────────────────────────────────────────────

def test_threshold_constants():
    assert M.QUESTIONS_PER_BATTLE == 5
    assert M.REQUIRED_CORRECT == 4
    assert M.MAX_WRONG == 2


def test_hp_display_consistent_with_thresholds():
    # 정답 4회면 boss_hp 0, 오답 2회면 my_hp 0 이 되도록 delta 파생.
    assert M.BOSS_HP_DELTA * M.REQUIRED_CORRECT >= M.BOSS_HP_INIT
    assert M.MY_HP_DELTA * M.MAX_WRONG >= M.MY_HP_INIT


# ── 승/패 판정 ────────────────────────────────────────────────────────────────

def test_four_correct_wins(monkeypatch):
    _, _, res = _battle(monkeypatch, [True, True, True, True])
    assert res[-1]["is_clear"] is True
    assert res[-1]["is_fail"] is False
    assert res[-1]["correct"] == 4
    assert res[-1]["boss_hp"] == 0  # 4정답 → 보스 HP 0


def test_three_correct_is_not_win(monkeypatch):
    # 3정답만으로는 승리 아님(미완료) → 다음 스테이지 게이트 대상.
    _, _, res = _battle(monkeypatch, [True, True, True])
    assert res[-1]["is_clear"] is False
    assert res[-1]["is_fail"] is False
    assert res[-1]["correct"] == 3


def test_two_wrong_loses(monkeypatch):
    _, _, res = _battle(monkeypatch, [False, False])
    assert res[-1]["is_fail"] is True
    assert res[-1]["my_hp"] == 0  # 2오답 → 내 HP 0


def test_one_wrong_tolerated_then_four_correct_wins(monkeypatch):
    # 1오답은 허용(패배엔 2오답 필요) → 이후 4정답이면 승리.
    _, _, res = _battle(monkeypatch, [False, True, True, True, True])
    assert res[-1]["is_clear"] is True
    assert res[-1]["correct"] == 4


# ── 완료 저장 단일화 (miniboss_clear 만이 is_completed 결정) ───────────────────

def _prep_clear(monkeypatch):
    monkeypatch.setattr(M, "assert_stage_access", lambda *a, **k: None)
    monkeypatch.setattr(M, "get_progress_by_user", lambda *a, **k: [])
    monkeypatch.setattr(M, "grant_reward", lambda u, **k: {
        "coin_delta": k.get("coin_delta", 0), "gp_delta": 0, "ranking_score_delta": 0})
    monkeypatch.setattr(M, "get_evolution_stage", lambda u: 0)
    monkeypatch.setattr(M, "current_week_ranking_score", lambda u: 0)


def test_four_correct_clear_persists_completion(monkeypatch):
    # (검증 1) 4정답 승리 유저 → clear 시 progress is_completed=True 저장.
    _prep_clear(monkeypatch)
    saved = []
    monkeypatch.setattr(M, "save_progress_item", lambda item: saved.append(item))

    user, start, _ = _battle(monkeypatch, [True, True, True, True], stage="1-2")
    token = start["battle_token"]

    out = M.miniboss_clear(M.ClearRequest(unit=1, stage="1-2", battle_token=token), user=user)

    assert out["already_cleared"] is False
    assert "1-2" in out["cleared_stages"]
    assert len(saved) == 1
    assert saved[0]["is_completed"] is True
    assert saved[0]["stage"] == "1-2"
    assert saved[0]["course_level"] == "beginner"


def test_three_correct_clear_is_blocked(monkeypatch):
    # (검증 2) 3정답(승리 미달) 유저 → clear 403, 완료 저장 없음.
    _prep_clear(monkeypatch)
    saved = []
    monkeypatch.setattr(M, "save_progress_item", lambda item: saved.append(item))

    user, start, _ = _battle(monkeypatch, [True, True, True], stage="1-2")
    token = start["battle_token"]

    with pytest.raises(HTTPException) as ei:
        M.miniboss_clear(M.ClearRequest(unit=1, stage="1-2", battle_token=token), user=user)

    assert ei.value.status_code == 403
    assert saved == []  # 미완료 → 진행도 완료행 저장 없음


# ── 시너지: 미니보스 클리어(신규 4정답 기준) + 게이트 자가치유(quiz.py) ────────
#
# 두 근본수정이 함께 배포됐을 때의 실제 실패 시나리오를 엔드투엔드로 재현한다:
#   1) 유저가 4정답으로 미니보스(신규 기준)를 승리 → miniboss_clear 가
#      miniboss_cleared_stages(원자, users)엔 기록하지만,
#   2) progress 완료행 저장은 실패(save_progress_item 이 아무 것도 영속화하지
#      못했다고 가정 — de0040ab 처럼 별도 스토리지 유실).
#   3) 이 상태로 바로 다음 스테이지에 assert_stage_access(quiz.py) 를 물으면,
#      게이트 자가치유(_completed_stage_ids 가 miniboss_cleared_stages 도
#      완료 신호로 합산)가 progress 유실을 극복하고 통과시켜야 한다.
def test_miniboss_win_then_progress_loss_still_passes_next_stage_gate(monkeypatch):
    _prep_clear(monkeypatch)
    # progress 저장을 완전히 무력화 — miniboss_clear 가 시도해도 아무 데도 안 쌓인다.
    monkeypatch.setattr(M, "save_progress_item", lambda item: None)

    user, start, _ = _battle(monkeypatch, [True, True, True, True], stage="1-2")
    token = start["battle_token"]

    out = M.miniboss_clear(M.ClearRequest(unit=1, stage="1-2", battle_token=token), user=user)
    assert out["already_cleared"] is False
    assert "1-2" in user["miniboss_cleared_stages"]  # 원자 기록은 성공(users)

    # progress 는 완전 유실 상태(빈 목록)로 재현 — assert_stage_access 가 이걸 볼 때
    # miniboss_cleared_stages 로 폴백해야 한다.
    monkeypatch.setattr(Q, "get_progress_by_user", lambda uid, lvl: [])
    user["is_level_tested"] = True
    user["max_unlocked_unit"] = {"beginner": 1}

    Q.assert_stage_access(user, 1, "1-3", "beginner")  # 예외 없이 통과해야 함
