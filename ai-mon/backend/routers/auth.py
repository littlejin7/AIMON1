from fastapi import APIRouter, HTTPException, status, Header
from pydantic import BaseModel
import json, os, hashlib, uuid, secrets
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from routers.utils import (
    serialize_user,
    calc_level,
    load_users,
    save_users,
    load_reset_tokens,
    save_reset_tokens,
    load_refresh_tokens,
    save_refresh_token,
    delete_refresh_token,
    delete_user_refresh_tokens,
    SECRET_KEY,
    ALGORITHM,
)

router = APIRouter()

EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
REFRESH_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 30))


class RefreshRequest(BaseModel):
    refresh_token: str


def create_refresh_token(user_id: str) -> str:
    token = secrets.token_hex(32)
    expires_at = (datetime.utcnow() + timedelta(days=REFRESH_EXPIRE_DAYS)).isoformat()
    refresh_item = {
        "user_id": user_id,
        "token": token,
        "expires_at": expires_at
    }
    save_refresh_token(refresh_item)
    return token


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # 하위 호환: 만약 기존의 SHA-256 해시값이라면 기존 방식 적용
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        return pwd_context.verify(plain_password, hashed_password)
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password


def create_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def update_login_streak(user: dict) -> tuple[dict, dict | None]:
    today = (datetime.utcnow() + timedelta(hours=9)).strftime("%Y-%m-%d")
    yesterday = (datetime.utcnow() + timedelta(hours=9) - timedelta(days=1)).strftime("%Y-%m-%d")
    last = user.get("last_login", "")

    streak_reward = None
    if last == today:
        pass
    elif last == yesterday:
        user["streak"] = user.get("streak", 0) + 1
        streak = user["streak"]
        earned_milestones = user.get("earned_streak_milestones", [])
        if streak == 3 and 3 not in earned_milestones:
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

        # Level up and evolution check (streak 증가 시 항상 실행)
        new_lv = calc_level(user.get("xp", 0))
        user["lv"] = max(new_lv, user.get("lv", 1))

        if user["lv"] >= 10 and user.get("character") == "slime":
            user["character"] = "robot"
        elif user["lv"] >= 20 and user.get("character") == "robot":
            user["character"] = "speech_bubble"
        elif user["lv"] >= 30 and user.get("character") == "speech_bubble":
            user["character"] = "final_ghost"
    else:
        user["streak"] = 1

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
    token: str
    new_password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    users = load_users()
    if any(u["username"] == req.username for u in users):
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    # course_level 유효성 검증
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
        "boss_cleared": 0,
        "completed_stages": 0,
        "max_unlocked_unit": {"beginner": 1, "intermediate": 1, "advanced": 1},
        "completed_units": {"beginner": 0, "intermediate": 0, "advanced": 0},
        "awarded_crown_units": [],
        "earned_streak_milestones": [],
        "game_rewards": {},
        "created_at": datetime.utcnow().isoformat(),
    }
    users.append(new_user)
    save_users(users)
    token = create_token({"sub": new_user["id"], "username": new_user["username"]})
    refresh_token = create_refresh_token(new_user["id"])
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(new_user)
    }


@router.post("/login")
def login(req: LoginRequest):
    users = load_users()
    user = next((u for u in users if u["username"] == req.username), None)
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    user, streak_reward = update_login_streak(user)
    save_users(users)

    token = create_token({"sub": user["id"], "username": user["username"]})
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
def forgot_password(req: ForgotPasswordRequest):
    users = load_users()
    user = next((u for u in users if u.get("email") == req.email), None)
    if not user:
        # 보안상 유저 존재 여부를 노출하지 않음
        return {"ok": True, "message": "If an account with that email exists, a reset code has been sent."}

    # Generate 6-digit token
    import random
    token = f"{random.randint(0, 999999):06d}"
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    
    tokens = load_reset_tokens()
    tokens[req.email] = {
        "token": token,
        "expires_at": expires_at
    }
    save_reset_tokens(tokens)
    
    # Send email
    subject = "[AI MON] 비밀번호 재설정 인증 코드"
    html_content = f"""
    <div style="font-family: sans-serif; padding: 20px;">
        <h2>비밀번호 재설정</h2>
        <p>요청하신 비밀번호 재설정 인증 코드입니다.</p>
        <h1 style="color: #4CAF50; letter-spacing: 5px;">{token}</h1>
        <p>이 코드는 10분 후 만료됩니다.</p>
    </div>
    """
    from services.email_service import send_email
    send_email(to_email=req.email, subject=subject, html_content=html_content)
    
    return {"ok": True, "message": "If an account with that email exists, a reset code has been sent."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    tokens = load_reset_tokens()
    
    # Find email by token
    target_email = None
    for email, data in tokens.items():
        if data["token"] == req.token:
            target_email = email
            break
            
    if not target_email:
        raise HTTPException(status_code=400, detail="유효하지 않거나 만료된 토큰입니다.")
        
    token_data = tokens[target_email]
    expires_at = datetime.fromisoformat(token_data["expires_at"])
    
    if datetime.utcnow() > expires_at:
        del tokens[target_email]
        save_reset_tokens(tokens)
        raise HTTPException(status_code=400, detail="유효하지 않거나 만료된 토큰입니다.")
        
    # Valid token, update password
    users = load_users()
    user_idx = next((i for i, u in enumerate(users) if u.get("email") == target_email), None)
    if user_idx is None:
        raise HTTPException(status_code=400, detail="유효하지 않거나 만료된 토큰입니다.")
        
    users[user_idx]["password"] = hash_password(req.new_password)
    save_users(users)
    
    # Remove token
    del tokens[target_email]
    save_reset_tokens(tokens)
    
    return {"ok": True, "message": "비밀번호가 성공적으로 변경되었습니다."}


from typing import Optional

class SocialLoginRequest(BaseModel):
    code: str
    redirect_uri: str
    state: Optional[str] = None


@router.post("/social/google")
def social_google(req: SocialLoginRequest):
    import requests
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
        token_res = requests.post(token_url, data=data)
        token_json = token_res.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"구글 토큰 요청 실패: {str(e)}")

    if "error" in token_json:
        raise HTTPException(
            status_code=400,
            detail=f"구글 토큰 인증 에러: {token_json.get('error_description', token_json['error'])}"
        )

    access_token = token_json.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="access_token을 획득하지 못했습니다.")

    # 2. Get user info from Google
    userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        user_res = requests.get(userinfo_url, headers=headers)
        user_info = user_res.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"구글 사용자 정보 요청 실패: {str(e)}")

    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="구글 계정에서 이메일 정보를 가져올 수 없습니다.")

    nickname = user_info.get("name", email.split("@")[0])

    # 3. Find or create user
    users = load_users()
    # 소셜 로그인은 username을 google_이메일 형식으로 저장해 고유성 유지
    username = f"google_{email}"
    user = next((u for u in users if u["username"] == username), None)

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
            "boss_cleared": 0,
            "completed_stages": 0,
            "max_unlocked_unit": {"beginner": 1, "intermediate": 1, "advanced": 1},
            "completed_units": {"beginner": 0, "intermediate": 0, "advanced": 0},
            "awarded_crown_units": [],
            "earned_streak_milestones": [],
            "game_rewards": {},
            "created_at": datetime.utcnow().isoformat(),
        }
        users.append(user)

    user, streak_reward = update_login_streak(user)
    save_users(users)

    token = create_token({"sub": user["id"], "username": user["username"]})
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
    users = load_users()
    if any(u["username"] == username.strip() for u in users):
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    return {"ok": True}


@router.get("/check-email")
def check_email(email: str):
    users = load_users()
    if any(u.get("email", "").strip() == email.strip() for u in users if u.get("email")):
        raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다.")
    return {"ok": True}


@router.post("/social/naver")
def social_naver(req: SocialLoginRequest):
    import requests
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
        token_res = requests.post(token_url, data=params)
        token_json = token_res.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"네이버 토큰 요청 실패: {str(e)}")

    if "error" in token_json:
        raise HTTPException(
            status_code=400,
            detail=f"네이버 토큰 인증 에러: {token_json.get('error_description', token_json['error'])}"
        )

    access_token = token_json.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="access_token을 획득하지 못했습니다.")

    # 2. Get user info from Naver
    userinfo_url = "https://openapi.naver.com/v1/nid/me"
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        user_res = requests.get(userinfo_url, headers=headers)
        user_info_res = user_res.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"네이버 사용자 정보 요청 실패: {str(e)}")

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
    users = load_users()
    username = f"naver_{email}"
    user = next((u for u in users if u["username"] == username), None)

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
            "boss_cleared": 0,
            "completed_stages": 0,
            "max_unlocked_unit": {"beginner": 1, "intermediate": 1, "advanced": 1},
            "completed_units": {"beginner": 0, "intermediate": 0, "advanced": 0},
            "awarded_crown_units": [],
            "earned_streak_milestones": [],
            "game_rewards": {},
            "created_at": datetime.utcnow().isoformat(),
        }
        users.append(user)

    user, streak_reward = update_login_streak(user)
    save_users(users)

    token = create_token({"sub": user["id"], "username": user["username"]})
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
def social_kakao(req: SocialLoginRequest):
    import requests
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
        token_res = requests.post(token_url, data=data)
        token_json = token_res.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"카카오 토큰 요청 실패: {str(e)}")

    if "error" in token_json:
        raise HTTPException(
            status_code=400,
            detail=f"카카오 토큰 인증 에러: {token_json.get('error_description', token_json['error'])}"
        )

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
        user_res = requests.get(userinfo_url, headers=headers)
        user_info_res = user_res.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"카카오 사용자 정보 요청 실패: {str(e)}")

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
    users = load_users()
    user = next((u for u in users if u["username"] == username), None)

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
            "boss_cleared": 0,
            "completed_stages": 0,
            "max_unlocked_unit": {"beginner": 1, "intermediate": 1, "advanced": 1},
            "completed_units": {"beginner": 0, "intermediate": 0, "advanced": 0},
            "awarded_crown_units": [],
            "earned_streak_milestones": [],
            "game_rewards": {},
            "created_at": datetime.utcnow().isoformat(),
        }
        users.append(user)

    user, streak_reward = update_login_streak(user)
    save_users(users)

    token = create_token({"sub": user["id"], "username": user["username"]})
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
        expires_at = datetime.utcnow()
        
    if expires_at.tzinfo is not None:
        now_dt = datetime.now(expires_at.tzinfo)
    else:
        now_dt = datetime.utcnow()
        
    if now_dt > expires_at:
        delete_refresh_token(req.refresh_token)
        raise HTTPException(status_code=401, detail="만료된 리프레시 토큰입니다. 다시 로그인해주세요.")
    
    users = load_users()
    user = next((u for u in users if u["id"] == target["user_id"]), None)
    if not user:
        raise HTTPException(status_code=401, detail="유저를 찾을 수 없습니다.")
    
    new_access_token = create_token({"sub": user["id"], "username": user["username"]})
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
        
    return {"ok": True, "message": "로그아웃 되었습니다."}


