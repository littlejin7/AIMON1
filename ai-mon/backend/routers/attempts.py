"""
Attempts (풀이 전수 기록) 라우터

클라이언트에서 채점되는 모드(quiz / train)의 풀이 결과를 정오답 무관·AI 피드백과
독립적으로 매번 1건 기록한다. 서버에서 채점되는 보스 계열(unitboss/miniboss/endboss)은
각 /answer 핸들러가 직접 save_attempt_item 을 호출하므로 이 엔드포인트를 쓰지 않는다.

엔드포인트:
  POST /attempts   풀이 1건 기록 (question_id 형식 정규화 + 불일치 시 경고 로그)
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel

from routers.utils import (
    limiter,
    now_kst,
    get_current_user,
    save_attempt_item,
)
from routers.quiz import load_questions_by_category

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

ALLOWED_MODES = {"quiz", "train", "random", "boss_rush", "miniboss", "unitboss", "endboss"}

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


def _normalize_question_id(mode: str, level: Optional[str], unit: Optional[int], raw_qid: str) -> str:
    """클라이언트 question_id 를 JSON 정규 형식(question_id 필드)으로 통일.

    풀에서 찾지 못하면 형식 불일치로 보고 경고 로그를 남기되, 전수 기록 원칙상
    원본 값을 그대로 저장한다(시도 자체는 유실하지 않는다).
    """
    for category in _MODE_POOL.get(mode, []):
        try:
            pool = load_questions_by_category(category, course_level=level, unit=unit)
        except Exception:
            continue
        for q in pool:
            if q.get("question_id") == raw_qid or q.get("id") == raw_qid:
                return q.get("question_id")
    logger.warning(
        "attempt question_id 불일치: mode=%s level=%s unit=%s qid=%r", mode, level, unit, raw_qid
    )
    return raw_qid


@router.post("")
@limiter.limit("120/minute;5000/day")
def record_attempt(request: Request, req: AttemptRequest, user: dict = Depends(get_current_user)):
    mode = req.mode if req.mode in ALLOWED_MODES else "quiz"
    question_id = _normalize_question_id(mode, req.level, req.unit, req.question_id)

    save_attempt_item({
        "id":          str(uuid.uuid4()),
        "user_id":     user["id"],
        "question_id": question_id,
        "unit":        req.unit,
        "stage":       req.stage,
        "level":       req.level,
        "mode":        mode,
        "is_correct":  req.is_correct,
        "answered_at": now_kst().isoformat(),
    })
    return {"success": True}
