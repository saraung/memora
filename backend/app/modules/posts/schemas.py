"""Request/response schemas for posts, comments, and engagement."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.users.schemas import UserSummary


class PostMediaInput(BaseModel):
    media_id: uuid.UUID
    alt_text: str | None = Field(default=None, max_length=255)


class CreatePostRequest(BaseModel):
    caption: str | None = Field(default=None, max_length=2200)
    items: list[PostMediaInput] = Field(min_length=1, max_length=10)


class EditPostRequest(BaseModel):
    caption: str | None = Field(default=None, max_length=2200)


class PostMediaResponse(BaseModel):
    id: uuid.UUID
    resource_type: str
    format: str
    width: int | None = None
    height: int | None = None
    duration: float | None = None
    secure_url: str
    alt_text: str | None = None


class PostResponse(BaseModel):
    id: uuid.UUID
    caption: str | None = None
    author: UserSummary
    media: list[PostMediaResponse]
    like_count: int
    comment_count: int
    liked: bool
    bookmarked: bool
    source: str = "following"  # "following" | "discovery"
    created_at: datetime
    updated_at: datetime


class ActionStatusResponse(BaseModel):
    status: str


class CommentInput(BaseModel):
    body: str = Field(min_length=1, max_length=1000)
    parent_id: uuid.UUID | None = None


class EditCommentRequest(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    body: str
    parent_id: uuid.UUID | None = None
    author: UserSummary
    created_at: datetime
    updated_at: datetime
