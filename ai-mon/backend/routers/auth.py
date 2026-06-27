from typing import Optional
from fastapi import APIRouter, HTTPException, status, Header, Request, Depends
from pydantic import BaseModel
import json, os, hashlib, hmac, uuid, secrets
import httpx
import logging

logger = logging.getLogger(__name__)
from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext
from routers.utils import (
    serialize_user,
    apply_xp,
    load_users,
    save_users,
    get_user_by_id,
    get_user_by_username,
    get_user_by_email,
    save_user,
    load_reset_tokens,
    save_reset_tokens,
    load_refresh_tokens,
    save_refresh_token,
    delete_refresh_token,
    delete_user_refresh_tokens,
    mutate_user_atomic,
    UserNotFoundError,
    SECRET_KEY,
    ALGORITHM,
    limiter,
    now_kst,
    get_current_user,
    get_current_user_optional,
)

router = APIRouter()

EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
REFRESH_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 30))


class RefreshRequest(BaseModel):
    refresh_token: str


def create_refresh_token(user_id: str) -> str:
    token = secrets.token_hex(32)
    expires_at = (now_kst() + timedelta(days=REFRESH_EXPIRE_DAYS)).isoformat()
    refresh_item = {
        "user_id": user_id,
        "token": token,
        "expires_at": expires_at
    }
    save_refresh_token(refresh_item)
    return token


# passlib bcrypt 4.0+ / 5.0+ compatibility monkeypatch
import bcrypt
original_hashpw = bcrypt.hashpw
def patched_hashpw(password, salt):
    if isinstance(password, str):
        password_bytes = password.encode("utf-8")
    else:
        password_bytes = password
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    return original_hashpw(password_bytes, salt)
bcrypt.hashpw = patched_hashpw

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # 하위 호환: 만약 기존의 SHA-256 해시값이라면 기존 방식 적용
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        return pwd_context.verify(plain_password, hashed_password)
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password


def create_token(data: dict, token_version: int = 1) -> str:
    to_encode = data.copy()
    expire = now_kst() + timedelta(minutes=EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "ver": token_version})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def update_login_streak(user: dict) -> tuple[dict, dict | None]:
    today = now_kst().strftime("%Y-%m-%d")
    yesterday = (now_kst() - timedelta(days=1)).strftime("%Y-%m-%d")
    last = user.get("last_login", "")

    streak_reward = None
    if last == today:
        pass
    elif last == yesterday:
        user["streak"] = user.get("streak", 0) + 1
        streak = user["streak"]
        earned_milestones = user.get("earned_streak_milestones", [])
        if streak == 3 and 3 not in earned_milestones:
            # XP를 apply_xp 대신 직접 가산하는 이유:
            # update_login_streak 는 이미 bump_mission(login) 중 또는 직후에 호출되며,
            # apply_xp 내부에서 다시 미션 훅을 트리거하면 같은 mutator 내에서
            # 미션 진척·보상이 중복 처리될 수 있다(재진입 위험).
            # lv 재계산은 아래 apply_xp(user, 0, {}) 에서 XP 추가 없이 수행한다.
            user["xp"] = user.get("xp", 0) + 500
            user.setdefault("earned_streak_milestones", []).append(3)
            streak_reward = {"days": 3, "xp": 500, "crowns": 0}
        elif streak == 7 and 7 not in earned_milestones:
            user["xp"] = user.get("xp", 0) + 2000
            user["crowns"] = user.get("crowns", 0) + 1
            user.setdefault("earned_streak_milestones", []).append(7)
            streak_reward = {"days": 7, "xp": 2000, "crowns": 1}
        elif streak == 14 and 14 not in earned_milestones:
            user["xp"] = user.get("xp", 0) + 5000
            user["crowns"] = user.get("crowns", 0) + 2
            user.setdefault("earned_streak_milestones", []).append(14)
            streak_reward = {"days": 14, "xp": 5000, "crowns": 2}
        elif streak == 30 and 30 not in earned_milestones:
            user["xp"] = user.get("xp", 0) + 10000
            user["crowns"] = user.get("crowns", 0) + 5
            user.setdefault("earned_streak_milestones", []).append(30)
            streak_reward = {"days": 30, "xp": 10000, "crowns": 5}

        # xp=0 으로 호출 → XP 추가 없이 lv·진화·칭호만 재계산 (XP는 위에서 직접 가산)
        apply_xp(user, 0, {})
    else:
        user["streak"] = 1

    # 출석 미션(예외 경로): XP 가 없고 day_key 가 필요하므로 bump_mission 직접 호출.
    # 모든 로그인 분기에서 실행되며, 날짜 dedup 은 청크 2 본체(login_days)에서. 청크 1: no-op.
    try:
        from routers.missions_core import bump_mission
        bump_mission(user, "login", day_key=today)
    except Exception:
        import logging
        logging.getLogger("uvicorn.error").exception("login bump_mission failed")

    user["last_login"] = today
    return user, streak_reward


class RegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
    email: str = ""
    course_level: str = "beginner"   # 레벨 테스트 결과 or 기본값
    is_level_tested: bool = False
    marketing_agreed: bool = False


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str


class FindIdRequest(BaseModel):
    email: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(req: RegisterRequest, request: Request):
    if get_user_by_username(req.username):
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    # course_level: 클라 값을 쓰되 valid_levels 외의 값은 "beginner"로 fallback한다.
    # 레벨 테스트(/auth/level-test/submit)를 정상 완료한 클라이언트가 결과를 함께
    # 전달하는 흐름이므로 허용된 값(beginner/intermediate/advanced)이면 신뢰한다.
    # is_level_tested: 클라 신뢰 — 레벨 테스트 완료 여부를 클라가 설정한다.
    # 악의적 클라가 is_level_tested=true 로 보내도 게임 로직 상 실질 피해가 없다
    # (보스 진입 게이트는 progress 기반 별도 검증 / 레벨 배정은 course_level 이 결정).
    valid_levels = {"beginner", "intermediate", "advanced"}
    level = req.course_level if req.course_level in valid_levels else "beginner"
    new_user = {
        "id": str(uuid.uuid4()),
        "username": req.username,
        "password": hash_password(req.password),
        "nickname": req.nickname or req.username,
        "email": req.email,
        "course_level": level,
        "is_level_tested": req.is_level_tested,
        "marketing_agreed": req.marketing_agreed,
        "group_id": None,
        "role": "student",
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
    save_user(new_user)
    token = create_token({"sub": new_user["id"], "username": new_user["username"]}, new_user.get("token_version", 1))
    refresh_token = create_refresh_token(new_user["id"])
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(new_user)
    }


@router.post("/login")
@limiter.limit("10/minute")
def login(req: LoginRequest, request: Request):
    user_ref = get_user_by_username(req.username)
    if not user_ref or not verify_password(req.password, user_ref["password"]):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    # d_login auto_claim 이 missions.daily.claimed(list) 를 append 하므로
    # save_user delta-merge 대신 mutate_user_atomic 원자 경로로 저장. (C-1 [필수])
    def mutator(user: dict):
        _, streak_reward = update_login_streak(user)
        return streak_reward

    try:
        user, streak_reward = mutate_user_atomic(user_ref["id"], mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    token = create_token({"sub": user["id"], "username": user["username"]}, user.get("token_version", 1))
    refresh_token = create_refresh_token(user["id"])
    res_data = {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(user),
        "streak": user["streak"]
    }
    if streak_reward:
        res_data["streak_reward"] = streak_reward
    return res_data


@router.post("/forgot-password")
@limiter.limit("5/hour")
def forgot_password(req: ForgotPasswordRequest, request: Request):
    _SAME = {"ok": True, "message": "If an account with that email exists, a reset code has been sent."}

    user = get_user_by_email(req.email)
    if not user:
        # user enumeration 방지: 계정 미존재도 동일 응답
        return _SAME

    now = now_kst()
    today_str = now.strftime("%Y-%m-%d")

    # 이메일 단위 스로틀: reset_tokens 레코드에 보관 (user 컬럼 불필요, 별도 저장 경로)
    # 하루 5회 · 3분 쿨다운 — IP limiter(5/hour) 와 이중 방어
    tokens = load_reset_tokens()
    existing = tokens.get(req.email, {})

    if existing.get("send_date") == today_str:
        if existing.get("send_count_today", 0) >= 5:
            return _SAME
        if existing.get("last_sent"):
            try:
                last_sent_dt = datetime.fromisoformat(existing["last_sent"])
                if (now - last_sent_dt).total_seconds() < 180:
                    return _SAME
            except (ValueError, TypeError):
                logger.debug("last_sent 타임스탬프 파싱 실패 — 쿨다운 검사 skip", exc_info=True)
                pass
        send_count = existing.get("send_count_today", 0) + 1
    else:
        send_count = 1

    # 토큰 생성 — SHA-256 해시만 저장(평문 저장 금지). 이메일엔 raw 토큰 발송.
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = (now + timedelta(minutes=30)).isoformat()

    tokens[req.email] = {
        "token": token_hash,        # 해시만 영속화
        "expires_at": expires_at,
        "failed_attempts": 0,
        "send_date": today_str,
        "send_count_today": send_count,
        "last_sent": now.isoformat(),
    }
    save_reset_tokens(tokens)

    subject = "[AI MON] 비밀번호 재설정 인증 코드"
    html_content = f"""
    <div style="font-family: sans-serif; padding: 20px;">
        <h2>비밀번호 재설정</h2>
        <p>요청하신 비밀번호 재설정 인증 코드입니다.</p>
        <div style="background-color: #f5f5f5; padding: 10px; word-break: break-all; font-family: monospace;">{raw_token}</div>
        <p>이 코드는 30분 후 만료됩니다.</p>
    </div>
    """
    from services.email_service import send_email
    send_email(to_email=req.email, subject=subject, html_content=html_content)

    return _SAME


@router.post("/reset-password")
@limiter.limit("5/hour")
def reset_password(req: ResetPasswordRequest, request: Request):
    _INVALID = HTTPException(status_code=400, detail="유효하지 않거나 만료된 토큰입니다.")

    tokens = load_reset_tokens()

    if req.email not in tokens:
        raise _INVALID

    token_data = tokens[req.email]
    expires_at = datetime.fromisoformat(token_data["expires_at"])
    if expires_at.tzinfo is None:  # 레거시 naive 타임스탬프 → KST로 간주
        expires_at = expires_at.replace(tzinfo=timezone(timedelta(hours=9)))

    if now_kst() > expires_at:
        del tokens[req.email]
        save_reset_tokens(tokens)
        raise _INVALID

    # 타이밍 안전 비교: 제출값 해시 후 hmac.compare_digest (평문 ↔ 해시 직접 비교 금지)
    submitted_hash = hashlib.sha256(req.token.encode()).hexdigest()
    stored_hash = token_data["token"]

    if not hmac.compare_digest(stored_hash, submitted_hash):
        failed = token_data.get("failed_attempts", 0) + 1
        if failed >= 5:
            del tokens[req.email]
            save_reset_tokens(tokens)
            raise HTTPException(
                status_code=400,
                detail="허용된 시도 횟수를 초과하여 토큰이 무효화되었습니다. 비밀번호 찾기를 다시 요청해주세요.",
            )
        token_data["failed_attempts"] = failed
        save_reset_tokens(tokens)
        raise _INVALID

    user = get_user_by_email(req.email)
    if user is None:
        raise _INVALID

    # 비밀번호 변경 — mutate_user_atomic 원자 경로로 저장 (C-1)
    new_hashed_pw = hash_password(req.new_password)
    def mutator(u: dict) -> None:
        u["password"] = new_hashed_pw
        return None

    try:
        mutate_user_atomic(user["id"], mutator)
    except UserNotFoundError:
        raise _INVALID

    del tokens[req.email]
    save_reset_tokens(tokens)

    return {"ok": True, "message": "비밀번호가 성공적으로 변경되었습니다."}


def mask_username(username: str) -> str:
    """아이디를 마스킹: 앞 2글자만 노출하고 나머지는 *로 치환 (예: 'jinny' -> 'ji***')."""
    if len(username) <= 2:
        # 너무 짧으면 첫 글자만 노출
        return username[:1] + "*" * max(len(username) - 1, 1)
    return username[:2] + "*" * (len(username) - 2)


@router.post("/find-id")
@limiter.limit("5/hour")
def find_id(req: FindIdRequest, request: Request):
    user = get_user_by_email(req.email.strip())

    # 보안: 계정이 없어도 HTTP 200 동일 형태로 응답해 info-disclosure(이메일 존재 여부 노출)를 줄임
    if not user:
        return {"ok": True, "found": False, "message": "해당 이메일로 가입된 계정을 찾을 수 없습니다."}

    # 소셜 전용 계정 판별: username 이 google_/naver_/kakao_ 접두사로 시작하면 일반 비번 로그인 불가
    username = user.get("username", "")
    if username.startswith(("google_", "naver_", "kakao_")):
        return {
            "ok": True,
            "found": True,
            "is_social": True,
            "message": "소셜 로그인(구글/네이버/카카오)으로 가입된 계정입니다.",
        }

    return {
        "ok": True,
        "found": True,
        "is_social": False,
        "masked_username": mask_username(username),
    }


from typing import Optional

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

    is_new = False
    if not user:
        is_new = True
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
        save_user(user)

    # 로그인 스트릭 + 출석 미션(d_login auto_claim·w_streak5·login_days)을
    # 원자 경로로 기록. save_user delta-merge 는 missions 를 덮어써 동시성에서
    # 왕관 이중 지급/진척 유실을 유발하므로 mutate_user_atomic 필수. (M-1/M-2)
    def _login_mutator(u: dict):
        _, sr = update_login_streak(u)
        return sr

    try:
        user, streak_reward = mutate_user_atomic(user["id"], _login_mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    token = create_token({"sub": user["id"], "username": user["username"]}, user.get("token_version", 1))
    refresh_token = create_refresh_token(user["id"])
    res_data = {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(user),
        "streak": user["streak"],
        "is_new": is_new
    }
    if streak_reward:
        res_data["streak_reward"] = streak_reward
    return res_data


@router.get("/check-id")
def check_id(username: str):
    if get_user_by_username(username.strip()):
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    return {"ok": True}


@router.get("/check-email")
def check_email(email: str):
    email_clean = email.strip()
    if get_user_by_email(email_clean) or get_user_by_username(email_clean):
        raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다.")
    return {"ok": True}


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

    is_new = False
    if not user:
        is_new = True
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
        save_user(user)

    # 로그인 스트릭 + 출석 미션(d_login auto_claim·w_streak5·login_days)을
    # 원자 경로로 기록. save_user delta-merge 는 missions 를 덮어써 동시성에서
    # 왕관 이중 지급/진척 유실을 유발하므로 mutate_user_atomic 필수. (M-1/M-2)
    def _login_mutator(u: dict):
        _, sr = update_login_streak(u)
        return sr

    try:
        user, streak_reward = mutate_user_atomic(user["id"], _login_mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    token = create_token({"sub": user["id"], "username": user["username"]}, user.get("token_version", 1))
    refresh_token = create_refresh_token(user["id"])
    res_data = {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(user),
        "streak": user["streak"],
        "is_new": is_new
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

    is_new = False
    if not user:
        is_new = True
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
        save_user(user)

    # 로그인 스트릭 + 출석 미션(d_login auto_claim·w_streak5·login_days)을
    # 원자 경로로 기록. save_user delta-merge 는 missions 를 덮어써 동시성에서
    # 왕관 이중 지급/진척 유실을 유발하므로 mutate_user_atomic 필수. (M-1/M-2)
    def _login_mutator(u: dict):
        _, sr = update_login_streak(u)
        return sr

    try:
        user, streak_reward = mutate_user_atomic(user["id"], _login_mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    token = create_token({"sub": user["id"], "username": user["username"]}, user.get("token_version", 1))
    refresh_token = create_refresh_token(user["id"])
    res_data = {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(user),
        "streak": user["streak"],
        "is_new": is_new
    }
    if streak_reward:
        res_data["streak_reward"] = streak_reward
    return res_data


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


LEVEL_TEST_QUESTIONS_META = {
    "lt1": {"level": "beginner", "category": "syntax", "answer": 1},
    "lt2": {"level": "beginner", "category": "syntax", "answer": 1},
    "lt3": {"level": "beginner", "category": "structure", "answer": 1},
    "lt4": {"level": "beginner", "category": "structure", "answer": 1},
    "lt5": {"level": "intermediate", "category": "syntax", "answer": 1},
    "lt6": {"level": "intermediate", "category": "syntax", "answer": 1},
    "lt7": {"level": "intermediate", "category": "control", "answer": 2},
    "lt8": {"level": "advanced", "category": "control", "answer": 1},
    "lt9": {"level": "advanced", "category": "control", "answer": 1},
    "lt10": {"level": "advanced", "category": "control", "answer": 1},
}


class LevelTestAnswer(BaseModel):
    questionId: str
    selectedAnswer: int


class SubmitLevelTestRequest(BaseModel):
    answers: list[LevelTestAnswer]


@router.post("/level-test/submit")
def submit_level_test(req: SubmitLevelTestRequest, user: Optional[dict] = Depends(get_current_user_optional)):
    correct_by_level = {"beginner": 0, "intermediate": 0, "advanced": 0}
    correct_by_category = {"syntax": 0, "structure": 0, "control": 0}
    total_correct = 0

    for ans in req.answers:
        q_id = ans.questionId
        if q_id in LEVEL_TEST_QUESTIONS_META:
            meta = LEVEL_TEST_QUESTIONS_META[q_id]
            if ans.selectedAnswer == meta["answer"]:
                correct_by_level[meta["level"]] += 1
                correct_by_category[meta["category"]] += 1
                total_correct += 1

    # 게이트 판정
    beginner_ok = correct_by_level["beginner"] >= 3
    intermediate_ok = correct_by_level["intermediate"] >= 2
    advanced_ok = correct_by_level["advanced"] >= 2

    if beginner_ok and intermediate_ok and advanced_ok:
        level_key = "advanced"
    elif beginner_ok and intermediate_ok:
        level_key = "intermediate"
    else:
        level_key = "beginner"

    # 카테고리별 백분율
    category_percentages = {
        "syntax": int(correct_by_category["syntax"] / 4 * 100),
        "structure": int(correct_by_category["structure"] / 2 * 100),
        "control": int(correct_by_category["control"] / 4 * 100),
    }

    updated_user = None
    if user:
        # 로그인 유저 정보 업데이트
        def mutator(u: dict):
            u["course_level"] = level_key
            u["is_level_tested"] = True
            return None
        
        try:
            updated_user = mutate_user_atomic(user["id"], mutator)
        except UserNotFoundError:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    return {
        "levelKey": level_key,
        "totalCorrect": total_correct,
        "score": int(total_correct / 10 * 100),
        "correctByCategory": correct_by_category,
        "categoryPercentages": category_percentages,
        "user": serialize_user(updated_user) if updated_user else None,
    }


@router.post("/touch")
def touch(user: dict = Depends(get_current_user)):
    """앱 부팅 시 클라이언트 1회 호출. KST 하루 1회 dedup으로 streak을 갱신한다."""
    user_id = user["id"]

    def mutator(u: dict) -> dict:
        _, streak_reward = update_login_streak(u)
        return streak_reward

    try:
        updated, streak_reward = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    res = {
        "streak": updated.get("streak", 0),
        "last_login": updated.get("last_login", ""),
        "user": serialize_user(updated),
    }
    if streak_reward:
        res["streak_reward"] = streak_reward
    return res


