"""Read-only aggregate queries powering the staff dashboards.

All figures are computed live from persisted rows — nothing is fabricated.
Series bucketing uses Postgres ``date_trunc`` (the platform targets Postgres).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlmodel import Session, func, select

from app.domain.enums import AccountStatus
from app.infrastructure.database.models.content import (
    Comment,
    Post,
    Reel,
    Story,
)
from app.infrastructure.database.models.messaging import Message
from app.infrastructure.database.models.moderation import Report
from app.infrastructure.database.models.rbac import Role, UserRole
from app.infrastructure.database.models.social import Follow
from app.infrastructure.database.models.user import User


def _count(session: Session, model, *where) -> int:
    query = select(func.count()).select_from(model)
    for clause in where:
        query = query.where(clause)
    return int(session.exec(query).one() or 0)


# -- Accounts --------------------------------------------------------------


def count_accounts(session: Session) -> int:
    return _count(session, User)


def count_accounts_by_status(session: Session) -> dict[str, int]:
    rows = session.exec(
        select(User.account_status, func.count()).group_by(User.account_status)
    ).all()
    return {_enum_value(status): int(n) for status, n in rows}


def count_accounts_since(session: Session, since: datetime) -> int:
    return _count(session, User, User.created_at >= since)


# -- Content ---------------------------------------------------------------


def count_posts(session: Session) -> int:
    return _count(session, Post)


def count_reels(session: Session) -> int:
    return _count(session, Reel)


def count_stories(session: Session) -> int:
    return _count(session, Story)


def count_comments(session: Session) -> int:
    return _count(session, Comment)


def count_messages(session: Session) -> int:
    return _count(session, Message)


# -- Social graph ----------------------------------------------------------


def count_follows(session: Session) -> int:
    return _count(session, Follow)


def count_followers(session: Session, user_id: uuid.UUID) -> int:
    return _count(session, Follow, Follow.followed_id == user_id)


def count_following(session: Session, user_id: uuid.UUID) -> int:
    return _count(session, Follow, Follow.follower_id == user_id)


def count_posts_by_author(session: Session, user_id: uuid.UUID) -> int:
    return _count(session, Post, Post.author_id == user_id)


# -- Reports ---------------------------------------------------------------


def count_reports(session: Session) -> int:
    return _count(session, Report)


def count_reports_by_status(session: Session) -> dict[str, int]:
    rows = session.exec(
        select(Report.status, func.count()).group_by(Report.status)
    ).all()
    return {_enum_value(status): int(n) for status, n in rows}


def count_reports_by_category(session: Session) -> dict[str, int]:
    rows = session.exec(
        select(Report.category, func.count()).group_by(Report.category)
    ).all()
    return {_enum_value(category): int(n) for category, n in rows}


def count_reports_since(session: Session, since: datetime) -> int:
    return _count(session, Report, Report.created_at >= since)


# -- Time series -----------------------------------------------------------


def daily_series(
    session: Session, column, since: datetime
) -> dict[date, int]:
    """Count rows per calendar day for ``column`` (a timestamp) since ``since``."""
    day = func.date_trunc("day", column).label("day")
    rows = session.exec(
        select(day, func.count()).where(column >= since).group_by(day)
    ).all()
    result: dict[date, int] = {}
    for bucket, count in rows:
        key = bucket.date() if isinstance(bucket, datetime) else bucket
        result[key] = int(count)
    return result


# -- Staff -----------------------------------------------------------------


def list_role_holders(
    session: Session,
) -> list[tuple[User, list[str]]]:
    """Every user holding at least one role, with their role names."""
    rows = session.exec(
        select(User, Role.name)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .order_by(User.username)
    ).all()
    grouped: dict[uuid.UUID, tuple[User, list[str]]] = {}
    for user, role_name in rows:
        entry = grouped.get(user.id)
        if entry is None:
            grouped[user.id] = (user, [role_name])
        else:
            entry[1].append(role_name)
    for user, names in grouped.values():
        names.sort()
        _ = user
    return list(grouped.values())


def count_role_holders_all(session: Session) -> dict[str, int]:
    rows = session.exec(
        select(Role.name, func.count(UserRole.user_id))
        .select_from(Role)
        .join(UserRole, UserRole.role_id == Role.id, isouter=True)
        .group_by(Role.name)
    ).all()
    return {name: int(n) for name, n in rows}


def count_active_staff(session: Session) -> int:
    query = (
        select(func.count(func.distinct(UserRole.user_id)))
        .select_from(UserRole)
        .join(User, User.id == UserRole.user_id)
        .where(User.account_status == AccountStatus.ACTIVE)
    )
    return int(session.exec(query).one() or 0)


# -- helpers ---------------------------------------------------------------


def _enum_value(value) -> str:
    return value.value if hasattr(value, "value") else str(value)
