"""Request/response schemas for the media upload flow."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class UploadIntentRequest(BaseModel):
    expected_mime: str = Field(min_length=3, max_length=64)
    expected_bytes: int = Field(gt=0)


class UploadIntentResponse(BaseModel):
    id: uuid.UUID
    public_id: str
    resource_type: str
    expires_at: datetime
    upload_url: str
    params: dict[str, Any]


class MediaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    resource_type: str
    format: str
    size_bytes: int
    width: int | None = None
    height: int | None = None
    duration: float | None = None
    secure_url: str
    status: str
    created_at: datetime
