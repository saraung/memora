"""Social-graph persistence: follows, follow requests, blocks."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum as SQLEnum,
    UniqueConstraint,
)
from sqlmodel import Field, SQLModel

from app.domain.enums import FollowRequestStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _created_at() -> Column:
    return Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class Follow(SQLModel, table=True):
    """Approved follower relationship. Deleted on unfollow/block."""

    __tablename__ = "follows"
    __table_args__ = (
        CheckConstraint(
            "follower_id != followed_id", name="ck_follows_no_self"
        ),
    )

    follower_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    followed_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(sa_column=_created_at())


class FollowRequest(SQLModel, table=True):
    """Request to follow a private account. One row per pair, resettable."""

    __tablename__ = "follow_requests"
    __table_args__ = (
        UniqueConstraint(
            "requester_id", "target_id", name="uq_follow_requests_pair"
        ),
        CheckConstraint(
            "requester_id != target_id", name="ck_follow_requests_no_self"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    requester_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    target_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    status: FollowRequestStatus = Field(
        default=FollowRequestStatus.PENDING,
        sa_column=Column(
            SQLEnum(FollowRequestStatus, name="follow_request_status"),
            nullable=False,
            default=FollowRequestStatus.PENDING,
        ),
    )
    created_at: datetime = Field(sa_column=_created_at())
    decided_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class Block(SQLModel, table=True):
    """Blocker hides from and is hidden from the blocked user."""

    __tablename__ = "blocks"
    __table_args__ = (
        CheckConstraint("blocker_id != blocked_id", name="ck_blocks_no_self"),
    )

    blocker_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    blocked_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(sa_column=_created_at())
