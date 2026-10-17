"""Audit trail for privileged and security-sensitive actions.

Audit records are never cascade-deleted with users: actor references use
SET NULL so the trail survives account deletion.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuditEvent(SQLModel, table=True):
    __tablename__ = "audit_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    actor_id: uuid.UUID | None = Field(
        default=None, foreign_key="users.id", index=True, ondelete="SET NULL"
    )
    action: str = Field(max_length=128, index=True)
    target_type: str | None = Field(default=None, max_length=64)
    target_id: str | None = Field(default=None, max_length=128)
    request_id: str | None = Field(default=None, max_length=64)
    # Attribute is `meta` because SQLAlchemy reserves `.metadata`.
    meta: dict[str, Any] | None = Field(
        default=None, sa_column=Column("metadata", JSON, nullable=True)
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            index=True,
        )
    )
