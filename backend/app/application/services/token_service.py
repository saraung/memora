"""Refresh-session lifecycle: creation, rotation, reuse detection."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.core.config import settings
from app.core.exceptions import TokenError
from app.core.security import create_access_token, generate_opaque_token, hash_token
from app.infrastructure.database.models.auth import RefreshSession
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    session_repository,
    user_repository,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_session(
    db: Session,
    *,
    user_id: uuid.UUID,
    user_agent: str | None = None,
    ip: str | None = None,
) -> tuple[str, RefreshSession]:
    """Create a new refresh session (new token family)."""
    raw_token = generate_opaque_token()
    record = RefreshSession(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        family_id=uuid.uuid4(),
        expires_at=_utcnow()
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip=ip,
    )
    record = session_repository.create_refresh_session(db, record=record)
    return raw_token, record


def rotate_session(
    db: Session,
    raw_token: str,
    *,
    user_agent: str | None = None,
    ip: str | None = None,
) -> tuple[User, str, str]:
    """Rotate a refresh token, returning (user, access_token, new_token).

    Presenting an already-rotated token is treated as reuse: the whole
    token family is revoked.
    """
    record = session_repository.get_refresh_session_by_hash(
        db, hash_token(raw_token)
    )
    if record is None:
        raise TokenError("Invalid refresh token")

    now = _utcnow()
    if record.replaced_by is not None:
        # Reuse of a rotated token: revoke the entire family.
        session_repository.revoke_family(db, record.family_id, now)
        raise TokenError(
            "Refresh token reuse detected; session family revoked",
            code="TOKEN_REUSED",
        )
    if record.is_revoked or record.is_expired(now):
        raise TokenError("Refresh token is no longer valid")

    user = user_repository.get_by_id(db, record.user_id)
    if user is None:
        raise TokenError("Refresh token is no longer valid")

    new_raw = generate_opaque_token()
    new_record = RefreshSession(
        user_id=record.user_id,
        token_hash=hash_token(new_raw),
        family_id=record.family_id,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip=ip,
    )
    session_repository.create_refresh_session(db, record=new_record)

    record.revoked_at = now
    record.replaced_by = new_record.id
    session_repository.save_refresh_session(db, record)

    return user, create_access_token(user_id=str(user.id)), new_raw


def revoke_session(db: Session, raw_token: str) -> bool:
    """Revoke one session. Idempotent: unknown tokens return False."""
    record = session_repository.get_refresh_session_by_hash(
        db, hash_token(raw_token)
    )
    if record is None or record.is_revoked:
        return False
    record.revoked_at = _utcnow()
    session_repository.save_refresh_session(db, record)
    return True


def revoke_all_sessions(db: Session, user: User) -> int:
    """Revoke every active session of a user. Returns count."""
    return session_repository.revoke_all_for_user(db, user.id, _utcnow())
