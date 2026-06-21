from fastapi import HTTPException
from jose import jwt, JWTError
import json
import os
import time
import tempfile
from contextlib import contextmanager

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data"))
USERS_FILE = os.path.join(DATA_DIR, "users.json")
PROGRESS_FILE = os.path.join(DATA_DIR, "progress.json")
WRONG_ANSWERS_FILE = os.path.join(DATA_DIR, "wrong_answers.json")


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
    return _load_json_locked(USERS_FILE, [])


def save_users(users):
    _save_json_locked(USERS_FILE, users)


def load_progress():
    return _load_json_locked(PROGRESS_FILE, [])


def save_progress(progress):
    _save_json_locked(PROGRESS_FILE, progress)


def load_wrong_answers():
    return _load_json_locked(WRONG_ANSWERS_FILE, [])


def save_wrong_answers(data):
    _save_json_locked(WRONG_ANSWERS_FILE, data)


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
        users = load_users()
        user = next((u for u in users if u["id"] == user_id), None)
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
            progress_list = load_progress()
            user_stages = [
                p for p in progress_list
                if p.get("user_id") == uid
                and p.get("is_completed") is True
                and p.get("course_level", course_level) == course_level
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

