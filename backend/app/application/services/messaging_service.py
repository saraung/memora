"""Direct conversations and messages."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlmodel import Session

from app.application.pagination import decode_cursor, encode_cursor
from app.application.services import notification_service
from app.core.exceptions import (
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from app.domain.enums import NotificationType
from app.infrastructure.database.models.messaging import (
    Conversation,
    Message,
)
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    messaging_repository,
    social_repository,
    user_repository,
)

MAX_MESSAGE_LENGTH = 2000


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _dm_key(user_a: uuid.UUID, user_b: uuid.UUID) -> str:
    first, second = sorted((user_a, user_b))
    return f"{first.hex}:{second.hex}"


@dataclass
class ConversationSummary:
    conversation: Conversation
    other_user: User
    last_message: Message | None
    unread_count: int


@dataclass
class ConversationPage:
    items: list[ConversationSummary]
    next_cursor: str | None
    has_more: bool


@dataclass
class MessageDetail:
    message: Message
    sender: User
    read_count: int
    media: list = field(default_factory=list)


MAX_MESSAGE_MEDIA = 5


@dataclass
class MessagePage:
    items: list[MessageDetail]
    next_cursor: str | None
    has_more: bool


def _require_participant(
    db: Session, *, user_id: uuid.UUID, conversation_id: uuid.UUID
) -> Conversation:
    conversation = messaging_repository.get_conversation_by_id(
        db, conversation_id
    )
    if conversation is None:
        raise ResourceNotFoundError("Conversation not found")
    if (
        messaging_repository.get_active_participant(
            db, conversation_id, user_id
        )
        is None
    ):
        # Same 404 as a missing conversation: IDs never act as authorization.
        # This also covers users who left (deleted) the conversation.
        raise ResourceNotFoundError("Conversation not found")
    return conversation


def _other_participant(
    db: Session, *, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> User:
    ids = messaging_repository.all_participant_user_ids(
        db, conversation_id
    )
    others = [uid for uid in ids if uid != user_id]
    if not others:
        raise ResourceNotFoundError("Conversation not found")
    other = user_repository.get_by_id(db, others[0])
    if other is None:
        raise ResourceNotFoundError("Conversation not found")
    return other


def find_dm(
    db: Session, *, user: User, participant_id: uuid.UUID
) -> Conversation | None:
    """Look up the DM thread for a pair without creating anything.

    Returns None when no thread exists yet. Threads are only persisted
    together with their first message (see `start_direct_message`).
    """
    if user.id == participant_id:
        raise ValidationError("You cannot message yourself")
    target = user_repository.get_by_id(db, participant_id)
    if target is None or not target.is_active:
        raise ResourceNotFoundError("User not found")
    if social_repository.is_blocked_either_way(db, user.id, target.id):
        raise ForbiddenError("You cannot message this user")
    return messaging_repository.get_conversation_by_dm_key(
        db, _dm_key(user.id, target.id)
    )


def start_direct_message(
    db: Session,
    *,
    sender: User,
    participant_id: uuid.UUID,
    body: str,
    media_ids: list[uuid.UUID] | None = None,
) -> tuple[Conversation, Message]:
    """Find-or-create a DM thread and send its first message, atomically.

    Re-calling with the same pair appends to the existing thread, so
    starting a chat twice can never fork duplicates. Either text,
    images, or both are required.
    """
    body = (body or "").strip()
    attachments = _resolve_attachments(
        db, sender=sender, media_ids=list(media_ids or [])
    )
    if not body and not attachments:
        raise ValidationError("Message needs text, an image, or both")
    if len(body) > MAX_MESSAGE_LENGTH:
        raise ValidationError(
            f"Message must be 1–{MAX_MESSAGE_LENGTH} characters"
        )
    if sender.id == participant_id:
        raise ValidationError("You cannot message yourself")
    target = user_repository.get_by_id(db, participant_id)
    if target is None or not target.is_active:
        raise ResourceNotFoundError("User not found")
    if social_repository.is_blocked_either_way(db, sender.id, target.id):
        raise ForbiddenError("You cannot message this user")

    now = _utcnow()
    conversation = messaging_repository.get_conversation_by_dm_key(
        db, _dm_key(sender.id, target.id)
    )
    if conversation is None:
        conversation = messaging_repository.create_conversation(
            db, dm_key=_dm_key(sender.id, target.id)
        )
        messaging_repository.add_participant(
            db, conversation_id=conversation.id, user_id=sender.id
        )
        messaging_repository.add_participant(
            db, conversation_id=conversation.id, user_id=target.id
        )
    else:
        # Reopen for anyone who had deleted (left) the thread.
        for uid in (sender.id, target.id):
            link = messaging_repository.get_participant(
                db, conversation.id, uid
            )
            if link is not None and link.left_at is not None:
                link.left_at = None
                messaging_repository.save_participant(db, link)
    message = messaging_repository.create_message(
        db,
        record=Message(
            conversation_id=conversation.id,
            sender_id=sender.id,
            body=body,
        ),
    )
    for position, asset in enumerate(attachments):
        messaging_repository.add_message_media(
            db,
            message_id=message.id,
            media_id=asset.id,
            position=position,
        )
    from app.infrastructure.database.models.messaging import MessageReceipt

    for uid in (sender.id, target.id):
        if uid == sender.id:
            continue
        db.add(
            MessageReceipt(
                message_id=message.id, user_id=uid, delivered_at=now
            )
        )
    conversation.last_activity_at = now
    messaging_repository.save_conversation(db, conversation)
    db.commit()
    notification_service.notify(
        db,
        recipient_id=target.id,
        actor_id=sender.id,
        type=NotificationType.MESSAGE,
        target_type="conversation",
        target_id=str(conversation.id),
    )
    return conversation, message


def leave_conversation(
    db: Session,
    *,
    user: User,
    conversation_id: uuid.UUID,
    request_id: str | None = None,
) -> None:
    """Delete-for-me: hide the thread from the leaver's list only.

    Idempotent. History is retained so the thread reopens intact when
    either side messages again.
    """
    from app.infrastructure.database.repositories import audit_repository

    conversation = _require_participant(
        db, user_id=user.id, conversation_id=conversation_id
    )
    link = messaging_repository.get_participant(
        db, conversation.id, user.id
    )
    assert link is not None  # guaranteed by _require_participant
    if link.left_at is None:
        link.left_at = _utcnow()
        messaging_repository.save_participant(db, link)
        audit_repository.record(
            db,
            action="conversation.leave",
            actor_id=user.id,
            target_type="conversation",
            target_id=str(conversation.id),
            request_id=request_id,
        )


def list_conversations(
    db: Session,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> ConversationPage:
    limit = max(1, min(limit, 50))
    before: tuple[datetime | None, uuid.UUID] | None = None
    if cursor:
        payload = decode_cursor(cursor)
        try:
            stamp = payload["c"]
            before = (
                datetime.fromisoformat(str(stamp)) if stamp else None,
                uuid.UUID(str(payload["id"])),
            )
        except (ValueError, KeyError) as exc:
            raise ValidationError("Invalid pagination cursor") from exc
    rows = messaging_repository.list_conversations_for_user_before(
        db, user_id=user.id, limit=limit, before=before
    )
    other_ids: dict[uuid.UUID, uuid.UUID] = {}
    for conversation in rows[:limit]:
        try:
            other_ids[conversation.id] = _other_participant(
                db, conversation_id=conversation.id, user_id=user.id
            ).id
        except ResourceNotFoundError:
            continue
    others = user_repository.list_by_ids(db, list(set(other_ids.values())))
    previews = messaging_repository.last_message_for_conversations(
        db, [c.id for c in rows[:limit]]
    )
    unread = messaging_repository.unread_count_for_conversations(
        db,
        user_id=user.id,
        conversation_ids=[c.id for c in rows[:limit]],
    )
    items: list[ConversationSummary] = []
    for conversation in rows[:limit]:
        other_id = other_ids.get(conversation.id)
        other = others.get(other_id) if other_id else None
        if other is None or not other.is_active:
            continue
        items.append(
            ConversationSummary(
                conversation=conversation,
                other_user=other,
                last_message=previews.get(conversation.id),
                unread_count=unread.get(conversation.id, 0),
            )
        )
    has_more = len(rows) > limit
    next_cursor = None
    if has_more:
        last = rows[limit - 1]
        next_cursor = encode_cursor(
            {
                "c": last.last_activity_at.isoformat()
                if last.last_activity_at
                else None,
                "id": str(last.id),
            }
        )
    return ConversationPage(items=items, next_cursor=next_cursor, has_more=has_more)


def _resolve_attachments(
    db: Session, *, sender: User, media_ids: list[uuid.UUID]
) -> list:
    """Validate image assets owned by the sender, in order, deduped."""
    from app.core.exceptions import ForbiddenError as _Forbidden
    from app.domain.enums import MediaStatus as _MediaStatus
    from app.infrastructure.database.repositories import (
        media_repository as _media_repo,
    )

    if len(media_ids) > MAX_MESSAGE_MEDIA:
        raise ValidationError(
            f"At most {MAX_MESSAGE_MEDIA} attachments per message"
        )
    assets = []
    seen: set[uuid.UUID] = set()
    for mid in media_ids:
        if mid in seen:
            continue
        seen.add(mid)
        try:
            asset_id = mid if isinstance(mid, uuid.UUID) else uuid.UUID(str(mid))
        except (ValueError, AttributeError) as exc:
            raise ValidationError("Invalid media_id") from exc
        asset = _media_repo.get_asset_by_id(db, asset_id)
        if asset is None:
            raise ValidationError("One or more attachments do not exist")
        if asset.owner_id != sender.id:
            raise _Forbidden("You do not own one of these attachments")
        if asset.status != _MediaStatus.READY or asset.resource_type != "image":
            raise ValidationError("Attachments must be ready images")
        assets.append(asset)
    return assets


def send_message(
    db: Session,
    *,
    sender: User,
    conversation_id: uuid.UUID,
    body: str,
    media_ids: list[uuid.UUID] | None = None,
) -> Message:
    """Send a message after membership, block, and privacy checks.

    Either text, images, or both are required.
    """
    conversation = _require_participant(
        db, user_id=sender.id, conversation_id=conversation_id
    )
    other = _other_participant(
        db, conversation_id=conversation.id, user_id=sender.id
    )
    if not other.is_active:
        raise ForbiddenError("You cannot message this user")
    if social_repository.is_blocked_either_way(db, sender.id, other.id):
        raise ForbiddenError("You cannot message this user")
    body = (body or "").strip()
    attachments = _resolve_attachments(
        db, sender=sender, media_ids=list(media_ids or [])
    )
    if not body and not attachments:
        raise ValidationError("Message needs text, an image, or both")
    if len(body) > MAX_MESSAGE_LENGTH:
        raise ValidationError(
            f"Message must be 1–{MAX_MESSAGE_LENGTH} characters"
        )
    now = _utcnow()
    # Any new message reopens the thread for members who had left it.
    for link in messaging_repository.list_participants(
        db, conversation.id
    ):
        if link.left_at is not None:
            link.left_at = None
            messaging_repository.save_participant(db, link)
    message = messaging_repository.create_message(
        db,
        record=Message(
            conversation_id=conversation.id,
            sender_id=sender.id,
            body=body,
        ),
    )
    for position, asset in enumerate(attachments):
        messaging_repository.add_message_media(
            db,
            message_id=message.id,
            media_id=asset.id,
            position=position,
        )
    # Delivered receipts for the other participants.
    for uid in messaging_repository.participant_user_ids(
        db, conversation.id
    ):
        if uid == sender.id:
            continue
        from app.infrastructure.database.models.messaging import MessageReceipt

        db.add(
            MessageReceipt(
                message_id=message.id, user_id=uid, delivered_at=now
            )
        )
    conversation.last_activity_at = now
    messaging_repository.save_conversation(db, conversation)
    db.commit()
    notification_service.notify(
        db,
        recipient_id=other.id,
        actor_id=sender.id,
        type=NotificationType.MESSAGE,
        target_type="conversation",
        target_id=str(conversation.id),
    )
    return message


def list_messages(
    db: Session,
    *,
    user: User,
    conversation_id: uuid.UUID,
    limit: int,
    cursor: str | None,
) -> MessagePage:
    conversation = _require_participant(
        db, user_id=user.id, conversation_id=conversation_id
    )
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
    rows = messaging_repository.list_messages_before(
        db, conversation_id=conversation.id, limit=limit, before=before
    )
    senders = user_repository.list_by_ids(
        db, list({m.sender_id for m in rows[:limit]})
    )
    read_counts = messaging_repository.read_receipts_for_messages(
        db,
        message_ids=[m.id for m in rows[:limit]],
        exclude_user_id=user.id,
    )
    media_map = messaging_repository.list_media_for_messages(
        db, [m.id for m in rows[:limit]]
    )
    items = [
        MessageDetail(
            message=m,
            sender=senders[m.sender_id],
            read_count=read_counts.get(m.id, 0),
            media=media_map.get(m.id, []),
        )
        for m in rows[:limit]
        if m.sender_id in senders
    ]
    has_more = len(rows) > limit
    next_cursor = None
    if has_more and items:
        last = items[-1].message
        next_cursor = encode_cursor(
            {"c": last.created_at.isoformat(), "id": str(last.id)}
        )
    return MessagePage(items=items, next_cursor=next_cursor, has_more=has_more)


def mark_read(
    db: Session,
    *,
    user: User,
    conversation_id: uuid.UUID,
    up_to_message_id: uuid.UUID | None = None,
) -> int:
    conversation = _require_participant(
        db, user_id=user.id, conversation_id=conversation_id
    )
    if up_to_message_id is not None:
        message = messaging_repository.get_message_by_id(db, up_to_message_id)
        if message is None or message.conversation_id != conversation.id:
            raise ValidationError("Message does not belong here")
        up_to = message.created_at
    else:
        up_to = _utcnow()
    return messaging_repository.mark_read_up_to(
        db,
        user_id=user.id,
        conversation_id=conversation.id,
        up_to=up_to,
        now=_utcnow(),
    )


def edit_message(
    db: Session,
    *,
    user: User,
    message_id: uuid.UUID,
    body: str,
) -> Message:
    message = messaging_repository.get_message_by_id(db, message_id)
    if message is None or message.is_deleted:
        raise ResourceNotFoundError("Message not found")
    _require_participant(
        db, user_id=user.id, conversation_id=message.conversation_id
    )
    if message.sender_id != user.id:
        raise ForbiddenError("Only the sender can edit this message")
    body = body.strip()
    if not body or len(body) > MAX_MESSAGE_LENGTH:
        raise ValidationError(
            f"Message must be 1–{MAX_MESSAGE_LENGTH} characters"
        )
    message.body = body
    message.is_edited = True
    return messaging_repository.save_message(db, message)


def delete_message(
    db: Session, *, user: User, message_id: uuid.UUID
) -> None:
    message = messaging_repository.get_message_by_id(db, message_id)
    if message is None or message.is_deleted:
        raise ResourceNotFoundError("Message not found")
    _require_participant(
        db, user_id=user.id, conversation_id=message.conversation_id
    )
    if message.sender_id != user.id:
        raise ForbiddenError("Only the sender can delete this message")
    message.is_deleted = True
    messaging_repository.save_message(db, message)
