"""Search queries: users, posts, hashtags (PostgreSQL-native)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.domain.enums import AccountStatus, PostStatus
from app.infrastructure.database.models.content import (
    Hashtag,
    Post,
    PostHashtag,
)
from app.infrastructure.database.models.user import User


def search_users(
    session: Session,
    query: str,
    *,
    limit: int,
    before: tuple[str, uuid.UUID] | None = None,
) -> list[User]:
    """Username/display-name substring match, ordered by username."""
    pattern = f"%{query}%"
    stmt = (
        select(User)
        .where(
            User.account_status == AccountStatus.ACTIVE,
            or_(
                User.username.ilike(pattern),
                User.display_name.ilike(pattern),
            ),
        )
        .order_by(User.username.asc(), User.id.asc())
        .limit(limit + 1)
    )
    if before is not None:
        username, user_id = before
        stmt = stmt.where(
            (User.username > username)
            | ((User.username == username) & (User.id > user_id))
        )
    return list(session.exec(stmt).all())


def search_posts_text(
    session: Session,
    query: str,
    *,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[Post]:
    """Full-text caption match, newest first."""
    tsquery = func.plainto_tsquery("english", query)
    stmt = (
        select(Post)
        .where(
            Post.status == PostStatus.VISIBLE,
            func.to_tsvector("english", func.coalesce(Post.caption, "")).op("@@")(tsquery),
        )
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(limit + 1)
    )
    if before is not None:
        created_at, post_id = before
        stmt = stmt.where(
            (Post.created_at < created_at)
            | ((Post.created_at == created_at) & (Post.id < post_id))
        )
    return list(session.exec(stmt).all())


def search_posts_by_hashtag(
    session: Session,
    tag: str,
    *,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[Post]:
    """Posts carrying an exact normalized hashtag, newest first."""
    stmt = (
        select(Post)
        .join(PostHashtag, PostHashtag.post_id == Post.id)
        .join(Hashtag, Hashtag.id == PostHashtag.hashtag_id)
        .where(
            Post.status == PostStatus.VISIBLE,
            Hashtag.tag == tag,
        )
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(limit + 1)
    )
    if before is not None:
        created_at, post_id = before
        stmt = stmt.where(
            (Post.created_at < created_at)
            | ((Post.created_at == created_at) & (Post.id < post_id))
        )
    return list(session.exec(stmt).all())


def search_hashtags(
    session: Session,
    query: str,
    *,
    limit: int,
    before: str | None = None,
) -> list[tuple[Hashtag, int]]:
    """Tag-prefix match with usage counts, ordered by tag."""
    stmt = (
        select(Hashtag, func.count(PostHashtag.post_id).label("usage"))
        .outerjoin(PostHashtag, PostHashtag.hashtag_id == Hashtag.id)
        .where(Hashtag.tag.ilike(f"{query}%"))
        .group_by(Hashtag.id)
        .order_by(Hashtag.tag.asc())
        .limit(limit + 1)
    )
    if before is not None:
        stmt = stmt.where(Hashtag.tag > before)
    return [(row[0], row[1]) for row in session.exec(stmt).all()]
