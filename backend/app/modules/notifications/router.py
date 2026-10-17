"""Notification endpoints: list, unread count, mark read."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.pagination import PageResponse
from app.application.pagination import decode_cursor, encode_cursor
from app.core.exceptions import (
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import notification_repository
from app.infrastructure.database.repositories import (
    user_repository as users,
)
from app.infrastructure.database.session import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.notifications import schemas
from app.modules.users.schemas import UserSummary

router = APIRouter(tags=["notifications"])


def _response(
    db: Session, notification_id: uuid.UUID
) -> schemas.NotificationResponse:
    from app.infrastructure.database.models.messaging import Notification

    record: Notification | None = notification_repository.get_notification(
        db, notification_id
    )
    assert record is not None
    actor = (
        users.get_by_id(db, record.actor_id)
        if record.actor_id is not None
        else None
    )
    return schemas.NotificationResponse(
        id=record.id,
        type=record.type.value,
        actor=UserSummary.model_validate(actor) if actor else None,
        target_type=record.target_type,
        target_id=record.target_id,
        is_read=record.is_read,
        created_at=record.created_at,
    )


@router.get(
    "/notifications",
    response_model=PageResponse[schemas.NotificationResponse],
)
def list_notifications(
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.NotificationResponse]:
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
    rows = notification_repository.list_for_recipient_before(
        db, recipient_id=current_user.id, limit=limit, before=before
    )
    has_more = len(rows) > limit
    next_cursor = None
    if has_more:
        last = rows[limit - 1]
        next_cursor = encode_cursor(
            {"c": last.created_at.isoformat(), "id": str(last.id)}
        )
    return PageResponse(
        items=[_response(db, n.id) for n in rows[:limit]],
        next_cursor=next_cursor,
        has_more=has_more,
    )


@router.get(
    "/notifications/unread-count",
    response_model=schemas.UnreadCountResponse,
)
def unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.UnreadCountResponse:
    return schemas.UnreadCountResponse(
        unread_count=notification_repository.unread_count(
            db, current_user.id
        )
    )


@router.post(
    "/notifications/{notification_id}/read",
    response_model=schemas.NotificationResponse,
)
def mark_one_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.NotificationResponse:
    record = notification_repository.get_notification(db, notification_id)
    if record is None:
        raise ResourceNotFoundError("Notification not found")
    if record.recipient_id != current_user.id:
        raise ForbiddenError("This notification is not yours")
    record.is_read = True
    notification_repository.save_notification(db, record)
    return _response(db, record.id)


@router.post(
    "/notifications/read-all",
    response_model=schemas.MarkAllReadResponse,
)
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MarkAllReadResponse:
    marked = notification_repository.mark_all_read(
        db, current_user.id, datetime.now(timezone.utc)
    )
    return schemas.MarkAllReadResponse(marked=marked)
