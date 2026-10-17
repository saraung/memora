"""API tests for reports, moderation actions, and staff admin."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.infrastructure.database.repositories import rbac_repository
from app.infrastructure.storage.fake import FakeStorageProvider
from app.main import app
from app.modules.media.dependencies import get_storage_provider
from tests.conftest import register_payload

ADMIN = "/api/v1/admin"


def _register(client: TestClient, **overrides):
    response = client.post(
        "/api/v1/auth/register", json=register_payload(**overrides)
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return (
        body["user"],
        {"Authorization": f"Bearer {body['access_token']}"},
    )


def _alice(client: TestClient):
    return _register(
        client, email="alice@example.com", username="alice",
        password="supersecret1",
    )


def _grant(client: TestClient, db: Session, user: dict, role: str):
    role_obj = rbac_repository.get_role_by_name(db, role)
    assert role_obj is not None, f"seed roles first ({role})"
    rbac_repository.grant_role(db, user_id=user["id"], role_id=role_obj.id)


@pytest.fixture()
def fake_storage(client: TestClient):
    storage = FakeStorageProvider()
    app.dependency_overrides[get_storage_provider] = lambda: storage
    yield storage


@pytest.fixture()
def staff(client: TestClient, db: Session):
    from app.infrastructure.database.models.user import User

    admin, admin_h = _register(
        client, email="admin@example.com", username="admin1",
        password="supersecret1",
    )
    mod, mod_h = _register(
        client, email="mod@example.com", username="mod1",
        password="supersecret1",
    )
    for role_name in ("admin", "moderator", "support"):
        role = rbac_repository.get_role_by_name(db, role_name)
        if role is None:
            role = rbac_repository.create_role(db, name=role_name)
        for code, _ in [
            ("reports:read", ""),
            ("reports:review", ""),
            ("content:remove", ""),
            ("users:read", ""),
            ("users:suspend", ""),
            ("staff:manage", ""),
            ("audit:read", ""),
            ("analytics:read", ""),
            ("settings:read", ""),
        ]:
            permission = rbac_repository.get_permission_by_code(db, code)
            if permission is None:
                permission = rbac_repository.create_permission(db, code=code)
            # Least privilege per role: admin gets everything, moderators
            # get content/report powers, support gets read-only lookup.
            granted = (
                role_name == "admin"
                or (
                    role_name == "moderator"
                    and code
                    in {
                        "reports:read",
                        "reports:review",
                        "content:remove",
                        "users:read",
                        "users:suspend",
                    }
                )
                or (role_name == "support" and code == "users:read")
            )
            if granted:
                rbac_repository.grant_permission_to_role(
                    db, role_id=role.id, permission_id=permission.id
                )
    admin_role = rbac_repository.get_role_by_name(db, "admin")
    mod_role = rbac_repository.get_role_by_name(db, "moderator")
    assert admin_role and mod_role
    rbac_repository.grant_role(db, user_id=admin["id"], role_id=admin_role.id)
    rbac_repository.grant_role(db, user_id=mod["id"], role_id=mod_role.id)
    return {
        "admin": (admin, admin_h),
        "mod": (mod, mod_h),
        "admin_user": User,
    }


def _post_with_media(client, headers, fake_storage, caption="hello"):
    from app.application.interfaces.storage import VerifiedAsset

    intent = client.post(
        "/api/v1/media/upload-intents",
        json={"expected_mime": "image/jpeg", "expected_bytes": 100},
        headers=headers,
    ).json()
    fake_storage.add_fixture(
        VerifiedAsset(
            public_id=intent["public_id"], resource_type="image", version="1",
            secure_url="https://x/y.jpg", format="jpg", size_bytes=100,
            width=10, height=10, duration=None,
        )
    )
    asset = client.post(
        f"/api/v1/media/upload-intents/{intent['id']}/complete", headers=headers
    ).json()
    return client.post(
        "/api/v1/posts",
        json={"caption": caption, "items": [{"media_id": asset["id"]}]},
        headers=headers,
    ).json()


def test_report_lifecycle(
    client: TestClient, staff: dict, fake_storage
) -> None:
    alice, alice_h = _alice(client)
    post = _post_with_media(client, alice_h, fake_storage, "spammy #x")
    mod, mod_h = staff["mod"]
    _, admin_h = staff["admin"]

    # Ordinary users cannot touch the admin surface.
    assert client.get(f"{ADMIN}/reports", headers=alice_h).status_code == 403

    # File a report against a post.
    created = client.post(
        "/api/v1/reports",
        json={
            "target_type": "post",
            "target_id": post["id"],
            "category": "spam",
            "details": "looks like spam",
        },
        headers=mod_h,
    )
    assert created.status_code == 201, created.text
    report_id = created.json()["id"]
    assert created.json()["status"] == "pending"

    # Invalid target type / missing target rejected.
    assert (
        client.post(
            "/api/v1/reports",
            json={"target_type": "planet", "target_id": post["id"], "category": "spam"},
            headers=mod_h,
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/reports",
            json={"target_type": "post", "target_id": "00000000-0000-0000-0000-000000000000", "category": "spam"},
            headers=mod_h,
        ).status_code
        == 404
    )

    # Queue visible to staff with the permission; decide with reason.
    queue = client.get(f"{ADMIN}/reports", headers=mod_h).json()
    assert [r["id"] for r in queue["items"]] == [report_id]
    decided = client.post(
        f"{ADMIN}/reports/{report_id}/actions",
        json={"decision": "remove_content", "reason": "confirmed spam"},
        headers=mod_h,
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["status"] == "action_taken"

    # Deciding twice conflicts.
    assert (
        client.post(
            f"{ADMIN}/reports/{report_id}/actions",
            json={"decision": "dismiss", "reason": "x"},
            headers=mod_h,
        ).status_code
        == 409
    )

    # Removed content vanishes from the API.
    assert client.get(f"/api/v1/posts/{post['id']}", headers=mod_h).status_code == 404

    # Detail shows the audit trail.
    detail = client.get(f"{ADMIN}/reports/{report_id}", headers=mod_h).json()
    assert detail["actions"][0]["decision"] == "remove_content"

    # Audit log recorded everything privileged (needs audit:read).
    audit = client.get(
        f"{ADMIN}/audit-events", params={"action": "moderation.decide"}, headers=admin_h
    ).json()
    assert len(audit["items"]) >= 1
    assert client.get(f"{ADMIN}/audit-events", headers=mod_h).status_code == 403


def test_suspend_and_unsuspend_user(
    client: TestClient, staff: dict, fake_storage
) -> None:
    alice, alice_h = _alice(client)
    _, mod_h = staff["mod"]
    admin, admin_h = staff["admin"]

    suspended = client.patch(
        f"{ADMIN}/users/{alice['id']}/status",
        json={"status": "suspended", "reason": "spam wave"},
        headers=mod_h,
    )
    assert suspended.status_code == 200
    assert suspended.json()["account_status"] == "suspended"

    # Suspended users cannot log in; their sessions are dead.
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"identifier": "alice", "password": "supersecret1"},
        ).status_code
        in (401, 403)
    )
    assert client.get("/api/v1/auth/me", headers=alice_h).status_code in (401, 403)

    # Admin restores the account.
    restored = client.patch(
        f"{ADMIN}/users/{alice['id']}/status",
        json={"status": "active", "reason": "appeal granted"},
        headers=admin_h,
    )
    assert restored.json()["account_status"] == "active"

    # Cannot change your own status.
    assert (
        client.patch(
            f"{ADMIN}/users/{admin['id']}/status",
            json={"status": "suspended", "reason": "oops"},
            headers=admin_h,
        ).status_code
        == 403
    )


def test_staff_role_management_guards(
    client: TestClient, staff: dict
) -> None:
    alice, _ = _alice(client)
    _, admin_h = staff["admin"]
    _, mod_h = staff["mod"]

    # Moderators lack staff:manage.
    assert (
        client.post(
            f"{ADMIN}/users/{alice['id']}/roles", json={"role": "moderator"},
            headers=mod_h,
        ).status_code
        == 403
    )
    granted = client.post(
        f"{ADMIN}/users/{alice['id']}/roles", json={"role": "moderator"},
        headers=admin_h,
    )
    assert granted.status_code == 200
    assert "moderator" in granted.json()["roles"]

    # Admins cannot touch their own roles.
    admin_id = client.get("/api/v1/auth/me", headers=admin_h).json()["id"]
    assert (
        client.post(
            f"{ADMIN}/users/{admin_id}/roles", json={"role": "support"},
            headers=admin_h,
        ).status_code
        == 403
    )

    # The last admin cannot be demoted.
    assert (
        client.delete(f"{ADMIN}/users/{admin_id}/roles/admin", headers=admin_h).status_code
        in (403, 409)
    )


def test_user_search_and_report_permissions(
    client: TestClient, staff: dict
) -> None:
    alice, alice_h = _alice(client)
    _, mod_h = staff["mod"]

    found = client.get(f"{ADMIN}/users", params={"q": "alice"}, headers=mod_h).json()
    assert [u["username"] for u in found["items"]] == ["alice"]

    assert client.get(f"{ADMIN}/users", params={"q": "alice"}, headers=alice_h).status_code == 403
    assert client.get(f"{ADMIN}/audit-events", headers=alice_h).status_code == 403

    # Roles catalog requires staff:manage.
    assert client.get(f"{ADMIN}/roles", headers=mod_h).status_code == 403


def test_dashboard_stats_endpoint(
    client: TestClient, staff: dict
) -> None:
    alice, alice_h = _alice(client)
    _, admin_h = staff["admin"]
    _, mod_h = staff["mod"]

    assert client.get(f"{ADMIN}/stats", headers=alice_h).status_code == 403

    response = client.get(f"{ADMIN}/stats", params={"days": 7}, headers=mod_h)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["range_days"] == 7
    assert len(body["signups_series"]) == 7
    assert body["accounts"]["total"] >= 1
    assert body["staff"]["total"] >= 2
    assert isinstance(body["reports_by_category"], list)
    assert isinstance(body["posts_series"], list)


def test_user_detail_endpoint(
    client: TestClient, staff: dict
) -> None:
    alice, alice_h = _alice(client)
    _, admin_h = staff["admin"]
    _, mod_h = staff["mod"]

    assert (
        client.get(f"{ADMIN}/users/{alice['id']}", headers=alice_h).status_code
        == 403
    )

    response = client.get(f"{ADMIN}/users/{alice['id']}", headers=mod_h)
    assert response.status_code == 200, response.text
    detail = response.json()
    assert detail["username"] == "alice"
    assert detail["followers"] == 0
    assert detail["following"] == 0
    assert detail["posts"] == 0
    assert detail["recent_reports"] == []

    filed = client.post(
        "/api/v1/reports",
        headers=admin_h,
        json={
            "target_type": "user",
            "target_id": alice["id"],
            "category": "spam",
            "details": "spammy",
        },
    )
    assert filed.status_code == 201, filed.text

    refreshed = client.get(
        f"{ADMIN}/users/{alice['id']}", headers=mod_h
    ).json()
    assert len(refreshed["recent_reports"]) == 1
    assert refreshed["recent_reports"][0]["category"] == "spam"
    assert refreshed["recent_reports"][0]["status"] == "pending"


def test_staff_directory_requires_staff_manage(
    client: TestClient, staff: dict
) -> None:
    _, admin_h = staff["admin"]
    _, mod_h = staff["mod"]

    assert client.get(f"{ADMIN}/staff", headers=mod_h).status_code == 403

    directory = client.get(f"{ADMIN}/staff", headers=admin_h)
    assert directory.status_code == 200, directory.text
    members = directory.json()
    usernames = {member["username"] for member in members}
    assert {"admin1", "mod1"} <= usernames
    for member in members:
        assert member["roles"]
