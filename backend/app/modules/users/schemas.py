"""Request/response schemas for profiles, follows, and blocks."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

RelationshipState = Literal["self", "following", "requested", "none"]


def _http_url(value: str, *, field: str) -> str:
    value = value.strip()
    if not (value.startswith("http://") or value.startswith("https://")):
        raise ValueError(f"{field} must be an http(s) URL")
    return value


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None = None
    is_verified: bool
    last_seen_at: datetime | None = None


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    bio: str | None = None
    avatar_url: str | None = None
    links: list[str] | None = None
    is_private: bool
    is_verified: bool
    account_status: str
    follower_count: int
    following_count: int
    relationship: RelationshipState
    created_at: datetime


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    bio: str | None = Field(default=None, max_length=160)
    avatar_url: str | None = Field(default=None, max_length=2048)
    links: list[str] | None = Field(default=None, max_length=4)

    @field_validator("avatar_url")
    @classmethod
    def check_avatar(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return _http_url(value, field="avatar_url")

    @field_validator("links")
    @classmethod
    def check_links(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [_http_url(link, field="links") for link in value]


class PrivacyRequest(BaseModel):
    is_private: bool


class RelationActionResponse(BaseModel):
    status: str


class FollowRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    created_at: datetime
    requester: UserSummary


class SuggestionResponse(BaseModel):
    user: UserSummary
    follower_count: int
