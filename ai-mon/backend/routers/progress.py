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
    lesson_id: str
    stage: int
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
         and p["lesson_id"] == req.lesson_id
         and p["stage"] == req.stage),
        None,
    )

    if existing:
        existing["score"] = max(existing["score"], req.score)
        existing["is_completed"] = req.is_completed or existing["is_completed"]
        existing["updated_at"] = datetime.utcnow().isoformat()
    else:
        progress.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "lesson_id": req.lesson_id,
            "stage": req.stage,
            "score": req.score,
            "is_completed": req.is_completed,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        })

    save_progress(progress)
    return {"message": "진행상황이 저장되었습니다."}


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
