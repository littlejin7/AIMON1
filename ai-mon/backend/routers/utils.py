import logging
from fastapi import HTTPException, Header, Request, Depends
from jose import jwt, JWTError
import json
import os
import time
import tempfile
import contextvars
import copy
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client
from typing import Optional
from dotenv import load_dotenv

def now_kst() -> datetime:
    return datetime.now(timezone(timedelta(hours=9)))

def today_kst() -> str:
    return now_kst().strftime("%Y-%m-%d")

def iso_week() -> str:
    return now_kst().strftime("%G-W%V")


logger = logging.getLogger("uvicorn.error")


class UserNotFoundError(Exception):
    """mutate_user_atomic: 대상 유저가 존재하지 않음."""
    pass


class UserSaveError(Exception):
    """저장이 '조용한 덮어쓰기' 없이는 완료될 수 없음(lost-update 위험). 호출부로 거부 신호."""
    pass


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
    supabase = create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_KEY", "")
    )
else:
    supabase = None

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data"))
USERS_FILE = os.path.join(DATA_DIR, "users.json")
PROGRESS_FILE = os.path.join(DATA_DIR, "progress.json")
WRONG_ANSWERS_FILE = os.path.join(DATA_DIR, "wrong_answers.json")
RESET_TOKENS_FILE = os.path.join(DATA_DIR, "reset_tokens.json")
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
        res = supabase.table("users").select("*").eq("username", username).execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next((u for u in users if u["username"] == username), None))


def get_user_by_email(email: str) -> dict | None:
    if USE_SUPABASE:
        res = supabase.table("users").select("*").eq("email", email).execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next((u for u in users if u.get("email") == email), None))


def save_users(users):
    if USE_SUPABASE:
        for user in users:
            save_user(user)
    else:
        _save_json_locked(USERS_FILE, users)


def _merge_dicts(current: dict, original: dict, modified: dict) -> dict:
    res = copy.deepcopy(current)
    for k, v in modified.items():
        if k not in original:
            res[k] = copy.deepcopy(v)
        elif original[k] != v:
            if isinstance(v, (int, float)) and isinstance(original[k], (int, float)) and isinstance(current.get(k), (int, float)):
                delta = v - original[k]
                res[k] = current.get(k, 0) + delta
            elif isinstance(v, dict) and isinstance(original[k], dict) and isinstance(current.get(k), dict):
                res[k] = _merge_dicts(current.get(k, {}), original[k], v)
            else:
                res[k] = copy.deepcopy(v)
    for k in list(original.keys()):
        if k not in modified:
            res.pop(k, None)
    return res


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
            numeric_cols = {"xp", "crowns", "lv", "streak", "daily_free_attempts", "ai_feedback_count"}
            jsonb_cols = {"max_unlocked_unit", "completed_units", "awarded_crown_units", "earned_streak_milestones", "titles", "game_rewards", "seen_questions", "endboss_cleared_levels", "miniboss_cleared_stages", "unitboss_cleared_units"}
            
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


# ---------------------------------------------------------------------------
# 파생 카운터 SSOT 정책 (boss_cleared / completed_stages)
# ---------------------------------------------------------------------------
# 이 두 값의 단일 진실(SSOT)은 progress(+ endboss_cleared_levels)다.
# serialize_user 가 매 응답마다 progress 기준으로 *파생 계산*하므로, user 레코드에
# 절대 영속화하면 안 된다(영속 stale 값 ↔ 파생 계산값 드리프트의 원인).
# 영속화 차단을 모든 쓰기 경로에서 보장하기 위해 mutate_user_atomic 코어에서
# write 직전 strip 한다. (save_user 도 같은 키를 pop — 이중 안전망)
# 부가 효과: Supabase users 테이블엔 이 두 컬럼이 없으므로, 레거시/직렬화 잔재로
# 키가 끼면 update 가 "column not found" 로 500 난다. 코어 strip 이 이를 원천 차단.
_DERIVED_USER_FIELDS = ("boss_cleared", "completed_stages")


def _strip_derived_fields(user: dict) -> None:
    """progress 파생 카운터를 영속화 직전 제거한다. SSOT=progress. (제자리 변경)"""
    for k in _DERIVED_USER_FIELDS:
        user.pop(k, None)


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
def save_attempt_item(item: dict):
    if USE_SUPABASE:
        # id 가 매 호출 새 uuid 라 upsert 는 사실상 insert (append-only). 기존
        # save_wrong_answer_item 과 동일 패턴으로 맞춘다.
        supabase.table("attempts").upsert(item).execute()
    else:
        # dev 전용 폴백
        attempts = _load_json_locked(ATTEMPTS_FILE, [])
        attempts.append(item)
        _save_json_locked(ATTEMPTS_FILE, attempts)


def get_attempts_by_user(user_id: str) -> list:
    if USE_SUPABASE:
        res = supabase.table("attempts").select("*").eq("user_id", user_id).execute()
        return res.data
    attempts = _load_json_locked(ATTEMPTS_FILE, [])  # dev 전용
    return [a for a in attempts if a.get("user_id") == user_id]


def _latest_attempt_per_question(user_id: str, course_level: str = None, unit: int = None) -> dict:
    """유저 attempts 를 question_id 별 '최신 1건'으로 접는다 (answered_at 기준).

    get_wrong_answers / get_unit_accuracy 의 공통 베이스. retry 로 여러 번 풀어도
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
    """최신 attempt 가 오답인 question_id 목록 (오답복습 우선순위 소스)."""
    latest = _latest_attempt_per_question(user_id, course_level, unit)
    return [qid for qid, a in latest.items() if not a.get("is_correct")]


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
        if not user:
            return None
        token_ver = payload.get("ver")
        if token_ver is not None and user.get("token_version", 1) != token_ver:
            return None
        return user
    except JWTError:
        return None


def serialize_user(user: dict) -> dict:
    # 1. Make a copy of user
    res = user.copy()
    
    # 2. Get current course level
    course_level = res.get("course_level", "beginner")
    res["course_level"] = course_level

    
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
    
    res.pop("password", None)
    return res


def calc_level(xp: int) -> int:
    """XP 기준 레벨 계산 (최대 30레벨)"""
    lv = 1
    accumulated = 0
    while lv < 30:
        needed = lv * 1000
        if xp < accumulated + needed:
            break
        accumulated += needed
        lv += 1
    return lv


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
    Apply XP, recalculate level, check evolution, and check/award titles.
    Returns dictionary describing the events.

    순수 in-place 변경 함수: user 를 그 자리에서만 갱신하고 저장은 호출부 책임
    (save_user 또는 mutate_user_atomic). 내부에서 save 를 호출하지 않으므로
    mutate_user_atomic 의 mutator 안에서도 그대로 재사용된다.

    event_type 이 주어지면 미션 진척 훅(bump_mission)을 함께 굴린다. (XP 발생 지점
    = 미션 이벤트 지점) 출석(login)은 XP 가 없고 day_key 가 필요하므로 호출부에서
    bump_mission 을 직접 호출한다.
    """
    old_xp = user.get("xp") or 0
    old_lv = user.get("lv") or 1
    old_char = user.get("character") or "slime"

    # 1. Apply XP
    user["xp"] = old_xp + xp_gain

    # 2. Recalculate level
    new_lv = calc_level(user["xp"])
    user["lv"] = max(new_lv, old_lv)
    level_up = user["lv"] > old_lv

    # 3. Check evolution
    evolved = None
    if user["lv"] >= 10 and old_char == "slime":
        user["character"] = "robot"
        evolved = "robot"
    elif user["lv"] >= 20 and old_char == "robot":
        user["character"] = "speech_bubble"
        evolved = "speech_bubble"
    elif user["lv"] >= 30 and old_char == "speech_bubble":
        user["character"] = "final_ghost"
        evolved = "final_ghost"

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
        "new_lv": user["lv"],
        "evolved": evolved,
        "newly_earned_titles": newly_earned_titles
    }

