from fastapi import HTTPException
from jose import jwt, JWTError
import json
import os
import time
import tempfile
from contextlib import contextmanager
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
from supabase import create_client

def get_user_id_or_ip(request: Request) -> str:
    auth = request.headers.get("Authorization")
    if auth:
        try:
            return verify_token(auth)
        except Exception:
            pass
    return get_remote_address(request)

limiter = Limiter(key_func=get_user_id_or_ip)

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
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
            pass
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
            return res.data[0]
        return None
    users = load_users()
    return next((u for u in users if u["id"] == user_id), None)


def get_user_by_username(username: str) -> dict | None:
    if USE_SUPABASE:
        res = supabase.table("users").select("*").eq("username", username).execute()
        if res.data:
            return res.data[0]
        return None
    users = load_users()
    return next((u for u in users if u["username"] == username), None)


def get_user_by_email(email: str) -> dict | None:
    if USE_SUPABASE:
        res = supabase.table("users").select("*").eq("email", email).execute()
        if res.data:
            return res.data[0]
        return None
    users = load_users()
    return next((u for u in users if u.get("email") == email), None)


def save_users(users):
    if USE_SUPABASE:
        for user in users:
            save_user(user)
    else:
        _save_json_locked(USERS_FILE, users)


def save_user(user: dict):
    if USE_SUPABASE:
        u_copy = user.copy()
        supabase.table("users").upsert(u_copy).execute()
    else:
        users = load_users()
        idx = next((i for i, u in enumerate(users) if u["id"] == user["id"]), None)
        if idx is not None:
            users[idx] = user
        else:
            users.append(user)
        _save_json_locked(USERS_FILE, users)


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


def load_reset_tokens():
    if USE_SUPABASE:
        res = supabase.table("reset_tokens").select("*").execute()
        tokens_dict = {}
        for item in res.data:
            tokens_dict[item["email"]] = {
                "token": item["token"],
                "expires_at": item["expires_at"]
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
                "expires_at": token_info["expires_at"]
            }).execute()
    else:
        _save_json_locked(RESET_TOKENS_FILE, data)


def verify_token(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


def get_current_user(authorization: str) -> dict:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="인증 실패")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


def serialize_user(user: dict) -> dict:
    # 1. Make a copy of user
    res = user.copy()
    
    # 2. Get current course level
    course_level = res.get("course_level", "beginner")
    
    # 3. Handle awarded_crown_units
    raw_crowns = res.get("awarded_crown_units", [])
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
                        pass
    res["awarded_crown_units"] = filtered_crowns
    
    # 4. Handle max_unlocked_unit
    raw_max = res.get("max_unlocked_unit", 1)
    if isinstance(raw_max, dict):
        res["max_unlocked_unit"] = raw_max.get(course_level, 1)
    else:
        if course_level == "beginner":
            res["max_unlocked_unit"] = raw_max
        else:
            res["max_unlocked_unit"] = 1
            
    # 5. Handle completed_units
    raw_completed = res.get("completed_units", 0)
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
            cleared_levels = res.get("endboss_cleared_levels", [])
            if course_level in cleared_levels:
                db_boss_cleared += 1
        except Exception:
            pass

    res["boss_cleared"] = max(res.get("boss_cleared") or 0, db_boss_cleared)
    res["completed_stages"] = max(res.get("completed_stages") or 0, db_completed_stages)

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

