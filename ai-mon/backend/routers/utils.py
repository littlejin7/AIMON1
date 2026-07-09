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
import json
import os
import time
import tempfile
import contextvars
import copy
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client, ClientOptions
from typing import Optional
from dotenv import load_dotenv

# 순수 leaf 헬퍼는 _helpers.py 로 분리했다. 외부는 계속 routers.utils 에서
# import 하므로 여기서 그대로 re-export 한다. (아래 __all__ 및 명시 import 참고)
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


_user_read_state = contextvars.ContextVar("_user_read_state", default=None)

def _cache_original_user(user: dict | None) -> dict | None:
    if user:
        try:
            cache = _user_read_state.get()
        except LookupError:
            cache = {}
            _user_read_state.set(cache)
        if cache is None:
            cache = {}
            _user_read_state.set(cache)
        cache[user["id"]] = copy.deepcopy(user)
    return user

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


@contextmanager
def file_lock(file_path: str):
    """
    Cross-platform file locking context manager.
    Creates a lock file (e.g., file_path + ".lock") and locks it.
    """
    lock_path = file_path + ".lock"
    os.makedirs(os.path.dirname(lock_path), exist_ok=True)
    lock_file = open(lock_path, "w")
    try:
        if fcntl := globals().get("fcntl", None) or _import_fcntl():
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        elif msvcrt := globals().get("msvcrt", None) or _import_msvcrt():
            locked = False
            while not locked:
                try:
                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
                    locked = True
                except (IOError, PermissionError):
                    time.sleep(0.05)
        yield
    finally:
        try:
            if fcntl := globals().get("fcntl", None):
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            elif msvcrt := globals().get("msvcrt", None):
                lock_file.seek(0)
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
        except Exception:
            logger.warning("file_lock: 잠금 해제 실패 (무시)", exc_info=True)
        lock_file.close()


def _import_fcntl():
    try:
        import fcntl
        globals()["fcntl"] = fcntl
        return fcntl
    except ImportError:
        return None


def _import_msvcrt():
    try:
        import msvcrt
        globals()["msvcrt"] = msvcrt
        return msvcrt
    except ImportError:
        return None


def _load_json_locked(file_path: str, default_val):
    if not os.path.exists(file_path):
        return default_val
    with file_lock(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return default_val


def _save_json_locked(file_path: str, data):
    dir_name = os.path.dirname(file_path)
    os.makedirs(dir_name, exist_ok=True)
    with file_lock(file_path):
        temp_fd, temp_path = tempfile.mkstemp(dir=dir_name)
        try:
            with os.fdopen(temp_fd, "w", encoding="utf-8") as tmp:
                json.dump(data, tmp, ensure_ascii=False, indent=2)
            os.replace(temp_path, file_path)
        except Exception:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise


def load_users():
    if USE_SUPABASE:
        res = supabase.table("users").select("*").execute()
        return res.data
    return _load_json_locked(USERS_FILE, [])


def get_user_by_id(user_id: str) -> dict | None:
    if USE_SUPABASE:
        res = supabase.table("users").select("*").eq("id", user_id).execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next((u for u in users if u["id"] == user_id), None))


def get_user_by_username(username: str) -> dict | None:
    if USE_SUPABASE:
        res = supabase.table("users").select("*").eq("username", username).is_("deleted_at", "null").execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next(
        (u for u in users if u["username"] == username and not u.get("deleted_at")),
        None,
    ))


def get_user_by_username_any(username: str) -> dict | None:
    if USE_SUPABASE:
        res = supabase.table("users").select("*").eq("username", username).execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next((u for u in users if u["username"] == username), None))


def get_user_by_nickname(nickname: str | None, exclude_user_id: str | None = None) -> dict | None:
    nickname_key = normalize_nickname(nickname).casefold()
    if not nickname_key:
        return None

    users = load_users()
    return _cache_original_user(next(
        (
            u for u in users
            if not u.get("deleted_at")
            and (not exclude_user_id or u.get("id") != exclude_user_id)
            and normalize_nickname(u.get("nickname")).casefold() == nickname_key
        ),
        None,
    ))


def get_user_by_email_any(email: str) -> dict | None:
    if USE_SUPABASE:
        res = supabase.table("users").select("*").eq("email", email).execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next((u for u in users if u.get("email") == email), None))


def restore_soft_deleted_user(user_id: str, updater=None) -> dict:
    def mutator(u: dict) -> None:
        u.pop("deleted_at", None)
        u["token_version"] = u.get("token_version", 1) + 1
        if updater:
            updater(u)
        return None

    restored, _ = mutate_user_atomic(user_id, mutator)
    return restored


def delete_soft_deleted_user_by_username(username: str) -> None:
    if USE_SUPABASE:
        # Delete from users table (cascades to progress, wrong_answers, attempts, refresh_tokens)
        supabase.table("users").delete().eq("username", username).not_.is_("deleted_at", "null").execute()
    else:
        users = _read_users_unlocked()
        to_delete_ids = [u["id"] for u in users if u["username"] == username and u.get("deleted_at")]
        if not to_delete_ids:
            return
        
        new_users = [u for u in users if not (u["username"] == username and u.get("deleted_at"))]
        _write_users_unlocked(new_users)
        
        # Clean up progress
        if os.path.exists(PROGRESS_FILE):
            progress = _load_json_locked(PROGRESS_FILE, [])
            new_progress = [p for p in progress if p.get("user_id") not in to_delete_ids]
            _save_json_locked(PROGRESS_FILE, new_progress)
            
        # Clean up wrong answers
        if os.path.exists(WRONG_ANSWERS_FILE):
            wrong = _load_json_locked(WRONG_ANSWERS_FILE, [])
            new_wrong = [w for w in wrong if w.get("user_id") not in to_delete_ids]
            _save_json_locked(WRONG_ANSWERS_FILE, new_wrong)
            
        # Clean up attempts
        if os.path.exists(ATTEMPTS_FILE):
            attempts = _load_json_locked(ATTEMPTS_FILE, [])
            new_attempts = [a for a in attempts if a.get("user_id") not in to_delete_ids]
            _save_json_locked(ATTEMPTS_FILE, new_attempts)


def purge_soft_deleted_users(retention_days: int = 30, now: Optional[datetime] = None, dry_run: bool = False) -> dict:
    """Purge users soft-deleted longer than `retention_days`.

    Supabase path deletes rows from `users` and relies on FK cascade for related tables.
    JSON path deletes matching users and related local data files directly.
    """
    ref_now = now or now_kst()
    cutoff = ref_now - timedelta(days=retention_days)
    result = {
        "retention_days": retention_days,
        "cutoff": cutoff.isoformat(),
        "deleted_user_ids": [],
        "deleted_count": 0,
        "dry_run": dry_run,
    }

    if USE_SUPABASE:
        res = (
            supabase.table("users")
            .select("id")
            .not_.is_("deleted_at", "null")
            .lt("deleted_at", cutoff.isoformat())
            .execute()
        )
        rows = res.data or []
        user_ids = [row.get("id") for row in rows if row.get("id")]
        result["deleted_user_ids"] = user_ids
        result["deleted_count"] = len(user_ids)
        if dry_run or not user_ids:
            return result

        (
            supabase.table("users")
            .delete()
            .not_.is_("deleted_at", "null")
            .lt("deleted_at", cutoff.isoformat())
            .execute()
        )
        return result

    users = _read_users_unlocked()
    to_delete_ids = []
    kept_users = []
    for user in users:
        deleted_at = user.get("deleted_at")
        if not deleted_at:
            kept_users.append(user)
            continue
        try:
            deleted_dt = datetime.fromisoformat(str(deleted_at))
        except Exception:
            logger.warning("purge_soft_deleted_users: invalid deleted_at for user_id=%s", user.get("id"))
            kept_users.append(user)
            continue

        if deleted_dt <= cutoff:
            if user.get("id"):
                to_delete_ids.append(user["id"])
        else:
            kept_users.append(user)

    result["deleted_user_ids"] = to_delete_ids
    result["deleted_count"] = len(to_delete_ids)
    if dry_run or not to_delete_ids:
        return result

    _write_users_unlocked(kept_users)

    if os.path.exists(PROGRESS_FILE):
        progress = _load_json_locked(PROGRESS_FILE, [])
        _save_json_locked(PROGRESS_FILE, [p for p in progress if p.get("user_id") not in to_delete_ids])

    if os.path.exists(WRONG_ANSWERS_FILE):
        wrong = _load_json_locked(WRONG_ANSWERS_FILE, [])
        _save_json_locked(WRONG_ANSWERS_FILE, [w for w in wrong if w.get("user_id") not in to_delete_ids])

    if os.path.exists(ATTEMPTS_FILE):
        attempts = _load_json_locked(ATTEMPTS_FILE, [])
        _save_json_locked(ATTEMPTS_FILE, [a for a in attempts if a.get("user_id") not in to_delete_ids])

    if os.path.exists(REFRESH_TOKENS_FILE):
        tokens = _load_json_locked(REFRESH_TOKENS_FILE, [])
        _save_json_locked(REFRESH_TOKENS_FILE, [t for t in tokens if t.get("user_id") not in to_delete_ids])

    return result


def get_user_by_email(email: str) -> dict | None:
    if USE_SUPABASE:
        res = supabase.table("users").select("*").eq("email", email).is_("deleted_at", "null").execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next(
        (u for u in users if u.get("email") == email and not u.get("deleted_at")),
        None,
    ))


def save_users(users):
    if USE_SUPABASE:
        for user in users:
            save_user(user)
    else:
        _save_json_locked(USERS_FILE, users)


def save_user(user: dict):
    # 파생 카운터 영속화 차단(이중 안전망). SSOT 정책은 _strip_derived_fields 주석 참고.
    user.pop("boss_cleared", None)
    user.pop("completed_stages", None)
    user_id = user["id"]
    try:
        cache = _user_read_state.get()
        original = cache.get(user_id) if cache else None
    except LookupError:
        original = None

    if USE_SUPABASE:
        if original:
            numeric_cols = {
                "xp", "crowns", "lv", "streak", "daily_free_attempts", "ai_feedback_count",
                # 신규 재화/성장/랭킹 누적 카운터 — 동시 증가·차감이 delta 로 합산돼야 함.
                # (evolution_stage 는 스칼라 상태값이므로 numeric 아님 → other 로 전체 치환)
                "coin_balance", "total_coin_earned", "gp", "ranking_score", "weekly_ranking_score",
            }
            jsonb_cols = {"max_unlocked_unit", "completed_units", "awarded_crown_units", "earned_streak_milestones", "titles", "game_rewards", "seen_questions", "endboss_cleared_levels", "miniboss_cleared_stages", "unitboss_cleared_units", "battle_sessions"}
            
            numeric_deltas = {}
            jsonb_merges = {}
            other_updates = {}
            has_changes = False
            
            for k, v in user.items():
                if k == "id":
                    continue
                if k not in original:
                    has_changes = True
                    if k in numeric_cols:
                        numeric_deltas[k] = v
                    elif k in jsonb_cols:
                        jsonb_merges[k] = v
                    else:
                        other_updates[k] = v
                elif original[k] != v:
                    has_changes = True
                    if k in numeric_cols:
                        numeric_deltas[k] = v - original[k]
                    elif k in jsonb_cols:
                        if isinstance(v, dict) and isinstance(original[k], dict):
                            jsonb_merges[k] = v
                        else:
                            other_updates[k] = v
                    else:
                        other_updates[k] = v
                        
            for k in list(original.keys()):
                if k not in user:
                    has_changes = True
                    other_updates[k] = None
                    
            if has_changes:
                try:
                    supabase.rpc("update_user_atomic", {
                        "p_user_id": user_id,
                        "p_numeric_deltas": numeric_deltas,
                        "p_jsonb_merges": jsonb_merges,
                        "p_other_updates": other_updates
                    }).execute()
                except Exception:
                    # 무음 전체객체 upsert 폴백 금지: 카운터 보유 저장에서 lost update 유발.
                    # 조용히 덮어쓰는 대신 로깅 후 거부 신호를 올린다. (C-1)
                    logger.exception(
                        "save_user: update_user_atomic RPC failed for user %s; "
                        "refusing silent full-object upsert (lost-update risk)", user_id
                    )
                    raise UserSaveError(user_id)
        else:
            u_copy = user.copy()
            supabase.table("users").upsert(u_copy).execute()
    else:
        with file_lock(USERS_FILE):
            users = []
            if os.path.exists(USERS_FILE):
                try:
                    with open(USERS_FILE, "r", encoding="utf-8") as f:
                        users = json.load(f)
                except Exception:
                    users = []
            
            idx = next((i for i, u in enumerate(users) if u["id"] == user_id), None)
            if idx is not None:
                current_user = users[idx]
                if original:
                    for k, v in user.items():
                        if k not in original:
                            current_user[k] = copy.deepcopy(v)
                        elif original[k] != v:
                            if isinstance(v, (int, float)) and isinstance(original[k], (int, float)) and isinstance(current_user.get(k), (int, float)):
                                delta = v - original[k]
                                current_user[k] = current_user.get(k, 0) + delta
                            elif isinstance(v, dict) and isinstance(original[k], dict) and isinstance(current_user.get(k), dict):
                                current_user[k] = _merge_dicts(current_user.get(k, {}), original[k], v)
                            else:
                                current_user[k] = copy.deepcopy(v)
                    for k in list(original.keys()):
                        if k not in user:
                            current_user.pop(k, None)
                else:
                    current_user.update(user)
                users[idx] = current_user
            else:
                users.append(user)
            
            dir_name = os.path.dirname(USERS_FILE)
            os.makedirs(dir_name, exist_ok=True)
            temp_fd, temp_path = tempfile.mkstemp(dir=dir_name)
            try:
                with os.fdopen(temp_fd, "w", encoding="utf-8") as tmp:
                    json.dump(users, tmp, ensure_ascii=False, indent=2)
                os.replace(temp_path, USERS_FILE)
            except Exception:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                raise


# ---------------------------------------------------------------------------
# 표준 원자 쓰기 경로 (C-1)
# ---------------------------------------------------------------------------
# check-then-act(가드 검사 → 변경 → 저장)를 "저장과 같은 임계구역" 안으로 모은다.
# mutator 는 *영속 상태에서 새로 읽은* user 를 받아 그 자리에서 검사·변경하므로,
# nonce 일회성/일일 캡/미션 claimed·login_days·진척 append 같은 가드가 항상 최신
# 커밋 상태 기준으로 평가되어 동시 요청에서도 lost update / 이중 통과가 없다.
#
# 범용 시그니처: 특정 핸들러 전용이 아니라 apply_xp(청크 1)·미션(청크 2~3)이
# 모두 이 경로로 쓰도록 설계됨.
#
#   mutator(user: dict) -> result
#       user 를 제자리에서 변경하고 호출부에 돌려줄 result 를 반환.
#       어떤 예외든 raise 하면 write 없이 중단(no-op).
#   반환: (user, result)

_MAX_CAS_RETRIES = 5


def _read_users_unlocked() -> list:
    if not os.path.exists(USERS_FILE):
        return []
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _write_users_unlocked(users: list):
    dir_name = os.path.dirname(USERS_FILE)
    os.makedirs(dir_name, exist_ok=True)
    temp_fd, temp_path = tempfile.mkstemp(dir=dir_name)
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as tmp:
            json.dump(users, tmp, ensure_ascii=False, indent=2)
        os.replace(temp_path, USERS_FILE)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise


# 파생 카운터 SSOT 정책(boss_cleared / completed_stages) 및 _DERIVED_USER_FIELDS /
# _strip_derived_fields 는 routers._helpers 로 이동해 상단에서 re-export 한다.

COURSE_LEVEL_ORDER = ("beginner", "intermediate", "advanced")
NEXT_COURSE_LEVEL = {
    "beginner": "intermediate",
    "intermediate": "advanced",
}


def derive_unlocked_course_levels(user: dict) -> list[str]:
    """Return course levels unlocked by endboss / unit-boss clear history.

    언락 판정은 endboss_cleared_levels 와 unitboss_cleared_units 로만 결정한다.
    (progress 기반 확장 루프는 제거 — 언락 SSOT 를 보스 클리어 이력으로 단일화.)

    승격은 순차(sequential)다: 상위 레벨이 열리면 그 아래 레벨도 모두 열린 것으로
    간주해 항상 COURSE_LEVEL_ORDER 의 '연속 prefix' 를 반환한다. 따라서
    derive_course_level_from_endboss() 의 unlocked[-1] 이 중간 레벨을 건너뛰지 않는다.
    """
    cleared = user.get("endboss_cleared_levels")
    if not isinstance(cleared, list):
        cleared = []
    cleared_set = set(cleared)

    unlocked_set = {"beginner"}
    if "beginner" in cleared_set or "intermediate" in cleared_set:
        unlocked_set.add("intermediate")
    if "intermediate" in cleared_set or "advanced" in cleared_set:
        unlocked_set.add("advanced")

    for item in user.get("unitboss_cleared_units") or []:
        if not isinstance(item, str) or "-" not in item:
            continue
        level = item.split("-", 1)[0]
        if level in COURSE_LEVEL_ORDER:
            unlocked_set.add(level)

    # 순차 보장: 가장 높은 언락 레벨까지의 연속 prefix 로 채운다(건너뜀 방지).
    highest_idx = 0
    for i, level in enumerate(COURSE_LEVEL_ORDER):
        if level in unlocked_set:
            highest_idx = i
    return list(COURSE_LEVEL_ORDER[: highest_idx + 1])


def derive_course_level_from_endboss(user: dict) -> str:
    """Return the highest course level unlocked by cleared endboss records."""
    unlocked = derive_unlocked_course_levels(user)
    return unlocked[-1]


def course_level_floor(level: str) -> list[str]:
    """Return the sequential course prefix up to level."""
    idx = COURSE_LEVEL_ORDER.index(level) if level in COURSE_LEVEL_ORDER else 0
    return list(COURSE_LEVEL_ORDER[: idx + 1])


def apply_level_test_placement(user: dict, level: str) -> str:
    """Apply level-test placement and mark lower tiers as recognized clears.

    A user placed into intermediate/advanced should not see the tiers below that
    placement as locked. We record only lower tiers as cleared; the placed tier
    itself remains the current learning target.
    """
    level = level if level in COURSE_LEVEL_ORDER else "beginner"
    user["course_level"] = level
    user["is_level_tested"] = True

    lower_levels = course_level_floor(level)[:-1]

    cleared = user.get("endboss_cleared_levels")
    if not isinstance(cleared, list):
        cleared = []
    for lower in lower_levels:
        if lower not in cleared:
            cleared.append(lower)
    user["endboss_cleared_levels"] = cleared

    max_unlocked = user.get("max_unlocked_unit")
    if not isinstance(max_unlocked, dict):
        old_val = max_unlocked if isinstance(max_unlocked, int) else 1
        max_unlocked = {"beginner": old_val, "intermediate": 1, "advanced": 1}
    for lv in COURSE_LEVEL_ORDER:
        max_unlocked.setdefault(lv, 1)
    for lower in lower_levels:
        max_unlocked[lower] = max(max_unlocked.get(lower, 1), 9)
    user["max_unlocked_unit"] = max_unlocked

    completed_units = user.get("completed_units")
    if not isinstance(completed_units, dict):
        old_val = completed_units if isinstance(completed_units, int) else 0
        completed_units = {"beginner": old_val, "intermediate": 0, "advanced": 0}
    for lv in COURSE_LEVEL_ORDER:
        completed_units.setdefault(lv, 0)
    for lower in lower_levels:
        completed_units[lower] = max(completed_units.get(lower, 0), 8)
    user["completed_units"] = completed_units

    return level



def promote_course_level_from_endboss(user: dict) -> bool:
    """Mutate user.course_level when endboss clear history unlocks the next level.

    단조 승급만 허용한다(강등 금지). 레벨테스트로 course_level 이 이미 앞서 있는
    유저가 target_level 로 하위 엔드보스를 클리어해도, 그 하위 레벨의 derive 결과가
    현재보다 낮으면 course_level 을 내리지 않는다.
    """
    current = user.get("course_level", "beginner")
    promoted = derive_course_level_from_endboss(user)
    current_idx = COURSE_LEVEL_ORDER.index(current) if current in COURSE_LEVEL_ORDER else 0
    promoted_idx = COURSE_LEVEL_ORDER.index(promoted) if promoted in COURSE_LEVEL_ORDER else 0
    if promoted_idx > current_idx:
        user["course_level"] = promoted
        return True
    return False


def _mutate_user_atomic_json(user_id: str, mutator):
    # 단일 프로세스: file_lock 한 임계구역 안에서 재읽기→검사·변경→원자적 write.
    with file_lock(USERS_FILE):
        users = _read_users_unlocked()
        idx = next((i for i, u in enumerate(users) if u.get("id") == user_id), None)
        if idx is None:
            raise UserNotFoundError(user_id)
        user = users[idx]
        result = mutator(user)            # 예외 발생 시 아래 write 도달 못함 → no-op
        _strip_derived_fields(user)       # SSOT: 파생 카운터 영속화 차단
        users[idx] = user
        _write_users_unlocked(users)
        return user, result


def _mutate_user_atomic_supabase(user_id: str, mutator):
    # 다중 프로세스: 앱 단 락 불가 → version 기반 낙관적 동시성(CAS) + 재시도.
    # 매 시도마다 fresh 재읽기 후 mutator 재평가 → 가드가 항상 최신 상태 기준.
    for _ in range(_MAX_CAS_RETRIES):
        res = supabase.table("users").select("*").eq("id", user_id).execute()
        if not res.data:
            raise UserNotFoundError(user_id)
        user = res.data[0]
        version = user.get("version", 0) or 0
        result = mutator(user)            # 예외 발생 시 update 도달 못함 → no-op
        _strip_derived_fields(user)       # SSOT: 파생 카운터 영속화 차단(+컬럼 부재 500 방지)
        update_obj = {k: v for k, v in user.items() if k != "id"}
        update_obj["version"] = version + 1
        upd = (
            supabase.table("users")
            .update(update_obj)
            .eq("id", user_id)
            .eq("version", version)       # 가드: 우리가 읽은 버전 그대로일 때만 커밋
            .execute()
        )
        if upd.data:                      # 1행 갱신 → 성공
            return user, result
        # version 이 사이에 변경됨 → fresh 재읽기 후 mutator 재실행
    logger.error("mutate_user_atomic: max CAS retries exceeded for user %s", user_id)
    raise UserSaveError(f"write conflict for user {user_id}")


def mutate_user_atomic(user_id: str, mutator):
    """가드 검사·변경·저장을 한 임계구역에서 수행하는 표준 원자 쓰기 경로. 위 모듈 주석 참고."""
    if USE_SUPABASE:
        return _mutate_user_atomic_supabase(user_id, mutator)
    return _mutate_user_atomic_json(user_id, mutator)


def load_progress():
    if USE_SUPABASE:
        res = supabase.table("progress").select("*").execute()
        return res.data
    return _load_json_locked(PROGRESS_FILE, [])


def get_progress_by_user(user_id: str, course_level: str = None) -> list:
    if USE_SUPABASE:
        q = supabase.table("progress").select("*").eq("user_id", user_id)
        if course_level:
            q = q.eq("course_level", course_level)
        res = q.execute()
        return res.data
    progress = load_progress()
    return [
        p for p in progress 
        if p.get("user_id") == user_id 
        and (course_level is None or p.get("course_level", "beginner") == course_level)
    ]


def save_progress(progress):
    if USE_SUPABASE:
        for p in progress:
            save_progress_item(p)
    else:
        _save_json_locked(PROGRESS_FILE, progress)


def save_progress_item(item: dict):
    if USE_SUPABASE:
        supabase.table("progress").upsert(item).execute()
    else:
        progress = load_progress()
        idx = next((i for i, p in enumerate(progress) if p.get("id") == item.get("id")), None)
        if idx is not None:
            progress[idx] = item
        else:
            progress.append(item)
        _save_json_locked(PROGRESS_FILE, progress)


def load_wrong_answers():
    if USE_SUPABASE:
        res = supabase.table("wrong_answers").select("*").execute()
        return res.data
    return _load_json_locked(WRONG_ANSWERS_FILE, [])


def get_wrong_answers_by_user(user_id: str) -> list:
    if USE_SUPABASE:
        res = supabase.table("wrong_answers").select("*").eq("user_id", user_id).execute()
        return res.data
    wrong = load_wrong_answers()
    return [wa for wa in wrong if wa.get("user_id") == user_id]


def save_wrong_answers(data):
    if USE_SUPABASE:
        for item in data:
            save_wrong_answer_item(item)
    else:
        _save_json_locked(WRONG_ANSWERS_FILE, data)


def save_wrong_answer_item(item: dict):
    if USE_SUPABASE:
        supabase.table("wrong_answers").upsert(item).execute()
    else:
        wrong = load_wrong_answers()
        idx = next((i for i, wa in enumerate(wrong) if wa.get("id") == item.get("id")), None)
        if idx is not None:
            wrong[idx] = item
        else:
            wrong.append(item)
        _save_json_locked(WRONG_ANSWERS_FILE, wrong)


# ── Attempts (풀이 전수 기록) ──────────────────────────────────────────────
# 정오답 무관·AI 피드백과 독립적으로 채점 순간마다 1건 append (retry 포함 전수).
# 운영은 Supabase attempts 테이블이 단일 진실. JSON 분기는 dev 폴백 전용이다.
def _normalize_attempt_item_for_supabase(item: dict) -> dict | None:
    normalized = item.copy()
    user_id = normalized.get("user_id")
    if user_id is None:
        return normalized
    try:
        normalized["user_id"] = str(uuid.UUID(str(user_id)))
    except (TypeError, ValueError, AttributeError):
        logger.warning(
            "save_attempt_item: skipping Supabase attempts write because user_id is not a valid uuid; item=%s",
            _attempt_log_context(normalized),
        )
        return None
    return normalized


def save_attempt_item(item: dict):
    if USE_SUPABASE:
        # id 가 매 호출 새 uuid 라 upsert 는 사실상 insert (append-only). 기존
        # save_wrong_answer_item 과 동일 패턴으로 맞춘다.
        item = _normalize_attempt_item_for_supabase(item)
        if item is None:
            return False
        try:
            supabase.table("attempts").upsert(item).execute()
            return True
        except Exception:
            logger.exception(
                "save_attempt_item: Supabase attempts upsert failed; item=%s",
                _attempt_log_context(item),
            )
            return False
    else:
        # dev 전용 폴백
        attempts = _load_json_locked(ATTEMPTS_FILE, [])
        attempts.append(item)
        _save_json_locked(ATTEMPTS_FILE, attempts)
        return True


def get_attempts_by_user(user_id: str) -> list:
    if USE_SUPABASE:
        res = supabase.table("attempts").select("*").eq("user_id", user_id).execute()
        return res.data
    attempts = _load_json_locked(ATTEMPTS_FILE, [])  # dev 전용
    return [a for a in attempts if a.get("user_id") == user_id]


def _latest_attempt_per_question(user_id: str, course_level: str = None, unit: int = None) -> dict:
    """유저 attempts 를 question_id 별 '최신 1건'으로 접는다 (answered_at 기준).

    get_unit_accuracy 의 공통 베이스. retry 로 여러 번 풀어도
    question_id 당 가장 최근 결과만 반영한다.
    """
    latest: dict = {}
    for a in get_attempts_by_user(user_id):
        if course_level is not None and a.get("level") != course_level:
            continue
        if unit is not None and a.get("unit") != unit:
            continue
        qid = a.get("question_id")
        if not qid:
            continue
        cur = latest.get(qid)
        if cur is None or str(a.get("answered_at") or "") > str(cur.get("answered_at") or ""):
            latest[qid] = a
    return latest


def get_wrong_answers(user_id: str, course_level: str = None, unit: int = None) -> list:
    """오답복습 대상 question_id 목록.

    '최신 시도가 오답'(latest-wins) 방식은 쓰지 않는다. 레슨은 QuizCard '다시 풀기'로
    재시도→정답이 가능하고 보통 맞혀야 통과하므로, 같은 qid에 늦게 기록된 정답이
    오답을 덮어 "레슨에서 틀렸는데 오답복습에 안 뜨는" 증상이 생긴다.

    대신 발생/해소를 분리한다:
      - wrong_ids   : 레슨모드(quiz/miniboss)에서 오답 시도가 1건 이상 있는 qid
      - cleared_ids : 복습모드(train/random/boss_rush)에서 정답 시도가 1건 이상 있는 qid
      - 반환        : wrong_ids - cleared_ids
    → 레슨 재시도 정답으로는 사라지지 않고, 오답복습에서 정답 처리해야만 빠진다.
    course_level/unit 필터는 attempt.level / attempt.unit 으로 기존과 동일하게 적용.
    """
    wrong_ids: set = set()
    cleared_ids: set = set()
    for a in get_attempts_by_user(user_id):
        if course_level is not None and a.get("level") != course_level:
            continue
        if unit is not None and a.get("unit") != unit:
            continue
        qid = a.get("question_id")
        if not qid:
            continue
        mode = a.get("mode")
        if mode in LESSON_MODES and not a.get("is_correct"):
            wrong_ids.add(qid)
        elif mode in REVIEW_MODES and a.get("is_correct"):
            cleared_ids.add(qid)
    return list(wrong_ids - cleared_ids)


def get_unit_accuracy(user_id: str, course_level: str = None) -> list:
    """유닛별 정답률 = (최신 attempt 가 정답인 문제 수) / (시도한 distinct 문제 수)."""
    latest = _latest_attempt_per_question(user_id, course_level)
    by_unit: dict = {}
    for a in latest.values():
        unit = a.get("unit")
        if unit is None:
            continue
        agg = by_unit.setdefault(unit, {"correct": 0, "total": 0})
        agg["total"] += 1
        if a.get("is_correct"):
            agg["correct"] += 1
    result = []
    for unit in sorted(by_unit):
        agg = by_unit[unit]
        pct = round(agg["correct"] / agg["total"] * 100) if agg["total"] else 0
        result.append({"unit": unit, "correct": agg["correct"], "total": agg["total"], "pct": pct})
    return result


def load_reset_tokens():
    if USE_SUPABASE:
        res = supabase.table("reset_tokens").select("*").execute()
        tokens_dict = {}
        for item in res.data:
            tokens_dict[item["email"]] = {
                "token": item["token"],
                "expires_at": item["expires_at"],
                "failed_attempts": item.get("failed_attempts", 0),
                "send_date": item.get("send_date"),
                "send_count_today": item.get("send_count_today", 0),
                "last_sent": item.get("last_sent"),
            }
        return tokens_dict
    return _load_json_locked(RESET_TOKENS_FILE, {})


def save_reset_tokens(data):
    if USE_SUPABASE:
        db_tokens = supabase.table("reset_tokens").select("email").execute().data
        db_emails = {t["email"] for t in db_tokens}

        emails_to_delete = db_emails - set(data.keys())
        if emails_to_delete:
            supabase.table("reset_tokens").delete().in_("email", list(emails_to_delete)).execute()

        for email, token_info in data.items():
            supabase.table("reset_tokens").upsert({
                "email": email,
                "token": token_info["token"],
                "expires_at": token_info["expires_at"],
                # 실패 횟수·발송 스로틀 상태도 Supabase에 영속화 (Supabase 경로 failed_attempts 버그 수정)
                "failed_attempts": token_info.get("failed_attempts", 0),
                "send_date": token_info.get("send_date"),
                "send_count_today": token_info.get("send_count_today", 0),
                "last_sent": token_info.get("last_sent"),
            }).execute()
    else:
        _save_json_locked(RESET_TOKENS_FILE, data)


def load_email_verification_codes():
    if USE_SUPABASE:
        res = supabase.table("email_verification_codes").select("*").execute()
        records = {}
        for item in res.data:
            records[f"{item['email']}:{item['purpose']}"] = {
                "email": item["email"],
                "purpose": item["purpose"],
                "code_hash": item["code_hash"],
                "expires_at": item["expires_at"],
                "attempts": item.get("attempts", 0),
                "verified": item.get("verified", False),
                "last_sent": item.get("last_sent"),
                "verified_at": item.get("verified_at"),
            }
        return records
    return _load_json_locked(EMAIL_VERIFICATION_CODES_FILE, {})


def save_email_verification_codes(data):
    if USE_SUPABASE:
        db_rows = supabase.table("email_verification_codes").select("email,purpose").execute().data
        db_keys = {f"{row['email']}:{row['purpose']}" for row in db_rows}
        keys_to_delete = db_keys - set(data.keys())
        for key in keys_to_delete:
            email, purpose = key.rsplit(":", 1)
            (
                supabase.table("email_verification_codes")
                .delete()
                .eq("email", email)
                .eq("purpose", purpose)
                .execute()
            )

        for record in data.values():
            supabase.table("email_verification_codes").upsert({
                "email": record["email"],
                "purpose": record["purpose"],
                "code_hash": record["code_hash"],
                "expires_at": record["expires_at"],
                "attempts": record.get("attempts", 0),
                "verified": record.get("verified", False),
                "last_sent": record.get("last_sent"),
                "verified_at": record.get("verified_at"),
            }).execute()
    else:
        _save_json_locked(EMAIL_VERIFICATION_CODES_FILE, data)


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


def current_week_ranking_score(user: dict) -> int:
    """현재 ISO 주의 게임 랭킹 점수 합. 게임별 주간 맵(game_rewards["weekly_ranking"])
    에서 계산한다. 주가 바뀌면 해당 주 키가 없어 0 이 되므로 자동으로 주간 리셋된다.
    (상위 스칼라 weekly_ranking_score 는 저장하지 않고 이 파생값을 응답에 노출한다.)
    """
    gr = user.get("game_rewards")
    if not isinstance(gr, dict):
        return 0
    weekly = gr.get("weekly_ranking")
    if not isinstance(weekly, dict):
        return 0
    wkmap = weekly.get(iso_week())
    if not isinstance(wkmap, dict):
        return 0
    total = 0
    for v in wkmap.values():
        if isinstance(v, (int, float)) and v > 0:
            total += int(v)
    return total


def serialize_user(user: dict) -> dict:
    # 1. Make a copy of user
    res = user.copy()
    
    # 2. Get current course level
    course_level = res.get("course_level", "beginner")
    if course_level not in COURSE_LEVEL_ORDER:
        course_level = "beginner"
    res["course_level"] = course_level
    unlocked_levels = set(derive_unlocked_course_levels(res))
    unlocked_levels.update(course_level_floor(course_level))
    res["unlocked_course_levels"] = [
        level for level in COURSE_LEVEL_ORDER if level in unlocked_levels
    ]

    cleared_levels = res.get("endboss_cleared_levels")
    if not isinstance(cleared_levels, list):
        cleared_levels = []
    lower_clears = course_level_floor(course_level)[:-1]
    res["endboss_cleared_levels"] = [
        level for level in COURSE_LEVEL_ORDER
        if level in set(cleared_levels).union(lower_clears)
    ]

    # 3. Handle awarded_crown_units
    raw_crowns = res.get("awarded_crown_units") or []
    filtered_crowns = []
    for item in raw_crowns:
        if isinstance(item, int):
            if course_level == "beginner":
                filtered_crowns.append(item)
        elif isinstance(item, str):
            if "-" in item:
                level, unit_str = item.split("-", 1)
                if level == course_level:
                    try:
                        filtered_crowns.append(int(unit_str))
                    except ValueError:
                        pass  # "level-NaN" 같은 비정수 unit_str — 왕관 목록에서 제외
    res["awarded_crown_units"] = filtered_crowns
    
    # 4. Handle max_unlocked_unit
    raw_max = res.get("max_unlocked_unit") or 1
    if isinstance(raw_max, dict):
        res["max_unlocked_unit"] = raw_max.get(course_level, 1)
    else:
        if course_level == "beginner":
            res["max_unlocked_unit"] = raw_max
        else:
            res["max_unlocked_unit"] = 1
            
    # 5. Handle completed_units
    raw_completed = res.get("completed_units") or 0
    if isinstance(raw_completed, dict):
        res["completed_units"] = raw_completed.get(course_level, 0)
    else:
        if course_level == "beginner":
            res["completed_units"] = raw_completed
        else:
            res["completed_units"] = 0
            
    # 6. boss_cleared, completed_stages 기본값 0 보장 및 progress.json 기반 동적 보정
    uid = res.get("id")
    db_completed_stages = 0
    db_boss_cleared = 0
    if uid:
        try:
            progress_list = get_progress_by_user(uid, course_level)
            user_stages = [
                p for p in progress_list
                if p.get("is_completed") is True
            ]
            db_completed_stages = len(user_stages)
            db_boss_cleared = sum(1 for p in user_stages if "boss" in str(p.get("stage", "")))
            
            # endboss 클리어 레벨이 있으면 추가
            cleared_levels = res.get("endboss_cleared_levels") or []
            if course_level in cleared_levels:
                db_boss_cleared += 1
        except Exception as e:
            logger.exception(f"Failed to calculate progress in serialize_user for user {uid}: {str(e)}")

    res["boss_cleared"] = db_boss_cleared
    res["completed_stages"] = db_completed_stages

    # 기본값 보장 (dark는 항상 무료 보유)
    pt = res.get("purchased_themes") or []
    if "dark" not in pt:
        pt = ["dark"] + pt
    res["purchased_themes"] = pt

    # 신규 재화/성장 필드 런타임 기본값 (purchased_themes 와 동일 패턴).
    # 기존 값은 보존하고 없을 때만 채운다. xp/crowns 는 건드리지 않는다.
    ensure_reward_fields(res)
    # weekly_ranking_score 는 저장 스칼라 대신 게임 주간 맵에서 파생(자동 주간 리셋).
    res["weekly_ranking_score"] = current_week_ranking_score(res)

    res.pop("password", None)
    res.pop("deleted_at", None)
    return res


def get_evolution_stage(user: dict) -> int:
    """유저의 진화 단계(0~3)를 반환한다.

    evolution_stage 필드가 있으면 그 값을, 없으면(레거시 유저) 기존 character
    로부터 산출한다. 실제 DB backfill 은 3단계에서 수행하며, 그 전까지는 런타임
    파생으로 호환한다.
    """
    stage = user.get("evolution_stage")
    if isinstance(stage, int) and not isinstance(stage, bool):
        return max(0, min(3, stage))
    return CHARACTER_TO_STAGE.get(user.get("character") or "slime", 0)


def gp_gate(user: dict, gp_delta: int) -> int:
    """GP 게이트: 3차 진화(evolution_stage>=3) 전에는 GP 가 절대 발생하지 않는다.

    `if evolution_stage < 3: gp_delta = 0`. 보상 계산부(게임/스테이지/보스)가
    공통으로 재사용한다. 보스 클리어 자체는 gp_delta 0 이 기본이다.
    """
    return int(gp_delta) if get_evolution_stage(user) >= 3 else 0


# 신규 재화/성장/랭킹 필드의 코드상 기본값(누적 카운터류). purchased_themes 와
# 동일하게 serialize_user 에서 런타임 기본값으로 주입한다. 실제 DB backfill
# (및 legacy_xp_snapshot 스냅샷)은 3단계에서 수행한다.
def reward_field_defaults() -> dict:
    return {
        "coin_balance": 0,
        "total_coin_earned": 0,
        "gp": 0,
        "ranking_score": 0,
        "weekly_ranking_score": 0,
    }


def ensure_reward_fields(user: dict) -> dict:
    """유저 dict 에 신규 재화/성장 필드가 없으면 기본값을 채운다(제자리 변경).

    - 누적 카운터(coin_balance 등): reward_field_defaults() 기본값.
    - evolution_stage: 없으면 character 로부터 파생한 값으로 채운다.
    기존 값이 있으면 절대 덮어쓰지 않는다. xp/crowns 는 건드리지 않는다.
    """
    for k, v in reward_field_defaults().items():
        if user.get(k) is None:
            user[k] = v
    ev = user.get("evolution_stage")
    if not isinstance(ev, int) or isinstance(ev, bool):
        user["evolution_stage"] = get_evolution_stage(user)
    return user


# ── GP → 레벨 곡선 (임시 밸런스) ──────────────────────────────────────────────
# lv 는 3차 진화(evolution_stage>=3) 이후에만 의미를 갖는다. 그 전에는 신규
# 레벨업이 없고 기존 lv 값은 동결된다(레거시 xp 로 lv 를 올리지 않는다). 3차 진화
# 후 lv 는 gp 누적으로만 오른다. [임시 밸런스] 아래 상수만 조정하면 커브가 바뀐다.
GP_PER_LEVEL = 1000   # [임시 밸런스] 레벨당 필요 GP (선형). 추후 커브 교체 가능.


def calc_level_from_gp(gp: int) -> int:
    """3차 진화 후 gp 누적으로 얻는 '추가 레벨 수'.
    [임시 밸런스] 선형 — GP_PER_LEVEL 마다 +1."""
    return max(0, int(gp or 0)) // GP_PER_LEVEL


def recompute_level_from_gp(user: dict) -> None:
    """레벨 재계산(제자리). 정책:
    - evolution_stage < 3: 신규 레벨업 없음 → lv 동결(변경하지 않음).
    - evolution_stage >= 3: 진화 시점 lv 를 gp_level_base 로 1회 캡처하고,
      lv = max(현재 lv, gp_level_base + calc_level_from_gp(gp)). gp 로만 증가.
    lv 는 절대 감소하지 않는다.
    """
    if get_evolution_stage(user) < 3:
        return
    base = user.get("gp_level_base")
    if not isinstance(base, int) or isinstance(base, bool):
        base = user.get("lv") or 1
        user["gp_level_base"] = base
    target = base + calc_level_from_gp(user.get("gp") or 0)
    user["lv"] = max(user.get("lv") or 1, target)


REFRESH_TOKENS_FILE = os.path.join(DATA_DIR, "refresh_tokens.json")


def load_refresh_tokens():
    if USE_SUPABASE:
        res = supabase.table("refresh_tokens").select("*").execute()
        return res.data
    return _load_json_locked(REFRESH_TOKENS_FILE, [])


def save_refresh_token(item: dict):
    if USE_SUPABASE:
        supabase.table("refresh_tokens").upsert(item).execute()
    else:
        tokens = load_refresh_tokens()
        idx = next((i for i, t in enumerate(tokens) if t.get("id") == item.get("id") or t.get("token") == item.get("token")), None)
        if idx is not None:
            tokens[idx] = item
        else:
            tokens.append(item)
        _save_json_locked(REFRESH_TOKENS_FILE, tokens)


def delete_refresh_token(token: str):
    if USE_SUPABASE:
        supabase.table("refresh_tokens").delete().eq("token", token).execute()
    else:
        tokens = load_refresh_tokens()
        tokens = [t for t in tokens if t.get("token") != token]
        _save_json_locked(REFRESH_TOKENS_FILE, tokens)


def delete_user_refresh_tokens(user_id: str):
    if USE_SUPABASE:
        supabase.table("refresh_tokens").delete().eq("user_id", user_id).execute()
    else:
        tokens = load_refresh_tokens()
        tokens = [t for t in tokens if t.get("user_id") != user_id]
        _save_json_locked(REFRESH_TOKENS_FILE, tokens)


def apply_xp(user: dict, xp_gain: int, context: dict = None, event_type: str = None) -> dict:
    """
    Apply XP, recalculate level, and check/award titles.
    Returns dictionary describing the events.

    진화(evolution)는 더 이상 여기서 처리하지 않는다 — 진화는 엔드보스 클리어에서
    evolution_stage 를 올릴 때만 발생한다. 반환 dict 의 "evolved" 는 계약 유지를
    위해 항상 None 이다.

    순수 in-place 변경 함수: user 를 그 자리에서만 갱신하고 저장은 호출부 책임
    (save_user 또는 mutate_user_atomic). 내부에서 save 를 호출하지 않으므로
    mutate_user_atomic 의 mutator 안에서도 그대로 재사용된다.

    event_type 이 주어지면 미션 진척 훅(bump_mission)을 함께 굴린다. (XP 발생 지점
    = 미션 이벤트 지점) 출석(login)은 XP 가 없고 day_key 가 필요하므로 호출부에서
    bump_mission 을 직접 호출한다.
    """
    old_xp = user.get("xp") or 0
    old_lv = user.get("lv") or 1

    # 1. Apply XP (레거시 누적만 — 신규 지급은 grant_reward 로 이관되어 대부분 0).
    user["xp"] = old_xp + xp_gain

    # 2. 레벨은 더 이상 xp 로 올리지 않는다(레벨 소스 전환).
    #    - evolution_stage < 3: 신규 레벨업 없음(기존 lv 동결).
    #    - evolution_stage >= 3: gp 누적으로만 lv 상승(grant_reward 가 gp 변경 시
    #      recompute_level_from_gp 로 처리). 여기서는 lv 를 건드리지 않는다.
    level_up = (user.get("lv") or 1) > old_lv

    # 3. 진화는 여기서 발생하지 않는다.
    #    정책: 진화 트리거는 엔드보스 클리어(routers/endboss.py 의 evolution_stage
    #    증가)뿐이다. character 는 evolution_stage 에서 파생된다. evolved 는 호출부
    #    응답 계약 유지를 위해 항상 None.
    evolved = None

    # 4. Award titles
    from routers.titles import check_and_award_titles
    newly_earned_titles = check_and_award_titles(user, context or {})

    # 5. Mission progress hook (청크 1: bump_mission 은 정의 없으면 no-op)
    if event_type:
        try:
            from routers.missions_core import bump_mission  # 함수 내부 import 로 순환 import 회피
            bump_mission(user, event_type)
        except Exception:
            # 미션 진척 실패가 XP/보상 처리를 깨지 않도록 격리(무음 아님, 로깅).
            logger.exception("bump_mission failed for event_type=%s", event_type)

    return {
        "xp_gained": xp_gain,
        "old_xp": old_xp,
        "new_xp": user["xp"],
        "level_up": level_up,
        "old_lv": old_lv,
        "new_lv": user.get("lv") or 1,
        "evolved": evolved,
        "newly_earned_titles": newly_earned_titles
    }


def grant_reward(user: dict, *, coin_delta: int = 0, ranking_score_delta: int = 0,
                 gp_delta: int = 0, context: dict = None, event_type: str = None) -> dict:
    """이벤트 보상을 coin / ranking_score / gp 로 분리 적용한다(제자리 변경, 저장은
    호출부 책임 — apply_xp 와 동일하게 mutate_user_atomic 안에서 재사용 가능).

    - coin_balance / total_coin_earned += coin_delta
    - ranking_score(누적, 리더보드 소스) += ranking_score_delta
    - gp += gp_gate(user, gp_delta)  → 3차 진화(evolution_stage>=3) 에서만 실제 지급
    - recompute_level_from_gp(user)  → 3차 후 gp 로만 lv 상승
    - apply_xp(user, 0, context, event_type) 로 칭호·미션 훅을 그대로 재사용(신규 xp 0)

    weekly_ranking_score 는 상위 스칼라로 저장하지 않고, 게임 주간 랭킹은 게임별
    주간 맵(game_rewards)으로, user_state 표시는 serialize_user 파생으로 처리한다.

    반환: {"coin_delta", "gp_delta"(실적용), "ranking_score_delta", "level_up", "events"}.
    """
    ensure_reward_fields(user)
    coin_delta = max(0, int(coin_delta or 0))
    ranking_score_delta = max(0, int(ranking_score_delta or 0))
    applied_gp = gp_gate(user, gp_delta)

    lv_before = user.get("lv") or 1
    if coin_delta:
        user["coin_balance"] = (user.get("coin_balance") or 0) + coin_delta
        user["total_coin_earned"] = (user.get("total_coin_earned") or 0) + coin_delta
    if ranking_score_delta:
        user["ranking_score"] = (user.get("ranking_score") or 0) + ranking_score_delta
    if applied_gp:
        user["gp"] = (user.get("gp") or 0) + applied_gp
    recompute_level_from_gp(user)

    events = apply_xp(user, 0, context, event_type=event_type)
    return {
        "coin_delta": coin_delta,
        "gp_delta": applied_gp,
        "ranking_score_delta": ranking_score_delta,
        "level_up": (user.get("lv") or 1) > lv_before,
        "events": events,
    }

