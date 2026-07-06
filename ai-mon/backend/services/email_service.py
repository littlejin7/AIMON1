import logging
import os

import httpx

logger = logging.getLogger(__name__)


class EmailConfigurationError(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


def _env_flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def send_email(to_email: str, subject: str, html_content: str):
    """
    Send an email using SendGrid.
    Expects SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in environment variables.
    """
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("SENDGRID_FROM_EMAIL")

    if not api_key or not from_email:
        logger.warning("SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is missing; skipping email")
        return False

    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    message = Mail(
        from_email=from_email,
        to_emails=to_email,
        subject=subject,
        html_content=html_content,
    )

    try:
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        return response.status_code in [200, 202]
    except Exception:
        logger.exception("SendGrid email delivery failed")
        return False


def send_verification_email(email: str, code: str) -> bool:
    """Send a signup verification code without exposing it to API clients."""
    email_enabled = _env_flag("EMAIL_ENABLED", "false")
    provider = os.getenv("EMAIL_PROVIDER", "resend").strip().lower()
    from_email = os.getenv("EMAIL_FROM", "").strip()

    if not email_enabled:
        logger.info("EMAIL_ENABLED=false; verification code for %s is %s", email, code)
        return True

    if provider != "resend":
        raise EmailConfigurationError(f"Unsupported EMAIL_PROVIDER: {provider}")

    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key or not from_email:
        raise EmailConfigurationError("RESEND_API_KEY and EMAIL_FROM are required when EMAIL_ENABLED=true")

    payload = {
        "from": from_email,
        "to": [email],
        "subject": "[AI-Mon] 이메일 인증코드",
        "html": f"""
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #222;">
          <h2 style="margin: 0 0 16px;">AI-Mon 이메일 인증</h2>
          <p>회원가입을 완료하려면 아래 6자리 인증코드를 입력해주세요.</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 16px; background: #f5f3ff; color: #534ab7; display: inline-block; border-radius: 8px;">{code}</div>
          <p style="margin-top: 16px; color: #666;">이 코드는 5분 후 만료됩니다.</p>
        </div>
        """,
    }

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=10.0,
        )
    except httpx.RequestError as exc:
        logger.exception("Resend verification email request failed")
        raise EmailDeliveryError("Resend request failed") from exc

    if response.status_code not in (200, 202):
        logger.error("Resend verification email failed: status=%s body=%s", response.status_code, response.text[:500])
        raise EmailDeliveryError("Resend rejected verification email")

    return True
