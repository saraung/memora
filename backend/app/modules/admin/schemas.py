"""Request/response schemas for staff administration."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.users.schemas import UserSummary


class AccountStatusRequest(BaseModel):
    status: str = Field(max_length=32)
    reason: str = Field(min_length=1, max_length=1000)


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    username: str
    display_name: str
    account_status: str
    is_verified: bool
    is_private: bool
    roles: list[str]
    created_at: datetime


class RoleAssignmentRequest(BaseModel):
    role: str = Field(min_length=1, max_length=64)


class RoleResponse(BaseModel):
    name: str
    description: str
    permissions: list[str]


class AuditEventResponse(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    request_id: str | None = None
    meta: dict[str, Any] | None = None
    created_at: datetime


class AdminUserSummary(BaseModel):
    user: UserSummary
    account_status: str
    roles: list[str]


class SeriesPoint(BaseModel):
    """A single day in a time series (UTC)."""

    date: str
    value: int


class CountItem(BaseModel):
    """A labelled rank entry (category, status, role …)."""

    key: str
    count: int


class OverviewStatsResponse(BaseModel):
    generated_at: datetime
    range_days: int
    accounts: dict[str, int]
    content: dict[str, int]
    social: dict[str, int]
    reports: dict[str, int]
    staff: dict[str, int]
    signups_series: list[SeriesPoint]
    posts_series: list[SeriesPoint]
    reports_series: list[SeriesPoint]
    reports_by_category: list[CountItem]
    reports_by_status: list[CountItem]
    roles: list[CountItem]


class UserReportRef(BaseModel):
    id: uuid.UUID
    category: str
    status: str
    created_at: datetime


class AdminUserDetailResponse(AdminUserResponse):
    followers: int
    following: int
    posts: int
    recent_reports: list[UserReportRef]


class StaffMemberResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    display_name: str
    account_status: str
    roles: list[str]
    created_at: datetime