"""Persistence for conversations, participants, and messages."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlmodel import Session, func, select

from app.infrastructure.database.models.messaging import (
    Conversation,
    ConversationParticipant,
    Message,
    MessageReceipt,
)


# -- Conversations ---------------------------------------------------------------


def create_conversation(
    session: Session, *, dm_key: str | None = None
) -> Conversation:
    record = Conversation(dm_key=dm_key)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_conversation_by_id(
    session: Session, conversation_id: uuid.UUID
) -> Conversation | None:
    return session.get(Conversation, conversation_id)


def get_conversation_by_dm_key(
    session: Session, dm_key: str
) -> Conversation | None:
    return session.exec(
        select(Conversation).where(Conversation.dm_key == dm_key)
    ).first()


def save_conversation(
    session: Session, record: Conversation
) -> Conversation:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def add_participant(
    session: Session,
    *,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ConversationParticipant:
    link = ConversationParticipant(
        conversation_id=conversation_id, user_id=user_id
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


def get_participant(
    session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> ConversationParticipant | None:
    return session.get(ConversationParticipant, (conversation_id, user_id))


def get_active_participant(
    session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> ConversationParticipant | None:
    """Membership ignoring users who left (deleted the conversation)."""
    link = get_participant(session, conversation_id, user_id)
    if link is None or link.left_at is not None:
        return None
    return link


def save_participant(
    session: Session, record: ConversationParticipant
) -> ConversationParticipant:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def participant_user_ids(
    session: Session, conversation_id: uuid.UUID
) -> list[uuid.UUID]:
    return list(
        session.exec(
            select(ConversationParticipant.user_id).where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.left_at.is_(None),
            )
        ).all()
    )


def all_participant_user_ids(
    session: Session, conversation_id: uuid.UUID
) -> list[uuid.UUID]:
    """Every participant ever, including those who left.

    Used to resolve the other side of a DM: leaving hides your own
    copy but must never break the other person's view.
    """
    return list(
        session.exec(
            select(ConversationParticipant.user_id).where(
                ConversationParticipant.conversation_id == conversation_id
            )
        ).all()
    )


def list_participants(
    session: Session, conversation_id: uuid.UUID
) -> list[ConversationParticipant]:
    return list(
        session.exec(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conversation_id
            )
        ).all()
    )


def list_conversation_ids_for_user(
    session: Session, user_id: uuid.UUID
) -> list[uuid.UUID]:
    return list(
        session.exec(
            select(ConversationParticipant.conversation_id).where(
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.left_at.is_(None),
            )
        ).all()
    )


def list_conversations_for_user_before(
    session: Session,
    *,
    user_id: uuid.UUID,
    limit: int,
    before: tuple[datetime | None, uuid.UUID] | None = None,
) -> list[Conversation]:
    """Conversations ordered by recent activity (nulls last)."""
    query = (
        select(Conversation)
        .join(
            ConversationParticipant,
            ConversationParticipant.conversation_id == Conversation.id,
        )
        .where(
            ConversationParticipant.user_id == user_id,
            ConversationParticipant.left_at.is_(None),
        )
    )
    if before is not None:
        activity, conversation_id = before
        if activity is None:
            query = query.where(Conversation.id < conversation_id)
        else:
            query = query.where(
                (Conversation.last_activity_at < activity)
                | (
                    (Conversation.last_activity_at == activity)
                    & (Conversation.id < conversation_id)
                )
                | (Conversation.last_activity_at.is_(None))
            )
    query = query.order_by(
        Conversation.last_activity_at.is_(None),
        Conversation.last_activity_at.desc(),
        Conversation.id.desc(),
    ).limit(limit + 1)
    return list(session.exec(query).all())


def last_message_for_conversations(
    session: Session, conversation_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Message]:
    """Newest non-deleted message per conversation (preview use)."""
    if not conversation_ids:
        return {}
    # Per-conversation latest via correlated ordering; small N, two queries.
    result: dict[uuid.UUID, Message] = {}
    for cid in conversation_ids:
        message = session.exec(
            select(Message)
            .where(
                Message.conversation_id == cid,
                Message.is_deleted.is_(False),
            )
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        ).first()
        if message is not None:
            result[cid] = message
    return result


def unread_count_for_conversations(
    session: Session,
    *,
    user_id: uuid.UUID,
    conversation_ids: list[uuid.UUID],
) -> dict[uuid.UUID, int]:
    """Messages in each conversation without a read receipt for the user."""
    counts: dict[uuid.UUID, int] = {}
    for cid in conversation_ids:
        read_ids = select(MessageReceipt.message_id).where(
            MessageReceipt.user_id == user_id,
            MessageReceipt.read_at.is_not(None),
        )
        count = (
            session.exec(
                select(func.count())
                .select_from(Message)
                .where(
                    Message.conversation_id == cid,
                    Message.is_deleted.is_(False),
                    Message.sender_id != user_id,
                    Message.id.not_in(read_ids),
                )
            ).one()
            or 0
        )
        counts[cid] = count
    return counts


# -- Messages ---------------------------------------------------------------------


def create_message(session: Session, *, record: Message) -> Message:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_message_by_id(
    session: Session, message_id: uuid.UUID
) -> Message | None:
    return session.get(Message, message_id)


def save_message(session: Session, record: Message) -> Message:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_messages_before(
    session: Session,
    *,
    conversation_id: uuid.UUID,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[Message]:
    """Newest first, including soft-deleted shells (rendered as tombstones)."""
    query = select(Message).where(
        Message.conversation_id == conversation_id
    )
    if before is not None:
        created_at, message_id = before
        query = query.where(
            (Message.created_at < created_at)
            | (
                (Message.created_at == created_at)
                & (Message.id < message_id)
            )
        )
    query = query.order_by(
        Message.created_at.desc(), Message.id.desc()
    ).limit(limit + 1)
    return list(session.exec(query).all())


def mark_read_up_to(
    session: Session,
    *,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    up_to: datetime,
    now: datetime,
) -> int:
    """Create/refresh read receipts for the user's unread messages here."""
    messages = session.exec(
        select(Message).where(
            Message.conversation_id == conversation_id,
            Message.is_deleted.is_(False),
            Message.sender_id != user_id,
            Message.created_at <= up_to,
        )
    ).all()
    touched = 0
    for message in messages:
        receipt = session.get(MessageReceipt, (message.id, user_id))
        if receipt is None:
            receipt = MessageReceipt(
                message_id=message.id,
                user_id=user_id,
                delivered_at=now,
                read_at=now,
            )
            session.add(receipt)
            touched += 1
        elif receipt.read_at is None:
            receipt.read_at = now
            session.add(receipt)
            touched += 1
    if touched:
        session.commit()
    return touched


def read_receipts_for_messages(
    session: Session,
    *,
    message_ids: list[uuid.UUID],
    exclude_user_id: uuid.UUID,
) -> dict[uuid.UUID, int]:
    """Count of other participants who read each message."""
    if not message_ids:
        return {}
    counts: dict[uuid.UUID, int] = {}
    for mid in message_ids:
        counts[mid] = (
            session.exec(
                select(func.count())
                .select_from(MessageReceipt)
                .where(
                    MessageReceipt.message_id == mid,
                    MessageReceipt.user_id != exclude_user_id,
                    MessageReceipt.read_at.is_not(None),
                )
            ).one()
            or 0
        )
    return counts


def add_message_media(
    session: Session,
    *,
    message_id: uuid.UUID,
    media_id: uuid.UUID,
    position: int,
) -> None:
    from app.infrastructure.database.models.messaging import MessageMedia

    session.add(
        MessageMedia(
            message_id=message_id, media_id=media_id, position=position
        )
    )
    session.commit()


def list_media_for_messages(
    session: Session, message_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list]:
    """Batch-load attachment assets keyed by message id (position order)."""
    from app.infrastructure.database.models.media import MediaAsset
    from app.infrastructure.database.models.messaging import MessageMedia

    if not message_ids:
        return {}
    rows = list(
        session.exec(
            select(MessageMedia, MediaAsset)
            .join(MediaAsset, MediaAsset.id == MessageMedia.media_id)
            .where(MessageMedia.message_id.in_(message_ids))
            .order_by(MessageMedia.position)
        ).all()
    )
    grouped: dict[uuid.UUID, list] = {}
    for link, asset in rows:
        grouped.setdefault(link.message_id, []).append(asset)
    return grouped
