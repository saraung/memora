"""Development email sender: logs links instead of sending mail."""

from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class ConsoleEmailSender:
    """Pretends to send email by logging the token link."""

    def send_verification_email(
        self, *, to_email: str, username: str, token: str
    ) -> None:
        link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        logger.info(
            "[email:stub] verification for %s <%s>: %s",
            username,
            to_email,
            link,
        )

    def send_password_reset_email(
        self, *, to_email: str, username: str, token: str
    ) -> None:
        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        logger.info(
            "[email:stub] password reset for %s <%s>: %s",
            username,
            to_email,
            link,
        )


console_email_sender = ConsoleEmailSender()
