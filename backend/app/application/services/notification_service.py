"""Notification fan-out with safety guards.

Never notifies about disallowed interactions: inactive accounts,
self-actions, and blocked pairs are skipped silently.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlmodel import Session

from app.domain.enums import AccountStatus, NotificationType
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    notification_repository,
    social_repository,
    user_repository,
)

# Repeats of these are low-information (another message in the same thread,
# another call from the same person), so we bump the existing unread entry
# instead of stacking new rows — the same "collapse" real apps use.
COALESCING_TYPES: frozenset[NotificationType] = frozenset(
    {NotificationType.MESSAGE, NotificationType.CALL}
)


def _usable(user: User | None) -> bool:
    return user is not None and user.account_status == AccountStatus.ACTIVE


def notify(
    db: Session,
    *,
    recipient_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    type: NotificationType,
    target_type: str | None = None,
    target_id: str | None = None,
) -> None:
    """Create a notification unless a safety rule suppresses it."""
    recipient = user_repository.get_by_id(db, recipient_id)
    if not _usable(recipient):
        return
    actor: User | None = None
    if actor_id is not None:
        if actor_id == recipient_id:
            return  # no self-notifications for social events
        actor = user_repository.get_by_id(db, actor_id)
        if not _usable(actor):
            return
        assert recipient is not None
        if social_repository.is_blocked_either_way(
            db, actor_id, recipient.id
        ):
            return  # never notify across a block

    if type in COALESCING_TYPES:
        existing = notification_repository.get_unread_matching(
            db,
            recipient_id=recipient_id,
            actor_id=actor_id,
            type=type,
            target_type=target_type,
            target_id=target_id,
        )
        if existing is not None:
            # Bump to the top of the feed and keep it unread.
            existing.created_at = datetime.now(timezone.utc)
            notification_repository.save_notification(db, existing)
            return

    notification_repository.create_notification(
        db,
        recipient_id=recipient_id,
        actor_id=actor_id,
        type=type,
        target_type=target_type,
        target_id=target_id,
    )
