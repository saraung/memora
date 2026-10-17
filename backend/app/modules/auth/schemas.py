"""Request/response schemas for authentication (public API contracts)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=254)
    username: str = Field(
        min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$"
    )
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    identifier: str = Field(
        min_length=1, max_length=254, description="Email or username"
    )
    password: str = Field(min_length=1, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=1)


class PasswordForgotRequest(BaseModel):
    email: EmailStr = Field(max_length=254)


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    username: str
    display_name: str
    avatar_url: str | None = None
    is_verified: bool
    account_status: str
    is_private: bool
    created_at: datetime
    # Staff authorization context (empty for ordinary users). Lets the
    # separate admin-frontend gate navigation without a second round-trip.
    roles: list[str] = []
    permissions: list[str] = []


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
