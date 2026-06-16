from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import json, os
from jose import jwt, JWTError

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

USERS_FILE = os.path.join(os.path.dirname(__file__), "../data/users.json")


def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def get_current_user(authorization: str):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        users = load_users()
        user = next((u for u in users if u["id"] == user_id), None)
        if not user:
            raise HTTPException(status_code=401, detail="인증 실패")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


from typing import Optional

class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = None
    character: Optional[str] = None
    course_level: Optional[str] = None
    is_level_tested: Optional[bool] = None


from routers.utils import serialize_user

@router.get("/me")
def get_me(authorization: str = Header(...)):
    user = get_current_user(authorization)
    return serialize_user(user)


@router.patch("/me")
def update_me(req: UpdateProfileRequest, authorization: str = Header(...)):
    user = get_current_user(authorization)
    users = load_users()
    print("PATCH /user/me payload:", req.dict())
    for u in users:
        if u["id"] == user["id"]:
            if req.nickname is not None:
                u["nickname"] = req.nickname
            if req.character is not None:
                u["character"] = req.character
            if req.course_level is not None:
                u["course_level"] = req.course_level
            if req.is_level_tested is not None:
                u["is_level_tested"] = req.is_level_tested
            save_users(users)
            print("PATCH /user/me successfully saved user:", u)
            return serialize_user(u)
    raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
