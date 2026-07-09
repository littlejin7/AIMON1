"""auth 패키지 공용 계층.

토큰 발급/검증, 비밀번호 해시·정책, 로그인 스트릭·출석 보상, 소프트삭제 복원,
닉네임/이메일 헬퍼, 공용 상수를 모아 각 도메인 서브모듈(login/register/social/password)이
공유한다. 여기서는 라우트를 정의하지 않는다.
"""
from fastapi import HTTPException
import os, hashlib, hmac, uuid, secrets, re
import logging
from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext
from routers.utils import (
    grant_reward,
    serialize_user,
    get_user_by_nickname,
    normalize_nickname,
    save_refresh_token,
    load_email_verification_codes,
    UserNotFoundError,
    SECRET_KEY,
    ALGORITHM,
    now_kst,
    restore_soft_deleted_user,
)

# 기존 routers.auth 단일 모듈과 동일한 로거 이름을 유지한다(로그 모니터링/테스트 호환).
logger = logging.getLogger("routers.auth")

EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
REFRESH_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 30))
ACCOUNT_RESTORE_RETENTION_DAYS = int(os.getenv("ACCOUNT_RESTORE_RETENTION_DAYS", 30))
INVALID_LOGIN_DETAIL = "아이디 또는 비밀번호가 올바르지 않습니다."
EMAIL_CODE_ATTEMPT_LIMIT = 5
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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


# 비밀번호 정책 (회원가입 / 비밀번호 변경 / 비밀번호 재설정 공통)
# 규칙: 최소 8자 + 영문 1자 이상 + 숫자 1자 이상 + 특수문자 1자 이상
_PW_SPECIAL_CHARS = set("!@#$%^&*()_+-=[]{};':\"\\|,.<>/?~`")


def validate_password_policy(password: str) -> None:
    """정책 위반 시 HTTPException(400) 을 raise. 통과하면 None."""
    pw = password or ""
    if len(pw) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
    if not any(c.isascii() and c.isalpha() for c in pw):
        raise HTTPException(status_code=400, detail="비밀번호에 영문을 1자 이상 포함해주세요.")
    if not any(c.isascii() and c.isdigit() for c in pw):
        raise HTTPException(status_code=400, detail="비밀번호에 숫자를 1자 이상 포함해주세요.")
    if not any(c in _PW_SPECIAL_CHARS for c in pw):
        raise HTTPException(status_code=400, detail="비밀번호에 특수문자를 1자 이상 포함해주세요.")

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


# 스트릭 보상 밸런스 상수 (임시 밸런스)
DAILY_ATTENDANCE_COIN = 1000
STREAK_3_COIN = 500
STREAK_7_COIN = 2000
STREAK_14_COIN = 5000
STREAK_30_COIN = 10000

def update_login_streak(user: dict) -> tuple[dict, dict | None, dict | None]:
    today = now_kst().strftime("%Y-%m-%d")
    yesterday = (now_kst() - timedelta(days=1)).strftime("%Y-%m-%d")
    last = user.get("last_login", "")

    streak_reward = None
    attendance_reward = None

    if last == today:
        pass
    else:
        # 1. 일일 출석 보상 실제 지급 (하루 1회만 - last != today 분기 진입 시)
        # gp_delta=0, ranking_score_delta=0 (출석은 랭킹 비대상)
        attendance_reward = grant_reward(
            user,
            coin_delta=DAILY_ATTENDANCE_COIN,
            ranking_score_delta=0,
            gp_delta=0,
            event_type="daily_attendance"
        )

        # 2. 스트릭 마일스톤 보상 판정
        if last == yesterday:
            user["streak"] = user.get("streak", 0) + 1
            streak = user["streak"]
            earned_milestones = user.get("earned_streak_milestones") or []

            # 스트릭 마일스톤 도달 시 코인 지급, xp 미지급
            # 기존 crowns 유지, xp=0 은 프론트엔드/테스트 호환성 및 xp 지급 중단용
            if streak == 3 and 3 not in earned_milestones:
                grant_reward(user, coin_delta=STREAK_3_COIN, event_type="streak_3")
                user.setdefault("earned_streak_milestones", []).append(3)
                streak_reward = {"days": 3, "xp": 0, "coin": STREAK_3_COIN, "crowns": 0}
            elif streak == 7 and 7 not in earned_milestones:
                grant_reward(user, coin_delta=STREAK_7_COIN, event_type="streak_7")
                user["crowns"] = user.get("crowns", 0) + 1
                user.setdefault("earned_streak_milestones", []).append(7)
                streak_reward = {"days": 7, "xp": 0, "coin": STREAK_7_COIN, "crowns": 1}
            elif streak == 14 and 14 not in earned_milestones:
                grant_reward(user, coin_delta=STREAK_14_COIN, event_type="streak_14")
                user["crowns"] = user.get("crowns", 0) + 2
                user.setdefault("earned_streak_milestones", []).append(14)
                streak_reward = {"days": 14, "xp": 0, "coin": STREAK_14_COIN, "crowns": 2}
            elif streak == 30 and 30 not in earned_milestones:
                grant_reward(user, coin_delta=STREAK_30_COIN, event_type="streak_30")
                user["crowns"] = user.get("crowns", 0) + 5
                user.setdefault("earned_streak_milestones", []).append(30)
                streak_reward = {"days": 30, "xp": 0, "coin": STREAK_30_COIN, "crowns": 5}
        else:
            user["streak"] = 1

    # 출석 미션(예외 경로): XP 가 없고 day_key 가 필요하므로 bump_mission 직접 호출.
    try:
        from routers.missions_core import bump_mission
        bump_mission(user, "login", day_key=today)
    except Exception:
        import logging
        logging.getLogger("uvicorn.error").exception("login bump_mission failed")

    user["last_login"] = today
    return user, streak_reward, attendance_reward


def _is_restore_eligible(user: dict) -> bool:
    deleted_at = user.get("deleted_at")
    if not deleted_at:
        return False
    try:
        deleted_dt = datetime.fromisoformat(str(deleted_at))
    except Exception:
        logger.warning("restore check skipped: invalid deleted_at for user_id=%s", user.get("id"))
        return False
    if deleted_dt.tzinfo is None:
        deleted_dt = deleted_dt.replace(tzinfo=timezone(timedelta(hours=9)))
    return now_kst() <= deleted_dt + timedelta(days=ACCOUNT_RESTORE_RETENTION_DAYS)


def _issue_auth_response(user: dict, *, is_new: bool = False, account_restored: bool = False, streak_reward=None, attendance_reward=None) -> dict:
    token = create_token({"sub": user["id"], "username": user["username"]}, user.get("token_version", 1))
    refresh_token = create_refresh_token(user["id"])
    serialized = serialize_user(user)

    total_coin_delta = 0
    if attendance_reward:
        total_coin_delta += attendance_reward.get("coin_delta") or 0
    if streak_reward and "coin" in streak_reward:
        total_coin_delta += streak_reward.get("coin") or 0

    res_data = {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialized,
        "user_state": serialized,
        "streak": user.get("streak", 0),
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


def _nickname_or_fallback(nickname: str | None, fallback: str) -> str:
    cleaned = normalize_nickname(nickname)
    return cleaned or str(fallback or "").strip()


def _ensure_nickname_available(nickname: str, *, exclude_user_id: str | None = None) -> None:
    if get_user_by_nickname(nickname, exclude_user_id=exclude_user_id):
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")


def _unique_social_nickname(preferred: str | None, username: str) -> str:
    base = _nickname_or_fallback(preferred, username)
    if not get_user_by_nickname(base):
        return base

    username_base = _nickname_or_fallback(username, "user")
    for i in range(1, 1000):
        candidate = f"{base}_{i}"
        if not get_user_by_nickname(candidate):
            return candidate

    for i in range(1, 1000):
        candidate = f"{username_base}_{i}"
        if not get_user_by_nickname(candidate):
            return candidate

    return f"{username_base}_{uuid.uuid4().hex[:8]}"


def _refresh_social_nickname_for_save(user: dict, username: str) -> None:
    user["nickname"] = _unique_social_nickname(user.get("nickname"), username)


def _restore_for_login(user: dict, updater=None) -> dict:
    if not _is_restore_eligible(user):
        raise HTTPException(status_code=401, detail=INVALID_LOGIN_DETAIL)
    try:
        return restore_soft_deleted_user(user["id"], updater)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")


def _env_flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def _validate_register_email_request(email: str, purpose: str) -> None:
    if purpose != "register":
        raise HTTPException(status_code=400, detail="지원하지 않는 이메일 인증 목적입니다.")
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="올바른 이메일 형식이 아닙니다.")


def _email_code_key(email: str, purpose: str) -> str:
    return f"{email}:{purpose}"


def _hash_email_code(email: str, purpose: str, code: str) -> str:
    payload = f"{email}:{purpose}:{code}".encode("utf-8")
    return hmac.new(SECRET_KEY.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone(timedelta(hours=9)))
    return parsed


def _email_verification_required() -> bool:
    return _env_flag("EMAIL_REQUIRE_VERIFICATION", "false") or _env_flag("EMAIL_ENABLED", "false")


def _is_email_verified(email: str, purpose: str = "register") -> bool:
    email = _normalize_email(email)
    records = load_email_verification_codes()
    record = records.get(_email_code_key(email, purpose))
    if not record or not record.get("verified"):
        return False
    expires_at = _parse_datetime(record.get("expires_at"))
    return bool(expires_at and now_kst() <= expires_at)
