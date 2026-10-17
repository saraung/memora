"""Posts, engagement, hashtags, and mentions."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum as SQLEnum, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.domain.enums import PostStatus, ReelStatus, StoryStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _created_at() -> Column:
    return Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class Post(SQLModel, table=True):
    __tablename__ = "posts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    author_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    caption: str | None = Field(default=None, max_length=2200)
    status: PostStatus = Field(
        default=PostStatus.VISIBLE,
        sa_column=Column(
            SQLEnum(PostStatus, name="post_status"),
            nullable=False,
            default=PostStatus.VISIBLE,
        ),
    )
    like_count: int = Field(default=0)
    comment_count: int = Field(default=0)
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


class PostMedia(SQLModel, table=True):
    """Ordered media attachment. Position is unique per post."""

    __tablename__ = "post_media"
    __table_args__ = (
        UniqueConstraint("post_id", "position", name="uq_post_media_position"),
    )

    post_id: uuid.UUID = Field(
        foreign_key="posts.id", primary_key=True, ondelete="CASCADE"
    )
    media_id: uuid.UUID = Field(
        foreign_key="media_assets.id",
        primary_key=True,
        ondelete="RESTRICT",
    )
    position: int = Field(default=0)
    alt_text: str | None = Field(default=None, max_length=255)


class Like(SQLModel, table=True):
    __tablename__ = "likes"

    user_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    post_id: uuid.UUID = Field(
        foreign_key="posts.id",
        primary_key=True,
        ondelete="CASCADE",
        index=True,
    )
    created_at: datetime = Field(sa_column=_created_at())


class Bookmark(SQLModel, table=True):
    __tablename__ = "bookmarks"

    user_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    post_id: uuid.UUID = Field(
        foreign_key="posts.id",
        primary_key=True,
        ondelete="CASCADE",
        index=True,
    )
    created_at: datetime = Field(sa_column=_created_at())


class Comment(SQLModel, table=True):
    __tablename__ = "comments"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    post_id: uuid.UUID = Field(
        foreign_key="posts.id", index=True, ondelete="CASCADE"
    )
    author_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    body: str = Field(max_length=1000)
    parent_id: uuid.UUID | None = Field(
        default=None, foreign_key="comments.id", ondelete="CASCADE"
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


class Hashtag(SQLModel, table=True):
    __tablename__ = "hashtags"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tag: str = Field(max_length=100, unique=True, index=True)


class PostHashtag(SQLModel, table=True):
    __tablename__ = "post_hashtags"

    post_id: uuid.UUID = Field(
        foreign_key="posts.id", primary_key=True, ondelete="CASCADE"
    )
    hashtag_id: uuid.UUID = Field(
        foreign_key="hashtags.id",
        primary_key=True,
        ondelete="CASCADE",
        index=True,
    )


class Mention(SQLModel, table=True):
    __tablename__ = "mentions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    post_id: uuid.UUID = Field(
        foreign_key="posts.id", index=True, ondelete="CASCADE"
    )
    mentioned_user_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(sa_column=_created_at())


class Story(SQLModel, table=True):
    """Ephemeral post. Expiry is time-based; `expires_at` is authoritative."""

    __tablename__ = "stories"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    author_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    media_id: uuid.UUID = Field(
        foreign_key="media_assets.id", ondelete="RESTRICT"
    )
    caption: str | None = Field(default=None, max_length=220)
    status: StoryStatus = Field(
        default=StoryStatus.ACTIVE,
        sa_column=Column(
            SQLEnum(StoryStatus, name="story_status"),
            nullable=False,
            default=StoryStatus.ACTIVE,
        ),
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow, index=True
        )
    )
    expires_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True)
    )


class StoryView(SQLModel, table=True):
    """One row per viewer/story (idempotent rewatches don't duplicate)."""

    __tablename__ = "story_views"

    story_id: uuid.UUID = Field(
        foreign_key="stories.id", primary_key=True, ondelete="CASCADE"
    )
    viewer_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    viewed_at: datetime = Field(sa_column=_created_at())


class Reel(SQLModel, table=True):
    """Short-form video with cover, caption, and counted views."""

    __tablename__ = "reels"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    author_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    video_id: uuid.UUID = Field(
        foreign_key="media_assets.id", ondelete="RESTRICT"
    )
    cover_id: uuid.UUID | None = Field(
        default=None, foreign_key="media_assets.id", ondelete="SET NULL"
    )
    caption: str | None = Field(default=None, max_length=2200)
    status: ReelStatus = Field(
        default=ReelStatus.VISIBLE,
        sa_column=Column(
            SQLEnum(ReelStatus, name="reel_status"),
            nullable=False,
            default=ReelStatus.VISIBLE,
        ),
    )
    view_count: int = Field(default=0)
    like_count: int = Field(default=0)
    comment_count: int = Field(default=0)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=_utcnow, index=True
        )
    )


class ReelView(SQLModel, table=True):
    """Qualified-view records. Deduplicated per viewer per 24h in service."""

    __tablename__ = "reel_views"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    reel_id: uuid.UUID = Field(
        foreign_key="reels.id", index=True, ondelete="CASCADE"
    )
    viewer_id: uuid.UUID | None = Field(
        default=None, foreign_key="users.id", index=True, ondelete="SET NULL"
    )
    viewed_at: datetime = Field(sa_column=_created_at())


class ReelLike(SQLModel, table=True):
    """Likes on reels (idempotent PUT/DELETE like post likes)."""

    __tablename__ = "reel_likes"

    user_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    reel_id: uuid.UUID = Field(
        foreign_key="reels.id",
        primary_key=True,
        ondelete="CASCADE",
        index=True,
    )
    created_at: datetime = Field(sa_column=_created_at())


class ReelComment(SQLModel, table=True):
    """Comments on reels, with optional single-level replies."""

    __tablename__ = "reel_comments"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    reel_id: uuid.UUID = Field(
        foreign_key="reels.id", index=True, ondelete="CASCADE"
    )
    author_id: uuid.UUID = Field(
        foreign_key="users.id", index=True, ondelete="CASCADE"
    )
    body: str = Field(max_length=1000)
    parent_id: uuid.UUID | None = Field(
        default=None, foreign_key="reel_comments.id", ondelete="CASCADE"
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


class ReelBookmark(SQLModel, table=True):
    """Saved moments (idempotent PUT/DELETE like post bookmarks)."""

    __tablename__ = "reel_bookmarks"

    user_id: uuid.UUID = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    reel_id: uuid.UUID = Field(
        foreign_key="reels.id",
        primary_key=True,
        ondelete="CASCADE",
        index=True,
    )
    created_at: datetime = Field(sa_column=_created_at())
