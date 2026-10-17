"""Persistence for notifications."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlmodel import Session, func, select

from app.domain.enums import NotificationType
from app.infrastructure.database.models.messaging import Notification


def create_notification(
    session: Session,
    *,
    recipient_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    type: NotificationType,
    target_type: str | None = None,
    target_id: str | None = None,
) -> Notification:
    record = Notification(
        recipient_id=recipient_id,
        actor_id=actor_id,
        type=type,
        target_type=target_type,
        target_id=target_id,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_notification(
    session: Session, notification_id: uuid.UUID
) -> Notification | None:
    return session.get(Notification, notification_id)


def get_unread_matching(
    session: Session,
    *,
    recipient_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    type: NotificationType,
    target_type: str | None,
    target_id: str | None,
) -> Notification | None:
    """Newest unread notification equal to the given identity, if any.

    Used to coalesce low-information repeats (e.g. many messages in one
    thread) into a single evolving entry instead of a new row each time.
    """
    query = select(Notification).where(
        Notification.recipient_id == recipient_id,
        Notification.is_read.is_(False),
        Notification.type == type,
    )
    query = query.where(
        Notification.actor_id.is_(None)
        if actor_id is None
        else Notification.actor_id == actor_id
    )
    query = query.where(
        Notification.target_type.is_(None)
        if target_type is None
        else Notification.target_type == target_type
    )
    query = query.where(
        Notification.target_id.is_(None)
        if target_id is None
        else Notification.target_id == target_id
    )
    query = query.order_by(Notification.created_at.desc()).limit(1)
    return session.exec(query).first()


def save_notification(
    session: Session, record: Notification
) -> Notification:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_for_recipient_before(
    session: Session,
    *,
    recipient_id: uuid.UUID,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[Notification]:
    query = select(Notification).where(
        Notification.recipient_id == recipient_id
    )
    if before is not None:
        created_at, notification_id = before
        query = query.where(
            (Notification.created_at < created_at)
            | (
                (Notification.created_at == created_at)
                & (Notification.id < notification_id)
            )
        )
    query = query.order_by(
        Notification.created_at.desc(), Notification.id.desc()
    ).limit(limit + 1)
    return list(session.exec(query).all())


def unread_count(session: Session, recipient_id: uuid.UUID) -> int:
    return (
        session.exec(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.recipient_id == recipient_id,
                Notification.is_read.is_(False),
            )
        ).one()
        or 0
    )


def mark_all_read(
    session: Session, recipient_id: uuid.UUID, now: datetime
) -> int:
    _ = now  # reserved for future read_at bookkeeping
    records = session.exec(
        select(Notification).where(
            Notification.recipient_id == recipient_id,
            Notification.is_read.is_(False),
        )
    ).all()
    for record in records:
        record.is_read = True
        session.add(record)
    if records:
        session.commit()
    return len(records)
