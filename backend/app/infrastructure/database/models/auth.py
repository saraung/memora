"""Session and one-time-token persistence models."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _tz_column(nullable: bool = True, **kwargs) -> Column:
    return Column(DateTime(timezone=True), nullable=nullable, **kwargs)


class RefreshSession(SQLModel, table=True):
    """Server-side refresh-token session. Only token hashes are stored."""

    __tablename__ = "refresh_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    token_hash: str = Field(max_length=64, unique=True, index=True)
    family_id: uuid.UUID = Field(default_factory=uuid.uuid4, index=True)
    expires_at: datetime = Field(sa_column=_tz_column(nullable=False))
    revoked_at: datetime | None = Field(
        default=None, sa_column=_tz_column()
    )
    replaced_by: uuid.UUID | None = Field(default=None)
    user_agent: str | None = Field(default=None, max_length=512)
    ip: str | None = Field(default=None, max_length=64)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow
        )
    )

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    def is_expired(self, now: datetime | None = None) -> bool:
        now = now or datetime.now(timezone.utc)
        return self.expires_at <= now


class EmailVerificationToken(SQLModel, table=True):
    """Single-use email verification token (hash only)."""

    __tablename__ = "email_verification_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    token_hash: str = Field(max_length=64, unique=True, index=True)
    expires_at: datetime = Field(sa_column=_tz_column(nullable=False))
    used_at: datetime | None = Field(default=None, sa_column=_tz_column())
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow
        )
    )


class PasswordResetToken(SQLModel, table=True):
    """Single-use password-reset token (hash only)."""

    __tablename__ = "password_reset_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    token_hash: str = Field(max_length=64, unique=True, index=True)
    expires_at: datetime = Field(sa_column=_tz_column(nullable=False))
    used_at: datetime | None = Field(default=None, sa_column=_tz_column())
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow
        )
    )
