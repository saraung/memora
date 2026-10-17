"""Conversation and message endpoints (HTTP half of messaging)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlmodel import Session

from app.api.pagination import PageResponse
from app.application.services import messaging_service
from app.application.services import call_service
from app.application.services.messaging_service import (
    ConversationSummary,
    MessageDetail,
)
from app.core.middleware import get_request_id
from app.infrastructure.database.models.messaging import Message
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import messaging_repository
from app.infrastructure.database.repositories import user_repository
from app.infrastructure.database.session import get_session
from app.infrastructure.realtime.hub import hub
from app.modules.auth.dependencies import get_current_user
from app.modules.messaging import schemas
from app.modules.users.schemas import UserSummary

router = APIRouter(tags=["messaging"])


def _message_response(message: Message) -> schemas.MessageResponse:
    return schemas.MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        body=None if message.is_deleted else message.body,
        is_edited=message.is_edited,
        is_deleted=message.is_deleted,
        created_at=message.created_at,
    )


def _detail_response(detail: MessageDetail) -> schemas.MessageDetailResponse:
    return schemas.MessageDetailResponse(
        message=_message_response(detail.message),
        sender=UserSummary.model_validate(detail.sender),
        read_count=detail.read_count,
        media=[
            schemas.MediaAttachmentResponse.model_validate(m)
            for m in detail.media
        ],
    )


def _conversation_response(
    summary: ConversationSummary,
) -> schemas.ConversationResponse:
    return schemas.ConversationResponse(
        id=summary.conversation.id,
        other_user=UserSummary.model_validate(summary.other_user),
        last_message=(
            _message_response(summary.last_message)
            if summary.last_message is not None
            else None
        ),
        unread_count=summary.unread_count,
    )


@router.get(
    "/conversations",
    response_model=PageResponse[schemas.ConversationResponse],
)
def list_conversations(
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.ConversationResponse]:
    page = messaging_service.list_conversations(
        db, user=current_user, limit=limit, cursor=cursor
    )
    return PageResponse(
        items=[_conversation_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.post(
    "/conversations/direct",
    response_model=schemas.DirectMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_direct_message(
    body: schemas.StartDirectMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.DirectMessageResponse:
    """Atomically find-or-create a DM thread and send its first message.

    No thread exists for either user until this first send succeeds.
    """
    conversation, message = messaging_service.start_direct_message(
        db,
        sender=current_user,
        participant_id=body.participant_id,
        body=body.body,
        media_ids=body.media_ids,
    )
    sender = user_repository.get_by_id(db, message.sender_id)
    assert sender is not None
    payload = _message_response(message)
    media = messaging_repository.list_media_for_messages(db, [message.id]).get(
        message.id, []
    )
    await hub.broadcast(
        conversation.id,
        {
            "type": "message",
            "conversation_id": str(conversation.id),
            "message": payload.model_dump(mode="json"),
            "media": [
                schemas.MediaAttachmentResponse.model_validate(m).model_dump(
                    mode="json"
                )
                for m in media
            ],
        },
    )
    other = user_repository.get_by_id(db, body.participant_id)
    assert other is not None
    return schemas.DirectMessageResponse(
        conversation=schemas.ConversationResponse(
            id=conversation.id,
            other_user=UserSummary.model_validate(other),
            last_message=payload,
            unread_count=0,
        ),
        message=schemas.MessageDetailResponse(
            message=payload,
            sender=UserSummary.model_validate(sender),
            read_count=0,
            media=[
                schemas.MediaAttachmentResponse.model_validate(m)
                for m in media
            ],
        ),
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=PageResponse[schemas.MessageDetailResponse],
)
def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(default=30, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.MessageDetailResponse]:
    page = messaging_service.list_messages(
        db,
        user=current_user,
        conversation_id=conversation_id,
        limit=limit,
        cursor=cursor,
    )
    return PageResponse(
        items=[_detail_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.post(
    "/conversations/{conversation_id}/call",
    response_model=schemas.CallResponse,
    status_code=status.HTTP_201_CREATED,
)
async def initiate_call(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.CallResponse:
    """Initiate a voice call in a direct conversation."""
    call_id = call_service.initiate_call(
        db, caller=current_user, conversation_id=conversation_id
    )
    return schemas.CallResponse(call_id=call_id)


@router.post(
    "/calls/{call_id}/answer",
    response_model=schemas.CallResponse,
)
async def answer_call(
    call_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.CallResponse:
    """Answer an incoming ringing call (callee only)."""
    call_service.answer_call(db, call_id=call_id, user=current_user)
    return schemas.CallResponse(call_id=call_id)


@router.post(
    "/calls/{call_id}/decline",
    response_model=schemas.CallResponse,
)
async def decline_call(
    call_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.CallResponse:
    """Decline an incoming ringing call (callee only)."""
    call_service.decline_call(db, call_id=call_id, user=current_user)
    return schemas.CallResponse(call_id=call_id)


@router.post(
    "/calls/{call_id}/end",
    response_model=schemas.CallResponse,
)
async def end_call(
    call_id: uuid.UUID,
    body: schemas.EndCallRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.CallResponse:
    """End an active call (either participant)."""
    call_service.end_call(
        db,
        call_id=call_id,
        user=current_user,
        duration_seconds=body.duration_seconds,
    )
    return schemas.CallResponse(call_id=call_id)


@router.get(
    "/conversations/{conversation_id}/calls",
    response_model=list[schemas.CallResponse],
)
async def list_calls(
    conversation_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=50),
    before: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> list[schemas.CallResponse]:
    """List calls for a conversation (newest first)."""
    conversation = messaging_repository.get_conversation_by_id(
        db, conversation_id
    )
    if conversation is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Conversation not found")
    if (
        messaging_repository.get_active_participant(
            db, conversation_id, current_user.id
        )
        is None
    ):
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Not a participant")

    before_dt = None
    if before:
        from datetime import datetime

        try:
            before_dt = datetime.fromisoformat(before)
        except ValueError:
            from fastapi import HTTPException

            raise HTTPException(status_code=422, detail="Invalid before timestamp")

    calls = call_repository.list_calls_for_conversation(
        db, conversation_id=conversation_id, limit=limit, before=before_dt
    )
    return [
        schemas.CallResponse(
            call_id=c.id,
            status=c.status,
            started_at=c.started_at,
            answered_at=c.answered_at,
            ended_at=c.ended_at,
            duration_seconds=c.duration_seconds,
            created_at=c.created_at,
        )
        for c in calls
    ]


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=schemas.MessageDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: uuid.UUID,
    body: schemas.SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MessageDetailResponse:
    message = messaging_service.send_message(
        db,
        sender=current_user,
        conversation_id=conversation_id,
        body=body.body,
        media_ids=body.media_ids,
    )
    sender = user_repository.get_by_id(db, message.sender_id)
    assert sender is not None
    payload = _message_response(message)
    media = messaging_repository.list_media_for_messages(db, [message.id]).get(
        message.id, []
    )
    # Realtime fan-out; HTTP history stays the source of truth.
    await hub.broadcast(
        conversation_id,
        {
            "type": "message",
            "conversation_id": str(conversation_id),
            "message": payload.model_dump(mode="json"),
            "media": [
                schemas.MediaAttachmentResponse.model_validate(m).model_dump(
                    mode="json"
                )
                for m in media
            ],
        },
    )
    return schemas.MessageDetailResponse(
        message=payload,
        sender=UserSummary.model_validate(sender),
        read_count=0,
        media=[schemas.MediaAttachmentResponse.model_validate(m) for m in media],
    )


@router.post(
    "/conversations/{conversation_id}/read",
    response_model=schemas.MarkReadResponse,
)
def mark_read(
    conversation_id: uuid.UUID,
    body: schemas.MarkReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MarkReadResponse:
    marked = messaging_service.mark_read(
        db,
        user=current_user,
        conversation_id=conversation_id,
        up_to_message_id=body.up_to_message_id,
    )
    return schemas.MarkReadResponse(marked=marked)


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def leave_conversation(
    conversation_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> None:
    """Delete the conversation from the caller's list only."""
    messaging_service.leave_conversation(
        db,
        user=current_user,
        conversation_id=conversation_id,
        request_id=get_request_id(request),
    )


@router.patch(
    "/messages/{message_id}",
    response_model=schemas.MessageDetailResponse,
)
def edit_message(
    message_id: uuid.UUID,
    body: schemas.EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MessageDetailResponse:
    message = messaging_service.edit_message(
        db, user=current_user, message_id=message_id, body=body.body
    )
    sender = user_repository.get_by_id(db, message.sender_id)
    assert sender is not None
    read_counts = messaging_repository.read_receipts_for_messages(
        db, message_ids=[message.id], exclude_user_id=current_user.id
    )
    media = messaging_repository.list_media_for_messages(db, [message.id]).get(
        message.id, []
    )
    return schemas.MessageDetailResponse(
        message=_message_response(message),
        sender=UserSummary.model_validate(sender),
        read_count=read_counts.get(message.id, 0),
        media=[schemas.MediaAttachmentResponse.model_validate(m) for m in media],
    )


@router.delete(
    "/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_message(
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> None:
    messaging_service.delete_message(
        db, user=current_user, message_id=message_id
    )
