"""Call persistence model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum as SQLEnum
from sqlmodel import Field, SQLModel

from app.domain.enums import CallStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Call(SQLModel, table=True):
    """A voice call between two participants of a direct conversation."""

    __tablename__ = "calls"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(
        foreign_key="conversations.id", index=True, ondelete="CASCADE"
    )
    caller_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    callee_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    status: CallStatus = Field(
        sa_column=Column(
            SQLEnum(CallStatus, name="call_status"),
            nullable=False,
            default=CallStatus.RINGING,
        )
    )
    started_at: datetime | None = Field(
        sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    answered_at: datetime | None = Field(
        sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    ended_at: datetime | None = Field(
        sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    duration_seconds: int | None = Field(default=None)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow, index=True
        )
    )
