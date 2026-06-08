from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from jose import jwt, JWTError
import json, os, uuid
from datetime import datetime
from routers.titles import check_and_award_titles

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "../data/progress.json")
USERS_FILE = os.path.join(os.path.dirname(__file__), "../data/users.json")


def verify_token(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


def load_progress():
    if not os.path.exists(PROGRESS_FILE):
        return []
    with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_progress(data):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


class ProgressUpdateRequest(BaseModel):
    unit: int
    stage: str  # 예: "1-1", "1-2", "1-final"
    score: int
    is_completed: bool = False
    checkpoint: str | None = None


@router.get("/")
def get_progress(authorization: str = Header(...)):
    user_id = verify_token(authorization)
    progress = load_progress()
    user_progress = [p for p in progress if p["user_id"] == user_id]
    return user_progress


@router.post("/")
def update_progress(req: ProgressUpdateRequest, authorization: str = Header(...)):
    user_id = verify_token(authorization)
    progress = load_progress()
    newly_earned = []

    existing = next(
        (p for p in progress if p["user_id"] == user_id
         and p["unit"] == req.unit
         and p["stage"] == req.stage),
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

    if award_xp:
        # XP 부여 로직 (user.py와 유사하게 users.json 로드)
        users = load_users()
        for u in users:
            if u["id"] == user_id:
                u["xp"] = u.get("xp", 0) + xp_gain
                
                # 2. 레벨업 로직: 필요 XP = 현재 레벨 × 1,000
                def calc_level(xp):
                    lv = 1
                    accumulated = 0
                    while lv < 30:
                        needed = lv * 1000
                        if xp < accumulated + needed:
                            break
                        accumulated += needed
                        lv += 1
                    return lv

                new_lv = calc_level(u["xp"])
                u["lv"] = max(new_lv, u.get("lv", 1))

                # 진화 체크 (레벨 기준)
                if u["lv"] >= 10 and u.get("character") == "slime":
                    u["character"] = "robot"
                elif u["lv"] >= 20 and u.get("character") == "robot":
                    u["character"] = "speech_bubble"
                elif u["lv"] >= 30 and u.get("character") == "speech_bubble":
                    u["character"] = "final_ghost"

                break
        save_users(users)

    # 유닛 완료 체크 → 왕관 지급
    progress_data = load_progress()
    user_unit_stages = [
        p for p in progress_data
        if p.get("user_id") == user_id
        and p.get("unit") == req.unit
        and p.get("is_completed") == True
    ]
    completed_stage_ids = {p.get("stage") for p in user_unit_stages}

    # 해당 유닛의 스테이지 1~7이 전부 완료됐는지 확인
    required_stages = {f"{req.unit}-{i}" for i in range(1, 8)}
    unit_just_completed = required_stages.issubset(completed_stage_ids) and req.stage in required_stages

    crowns_awarded = 0
    if unit_just_completed:
        # 유닛 번호만큼 왕관 지급 (Unit 1 → 1개, Unit 2 → 2개, ...)
        users = load_users()
        for u in users:
            if u.get("id") == user_id:
                # 이미 지급된 유닛인지 체크 (중복 지급 방지)
                awarded_units = u.get("awarded_crown_units", [])
                if req.unit not in awarded_units:
                    crowns_awarded = req.unit
                    u["crowns"] = u.get("crowns", 0) + crowns_awarded
                    awarded_units.append(req.unit)
                    u["awarded_crown_units"] = awarded_units
                break
        save_users(users)

    # 칭호 체크
    users = load_users()
    for u in users:
        if u.get("id") == user_id:
            context = {
                "stage_completed": award_xp,
                "unit_fully_done": unit_just_completed,
            }
            newly_earned = check_and_award_titles(u, context)
            break
    save_users(users)

    # return 할 때 현재 유저 상태를 조회하여 안전하게 반환
    current_u = next((usr for usr in load_users() if usr.get("id") == user_id), {})

    return {
        "message": "진행상황이 저장되었습니다.",
        "xp_awarded": xp_gain if award_xp else 0,
        "crowns_awarded": crowns_awarded,
        "character": current_u.get("character", "slime"),
        "lv": current_u.get("lv", 1),
        "newly_earned_titles": newly_earned,
    }


@router.get("/stats")
def get_stats(authorization: str = Header(...)):
    user_id = verify_token(authorization)
    progress = load_progress()
    user_progress = [p for p in progress if p["user_id"] == user_id]

    completed = [p for p in user_progress if p.get("is_completed")]
    total_score = sum(p["score"] for p in user_progress)
    avg_score = total_score / len(user_progress) if user_progress else 0

    return {
        "total_stages": len(user_progress),
        "completed_stages": len(completed),
        "total_score": total_score,
        "average_score": round(avg_score, 1),
    }
