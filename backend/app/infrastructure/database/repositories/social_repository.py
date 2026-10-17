"""Persistence for follows, follow requests, and blocks."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlmodel import Session, func, select

from app.domain.enums import AccountStatus, FollowRequestStatus
from app.infrastructure.database.models.social import (
    Block,
    Follow,
    FollowRequest,
)
from app.infrastructure.database.models.user import User


# -- Follows --------------------------------------------------------------


def get_follow(
    session: Session, follower_id: uuid.UUID, followed_id: uuid.UUID
) -> Follow | None:
    return session.get(Follow, (follower_id, followed_id))


def create_follow(
    session: Session, *, follower_id: uuid.UUID, followed_id: uuid.UUID
) -> Follow:
    follow = Follow(follower_id=follower_id, followed_id=followed_id)
    session.add(follow)
    session.commit()
    session.refresh(follow)
    return follow


def delete_follow(
    session: Session, *, follower_id: uuid.UUID, followed_id: uuid.UUID
) -> bool:
    follow = get_follow(session, follower_id, followed_id)
    if follow is None:
        return False
    session.delete(follow)
    session.commit()
    return True


def count_followers(session: Session, user_id: uuid.UUID) -> int:
    return (
        session.exec(
            select(func.count())
            .select_from(Follow)
            .where(Follow.followed_id == user_id)
        ).one()
        or 0
    )


def count_following(session: Session, user_id: uuid.UUID) -> int:
    return (
        session.exec(
            select(func.count())
            .select_from(Follow)
            .where(Follow.follower_id == user_id)
        ).one()
        or 0
    )


def list_followers(    session: Session,
    user_id: uuid.UUID,
    *,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[tuple[User, datetime]]:
    """Newest followers first. `before` = (created_at, follower_id) cursor."""
    query = (
        select(User, Follow.created_at)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.followed_id == user_id)
    )
    if before is not None:
        created_at, follower_id = before
        query = query.where(
            (Follow.created_at < created_at)
            | (
                (Follow.created_at == created_at)
                & (Follow.follower_id < follower_id)
            )
        )
    query = query.order_by(
        Follow.created_at.desc(), Follow.follower_id.desc()
    ).limit(limit + 1)
    return list(session.exec(query).all())


def list_following(
    session: Session,
    user_id: uuid.UUID,
    *,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[tuple[User, datetime]]:
    query = (
        select(User, Follow.created_at)
        .join(Follow, Follow.followed_id == User.id)
        .where(Follow.follower_id == user_id)
    )
    if before is not None:
        created_at, followed_id = before
        query = query.where(
            (Follow.created_at < created_at)
            | (
                (Follow.created_at == created_at)
                & (Follow.followed_id < followed_id)
            )
        )
    query = query.order_by(
        Follow.created_at.desc(), Follow.followed_id.desc()
    ).limit(limit + 1)
    return list(session.exec(query).all())


# -- Follow requests -------------------------------------------------------


def get_request(
    session: Session, requester_id: uuid.UUID, target_id: uuid.UUID
) -> FollowRequest | None:
    return session.exec(
        select(FollowRequest).where(
            FollowRequest.requester_id == requester_id,
            FollowRequest.target_id == target_id,
        )
    ).first()


def get_request_by_id(
    session: Session, request_id: uuid.UUID
) -> FollowRequest | None:
    return session.get(FollowRequest, request_id)


def upsert_pending_request(
    session: Session, *, requester_id: uuid.UUID, target_id: uuid.UUID
) -> FollowRequest:
    record = get_request(session, requester_id, target_id)
    if record is None:
        record = FollowRequest(requester_id=requester_id, target_id=target_id)
    record.status = FollowRequestStatus.PENDING
    record.decided_at = None
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def decide_request(
    session: Session,
    record: FollowRequest,
    *,
    approve: bool,
    now: datetime,
) -> FollowRequest:
    record.status = (
        FollowRequestStatus.APPROVED
        if approve
        else FollowRequestStatus.REJECTED
    )
    record.decided_at = now
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def cancel_request(
    session: Session, record: FollowRequest, *, now: datetime
) -> FollowRequest:
    record.status = FollowRequestStatus.CANCELED
    record.decided_at = now
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_incoming_requests(
    session: Session, target_id: uuid.UUID
) -> list[FollowRequest]:
    return list(
        session.exec(
            select(FollowRequest)
            .where(
                FollowRequest.target_id == target_id,
                FollowRequest.status == FollowRequestStatus.PENDING,
            )
            .order_by(FollowRequest.created_at.desc())
        ).all()
    )


def delete_requests_between(
    session: Session, user_a: uuid.UUID, user_b: uuid.UUID
) -> None:
    records = session.exec(
        select(FollowRequest).where(
            (
                (FollowRequest.requester_id == user_a)
                & (FollowRequest.target_id == user_b)
            )
            | (
                (FollowRequest.requester_id == user_b)
                & (FollowRequest.target_id == user_a)
            )
        )
    ).all()
    for record in records:
        session.delete(record)
    session.commit()


# -- Blocks -----------------------------------------------------------------


def get_block(
    session: Session, blocker_id: uuid.UUID, blocked_id: uuid.UUID
) -> Block | None:
    return session.get(Block, (blocker_id, blocked_id))


def is_blocked_either_way(
    session: Session, user_a: uuid.UUID, user_b: uuid.UUID
) -> bool:
    if user_a == user_b:
        return False
    return (
        session.exec(
            select(Block).where(
                (
                    (Block.blocker_id == user_a)
                    & (Block.blocked_id == user_b)
                )
                | (
                    (Block.blocker_id == user_b)
                    & (Block.blocked_id == user_a)
                )
            )
        ).first()
        is not None
    )


def create_block(
    session: Session, *, blocker_id: uuid.UUID, blocked_id: uuid.UUID
) -> Block:
    block = Block(blocker_id=blocker_id, blocked_id=blocked_id)
    session.add(block)
    session.commit()
    session.refresh(block)
    return block


def delete_block(
    session: Session, *, blocker_id: uuid.UUID, blocked_id: uuid.UUID
) -> bool:
    block = get_block(session, blocker_id, blocked_id)
    if block is None:
        return False
    session.delete(block)
    session.commit()
    return True


def list_blocked_users(
    session: Session, blocker_id: uuid.UUID
) -> list[User]:
    return list(
        session.exec(
            select(User)
            .join(Block, Block.blocked_id == User.id)
            .where(Block.blocker_id == blocker_id)
            .order_by(Block.created_at.desc())
        ).all()
    )


def blocked_ids_for_user(session: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    """IDs of users blocked by or blocking `user_id` (both directions)."""
    outgoing = session.exec(
        select(Block.blocked_id).where(Block.blocker_id == user_id)
    ).all()
    incoming = session.exec(
        select(Block.blocker_id).where(Block.blocked_id == user_id)
    ).all()
    return set(outgoing) | set(incoming)


def following_ids(session: Session, user_id: uuid.UUID) -> list[uuid.UUID]:
    """IDs of every user `user_id` follows (for feed construction)."""
    return list(
        session.exec(
            select(Follow.followed_id).where(Follow.follower_id == user_id)
        ).all()
    )


def suggested_users(
    session: Session,
    *,
    exclude_ids: set[uuid.UUID],
    limit: int,
) -> list[tuple[User, int]]:
    """Most-followed active users outside the exclusion set.

    Powers the cold-start suggested-accounts strip. Ordered by follower
    count, then username for stability.
    """
    from sqlalchemy import desc

    stmt = (
        select(User, func.count(Follow.follower_id).label("followers"))
        .outerjoin(Follow, Follow.followed_id == User.id)
        .where(User.account_status == AccountStatus.ACTIVE)
        .group_by(User.id)
        .order_by(desc("followers"), User.username.asc())
        .limit(limit)
    )
    if exclude_ids:
        stmt = stmt.where(User.id.not_in(exclude_ids))
    return [(row[0], row[1]) for row in session.exec(stmt).all()]
