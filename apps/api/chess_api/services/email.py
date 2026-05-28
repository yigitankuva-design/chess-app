"""Email service.

In `ENV=development`, just logs the email content (no real send).
In `ENV=production`, uses SendGrid SMTP via fastapi-mail.
"""
import logging
from fastapi_mail import FastMail, MessageSchema, MessageType, ConnectionConfig
from chess_api.settings import settings

logger = logging.getLogger(__name__)


def _config() -> ConnectionConfig:
    s = settings()
    return ConnectionConfig(
        MAIL_USERNAME="apikey",
        MAIL_PASSWORD=s.SENDGRID_API_KEY,
        MAIL_FROM=s.MAIL_FROM,
        MAIL_PORT=587,
        MAIL_SERVER="smtp.sendgrid.net",
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
    )


async def send_verification_email(to_email: str, token: str, name: str) -> None:
    s = settings()
    if s.ENV == "development" or not s.SENDGRID_API_KEY:
        # Dev or unconfigured prod: log instead of send
        logger.info(
            "[email-stub] would send verification to %s (name=%s) token=%s",
            to_email, name, token,
        )
        return

    # Build verify URL from first allowed CORS origin
    frontend_url = s.CORS_ORIGINS.split(",")[0].strip()
    verify_url = f"{frontend_url}/verify-email?token={token}"

    message = MessageSchema(
        subject="E-postanızı doğrulayın — Çocuklar İçin Satranç",
        recipients=[to_email],
        body=(
            f"Merhaba {name},\n\n"
            f"E-postanızı doğrulamak için aşağıdaki bağlantıya tıklayın:\n"
            f"{verify_url}\n\n"
            f"İyi günler."
        ),
        subtype=MessageType.plain,
    )
    fm = FastMail(_config())
    await fm.send_message(message)
