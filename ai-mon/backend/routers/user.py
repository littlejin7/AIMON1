from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import os
from routers.utils import (
    serialize_user,
    load_users,
    save_users,
    get_current_user,
)

router = APIRouter()


from typing import Optional

class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = None
    character: Optional[str] = None
    course_level: Optional[str] = None
    is_level_tested: Optional[bool] = None
    equipped_title: Optional[str] = None



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
            if req.equipped_title is not None:
                u["equipped_title"] = req.equipped_title
            save_users(users)
            print("PATCH /user/me successfully saved user:", u)
            return serialize_user(u)
    raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
