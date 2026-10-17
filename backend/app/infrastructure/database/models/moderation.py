"""User reports and moderation decisions."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum as SQLEnum
from sqlmodel import Field, SQLModel

from app.domain.enums import (
    ModerationDecision,
    ReportCategory,
    ReportStatus,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Report(SQLModel, table=True):
    __tablename__ = "reports"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    reporter_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="SET NULL", nullable=True
    )
    target_type: str = Field(max_length=32, index=True)
    target_id: str = Field(max_length=128, index=True)
    category: ReportCategory = Field(
        sa_column=Column(
            SQLEnum(ReportCategory, name="report_category"), nullable=False
        )
    )
    details: str | None = Field(default=None, max_length=2000)
    status: ReportStatus = Field(
        default=ReportStatus.PENDING,
        sa_column=Column(
            SQLEnum(ReportStatus, name="report_status"),
            nullable=False,
            default=ReportStatus.PENDING,
            index=True,
        ),
    )
    assigned_to: uuid.UUID | None = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow, index=True
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


class ModerationAction(SQLModel, table=True):
    """One row per applied staff decision (auditable enforcement history)."""

    __tablename__ = "moderation_actions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    moderator_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="SET NULL", nullable=True
    )
    report_id: uuid.UUID | None = Field(
        default=None, foreign_key="reports.id", ondelete="SET NULL", index=True
    )
    target_type: str = Field(max_length=32, index=True)
    target_id: str = Field(max_length=128, index=True)
    decision: ModerationDecision = Field(
        sa_column=Column(
            SQLEnum(ModerationDecision, name="moderation_decision"),
            nullable=False,
        )
    )
    reason: str = Field(max_length=1000)
    expires_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow, index=True
        )
    )
