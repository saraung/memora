"""Reusable permission dependencies (RBAC enforcement)."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends
from sqlmodel import Session

from app.core.exceptions import ForbiddenError
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import rbac_repository
from app.infrastructure.database.session import get_session
from app.modules.auth.dependencies import get_current_user


def require_permission(code: str) -> Callable:
    """Build a dependency that enforces a staff permission code.

    Usage: `user = Depends(require_permission("reports:review"))`.
    Denies by default when the permission is missing.
    """

    def _dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_session),
    ) -> User:
        granted = rbac_repository.permission_codes_for_user(
            db, current_user.id
        )
        if code not in granted:
            raise ForbiddenError(
                "You do not have permission to perform this action",
                code="FORBIDDEN",
            )
        return current_user

    return _dependency
