"""Persistence for audit events."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.infrastructure.database.models.audit import AuditEvent


def record(
    session: Session,
    *,
    action: str,
    actor_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    request_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        request_id=request_id,
        meta=meta,
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


def list_events_before(
    session: Session,
    *,
    actor_id: uuid.UUID | None = None,
    action: str | None = None,
    target_type: str | None = None,
    since: datetime | None = None,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[AuditEvent]:
    """Read-only audit trail with filters, newest first."""
    query = select(AuditEvent)
    if actor_id is not None:
        query = query.where(AuditEvent.actor_id == actor_id)
    if action is not None:
        query = query.where(AuditEvent.action == action)
    if target_type is not None:
        query = query.where(AuditEvent.target_type == target_type)
    if since is not None:
        query = query.where(AuditEvent.created_at >= since)
    if before is not None:
        created_at, event_id = before
        query = query.where(
            (AuditEvent.created_at < created_at)
            | (
                (AuditEvent.created_at == created_at)
                & (AuditEvent.id < event_id)
            )
        )
    query = query.order_by(
        AuditEvent.created_at.desc(), AuditEvent.id.desc()
    ).limit(limit + 1)
    return list(session.exec(query).all())
