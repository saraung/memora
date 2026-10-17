"""API tests for the authentication lifecycle."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import generate_opaque_token, hash_token
from app.infrastructure.database.models.auth import (
    EmailVerificationToken,
    PasswordResetToken,
)
from app.infrastructure.database.repositories import session_repository
from tests.conftest import register_payload

ME = "/api/v1/auth/me"


def _register(client: TestClient, **overrides):
    return client.post(
        "/api/v1/auth/register", json=register_payload(**overrides)
    )


def _login(client: TestClient, identifier: str, password: str):
    return client.post(
        "/api/v1/auth/login",
        json={"identifier": identifier, "password": password},
    )


def _register_and_headers(client: TestClient, **overrides):
    response = _register(client, **overrides)
    assert response.status_code == 201, response.text
    body = response.json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    return headers, body["user"]


def test_register_success_sets_cookie(client: TestClient) -> None:
    response = _register(client)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user"]["username"] == "alice"
    assert body["user"]["is_verified"] is False
    assert body["access_token"]
    assert "refresh_token" in response.cookies


def test_register_duplicate_email_conflicts(client: TestClient) -> None:
    assert _register(client).status_code == 201
    response = _register(client, username="someone_else")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "RESOURCE_CONFLICT"


def test_register_duplicate_username_conflicts(client: TestClient) -> None:
    assert _register(client).status_code == 201
    response = _register(client, email="other@example.com")
    assert response.status_code == 409


def test_register_invalid_username_rejected(client: TestClient) -> None:
    response = _register(client, username="bad name!")
    assert response.status_code == 422


def test_login_by_email_and_username(client: TestClient) -> None:
    assert _register(client).status_code == 201
    assert _login(client, "alice@example.com", "supersecret1").status_code == 200
    assert _login(client, "alice", "supersecret1").status_code == 200
    assert _login(client, "ALICE", "supersecret1").status_code == 200


def test_login_wrong_password_unauthorized(client: TestClient) -> None:
    assert _register(client).status_code == 201
    response = _login(client, "alice", "wrongpassword")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_me_requires_auth(client: TestClient) -> None:
    assert client.get(ME).status_code == 401
    headers, _ = _register_and_headers(client)
    response = client.get(ME, headers=headers)
    assert response.status_code == 200
    assert response.json()["username"] == "alice"


def test_refresh_rotates_and_reuse_revokes_family(
    client: TestClient,
) -> None:
    reg = _register(client)
    assert reg.status_code == 201
    original = reg.cookies.get("refresh_token")
    assert original

    first = client.post("/api/v1/auth/refresh")
    assert first.status_code == 200, first.text
    assert first.json()["access_token"]
    rotated = first.cookies.get("refresh_token")
    assert rotated and rotated != original

    # Replay the original (now-rotated) token: must fail and revoke
    # the whole family, including the just-issued token.
    client.cookies.clear()
    replay = client.post(
        "/api/v1/auth/refresh", cookies={"refresh_token": original}
    )
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "TOKEN_REUSED"

    # Even the rotated token's family is now revoked.
    client.cookies.clear()
    assert (
        client.post(
            "/api/v1/auth/refresh", cookies={"refresh_token": rotated}
        ).status_code
        == 401
    )


def test_refresh_without_cookie_unauthorized(client: TestClient) -> None:
    client.cookies.clear()
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 401


def test_logout_revokes_session(client: TestClient) -> None:
    assert _register(client).status_code == 201
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert "refresh_token" not in client.cookies
    # Refresh cookie is gone, so refresh fails.
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_logout_all_revokes_everything(client: TestClient) -> None:
    reg = _register(client)
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post("/api/v1/auth/logout-all", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_me_exposes_staff_context(client: TestClient) -> None:
    """Ordinary accounts carry empty roles/permissions for staff gating."""
    reg = _register(client, username="plainuser", email="plain@example.com")
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    body = client.get(ME, headers=headers).json()
    assert body["roles"] == []
    assert body["permissions"] == []


def test_verify_email_flow(client: TestClient, db: Session) -> None:
    headers, user = _register_and_headers(client)
    me = client.get(ME, headers=headers).json()
    assert me["is_verified"] is False

    raw = generate_opaque_token(32)
    record = session_repository.create_email_verification_token(
        db,
        record=EmailVerificationToken(
            user_id=me["id"],
            token_hash=hash_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        ),
    )
    assert record is not None

    response = client.post("/api/v1/auth/verify-email", json={"token": raw})
    assert response.status_code == 200, response.text
    assert client.get(ME, headers=headers).json()["is_verified"] is True

    # Single-use: replaying fails.
    assert (
        client.post("/api/v1/auth/verify-email", json={"token": raw}).status_code
        == 401
    )


def test_password_reset_flow(client: TestClient, db: Session) -> None:
    headers, _ = _register_and_headers(client)

    # Forgot always returns success, even for unknown emails.
    assert (
        client.post(
            "/api/v1/auth/password/forgot",
            json={"email": "nobody@example.com"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/password/forgot",
            json={"email": "alice@example.com"},
        ).status_code
        == 200
    )

    me = client.get(ME, headers=headers).json()
    raw = generate_opaque_token(32)
    session_repository.create_password_reset_token(
        db,
        record=PasswordResetToken(
            user_id=me["id"],
            token_hash=hash_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        ),
    )

    response = client.post(
        "/api/v1/auth/password/reset",
        json={"token": raw, "new_password": "brandnewpass9"},
    )
    assert response.status_code == 200, response.text

    # Old password fails, new password works (login opens a new session).
    assert _login(client, "alice", "supersecret1").status_code == 401
    assert _login(client, "alice", "brandnewpass9").status_code == 200


def test_error_envelope_shape(client: TestClient) -> None:
    response = client.get(ME)
    assert response.status_code == 401
    error = response.json()["error"]
    assert {"code", "message", "details", "request_id"} <= set(error)
    assert response.headers.get("X-Request-ID")
