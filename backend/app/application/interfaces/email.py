"""Email-sending abstraction. Swap the console sender for SMTP later."""

from __future__ import annotations

from typing import Protocol


class EmailSender(Protocol):
    def send_verification_email(
        self, *, to_email: str, username: str, token: str
    ) -> None:
        """Deliver an email-verification link/token."""
        ...

    def send_password_reset_email(
        self, *, to_email: str, username: str, token: str
    ) -> None:
        """Deliver a password-reset link/token."""
        ...
