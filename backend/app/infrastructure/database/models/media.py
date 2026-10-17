"""Media assets and upload intents."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum as SQLEnum
from sqlmodel import Field, SQLModel

from app.domain.enums import MediaStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MediaAsset(SQLModel, table=True):
    """Verified file in storage, attachable to posts/stories/reels."""

    __tablename__ = "media_assets"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # Nullable: account deletion orphans assets (SET NULL) instead of
    # being blocked by content references; the orphan GC purges them.
    # Other participants' history keeps working in the meantime.
    owner_id: uuid.UUID | None = Field(
        default=None, foreign_key="users.id", index=True, ondelete="SET NULL"
    )
    provider: str = Field(default="cloudinary", max_length=32)
    public_id: str = Field(max_length=512, unique=True, index=True)
    resource_type: str = Field(default="image", max_length=16)  # image|video
    format: str = Field(default="", max_length=16)
    size_bytes: int = Field(default=0)
    width: int | None = Field(default=None)
    height: int | None = Field(default=None)
    duration: float | None = Field(default=None)
    secure_url: str = Field(default="", max_length=2048)
    version: str = Field(default="", max_length=64)
    status: MediaStatus = Field(
        default=MediaStatus.PENDING,
        sa_column=Column(
            SQLEnum(MediaStatus, name="media_status"),
            nullable=False,
            default=MediaStatus.PENDING,
        ),
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow
        )
    )


class MediaUploadIntent(SQLModel, table=True):
    """Authorized upload slot; completed after the provider upload."""

    __tablename__ = "media_upload_intents"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    public_id: str = Field(max_length=512, unique=True, index=True)
    resource_type: str = Field(max_length=16)  # image|video
    expected_mime: str = Field(max_length=64)
    expected_bytes: int = Field(default=0)
    expires_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    used_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow
        )
    )
