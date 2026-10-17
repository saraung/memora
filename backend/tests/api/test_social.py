"""API tests for profiles, follows, requests, and blocks."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import register_payload

USERS = "/api/v1/users"


def _register(client: TestClient, **overrides):
    response = client.post(
        "/api/v1/auth/register", json=register_payload(**overrides)
    )
    assert response.status_code == 201, response.text
    body = response.json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    return body["user"], headers


def _alice(client: TestClient):
    return _register(
        client, email="alice@example.com", username="alice",
        password="supersecret1",
    )


def _bob(client: TestClient):
    return _register(
        client, email="bob@example.com", username="bob",
        password="supersecret1",
    )


def test_public_profile_visible_anonymously(client: TestClient) -> None:
    _alice(client)
    response = client.get(f"{USERS}/alice")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["username"] == "alice"
    assert body["relationship"] == "none"
    assert body["follower_count"] == 0


def test_self_relationship_and_counts(client: TestClient) -> None:
    alice, headers = _alice(client)
    response = client.get(f"{USERS}/alice", headers=headers)
    assert response.status_code == 200
    assert response.json()["relationship"] == "self"


def test_follow_public_account_direct(client: TestClient) -> None:
    alice, alice_h = _alice(client)
    bob, _ = _bob(client)

    response = client.post(f"{USERS}/{bob['id']}/follow", headers=alice_h)
    assert response.status_code == 200
    assert response.json()["status"] == "followed"

    # Idempotent repeat.
    again = client.post(f"{USERS}/{bob['id']}/follow", headers=alice_h)
    assert again.json()["status"] == "followed"

    profile = client.get(f"{USERS}/bob", headers=alice_h).json()
    assert profile["relationship"] == "following"
    assert profile["follower_count"] == 1

    followers = client.get(f"{USERS}/bob/followers", headers=alice_h).json()
    assert [u["username"] for u in followers["items"]] == ["alice"]
    assert followers["has_more"] is False


def test_self_follow_rejected(client: TestClient) -> None:
    alice, alice_h = _alice(client)
    response = client.post(f"{USERS}/{alice['id']}/follow", headers=alice_h)
    assert response.status_code == 422


def test_unfollow(client: TestClient) -> None:
    _, alice_h = _alice(client)
    bob, _ = _bob(client)
    client.post(f"{USERS}/{bob['id']}/follow", headers=alice_h)
    response = client.delete(f"{USERS}/{bob['id']}/follow", headers=alice_h)
    assert response.status_code == 200
    assert response.json()["status"] == "unfollowed"
    assert (
        client.get(f"{USERS}/bob", headers=alice_h).json()["relationship"]
        == "none"
    )


def test_private_account_request_flow(client: TestClient) -> None:
    _, alice_h = _alice(client)
    bob, bob_h = _bob(client)
    client.patch(f"{USERS}/me/privacy", json={"is_private": True}, headers=bob_h)

    # Hidden from anonymous and non-followers.
    assert client.get(f"{USERS}/bob").status_code == 404
    assert client.get(f"{USERS}/bob", headers=alice_h).status_code == 404

    response = client.post(f"{USERS}/{bob['id']}/follow", headers=alice_h)
    assert response.json()["status"] == "requested"

    incoming = client.get("/api/v1/follow-requests", headers=bob_h).json()
    assert len(incoming) == 1
    assert incoming[0]["requester"]["username"] == "alice"
    request_id = incoming[0]["id"]

    approved = client.post(
        f"/api/v1/follow-requests/{request_id}/approve", headers=bob_h
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    profile = client.get(f"{USERS}/bob", headers=alice_h).json()
    assert profile["relationship"] == "following"
    assert profile["follower_count"] == 1


def test_request_decision_rules(client: TestClient) -> None:
    _, alice_h = _alice(client)
    bob, bob_h = _bob(client)
    carol, carol_h = _register(
        client, email="carol@example.com", username="carol",
        password="supersecret1",
    )
    client.patch(f"{USERS}/me/privacy", json={"is_private": True}, headers=bob_h)
    client.post(f"{USERS}/{bob['id']}/follow", headers=alice_h)
    request_id = client.get("/api/v1/follow-requests", headers=bob_h).json()[0][
        "id"
    ]

    # Non-owner cannot decide.
    assert (
        client.post(
            f"/api/v1/follow-requests/{request_id}/approve", headers=carol_h
        ).status_code
        == 403
    )
    # Requester cannot approve their own request.
    assert (
        client.post(
            f"/api/v1/follow-requests/{request_id}/approve", headers=alice_h
        ).status_code
        == 403
    )
    # Reject works; deciding twice conflicts.
    assert (
        client.post(
            f"/api/v1/follow-requests/{request_id}/reject", headers=bob_h
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/follow-requests/{request_id}/approve", headers=bob_h
        ).status_code
        == 409
    )

    # New request can be canceled by the requester, not by others.
    client.post(f"{USERS}/{bob['id']}/follow", headers=alice_h)
    new_id = client.get("/api/v1/follow-requests", headers=bob_h).json()[0][
        "id"
    ]
    assert (
        client.delete(f"/api/v1/follow-requests/{new_id}", headers=carol_h).status_code
        == 403
    )
    canceled = client.delete(
        f"/api/v1/follow-requests/{new_id}", headers=alice_h
    )
    assert canceled.status_code == 200
    assert canceled.json()["status"] == "canceled"
    # Private again and no longer requested: hidden, not "none".
    assert client.get(f"{USERS}/bob", headers=alice_h).status_code == 404


def test_block_is_strict_both_directions(client: TestClient) -> None:
    alice, alice_h = _alice(client)
    bob, bob_h = _bob(client)
    client.post(f"{USERS}/{bob['id']}/follow", headers=alice_h)
    client.post(f"{USERS}/{alice['id']}/follow", headers=bob_h)

    response = client.post(f"{USERS}/{bob['id']}/block", headers=alice_h)
    assert response.status_code == 200
    assert response.json()["status"] == "blocked"

    # Both profiles hidden from each other (404, not 403).
    assert client.get(f"{USERS}/bob", headers=alice_h).status_code == 404
    assert client.get(f"{USERS}/alice", headers=bob_h).status_code == 404

    # Follows torn down both ways.
    assert (
        client.get(f"{USERS}/alice", headers=alice_h).json()["following_count"]
        == 0
    )

    # Blocked list shows the block; unblock restores visibility.
    blocked = client.get(f"{USERS}/me/blocked", headers=alice_h).json()
    assert [u["username"] for u in blocked] == ["bob"]
    assert (
        client.delete(f"{USERS}/{bob['id']}/block", headers=alice_h).json()[
            "status"
        ]
        == "unblocked"
    )
    assert client.get(f"{USERS}/bob", headers=alice_h).status_code == 200


def test_block_self_rejected(client: TestClient) -> None:
    alice, alice_h = _alice(client)
    assert (
        client.post(f"{USERS}/{alice['id']}/block", headers=alice_h).status_code
        == 422
    )


def test_block_removes_pending_requests(client: TestClient) -> None:
    _, alice_h = _alice(client)
    bob, bob_h = _bob(client)
    client.patch(f"{USERS}/me/privacy", json={"is_private": True}, headers=bob_h)
    client.post(f"{USERS}/{bob['id']}/follow", headers=alice_h)
    assert len(client.get("/api/v1/follow-requests", headers=bob_h).json()) == 1

    client.post(f"{USERS}/{bob['id']}/block", headers=alice_h)
    assert client.get("/api/v1/follow-requests", headers=bob_h).json() == []
    # Blocked: follow attempts hide existence.
    assert (
        client.post(f"{USERS}/{bob['id']}/follow", headers=alice_h).status_code
        == 404
    )


def test_update_profile_and_privacy(client: TestClient) -> None:
    _, alice_h = _alice(client)
    response = client.patch(
        f"{USERS}/me",
        json={
            "display_name": "Alice A",
            "bio": "Hello world",
            "avatar_url": "https://example.com/a.png",
            "links": ["https://example.com"],
        },
        headers=alice_h,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["display_name"] == "Alice A"
    assert body["bio"] == "Hello world"

    bad_avatar = client.patch(
        f"{USERS}/me", json={"avatar_url": "not-a-url"}, headers=alice_h
    )
    assert bad_avatar.status_code == 422

    too_many = client.patch(
        f"{USERS}/me",
        json={"links": [f"https://e.com/{i}" for i in range(5)]},
        headers=alice_h,
    )
    assert too_many.status_code == 422

    private = client.patch(
        f"{USERS}/me/privacy", json={"is_private": True}, headers=alice_h
    )
    assert private.json()["is_private"] is True


def test_followers_pagination(client: TestClient) -> None:
    _, bob_h = _bob(client)
    for i in range(4):
        _, headers = _register(
            client,
            email=f"fan{i}@example.com",
            username=f"fan{i}",
            password="supersecret1",
        )
        bob = client.get(f"{USERS}/bob", headers=headers).json()
        client.post(f"{USERS}/{bob['id']}/follow", headers=headers)

    seen: list[str] = []
    cursor: str | None = None
    pages = 0
    while True:
        params: dict[str, str] = {"limit": "2"}
        if cursor:
            params["cursor"] = cursor
        page = client.get(
            f"{USERS}/bob/followers", params=params, headers=bob_h
        ).json()
        seen.extend(u["username"] for u in page["items"])
        pages += 1
        if not page["has_more"]:
            assert page["next_cursor"] is None
            break
        cursor = page["next_cursor"]
        assert pages < 10  # guard against infinite loops

    assert sorted(seen) == ["fan0", "fan1", "fan2", "fan3"]

    bad = client.get(
        f"{USERS}/bob/followers", params={"cursor": "!!!"},
        headers=bob_h,
    )
    assert bad.status_code == 422


def test_private_lists_hidden_from_strangers(client: TestClient) -> None:
    _, alice_h = _alice(client)
    _, bob_h = _bob(client)
    client.patch(f"{USERS}/me/privacy", json={"is_private": True}, headers=bob_h)
    assert (
        client.get(f"{USERS}/bob/followers", headers=alice_h).status_code == 404
    )
    assert (
        client.get(f"{USERS}/bob/following", headers=alice_h).status_code == 404
    )
