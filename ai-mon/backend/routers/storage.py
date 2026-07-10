"""스토리지 + 동시성 계층 — routers.utils 에서 분리.

듀얼 스토리지(JSON 파일 ↔ Supabase) 전환, 파일 락, JSON 원자 IO, 유저/진척/오답/
attempts/토큰/인증코드의 load·save·get, 그리고 표준 원자 쓰기 경로
(mutate_user_atomic + CAS)를 담는다.

스토리지 백엔드 전역(USE_SUPABASE / supabase / *_FILE)과 now_kst 는 여전히
routers.utils 가 소유한다. 테스트/라우터가 `routers.utils.USE_SUPABASE` 등을
몽키패치하므로, 여기서는 반드시 `_u.<name>` 로 **call-time 역참조**해야 패치가
반영된다. (만약 `_u.` 를 빠뜨리면 이 모듈에 해당 이름이 없어 NameError 로 즉시
터지므로 — 조용한 오작동이 아니라 시끄러운 실패다.)

routers.utils 가 여기 정의를 re-export 하므로, 외부는 계속
`from routers.utils import load_users, save_user, mutate_user_atomic, ...` 로 접근한다.
"""

import logging
import json
import os
import time
import tempfile
import contextvars
import copy
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional

import routers.utils as _u  # 스위치 전역(USE_SUPABASE/supabase/*_FILE/now_kst) call-time 역참조
from routers._helpers import (
    UserNotFoundError,
    UserSaveError,
    normalize_nickname,
    _merge_dicts,
    _attempt_log_context,
    LESSON_MODES,
    REVIEW_MODES,
    _strip_derived_fields,
)

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
    if _u.USE_SUPABASE:
        res = _u.supabase.table("users").select("*").execute()
        return res.data
    return _load_json_locked(_u.USERS_FILE, [])


def get_user_by_id(user_id: str) -> dict | None:
    if _u.USE_SUPABASE:
        res = _u.supabase.table("users").select("*").eq("id", user_id).execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next((u for u in users if u["id"] == user_id), None))


def get_user_by_username(username: str) -> dict | None:
    if _u.USE_SUPABASE:
        res = _u.supabase.table("users").select("*").eq("username", username).is_("deleted_at", "null").execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next(
        (u for u in users if u["username"] == username and not u.get("deleted_at")),
        None,
    ))


def get_user_by_username_any(username: str) -> dict | None:
    if _u.USE_SUPABASE:
        res = _u.supabase.table("users").select("*").eq("username", username).execute()
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
    if _u.USE_SUPABASE:
        res = _u.supabase.table("users").select("*").eq("email", email).execute()
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
    if _u.USE_SUPABASE:
        # Delete from users table (cascades to progress, wrong_answers, attempts, refresh_tokens)
        _u.supabase.table("users").delete().eq("username", username).not_.is_("deleted_at", "null").execute()
    else:
        users = _read_users_unlocked()
        to_delete_ids = [u["id"] for u in users if u["username"] == username and u.get("deleted_at")]
        if not to_delete_ids:
            return

        new_users = [u for u in users if not (u["username"] == username and u.get("deleted_at"))]
        _write_users_unlocked(new_users)

        # Clean up progress
        if os.path.exists(_u.PROGRESS_FILE):
            progress = _load_json_locked(_u.PROGRESS_FILE, [])
            new_progress = [p for p in progress if p.get("user_id") not in to_delete_ids]
            _save_json_locked(_u.PROGRESS_FILE, new_progress)

        # Clean up wrong answers
        if os.path.exists(_u.WRONG_ANSWERS_FILE):
            wrong = _load_json_locked(_u.WRONG_ANSWERS_FILE, [])
            new_wrong = [w for w in wrong if w.get("user_id") not in to_delete_ids]
            _save_json_locked(_u.WRONG_ANSWERS_FILE, new_wrong)

        # Clean up attempts
        if os.path.exists(_u.ATTEMPTS_FILE):
            attempts = _load_json_locked(_u.ATTEMPTS_FILE, [])
            new_attempts = [a for a in attempts if a.get("user_id") not in to_delete_ids]
            _save_json_locked(_u.ATTEMPTS_FILE, new_attempts)


def purge_soft_deleted_users(retention_days: int = 30, now: Optional[datetime] = None, dry_run: bool = False) -> dict:
    """Purge users soft-deleted longer than `retention_days`.

    Supabase path deletes rows from `users` and relies on FK cascade for related tables.
    JSON path deletes matching users and related local data files directly.
    """
    ref_now = now or _u.now_kst()
    cutoff = ref_now - timedelta(days=retention_days)
    result = {
        "retention_days": retention_days,
        "cutoff": cutoff.isoformat(),
        "deleted_user_ids": [],
        "deleted_count": 0,
        "dry_run": dry_run,
    }

    if _u.USE_SUPABASE:
        res = (
            _u.supabase.table("users")
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
            _u.supabase.table("users")
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

    if os.path.exists(_u.PROGRESS_FILE):
        progress = _load_json_locked(_u.PROGRESS_FILE, [])
        _save_json_locked(_u.PROGRESS_FILE, [p for p in progress if p.get("user_id") not in to_delete_ids])

    if os.path.exists(_u.WRONG_ANSWERS_FILE):
        wrong = _load_json_locked(_u.WRONG_ANSWERS_FILE, [])
        _save_json_locked(_u.WRONG_ANSWERS_FILE, [w for w in wrong if w.get("user_id") not in to_delete_ids])

    if os.path.exists(_u.ATTEMPTS_FILE):
        attempts = _load_json_locked(_u.ATTEMPTS_FILE, [])
        _save_json_locked(_u.ATTEMPTS_FILE, [a for a in attempts if a.get("user_id") not in to_delete_ids])

    if os.path.exists(_u.REFRESH_TOKENS_FILE):
        tokens = _load_json_locked(_u.REFRESH_TOKENS_FILE, [])
        _save_json_locked(_u.REFRESH_TOKENS_FILE, [t for t in tokens if t.get("user_id") not in to_delete_ids])

    return result


def get_user_by_email(email: str) -> dict | None:
    if _u.USE_SUPABASE:
        res = _u.supabase.table("users").select("*").eq("email", email).is_("deleted_at", "null").execute()
        if res.data:
            return _cache_original_user(res.data[0])
        return None
    users = load_users()
    return _cache_original_user(next(
        (u for u in users if u.get("email") == email and not u.get("deleted_at")),
        None,
    ))


def save_users(users):
    if _u.USE_SUPABASE:
        for user in users:
            save_user(user)
    else:
        _save_json_locked(_u.USERS_FILE, users)


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

    if _u.USE_SUPABASE:
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
                    _u.supabase.rpc("update_user_atomic", {
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
            _u.supabase.table("users").upsert(u_copy).execute()
    else:
        with file_lock(_u.USERS_FILE):
            users = []
            if os.path.exists(_u.USERS_FILE):
                try:
                    with open(_u.USERS_FILE, "r", encoding="utf-8") as f:
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

            dir_name = os.path.dirname(_u.USERS_FILE)
            os.makedirs(dir_name, exist_ok=True)
            temp_fd, temp_path = tempfile.mkstemp(dir=dir_name)
            try:
                with os.fdopen(temp_fd, "w", encoding="utf-8") as tmp:
                    json.dump(users, tmp, ensure_ascii=False, indent=2)
                os.replace(temp_path, _u.USERS_FILE)
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
    if not os.path.exists(_u.USERS_FILE):
        return []
    try:
        with open(_u.USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _write_users_unlocked(users: list):
    dir_name = os.path.dirname(_u.USERS_FILE)
    os.makedirs(dir_name, exist_ok=True)
    temp_fd, temp_path = tempfile.mkstemp(dir=dir_name)
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as tmp:
            json.dump(users, tmp, ensure_ascii=False, indent=2)
        os.replace(temp_path, _u.USERS_FILE)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise


def _mutate_user_atomic_json(user_id: str, mutator):
    # 단일 프로세스: file_lock 한 임계구역 안에서 재읽기→검사·변경→원자적 write.
    with file_lock(_u.USERS_FILE):
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
        res = _u.supabase.table("users").select("*").eq("id", user_id).execute()
        if not res.data:
            raise UserNotFoundError(user_id)
        user = res.data[0]
        version = user.get("version", 0) or 0
        result = mutator(user)            # 예외 발생 시 update 도달 못함 → no-op
        _strip_derived_fields(user)       # SSOT: 파생 카운터 영속화 차단(+컬럼 부재 500 방지)
        update_obj = {k: v for k, v in user.items() if k != "id"}
        update_obj["version"] = version + 1
        upd = (
            _u.supabase.table("users")
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
    if _u.USE_SUPABASE:
        return _mutate_user_atomic_supabase(user_id, mutator)
    return _mutate_user_atomic_json(user_id, mutator)


def load_progress():
    if _u.USE_SUPABASE:
        res = _u.supabase.table("progress").select("*").execute()
        return res.data
    return _load_json_locked(_u.PROGRESS_FILE, [])


def get_progress_by_user(user_id: str, course_level: str = None) -> list:
    if _u.USE_SUPABASE:
        q = _u.supabase.table("progress").select("*").eq("user_id", user_id)
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
    if _u.USE_SUPABASE:
        for p in progress:
            save_progress_item(p)
    else:
        _save_json_locked(_u.PROGRESS_FILE, progress)


def save_progress_item(item: dict):
    if _u.USE_SUPABASE:
        _u.supabase.table("progress").upsert(item).execute()
    else:
        progress = load_progress()
        idx = next((i for i, p in enumerate(progress) if p.get("id") == item.get("id")), None)
        if idx is not None:
            progress[idx] = item
        else:
            progress.append(item)
        _save_json_locked(_u.PROGRESS_FILE, progress)


def load_wrong_answers():
    if _u.USE_SUPABASE:
        res = _u.supabase.table("wrong_answers").select("*").execute()
        return res.data
    return _load_json_locked(_u.WRONG_ANSWERS_FILE, [])


def get_wrong_answers_by_user(user_id: str) -> list:
    if _u.USE_SUPABASE:
        res = _u.supabase.table("wrong_answers").select("*").eq("user_id", user_id).execute()
        return res.data
    wrong = load_wrong_answers()
    return [wa for wa in wrong if wa.get("user_id") == user_id]


def save_wrong_answers(data):
    if _u.USE_SUPABASE:
        for item in data:
            save_wrong_answer_item(item)
    else:
        _save_json_locked(_u.WRONG_ANSWERS_FILE, data)


def save_wrong_answer_item(item: dict):
    if _u.USE_SUPABASE:
        _u.supabase.table("wrong_answers").upsert(item).execute()
    else:
        wrong = load_wrong_answers()
        idx = next((i for i, wa in enumerate(wrong) if wa.get("id") == item.get("id")), None)
        if idx is not None:
            wrong[idx] = item
        else:
            wrong.append(item)
        _save_json_locked(_u.WRONG_ANSWERS_FILE, wrong)


def _read_wrong_answers_unlocked() -> list:
    if not os.path.exists(_u.WRONG_ANSWERS_FILE):
        return []
    try:
        with open(_u.WRONG_ANSWERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _write_wrong_answers_unlocked(data: list):
    dir_name = os.path.dirname(_u.WRONG_ANSWERS_FILE)
    os.makedirs(dir_name, exist_ok=True)
    temp_fd, temp_path = tempfile.mkstemp(dir=dir_name)
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as tmp:
            json.dump(data, tmp, ensure_ascii=False, indent=2)
        os.replace(temp_path, _u.WRONG_ANSWERS_FILE)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise


def mark_wrong_answer_reviewed(user_id: str, question_id: str) -> bool:
    """user_id 소유의 question_id 오답을 reviewed=False→True 로 전환한다.

    반환값은 '이번 호출이 실제로 최초 전환을 일으켰는가' — train.py 는 이 값이 True 인
    호출에서만 review_done 미션을 올려야 한다(멱등 + 동시성 안전 판단의 단일 진실).
      - 매칭 레코드 없음(question_id 오타/타 유저 소유) → False, 아무것도 쓰지 않음
      - 매칭 레코드가 이미 전부 reviewed=True → False, 아무것도 쓰지 않음(멱등)
      - 하나라도 reviewed=False→True 전환 → 해당 user_id 의 매칭 레코드를 전부
        reviewed=True 로 갱신하고 True 반환

    Supabase: user_id+question_id+reviewed=false 조건부 UPDATE. 동시 요청 2건이 같은
    행을 노려도 WHERE reviewed=false 는 한쪽 트랜잭션에서만 매치되므로(먼저 커밋한
    쪽이 reviewed 를 true 로 바꾸면 다른 쪽은 조건에 안 걸림) 변경 행이 있는 요청만
    True 를 받는다 — DB 자체가 CAS 역할을 한다.
    JSON: WRONG_ANSWERS_FILE 락 안에서 read→검사→write 를 한 임계구역으로 묶어
    동일 보장(mutate_user_atomic_json 과 같은 패턴, 락 재진입 방지를 위해 unlocked
    read/write 헬퍼만 사용).
    """
    if _u.USE_SUPABASE:
        res = (
            _u.supabase.table("wrong_answers")
            .update({"reviewed": True})
            .eq("user_id", user_id)
            .eq("question_id", question_id)
            .eq("reviewed", False)
            .execute()
        )
        return bool(res.data)

    with file_lock(_u.WRONG_ANSWERS_FILE):
        wrong = _read_wrong_answers_unlocked()
        matched = [
            wa for wa in wrong
            if wa.get("user_id") == user_id and wa.get("question_id") == question_id
        ]
        if not matched:
            return False
        transitioned = any(not wa.get("reviewed") for wa in matched)
        if not transitioned:
            return False
        for wa in matched:
            wa["reviewed"] = True
        _write_wrong_answers_unlocked(wrong)
        return True


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
    if _u.USE_SUPABASE:
        # id 가 매 호출 새 uuid 라 upsert 는 사실상 insert (append-only). 기존
        # save_wrong_answer_item 과 동일 패턴으로 맞춘다.
        item = _normalize_attempt_item_for_supabase(item)
        if item is None:
            return False
        try:
            _u.supabase.table("attempts").upsert(item).execute()
            return True
        except Exception:
            logger.exception(
                "save_attempt_item: Supabase attempts upsert failed; item=%s",
                _attempt_log_context(item),
            )
            return False
    else:
        # dev 전용 폴백
        attempts = _load_json_locked(_u.ATTEMPTS_FILE, [])
        attempts.append(item)
        _save_json_locked(_u.ATTEMPTS_FILE, attempts)
        return True


def get_attempts_by_user(user_id: str) -> list:
    if _u.USE_SUPABASE:
        res = _u.supabase.table("attempts").select("*").eq("user_id", user_id).execute()
        return res.data
    attempts = _load_json_locked(_u.ATTEMPTS_FILE, [])  # dev 전용
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
    if _u.USE_SUPABASE:
        res = _u.supabase.table("reset_tokens").select("*").execute()
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
    return _load_json_locked(_u.RESET_TOKENS_FILE, {})


def save_reset_tokens(data):
    if _u.USE_SUPABASE:
        db_tokens = _u.supabase.table("reset_tokens").select("email").execute().data
        db_emails = {t["email"] for t in db_tokens}

        emails_to_delete = db_emails - set(data.keys())
        if emails_to_delete:
            _u.supabase.table("reset_tokens").delete().in_("email", list(emails_to_delete)).execute()

        for email, token_info in data.items():
            _u.supabase.table("reset_tokens").upsert({
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
        _save_json_locked(_u.RESET_TOKENS_FILE, data)


def load_email_verification_codes():
    if _u.USE_SUPABASE:
        res = _u.supabase.table("email_verification_codes").select("*").execute()
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
    return _load_json_locked(_u.EMAIL_VERIFICATION_CODES_FILE, {})


def save_email_verification_codes(data):
    if _u.USE_SUPABASE:
        db_rows = _u.supabase.table("email_verification_codes").select("email,purpose").execute().data
        db_keys = {f"{row['email']}:{row['purpose']}" for row in db_rows}
        keys_to_delete = db_keys - set(data.keys())
        for key in keys_to_delete:
            email, purpose = key.rsplit(":", 1)
            (
                _u.supabase.table("email_verification_codes")
                .delete()
                .eq("email", email)
                .eq("purpose", purpose)
                .execute()
            )

        for record in data.values():
            _u.supabase.table("email_verification_codes").upsert({
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
        _save_json_locked(_u.EMAIL_VERIFICATION_CODES_FILE, data)


def load_refresh_tokens():
    if _u.USE_SUPABASE:
        res = _u.supabase.table("refresh_tokens").select("*").execute()
        return res.data
    return _load_json_locked(_u.REFRESH_TOKENS_FILE, [])


def save_refresh_token(item: dict):
    if _u.USE_SUPABASE:
        _u.supabase.table("refresh_tokens").upsert(item).execute()
    else:
        tokens = load_refresh_tokens()
        idx = next((i for i, t in enumerate(tokens) if t.get("id") == item.get("id") or t.get("token") == item.get("token")), None)
        if idx is not None:
            tokens[idx] = item
        else:
            tokens.append(item)
        _save_json_locked(_u.REFRESH_TOKENS_FILE, tokens)


def delete_refresh_token(token: str):
    if _u.USE_SUPABASE:
        _u.supabase.table("refresh_tokens").delete().eq("token", token).execute()
    else:
        tokens = load_refresh_tokens()
        tokens = [t for t in tokens if t.get("token") != token]
        _save_json_locked(_u.REFRESH_TOKENS_FILE, tokens)


def delete_user_refresh_tokens(user_id: str):
    if _u.USE_SUPABASE:
        _u.supabase.table("refresh_tokens").delete().eq("user_id", user_id).execute()
    else:
        tokens = load_refresh_tokens()
        tokens = [t for t in tokens if t.get("user_id") != user_id]
        _save_json_locked(_u.REFRESH_TOKENS_FILE, tokens)
