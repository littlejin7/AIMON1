"""auth 라우터 패키지 (구 routers/auth.py 를 도메인별로 분리).

- login    : 로그인·토큰      (/login /refresh /logout /touch)
- register : 회원가입·이메일   (/email/* /register /check-* /level-test/submit)
- social   : 소셜로그인        (/social/*)
- password : 비밀번호 관리     (/forgot-password /reset-password /find-id)
- _core    : 위 도메인들이 공유하는 헬퍼·상수·모델

이 __init__ 은 기존 `routers.auth` 네임스페이스와의 호환 파사드다.
`from routers.auth import hash_password` / `auth.router` / `AUTH.update_login_streak`
같은 기존 접근을 그대로 유지하기 위해 공용 심볼과 핸들러를 재노출한다.

주의: `AUTH.login` / `AUTH.register` / `AUTH.password` / `AUTH._core` 는 (핸들러 함수가 아니라)
서브모듈 객체다. 테스트는 각 도메인의 의존성(mutate_user_atomic, hash_password 등)을
해당 서브모듈 네임스페이스에서 몽키패치한다.
"""
from fastapi import APIRouter

# 공용 계층(_core) 의 공개 심볼 재노출 — hash_password, verify_password,
# validate_password_policy, create_token, update_login_streak, now_kst, timedelta,
# logger, 스트릭 상수 등. (user.py / 테스트의 `AUTH.<name>` 읽기·직접호출 호환)
from ._core import *  # noqa: F401,F403
# `import *` 는 밑줄로 시작하는 헬퍼를 가져오지 않으므로 명시적으로 재노출한다.
from ._core import (  # noqa: F401
    _issue_auth_response,
    _parse_datetime,
    _unique_social_nickname,
    _refresh_social_nickname_for_save,
    _is_restore_eligible,
    _restore_for_login,
    _nickname_or_fallback,
    _ensure_nickname_available,
    _normalize_email,
    _validate_register_email_request,
    _email_code_key,
    _hash_email_code,
    _email_verification_required,
    _is_email_verified,
    _env_flag,
    _PW_SPECIAL_CHARS,
)

# 서브모듈을 패키지 속성으로 바인딩 (AUTH.login/register/social/password/_core).
from . import _core, login, register, social, password  # noqa: F401

# 핸들러·모델 재노출 (테스트가 `AUTH.touch`, `AUTH.forgot_password`,
# `AUTH.ForgotPasswordRequest` 등으로 직접 참조). 서브모듈명과 충돌하는
# login/register 핸들러 함수는 이름 충돌을 피하려 재노출하지 않는다.
from .login import RefreshRequest, LoginRequest, refresh, logout, touch  # noqa: F401
from .register import (  # noqa: F401
    RegisterRequest,
    EmailCodeRequest,
    VerifyEmailCodeRequest,
    LevelTestAnswer,
    SubmitLevelTestRequest,
    LEVEL_TEST_QUESTIONS_META,
    send_email_code,
    verify_email_code,
    check_id,
    check_email,
    check_nickname,
    submit_level_test,
)
from .social import SocialLoginRequest, social_google, social_naver, social_kakao  # noqa: F401
from .password import (  # noqa: F401
    ForgotPasswordRequest,
    ResetPasswordRequest,
    FindIdRequest,
    forgot_password,
    reset_password,
    find_id,
    mask_username,
)

# 도메인 라우터를 하나로 합쳐 기존 `auth.router` 를 유지 (경로는 전부 동일).
router = APIRouter()
router.include_router(login.router)
router.include_router(register.router)
router.include_router(social.router)
router.include_router(password.router)
