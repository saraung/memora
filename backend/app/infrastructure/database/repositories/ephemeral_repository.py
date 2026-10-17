"""Persistence for stories, story views, reels, and reel views."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlmodel import Session, func, select

from app.domain.enums import ReelStatus, StoryStatus
from app.infrastructure.database.models.content import (
    Reel,
    ReelBookmark,
    ReelComment,
    ReelLike,
    ReelView,
    Story,
    StoryView,
)


# -- Stories --------------------------------------------------------------------


def create_story(session: Session, *, record: Story) -> Story:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_story_by_id(session: Session, story_id: uuid.UUID) -> Story | None:
    return session.get(Story, story_id)


def save_story(session: Session, record: Story) -> Story:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_active_stories_before(
    session: Session,
    *,
    author_ids: list[uuid.UUID] | None,
    now: datetime,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[Story]:
    """Active, unexpired stories, newest first."""
    query = select(Story).where(
        Story.status == StoryStatus.ACTIVE,
        Story.expires_at > now,
    )
    if author_ids is not None:
        query = query.where(Story.author_id.in_(author_ids))
    if before is not None:
        created_at, story_id = before
        query = query.where(
            (Story.created_at < created_at)
            | ((Story.created_at == created_at) & (Story.id < story_id))
        )
    query = query.order_by(Story.created_at.desc(), Story.id.desc()).limit(
        limit + 1
    )
    return list(session.exec(query).all())


def record_story_view(
    session: Session,
    *,
    story_id: uuid.UUID,
    viewer_id: uuid.UUID,
    now: datetime,
) -> StoryView:
    existing = session.get(StoryView, (story_id, viewer_id))
    if existing is not None:
        return existing
    view = StoryView(story_id=story_id, viewer_id=viewer_id, viewed_at=now)
    session.add(view)
    session.commit()
    session.refresh(view)
    return view


def list_story_viewers(
    session: Session, story_id: uuid.UUID
) -> list[StoryView]:
    return list(
        session.exec(
            select(StoryView)
            .where(StoryView.story_id == story_id)
            .order_by(StoryView.viewed_at.desc())
        ).all()
    )


def viewed_story_ids(
    session: Session,
    *,
    viewer_id: uuid.UUID,
    story_ids: list[uuid.UUID],
) -> set[uuid.UUID]:
    """Story IDs the viewer already saw (for unseen-first ordering)."""
    if not story_ids:
        return set()
    rows = session.exec(
        select(StoryView.story_id).where(
            StoryView.viewer_id == viewer_id,
            StoryView.story_id.in_(story_ids),
        )
    ).all()
    return set(rows)


# -- Reels ------------------------------------------------------------------------


def create_reel(session: Session, *, record: Reel) -> Reel:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_reel_by_id(session: Session, reel_id: uuid.UUID) -> Reel | None:
    return session.get(Reel, reel_id)


def save_reel(session: Session, record: Reel) -> Reel:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def delete_reel(session: Session, record: Reel) -> None:
    session.delete(record)
    session.commit()


def list_visible_reels_before(
    session: Session,
    *,
    author_ids: list[uuid.UUID] | None,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[Reel]:
    query = select(Reel).where(Reel.status == ReelStatus.VISIBLE)
    if author_ids is not None:
        query = query.where(Reel.author_id.in_(author_ids))
    if before is not None:
        created_at, reel_id = before
        query = query.where(
            (Reel.created_at < created_at)
            | ((Reel.created_at == created_at) & (Reel.id < reel_id))
        )
    query = query.order_by(Reel.created_at.desc(), Reel.id.desc()).limit(
        limit + 1
    )
    return list(session.exec(query).all())


def count_recent_reel_views(
    session: Session,
    *,
    reel_id: uuid.UUID,
    viewer_id: uuid.UUID,
    since: datetime,
) -> int:
    """Qualified-view check: views by this viewer since `since`."""
    return (
        session.exec(
            select(func.count())
            .select_from(ReelView)
            .where(
                ReelView.reel_id == reel_id,
                ReelView.viewer_id == viewer_id,
                ReelView.viewed_at >= since,
            )
        ).one()
        or 0
    )


def record_reel_view(
    session: Session,
    *,
    reel_id: uuid.UUID,
    viewer_id: uuid.UUID | None,
    now: datetime,
) -> ReelView:
    view = ReelView(reel_id=reel_id, viewer_id=viewer_id, viewed_at=now)
    session.add(view)
    session.commit()
    session.refresh(view)
    return view


def get_reel_like(
    session: Session, user_id: uuid.UUID, reel_id: uuid.UUID
) -> ReelLike | None:
    return session.get(ReelLike, (user_id, reel_id))


def create_reel_like(
    session: Session, *, user_id: uuid.UUID, reel_id: uuid.UUID
) -> None:
    session.add(ReelLike(user_id=user_id, reel_id=reel_id))
    session.commit()


def delete_reel_like(
    session: Session, *, user_id: uuid.UUID, reel_id: uuid.UUID
) -> bool:
    like = get_reel_like(session, user_id, reel_id)
    if like is None:
        return False
    session.delete(like)
    session.commit()
    return True


# -- Reel comments ---------------------------------------------------------------


def create_reel_comment(session: Session, *, record: ReelComment) -> ReelComment:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_reel_comment_by_id(
    session: Session, comment_id: uuid.UUID
) -> ReelComment | None:
    return session.get(ReelComment, comment_id)


def delete_reel_comment(session: Session, record: ReelComment) -> None:
    session.delete(record)
    session.commit()


def list_reel_comments_before(
    session: Session,
    *,
    reel_id: uuid.UUID,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[ReelComment]:
    query = select(ReelComment).where(ReelComment.reel_id == reel_id)
    if before is not None:
        created_at, comment_id = before
        query = query.where(
            (ReelComment.created_at < created_at)
            | (
                (ReelComment.created_at == created_at)
                & (ReelComment.id < comment_id)
            )
        )
    query = query.order_by(
        ReelComment.created_at.desc(), ReelComment.id.desc()
    ).limit(limit + 1)
    return list(session.exec(query).all())


# -- Reel bookmarks --------------------------------------------------------------


def get_reel_bookmark(
    session: Session, user_id: uuid.UUID, reel_id: uuid.UUID
) -> ReelBookmark | None:
    return session.get(ReelBookmark, (user_id, reel_id))


def create_reel_bookmark(
    session: Session, *, user_id: uuid.UUID, reel_id: uuid.UUID
) -> None:
    session.add(ReelBookmark(user_id=user_id, reel_id=reel_id))
    session.commit()


def delete_reel_bookmark(
    session: Session, *, user_id: uuid.UUID, reel_id: uuid.UUID
) -> bool:
    bookmark = get_reel_bookmark(session, user_id, reel_id)
    if bookmark is None:
        return False
    session.delete(bookmark)
    session.commit()
    return True


def list_bookmarked_reels_before(
    session: Session,
    *,
    user_id: uuid.UUID,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[tuple[Reel, datetime]]:
    """Newest bookmarks first; returns (reel, bookmarked_at) pairs."""
    query = (
        select(Reel, ReelBookmark.created_at)
        .join(ReelBookmark, ReelBookmark.reel_id == Reel.id)
        .where(ReelBookmark.user_id == user_id)
    )
    if before is not None:
        created_at, reel_id = before
        query = query.where(
            (ReelBookmark.created_at < created_at)
            | (
                (ReelBookmark.created_at == created_at)
                & (Reel.id < reel_id)
            )
        )
    query = query.order_by(
        ReelBookmark.created_at.desc(), Reel.id.desc()
    ).limit(limit + 1)
    return [(row[0], row[1]) for row in session.exec(query).all()]
