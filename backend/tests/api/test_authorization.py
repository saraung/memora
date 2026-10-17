"""Tests for the RBAC permission dependency."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.exceptions import ForbiddenError
from app.infrastructure.database.repositories import (
    rbac_repository,
    user_repository,
)
from app.modules.authorization import permissions as perm
from app.modules.authorization.dependencies import require_permission
from tests.conftest import register_payload


def test_require_permission_denies_by_default(
    client: TestClient, db: Session
) -> None:
    response = client.post("/api/v1/auth/register", json=register_payload())
    assert response.status_code == 201
    user = user_repository.get_by_email(db, "alice@example.com")
    assert user is not None

    with pytest.raises(ForbiddenError):
        require_permission(perm.REPORTS_REVIEW)(
            current_user=user, db=db
        )


def test_require_permission_allows_granted_user(
    client: TestClient, db: Session
) -> None:
    response = client.post("/api/v1/auth/register", json=register_payload())
    assert response.status_code == 201
    user = user_repository.get_by_email(db, "alice@example.com")
    assert user is not None

    role = rbac_repository.create_role(db, name="moderator")
    permission = rbac_repository.create_permission(
        db, code=perm.REPORTS_REVIEW
    )
    rbac_repository.grant_permission_to_role(
        db, role_id=role.id, permission_id=permission.id
    )
    rbac_repository.grant_role(db, user_id=user.id, role_id=role.id)

    allowed = require_permission(perm.REPORTS_REVIEW)(
        current_user=user, db=db
    )
    assert allowed.id == user.id

    # A different permission is still denied.
    with pytest.raises(ForbiddenError):
        require_permission(perm.USERS_SUSPEND)(
            current_user=user, db=db
        )
