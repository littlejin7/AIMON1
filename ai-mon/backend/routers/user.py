import logging
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import Response
from pydantic import BaseModel
import os
from routers.utils import (
    serialize_user,
    get_current_user,
    delete_user_refresh_tokens,
    mutate_user_atomic,
    UserNotFoundError,
    now_kst,
    derive_course_level_from_endboss,
    promote_course_level_from_endboss,
)

logger = logging.getLogger("uvicorn.error")
router = APIRouter()


from typing import Optional, List

# 캐릭터 진화 단계별 해금 레벨 (utils.apply_xp 진화 로직과 동일 기준).
# 유저는 '자신의 레벨로 도달한 단계 이하' 캐릭터만 표시/선택할 수 있다.
CHARACTER_UNLOCK_LV = {
    "slime":         1,
    "robot":         10,
    "speech_bubble": 20,
    "final_ghost":   30,
}


def _allowed_characters(lv: int) -> set:
    """현재 lv 로 해금된 캐릭터 집합."""
    return {c for c, req_lv in CHARACTER_UNLOCK_LV.items() if lv >= req_lv}


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
    promoted_level = derive_course_level_from_endboss(user)
    if promoted_level != user.get("course_level", "beginner"):
        try:
            user, _ = mutate_user_atomic(
                user["id"],
                lambda u: promote_course_level_from_endboss(u),
            )
        except UserNotFoundError:
            raise HTTPException(status_code=404, detail="User not found")
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
    # 명시적 빈 응답: FastAPI가 None 반환값을 "null" 바디로 직렬화하는 것 방지
    # (uvicorn/h11 은 204에 body가 있으면 프로토콜 에러를 냄)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me")
def update_me(req: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    # Log structural metadata (excluding PII like nickname, username, etc.)
    updated_fields = [k for k, v in req.dict().items() if v is not None]
    logger.info(f"PATCH /user/me request: user_id={user['id']}, updated_fields={updated_fields}")
    user_id = user["id"]

    # 검증·변경을 fresh user 기준으로 같은 임계구역에서 수행 (CLAUDE.md §1).
    # character/equipped_title 은 '소유/해금한 것'만 허용 — 위조 차단.
    #   - character: 현재 lv 로 해금된 진화 단계 이하만 (D 어뷰징 방어)
    #   - equipped_title: title_id 가 user["titles"] 에 있을 때만 (미보유 칭호 장착 차단)
    # 검증은 mutator 안(fresh u)에서 raise → write 미발생(no-op), CAS 재시도 대상 아님.
    def mutator(u: dict) -> None:
        if req.nickname is not None:
            u["nickname"] = req.nickname
        if req.character is not None:
            if req.character not in _allowed_characters(u.get("lv", 1)):
                raise HTTPException(status_code=400, detail="아직 진화하지 않은 캐릭터는 선택할 수 없습니다.")
            u["character"] = req.character
        if req.course_level is not None:
            u["course_level"] = req.course_level
        if req.is_level_tested is not None:
            u["is_level_tested"] = req.is_level_tested
        if req.equipped_title is not None:
            # 빈 문자열은 '장착 해제'로 허용, 그 외엔 보유 칭호만.
            if req.equipped_title != "" and req.equipped_title not in (u.get("titles") or []):
                raise HTTPException(status_code=400, detail="보유하지 않은 칭호는 장착할 수 없습니다.")
            u["equipped_title"] = req.equipped_title
        return None

    try:
        user, _ = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info(f"PATCH /user/me successful: user_id={user_id}")
    return serialize_user(user)


@router.post("/purchase-theme")
def purchase_theme(req: PurchaseThemeRequest, user: dict = Depends(get_current_user)):
    if req.theme_id not in THEME_PRICES:
        raise HTTPException(status_code=400, detail="존재하지 않는 테마입니다.")
    cost = THEME_PRICES[req.theme_id]
    user_id = user["id"]

    from routers.utils import calc_level

    # 보유체크 → XP 차감 → purchased_themes append 를 한 임계구역에서 원자 처리.
    # (CLAUDE.md §1·§3) 가드를 fresh u 기준으로 검사해야 동시 요청에서도 이중차감·
    # 이중구매·XP 음수가 생기지 않는다. mutate_user_atomic 은 절대값을 version CAS 로
    # 커밋하므로 current_xp - cost 절대 할당이 안전하다.
    def mutator(u: dict) -> dict:
        owned = u.get("purchased_themes") or ["dark"]
        if req.theme_id in owned:
            raise HTTPException(status_code=400, detail="이미 보유한 테마입니다.")
        current_xp = u.get("xp") or 0
        if current_xp < cost:
            raise HTTPException(status_code=400, detail=f"XP가 부족합니다. (필요: {cost}, 보유: {current_xp})")

        u["xp"] = current_xp - cost
        u["purchased_themes"] = owned + [req.theme_id]
        u["lv"] = max(calc_level(u["xp"]), u.get("lv", 1))
        return {"xp_spent": cost, "xp_remaining": u["xp"], "purchased_themes": u["purchased_themes"]}

    try:
        user, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "success": True,
        "theme_id": req.theme_id,
        "xp_spent": result["xp_spent"],
        "xp_remaining": result["xp_remaining"],
        "purchased_themes": result["purchased_themes"],
        "user": serialize_user(user),
    }


