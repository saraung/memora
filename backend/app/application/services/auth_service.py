"""Authentication use cases: register, login, verify, password reset."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.application.dto.auth import AuthResult
from app.application.interfaces.email import EmailSender
from app.application.services import token_service
from app.core.config import settings
from app.core.exceptions import (
    AccountInactiveError,
    ConflictError,
    InvalidCredentialsError,
    TokenError,
    ValidationError,
)
from app.core.security import (
    create_access_token,
    generate_opaque_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.domain.enums import AccountStatus
from app.infrastructure.database.models.auth import (
    EmailVerificationToken,
    PasswordResetToken,
)
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    audit_repository,
    session_repository,
    user_repository,
)

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,30}$")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def validate_username(username: str) -> str:
    """Normalize and validate a username. Raises ValidationError."""
    normalized = username.strip().lower()
    if not USERNAME_RE.match(normalized):
        raise ValidationError(
            "Username must be 3-30 characters: letters, numbers, underscore",
            details={"field": "username"},
        )
    return normalized


def validate_password(password: str) -> None:
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        raise ValidationError(
            f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters",
            details={"field": "password"},
        )


def _ensure_active(user: User) -> None:
    if user.account_status == AccountStatus.DELETED:
        raise InvalidCredentialsError()  # do not reveal deletion
    if not user.is_active:
        raise AccountInactiveError(
            f"This account is {user.account_status.value}"
        )


def register(
    db: Session,
    *,
    email: str,
    username: str,
    password: str,
    display_name: str | None,
    email_sender: EmailSender,
    user_agent: str | None = None,
    ip: str | None = None,
    request_id: str | None = None,
) -> AuthResult:
    """Create an account, issue tokens, and send a verification email."""
    email = email.strip().lower()
    username = validate_username(username)
    validate_password(password)

    if user_repository.get_by_email(db, email) is not None:
        raise ConflictError("An account with this email already exists")
    if user_repository.get_by_username(db, username) is not None:
        raise ConflictError("This username is already taken")

    user = user_repository.create(
        db,
        email=email,
        username=username,
        password_hash=hash_password(password),
        display_name=display_name.strip() if display_name else username,
    )

    raw_verify = generate_opaque_token(32)
    session_repository.create_email_verification_token(
        db,
        record=EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_token(raw_verify),
            expires_at=_utcnow()
            + timedelta(hours=settings.EMAIL_TOKEN_EXPIRE_HOURS),
        ),
    )
    email_sender.send_verification_email(
        to_email=user.email, username=user.username, token=raw_verify
    )

    raw_refresh, _ = token_service.create_session(
        db, user_id=user.id, user_agent=user_agent, ip=ip
    )
    audit_repository.record(
        db,
        action="auth.register",
        actor_id=user.id,
        target_type="user",
        target_id=str(user.id),
        request_id=request_id,
    )
    return AuthResult(
        user=user,
        access_token=create_access_token(user_id=str(user.id)),
        refresh_token=raw_refresh,
    )


def login(
    db: Session,
    *,
    identifier: str,
    password: str,
    user_agent: str | None = None,
    ip: str | None = None,
) -> AuthResult:
    """Authenticate by email or username and open a new session."""
    identifier = identifier.strip().lower()
    user = user_repository.get_by_email(db, identifier)
    if user is None:
        user = user_repository.get_by_username(db, identifier)
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentialsError()
    _ensure_active(user)

    raw_refresh, _ = token_service.create_session(
        db, user_id=user.id, user_agent=user_agent, ip=ip
    )
    return AuthResult(
        user=user,
        access_token=create_access_token(user_id=str(user.id)),
        refresh_token=raw_refresh,
    )


def verify_email(db: Session, raw_token: str) -> User:
    """Mark an account verified with a one-time token."""
    record = session_repository.get_email_verification_token(
        db, hash_token(raw_token)
    )
    now = _utcnow()
    if record is None or record.used_at is not None or record.expires_at <= now:
        raise TokenError("Invalid or expired verification token")
    user = user_repository.get_by_id(db, record.user_id)
    if user is None:
        raise TokenError("Invalid or expired verification token")
    record.used_at = now
    db.add(record)
    user.is_verified = True
    return user_repository.save(db, user)


def request_password_reset(
    db: Session, *, email: str, email_sender: EmailSender
) -> None:
    """Create a reset token and email it. Always succeeds silently."""
    user = user_repository.get_by_email(db, email)
    if user is None or not user.is_active:
        return  # do not reveal whether the email exists
    raw_token = generate_opaque_token(32)
    session_repository.create_password_reset_token(
        db,
        record=PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=_utcnow()
            + timedelta(hours=settings.PASSWORD_RESET_EXPIRE_HOURS),
        ),
    )
    email_sender.send_password_reset_email(
        to_email=user.email, username=user.username, token=raw_token
    )


def reset_password(
    db: Session,
    *,
    raw_token: str,
    new_password: str,
    request_id: str | None = None,
) -> User:
    """Set a new password, invalidate the token, revoke all sessions."""
    validate_password(new_password)
    record = session_repository.get_password_reset_token(
        db, hash_token(raw_token)
    )
    now = _utcnow()
    if record is None or record.used_at is not None or record.expires_at <= now:
        raise TokenError("Invalid or expired reset token")
    user = user_repository.get_by_id(db, record.user_id)
    if user is None or not user.is_active:
        raise TokenError("Invalid or expired reset token")
    record.used_at = now
    db.add(record)
    user.password_hash = hash_password(new_password)
    user = user_repository.save(db, user)
    token_service.revoke_all_sessions(db, user)
    audit_repository.record(
        db,
        action="auth.password_reset",
        actor_id=user.id,
        target_type="user",
        target_id=str(user.id),
        request_id=request_id,
    )
    return user


def get_user_or_raise(db: Session, user_id: uuid.UUID) -> User:
    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise InvalidCredentialsError("Account not found")
    _ensure_active(user)
    return user
