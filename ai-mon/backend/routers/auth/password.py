"""비밀번호 관리 도메인: /forgot-password /reset-password /find-id."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import hashlib, hmac, secrets
from datetime import datetime, timedelta, timezone

from routers.utils import (
    get_user_by_email,
    load_reset_tokens,
    save_reset_tokens,
    mutate_user_atomic,
    UserNotFoundError,
    now_kst,
    limiter,
)
from ._core import (
    logger,
    hash_password,
    validate_password_policy,
)

router = APIRouter()


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str


class FindIdRequest(BaseModel):
    email: str


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

    # 토큰 검증을 통과한 뒤에 비밀번호 정책 검사 (기존 토큰 소진/실패 카운트 테스트 유지)
    validate_password_policy(req.new_password)

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
