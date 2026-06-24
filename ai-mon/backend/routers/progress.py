from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
import uuid
from datetime import datetime
from routers.utils import (
    serialize_user,
    save_user,
    get_progress_by_user,
    save_progress_item,
    get_current_user,
    apply_xp,
    now_kst,
)

router = APIRouter()


class ProgressUpdateRequest(BaseModel):
    unit: int
    stage: str  # 예: "1-1", "1-2", "1-final"
    score: int
    is_completed: bool = False
    checkpoint: str | None = None


@router.get("/")
def get_progress(course_level: str = Query("beginner"), user: dict = Depends(get_current_user)):
    return get_progress_by_user(user["id"], course_level)


@router.post("/")
def update_progress(req: ProgressUpdateRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    course_level = user.get("course_level", "beginner")
    
    progress = get_progress_by_user(user_id, course_level)
    newly_earned = []

    existing = next(
        (p for p in progress if p["unit"] == req.unit
         and p["stage"] == req.stage),
        None,
    )

    award_xp = False
    target_item = None
    if existing:
        if not existing.get("is_completed", False) and req.is_completed:
            award_xp = True
        existing["score"] = max(existing.get("score", 0), req.score)
        existing["is_completed"] = req.is_completed or existing.get("is_completed", False)
        
        # checkpoint 로직: 기존이 'done'이면 하위 상태로 덮어쓰지 않음
        if req.checkpoint:
            if existing.get("checkpoint") != "done":
                existing["checkpoint"] = req.checkpoint
                
        existing["updated_at"] = now_kst().isoformat()
        target_item = existing
    else:
        award_xp = req.is_completed
        target_item = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "unit": req.unit,
            "stage": req.stage,
            "score": req.score,
            "is_completed": req.is_completed,
            "checkpoint": req.checkpoint,
            "course_level": course_level,
            "created_at": now_kst().isoformat(),
            "updated_at": now_kst().isoformat(),
        }
        progress.append(target_item)

    save_progress_item(target_item)

    # 1. XP 획득량을 stage 종류별로 구분
    stage = req.stage
    if "boss" in stage:
        xp_gain = 3000   # 유닛 보스 클리어
    else:
        xp_gain = 2000   # 스테이지 퀴즈 클리어

    # 유닛 완료 체크 → 왕관 지급 (방금 저장한 progress 변수를 그대로 사용 - 이중 I/O 방지)
    user_unit_stages = [
        p for p in progress
        if p.get("unit") == req.unit
        and p.get("is_completed") == True
    ]
    completed_stage_ids = {p.get("stage") for p in user_unit_stages}
    
    try:
        from routers.quiz import load_units
        lessons_data = load_units(course_level)
        lesson = next((l for l in lessons_data if l.get("unit_id") == req.unit), None)
        if not lesson:
            raise ValueError(f"Unit metadata not found for unit_id={req.unit}")
        if "stages" not in lesson:
            raise ValueError(f"'stages' key not found in unit metadata for unit_id={req.unit}")
        total_stages = lesson["stages"]
    except Exception as e:
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.error(f"[C-3] Failed to load unit stages: unit={req.unit}, level={course_level}, error={str(e)}")
        raise HTTPException(
            status_code=500,
            detail="유닛 완료 판정 중 오류가 발생했습니다. (오류: 유닛 메타데이터 누락)"
        )

    required_stages = {f"{req.unit}-{i}" for i in range(1, total_stages + 1)} | {f"{req.unit}-boss"}
    unit_just_completed = required_stages.issubset(completed_stage_ids)

    crowns_awarded = 0
    newly_earned = []
    
    if user:
        # 1. 왕관 지급
        if unit_just_completed:
            awarded_units = user.get("awarded_crown_units") or []
            val = f"{course_level}-{req.unit}"
            if val not in awarded_units:
                crowns_awarded = 1  # 유닛 번호가 아닌 고정 1개 지급
                user["crowns"] = (user.get("crowns") or 0) + crowns_awarded
                awarded_units.append(val)
                user["awarded_crown_units"] = awarded_units

        # 2. XP 및 진화, 칭호 부여
        context = {
            "stage_completed": award_xp,
            "unit_fully_done": unit_just_completed,
        }
        events = apply_xp(user, xp_gain if award_xp else 0, context, event_type="stage_clear")
        newly_earned = events["newly_earned_titles"]
        
        save_user(user)

    serialized = serialize_user(user) if user else {}

    return {
        "message": "진행상황이 저장되었습니다.",
        "xp_awarded": xp_gain if award_xp else 0,
        "crowns_awarded": crowns_awarded,
        "character": serialized.get("character", "slime"),
        "lv": serialized.get("lv", 1),
        "newly_earned_titles": newly_earned,
    }


@router.get("/stats")
def get_stats(user: dict = Depends(get_current_user)):
    user_id = user["id"]
    course_level = user.get("course_level", "beginner")

    user_progress = get_progress_by_user(user_id, course_level)

    completed = [p for p in user_progress if p.get("is_completed")]
    total_score = sum(p["score"] for p in user_progress)
    avg_score = total_score / len(user_progress) if user_progress else 0

    return {
        "total_stages": len(user_progress),
        "completed_stages": len(completed),
        "total_score": total_score,
        "average_score": round(avg_score, 1),
    }
