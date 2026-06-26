import os, random
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from routers.quiz import load_questions_by_category
import logging
from routers.utils import (
    get_wrong_answers_by_user,
    get_wrong_answers,
    get_unit_accuracy,
    get_progress_by_user,
    save_wrong_answer_item,
    get_current_user,
    get_current_user_optional,
    mutate_user_atomic,
)

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


@router.get("/review")
def get_train_review(
    unit: Optional[int] = None,
    course_level: str = "beginner",
    limit: int = 15,
    only_wrong: bool = False,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    user_id = user["id"] if user else None

    # unit=None → 전체 유닛 (load_questions_by_category가 unit=None이면 전부 반환)
    questions = load_questions_by_category("train", course_level=course_level, unit=unit)
    if not questions:
        questions = load_questions_by_category("quiz", course_level=course_level, unit=unit) + \
                    load_questions_by_category("miniboss", course_level=course_level, unit=unit)

    unit_pool = questions

    # 오답 문제 우선 선별 — attempts 기반 '유저·문제별 최신 1건이 오답'인 question_id.
    # (AI 피드백 성공 여부와 무관한 전수 기록 → 실제 오답을 안정적으로 재현)
    priority_ids = set(get_wrong_answers(user_id, course_level=course_level, unit=unit)) if user_id else set()

    priority_qs = [q for q in unit_pool if q.get("question_id") in priority_ids]

    # 오답복습(only_wrong): 실제 틀린 문제만 반환 — 랜덤 폴백 패딩 없음(없으면 빈 목록).
    if only_wrong:
        return priority_qs[:limit]

    # 그 외 모드(유닛반복/랜덤): 오답 우선 + 나머지 랜덤으로 채우기
    normal_qs = [q for q in unit_pool if q.get("question_id") not in priority_ids]
    random.shuffle(normal_qs)
    result = priority_qs + normal_qs
    return result[:limit]


@router.get("/random")
def get_train_random(
    n: int = 10,
    course_level: str = "beginner",
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """잠금해제(이미 학습)한 유닛에서 순수 랜덤 N개 출제.
    '잠금해제' = progress에 is_completed=True 스테이지가 1개라도 있는 유닛.
    빈 결과 시 폴백 없음 — 클라이언트가 안내 메시지를 표시한다.

    TODO(v2): 정답률 낮은 유닛에 가중치를 부여하는 가중 샘플링 적용.
    """
    if not user:
        return []

    user_id = user["id"]
    progress = get_progress_by_user(user_id, course_level=course_level)
    # is_completed=True인 스테이지가 존재하는 유닛 번호만 추출
    unlocked = sorted({
        int(p["unit"]) for p in progress
        if p.get("is_completed") and p.get("unit") is not None
    })

    if not unlocked:
        return []

    pool = []
    for u in unlocked:
        pool += load_questions_by_category("quiz",     course_level=course_level, unit=u)
        pool += load_questions_by_category("miniboss", course_level=course_level, unit=u)

    if not pool:
        return []

    random.shuffle(pool)
    return pool[:n]


@router.get("/boss_rush")
def get_train_boss_rush(
    n: int = 10,
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """클리어한 유닛의 miniboss 문제 풀 보스 러시 (초급 고정).
    클리어 판정: user.miniboss_cleared_stages에 "{unit}-..." 형 항목 존재.
    빈 결과 시 폴백 없음 — 클라이언트가 안내 메시지를 표시한다.

    TODO(v2): 정답률 낮은 유닛 가중치 적용.
    """
    if not user:
        return []

    cleared_stages = user.get("miniboss_cleared_stages") or []
    # 클리어한 유닛 번호 추출 (stage_key = "{unit}-{stage_num}")
    cleared_units = sorted({
        int(k.split("-")[0]) for k in cleared_stages
        if k and k.split("-")[0].isdigit()
    })

    if not cleared_units:
        return []

    # 초급(beginner) 고정 (v1 의도된 동작)
    # TODO(v2): activeLevel 기준으로 미니보스 레벨 선택
    pool = []
    for u in cleared_units:
        pool += load_questions_by_category("miniboss", course_level="beginner", unit=u)

    if not pool:
        return []

    random.shuffle(pool)
    return pool[:n]


@router.get("/accuracy")
def get_train_accuracy(
    course_level: str = "beginner",
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """유닛별 정답률 — attempts(유저·문제별 최신 1건) 기반."""
    if not user:
        return []
    return get_unit_accuracy(user["id"], course_level=course_level)


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

