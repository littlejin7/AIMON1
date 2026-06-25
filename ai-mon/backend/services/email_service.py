import os
import logging

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_content: str):
    """
    Send an email using SendGrid.
    Expects SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in environment variables.
    """
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("SENDGRID_FROM_EMAIL")

    if not api_key or not from_email:
        logger.warning("SENDGRID_API_KEY 또는 SENDGRID_FROM_EMAIL 미설정 — 이메일 발송 건너뜀")
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
        logger.exception("SendGrid 이메일 발송 실패 (수신자 user_id 기준 로깅 권장)")
        return False
