import os, random
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from routers.quiz import load_questions_by_category
import logging
from routers.utils import (
    get_wrong_answers_by_user,
    save_wrong_answer_item,
    get_current_user,
    get_current_user_optional,
    mutate_user_atomic,
)

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


@router.get("/review")
def get_train_review(
    unit: int = 1,
    course_level: str = "beginner",
    limit: int = 15,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    user_id = user["id"] if user else None

    questions = load_questions_by_category("train", course_level=course_level, unit=unit)
    if not questions:
        questions = load_questions_by_category("quiz", course_level=course_level, unit=unit) + \
                    load_questions_by_category("miniboss", course_level=course_level, unit=unit)
    
    wrong_answers = get_wrong_answers_by_user(user_id) if user_id else []

    # 해당 유닛 스테이지 퀴즈 + 미니보스 문제 풀
    unit_pool = questions

    # 오답 문제 우선 선별
    priority_ids = set()
    if user_id:
        for entry in wrong_answers:
            if not entry.get("reviewed", False):
                priority_ids.add(entry.get("question_id"))

    priority_qs = [q for q in unit_pool if q.get("question_id") in priority_ids]
    normal_qs = [q for q in unit_pool if q.get("question_id") not in priority_ids]

    # 오답 우선 + 나머지 랜덤으로 15개 채우기
    random.shuffle(normal_qs)
    result = priority_qs + normal_qs
    return result[:limit]


class ReviewedRequest(BaseModel):
    question_id: str


@router.post("/reviewed")
def mark_question_reviewed(req: ReviewedRequest, user_ref: dict = Depends(get_current_user)):
    user_id = user_ref["id"]

    wrong_answers = get_wrong_answers_by_user(user_id)
    for entry in wrong_answers:
        if entry.get("question_id") == req.question_id:
            entry["reviewed"] = True
            save_wrong_answer_item(entry)

    # d_review 미션 진척: missions.daily.progress 를 원자 쓰기 경로로 갱신. (C-1 [필수])
    def mutator(user: dict) -> None:
        from routers.missions_core import bump_mission
        bump_mission(user, "review_done")
        return None

    try:
        mutate_user_atomic(user_id, mutator)
    except Exception:
        logger.exception("review_done bump_mission failed for user %s", user_id)

    return {"success": True}

