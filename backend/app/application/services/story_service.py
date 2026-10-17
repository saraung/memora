"""Ephemeral stories: publish, feed, views, owner controls."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.application.pagination import decode_cursor, encode_cursor
from app.core.config import settings
from app.core.exceptions import (
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from app.domain.enums import AccountStatus, MediaStatus, StoryStatus
from app.domain.policies.visibility import (
    ProfileTarget,
    can_view_profile,
)
from app.infrastructure.database.models.content import Story
from app.infrastructure.database.models.media import MediaAsset
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    ephemeral_repository,
    media_repository,
    social_repository,
    user_repository,
)

STORY_TTL = timedelta(hours=24)
MAX_STORY_VIDEO_SECONDS = 60


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class StoryDetail:
    story: Story
    author: User
    media: MediaAsset
    viewed: bool


@dataclass
class AuthorStories:
    author: User
    stories: list[StoryDetail]
    has_unseen: bool


@dataclass
class StoryFeedPage:
    items: list[AuthorStories]
    next_cursor: str | None
    has_more: bool


@dataclass
class StoryListPage:
    items: list[StoryDetail]
    next_cursor: str | None
    has_more: bool


def _target_of(author: User) -> ProfileTarget:
    return ProfileTarget(
        user_id=author.id,
        account_status=author.account_status,
        is_private=author.is_private,
    )


def _check_visible(
    db: Session, *, viewer_id: uuid.UUID | None, story: Story, author: User
) -> None:
    """Raise 404 unless the viewer may see this story.

    Expiry is a hard cutoff: expired stories vanish for everyone,
    including the author, even if cleanup never ran.
    """
    if story.status != StoryStatus.ACTIVE or story.expires_at <= _utcnow():
        raise ResourceNotFoundError("Story not found")
    blocked = (
        social_repository.is_blocked_either_way(db, viewer_id, author.id)
        if viewer_id is not None
        else False
    )
    follows = (
        social_repository.get_follow(db, viewer_id, author.id) is not None
        if viewer_id is not None
        else False
    )
    if not can_view_profile(
        viewer_id=viewer_id,
        target=_target_of(author),
        follows_target=follows,
        blocked_either_way=blocked,
    ):
        raise ResourceNotFoundError("Story not found")


def _detail(
    db: Session,
    story: Story,
    *,
    viewer_id: uuid.UUID | None,
    author: User,
    viewed: bool = False,
) -> StoryDetail:
    media = media_repository.get_asset_by_id(db, story.media_id)
    if media is None:
        raise ResourceNotFoundError("Story not found")
    return StoryDetail(story=story, author=author, media=media, viewed=viewed)


def publish_story(
    db: Session,
    *,
    author: User,
    media_id: uuid.UUID,
    caption: str | None = None,
) -> Story:
    """Publish a photo or short-video story (24h expiry)."""
    if not author.is_active:
        raise ForbiddenError("Your account cannot publish right now")
    asset = media_repository.get_asset_by_id(db, media_id)
    if asset is None:
        raise ValidationError("Media not found")
    if asset.owner_id != author.id:
        raise ForbiddenError("You do not own this media")
    if asset.status != MediaStatus.READY:
        raise ValidationError("Media is not ready yet")
    if asset.resource_type == "video":
        if asset.duration is None or asset.duration <= 0:
            raise ValidationError("Story videos need a readable duration")
        if asset.duration > MAX_STORY_VIDEO_SECONDS:
            raise ValidationError(
                f"Story videos must be {MAX_STORY_VIDEO_SECONDS}s or shorter"
            )
    elif asset.resource_type != "image":
        raise ValidationError("Stories support photos and videos only")
    if caption is not None and len(caption) > 220:
        raise ValidationError("Story captions must be at most 220 characters")

    now = _utcnow()
    return ephemeral_repository.create_story(
        db,
        record=Story(
            author_id=author.id,
            media_id=asset.id,
            caption=caption.strip() if caption and caption.strip() else None,
            created_at=now,
            expires_at=now + STORY_TTL,
        ),
    )


def get_story(
    db: Session, *, viewer_id: uuid.UUID | None, story_id: uuid.UUID
) -> StoryDetail:
    story = ephemeral_repository.get_story_by_id(db, story_id)
    if story is None:
        raise ResourceNotFoundError("Story not found")
    author = user_repository.get_by_id(db, story.author_id)
    if author is None:
        raise ResourceNotFoundError("Story not found")
    _check_visible(db, viewer_id=viewer_id, story=story, author=author)
    viewed = (
        story.id
        in ephemeral_repository.viewed_story_ids(
            db, viewer_id=viewer_id, story_ids=[story.id]
        )
        if viewer_id is not None
        else False
    )
    return _detail(db, story, viewer_id=viewer_id, author=author, viewed=viewed)


def view_story(
    db: Session, *, viewer: User, story_id: uuid.UUID
) -> StoryDetail:
    story = ephemeral_repository.get_story_by_id(db, story_id)
    if story is None:
        raise ResourceNotFoundError("Story not found")
    author = user_repository.get_by_id(db, story.author_id)
    if author is None:
        raise ResourceNotFoundError("Story not found")
    _check_visible(db, viewer_id=viewer.id, story=story, author=author)
    ephemeral_repository.record_story_view(
        db, story_id=story.id, viewer_id=viewer.id, now=_utcnow()
    )
    return _detail(db, story, viewer_id=viewer.id, author=author, viewed=True)


def list_viewers(
    db: Session, *, owner: User, story_id: uuid.UUID
) -> list[User]:
    """Owner-only viewer list. Expired stories stay invisible."""
    story = ephemeral_repository.get_story_by_id(db, story_id)
    if story is None:
        raise ResourceNotFoundError("Story not found")
    _check_visible(db, viewer_id=owner.id, story=story, author=owner)
    if story.author_id != owner.id:
        raise ForbiddenError("Only the story owner can see viewers")
    views = ephemeral_repository.list_story_viewers(db, story.id)
    authors = user_repository.list_by_ids(
        db, list({v.viewer_id for v in views})
    )
    return [authors[v.viewer_id] for v in views if v.viewer_id in authors]


def delete_story(db: Session, *, author: User, story_id: uuid.UUID) -> None:
    story = ephemeral_repository.get_story_by_id(db, story_id)
    if story is None or story.status != StoryStatus.ACTIVE:
        raise ResourceNotFoundError("Story not found")
    if story.author_id != author.id:
        raise ForbiddenError("Only the author can delete this story")
    story.status = StoryStatus.DELETED
    ephemeral_repository.save_story(db, story)


def list_user_stories(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    username: str,
    limit: int,
    cursor: str | None,
) -> StoryListPage:
    """Active stories of one user, gated by profile visibility.

    This is what makes a stranger-discovered public profile's stories
    visible: public → anyone (even logged out); private → followers;
    blocked/inactive → 404.
    """
    target = user_repository.get_by_username(db, username)
    if target is None:
        raise ResourceNotFoundError("User not found")
    blocked = (
        social_repository.is_blocked_either_way(db, viewer_id, target.id)
        if viewer_id is not None
        else False
    )
    follows = (
        social_repository.get_follow(db, viewer_id, target.id) is not None
        if viewer_id is not None
        else False
    )
    if not can_view_profile(
        viewer_id=viewer_id,
        target=_target_of(target),
        follows_target=follows,
        blocked_either_way=blocked,
    ):
        raise ResourceNotFoundError("User not found")

    limit = max(1, min(limit, 50))
    before: tuple[datetime, uuid.UUID] | None = None
    if cursor:
        payload = decode_cursor(cursor)
        try:
            before = (
                datetime.fromisoformat(str(payload["c"])),
                uuid.UUID(str(payload["id"])),
            )
        except (ValueError, KeyError) as exc:
            raise ValidationError("Invalid pagination cursor") from exc
    rows = ephemeral_repository.list_active_stories_before(
        db, author_ids=[target.id], now=_utcnow(), limit=limit, before=before
    )
    seen = (
        ephemeral_repository.viewed_story_ids(
            db, viewer_id=viewer_id, story_ids=[s.id for s in rows[:limit]]
        )
        if viewer_id is not None
        else set()
    )
    items: list[StoryDetail] = []
    for story in rows[:limit]:
        media = media_repository.get_asset_by_id(db, story.media_id)
        if media is None:
            continue
        items.append(
            StoryDetail(
                story=story, author=target, media=media,
                viewed=story.id in seen,
            )
        )
    has_more = len(rows) > limit
    next_cursor = None
    if has_more:
        last = rows[limit - 1]
        next_cursor = encode_cursor(
            {"c": last.created_at.isoformat(), "id": str(last.id)}
        )
    return StoryListPage(items=items, next_cursor=next_cursor, has_more=has_more)


def list_story_feed(
    db: Session,
    *,
    viewer: User,
    limit: int,
    cursor: str | None,
) -> StoryFeedPage:
    """Active stories from followed authors + self, grouped by author."""
    limit = max(1, min(limit, 50))
    before: tuple[datetime, uuid.UUID] | None = None
    if cursor:
        payload = decode_cursor(cursor)
        try:
            before = (
                datetime.fromisoformat(str(payload["c"])),
                uuid.UUID(str(payload["id"])),
            )
        except (ValueError, KeyError) as exc:
            raise ValidationError("Invalid pagination cursor") from exc

    author_ids = social_repository.following_ids(db, viewer.id)
    author_ids.append(viewer.id)
    rows = ephemeral_repository.list_active_stories_before(
        db, author_ids=author_ids, now=_utcnow(), limit=limit, before=before
    )
    authors = user_repository.list_by_ids(db, list({s.author_id for s in rows}))
    blocked = social_repository.blocked_ids_for_user(db, viewer.id)
    viewed = ephemeral_repository.viewed_story_ids(
        db, viewer_id=viewer.id, story_ids=[s.id for s in rows[:limit]]
    )

    groups: dict[uuid.UUID, AuthorStories] = {}
    order: list[uuid.UUID] = []
    for story in rows[:limit]:
        author = authors.get(story.author_id)
        if author is None or author.account_status != AccountStatus.ACTIVE:
            continue
        if author.id in blocked:
            continue
        # Feed members are followed-or-self, but re-check cheaply for safety.
        if author.is_private and author.id != viewer.id:
            if (
                social_repository.get_follow(db, viewer.id, author.id)
                is None
            ):
                continue
        if author.id not in groups:
            groups[author.id] = AuthorStories(
                author=author, stories=[], has_unseen=False
            )
            order.append(author.id)
        detail = StoryDetail(
            story=story,
            author=author,
            media=media_repository.get_asset_by_id(db, story.media_id),
            viewed=story.id in viewed,
        )
        if detail.media is None:
            continue
        groups[author.id].stories.append(detail)
        if story.id not in viewed:
            groups[author.id].has_unseen = True

    # Order groups by their newest story (rows are newest-first already).
    items = [groups[aid] for aid in order]
    has_more = len(rows) > limit
    next_cursor = None
    if has_more:
        last = rows[limit - 1]
        next_cursor = encode_cursor(
            {"c": last.created_at.isoformat(), "id": str(last.id)}
        )
    return StoryFeedPage(items=items, next_cursor=next_cursor, has_more=has_more)
