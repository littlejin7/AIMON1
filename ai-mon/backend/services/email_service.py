import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def send_email(to_email: str, subject: str, html_content: str):
    """
    Send an email using SendGrid.
    Expects SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in environment variables.
    """
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("SENDGRID_FROM_EMAIL")

    if not api_key or not from_email:
        print("Warning: SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is not set. Email not sent.")
        return False

    message = Mail(
        from_email=from_email,
        to_emails=to_email,
        subject=subject,
        html_content=html_content
    )
    
    try:
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        return response.status_code in [200, 202]
    except Exception as e:
        print(f"Error sending email via SendGrid: {e}")
        return False
