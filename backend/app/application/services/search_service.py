"""User/post/hashtag search with visibility enforcement.

Every post result passes through the M3 visibility policy BEFORE the
page is sliced, so private/blocked/removed content can never leak via
search, and cursors stay consistent.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlmodel import Session

from app.application.pagination import decode_cursor, encode_cursor
from app.application.services import post_service
from app.application.services.post_service import PostDetail
from app.core.exceptions import ValidationError
from app.domain.enums import AccountStatus
from app.domain.policies.visibility import (
    ProfileTarget,
    can_view_profile,
)
from app.infrastructure.database.models.content import Post
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    search_repository,
    social_repository,
    user_repository,
)


def _require_query(query: str) -> str:
    query = query.strip()
    if not query:
        raise ValidationError("Search query must not be empty")
    return query


def _decode_post_cursor(cursor: str | None) -> tuple[datetime, uuid.UUID] | None:
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


@dataclass
class UserPage:
    items: list[User]
    next_cursor: str | None
    has_more: bool


@dataclass
class PostPage:
    items: list[PostDetail]
    next_cursor: str | None
    has_more: bool


@dataclass
class HashtagResult:
    tag: str
    usage_count: int


@dataclass
class HashtagPage:
    items: list[HashtagResult]
    next_cursor: str | None
    has_more: bool


def _post_visible(
    db: Session,
    post: Post,
    *,
    viewer_id: uuid.UUID | None,
    authors: dict[uuid.UUID, User],
    follows_cache: dict[uuid.UUID, bool],
    blocked: set[uuid.UUID],
) -> User | None:
    """Return the author when the viewer may see the post, else None."""
    author = authors.get(post.author_id)
    if author is None or author.account_status != AccountStatus.ACTIVE:
        return None
    if author.id in blocked:
        return None
    if viewer_id is not None and author.id not in follows_cache:
        follows_cache[author.id] = (
            social_repository.get_follow(db, viewer_id, author.id)
            is not None
        )
    follows = viewer_id is not None and (
        viewer_id == author.id or follows_cache.get(author.id, False)
    )
    if not can_view_profile(
        viewer_id=viewer_id,
        target=ProfileTarget(
            user_id=author.id,
            account_status=author.account_status,
            is_private=author.is_private,
        ),
        follows_target=bool(follows),
        blocked_either_way=author.id in blocked,
    ):
        return None
    return author


def _prepare_viewer(
    db: Session, viewer_id: uuid.UUID | None
) -> tuple[dict[uuid.UUID, bool], set[uuid.UUID]]:
    if viewer_id is None:
        return {}, set()
    return {}, social_repository.blocked_ids_for_user(db, viewer_id)


def search_users(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    query: str,
    limit: int,
    cursor: str | None,
) -> UserPage:
    query = _require_query(query).lower()
    limit = max(1, min(limit, 50))
    before: tuple[str, uuid.UUID] | None = None
    if cursor:
        payload = decode_cursor(cursor)
        try:
            before = (str(payload["u"]), uuid.UUID(str(payload["id"])))
        except (ValueError, KeyError) as exc:
            raise ValidationError("Invalid pagination cursor") from exc
    _, blocked = _prepare_viewer(db, viewer_id)
    rows = search_repository.search_users(
        db, query, limit=limit, before=before
    )
    items = [u for u in rows[:limit] if u.id not in blocked]
    has_more = len(rows) > limit
    next_cursor = None
    if has_more and items:
        last = rows[limit - 1]
        next_cursor = encode_cursor(
            {"u": last.username, "id": str(last.id)}
        )
    return UserPage(items=items, next_cursor=next_cursor, has_more=has_more)


def _filtered_post_page(
    db: Session,
    rows: list[Post],
    *,
    viewer_id: uuid.UUID | None,
    limit: int,
) -> tuple[list[PostDetail], bool]:
    """Filter raw rows through visibility; report raw has_more."""
    follows_cache, blocked = _prepare_viewer(db, viewer_id)
    authors = user_repository.list_by_ids(
        db, list({p.author_id for p in rows[:limit]})
    )
    details: list[PostDetail] = []
    for post in rows[:limit]:
        author = _post_visible(
            db,
            post,
            viewer_id=viewer_id,
            authors=authors,
            follows_cache=follows_cache,
            blocked=blocked,
        )
        if author is None:
            continue
        details.append(
            post_service._detail(db, post, viewer_id=viewer_id, authors=authors)
        )
    return details, len(rows) > limit


def search_posts(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    query: str,
    limit: int,
    cursor: str | None,
) -> PostPage:
    raw = _require_query(query)
    limit = max(1, min(limit, 50))
    before = _decode_post_cursor(cursor)
    seen: dict[uuid.UUID, PostDetail] = {}
    has_more = False
    # A `#tag` query searches hashtags; anything else searches captions.
    # Both paths merge newest-first with a fill loop.
    fetchers = []
    if raw.startswith("#"):
        tag = raw[1:].strip().lower()
        if tag:
            fetchers.append(
                lambda b: search_repository.search_posts_by_hashtag(
                    db, tag, limit=limit, before=b
                )
            )
    else:
        fetchers.append(
            lambda b: search_repository.search_posts_text(
                db, raw, limit=limit, before=b
            )
        )
    next_cursor = None
    for fetch in fetchers:
        current_before = before
        for _ in range(5):  # bounded fill loop across filtered-out rows
            rows = fetch(current_before)
            if not rows:
                break
            details, raw_more = _filtered_post_page(
                db, rows, viewer_id=viewer_id, limit=limit
            )
            for detail in details:
                seen.setdefault(detail.post.id, detail)
            has_more = has_more or raw_more
            if len(seen) >= limit or not raw_more:
                if raw_more and rows:
                    last = rows[limit - 1] if len(rows) >= limit else rows[-1]
                    next_cursor = encode_cursor(
                        {
                            "c": last.created_at.isoformat(),
                            "id": str(last.id),
                        }
                    )
                break
            last = rows[-1]
            current_before = (last.created_at, last.id)
    items = sorted(
        seen.values(), key=lambda d: (d.post.created_at, d.post.id), reverse=True
    )[:limit]
    return PostPage(items=items, next_cursor=next_cursor, has_more=has_more)


def search_hashtags(
    db: Session,
    *,
    query: str,
    limit: int,
    cursor: str | None,
) -> HashtagPage:
    raw = _require_query(query).lower().lstrip("#")
    if not raw:
        raise ValidationError("Search query must not be empty")
    limit = max(1, min(limit, 50))
    rows = search_repository.search_hashtags(
        db, raw, limit=limit, before=cursor
    )
    items = [
        HashtagResult(tag=hashtag.tag, usage_count=count)
        for hashtag, count in rows[:limit]
    ]
    has_more = len(rows) > limit
    next_cursor = rows[limit - 1][0].tag if has_more else None
    return HashtagPage(items=items, next_cursor=next_cursor, has_more=has_more)


def hashtag_posts(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    tag: str,
    limit: int,
    cursor: str | None,
) -> PostPage:
    tag = tag.strip().lower().lstrip("#")
    if not tag:
        raise ValidationError("Hashtag must not be empty")
    limit = max(1, min(limit, 50))
    before = _decode_post_cursor(cursor)
    details: list[PostDetail] = []
    current_before = before
    has_more = False
    next_cursor = None
    for _ in range(5):
        rows = search_repository.search_posts_by_hashtag(
            db, tag, limit=limit, before=current_before
        )
        if not rows:
            break
        page_details, raw_more = _filtered_post_page(
            db, rows, viewer_id=viewer_id, limit=limit
        )
        details.extend(page_details)
        has_more = raw_more
        if len(details) >= limit or not raw_more:
            if raw_more:
                last = rows[limit - 1] if len(rows) >= limit else rows[-1]
                next_cursor = encode_cursor(
                    {"c": last.created_at.isoformat(), "id": str(last.id)}
                )
            break
        current_before = (rows[-1].created_at, rows[-1].id)
    return PostPage(
        items=details[:limit], next_cursor=next_cursor, has_more=has_more
    )
