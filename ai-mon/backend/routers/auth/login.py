"""로그인·토큰 도메인: /login /refresh /logout /touch."""
from fastapi import APIRouter, HTTPException, Header, Request, Depends
from pydantic import BaseModel
from datetime import datetime
from jose import jwt

from routers.utils import (
    serialize_user,
    get_user_by_id,
    get_user_by_username,
    get_user_by_username_any,
    load_refresh_tokens,
    delete_refresh_token,
    delete_user_refresh_tokens,
    mutate_user_atomic,
    UserNotFoundError,
    UserSaveError,
    SECRET_KEY,
    ALGORITHM,
    limiter,
    now_kst,
    get_current_user,
)
from ._core import (
    logger,
    create_token,
    create_refresh_token,
    verify_password,
    update_login_streak,
    _issue_auth_response,
    _restore_for_login,
    INVALID_LOGIN_DETAIL,
)

router = APIRouter()


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
@limiter.limit("10/minute")
def login(req: LoginRequest, request: Request):
    # ── [추가 및 변경] 아이디를 소문자로 변환 ──
    username_clean = req.username.strip().lower()
    user_ref = get_user_by_username(username_clean)
    account_restored = False
    if not user_ref:
        deleted_user = get_user_by_username_any(username_clean)
        if deleted_user and deleted_user.get("deleted_at") and verify_password(req.password, deleted_user.get("password", "")):
            user_ref = _restore_for_login(deleted_user)
            account_restored = True
    if not user_ref or not verify_password(req.password, user_ref["password"]):
        raise HTTPException(status_code=401, detail=INVALID_LOGIN_DETAIL)

    # d_login auto_claim 이 missions.daily.claimed(list) 를 append 하므로
    # save_user delta-merge 대신 mutate_user_atomic 원자 경로로 저장. (C-1 [필수])
    def mutator(user: dict):
        _, sr, ar = update_login_streak(user)
        return sr, ar

    try:
        user, (streak_reward, attendance_reward) = mutate_user_atomic(user_ref["id"], mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    return _issue_auth_response(user, account_restored=account_restored, streak_reward=streak_reward, attendance_reward=attendance_reward)


@router.post("/refresh")
def refresh(req: RefreshRequest):
    tokens = load_refresh_tokens()
    target = next((t for t in tokens if t["token"] == req.refresh_token), None)
    if not target:
        raise HTTPException(status_code=401, detail="유효하지 않거나 만료된 리프레시 토큰입니다.")

    expires_at_str = target["expires_at"].replace("Z", "+00:00")
    try:
        expires_at = datetime.fromisoformat(expires_at_str)
    except Exception:
        expires_at = now_kst()

    if expires_at.tzinfo is not None:
        now_dt = datetime.now(expires_at.tzinfo)
    else:
        now_dt = now_kst()

    if now_dt > expires_at:
        delete_refresh_token(req.refresh_token)
        raise HTTPException(status_code=401, detail="만료된 리프레시 토큰입니다. 다시 로그인해주세요.")

    user = get_user_by_id(target["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="유저를 찾을 수 없습니다.")
    if user.get("deleted_at"):
        delete_refresh_token(req.refresh_token)
        raise HTTPException(status_code=401, detail="탈퇴한 계정입니다.")

    new_access_token = create_token({"sub": user["id"], "username": user["username"]}, user.get("token_version", 1))
    new_refresh_token = create_refresh_token(user["id"])

    delete_refresh_token(req.refresh_token)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.post("/logout")
def logout(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")

    if user_id:
        delete_user_refresh_tokens(user_id)
        try:
            def _bump_version(u: dict):
                u["token_version"] = u.get("token_version", 1) + 1
            mutate_user_atomic(user_id, _bump_version)
        except Exception:
            logger.exception("logout: token_version 증가 실패 user=%s", user_id)

    return {"ok": True, "message": "로그아웃 되었습니다."}


@router.post("/touch")
def touch(user: dict = Depends(get_current_user)):
    """앱 부팅 시 클라이언트 1회 호출. KST 하루 1회 dedup으로 streak을 갱신한다."""
    user_id = user["id"]

    def mutator(u: dict):
        _, sr, ar = update_login_streak(u)
        return sr, ar

    try:
        updated, (streak_reward, attendance_reward) = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    except UserSaveError:
        logger.exception("auth touch save conflict for user %s", user_id)
        updated, streak_reward, attendance_reward = user, None, None
    except Exception:
        logger.exception("auth touch failed for user %s", user_id)
        updated, streak_reward, attendance_reward = user, None, None

    total_coin_delta = 0
    if attendance_reward:
        total_coin_delta += attendance_reward.get("coin_delta") or 0
    if streak_reward and "coin" in streak_reward:
        total_coin_delta += streak_reward.get("coin") or 0

    serialized = serialize_user(updated)
    res = {
        "streak": updated.get("streak", 0),
        "last_login": updated.get("last_login", ""),
        "user": serialized,
        "user_state": serialized,
        "reward": {
            "coin_delta": total_coin_delta,
            "gp_delta": 0,
            "ranking_score_delta": 0
        }
    }
    if streak_reward:
        res["streak_reward"] = streak_reward
    return res
