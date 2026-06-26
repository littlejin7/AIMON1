import logging
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import Response
from pydantic import BaseModel
import os
from routers.utils import (
    serialize_user,
    save_user,
    get_current_user,
    delete_user_refresh_tokens,
    mutate_user_atomic,
    UserNotFoundError,
    now_kst,
)

logger = logging.getLogger("uvicorn.error")
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
def get_me(user: dict = Depends(get_current_user)):
    return serialize_user(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(user: dict = Depends(get_current_user)):
    user_id = user["id"]

    def mutator(u: dict) -> None:
        u["deleted_at"] = now_kst().isoformat()

    try:
        mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        pass  # 이미 삭제됐거나 찾을 수 없어도 무해하게 처리

    delete_user_refresh_tokens(user_id)


@router.patch("/me")
def update_me(req: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    # Log structural metadata (excluding PII like nickname, username, etc.)
    updated_fields = [k for k, v in req.dict().items() if v is not None]
    logger.info(f"PATCH /user/me request: user_id={user['id']}, updated_fields={updated_fields}")
    
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
    logger.info(f"PATCH /user/me successful: user_id={user['id']}")
    return serialize_user(user)


@router.post("/purchase-theme")
def purchase_theme(req: PurchaseThemeRequest, user: dict = Depends(get_current_user)):
    if req.theme_id not in THEME_PRICES:
        raise HTTPException(status_code=400, detail="존재하지 않는 테마입니다.")
    cost = THEME_PRICES[req.theme_id]
    owned = user.get("purchased_themes") or ["dark"]
    if req.theme_id in owned:
        raise HTTPException(status_code=400, detail="이미 보유한 테마입니다.")
    current_xp = user.get("xp") or 0
    if current_xp < cost:
        raise HTTPException(status_code=400, detail=f"XP가 부족합니다. (필요: {cost}, 보유: {current_xp})")
    
    user["xp"] = current_xp - cost
    user["purchased_themes"] = owned + [req.theme_id]
    
    from routers.utils import calc_level
    user["lv"] = max(calc_level(user["xp"]), user.get("lv", 1))
    
    save_user(user)
    return {
        "success": True,
        "theme_id": req.theme_id,
        "xp_spent": cost,
        "xp_remaining": user["xp"],
        "purchased_themes": user["purchased_themes"],
        "user": serialize_user(user),
    }


