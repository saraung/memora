"""Persistence for voice calls."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlmodel import Session, func, select

from app.domain.enums import CallStatus
from app.infrastructure.database.models.call import Call


def create_call(
    session: Session,
    *,
    conversation_id: uuid.UUID,
    caller_id: uuid.UUID,
    callee_id: uuid.UUID,
) -> Call:
    record = Call(
        conversation_id=conversation_id,
        caller_id=caller_id,
        callee_id=callee_id,
        status=CallStatus.RINGING,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_call_by_id(
    session: Session, call_id: uuid.UUID
) -> Call | None:
    return session.get(Call, call_id)


def get_active_call_for_conversation(
    session: Session, conversation_id: uuid.UUID
) -> Call | None:
    """Most recent non-ended call for a conversation, if any."""
    return session.exec(
        select(Call)
        .where(
            Call.conversation_id == conversation_id,
            Call.status.in_(
                [CallStatus.RINGING, CallStatus.ACCEPTED]
            ),
        )
        .order_by(Call.created_at.desc())
        .limit(1)
    ).first()


def save_call(session: Session, record: Call) -> Call:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_calls_for_conversation(
    session: Session,
    *,
    conversation_id: uuid.UUID,
    limit: int,
    before: datetime | None = None,
) -> list[Call]:
    """Calls for a conversation, newest first, with optional cursor."""
    query = select(Call).where(
        Call.conversation_id == conversation_id
    )
    if before is not None:
        query = query.where(Call.created_at < before)
    query = query.order_by(Call.created_at.desc()).limit(limit + 1)
    return list(session.exec(query).all())
