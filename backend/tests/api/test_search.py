"""API tests for search and hashtag browsing."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.application.interfaces.storage import VerifiedAsset
from app.infrastructure.storage.fake import FakeStorageProvider
from app.main import app
from app.modules.media.dependencies import get_storage_provider
from tests.conftest import register_payload

SEARCH = "/api/v1/search"


def _register(client: TestClient, **overrides):
    response = client.post(
        "/api/v1/auth/register", json=register_payload(**overrides)
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


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
    )
    assert intent.status_code == 201, intent.text
    body = intent.json()
    fake_storage.add_fixture(
        VerifiedAsset(
            public_id=body["public_id"],
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
        f"/api/v1/media/upload-intents/{body['id']}/complete", headers=headers
    )
    assert done.status_code == 200, done.text
    return done.json()


def _post(client, headers, fake_storage, caption: str) -> dict:
    asset = _asset(client, headers, fake_storage)
    response = client.post(
        "/api/v1/posts",
        json={"caption": caption, "items": [{"media_id": asset["id"]}]},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_search_users(client: TestClient) -> None:
    alice, alice_h = _register(
        client, email="alice@example.com", username="alice_wonder",
        password="supersecret1", display_name="Alice Liddell",
    )
    bob, bob_h = _register(
        client, email="bob@example.com", username="bobby",
        password="supersecret1",
    )

    # Username, display name, and case-insensitive matching.
    assert [
        u["username"]
        for u in client.get(f"{SEARCH}/users", params={"q": "alice"}, headers=bob_h).json()["items"]
    ] == ["alice_wonder"]
    assert [
        u["username"]
        for u in client.get(f"{SEARCH}/users", params={"q": "LIDDELL"}, headers=bob_h).json()["items"]
    ] == ["alice_wonder"]
    assert [
        u["username"]
        for u in client.get(f"{SEARCH}/users", params={"q": "bob"}, headers=alice_h).json()["items"]
    ] == ["bobby"]

    # Blocked users disappear from user search.
    client.post(f"/api/v1/users/{bob['id']}/block", headers=alice_h)
    assert (
        client.get(f"{SEARCH}/users", params={"q": "bob"}, headers=alice_h).json()["items"]
        == []
    )


def test_search_users_pagination(client: TestClient) -> None:
    _, headers = _register(
        client, email="s@example.com", username="seeker",
        password="supersecret1",
    )
    for i in range(3):
        _register(
            client, email=f"fan{i}@example.com", username=f"fanclub{i}",
            password="supersecret1",
        )
    seen: list[str] = []
    cursor: str | None = None
    while True:
        params: dict[str, str] = {"q": "fanclub", "limit": "2"}
        if cursor:
            params["cursor"] = cursor
        page = client.get(f"{SEARCH}/users", params=params, headers=headers).json()
        seen.extend(u["username"] for u in page["items"])
        if not page["has_more"]:
            break
        cursor = page["next_cursor"]
    assert sorted(seen) == ["fanclub0", "fanclub1", "fanclub2"]


def test_search_posts_and_visibility(
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
    _post(client, alice_h, fake_storage, "Sunset over the harbor #memories")
    _post(client, bob_h, fake_storage, "Harbor lights at dusk")

    results = client.get(
        f"{SEARCH}/posts", params={"q": "harbor"}, headers=alice_h
    ).json()
    assert len(results["items"]) == 2

    # Anonymous sees public posts too.
    anon = client.get(f"{SEARCH}/posts", params={"q": "harbor"}).json()
    assert len(anon["items"]) == 2

    # Private author's post vanishes for strangers, appears for followers.
    client.patch("/api/v1/users/me/privacy", json={"is_private": True}, headers=bob_h)
    assert (
        client.get(f"{SEARCH}/posts", params={"q": "harbor"}, headers=alice_h).json()["items"]
        != []
    )
    assert all(
        p["author"]["username"] != "bob"
        for p in client.get(f"{SEARCH}/posts", params={"q": "harbor"}, headers=alice_h).json()["items"]
    )
    client.post(f"/api/v1/users/{bob['id']}/follow", headers=alice_h)
    incoming = client.get("/api/v1/follow-requests", headers=bob_h).json()
    client.post(f"/api/v1/follow-requests/{incoming[0]['id']}/approve", headers=bob_h)
    assert any(
        p["author"]["username"] == "bob"
        for p in client.get(f"{SEARCH}/posts", params={"q": "harbor"}, headers=alice_h).json()["items"]
    )

    # Blocking hides posts from search.
    client.post(f"/api/v1/users/{bob['id']}/block", headers=alice_h)
    assert all(
        p["author"]["username"] != "bob"
        for p in client.get(f"{SEARCH}/posts", params={"q": "harbor"}, headers=alice_h).json()["items"]
    )


def test_hashtag_search_and_tag_page(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    alice, alice_h = _register(
        client, email="alice@example.com", username="alice",
        password="supersecret1",
    )
    _, bob_h = _register(
        client, email="bob@example.com", username="bob",
        password="supersecret1",
    )
    _post(client, alice_h, fake_storage, "First #Memories ever")
    _post(client, alice_h, fake_storage, "More #memories here")
    _post(client, bob_h, fake_storage, "Bob #memories too")

    tags = client.get(
        f"{SEARCH}/hashtags", params={"q": "mem"}, headers=alice_h
    ).json()
    assert tags["items"][0]["tag"] == "memories"
    assert tags["items"][0]["usage_count"] == 3

    page = client.get("/api/v1/hashtags/memories/posts", headers=alice_h).json()
    assert len(page["items"]) == 3

    # `#tag` post search behaves like the tag page.
    via_search = client.get(
        f"{SEARCH}/posts", params={"q": "#memories"}, headers=alice_h
    ).json()
    assert len(via_search["items"]) == 3


def test_tag_page_hides_private(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    alice, alice_h = _register(
        client, email="alice@example.com", username="alice",
        password="supersecret1",
    )
    _, bob_h = _register(
        client, email="bob@example.com", username="bob",
        password="supersecret1",
    )
    _post(client, alice_h, fake_storage, "Public #sunset")
    _post(client, bob_h, fake_storage, "Private #sunset")
    client.patch("/api/v1/users/me/privacy", json={"is_private": True}, headers=bob_h)

    page = client.get(
        "/api/v1/hashtags/sunset/posts", headers=alice_h
    ).json()
    assert [p["author"]["username"] for p in page["items"]] == ["alice"]


def test_empty_query_rejected(client: TestClient) -> None:
    _, headers = _register(
        client, email="a@example.com", username="aaa",
        password="supersecret1",
    )
    assert client.get(f"{SEARCH}/posts", params={"q": ""}, headers=headers).status_code == 422
    assert client.get(f"{SEARCH}/users", params={"q": "   "}, headers=headers).status_code == 422
