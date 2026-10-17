"""Request/response schemas for conversations and messages."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.users.schemas import UserSummary


class StartDirectMessageRequest(BaseModel):
    participant_id: uuid.UUID
    body: str = Field(default="", max_length=2000)
    media_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)


class DirectMessageResponse(BaseModel):
    conversation: ConversationResponse
    message: MessageDetailResponse


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    body: str | None
    is_edited: bool
    is_deleted: bool
    created_at: datetime


class MediaAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    resource_type: str
    width: int | None = None
    height: int | None = None
    secure_url: str


class MessageDetailResponse(BaseModel):
    message: MessageResponse
    sender: UserSummary
    read_count: int
    media: list[MediaAttachmentResponse] = []


class ConversationResponse(BaseModel):
    id: uuid.UUID
    other_user: UserSummary
    last_message: MessageResponse | None = None
    unread_count: int


class SendMessageRequest(BaseModel):
    body: str = Field(default="", max_length=2000)
    media_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)


class MarkReadRequest(BaseModel):
    up_to_message_id: uuid.UUID | None = None


class MarkReadResponse(BaseModel):
    marked: int


class EditMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CallResponse(BaseModel):
    call_id: uuid.UUID
    status: str | None = None
    started_at: datetime | None = None
    answered_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    created_at: datetime | None = None


class EndCallRequest(BaseModel):
    duration_seconds: int = Field(default=0, ge=0)
