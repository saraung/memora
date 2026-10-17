"""Response schemas for notifications."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.modules.users.schemas import UserSummary


class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    actor: UserSummary | None = None
    target_type: str | None = None
    target_id: str | None = None
    is_read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkAllReadResponse(BaseModel):
    marked: int
