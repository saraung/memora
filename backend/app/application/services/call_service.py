"""Voice call use cases."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlmodel import Session

from app.application.services import notification_service
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from app.domain.enums import CallStatus, NotificationType
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    call_repository,
    messaging_repository,
    social_repository,
    user_repository,
)

MISSED_CALL_SECONDS = 30


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def initiate_call(
    db: Session,
    *,
    caller: User,
    conversation_id: uuid.UUID,
) -> uuid.UUID:
    """Start a ringing call in a direct conversation.

    Validates both participants are active and not blocked, and that no
    call is already ringing/accepted in this conversation.
    Returns the new call id.
    """
    conversation = messaging_repository.get_conversation_by_id(
        db, conversation_id
    )
    if conversation is None:
        raise ResourceNotFoundError("Conversation not found")
    if conversation.type.value != "direct":
        raise ValidationError("Voice calls are only supported for direct messages")

    participant_ids = messaging_repository.all_participant_user_ids(
        db, conversation_id
    )
    if caller.id not in participant_ids:
        raise ForbiddenError("You are not a participant of this conversation")

    other_ids = [uid for uid in participant_ids if uid != caller.id]
    if len(other_ids) != 1:
        raise ValidationError("Direct conversation must have exactly one other participant")
    callee_id = other_ids[0]

    callee = user_repository.get_by_id(db, callee_id)
    if callee is None or not callee.is_active:
        raise ResourceNotFoundError("User not found")
    if social_repository.is_blocked_either_way(db, caller.id, callee_id):
        raise ForbiddenError("You cannot call this user")

    existing = call_repository.get_active_call_for_conversation(
        db, conversation_id
    )
    if existing is not None:
        # If the existing call has been ringing longer than the missed-call
        # timeout, mark it as missed and start a fresh call. Otherwise return
        # the existing call id so the caller can join the ongoing ring.
        if (
            existing.status == CallStatus.RINGING
            and existing.created_at
            and (_utcnow() - existing.created_at).total_seconds()
            >= MISSED_CALL_SECONDS
        ):
            mark_missed_call(db, call_id=existing.id)
        else:
            return existing.id

    call = call_repository.create_call(
        db,
        conversation_id=conversation_id,
        caller_id=caller.id,
        callee_id=callee_id,
    )

    notification_service.notify(
        db,
        recipient_id=callee_id,
        actor_id=caller.id,
        type=NotificationType.CALL,
        target_type="conversation",
        target_id=str(conversation_id),
    )
    return call.id


def answer_call(
    db: Session,
    *,
    call_id: uuid.UUID,
    user: User,
) -> None:
    """Accept an incoming ringing call. Only the callee may answer."""
    call = call_repository.get_call_by_id(db, call_id)
    if call is None:
        raise ResourceNotFoundError("Call not found")
    if call.status != CallStatus.RINGING:
        raise ConflictError("Call is no longer ringing")
    if user.id != call.callee_id:
        raise ForbiddenError("Only the callee can answer this call")

    call.status = CallStatus.ACCEPTED
    call.answered_at = _utcnow()
    call_repository.save_call(db, call)


def decline_call(
    db: Session,
    *,
    call_id: uuid.UUID,
    user: User,
) -> None:
    """Decline an incoming ringing call. Only the callee may decline."""
    call = call_repository.get_call_by_id(db, call_id)
    if call is None:
        raise ResourceNotFoundError("Call not found")
    if call.status != CallStatus.RINGING:
        raise ConflictError("Call is no longer ringing")
    if user.id != call.callee_id:
        raise ForbiddenError("Only the callee can decline this call")

    call.status = CallStatus.DECLINED
    call.ended_at = _utcnow()
    call_repository.save_call(db, call)


def end_call(
    db: Session,
    *,
    call_id: uuid.UUID,
    user: User,
    duration_seconds: int,
) -> None:
    """End an accepted call. Either participant may end it."""
    call = call_repository.get_call_by_id(db, call_id)
    if call is None:
        raise ResourceNotFoundError("Call not found")
    if call.status not in (CallStatus.RINGING, CallStatus.ACCEPTED):
        raise ConflictError("Call is not active")
    if user.id not in (call.caller_id, call.callee_id):
        raise ForbiddenError("You are not a participant of this call")

    call.status = CallStatus.ENDED
    call.ended_at = _utcnow()
    call.duration_seconds = duration_seconds
    call_repository.save_call(db, call)


def mark_missed_call(
    db: Session,
    *,
    call_id: uuid.UUID,
) -> None:
    """Mark a ringing call as missed (server-side timeout)."""
    call = call_repository.get_call_by_id(db, call_id)
    if call is None or call.status != CallStatus.RINGING:
        return
    call.status = CallStatus.MISSED
    call.ended_at = _utcnow()
    call_repository.save_call(db, call)


def get_call_or_raise(
    db: Session,
    *,
    call_id: uuid.UUID,
    user: User,
) -> CallStatus:
    """Return the call if the user is a participant, else raise."""
    call = call_repository.get_call_by_id(db, call_id)
    if call is None:
        raise ResourceNotFoundError("Call not found")
    if user.id not in (call.caller_id, call.callee_id):
        raise ForbiddenError("You are not a participant of this call")
    return call
