import logging
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import Response
from pydantic import BaseModel
import os
from routers.utils import (
    serialize_user,
    get_current_user,
    get_user_by_nickname,
    normalize_nickname,
    delete_user_refresh_tokens,
    mutate_user_atomic,
    UserNotFoundError,
    now_kst,
    COURSE_LEVEL_ORDER,
    derive_unlocked_course_levels,
    apply_level_test_placement,
    get_evolution_stage,
    CHARACTER_TO_STAGE,
)
from routers.auth import hash_password, verify_password

logger = logging.getLogger("uvicorn.error")
router = APIRouter()


from typing import Optional, List

# 캐릭터 해금 게이트는 evolution_stage 기준(routers.utils.CHARACTER_TO_STAGE 재사용).
# lv 은 3차 진화 전에는 동결되는 값이라 더 이상 해금 판정에 쓸 수 없다 — 진화는
# 엔드보스 클리어로만 오르는 evolution_stage 가 단일 소스다.
# stage 0: slime만 / stage>=1: robot 추가 / stage>=2: speech_bubble 추가 / stage>=3: final_ghost 추가.
def _allowed_characters(evolution_stage: int) -> set:
    """현재 evolution_stage 로 해금된 캐릭터 집합."""
    return {c for c, req_stage in CHARACTER_TO_STAGE.items() if evolution_stage >= req_stage}


# 테마별 코인 가격 (dark는 무료). 상점은 coin_balance 만 차감한다.
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


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

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
    # 명시적 빈 응답: FastAPI가 None 반환값을 "null" 바디로 직렬화하는 것 방지
    # (uvicorn/h11 은 204에 body가 있으면 프로토콜 에러를 냄)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me")
def update_me(req: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    # Log structural metadata (excluding PII like nickname, username, etc.)
    updated_fields = [k for k, v in req.dict().items() if v is not None]
    logger.info(f"PATCH /user/me request: user_id={user['id']}, updated_fields={updated_fields}")
    user_id = user["id"]
    next_nickname = None
    if req.nickname is not None:
        next_nickname = normalize_nickname(req.nickname) or user.get("username", "")
        if get_user_by_nickname(next_nickname, exclude_user_id=user_id):
            raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")

    # 검증·변경을 fresh user 기준으로 같은 임계구역에서 수행 (CLAUDE.md §1).
    # character/equipped_title 은 '소유/해금한 것'만 허용 — 위조 차단.
    #   - character: 현재 evolution_stage 로 해금된 진화 단계 이하만 (D 어뷰징 방어)
    #   - equipped_title: title_id 가 user["titles"] 에 있을 때만 (미보유 칭호 장착 차단)
    # 검증은 mutator 안(fresh u)에서 raise → write 미발생(no-op), CAS 재시도 대상 아님.
    def mutator(u: dict) -> None:
        if next_nickname is not None:
            u["nickname"] = next_nickname
        if req.character is not None:
            if req.character not in _allowed_characters(get_evolution_stage(u)):
                raise HTTPException(status_code=400, detail="아직 진화하지 않은 캐릭터는 선택할 수 없습니다.")
            u["character"] = req.character
        if req.course_level is not None:
            if req.course_level not in COURSE_LEVEL_ORDER:
                raise HTTPException(status_code=400, detail="Invalid course level")
            unlocked_levels = derive_unlocked_course_levels(u)
            if req.is_level_tested is not True and req.course_level not in unlocked_levels:
                raise HTTPException(status_code=400, detail="Locked course level")
            if req.is_level_tested is True:
                apply_level_test_placement(u, req.course_level)
            else:
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
        if next_nickname is not None and get_user_by_nickname(next_nickname, exclude_user_id=user_id):
            raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
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

    # 보유체크 → coin_balance 차감 → purchased_themes append 를 한 임계구역에서 원자
    # 처리. (CLAUDE.md §1·§3) 가드를 fresh u 기준으로 검사해야 동시 요청에서도
    # 이중차감·이중구매·잔액 음수가 생기지 않는다. mutate_user_atomic 은 절대값을
    # version CAS 로 커밋하므로 current_coin - cost 절대 할당이 안전하다.
    # 상점은 coin_balance 만 참조/차감한다: gp/ranking_score/evolution_stage/crowns/xp
    # 는 절대 건드리지 않는다.
    def mutator(u: dict) -> dict:
        owned = u.get("purchased_themes") or ["dark"]
        if req.theme_id in owned:
            raise HTTPException(status_code=400, detail="이미 보유한 테마입니다.")
        current_coin = u.get("coin_balance") or 0
        if current_coin < cost:
            raise HTTPException(status_code=400, detail=f"코인이 부족합니다. (필요: {cost}, 보유: {current_coin})")

        u["coin_balance"] = current_coin - cost
        u["purchased_themes"] = owned + [req.theme_id]
        return {"coin_spent": cost, "coin_remaining": u["coin_balance"], "purchased_themes": u["purchased_themes"]}

    try:
        user, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "success": True,
        "theme_id": req.theme_id,
        "coin_spent": result["coin_spent"],
        "coin_remaining": result["coin_remaining"],
        "purchased_themes": result["purchased_themes"],
        "user": serialize_user(user),
    }


@router.post("/change-password")
def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    # 소셜 전용 계정(google_/naver_/kakao_ 접두사)은 비밀번호 자체가 없으므로 변경 불가.
    username = user.get("username", "")
    if username.startswith(("google_", "naver_", "kakao_")):
        raise HTTPException(status_code=400, detail="소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.")

    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="새 비밀번호는 8자 이상이어야 합니다.")
    if req.new_password == req.current_password:
        raise HTTPException(status_code=400, detail="새 비밀번호가 현재 비밀번호와 동일합니다.")

    new_hashed_pw = hash_password(req.new_password)

    # 현재 비밀번호 검증을 fresh user 기준으로 mutator 안에서 수행 (CLAUDE.md §1) —
    # 검사와 변경을 같은 임계구역에 둬 동시 변경 요청 사이의 TOCTOU를 방지한다.
    def mutator(u: dict) -> None:
        if not verify_password(req.current_password, u.get("password", "")):
            raise HTTPException(status_code=400, detail="현재 비밀번호가 일치하지 않습니다.")
        u["password"] = new_hashed_pw
        return None

    try:
        mutate_user_atomic(user["id"], mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    return {"ok": True, "message": "비밀번호가 변경되었습니다."}


