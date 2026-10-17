"""Privacy guarantees: no staff path to message contents."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.infrastructure.database.repositories import rbac_repository
from tests.conftest import register_payload


def _register(client: TestClient, **overrides):
    response = client.post(
        "/api/v1/auth/register", json=register_payload(**overrides)
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


def test_no_staff_permission_grants_message_access(db: Session) -> None:
    """The canonical permission catalog contains no message codes.

    Documents PRIVACY.md §2: message reads are gated solely by
    conversation participation. Staff roles — and even a hypothetical
    `messages:read` permission granted below — unlock nothing because
    no endpoint consults it.
    """
    from app.modules.authorization import permissions as perm

    for code, _ in perm.ALL_PERMISSIONS:
        assert "message" not in code
        assert "conversation" not in code

    role = rbac_repository.create_role(db, name="admin")
    sneaky = rbac_repository.create_permission(db, code="messages:read")
    rbac_repository.grant_permission_to_role(
        db, role_id=role.id, permission_id=sneaky.id
    )
    assert "messages:read" in {
        p.code for p in rbac_repository.list_permissions(db)
    }


def test_admin_role_does_not_bypass_thread_privacy(
    client: TestClient, db: Session
) -> None:
    """Even a staff admin gets 404 on threads they don't participate in."""
    alice, alice_h = _register(
        client, email="alice@example.com", username="alice",
        password="supersecret1",
    )
    bob, bob_h = _register(
        client, email="bob@example.com", username="bob",
        password="supersecret1",
    )
    carol, carol_h = _register(
        client, email="carol@example.com", username="carol",
        password="supersecret1",
    )
    conv_id = client.post(
        "/api/v1/conversations/direct",
        json={"participant_id": bob["id"], "body": "secret"},
        headers=alice_h,
    ).json()["conversation"]["id"]

    # Grant carol the admin role AND a message-scoped permission.
    # Neither unlocks someone else's thread: participation is the
    # only gate, and it stays deny-by-default.
    admin = rbac_repository.create_role(db, name="admin")
    sneaky = rbac_repository.create_permission(db, code="messages:read")
    rbac_repository.grant_permission_to_role(
        db, role_id=admin.id, permission_id=sneaky.id
    )
    rbac_repository.grant_role(db, user_id=carol["id"], role_id=admin.id)
    assert "messages:read" in rbac_repository.permission_codes_for_user(
        db, carol["id"]
    )

    assert (
        client.get(f"/api/v1/conversations/{conv_id}/messages", headers=carol_h).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/conversations/{conv_id}/messages",
            json={"body": "snoop"},
            headers=carol_h,
        ).status_code
        == 404
    )
