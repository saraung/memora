"""Request/response schemas for stories and reels."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.users.schemas import UserSummary


class PublishStoryRequest(BaseModel):
    media_id: uuid.UUID
    caption: str | None = Field(default=None, max_length=220)


class StoryMediaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    resource_type: str
    format: str
    width: int | None = None
    height: int | None = None
    duration: float | None = None
    secure_url: str


class StoryResponse(BaseModel):
    id: uuid.UUID
    caption: str | None = None
    author: UserSummary
    media: StoryMediaResponse
    viewed: bool
    created_at: datetime
    expires_at: datetime


class AuthorStoriesResponse(BaseModel):
    author: UserSummary
    stories: list[StoryResponse]
    has_unseen: bool


class ViewerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None = None
    viewed_at: datetime | None = None


class PublishReelRequest(BaseModel):
    video_id: uuid.UUID
    cover_id: uuid.UUID | None = None
    caption: str | None = Field(default=None, max_length=2200)


class ReelResponse(BaseModel):
    id: uuid.UUID
    caption: str | None = None
    author: UserSummary
    video: StoryMediaResponse
    cover: StoryMediaResponse | None = None
    view_count: int
    like_count: int
    comment_count: int
    liked: bool
    saved: bool
    created_at: datetime


class ReelViewResponse(BaseModel):
    view_count: int
    counted: bool
    reel: ReelResponse


class ReelCommentInput(BaseModel):
    body: str = Field(min_length=1, max_length=1000)
    parent_id: uuid.UUID | None = None


class ReelCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    body: str
    parent_id: uuid.UUID | None = None
    author: UserSummary
    created_at: datetime
    updated_at: datetime


class ActionStatusResponse(BaseModel):
    status: str
