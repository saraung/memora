"""Direct conversations, messages, receipts, and notifications."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum as SQLEnum
from sqlmodel import Field, SQLModel

from app.domain.enums import ConversationType, NotificationType


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _created_at(index: bool = False) -> Column:
    return Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    type: ConversationType = Field(
        default=ConversationType.DIRECT,
        sa_column=Column(
            SQLEnum(ConversationType, name="conversation_type"),
            nullable=False,
            default=ConversationType.DIRECT,
        ),
    )
    # Deterministic DM key "smaller_uuid:larger_uuid" — one thread per pair.
    dm_key: str | None = Field(
        default=None, max_length=73, unique=True, index=True
    )
    last_activity_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    created_at: datetime = Field(sa_column=_created_at())


class ConversationParticipant(SQLModel, table=True):
    __tablename__ = "conversation_participants"

    conversation_id: uuid.UUID = Field(
        foreign_key="conversations.id", primary_key=True, ondelete="CASCADE"
    )
    user_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE", index=True
    )
    joined_at: datetime = Field(sa_column=_created_at())
    left_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    muted: bool = Field(default=False)
    archived: bool = Field(default=False)


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(
        foreign_key="conversations.id", index=True, ondelete="CASCADE"
    )
    sender_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    body: str = Field(max_length=2000)
    is_edited: bool = Field(default=False)
    is_deleted: bool = Field(default=False)
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


class MessageReceipt(SQLModel, table=True):
    """Per-user delivery/read state for a message."""

    __tablename__ = "message_receipts"

    message_id: uuid.UUID = Field(
        foreign_key="messages.id", primary_key=True, ondelete="CASCADE"
    )
    user_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    delivered_at: datetime = Field(sa_column=_created_at())
    read_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class MessageMedia(SQLModel, table=True):
    """Ordered image attachments on a message (caption = body)."""

    __tablename__ = "message_media"

    message_id: uuid.UUID = Field(
        foreign_key="messages.id", primary_key=True, ondelete="CASCADE"
    )
    media_id: uuid.UUID = Field(
        foreign_key="media_assets.id",
        primary_key=True,
        ondelete="RESTRICT",
    )
    position: int = Field(default=0)


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    recipient_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    actor_id: uuid.UUID | None = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    type: NotificationType = Field(
        sa_column=Column(
            SQLEnum(NotificationType, name="notification_type"),
            nullable=False,
        )
    )
    target_type: str | None = Field(default=None, max_length=64)
    target_id: str | None = Field(default=None, max_length=128)
    is_read: bool = Field(default=False)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow, index=True
        )
    )
