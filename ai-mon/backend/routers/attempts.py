"""
Attempts (풀이 전수 기록) 라우터

클라이언트에서 채점되는 모드(quiz / train)의 풀이 결과를 정오답 무관·AI 피드백과
독립적으로 매번 1건 기록한다. 서버에서 채점되는 보스 계열(unitboss/miniboss/endboss)은
각 /answer 핸들러가 직접 save_attempt_item 을 호출하므로 이 엔드포인트를 쓰지 않는다.

★ is_correct 신뢰 정책 (게이팅·오답복습이 이 테이블에 의존하므로 중요):
  - 객관식/단답(multiple_choice·output_select·error_find·fill_in_blank): 클라가 보낸
    is_correct 를 신뢰하지 않고, user_answer 를 정답과 직접 대조해 **서버가 재채점**한다.
    (G 어뷰징 방어 — is_correct=true 위조로 오답복습을 비우거나 정답률을 위조 불가)
  - code_input: 이 엔드포인트의 객관식/단답 채점으로는 판정 불가. 코드 채점의 단일 진실은
    서버 /code/submit 이며, QuizCard 가 그 결과(is_correct)를 그대로 전달한다.
    따라서 클라 record_attempt 는 '객관식/단답 한정'으로 서버 재채점하고, 코드 유형은
    서버 채점 결과를 전달받는 구조다.

엔드포인트:
  POST /attempts   풀이 1건 기록 (question_id 정규화 + 객관식/단답 서버 재채점)
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel

from routers.utils import (
    limiter,
    now_kst,
    get_current_user_optional,
    save_attempt_item,
)
from routers.quiz import load_questions_by_category
from routers.battle_session import grade_objective

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

ALLOWED_MODES = {"quiz", "train", "random", "boss_rush", "miniboss", "unitboss", "endboss"}

# 서버가 직접 재채점 가능한(결정적) 유형. 이 유형들은 클라 is_correct 를 신뢰하지 않는다.
OBJECTIVE_TYPES = {"multiple_choice", "output_select", "error_find", "fill_in_blank"}

# mode → question_id 검증/정규화에 사용할 문제 풀 카테고리(우선순위 순)
_MODE_POOL = {
    "quiz":      ["quiz", "miniboss"],
    "train":     ["quiz", "miniboss"],
    "random":    ["quiz", "miniboss"],
    "boss_rush": ["miniboss"],
    "miniboss":  ["miniboss"],
    "unitboss":  ["unitboss"],
    "endboss":   ["endboss"],
}


class AttemptRequest(BaseModel):
    question_id: str
    unit: Optional[int] = None
    stage: Optional[str] = None
    level: Optional[str] = None
    mode: str
    is_correct: bool
    user_answer: Optional[str] = None   # 객관식/단답 서버 재채점용 (없으면 클라 is_correct 유지)


def _lookup_question(mode: str, level: Optional[str], unit: Optional[int], raw_qid: str) -> Optional[dict]:
    """mode 풀에서 question_id 로 문제 객체를 찾는다(정규화·재채점 공용). 못 찾으면 None."""
    for category in _MODE_POOL.get(mode, []):
        try:
            pool = load_questions_by_category(category, course_level=level, unit=unit)
        except Exception:
            continue
        for q in pool:
            if q.get("question_id") == raw_qid or q.get("id") == raw_qid:
                return q
    return None


@router.post("")
@limiter.limit("120/minute;5000/day")
def record_attempt(request: Request, req: AttemptRequest, user: Optional[dict] = Depends(get_current_user_optional)):
    # 익명 허용: 비로그인 1-1 공개 체험도 서버 채점이 필요(정답이 클라에 없음, F).
    # user 가 없으면 채점만 하고 전수 기록(save_attempt_item)은 건너뛴다.
    mode = req.mode if req.mode in ALLOWED_MODES else "quiz"

    question = _lookup_question(mode, req.level, req.unit, req.question_id)
    if question is not None:
        question_id = question.get("question_id")
    else:
        # 전수 기록 원칙상 원본 값을 저장(시도 유실 방지)하되 형식 불일치를 경고.
        logger.warning(
            "attempt question_id 불일치: mode=%s level=%s unit=%s qid=%r",
            mode, req.level, req.unit, req.question_id,
        )
        question_id = req.question_id

    # ── is_correct 서버 재채점 (객관식/단답 한정) ──
    # 클라가 보낸 is_correct 는 게이팅/오답복습 근거로 신뢰하지 않는다. 서버가 정답과
    # 직접 대조해 결정한다. user_answer 가 없거나(레거시) 비객관식 유형이면 클라값 유지
    # (code_input 은 /code/submit 서버 채점 결과가 전달됨 — 모듈 docstring 참고).
    is_correct = req.is_correct
    if question is not None and req.user_answer is not None:
        q_type = question.get("type") or question.get("quiz_type")
        if q_type in OBJECTIVE_TYPES:
            server_graded = grade_objective(req.user_answer, question.get("answer", ""))
            if server_graded != req.is_correct:
                logger.info(
                    "attempt is_correct 재채점 보정: qid=%s client=%s server=%s",
                    question_id, req.is_correct, server_graded,
                )
            is_correct = server_graded

    if user is not None:
        save_attempt_item({
            "id":          str(uuid.uuid4()),
            "user_id":     user["id"],
            "question_id": question_id,
            "unit":        req.unit,
            "stage":       req.stage,
            "level":       req.level,
            "mode":        mode,
            "is_correct":  is_correct,
            "answered_at": now_kst().isoformat(),
        })

    # ── 채점 결과 응답(F: 클라가 정답을 모르므로 서버가 채점·해설을 돌려준다) ──
    # is_correct 는 객관식/단답이면 서버 재채점값. feedback/hint/correct_answer 는
    # 제출 '후' 응답에만 담기므로(게이트는 이미 서버가 기록) 우회에 쓸 수 없다.
    resp = {"success": True, "is_correct": is_correct}
    if question is not None:
        fb = question.get("feedback")
        if isinstance(fb, dict):
            resp["feedback"] = (fb.get("correct") if is_correct
                                else fb.get("wrong") or fb.get("incorrect")) or ""
        else:
            resp["feedback"] = str(fb) if fb else ""
        resp["hint"] = "" if is_correct else (question.get("hint") or "")
        resp["correct_answer"] = question.get("answer", "")
        resp["explanation"] = question.get("explanation", "") or ""
    return resp
