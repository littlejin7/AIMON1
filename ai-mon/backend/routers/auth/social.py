"""소셜로그인 도메인: /social/google /social/naver /social/kakao."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import os, uuid
import httpx

from routers.utils import (
    serialize_user,
    get_user_by_username,
    get_user_by_username_any,
    save_user,
    mutate_user_atomic,
    UserNotFoundError,
    now_kst,
    limiter,
    delete_soft_deleted_user_by_username,
)
from ._core import (
    logger,
    create_token,
    create_refresh_token,
    update_login_streak,
    _is_restore_eligible,
    _restore_for_login,
    _unique_social_nickname,
    _refresh_social_nickname_for_save,
)

router = APIRouter()


class SocialLoginRequest(BaseModel):
    code: str
    redirect_uri: str
    state: Optional[str] = None


@router.post("/social/google")
@limiter.limit("5/minute")
async def social_google(req: SocialLoginRequest, request: Request):
    # 1. Exchange code for credentials
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=500,
            detail="구글 API 설정(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)이 되어있지 않습니다."
        )

    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": req.code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": req.redirect_uri,
        "grant_type": "authorization_code"
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            token_res = await client.post(token_url, data=data)
    except httpx.RequestError:
        logger.exception("[Google] 토큰 교환 네트워크/timeout 오류")
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    try:
        token_json = token_res.json()
    except Exception:
        logger.exception("[Google] 토큰 응답 파싱 실패 (HTTP %d)", token_res.status_code)
        raise

    if "error" in token_json:
        raise HTTPException(
            status_code=400,
            detail=f"구글 토큰 인증 에러: {token_json.get('error_description', token_json['error'])}"
        )
    if not token_res.is_success:
        logger.error("[Google] 토큰 교환 비2xx: HTTP %d", token_res.status_code)
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    access_token = token_json.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="access_token을 획득하지 못했습니다.")

    # 2. Get user info from Google
    userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            user_res = await client.get(userinfo_url, headers=headers)
    except httpx.RequestError:
        logger.exception("[Google] 프로필 조회 네트워크/timeout 오류")
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    try:
        user_info = user_res.json()
    except Exception:
        logger.exception("[Google] 프로필 응답 파싱 실패 (HTTP %d)", user_res.status_code)
        raise

    if not user_res.is_success:
        logger.error("[Google] 프로필 조회 비2xx: HTTP %d", user_res.status_code)
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="구글 계정에서 이메일 정보를 가져올 수 없습니다.")

    nickname = user_info.get("name", email.split("@")[0])

    # 3. Find or create user
    # 소셜 로그인은 username을 google_이메일 형식으로 저장해 고유성 유지
    username = f"google_{email}"
    user = get_user_by_username(username)
    account_restored = False
    if not user:
        deleted_user = get_user_by_username_any(username)
        if deleted_user and deleted_user.get("deleted_at"):
            if _is_restore_eligible(deleted_user):
                user = _restore_for_login(deleted_user)
                account_restored = True
            else:
                delete_soft_deleted_user_by_username(username)

    is_new = False
    if not user:
        is_new = True
        nickname = _unique_social_nickname(nickname, username)
        user = {
            "id": str(uuid.uuid4()),
            "username": username,
            "password": "",  # 소셜 유저는 일반 패스워드 로그인 제한
            "nickname": nickname,
            "email": email,
            "group_id": None,
            "role": "student",
            "course_level": "beginner",
            "is_level_tested": False,
            "character": "slime",
            "lv": 1,
            "xp": 0,
            "crowns": 5,
            "daily_free_attempts": 2,
            "last_free_attempt_date": "",
            "streak": 0,
            "last_login": "",
            "titles": [],
            "ai_feedback_count": 0,
            "max_unlocked_unit": {"beginner": 1, "intermediate": 1, "advanced": 1},
            "completed_units": {"beginner": 0, "intermediate": 0, "advanced": 0},
            "awarded_crown_units": [],
            "earned_streak_milestones": [],
            "game_rewards": {},
            "created_at": now_kst().isoformat(),
        }

    # 신규 유저면 행을 먼저 생성해 mutate_user_atomic 대상 확보
    if is_new:
        _refresh_social_nickname_for_save(user, username)
        save_user(user)

    # 로그인 스트릭 + 출석 미션(d_login auto_claim·w_streak5·login_days)을
    # 원자 경로로 기록. save_user delta-merge 는 missions 를 덮어써 동시성에서
    # 왕관 이중 지급/진척 유실을 유발하므로 mutate_user_atomic 필수. (M-1/M-2)
    def _login_mutator(u: dict):
        _, sr, ar = update_login_streak(u)
        return sr, ar

    try:
        user, (streak_reward, attendance_reward) = mutate_user_atomic(user["id"], _login_mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    token = create_token({"sub": user["id"], "username": user["username"]}, user.get("token_version", 1))
    refresh_token = create_refresh_token(user["id"])

    total_coin_delta = 0
    if attendance_reward:
        total_coin_delta += attendance_reward.get("coin_delta") or 0
    if streak_reward and "coin" in streak_reward:
        total_coin_delta += streak_reward.get("coin") or 0

    serialized = serialize_user(user)
    res_data = {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialized,
        "user_state": serialized,
        "streak": user["streak"],
        "is_new": is_new,
        "account_restored": account_restored,
        "reward": {
            "coin_delta": total_coin_delta,
            "gp_delta": 0,
            "ranking_score_delta": 0
        }
    }
    if streak_reward:
        res_data["streak_reward"] = streak_reward
    return res_data


@router.post("/social/naver")
@limiter.limit("5/minute")
async def social_naver(req: SocialLoginRequest, request: Request):
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=500,
            detail="네이버 API 설정(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)이 되어있지 않습니다."
        )

    token_url = "https://nid.naver.com/oauth2.0/token"
    params = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": req.code,
        "state": req.state or "naver_state"
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            token_res = await client.post(token_url, data=params)
    except httpx.RequestError:
        logger.exception("[Naver] 토큰 교환 네트워크/timeout 오류")
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    try:
        token_json = token_res.json()
    except Exception:
        logger.exception("[Naver] 토큰 응답 파싱 실패 (HTTP %d)", token_res.status_code)
        raise

    if "error" in token_json:
        raise HTTPException(
            status_code=400,
            detail=f"네이버 토큰 인증 에러: {token_json.get('error_description', token_json['error'])}"
        )
    if not token_res.is_success:
        logger.error("[Naver] 토큰 교환 비2xx: HTTP %d", token_res.status_code)
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    access_token = token_json.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="access_token을 획득하지 못했습니다.")

    # 2. Get user info from Naver
    userinfo_url = "https://openapi.naver.com/v1/nid/me"
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            user_res = await client.get(userinfo_url, headers=headers)
    except httpx.RequestError:
        logger.exception("[Naver] 프로필 조회 네트워크/timeout 오류")
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    try:
        user_info_res = user_res.json()
    except Exception:
        logger.exception("[Naver] 프로필 응답 파싱 실패 (HTTP %d)", user_res.status_code)
        raise

    if not user_res.is_success:
        logger.error("[Naver] 프로필 조회 비2xx: HTTP %d", user_res.status_code)
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    if user_info_res.get("resultcode") != "00":
        raise HTTPException(
            status_code=400,
            detail=f"네이버 사용자 정보 취득 실패: {user_info_res.get('message', '알 수 없는 에러')}"
        )

    naver_response = user_info_res.get("response", {})
    email = naver_response.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="네이버 계정에서 이메일 정보를 가져올 수 없습니다.")

    nickname = naver_response.get("name") or naver_response.get("nickname") or email.split("@")[0]

    # 3. Find or create user
    username = f"naver_{email}"
    user = get_user_by_username(username)
    account_restored = False
    if not user:
        deleted_user = get_user_by_username_any(username)
        if deleted_user and deleted_user.get("deleted_at"):
            if _is_restore_eligible(deleted_user):
                user = _restore_for_login(deleted_user)
                account_restored = True
            else:
                delete_soft_deleted_user_by_username(username)

    is_new = False
    if not user:
        is_new = True
        nickname = _unique_social_nickname(nickname, username)
        user = {
            "id": str(uuid.uuid4()),
            "username": username,
            "password": "",
            "nickname": nickname,
            "email": email,
            "group_id": None,
            "role": "student",
            "course_level": "beginner",
            "is_level_tested": False,
            "character": "slime",
            "lv": 1,
            "xp": 0,
            "crowns": 5,
            "daily_free_attempts": 2,
            "last_free_attempt_date": "",
            "streak": 0,
            "last_login": "",
            "titles": [],
            "ai_feedback_count": 0,
            "max_unlocked_unit": {"beginner": 1, "intermediate": 1, "advanced": 1},
            "completed_units": {"beginner": 0, "intermediate": 0, "advanced": 0},
            "awarded_crown_units": [],
            "earned_streak_milestones": [],
            "game_rewards": {},
            "created_at": now_kst().isoformat(),
        }

    # 신규 유저면 행을 먼저 생성해 mutate_user_atomic 대상 확보
    if is_new:
        _refresh_social_nickname_for_save(user, username)
        save_user(user)

    # 로그인 스트릭 + 출석 미션(d_login auto_claim·w_streak5·login_days)을
    # 원자 경로로 기록. save_user delta-merge 는 missions 를 덮어써 동시성에서
    # 왕관 이중 지급/진척 유실을 유발하므로 mutate_user_atomic 필수. (M-1/M-2)
    def _login_mutator(u: dict):
        _, sr, ar = update_login_streak(u)
        return sr, ar

    try:
        user, (streak_reward, attendance_reward) = mutate_user_atomic(user["id"], _login_mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    token = create_token({"sub": user["id"], "username": user["username"]}, user.get("token_version", 1))
    refresh_token = create_refresh_token(user["id"])

    total_coin_delta = 0
    if attendance_reward:
        total_coin_delta += attendance_reward.get("coin_delta") or 0
    if streak_reward and "coin" in streak_reward:
        total_coin_delta += streak_reward.get("coin") or 0

    serialized = serialize_user(user)
    res_data = {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialized,
        "user_state": serialized,
        "streak": user["streak"],
        "is_new": is_new,
        "account_restored": account_restored,
        "reward": {
            "coin_delta": total_coin_delta,
            "gp_delta": 0,
            "ranking_score_delta": 0
        }
    }
    if streak_reward:
        res_data["streak_reward"] = streak_reward
    return res_data


@router.post("/social/kakao")
@limiter.limit("5/minute")
async def social_kakao(req: SocialLoginRequest, request: Request):
    client_id = os.getenv("KAKAO_CLIENT_ID")
    client_secret = os.getenv("KAKAO_CLIENT_SECRET")

    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="카카오 API 설정(KAKAO_CLIENT_ID)이 되어있지 않습니다."
        )

    token_url = "https://kauth.kakao.com/oauth/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "redirect_uri": req.redirect_uri,
        "code": req.code,
    }
    if client_secret:
        data["client_secret"] = client_secret

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            token_res = await client.post(token_url, data=data)
    except httpx.RequestError:
        logger.exception("[Kakao] 토큰 교환 네트워크/timeout 오류")
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    try:
        token_json = token_res.json()
    except Exception:
        logger.exception("[Kakao] 토큰 응답 파싱 실패 (HTTP %d)", token_res.status_code)
        raise

    if "error" in token_json:
        raise HTTPException(
            status_code=400,
            detail=f"카카오 토큰 인증 에러: {token_json.get('error_description', token_json['error'])}"
        )
    if not token_res.is_success:
        logger.error("[Kakao] 토큰 교환 비2xx: HTTP %d", token_res.status_code)
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    access_token = token_json.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="access_token을 획득하지 못했습니다.")

    # 2. Get user info from Kakao
    userinfo_url = "https://kapi.kakao.com/v2/user/me"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            user_res = await client.get(userinfo_url, headers=headers)
    except httpx.RequestError:
        logger.exception("[Kakao] 프로필 조회 네트워크/timeout 오류")
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    try:
        user_info_res = user_res.json()
    except Exception:
        logger.exception("[Kakao] 프로필 응답 파싱 실패 (HTTP %d)", user_res.status_code)
        raise

    if not user_res.is_success:
        logger.error("[Kakao] 프로필 조회 비2xx: HTTP %d", user_res.status_code)
        raise HTTPException(status_code=502, detail="소셜 로그인 일시 오류 — 잠시 후 다시 시도해 주세요.")

    kakao_id = user_info_res.get("id")
    if not kakao_id:
        raise HTTPException(status_code=400, detail="카카오 계정에서 고유 ID를 가져올 수 없습니다.")

    kakao_account = user_info_res.get("kakao_account", {})
    email = kakao_account.get("email")

    if email:
        username = f"kakao_{email}"
    else:
        username = f"kakao_{kakao_id}"

    profile = kakao_account.get("profile", {})
    nickname = profile.get("nickname") or (email.split("@")[0] if email else f"KakaoUser_{kakao_id}")

    # 3. Find or create user
    user = get_user_by_username(username)
    account_restored = False
    if not user:
        deleted_user = get_user_by_username_any(username)
        if deleted_user and deleted_user.get("deleted_at"):
            if _is_restore_eligible(deleted_user):
                user = _restore_for_login(deleted_user)
                account_restored = True
            else:
                delete_soft_deleted_user_by_username(username)

    is_new = False
    if not user:
        is_new = True
        nickname = _unique_social_nickname(nickname, username)
        user = {
            "id": str(uuid.uuid4()),
            "username": username,
            "password": "",
            "nickname": nickname,
            "email": email or "",
            "group_id": None,
            "role": "student",
            "course_level": "beginner",
            "is_level_tested": False,
            "character": "slime",
            "lv": 1,
            "xp": 0,
            "crowns": 5,
            "daily_free_attempts": 2,
            "last_free_attempt_date": "",
            "streak": 0,
            "last_login": "",
            "titles": [],
            "ai_feedback_count": 0,
            "max_unlocked_unit": {"beginner": 1, "intermediate": 1, "advanced": 1},
            "completed_units": {"beginner": 0, "intermediate": 0, "advanced": 0},
            "awarded_crown_units": [],
            "earned_streak_milestones": [],
            "game_rewards": {},
            "created_at": now_kst().isoformat(),
        }

    # 신규 유저면 행을 먼저 생성해 mutate_user_atomic 대상 확보
    if is_new:
        _refresh_social_nickname_for_save(user, username)
        save_user(user)

    # 로그인 스트릭 + 출석 미션(d_login auto_claim·w_streak5·login_days)을
    # 원자 경로로 기록. save_user delta-merge 는 missions 를 덮어써 동시성에서
    # 왕관 이중 지급/진척 유실을 유발하므로 mutate_user_atomic 필수. (M-1/M-2)
    def _login_mutator(u: dict):
        _, sr, ar = update_login_streak(u)
        return sr, ar

    try:
        user, (streak_reward, attendance_reward) = mutate_user_atomic(user["id"], _login_mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    token = create_token({"sub": user["id"], "username": user["username"]}, user.get("token_version", 1))
    refresh_token = create_refresh_token(user["id"])

    total_coin_delta = 0
    if attendance_reward:
        total_coin_delta += attendance_reward.get("coin_delta") or 0
    if streak_reward and "coin" in streak_reward:
        total_coin_delta += streak_reward.get("coin") or 0

    serialized = serialize_user(user)
    res_data = {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialized,
        "user_state": serialized,
        "streak": user["streak"],
        "is_new": is_new,
        "account_restored": account_restored,
        "reward": {
            "coin_delta": total_coin_delta,
            "gp_delta": 0,
            "ranking_score_delta": 0
        }
    }
    if streak_reward:
        res_data["streak_reward"] = streak_reward
    return res_data
