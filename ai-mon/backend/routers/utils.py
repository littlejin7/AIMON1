import logging
import httpx

# Patches for httpx Client/AsyncClient init to support 'proxy' argument (gotrue expects it, but httpx 0.25.2 uses 'proxies')
orig_client_init = httpx.Client.__init__
def patched_client_init(self, *args, **kwargs):
    if "proxy" in kwargs:
        kwargs["proxies"] = kwargs.pop("proxy")
    orig_client_init(self, *args, **kwargs)
httpx.Client.__init__ = patched_client_init

orig_async_client_init = httpx.AsyncClient.__init__
def patched_async_client_init(self, *args, **kwargs):
    if "proxy" in kwargs:
        kwargs["proxies"] = kwargs.pop("proxy")
    orig_async_client_init(self, *args, **kwargs)
httpx.AsyncClient.__init__ = patched_async_client_init

from fastapi import HTTPException, Header, Request, Depends
from jose import jwt, JWTError
import os
from datetime import datetime, timedelta, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client, ClientOptions
from typing import Optional
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# routers.utils 는 이제 (1) 시간/설정/스토리지 전역 상태의 단일 소유자,
# (2) 인증 의존성(verify_token / get_current_user / limiter), (3) 하위 분리 모듈
# (_helpers / user_state / storage)의 re-export facade 역할만 한다.
#
# 순수 헬퍼는 _helpers.py, 유저 mutation 도메인은 user_state.py, 스토리지+동시성은
# storage.py 로 분리했다. 외부(라우터/테스트)는 계속 `from routers.utils import ...`
# 로 접근하며, 테스트가 몽키패치하는 스위치 전역(USE_SUPABASE / supabase / *_FILE /
# now_kst / limiter)은 반드시 이 모듈이 소유한다. storage.py 는 그 전역을
# `import routers.utils as _u` 로 call-time 역참조하므로 패치가 그대로 반영된다.
# ---------------------------------------------------------------------------

# 순수 leaf 헬퍼 re-export (routers._helpers)
from routers._helpers import (
    UserNotFoundError,
    UserSaveError,
    normalize_nickname,
    _merge_dicts,
    _attempt_log_context,
    LESSON_MODES,
    REVIEW_MODES,
    _DERIVED_USER_FIELDS,
    _strip_derived_fields,
    calc_level,
    CHARACTER_TO_STAGE,
    STAGE_TO_CHARACTER,
    character_for_stage,
)


def now_kst() -> datetime:
    return datetime.now(timezone(timedelta(hours=9)))

def today_kst() -> str:
    return now_kst().strftime("%Y-%m-%d")

def iso_week() -> str:
    return now_kst().strftime("%G-W%V")


def prev_iso_week() -> str:
    """직전(지난) ISO 주 문자열. 연/주 경계에서도 안전하게 -7일로 계산한다."""
    return (now_kst() - timedelta(days=7)).strftime("%G-W%V")


logger = logging.getLogger("uvicorn.error")

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))


def get_user_id_or_ip(request: Request) -> str:
    auth = request.headers.get("Authorization")
    if auth:
        try:
            return verify_token(auth)
        except Exception:
            pass  # 토큰 검증 실패는 정상 비로그인 요청으로 간주 — IP fallback
    return get_remote_address(request)

limiter = Limiter(key_func=get_user_id_or_ip)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise ValueError("SECRET_KEY environment variable is not set or is less than 32 characters long. Please set a strong SECRET_KEY.")

ALGORITHM = os.getenv("ALGORITHM", "HS256")

USE_SUPABASE = os.getenv("USE_SUPABASE", "false") == "true"

if USE_SUPABASE:
    # postgrest-py의 동기 클라이언트는 내부적으로 http2=True를 하드코딩한다.
    # HTTP/2는 커넥션 하나를 여러 요청이 멀티플렉싱해서 쓰는 방식인데, Windows에서
    # FastAPI가 이 동기 클라이언트를 스레드풀(threadpool)로 동시에 호출하면
    # 소켓 레벨에서 충돌해 WinError 10035(ReadError)가 발생한다.
    # http2=False로 HTTP/1.1 커넥션 풀을 쓰면 스레드 간 동시 접근이 안전해진다.
    supabase = create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_KEY", ""),
        options=ClientOptions(
            httpx_client=httpx.Client(http2=False, timeout=httpx.Timeout(10.0))
        )
    )
else:
    supabase = None

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data"))
USERS_FILE = os.path.join(DATA_DIR, "users.json")
PROGRESS_FILE = os.path.join(DATA_DIR, "progress.json")
WRONG_ANSWERS_FILE = os.path.join(DATA_DIR, "wrong_answers.json")
RESET_TOKENS_FILE = os.path.join(DATA_DIR, "reset_tokens.json")
EMAIL_VERIFICATION_CODES_FILE = os.path.join(DATA_DIR, "email_verification_codes.json")
# attempts.json 은 dev 폴백 전용. 운영은 USE_SUPABASE=true 로 attempts 테이블을 단일 진실로 쓴다.
ATTEMPTS_FILE = os.path.join(DATA_DIR, "attempts.json")
REFRESH_TOKENS_FILE = os.path.join(DATA_DIR, "refresh_tokens.json")


# ---------------------------------------------------------------------------
# 스토리지 + 동시성 계층 re-export (routers.storage)
# ---------------------------------------------------------------------------
# storage.py 는 위 스위치 전역을 `import routers.utils as _u` 로 call-time 역참조
# 하므로, 이 import 시점에 전역이 이미 정의돼 있어야(위) 안전하다. import 자체는
# storage 함수 본문을 실행하지 않으므로 순환은 발생하지 않는다.
from routers.storage import (  # noqa: E402
    file_lock,
    _load_json_locked,
    _save_json_locked,
    _cache_original_user,
    _user_read_state,
    load_users,
    get_user_by_id,
    get_user_by_username,
    get_user_by_username_any,
    get_user_by_nickname,
    get_user_by_email_any,
    get_user_by_email,
    restore_soft_deleted_user,
    delete_soft_deleted_user_by_username,
    purge_soft_deleted_users,
    save_users,
    save_user,
    _read_users_unlocked,
    _write_users_unlocked,
    _MAX_CAS_RETRIES,
    _mutate_user_atomic_json,
    _mutate_user_atomic_supabase,
    mutate_user_atomic,
    load_progress,
    get_progress_by_user,
    save_progress,
    save_progress_item,
    load_wrong_answers,
    get_wrong_answers_by_user,
    save_wrong_answers,
    save_wrong_answer_item,
    mark_wrong_answer_reviewed,
    _normalize_attempt_item_for_supabase,
    save_attempt_item,
    get_attempts_by_user,
    _latest_attempt_per_question,
    get_wrong_answers,
    get_unit_accuracy,
    load_reset_tokens,
    save_reset_tokens,
    load_email_verification_codes,
    save_email_verification_codes,
    load_refresh_tokens,
    save_refresh_token,
    delete_refresh_token,
    delete_user_refresh_tokens,
)


# ---------------------------------------------------------------------------
# 인증 의존성 (JWT) — 스토리지 read(get_user_by_id)에 의존하므로 storage re-export
# 이후에 정의한다.
# ---------------------------------------------------------------------------
def verify_token(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        token_ver = payload.get("ver")
        if token_ver is not None:
            user = get_user_by_id(user_id)
            if not user or user.get("token_version", 1) != token_ver:
                raise JWTError("Token version mismatched")
            if user.get("deleted_at"):
                raise JWTError("Account deleted")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


def get_current_user(authorization: str = Header(...)) -> dict:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="인증 실패")
        if user.get("deleted_at"):
            raise HTTPException(status_code=401, detail="탈퇴한 계정입니다.")
        token_ver = payload.get("ver")
        if token_ver is not None and user.get("token_version", 1) != token_ver:
            raise HTTPException(status_code=401, detail="토큰이 만료되었습니다. 다시 로그인해주세요.")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


def get_current_user_optional(authorization: str = Header(None)) -> Optional[dict]:
    if not authorization:
        return None
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        user = get_user_by_id(user_id)
        if not user or user.get("deleted_at"):
            return None
        token_ver = payload.get("ver")
        if token_ver is not None and user.get("token_version", 1) != token_ver:
            return None
        return user
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# 유저 상태(도메인) mutation re-export (routers.user_state)
# ---------------------------------------------------------------------------
# user_state 는 serialize_user/current_week_ranking_score 에서 이 모듈의
# iso_week / get_progress_by_user 를 call-time 역참조하므로, 그 이름들이 모두
# 정의된 뒤(파일 하단) import 해야 순환이 안전하다.
from routers.user_state import (  # noqa: E402
    COURSE_LEVEL_ORDER,
    NEXT_COURSE_LEVEL,
    derive_unlocked_course_levels,
    derive_course_level_from_endboss,
    course_level_floor,
    apply_level_test_placement,
    promote_course_level_from_endboss,
    get_evolution_stage,
    gp_gate,
    reward_field_defaults,
    ensure_reward_fields,
    GP_PER_LEVEL,
    calc_level_from_gp,
    recompute_level_from_gp,
    current_week_ranking_score,
    serialize_user,
    apply_xp,
    grant_reward,
)
