"""Posts, engagement, comments, bookmarks, and feeds."""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.application.pagination import decode_cursor, encode_cursor
from app.application.services import notification_service
from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from app.domain.enums import (
    AccountStatus,
    MediaStatus,
    NotificationType,
    PostStatus,
)
from app.domain.policies.visibility import (
    ProfileTarget,
    can_view_profile,
)
from app.infrastructure.database.models.content import Comment, Post
from app.infrastructure.database.models.media import MediaAsset
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    content_repository,
    media_repository,
    social_repository,
    user_repository,
)

HASHTAG_RE = re.compile(r"#([A-Za-z0-9_]{1,100})")
MENTION_RE = re.compile(r"@([A-Za-z0-9_]{3,30})")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class PostDetail:
    post: Post
    author: User
    media: list[tuple[MediaAsset, str | None]]
    liked: bool
    bookmarked: bool
    source: str = "following"  # "following" | "discovery"


@dataclass
class PostPage:
    items: list[PostDetail]
    next_cursor: str | None
    has_more: bool


@dataclass
class CommentDetail:
    comment: Comment
    author: User


@dataclass
class CommentPage:
    items: list[CommentDetail]
    next_cursor: str | None
    has_more: bool


# -- Visibility -------------------------------------------------------------


def _post_or_404(db: Session, post_id: uuid.UUID) -> Post:
    post = content_repository.get_post_by_id(db, post_id)
    if post is None or post.status != PostStatus.VISIBLE:
        raise ResourceNotFoundError("Post not found")
    return post


def _author_or_404(db: Session, author_id: uuid.UUID) -> User:
    author = user_repository.get_by_id(db, author_id)
    if author is None:
        raise ResourceNotFoundError("Post not found")
    return author


def visible_post_or_404(
    db: Session, *, viewer_id: uuid.UUID | None, post_id: uuid.UUID
) -> Post:
    """Fetch a post the viewer is allowed to see (404 otherwise)."""
    post = _post_or_404(db, post_id)
    author = _author_or_404(db, post.author_id)
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
        target=ProfileTarget(
            user_id=author.id,
            account_status=author.account_status,
            is_private=author.is_private,
        ),
        follows_target=follows,
        blocked_either_way=blocked,
    ):
        raise ResourceNotFoundError("Post not found")
    return post


def _detail(
    db: Session,
    post: Post,
    *,
    viewer_id: uuid.UUID | None,
    authors: dict[uuid.UUID, User] | None = None,
    source: str = "following",
) -> PostDetail:
    author = (
        authors.get(post.author_id)
        if authors is not None
        else _author_or_404(db, post.author_id)
    )
    if author is None:
        raise ResourceNotFoundError("Post not found")
    media_ids = content_repository.list_post_media_ids(db, post.id)
    assets = {
        asset.id: asset
        for asset in media_repository.get_assets_by_ids(db, media_ids)
    }
    links = content_repository.list_post_media_links(db, post.id)
    media = [
        (assets[link.media_id], link.alt_text)
        for link in links
        if link.media_id in assets
    ]
    liked = (
        content_repository.get_like(db, viewer_id, post.id) is not None
        if viewer_id is not None
        else False
    )
    bookmarked = (
        content_repository.get_bookmark(db, viewer_id, post.id) is not None
        if viewer_id is not None
        else False
    )
    return PostDetail(
        post=post, author=author, media=media, liked=liked,
        bookmarked=bookmarked, source=source,
    )


def get_post_detail(
    db: Session, post: Post, *, viewer_id: uuid.UUID | None
) -> PostDetail:
    """Public wrapper around the detail builder for API translation."""
    return _detail(db, post, viewer_id=viewer_id)


# -- Posts --------------------------------------------------------------------


def create_post(
    db: Session,
    *,
    author: User,
    caption: str | None,
    items: list[dict],
) -> Post:
    """Create a post from the author's verified-ready media."""
    if not author.is_active:
        raise ForbiddenError("Your account cannot publish right now")
    max_files = settings.MEDIA_MAX_FILES_PER_POST
    if not items or len(items) > max_files:
        raise ValidationError(
            f"A post needs 1–{max_files} media items",
            details={"field": "items"},
        )
    if caption is not None and len(caption) > 2200:
        raise ValidationError(
            "Caption must be at most 2200 characters",
            details={"field": "caption"},
        )
    asset_ids = []
    for item in items:
        try:
            asset_ids.append(uuid.UUID(str(item.get("media_id"))))
        except (ValueError, AttributeError) as exc:
            raise ValidationError("Invalid media_id") from exc
    assets = {
        asset.id: asset
        for asset in media_repository.get_assets_by_ids(db, asset_ids)
    }
    ordered: list[MediaAsset] = []
    for asset_id in asset_ids:
        asset = assets.get(asset_id)
        if asset is None:
            raise ValidationError(
                "One or more media items do not exist",
                details={"field": "items"},
            )
        if asset.owner_id != author.id:
            raise ForbiddenError("You do not own one of these media items")
        if asset.status != MediaStatus.READY:
            raise ValidationError(
                "One or more media items are not ready",
                details={"field": "items"},
            )
        ordered.append(asset)

    post = content_repository.create_post(
        db,
        record=Post(
            author_id=author.id,
            caption=caption.strip() if caption and caption.strip() else None,
        ),
    )
    for position, asset in enumerate(ordered):
        alt = items[position].get("alt_text")
        content_repository.add_post_media(
            db,
            post_id=post.id,
            media_id=asset.id,
            position=position,
            alt_text=str(alt)[:255] if alt else None,
        )

    if post.caption:
        for tag in set(HASHTAG_RE.findall(post.caption)):
            hashtag = content_repository.get_or_create_hashtag(
                db, tag=tag.lower()
            )
            content_repository.link_post_hashtag(
                db, post_id=post.id, hashtag_id=hashtag.id
            )
        for username in set(MENTION_RE.findall(post.caption)):
            mentioned = user_repository.get_by_username(db, username)
            if mentioned is not None and mentioned.id != author.id:
                content_repository.create_mention(
                    db, post_id=post.id, mentioned_user_id=mentioned.id
                )
                notification_service.notify(
                    db,
                    recipient_id=mentioned.id,
                    actor_id=author.id,
                    type=NotificationType.MENTION,
                    target_type="post",
                    target_id=str(post.id),
                )
    return post


def edit_post(
    db: Session, *, author: User, post_id: uuid.UUID, caption: str | None
) -> Post:
    post = _post_or_404(db, post_id)
    if post.author_id != author.id:
        raise ForbiddenError("Only the author can edit this post")
    if caption is not None and len(caption) > 2200:
        raise ValidationError(
            "Caption must be at most 2200 characters",
            details={"field": "caption"},
        )
    post.caption = caption.strip() if caption and caption.strip() else None
    return content_repository.save_post(db, post)


def delete_post(db: Session, *, author: User, post_id: uuid.UUID) -> None:
    post = _post_or_404(db, post_id)
    if post.author_id != author.id:
        raise ForbiddenError("Only the author can delete this post")
    content_repository.delete_post(db, post)


# -- Likes / bookmarks ----------------------------------------------------------


def like_post(
    db: Session, *, user: User, post_id: uuid.UUID
) -> str:
    post = visible_post_or_404(db, viewer_id=user.id, post_id=post_id)
    if content_repository.get_like(db, user.id, post.id) is None:
        content_repository.create_like(db, user_id=user.id, post_id=post.id)
        content_repository.adjust_counts(db, post, likes=1)
        notification_service.notify(
            db,
            recipient_id=post.author_id,
            actor_id=user.id,
            type=NotificationType.LIKE,
            target_type="post",
            target_id=str(post.id),
        )
    return "liked"


def unlike_post(
    db: Session, *, user: User, post_id: uuid.UUID
) -> str:
    post = visible_post_or_404(db, viewer_id=user.id, post_id=post_id)
    if content_repository.delete_like(db, user_id=user.id, post_id=post.id):
        content_repository.adjust_counts(db, post, likes=-1)
    return "unliked"


def bookmark_post(
    db: Session, *, user: User, post_id: uuid.UUID
) -> str:
    post = visible_post_or_404(db, viewer_id=user.id, post_id=post_id)
    if content_repository.get_bookmark(db, user.id, post.id) is None:
        content_repository.create_bookmark(
            db, user_id=user.id, post_id=post.id
        )
    return "bookmarked"


def unbookmark_post(
    db: Session, *, user: User, post_id: uuid.UUID
) -> str:
    post = visible_post_or_404(db, viewer_id=user.id, post_id=post_id)
    content_repository.delete_bookmark(db, user_id=user.id, post_id=post.id)
    return "unbookmarked"


def list_bookmarks(
    db: Session,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> PostPage:
    limit = max(1, min(limit, 50))
    before = _decode_post_cursor(cursor, kind="bookmark")
    rows = content_repository.list_bookmarked_posts_before(
        db, user_id=user.id, limit=limit, before=before
    )
    return _build_post_page(
        db, rows, viewer_id=user.id, limit=limit, cursor_kind="bookmark"
    )


# -- Comments ---------------------------------------------------------------------


def create_comment(
    db: Session,
    *,
    author: User,
    post_id: uuid.UUID,
    body: str,
    parent_id: uuid.UUID | None = None,
) -> Comment:
    post = visible_post_or_404(db, viewer_id=author.id, post_id=post_id)
    body = body.strip()
    if not body or len(body) > 1000:
        raise ValidationError(
            "Comment must be 1–1000 characters",
            details={"field": "body"},
        )
    parent: Comment | None = None
    if parent_id is not None:
        parent = content_repository.get_comment_by_id(db, parent_id)
        if parent is None or parent.post_id != post.id:
            raise ValidationError(
                "Parent comment does not belong to this post",
                details={"field": "parent_id"},
            )
    comment = content_repository.create_comment(
        db,
        record=Comment(
            post_id=post.id, author_id=author.id, body=body,
            parent_id=parent_id,
        ),
    )
    content_repository.adjust_counts(db, post, comments=1)
    notification_service.notify(
        db,
        recipient_id=post.author_id,
        actor_id=author.id,
        type=NotificationType.COMMENT,
        target_type="post",
        target_id=str(post.id),
    )
    # A reply also pings the commenter being answered (unless that's the
    # post author, who was already notified above).
    if parent is not None and parent.author_id != post.author_id:
        notification_service.notify(
            db,
            recipient_id=parent.author_id,
            actor_id=author.id,
            type=NotificationType.COMMENT,
            target_type="post",
            target_id=str(post.id),
        )
    for username in set(MENTION_RE.findall(body)):
        mentioned = user_repository.get_by_username(db, username)
        if mentioned is not None and mentioned.id != author.id:
            content_repository.create_mention(
                db, post_id=post.id, mentioned_user_id=mentioned.id
            )
            notification_service.notify(
                db,
                recipient_id=mentioned.id,
                actor_id=author.id,
                type=NotificationType.MENTION,
                target_type="post",
                target_id=str(post.id),
            )
    return comment


def edit_comment(
    db: Session, *, author: User, comment_id: uuid.UUID, body: str
) -> Comment:
    comment = content_repository.get_comment_by_id(db, comment_id)
    if comment is None:
        raise ResourceNotFoundError("Comment not found")
    visible_post_or_404(db, viewer_id=author.id, post_id=comment.post_id)
    if comment.author_id != author.id:
        raise ForbiddenError("Only the author can edit this comment")
    body = body.strip()
    if not body or len(body) > 1000:
        raise ValidationError(
            "Comment must be 1–1000 characters",
            details={"field": "body"},
        )
    comment.body = body
    return content_repository.save_comment(db, comment)


def delete_comment(
    db: Session, *, actor: User, comment_id: uuid.UUID
) -> None:
    comment = content_repository.get_comment_by_id(db, comment_id)
    if comment is None:
        raise ResourceNotFoundError("Comment not found")
    post = visible_post_or_404(db, viewer_id=actor.id, post_id=comment.post_id)
    if comment.author_id != actor.id and post.author_id != actor.id:
        raise ForbiddenError(
            "Only the comment author or post author can delete this comment"
        )
    content_repository.delete_comment(db, comment)
    content_repository.adjust_counts(db, post, comments=-1)


def list_comments(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    post_id: uuid.UUID,
    limit: int,
    cursor: str | None,
) -> CommentPage:
    visible_post_or_404(db, viewer_id=viewer_id, post_id=post_id)
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
    rows = content_repository.list_comments_before(
        db, post_id=post_id, limit=limit, before=before
    )
    authors = user_repository.list_by_ids(
        db, list({c.author_id for c in rows[:limit]})
    )
    items = [
        CommentDetail(comment=c, author=authors[c.author_id])
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
    return CommentPage(items=items, next_cursor=next_cursor, has_more=has_more)


# -- Feeds ------------------------------------------------------------------------


def _decode_post_cursor(
    cursor: str | None, *, kind: str
) -> tuple[datetime, uuid.UUID] | None:
    if not cursor:
        return None
    payload = decode_cursor(cursor)
    try:
        return (
            datetime.fromisoformat(str(payload["c"])),
            uuid.UUID(str(payload["id"])),
        )
    except (ValueError, KeyError) as exc:
        raise ValidationError("Invalid pagination cursor") from exc


def _encode_post_cursor(post: Post) -> str:
    return encode_cursor(
        {"c": post.created_at.isoformat(), "id": str(post.id)}
    )


def _build_post_page(
    db: Session,
    rows: list,
    *,
    viewer_id: uuid.UUID | None,
    limit: int,
    cursor_kind: str,
) -> PostPage:
    """Filter rows through the visibility policy and build details."""
    if cursor_kind == "bookmark":
        posts = [post for post, _ in rows[:limit]]
        last_stamp = rows[limit - 1][1] if len(rows) >= limit else None
        last_id = rows[limit - 1][0].id if len(rows) >= limit else None
        has_more = len(rows) > limit
    else:
        posts = rows[:limit]
        last_stamp = posts[-1].created_at if posts else None
        last_id = posts[-1].id if posts else None
        has_more = len(rows) > limit

    blocked: set[uuid.UUID] = set()
    if viewer_id is not None:
        blocked = social_repository.blocked_ids_for_user(db, viewer_id)
    authors = user_repository.list_by_ids(
        db, list({p.author_id for p in posts})
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

    items: list[PostDetail] = []
    for post in posts:
        author = authors.get(post.author_id)
        if author is None or author.account_status != AccountStatus.ACTIVE:
            continue
        if author.id in blocked:
            continue
        if not can_view_profile(
            viewer_id=viewer_id,
            target=ProfileTarget(
                user_id=author.id,
                account_status=author.account_status,
                is_private=author.is_private,
            ),
            follows_target=follows(author.id),
            blocked_either_way=author.id in blocked,
        ):
            continue
        items.append(_detail(db, post, viewer_id=viewer_id, authors=authors))

    next_cursor = None
    if has_more and last_stamp is not None and last_id is not None:
        stamp = (
            last_stamp.isoformat()
            if isinstance(last_stamp, datetime)
            else str(last_stamp)
        )
        next_cursor = encode_cursor({"c": stamp, "id": str(last_id)})
    return PostPage(items=items, next_cursor=next_cursor, has_more=has_more)


# Cold-start discovery: viewers with fewer follows get recent popular
# public posts blended behind their follows content. No ML — engagement
# velocity over a recency window.
COLD_START_FOLLOW_THRESHOLD = 5
FALLBACK_WINDOW_DAYS = 7
FALLBACK_CANDIDATES = 200


def _velocity(post: Post, now: datetime) -> float:
    age_hours = max((now - post.created_at).total_seconds() / 3600, 1.0)
    return (post.like_count + 2 * post.comment_count) / age_hours


def _decode_feed_cursor(
    cursor: str | None,
) -> tuple[tuple[datetime, uuid.UUID] | None, uuid.UUID | None]:
    """Split the blended cursor into (follows position, fallback resume id)."""
    if not cursor:
        return None, None
    try:
        payload = decode_cursor(cursor)
    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError("Invalid pagination cursor") from exc
    try:
        before: tuple[datetime, uuid.UUID] | None = None
        if payload.get("c") and payload.get("id"):
            before = (
                datetime.fromisoformat(str(payload["c"])),
                uuid.UUID(str(payload["id"])),
            )
        fid = payload.get("fid")
        return before, uuid.UUID(str(fid)) if fid else None
    except (ValueError, KeyError) as exc:
        raise ValidationError("Invalid pagination cursor") from exc


def _merge_feed_cursor(
    follows_cursor: str | None, last_fid: uuid.UUID | None
) -> str | None:
    if follows_cursor is None and last_fid is None:
        return None
    payload: dict[str, str | None] = {}
    if follows_cursor is not None:
        payload.update(decode_cursor(follows_cursor))
    if last_fid is not None:
        payload["fid"] = str(last_fid)
    return encode_cursor(payload)


def _discovery_fill(
    db: Session,
    *,
    viewer: User,
    need: int,
    exclude_ids: set[uuid.UUID],
    after_id: uuid.UUID | None,
) -> tuple[list[PostDetail], uuid.UUID | None, bool]:
    """Recent popular public posts, velocity-ranked.

    Returns (details, last_shown_id, exhausted). Resume is positional:
    recompute the ranked pool and slice after the last shown id.
    """
    now = _utcnow()
    pool = content_repository.list_posts_before(
        db,
        author_ids=None,
        limit=FALLBACK_CANDIDATES,
        since=now - timedelta(days=FALLBACK_WINDOW_DAYS),
    )
    if not pool:
        return [], None, True
    authors = user_repository.list_by_ids(
        db, list({p.author_id for p in pool})
    )
    blocked = social_repository.blocked_ids_for_user(db, viewer.id)
    ranked: list[tuple[float, Post]] = []
    for post in pool:
        author = authors.get(post.author_id)
        if author is None or author.account_status != AccountStatus.ACTIVE:
            continue
        if author.is_private or author.id in blocked or author.id == viewer.id:
            continue
        if post.id in exclude_ids:
            continue
        ranked.append((_velocity(post, now), post))
    ranked.sort(key=lambda pair: (pair[0], pair[1].created_at), reverse=True)
    ordered = [post for _, post in ranked]
    if after_id is not None:
        try:
            idx = next(
                i for i, post in enumerate(ordered) if post.id == after_id
            )
            ordered = ordered[idx + 1 :]
        except StopIteration:
            pass  # pool shifted; restart from the top
    chosen = ordered[:need]
    details: list[PostDetail] = []
    liked_map = content_repository.liked_post_ids(
        db, user_id=viewer.id, post_ids=[p.id for p in chosen]
    )
    for post in chosen:
        detail = _detail(
            db,
            post,
            viewer_id=viewer.id,
            authors=authors,
            source="discovery",
        )
        detail.liked = post.id in liked_map
        details.append(detail)
    exhausted = len(ordered) <= need
    last_id = chosen[-1].id if chosen else None
    return details, last_id, exhausted


def get_feed(
    db: Session, *, viewer: User, limit: int, cursor: str | None
) -> PostPage:
    """Home feed: follows first, cold-start discovery blended behind.

    Viewers following fewer than COLD_START_FOLLOW_THRESHOLD accounts get
    their page filled with recent popular public posts (`source` set to
    `"discovery"`), so new users see content from day one.
    """
    limit = max(1, min(limit, 50))
    following = social_repository.following_ids(db, viewer.id)
    author_ids = list(following) + [viewer.id]
    before, fallback_after = _decode_feed_cursor(cursor)
    rows = content_repository.list_posts_before(
        db, author_ids=author_ids, limit=limit, before=before
    )
    page = _build_post_page(
        db, rows, viewer_id=viewer.id, limit=limit, cursor_kind="post"
    )
    if len(following) >= COLD_START_FOLLOW_THRESHOLD:
        return page
    need = limit - len(page.items)
    if need <= 0:
        return page
    shown_ids = {item.post.id for item in page.items}
    discovery, last_fid, exhausted = _discovery_fill(
        db,
        viewer=viewer,
        need=need,
        exclude_ids=shown_ids,
        after_id=fallback_after,
    )
    page.items.extend(discovery)
    page.has_more = page.has_more or not exhausted
    page.next_cursor = _merge_feed_cursor(page.next_cursor, last_fid)
    return page


def get_explore(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    limit: int,
    cursor: str | None,
) -> PostPage:
    """Chronological discovery feed: public authors only."""
    limit = max(1, min(limit, 50))
    before = _decode_post_cursor(cursor, kind="post")
    rows = content_repository.list_posts_before(
        db, author_ids=None, limit=limit, before=before
    )
    page = _build_post_page(
        db, rows, viewer_id=viewer_id, limit=limit, cursor_kind="post"
    )
    # Explore excludes private authors entirely.
    page.items = [item for item in page.items if not item.author.is_private]
    return page


def get_profile_posts(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    username: str,
    limit: int,
    cursor: str | None,
) -> PostPage:
    """Author grid, gated by the same profile visibility policy."""
    from app.infrastructure.database.repositories import user_repository as users

    author = users.get_by_username(db, username)
    if author is None:
        raise ResourceNotFoundError("User not found")
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
        target=ProfileTarget(
            user_id=author.id,
            account_status=author.account_status,
            is_private=author.is_private,
        ),
        follows_target=follows,
        blocked_either_way=blocked,
    ):
        raise ResourceNotFoundError("User not found")
    limit = max(1, min(limit, 50))
    before = _decode_post_cursor(cursor, kind="post")
    rows = content_repository.list_author_posts_before(
        db, author_id=author.id, limit=limit, before=before
    )
    return _build_post_page(
        db, rows, viewer_id=viewer_id, limit=limit, cursor_kind="post"
    )

