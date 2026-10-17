"""Tests for the cold-start discovery fallback and suggestions."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.application.interfaces.storage import VerifiedAsset
from app.infrastructure.storage.fake import FakeStorageProvider
from app.main import app
from app.modules.media.dependencies import get_storage_provider
from tests.conftest import register_payload


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


@pytest.fixture()
def fake_storage(client: TestClient):
    storage = FakeStorageProvider()
    app.dependency_overrides[get_storage_provider] = lambda: storage
    yield storage


def _asset(client, headers, fake_storage) -> dict:
    intent = client.post(
        "/api/v1/media/upload-intents",
        json={"expected_mime": "image/jpeg", "expected_bytes": 100},
        headers=headers,
    ).json()
    fake_storage.add_fixture(
        VerifiedAsset(
            public_id=intent["public_id"],
            resource_type="image",
            version="1",
            secure_url="https://x/y.jpg",
            format="jpg",
            size_bytes=100,
            width=10,
            height=10,
            duration=None,
        )
    )
    done = client.post(
        f"/api/v1/media/upload-intents/{intent['id']}/complete",
        headers=headers,
    )
    assert done.status_code == 200, done.text
    return done.json()


def _post(client, headers, fake_storage, caption: str = "hi") -> dict:
    asset = _asset(client, headers, fake_storage)
    response = client.post(
        "/api/v1/posts",
        json={"caption": caption, "items": [{"media_id": asset["id"]}]},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_new_user_gets_discovery_fallback(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    alice, _ = _register(
        client, email="alice@example.com", username="alice",
        password="supersecret1",
    )
    bob, bob_h = _register(
        client, email="bob@example.com", username="bob",
        password="supersecret1",
    )
    post = _post(client, bob_h, fake_storage, "Popular post")

    feed = client.get("/api/v1/feed", headers=bob_h).json()
    # Bob's own post shows via the follows stream.
    assert feed["items"][0]["source"] == "following"

    carol, carol_h = _register(
        client, email="carol@example.com", username="carol",
        password="supersecret1",
    )
    blended = client.get("/api/v1/feed", headers=carol_h).json()
    assert [p["id"] for p in blended["items"]] == [post["id"]]
    assert blended["items"][0]["source"] == "discovery"
    assert blended["items"][0]["liked"] is False


def test_established_user_gets_no_fallback(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    viewer, viewer_h = _register(
        client, email="v@example.com", username="viewer",
        password="supersecret1",
    )
    _, bob_h = _register(
        client, email="bob@example.com", username="bob",
        password="supersecret1",
    )
    for i in range(5):
        u, _ = _register(
            client, email=f"f{i}@example.com", username=f"friend{i}",
            password="supersecret1",
        )
        client.post(f"/api/v1/users/{u['id']}/follow", headers=viewer_h)
    _post(client, bob_h, fake_storage, "Stranger post")

    feed = client.get("/api/v1/feed", headers=viewer_h).json()
    assert feed["items"] == []
    assert all(p["source"] == "following" for p in feed["items"])


def test_fallback_excludes_private_and_blocked(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    alice, alice_h = _register(
        client, email="alice@example.com", username="alice",
        password="supersecret1",
    )
    bob, bob_h = _register(
        client, email="bob@example.com", username="bob",
        password="supersecret1",
    )
    _post(client, bob_h, fake_storage, "Bob public post")
    client.patch("/api/v1/users/me/privacy", json={"is_private": True}, headers=bob_h)

    carol, carol_h = _register(
        client, email="carol@example.com", username="carol",
        password="supersecret1",
    )
    assert (
        client.get("/api/v1/feed", headers=carol_h).json()["items"] == []
    )
    # Blocked authors never surface either.
    client.patch("/api/v1/users/me/privacy", json={"is_private": False}, headers=bob_h)
    client.post(f"/api/v1/users/{bob['id']}/block", headers=carol_h)
    assert (
        client.get("/api/v1/feed", headers=carol_h).json()["items"] == []
    )
    _ = alice


def test_suggestions_exclude_circle(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    alice, alice_h = _register(
        client, email="alice@example.com", username="alice",
        password="supersecret1",
    )
    bob, _ = _register(
        client, email="bob@example.com", username="bob",
        password="supersecret1",
    )
    carol, carol_h = _register(
        client, email="carol@example.com", username="carol",
        password="supersecret1",
    )
    # Carol follows bob, making him the most-followed user.
    client.post(f"/api/v1/users/{bob['id']}/follow", headers=carol_h)

    suggested = client.get(
        "/api/v1/users/me/suggestions", headers=alice_h
    ).json()
    usernames = [s["user"]["username"] for s in suggested]
    assert usernames[0] == "bob"  # most-followed ranks first
    assert usernames[1] == "carol"  # zero followers still qualifies
    assert "alice" not in usernames  # never suggest self
    assert suggested[0]["follower_count"] == 1

    # Following / blocking removes people from suggestions.
    client.post(f"/api/v1/users/{bob['id']}/follow", headers=alice_h)
    remaining = [
        s["user"]["username"]
        for s in client.get(
            "/api/v1/users/me/suggestions", headers=alice_h
        ).json()
    ]
    assert remaining == ["carol"]
