"""Request/response schemas for reports and moderation decisions."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.users.schemas import UserSummary


class ReportCreateRequest(BaseModel):
    target_type: str = Field(max_length=32)
    target_id: str = Field(max_length=128)
    category: str = Field(max_length=32)
    details: str | None = Field(default=None, max_length=2000)


class ReportResponse(BaseModel):
    id: uuid.UUID
    reporter: UserSummary | None = None
    target_type: str
    target_id: str
    category: str
    details: str | None = None
    status: str
    assignee: UserSummary | None = None
    created_at: datetime
    updated_at: datetime


class ReportDetailResponse(ReportResponse):
    actions: list["ModerationActionResponse"] = []


class ModerationActionResponse(BaseModel):
    id: uuid.UUID
    moderator_id: uuid.UUID | None
    target_type: str
    target_id: str
    decision: str
    reason: str
    created_at: datetime


class DecideReportRequest(BaseModel):
    decision: str = Field(max_length=32)
    reason: str = Field(min_length=1, max_length=1000)
