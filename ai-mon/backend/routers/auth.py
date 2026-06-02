from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import json, os, hashlib, uuid
from datetime import datetime, timedelta
from jose import jwt

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


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


class RegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    users = load_users()
    if any(u["username"] == req.username for u in users):
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    new_user = {
        "id": str(uuid.uuid4()),
        "username": req.username,
        "password": hash_password(req.password),
        "nickname": req.nickname or req.username,
        "character": "default",
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
    if not user or user["password"] != hash_password(req.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    token = create_token({"sub": user["id"], "username": user["username"]})
    return {"access_token": token, "token_type": "bearer", "user": {k: v for k, v in user.items() if k != "password"}}
