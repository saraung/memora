"""Persistence operations for users."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import or_
from sqlmodel import Session, select

from app.infrastructure.database.models.user import User


def get_by_id(session: Session, user_id: uuid.UUID) -> User | None:
    return session.get(User, user_id)


def get_by_email(session: Session, email: str) -> User | None:
    return session.exec(
        select(User).where(User.email == email.strip().lower())
    ).first()


def get_by_username(session: Session, username: str) -> User | None:
    return session.exec(
        select(User).where(User.username == username.strip().lower())
    ).first()


def create(
    session: Session,
    *,
    email: str,
    username: str,
    password_hash: str,
    display_name: str,
) -> User:
    user = User(
        email=email.strip().lower(),
        username=username.strip().lower(),
        password_hash=password_hash,
        display_name=display_name.strip(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def save(session: Session, user: User) -> User:
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def list_by_ids(
    session: Session, user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, User]:
    """Batch-load users keyed by id (avoids N+1 in feeds)."""
    if not user_ids:
        return {}
    users = session.exec(
        select(User).where(User.id.in_(user_ids))
    ).all()
    return {user.id: user for user in users}


def admin_search_users(
    session: Session,
    query: str,
    *,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[User]:
    """Staff user lookup across ALL account statuses."""
    pattern = f"%{query}%"
    stmt = (
        select(User)
        .where(
            or_(
                User.username.ilike(pattern),
                User.email.ilike(pattern),
                User.display_name.ilike(pattern),
            )
        )
        .order_by(User.created_at.desc(), User.id.desc())
        .limit(limit + 1)
    )
    if before is not None:
        created_at, user_id = before
        stmt = stmt.where(
            (User.created_at < created_at)
            | ((User.created_at == created_at) & (User.id < user_id))
        )
    return list(session.exec(stmt).all())
