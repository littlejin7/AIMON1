from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from jose import jwt, JWTError
import json, os, uuid
from datetime import datetime

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "../data/progress.json")


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


class ProgressUpdateRequest(BaseModel):
    unit: int
    stage: str  # 예: "1-1", "1-2", "1-final"
    score: int
    is_completed: bool = False


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
        USERS_FILE = os.path.join(os.path.dirname(__file__), "../data/users.json")
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                users = json.load(f)
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
                    break
            with open(USERS_FILE, "w", encoding="utf-8") as f:
                json.dump(users, f, ensure_ascii=False, indent=2)

    # 3. return xp_gain 으로 변경
    return {"message": "진행상황이 저장되었습니다.", "xp_awarded": xp_gain if award_xp else 0}


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
