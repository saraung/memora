"""Internal data-transfer objects for the auth use cases."""

from __future__ import annotations

from dataclasses import dataclass

from app.infrastructure.database.models.user import User


@dataclass
class AuthResult:
    """Outcome of register/login/refresh: the user plus fresh tokens."""

    user: User
    access_token: str
    refresh_token: str
