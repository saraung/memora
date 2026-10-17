"""Persistence for posts, engagement, hashtags, and mentions."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlmodel import Session, func, select

from app.domain.enums import PostStatus
from app.infrastructure.database.models.content import (
    Bookmark,
    Comment,
    Hashtag,
    Like,
    Mention,
    Post,
    PostHashtag,
    PostMedia,
)


# -- Posts --------------------------------------------------------------------


def create_post(session: Session, *, record: Post) -> Post:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_post_by_id(session: Session, post_id: uuid.UUID) -> Post | None:
    return session.get(Post, post_id)


def save_post(session: Session, record: Post) -> Post:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def delete_post(session: Session, record: Post) -> None:
    session.delete(record)
    session.commit()


def add_post_media(
    session: Session, *, post_id: uuid.UUID, media_id: uuid.UUID,
    position: int, alt_text: str | None,
) -> PostMedia:
    link = PostMedia(
        post_id=post_id,
        media_id=media_id,
        position=position,
        alt_text=alt_text,
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


def list_post_media_ids(session: Session, post_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        session.exec(
            select(PostMedia.media_id)
            .where(PostMedia.post_id == post_id)
            .order_by(PostMedia.position)
        ).all()
    )


def list_post_media_links(
    session: Session, post_id: uuid.UUID
) -> list[PostMedia]:
    """Ordered attachment rows (carry position + alt text)."""
    return list(
        session.exec(
            select(PostMedia)
            .where(PostMedia.post_id == post_id)
            .order_by(PostMedia.position)
        ).all()
    )


def list_posts_before(
    session: Session,
    *,
    author_ids: list[uuid.UUID] | None,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
    since: datetime | None = None,
) -> list[Post]:
    """Newest visible posts first. `before` = (created_at, id) cursor.

    Author-level privacy (private profiles, blocks) is enforced by the
    caller via the visibility policy; this only filters removed posts.
    `since` bounds recency (discovery pool).
    """
    query = select(Post).where(Post.status == PostStatus.VISIBLE)
    if author_ids is not None:
        query = query.where(Post.author_id.in_(author_ids))
    if since is not None:
        query = query.where(Post.created_at >= since)
    if before is not None:
        created_at, post_id = before
        query = query.where(
            (Post.created_at < created_at)
            | ((Post.created_at == created_at) & (Post.id < post_id))
        )
    query = query.order_by(Post.created_at.desc(), Post.id.desc()).limit(
        limit + 1
    )
    return list(session.exec(query).all())


def list_author_posts_before(
    session: Session,
    *,
    author_id: uuid.UUID,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[Post]:
    return list_posts_before(
        session,
        author_ids=[author_id],
        limit=limit,
        before=before,
    )


def count_posts_by_author(session: Session, author_id: uuid.UUID) -> int:
    return (
        session.exec(
            select(func.count())
            .select_from(Post)
            .where(
                Post.author_id == author_id,
                Post.status == PostStatus.VISIBLE,
            )
        ).one()
        or 0
    )


# -- Likes / bookmarks ----------------------------------------------------------


def get_like(
    session: Session, user_id: uuid.UUID, post_id: uuid.UUID
) -> Like | None:
    return session.get(Like, (user_id, post_id))


def create_like(
    session: Session, *, user_id: uuid.UUID, post_id: uuid.UUID
) -> Like:
    like = Like(user_id=user_id, post_id=post_id)
    session.add(like)
    session.commit()
    return like


def delete_like(
    session: Session, *, user_id: uuid.UUID, post_id: uuid.UUID
) -> bool:
    like = get_like(session, user_id, post_id)
    if like is None:
        return False
    session.delete(like)
    session.commit()
    return True


def get_bookmark(
    session: Session, user_id: uuid.UUID, post_id: uuid.UUID
) -> Bookmark | None:
    return session.get(Bookmark, (user_id, post_id))


def create_bookmark(
    session: Session, *, user_id: uuid.UUID, post_id: uuid.UUID
) -> Bookmark:
    bookmark = Bookmark(user_id=user_id, post_id=post_id)
    session.add(bookmark)
    session.commit()
    return bookmark


def delete_bookmark(
    session: Session, *, user_id: uuid.UUID, post_id: uuid.UUID
) -> bool:
    bookmark = get_bookmark(session, user_id, post_id)
    if bookmark is None:
        return False
    session.delete(bookmark)
    session.commit()
    return True


def list_bookmarked_posts_before(
    session: Session,
    *,
    user_id: uuid.UUID,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[tuple[Post, datetime]]:
    """Newest bookmarks first; returns (post, bookmarked_at) pairs."""
    query = (
        select(Post, Bookmark.created_at)
        .join(Bookmark, Bookmark.post_id == Post.id)
        .where(
            Bookmark.user_id == user_id,
            Post.status == PostStatus.VISIBLE,
        )
    )
    if before is not None:
        created_at, post_id = before
        query = query.where(
            (Bookmark.created_at < created_at)
            | (
                (Bookmark.created_at == created_at)
                & (Bookmark.post_id < post_id)
            )
        )
    query = query.order_by(
        Bookmark.created_at.desc(), Bookmark.post_id.desc()
    ).limit(limit + 1)
    return list(session.exec(query).all())


def adjust_counts(
    session: Session, post: Post, *, likes: int = 0, comments: int = 0
) -> Post:
    post.like_count = max(0, post.like_count + likes)
    post.comment_count = max(0, post.comment_count + comments)
    session.add(post)
    session.commit()
    session.refresh(post)
    return post


def liked_post_ids(
    session: Session, *, user_id: uuid.UUID, post_ids: list[uuid.UUID]
) -> set[uuid.UUID]:
    """IDs of the given posts liked by the user (batch viewer state)."""
    if not post_ids:
        return set()
    rows = session.exec(
        select(Like.post_id).where(
            Like.user_id == user_id,
            Like.post_id.in_(post_ids),
        )
    ).all()
    return set(rows)


# -- Comments -------------------------------------------------------------------


def create_comment(session: Session, *, record: Comment) -> Comment:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_comment_by_id(
    session: Session, comment_id: uuid.UUID
) -> Comment | None:
    return session.get(Comment, comment_id)


def save_comment(session: Session, record: Comment) -> Comment:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def delete_comment(session: Session, record: Comment) -> None:
    session.delete(record)
    session.commit()


def list_comments_before(
    session: Session,
    *,
    post_id: uuid.UUID,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[Comment]:
    query = select(Comment).where(Comment.post_id == post_id)
    if before is not None:
        created_at, comment_id = before
        query = query.where(
            (Comment.created_at < created_at)
            | (
                (Comment.created_at == created_at)
                & (Comment.id < comment_id)
            )
        )
    query = query.order_by(
        Comment.created_at.desc(), Comment.id.desc()
    ).limit(limit + 1)
    return list(session.exec(query).all())


# -- Hashtags / mentions ----------------------------------------------------------


def get_or_create_hashtag(session: Session, *, tag: str) -> Hashtag:
    existing = session.exec(
        select(Hashtag).where(Hashtag.tag == tag)
    ).first()
    if existing is not None:
        return existing
    hashtag = Hashtag(tag=tag)
    session.add(hashtag)
    session.commit()
    session.refresh(hashtag)
    return hashtag


def link_post_hashtag(
    session: Session, *, post_id: uuid.UUID, hashtag_id: uuid.UUID
) -> None:
    existing = session.get(PostHashtag, (post_id, hashtag_id))
    if existing is not None:
        return
    session.add(PostHashtag(post_id=post_id, hashtag_id=hashtag_id))
    session.commit()


def create_mention(
    session: Session, *, post_id: uuid.UUID, mentioned_user_id: uuid.UUID
) -> Mention:
    mention = Mention(post_id=post_id, mentioned_user_id=mentioned_user_id)
    session.add(mention)
    session.commit()
    session.refresh(mention)
    return mention
