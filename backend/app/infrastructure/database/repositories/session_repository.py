"""Persistence operations for refresh sessions and one-time tokens."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlmodel import Session, select

from app.infrastructure.database.models.auth import (
    EmailVerificationToken,
    PasswordResetToken,
    RefreshSession,
)


# -- Refresh sessions -------------------------------------------------------


def create_refresh_session(
    session: Session, *, record: RefreshSession
) -> RefreshSession:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_refresh_session_by_hash(
    session: Session, token_hash: str
) -> RefreshSession | None:
    return session.exec(
        select(RefreshSession).where(RefreshSession.token_hash == token_hash)
    ).first()


def list_active_sessions_for_user(
    session: Session, user_id: uuid.UUID
) -> list[RefreshSession]:
    return list(
        session.exec(
            select(RefreshSession).where(
                RefreshSession.user_id == user_id,
                RefreshSession.revoked_at.is_(None),
            )
        ).all()
    )


def save_refresh_session(
    session: Session, record: RefreshSession
) -> RefreshSession:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def revoke_family(
    session: Session, family_id: uuid.UUID, now: datetime
) -> int:
    """Revoke every non-revoked session in a token family. Returns count."""
    records = session.exec(
        select(RefreshSession).where(
            RefreshSession.family_id == family_id,
            RefreshSession.revoked_at.is_(None),
        )
    ).all()
    for record in records:
        record.revoked_at = now
        session.add(record)
    session.commit()
    return len(records)


def revoke_all_for_user(
    session: Session, user_id: uuid.UUID, now: datetime
) -> int:
    """Revoke every active session of a user. Returns count."""
    records = list_active_sessions_for_user(session, user_id)
    for record in records:
        record.revoked_at = now
        session.add(record)
    session.commit()
    return len(records)


# -- Email verification tokens ----------------------------------------------


def create_email_verification_token(
    session: Session, *, record: EmailVerificationToken
) -> EmailVerificationToken:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_email_verification_token(
    session: Session, token_hash: str
) -> EmailVerificationToken | None:
    return session.exec(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash
        )
    ).first()


# -- Password reset tokens ---------------------------------------------------


def create_password_reset_token(
    session: Session, *, record: PasswordResetToken
) -> PasswordResetToken:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_password_reset_token(
    session: Session, token_hash: str
) -> PasswordResetToken | None:
    return session.exec(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash
        )
    ).first()
