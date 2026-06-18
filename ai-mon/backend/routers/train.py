import os, random
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from routers.quiz import load_questions_by_category
from routers.utils import verify_token, load_wrong_answers, save_wrong_answers

router = APIRouter()


@router.get("/review")
def get_train_review(
    unit: int = 1,
    course_level: str = "beginner",
    limit: int = 15,
    authorization: str = Header(None)
):
    questions = load_questions_by_category("train", course_level=course_level, unit=unit)
    if not questions:
        questions = load_questions_by_category("quiz", course_level=course_level, unit=unit) + \
                    load_questions_by_category("miniboss", course_level=course_level, unit=unit)
    wrong_answers = load_wrong_answers()

    # 유저 ID 추출 (JWT 토큰 파싱)
    user_id = None
    if authorization:
        try:
            user_id = verify_token(authorization)
        except HTTPException:
            pass

    # 해당 유닛 스테이지 퀴즈 + 미니보스 문제 풀
    unit_pool = questions

    # 오답 문제 우선 선별
    priority_ids = set()
    if user_id:
        for entry in wrong_answers:
            if entry.get("user_id") == user_id and not entry.get("reviewed", False):
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
def mark_question_reviewed(req: ReviewedRequest, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")

    user_id = verify_token(authorization)

    wrong_answers = load_wrong_answers()
    updated = False
    for entry in wrong_answers:
        if entry.get("user_id") == user_id and entry.get("question_id") == req.question_id:
            entry["reviewed"] = True
            updated = True

    if updated:
        save_wrong_answers(wrong_answers)

    return {"success": True}

