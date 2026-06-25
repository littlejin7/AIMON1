"""
Admin API — 서버 측 강제 토큰 무효화(밴/강제 로그아웃).

ADMIN_SECRET 환경변수가 설정되지 않으면 모든 요청을 거부(fail-closed).
"""
import os
import hmac
import logging
from fastapi import APIRouter, Header, HTTPException, Request
from routers.utils import (
    limiter,
    mutate_user_atomic,
    delete_user_refresh_tokens,
    UserNotFoundError,
    UserSaveError,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_UNSET = object()
_ADMIN_SECRET: str = os.getenv("ADMIN_SECRET", "")


def _check_secret(provided: str) -> None:
    """ADMIN_SECRET 미설정이거나 불일치하면 403. timing-safe 비교."""
    if not _ADMIN_SECRET:
        # fail-closed: 환경변수 미설정 시 어떤 요청도 허용하지 않음
        raise HTTPException(status_code=403, detail="관리자 기능이 비활성화되어 있습니다.")
    if not hmac.compare_digest(_ADMIN_SECRET, provided):
        raise HTTPException(status_code=403, detail="인증 실패.")


@router.patch("/user/{user_id}/revoke")
@limiter.limit("20/minute")
def revoke_user_token(
    user_id: str,
    request: Request,
    x_admin_secret: str = Header(..., alias="X-Admin-Secret"),
):
    """
    특정 유저의 token_version을 증가시켜 현재 발급된 모든 access token을 즉시 무효화.
    리프레시 토큰도 함께 삭제하여 재발급 경로도 차단.
    강제 로그아웃·밴 목적으로 사용.
    """
    _check_secret(x_admin_secret)

    try:
        def _revoke(u: dict):
            u["token_version"] = u.get("token_version", 1) + 1

        mutate_user_atomic(user_id, _revoke)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    except UserSaveError:
        raise HTTPException(status_code=503, detail="유저 상태 저장 실패. 잠시 후 재시도하세요.")

    # 리프레시 토큰도 삭제 — 재발급 경로 차단
    try:
        delete_user_refresh_tokens(user_id)
    except Exception:
        logger.exception("revoke: refresh token 삭제 실패 user_id=%s", user_id)

    logger.info("admin revoke: token invalidated user_id=%s", user_id)
    return {"ok": True, "user_id": user_id, "message": "토큰이 무효화되었습니다."}
