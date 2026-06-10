from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import json, os, hashlib, uuid
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 43200))

USERS_FILE = os.path.join(os.path.dirname(__file__), "../data/users.json")


def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # 하위 호환: 만약 기존의 SHA-256 해시값이라면 기존 방식 적용
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        return pwd_context.verify(plain_password, hashed_password)
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password


def create_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


class RegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
    course_level: str = "beginner"   # 레벨 테스트 결과 or 기본값
    is_level_tested: bool = False


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    users = load_users()
    if any(u["username"] == req.username for u in users):
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    # course_level 유효성 검증
    valid_levels = {"beginner", "intermediate", "advanced"}
    level = req.course_level if req.course_level in valid_levels else "beginner"
    new_user = {
        "id": str(uuid.uuid4()),
        "username": req.username,
        "password": hash_password(req.password),
        "nickname": req.nickname or req.username,
        "course_level": level,
        "is_level_tested": req.is_level_tested,
        "character": "slime",
        "lv": 1,
        "crowns": 5,
        "daily_free_attempts": 2,
        "last_free_attempt_date": "",
        "streak": 0,
        "last_login": "",
        "titles": [],
        "ai_feedback_count": 0,
        "created_at": datetime.utcnow().isoformat(),
    }
    users.append(new_user)
    save_users(users)
    token = create_token({"sub": new_user["id"], "username": new_user["username"]})
    return {"access_token": token, "token_type": "bearer", "user": {k: v for k, v in new_user.items() if k != "password"}}


@router.post("/login")
def login(req: LoginRequest):
    users = load_users()
    user = next((u for u in users if u["username"] == req.username), None)
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    today = datetime.utcnow().strftime("%Y-%m-%d")
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    last = user.get("last_login", "")

    streak_reward = None
    if last == today:
        pass
    elif last == yesterday:
        user["streak"] = user.get("streak", 0) + 1
        streak = user["streak"]
        if streak == 3:
            user["xp"] = user.get("xp", 0) + 500
            streak_reward = {"days": 3, "xp": 500, "crowns": 0}
        elif streak == 7:
            user["xp"] = user.get("xp", 0) + 2000
            user["crowns"] = user.get("crowns", 0) + 1
            streak_reward = {"days": 7, "xp": 2000, "crowns": 1}
        elif streak == 14:
            user["xp"] = user.get("xp", 0) + 5000
            user["crowns"] = user.get("crowns", 0) + 2
            streak_reward = {"days": 14, "xp": 5000, "crowns": 2}
        elif streak == 30:
            user["xp"] = user.get("xp", 0) + 10000
            user["crowns"] = user.get("crowns", 0) + 5
            streak_reward = {"days": 30, "xp": 10000, "crowns": 5}

        # Level up and evolution check
        if streak_reward:
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

            new_lv = calc_level(user.get("xp", 0))
            user["lv"] = max(new_lv, user.get("lv", 1))

            if user["lv"] >= 10 and user.get("character") == "slime":
                user["character"] = "robot"
            elif user["lv"] >= 20 and user.get("character") == "robot":
                user["character"] = "speech_bubble"
            elif user["lv"] >= 30 and user.get("character") == "speech_bubble":
                user["character"] = "final_ghost"
    else:
        user["streak"] = 1

    user["last_login"] = today
    save_users(users)

    token = create_token({"sub": user["id"], "username": user["username"]})
    res_data = {
        "access_token": token,
        "token_type": "bearer",
        "user": {k: v for k, v in user.items() if k != "password"},
        "streak": user["streak"]
    }
    if streak_reward:
        res_data["streak_reward"] = streak_reward
    return res_data


@router.get("/check-id")
def check_id(username: str):
    users = load_users()
    if any(u["username"] == username.strip() for u in users):
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    return {"ok": True}
