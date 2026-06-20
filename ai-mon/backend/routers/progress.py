from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
import uuid
from datetime import datetime
from routers.titles import check_and_award_titles
from routers.utils import (
    serialize_user,
    calc_level,
    load_users,
    save_users,
    load_progress,
    save_progress,
    verify_token,
)

router = APIRouter()


class ProgressUpdateRequest(BaseModel):
    unit: int
    stage: str  # 예: "1-1", "1-2", "1-final"
    score: int
    is_completed: bool = False
    checkpoint: str | None = None


@router.get("/")
def get_progress(course_level: str = Query("beginner"), authorization: str = Header(...)):
    user_id = verify_token(authorization)
    progress = load_progress()
    return [p for p in progress if p["user_id"] == user_id and p.get("course_level", "beginner") == course_level]


@router.post("/")
def update_progress(req: ProgressUpdateRequest, authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    course_level = user.get("course_level", "beginner") if user else "beginner"
    
    progress = load_progress()
    newly_earned = []

    existing = next(
        (p for p in progress if p["user_id"] == user_id
         and p["unit"] == req.unit
         and p["stage"] == req.stage
         and p.get("course_level", "beginner") == course_level),
        None,
    )

    award_xp = False
    if existing:
        if not existing.get("is_completed", False) and req.is_completed:
            award_xp = True
        existing["score"] = max(existing.get("score", 0), req.score)
        existing["is_completed"] = req.is_completed or existing.get("is_completed", False)
        
        # checkpoint 로직: 기존이 'done'이면 하위 상태로 덮어쓰지 않음
        if req.checkpoint:
            if existing.get("checkpoint") != "done":
                existing["checkpoint"] = req.checkpoint
                
        existing["updated_at"] = datetime.utcnow().isoformat()
    else:
        award_xp = req.is_completed
        progress.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "unit": req.unit,
            "stage": req.stage,
            "score": req.score,
            "is_completed": req.is_completed,
            "checkpoint": req.checkpoint,
            "course_level": course_level,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        })

    save_progress(progress)

    # 1. XP 획득량을 stage 종류별로 구분
    stage = req.stage
    if "boss" in stage:
        xp_gain = 3000   # 유닛 보스 클리어
    else:
        xp_gain = 2000   # 스테이지 퀴즈 클리어

    # 유닛 완료 체크 → 왕관 지급 (방금 저장한 progress 변수를 그대로 사용 - 이중 I/O 방지)
    user_unit_stages = [
        p for p in progress
        if p.get("user_id") == user_id
        and p.get("unit") == req.unit
        and p.get("is_completed") == True
        and p.get("course_level", "beginner") == course_level
    ]
    completed_stage_ids = {p.get("stage") for p in user_unit_stages}
    
    try:
        from routers.quiz import load_units, load_questions_by_category
        lessons_data = load_units(course_level)
        lesson = next((l for l in lessons_data if l.get("unit_id") == req.unit), None)
        if lesson and "stages" in lesson:
            total_stages = lesson["stages"]
        else:
            qs = load_questions_by_category("quiz", course_level, req.unit)
            stages = set()
            for q in qs:
                stage_val = q.get("stage")
                if stage_val:
                    parts = str(stage_val).split("-")
                    if len(parts) > 1 and parts[1].isdigit():
                        stages.add(int(parts[1]))
            total_stages = max(stages) if stages else 7
    except Exception:
        total_stages = 7

    required_stages = {f"{req.unit}-{i}" for i in range(1, total_stages + 1)} | {f"{req.unit}-boss"}
    unit_just_completed = required_stages.issubset(completed_stage_ids)

    crowns_awarded = 0
    newly_earned = []
    
    for u in users:
        if u["id"] == user_id:
            # 1. XP 및 진화
            if award_xp:
                u["xp"] = u.get("xp", 0) + xp_gain
                

                new_lv = calc_level(u["xp"])
                u["lv"] = max(new_lv, u.get("lv", 1))

                if u["lv"] >= 10 and u.get("character") == "slime":
                    u["character"] = "robot"
                elif u["lv"] >= 20 and u.get("character") == "robot":
                    u["character"] = "speech_bubble"
                elif u["lv"] >= 30 and u.get("character") == "speech_bubble":
                    u["character"] = "final_ghost"

            # 2. 왕관 지급
            if unit_just_completed:
                awarded_units = u.get("awarded_crown_units", [])
                val = f"{course_level}-{req.unit}"
                if val not in awarded_units:
                    crowns_awarded = 1  # 유닛 번호가 아닌 고정 1개 지급
                    u["crowns"] = u.get("crowns", 0) + crowns_awarded
                    awarded_units.append(val)
                    u["awarded_crown_units"] = awarded_units

            # 3. 칭호 부여
            context = {
                "stage_completed": award_xp,
                "unit_fully_done": unit_just_completed,
            }
            newly_earned = check_and_award_titles(u, context)
            break

    save_users(users)

    # return 할 때 현재 유저 상태를 조회하여 안전하게 반환
    current_u = next((usr for usr in users if usr.get("id") == user_id), {})
    serialized = serialize_user(current_u)

    return {
        "message": "진행상황이 저장되었습니다.",
        "xp_awarded": xp_gain if award_xp else 0,
        "crowns_awarded": crowns_awarded,
        "character": serialized.get("character", "slime"),
        "lv": serialized.get("lv", 1),
        "newly_earned_titles": newly_earned,
    }


@router.get("/stats")
def get_stats(authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    course_level = user.get("course_level", "beginner") if user else "beginner"

    progress = load_progress()
    user_progress = [p for p in progress if p["user_id"] == user_id and p.get("course_level", "beginner") == course_level]

    completed = [p for p in user_progress if p.get("is_completed")]
    total_score = sum(p["score"] for p in user_progress)
    avg_score = total_score / len(user_progress) if user_progress else 0

    return {
        "total_stages": len(user_progress),
        "completed_stages": len(completed),
        "total_score": total_score,
        "average_score": round(avg_score, 1),
    }
