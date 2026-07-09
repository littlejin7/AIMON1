"""회원가입·이메일인증 도메인.

엔드포인트: /email/send-code /email/verify-code /register
            /check-id /check-email /check-nickname /level-test/submit
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel
import os, hmac, uuid, secrets, re
from datetime import timedelta

from routers.utils import (
    serialize_user,
    get_user_by_username,
    get_user_by_email,
    get_user_by_username_any,
    get_user_by_email_any,
    get_user_by_nickname,
    normalize_nickname,
    save_user,
    load_email_verification_codes,
    save_email_verification_codes,
    mutate_user_atomic,
    UserNotFoundError,
    now_kst,
    limiter,
    get_current_user_optional,
    delete_soft_deleted_user_by_username,
    apply_level_test_placement,
)
from services.email_service import (
    EmailConfigurationError,
    EmailDeliveryError,
    send_verification_email,
)
from ._core import (
    logger,
    hash_password,
    validate_password_policy,
    update_login_streak,
    _issue_auth_response,
    _is_restore_eligible,
    _restore_for_login,
    _nickname_or_fallback,
    _ensure_nickname_available,
    _normalize_email,
    _validate_register_email_request,
    _email_code_key,
    _hash_email_code,
    _parse_datetime,
    _email_verification_required,
    _is_email_verified,
    create_token,
    create_refresh_token,
    EMAIL_CODE_ATTEMPT_LIMIT,
)

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
    email: str = ""
    course_level: str = "beginner"   # 레벨 테스트 결과 or 기본값
    is_level_tested: bool = False
    marketing_agreed: bool = False


class EmailCodeRequest(BaseModel):
    email: str
    purpose: str = "register"


class VerifyEmailCodeRequest(BaseModel):
    email: str
    code: str
    purpose: str = "register"


@router.post("/email/send-code")
@limiter.limit("5/minute")
def send_email_code(req: EmailCodeRequest, request: Request):
    email = _normalize_email(req.email)
    purpose = str(req.purpose or "").strip()
    _validate_register_email_request(email, purpose)

    if get_user_by_email(email) or get_user_by_username(email):
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")

    now = now_kst()
    ttl_seconds = int(os.getenv("EMAIL_CODE_TTL_SECONDS", "300"))
    cooldown_seconds = int(os.getenv("EMAIL_RESEND_COOLDOWN_SECONDS", "60"))
    records = load_email_verification_codes()
    key = _email_code_key(email, purpose)
    existing = records.get(key)

    if existing and existing.get("last_sent"):
        last_sent = _parse_datetime(existing.get("last_sent"))
        if last_sent:
            elapsed = (now - last_sent).total_seconds()
            if elapsed < cooldown_seconds:
                raise HTTPException(
                    status_code=429,
                    detail=f"{int(cooldown_seconds - elapsed)}초 후 다시 요청해주세요.",
                )

    code = f"{secrets.randbelow(1000000):06d}"

    try:
        send_verification_email(email, code)
    except EmailConfigurationError:
        logger.exception("email verification configuration error")
        raise HTTPException(
            status_code=500,
            detail="이메일 발송 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.",
        )
    except EmailDeliveryError:
        logger.exception("email verification delivery error")
        raise HTTPException(
            status_code=502,
            detail="이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
        )

    records[key] = {
        "email": email,
        "purpose": purpose,
        "code_hash": _hash_email_code(email, purpose, code),
        "expires_at": (now + timedelta(seconds=ttl_seconds)).isoformat(),
        "attempts": 0,
        "verified": False,
        "last_sent": now.isoformat(),
        "verified_at": None,
    }
    save_email_verification_codes(records)

    return {
        "ok": True,
        "message": "인증코드를 발송했습니다. 메일함과 스팸함을 확인해주세요.",
        "ttl_seconds": ttl_seconds,
        "cooldown_seconds": cooldown_seconds,
    }


@router.post("/email/verify-code")
@limiter.limit("10/minute")
def verify_email_code(req: VerifyEmailCodeRequest, request: Request):
    email = _normalize_email(req.email)
    purpose = str(req.purpose or "").strip()
    code = str(req.code or "").strip()
    _validate_register_email_request(email, purpose)

    if not re.fullmatch(r"\d{6}", code):
        raise HTTPException(status_code=400, detail="코드가 일치하지 않거나 만료되었습니다.")

    records = load_email_verification_codes()
    key = _email_code_key(email, purpose)
    record = records.get(key)
    invalid = HTTPException(status_code=400, detail="코드가 일치하지 않거나 만료되었습니다.")

    if not record:
        raise invalid

    expires_at = _parse_datetime(record.get("expires_at"))
    if not expires_at or now_kst() > expires_at:
        records.pop(key, None)
        save_email_verification_codes(records)
        raise invalid

    attempts = int(record.get("attempts", 0))
    if attempts >= EMAIL_CODE_ATTEMPT_LIMIT:
        records.pop(key, None)
        save_email_verification_codes(records)
        raise invalid

    submitted_hash = _hash_email_code(email, purpose, code)
    if not hmac.compare_digest(str(record.get("code_hash", "")), submitted_hash):
        record["attempts"] = attempts + 1
        if record["attempts"] >= EMAIL_CODE_ATTEMPT_LIMIT:
            records.pop(key, None)
        save_email_verification_codes(records)
        raise invalid

    record["verified"] = True
    record["verified_at"] = now_kst().isoformat()
    records[key] = record
    save_email_verification_codes(records)
    return {"ok": True, "message": "이메일 인증이 완료되었습니다."}


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(req: RegisterRequest, request: Request):
    validate_password_policy(req.password)
    # ── [추가] 대문자 검사 ──
    if any(c.isupper() for c in req.username):
        raise HTTPException(status_code=400, detail="아이디는 소문자로만 입력해주세요.")
    if any(c.isupper() for c in req.email):
        raise HTTPException(status_code=400, detail="이메일은 소문자로만 입력해주세요.")
    # ────────────────────────
    if get_user_by_username(req.username):
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    nickname = _nickname_or_fallback(req.nickname, req.username)
    email = _normalize_email(req.email)
    if _email_verification_required() and not _is_email_verified(email, "register"):
        raise HTTPException(status_code=400, detail="이메일 인증을 완료해주세요.")
    if email and (get_user_by_email(email) or get_user_by_username(email)):
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
    _ensure_nickname_available(nickname)

    # 계정 삭제를 하고 동일한 username으로 재가입한 경우 기존 탈퇴한 유저 데이터를 완전히 삭제합니다.
    # course_level: 클라 값을 쓰되 valid_levels 외의 값은 "beginner"로 fallback한다.
    # 레벨 테스트(/auth/level-test/submit)를 정상 완료한 클라이언트가 결과를 함께
    # 전달하는 흐름이므로 허용된 값(beginner/intermediate/advanced)이면 신뢰한다.
    # is_level_tested: 클라 신뢰 — 레벨 테스트 완료 여부를 클라가 설정한다.
    # 악의적 클라가 is_level_tested=true 로 보내도 게임 로직 상 실질 피해가 없다
    # (보스 진입 게이트는 progress 기반 별도 검증 / 레벨 배정은 course_level 이 결정).
    valid_levels = {"beginner", "intermediate", "advanced"}
    level = req.course_level if req.course_level in valid_levels else "beginner"
    deleted_user = get_user_by_username_any(req.username)
    if deleted_user and deleted_user.get("deleted_at"):
        if _is_restore_eligible(deleted_user):
            _ensure_nickname_available(nickname, exclude_user_id=deleted_user.get("id"))

            def restore_updater(u: dict) -> None:
                u["password"] = hash_password(req.password)
                u["nickname"] = nickname
                u["email"] = email
                if req.is_level_tested:
                    apply_level_test_placement(u, level)
                else:
                    u["course_level"] = level
                    u["is_level_tested"] = req.is_level_tested
                u["marketing_agreed"] = req.marketing_agreed

            restored = _restore_for_login(deleted_user, restore_updater)

            def login_mutator(u: dict):
                _, sr, ar = update_login_streak(u)
                return sr, ar

            try:
                restored, (streak_reward, attendance_reward) = mutate_user_atomic(restored["id"], login_mutator)
            except UserNotFoundError:
                raise HTTPException(status_code=404, detail="?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎.")
            return _issue_auth_response(restored, is_new=False, account_restored=True, streak_reward=streak_reward, attendance_reward=attendance_reward)

        delete_soft_deleted_user_by_username(req.username)

    new_user = {
        "id": str(uuid.uuid4()),
        "username": req.username,
        "password": hash_password(req.password),
        "nickname": nickname,
        "email": email,
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
    if req.is_level_tested:
        apply_level_test_placement(new_user, level)
    _ensure_nickname_available(new_user["nickname"])
    save_user(new_user)
    token = create_token({"sub": new_user["id"], "username": new_user["username"]}, new_user.get("token_version", 1))
    refresh_token = create_refresh_token(new_user["id"])
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(new_user)
    }


@router.get("/check-id")
def check_id(username: str):
    # ── [추가] 대문자 검사 ──
    if any(c.isupper() for c in username):
        raise HTTPException(status_code=400, detail="아이디는 소문자로만 입력해주세요.")
    # ────────────────────────
    username_clean = username.strip()
    if get_user_by_username(username_clean):
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    deleted_user = get_user_by_username_any(username_clean)
    if deleted_user and deleted_user.get("deleted_at") and _is_restore_eligible(deleted_user):
        return {"ok": True, "restorable": True}
    return {"ok": True}


@router.get("/check-email")
def check_email(email: str):
    # ── [추가] 대문자 검사 ──
    if any(c.isupper() for c in email):
        raise HTTPException(status_code=400, detail="이메일은 소문자로만 입력해주세요.")
    # ────────────────────────
    email_clean = _normalize_email(email)
    deleted_user = get_user_by_email_any(email_clean) or get_user_by_username_any(email_clean)
    if get_user_by_email(email_clean) or get_user_by_username(email_clean):
        raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다.")
    if deleted_user and deleted_user.get("deleted_at") and _is_restore_eligible(deleted_user):
        return {"ok": True, "restorable": True}
    return {"ok": True}


@router.get("/check-nickname")
def check_nickname(nickname: str):
    nickname_clean = normalize_nickname(nickname)
    if get_user_by_nickname(nickname_clean):
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
    return {"ok": True}


LEVEL_TEST_QUESTIONS_META = {
    "lt1": {"level": "beginner", "category": "syntax", "answer": 1},
    "lt2": {"level": "beginner", "category": "syntax", "answer": 2},
    "lt3": {"level": "beginner", "category": "structure", "answer": 1},
    "lt4": {"level": "beginner", "category": "structure", "answer": 1},
    "lt5": {"level": "intermediate", "category": "syntax", "answer": 1},
    "lt6": {"level": "intermediate", "category": "syntax", "answer": 3},
    "lt7": {"level": "intermediate", "category": "control", "answer": 0},
    "lt8": {"level": "advanced", "category": "control", "answer": 3},
    "lt9": {"level": "advanced", "category": "control", "answer": 2},
    "lt10": {"level": "advanced", "category": "control", "answer": 2},
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
            apply_level_test_placement(u, level_key)
            return None

        try:
            updated_user, _ = mutate_user_atomic(user["id"], mutator)
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
