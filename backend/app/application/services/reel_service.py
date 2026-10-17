"""Short-form reels: publish, feed, qualified views, likes."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.application.pagination import decode_cursor, encode_cursor
from app.application.services import notification_service
from app.core.exceptions import (
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from app.domain.enums import AccountStatus, MediaStatus, NotificationType, ReelStatus
from app.domain.policies.visibility import (
    ProfileTarget,
    can_view_profile,
)
from app.infrastructure.database.models.content import Reel, ReelComment
from app.infrastructure.database.models.media import MediaAsset
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    ephemeral_repository,
    media_repository,
    social_repository,
    user_repository,
)

# A view only counts when the same viewer hasn't been counted recently.
REEL_VIEW_WINDOW = timedelta(hours=24)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ReelDetail:
    reel: Reel
    author: User
    video: MediaAsset
    cover: MediaAsset | None
    liked: bool
    saved: bool


@dataclass
class ReelPage:
    items: list[ReelDetail]
    next_cursor: str | None
    has_more: bool


@dataclass
class ReelCommentDetail:
    comment: ReelComment
    author: User


@dataclass
class ReelCommentPage:
    items: list[ReelCommentDetail]
    next_cursor: str | None
    has_more: bool


def _visible_reel_or_404(
    db: Session, *, viewer_id: uuid.UUID | None, reel_id: uuid.UUID
) -> Reel:
    reel = ephemeral_repository.get_reel_by_id(db, reel_id)
    if reel is None or reel.status != ReelStatus.VISIBLE:
        raise ResourceNotFoundError("Reel not found")
    author = user_repository.get_by_id(db, reel.author_id)
    if author is None:
        raise ResourceNotFoundError("Reel not found")
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
    if author.account_status != AccountStatus.ACTIVE or not can_view_profile(
        viewer_id=viewer_id,
        target=ProfileTarget(
            user_id=author.id,
            account_status=author.account_status,
            is_private=author.is_private,
        ),
        follows_target=follows,
        blocked_either_way=blocked,
    ):
        raise ResourceNotFoundError("Reel not found")
    return reel


def _detail(
    db: Session,
    reel: Reel,
    *,
    viewer_id: uuid.UUID | None,
    authors: dict[uuid.UUID, User] | None = None,
) -> ReelDetail:
    author = (
        authors.get(reel.author_id)
        if authors is not None
        else user_repository.get_by_id(db, reel.author_id)
    )
    if author is None:
        raise ResourceNotFoundError("Reel not found")
    video = media_repository.get_asset_by_id(db, reel.video_id)
    if video is None:
        raise ResourceNotFoundError("Reel not found")
    cover = (
        media_repository.get_asset_by_id(db, reel.cover_id)
        if reel.cover_id is not None
        else None
    )
    liked = (
        ephemeral_repository.get_reel_like(db, viewer_id, reel.id)
        is not None
        if viewer_id is not None
        else False
    )
    saved = (
        ephemeral_repository.get_reel_bookmark(db, viewer_id, reel.id)
        is not None
        if viewer_id is not None
        else False
    )
    return ReelDetail(
        reel=reel,
        author=author,
        video=video,
        cover=cover,
        liked=liked,
        saved=saved,
    )


def publish_reel(
    db: Session,
    *,
    author: User,
    video_id: uuid.UUID,
    cover_id: uuid.UUID | None = None,
    caption: str | None = None,
) -> Reel:
    """Publish a short video reel with an optional cover image."""
    if not author.is_active:
        raise ForbiddenError("Your account cannot publish right now")
    video = media_repository.get_asset_by_id(db, video_id)
    if video is None:
        raise ValidationError("Video not found")
    if video.owner_id != author.id:
        raise ForbiddenError("You do not own this video")
    if video.status != MediaStatus.READY or video.resource_type != "video":
        raise ValidationError("Reels need a ready video upload")
    cover: MediaAsset | None = None
    if cover_id is not None:
        cover = media_repository.get_asset_by_id(db, cover_id)
        if cover is None:
            raise ValidationError("Cover image not found")
        if cover.owner_id != author.id:
            raise ForbiddenError("You do not own this cover image")
        if cover.status != MediaStatus.READY or cover.resource_type != "image":
            raise ValidationError("Reel covers must be ready images")
    if caption is not None and len(caption) > 2200:
        raise ValidationError("Caption must be at most 2200 characters")

    return ephemeral_repository.create_reel(
        db,
        record=Reel(
            author_id=author.id,
            video_id=video.id,
            cover_id=cover.id if cover else None,
            caption=caption.strip() if caption and caption.strip() else None,
        ),
    )


def get_reel(
    db: Session, *, viewer_id: uuid.UUID | None, reel_id: uuid.UUID
) -> ReelDetail:
    reel = _visible_reel_or_404(
        db, viewer_id=viewer_id, reel_id=reel_id
    )
    return _detail(db, reel, viewer_id=viewer_id)


def delete_reel(db: Session, *, author: User, reel_id: uuid.UUID) -> None:
    reel = ephemeral_repository.get_reel_by_id(db, reel_id)
    if reel is None or reel.status != ReelStatus.VISIBLE:
        raise ResourceNotFoundError("Reel not found")
    if reel.author_id != author.id:
        raise ForbiddenError("Only the author can delete this reel")
    ephemeral_repository.delete_reel(db, reel)


def record_view(
    db: Session, *, viewer_id: uuid.UUID | None, reel_id: uuid.UUID
) -> tuple[ReelDetail, bool]:
    """Record a qualified view. Returns (detail, counted).

    Authenticated viewers count at most once per 24h window;
    anonymous views always count (no identity to deduplicate).
    """
    reel = _visible_reel_or_404(
        db, viewer_id=viewer_id, reel_id=reel_id
    )
    now = _utcnow()
    counted = True
    if viewer_id is not None:
        recent = ephemeral_repository.count_recent_reel_views(
            db,
            reel_id=reel.id,
            viewer_id=viewer_id,
            since=now - REEL_VIEW_WINDOW,
        )
        if recent > 0:
            counted = False
    if counted:
        ephemeral_repository.record_reel_view(
            db, reel_id=reel.id, viewer_id=viewer_id, now=now
        )
        reel.view_count += 1
        ephemeral_repository.save_reel(db, reel)
    return _detail(db, reel, viewer_id=viewer_id), counted


def like_reel(db: Session, *, user: User, reel_id: uuid.UUID) -> str:
    reel = _visible_reel_or_404(
        db, viewer_id=user.id, reel_id=reel_id
    )
    if ephemeral_repository.get_reel_like(db, user.id, reel.id) is None:
        ephemeral_repository.create_reel_like(
            db, user_id=user.id, reel_id=reel.id
        )
        reel.like_count += 1
        ephemeral_repository.save_reel(db, reel)
    return "liked"


def unlike_reel(db: Session, *, user: User, reel_id: uuid.UUID) -> str:
    reel = _visible_reel_or_404(
        db, viewer_id=user.id, reel_id=reel_id
    )
    if ephemeral_repository.delete_reel_like(
        db, user_id=user.id, reel_id=reel.id
    ):
        reel.like_count = max(0, reel.like_count - 1)
        ephemeral_repository.save_reel(db, reel)
    return "unliked"


def bookmark_reel(db: Session, *, user: User, reel_id: uuid.UUID) -> str:
    reel = _visible_reel_or_404(
        db, viewer_id=user.id, reel_id=reel_id
    )
    if ephemeral_repository.get_reel_bookmark(db, user.id, reel.id) is None:
        ephemeral_repository.create_reel_bookmark(
            db, user_id=user.id, reel_id=reel.id
        )
    return "saved"


def unbookmark_reel(db: Session, *, user: User, reel_id: uuid.UUID) -> str:
    reel = _visible_reel_or_404(
        db, viewer_id=user.id, reel_id=reel_id
    )
    ephemeral_repository.delete_reel_bookmark(
        db, user_id=user.id, reel_id=reel.id
    )
    return "unsaved"


def list_saved_reels(
    db: Session,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> ReelPage:
    """The authenticated user's private list of saved moments."""
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

    rows = ephemeral_repository.list_bookmarked_reels_before(
        db, user_id=user.id, limit=limit, before=before
    )
    authors = user_repository.list_by_ids(
        db, list({reel.author_id for reel, _ in rows[:limit]})
    )
    items: list[ReelDetail] = []
    for reel, _ in rows[:limit]:
        try:
            items.append(
                _detail(db, reel, viewer_id=user.id, authors=authors)
            )
        except ResourceNotFoundError:
            continue
    has_more = len(rows) > limit
    next_cursor = None
    if has_more:
        last_reel, last_at = rows[limit - 1]
        next_cursor = encode_cursor(
            {"c": last_at.isoformat(), "id": str(last_reel.id)}
        )
    return ReelPage(items=items, next_cursor=next_cursor, has_more=has_more)


def list_user_reels(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    username: str,
    limit: int,
    cursor: str | None,
) -> ReelPage:
    """Visible reels of one user, gated by profile visibility.

    Public → anyone (even logged out); private → followers;
    blocked/inactive → 404, mirroring the stories listing.
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
        target=ProfileTarget(
            user_id=target.id,
            account_status=target.account_status,
            is_private=target.is_private,
        ),
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

    rows = ephemeral_repository.list_visible_reels_before(
        db, author_ids=[target.id], limit=limit, before=before
    )
    authors = {target.id: target}
    items: list[ReelDetail] = []
    for reel in rows[:limit]:
        try:
            items.append(_detail(db, reel, viewer_id=viewer_id, authors=authors))
        except ResourceNotFoundError:
            continue

    has_more = len(rows) > limit
    next_cursor = None
    if has_more:
        last = rows[limit - 1]
        next_cursor = encode_cursor(
            {"c": last.created_at.isoformat(), "id": str(last.id)}
        )
    return ReelPage(items=items, next_cursor=next_cursor, has_more=has_more)


def get_reel_feed(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    limit: int,
    cursor: str | None,
) -> ReelPage:
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

    rows = ephemeral_repository.list_visible_reels_before(
        db, author_ids=None, limit=limit, before=before
    )
    blocked: set[uuid.UUID] = set()
    if viewer_id is not None:
        blocked = social_repository.blocked_ids_for_user(db, viewer_id)
    authors = user_repository.list_by_ids(
        db, list({r.author_id for r in rows[:limit]})
    )
    follows_cache: dict[uuid.UUID, bool] = {}

    def follows(author_id: uuid.UUID) -> bool:
        if viewer_id is None:
            return False
        if author_id not in follows_cache:
            follows_cache[author_id] = (
                social_repository.get_follow(db, viewer_id, author_id)
                is not None
            )
        return follows_cache[author_id]

    items: list[ReelDetail] = []
    for reel in rows[:limit]:
        author = authors.get(reel.author_id)
        if author is None or author.account_status != AccountStatus.ACTIVE:
            continue
        if author.id in blocked:
            continue
        if author.is_private and not (
            viewer_id == author.id or follows(author.id)
        ):
            continue
        try:
            items.append(_detail(db, reel, viewer_id=viewer_id, authors=authors))
        except ResourceNotFoundError:
            continue

    has_more = len(rows) > limit
    next_cursor = None
    if has_more:
        last = rows[limit - 1]
        next_cursor = encode_cursor(
            {"c": last.created_at.isoformat(), "id": str(last.id)}
        )
    return ReelPage(items=items, next_cursor=next_cursor, has_more=has_more)


# -- Comments ---------------------------------------------------------------------


def create_reel_comment(
    db: Session,
    *,
    author: User,
    reel_id: uuid.UUID,
    body: str,
    parent_id: uuid.UUID | None = None,
) -> ReelComment:
    reel = _visible_reel_or_404(db, viewer_id=author.id, reel_id=reel_id)
    body = body.strip()
    if not body or len(body) > 1000:
        raise ValidationError(
            "Comment must be 1–1000 characters",
            details={"field": "body"},
        )
    parent: ReelComment | None = None
    if parent_id is not None:
        parent = ephemeral_repository.get_reel_comment_by_id(db, parent_id)
        if parent is None or parent.reel_id != reel.id:
            raise ValidationError(
                "Parent comment does not belong to this reel",
                details={"field": "parent_id"},
            )
    comment = ephemeral_repository.create_reel_comment(
        db,
        record=ReelComment(
            reel_id=reel.id,
            author_id=author.id,
            body=body,
            parent_id=parent_id,
        ),
    )
    reel.comment_count = (reel.comment_count or 0) + 1
    ephemeral_repository.save_reel(db, reel)
    notification_service.notify(
        db,
        recipient_id=reel.author_id,
        actor_id=author.id,
        type=NotificationType.COMMENT,
        target_type="reel",
        target_id=str(reel.id),
    )
    # A reply also pings the commenter being answered (unless that's the
    # reel author, who was already notified above).
    if parent is not None and parent.author_id != reel.author_id:
        notification_service.notify(
            db,
            recipient_id=parent.author_id,
            actor_id=author.id,
            type=NotificationType.COMMENT,
            target_type="reel",
            target_id=str(reel.id),
        )
    return comment


def delete_reel_comment(
    db: Session, *, actor: User, reel_id: uuid.UUID, comment_id: uuid.UUID
) -> None:
    comment = ephemeral_repository.get_reel_comment_by_id(db, comment_id)
    if comment is None or comment.reel_id != reel_id:
        raise ResourceNotFoundError("Comment not found")
    reel = _visible_reel_or_404(db, viewer_id=actor.id, reel_id=reel_id)
    if comment.author_id != actor.id and reel.author_id != actor.id:
        raise ForbiddenError(
            "Only the comment author or reel author can delete this comment"
        )
    ephemeral_repository.delete_reel_comment(db, comment)
    reel.comment_count = max(0, (reel.comment_count or 0) - 1)
    ephemeral_repository.save_reel(db, reel)


def list_reel_comments(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    reel_id: uuid.UUID,
    limit: int,
    cursor: str | None,
) -> ReelCommentPage:
    _visible_reel_or_404(db, viewer_id=viewer_id, reel_id=reel_id)
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
    rows = ephemeral_repository.list_reel_comments_before(
        db, reel_id=reel_id, limit=limit, before=before
    )
    authors = user_repository.list_by_ids(
        db, list({c.author_id for c in rows[:limit]})
    )
    items = [
        ReelCommentDetail(comment=c, author=authors[c.author_id])
        for c in rows[:limit]
        if c.author_id in authors
    ]
    has_more = len(rows) > limit
    next_cursor = None
    if has_more and items:
        last = items[-1].comment
        next_cursor = encode_cursor(
            {"c": last.created_at.isoformat(), "id": str(last.id)}
        )
    return ReelCommentPage(
        items=items, next_cursor=next_cursor, has_more=has_more
    )
