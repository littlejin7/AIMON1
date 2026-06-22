from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import os
from routers.utils import (
    serialize_user,
    save_user,
    get_current_user,
)

router = APIRouter()


from typing import Optional, List

# 테마별 XP 가격 (dark는 무료)
THEME_PRICES = {
    "dark":     0,
    "ocean":    500,
    "fire":     500,
    "cyber":    500,
    "cherry":   800,
    "midnight": 800,
    "sunset":   800,
    "gold":     1000,
    "arctic":   1000,
    "galaxy":   1500,
    "sakura":   2000,
}

class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = None
    character: Optional[str] = None
    course_level: Optional[str] = None
    is_level_tested: Optional[bool] = None
    equipped_title: Optional[str] = None

class PurchaseThemeRequest(BaseModel):
    theme_id: str

@router.get("/me")
def get_me(authorization: str = Header(...)):
    user = get_current_user(authorization)
    return serialize_user(user)


@router.patch("/me")
def update_me(req: UpdateProfileRequest, authorization: str = Header(...)):
    user = get_current_user(authorization)
    print("PATCH /user/me payload:", req.dict())
    
    if req.nickname is not None:
        user["nickname"] = req.nickname
    if req.character is not None:
        user["character"] = req.character
    if req.course_level is not None:
        user["course_level"] = req.course_level
    if req.is_level_tested is not None:
        user["is_level_tested"] = req.is_level_tested
    if req.equipped_title is not None:
        user["equipped_title"] = req.equipped_title
        
    save_user(user)
    print("PATCH /user/me successfully saved user:", user)
    return serialize_user(user)
