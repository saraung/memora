"""User persistence model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, Enum as SQLEnum
from sqlmodel import Field, SQLModel

from app.domain.enums import AccountStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """Registered account. Email/username are stored normalized (lowercase)."""

    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(max_length=254, unique=True, index=True)
    username: str = Field(max_length=30, unique=True, index=True)
    password_hash: str = Field(max_length=255)
    display_name: str = Field(max_length=80)
    is_verified: bool = Field(default=False)
    account_status: AccountStatus = Field(
        default=AccountStatus.ACTIVE,
        sa_column=Column(
            SQLEnum(AccountStatus, name="account_status"),
            nullable=False,
            default=AccountStatus.ACTIVE,
        ),
    )
    is_private: bool = Field(default=False)
    bio: str | None = Field(default=None, max_length=160)
    avatar_url: str | None = Field(default=None, max_length=2048)
    # Public profile links (e.g. website, social). Plain JSON list of URLs.
    links: list[str] | None = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    last_seen_at: datetime | None = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=True, default=_utcnow
        )
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            onupdate=_utcnow,
        )
    )

    @property
    def is_active(self) -> bool:
        return self.account_status == AccountStatus.ACTIVE
