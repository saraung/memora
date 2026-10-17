"""API + WebSocket tests for messaging and notifications."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.application.interfaces.storage import VerifiedAsset
from app.infrastructure.storage.fake import FakeStorageProvider
from app.main import app
from app.modules.media.dependencies import get_storage_provider
from tests.conftest import register_payload

CONV = "/api/v1/conversations"
NOTIF = "/api/v1/notifications"


def _register(client: TestClient, **overrides):
    response = client.post(
        "/api/v1/auth/register", json=register_payload(**overrides)
    )
    assert response.status_code == 201, response.text
    body = response.json()
    token = body["access_token"]
    return (
        body["user"],
        {"Authorization": f"Bearer {token}"},
        token,
    )


def _alice(client: TestClient):
    user, headers, token = _register(
        client, email="alice@example.com", username="alice",
        password="supersecret1",
    )
    return user, headers, token


def _bob(client: TestClient):
    user, headers, token = _register(
        client, email="bob@example.com", username="bob",
        password="supersecret1",
    )
    return user, headers, token


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _start_dm(
    client: TestClient, headers: dict, participant_id: str, body: str = "Hey"
):
    response = client.post(
        f"{CONV}/direct",
        json={"participant_id": participant_id, "body": body},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_dm_lifecycle(client: TestClient) -> None:
    alice, alice_h, _ = _alice(client)
    bob, bob_h, _ = _bob(client)

    # No thread exists for either user before the first message.
    assert client.get(CONV, headers=alice_h).json()["items"] == []
    assert client.get(CONV, headers=bob_h).json()["items"] == []

    created = _start_dm(client, alice_h, bob["id"], "Hey Bob")
    conv_id = created["conversation"]["id"]
    assert created["message"]["message"]["body"] == "Hey Bob"

    # Starting again reuses the thread and appends.
    again = _start_dm(client, alice_h, bob["id"], "Second")
    assert again["conversation"]["id"] == conv_id

    # Bob sees them with an unread badge; alice sees zero.
    bob_list = client.get(CONV, headers=bob_h).json()
    assert bob_list["items"][0]["unread_count"] == 2
    assert bob_list["items"][0]["last_message"]["body"] == "Second"
    alice_list = client.get(CONV, headers=alice_h).json()
    assert alice_list["items"][0]["unread_count"] == 0

    history = client.get(
        f"{CONV}/{conv_id}/messages", headers=bob_h
    ).json()
    assert len(history["items"]) == 2

    marked = client.post(
        f"{CONV}/{conv_id}/read", json={}, headers=bob_h
    ).json()
    assert marked["marked"] == 2
    assert (
        client.get(CONV, headers=bob_h).json()["items"][0]["unread_count"]
        == 0
    )

    # Edit + delete by sender; other's edit rejected.
    msg_id = created["message"]["message"]["id"]
    assert (
        client.patch(
            f"/api/v1/messages/{msg_id}", json={"body": "Hey Bob!"}, headers=bob_h
        ).status_code
        == 403
    )
    edited = client.patch(
        f"/api/v1/messages/{msg_id}", json={"body": "Hey Bob!"}, headers=alice_h
    ).json()
    assert edited["message"]["body"] == "Hey Bob!"
    assert edited["message"]["is_edited"] is True
    assert (
        client.delete(f"/api/v1/messages/{msg_id}", headers=alice_h).status_code
        == 204
    )
    tombstones = [
        item for item in client.get(
            f"{CONV}/{conv_id}/messages", headers=bob_h
        ).json()["items"]
        if item["message"]["id"] == msg_id
    ]
    assert len(tombstones) == 1
    assert tombstones[0]["message"]["is_deleted"] is True
    assert tombstones[0]["message"]["body"] is None


def test_dm_access_rules(client: TestClient) -> None:
    alice, alice_h, _ = _alice(client)
    bob, bob_h, _ = _bob(client)
    carol, carol_h, _ = _register(
        client, email="carol@example.com", username="carol",
        password="supersecret1",
    )
    conv_id = _start_dm(client, alice_h, bob["id"], "Hey")["conversation"]["id"]

    # The bare creator is gone: no thread without a message.
    assert (
        client.post(
            CONV, json={"participant_id": bob["id"]}, headers=carol_h
        ).status_code
        in (404, 405)
    )

    # Strangers get 404 (never 403 — IDs are not authorization).
    assert (
        client.get(f"{CONV}/{conv_id}/messages", headers=carol_h).status_code
        == 404
    )
    assert (
        client.post(
            f"{CONV}/{conv_id}/messages", json={"body": "hi"}, headers=carol_h
        ).status_code
        == 404
    )

    # No self-DMs, including via the atomic start.
    assert (
        client.post(
            f"{CONV}/direct",
            json={"participant_id": alice["id"], "body": "hi"},
            headers=alice_h,
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{CONV}/direct", json={"participant_id": bob["id"], "body": ""},
            headers=alice_h,
        ).status_code
        == 422
    )

    # Blocked users cannot open threads or send.
    client.post(f"/api/v1/users/{bob['id']}/block", headers=alice_h)
    assert (
        client.post(
            f"{CONV}/direct",
            json={"participant_id": bob["id"], "body": "hi"},
            headers=alice_h,
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"{CONV}/{conv_id}/messages",
            json={"body": "still here?"},
            headers=bob_h,
        ).status_code
        == 403
    )


def test_notifications_flow(client: TestClient) -> None:
    alice, alice_h, _ = _alice(client)
    bob, bob_h, _ = _bob(client)

    assert (
        client.get(f"{NOTIF}/unread-count", headers=alice_h).json()[
            "unread_count"
        ]
        == 0
    )

    # Follow notifies the target.
    client.post(f"/api/v1/users/{alice['id']}/follow", headers=bob_h)
    first = client.get(NOTIF, headers=alice_h).json()
    assert len(first["items"]) == 1
    assert first["items"][0]["type"] == "follow"
    assert first["items"][0]["actor"]["username"] == "bob"
    assert (
        client.get(f"{NOTIF}/unread-count", headers=alice_h).json()[
            "unread_count"
        ]
        == 1
    )

    # Like + comment notify the post author; mentions notify the mentioned.
    asset_post = _post_with_media(client, alice_h)
    client.put(f"/api/v1/posts/{asset_post['id']}/like", headers=bob_h)
    client.post(
        f"/api/v1/posts/{asset_post['id']}/comments",
        json={"body": "nice post"},
        headers=bob_h,
    )
    types = {
        item["type"]
        for item in client.get(NOTIF, headers=alice_h).json()["items"]
    }
    assert {"follow", "like", "comment"} <= types
    client.post(
        f"/api/v1/posts/{asset_post['id']}/comments",
        json={"body": "thanks @bob"},
        headers=alice_h,
    )
    bob_types = {
        item["type"]
        for item in client.get(NOTIF, headers=bob_h).json()["items"]
    }
    assert "mention" in bob_types

    # Mark one read, then read-all.
    latest_id = client.get(NOTIF, headers=alice_h).json()["items"][0]["id"]
    assert (
        client.post(f"{NOTIF}/{latest_id}/read", headers=alice_h).json()[
            "is_read"
        ]
        is True
    )
    marked = client.post(f"{NOTIF}/read-all", headers=alice_h).json()
    assert marked["marked"] >= 1
    assert (
        client.get(f"{NOTIF}/unread-count", headers=alice_h).json()[
            "unread_count"
        ]
        == 0
    )

    # Cannot read someone else's notification.
    assert (
        client.post(f"{NOTIF}/{latest_id}/read", headers=bob_h).status_code
        == 403
    )


def _post_with_media(client: TestClient, headers: dict) -> dict:
    storage = FakeStorageProvider()
    app.dependency_overrides[get_storage_provider] = lambda: storage
    try:
        intent = client.post(
            "/api/v1/media/upload-intents",
            json={"expected_mime": "image/jpeg", "expected_bytes": 100},
            headers=headers,
        ).json()
        storage.add_fixture(
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
        asset = client.post(
            f"/api/v1/media/upload-intents/{intent['id']}/complete",
            headers=headers,
        ).json()
        return client.post(
            "/api/v1/posts",
            json={"items": [{"media_id": asset["id"]}]},
            headers=headers,
        ).json()
    finally:
        del app.dependency_overrides[get_storage_provider]


def test_message_notifies_recipient(client: TestClient) -> None:
    alice, alice_h, _ = _alice(client)
    bob, bob_h, _ = _bob(client)
    conv_id = _start_dm(client, alice_h, bob["id"], "hi")["conversation"]["id"]
    items = client.get(NOTIF, headers=bob_h).json()["items"]
    assert [n for n in items if n["type"] == "message"]


def test_repeated_messages_coalesce(client: TestClient) -> None:
    """Several messages in one thread produce a single unread notification."""
    alice, alice_h, _ = _alice(client)
    bob, bob_h, _ = _bob(client)
    _start_dm(client, alice_h, bob["id"], "one")
    _start_dm(client, alice_h, bob["id"], "two")
    _start_dm(client, alice_h, bob["id"], "three")

    items = client.get(NOTIF, headers=bob_h).json()["items"]
    messages = [n for n in items if n["type"] == "message"]
    assert len(messages) == 1
    assert (
        client.get(f"{NOTIF}/unread-count", headers=bob_h).json()[
            "unread_count"
        ]
        == 1
    )

    # Reading it lets the next message create a fresh unread entry.
    read = client.post(
        f"{NOTIF}/{messages[0]['id']}/read", headers=bob_h
    )
    assert read.status_code == 200
    _start_dm(client, alice_h, bob["id"], "four")
    items = client.get(NOTIF, headers=bob_h).json()["items"]
    assert len([n for n in items if n["type"] == "message"]) == 2


def test_websocket_flow(client: TestClient) -> None:
    alice, alice_h, alice_token = _alice(client)
    bob, bob_h, bob_token = _bob(client)
    conv_id = _start_dm(client, alice_h, bob["id"], "hey")["conversation"]["id"]

    with client.websocket_connect(f"/api/v1/ws?ticket={alice_token}") as alice_ws:
        alice_ws.send_json({"action": "ping"})
        assert alice_ws.receive_json()["type"] == "pong"

        alice_ws.send_json(
            {"action": "subscribe", "conversation_id": conv_id}
        )
        sub = alice_ws.receive_json()
        assert sub == {"type": "subscribed", "conversation_id": conv_id}

        # Another user's thread is out of reach.
        carol, _, carol_token = _register(
            client, email="carol2@example.com", username="carol2",
            password="supersecret1",
        )
        other = _start_dm(client, _headers(bob_token), carol["id"], "hey")[
            "conversation"
        ]["id"]
        alice_ws.send_json(
            {"action": "subscribe", "conversation_id": other}
        )
        assert alice_ws.receive_json()["code"] == "FORBIDDEN"

        # A message sent over HTTP is pushed to the subscriber.
        client.post(
            f"{CONV}/{conv_id}/messages",
            json={"body": "realtime hi"},
            headers=bob_h,
        )
        pushed = alice_ws.receive_json()
        assert pushed["type"] == "message"
        assert pushed["message"]["body"] == "realtime hi"


def test_websocket_rejects_bad_ticket(client: TestClient) -> None:
    with client.websocket_connect("/api/v1/ws?ticket=nope") as ws:
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_delete_conversation_hides_for_leaver_only(
    client: TestClient,
) -> None:
    alice, alice_h, _ = _alice(client)
    bob, bob_h, _ = _bob(client)
    conv_id = _start_dm(client, alice_h, bob["id"], "hey")["conversation"]["id"]

    # Delete hides only the leaver's copy; re-deleting 404s because
    # the leaver is now a stranger to the thread (no existence leak).
    assert (
        client.delete(f"{CONV}/{conv_id}", headers=alice_h).status_code == 204
    )
    assert (
        client.delete(f"{CONV}/{conv_id}", headers=alice_h).status_code == 404
    )
    assert client.get(CONV, headers=alice_h).json()["items"] == []
    assert len(client.get(CONV, headers=bob_h).json()["items"]) == 1

    # The leaver can no longer read, mark, or send in it.
    assert (
        client.get(f"{CONV}/{conv_id}/messages", headers=alice_h).status_code
        == 404
    )
    assert (
        client.post(f"{CONV}/{conv_id}/read", json={}, headers=alice_h).status_code
        == 404
    )

    # A stranger cannot delete someone else's thread.
    carol, carol_h, _ = _register(
        client, email="carol3@example.com", username="carol3",
        password="supersecret1",
    )
    assert (
        client.delete(f"{CONV}/{conv_id}", headers=carol_h).status_code == 404
    )

    # A new message reopens the thread for both, history intact.
    client.post(
        f"{CONV}/{conv_id}/messages", json={"body": "you there?"}, headers=bob_h
    )
    alice_list = client.get(CONV, headers=alice_h).json()["items"]
    assert len(alice_list) == 1
    history = client.get(f"{CONV}/{conv_id}/messages", headers=alice_h).json()
    assert len(history["items"]) == 2


def _image_asset(client: TestClient, headers: dict, fake, mime: str = "image/jpeg"):
    intent = client.post(
        "/api/v1/media/upload-intents",
        json={"expected_mime": mime, "expected_bytes": 100},
        headers=headers,
    )
    assert intent.status_code == 201, intent.text
    body = intent.json()
    fake.add_fixture(
        VerifiedAsset(
            public_id=body["public_id"],
            resource_type="video" if mime.startswith("video/") else "image",
            version="1",
            secure_url="https://x/y",
            format=mime.split("/")[1],
            size_bytes=100,
            width=10,
            height=10,
            duration=5.0 if mime.startswith("video/") else None,
        )
    )
    done = client.post(
        f"/api/v1/media/upload-intents/{body['id']}/complete", headers=headers
    )
    assert done.status_code == 200, done.text
    return done.json()


def test_image_attachments(client: TestClient, fake_storage) -> None:
    alice, alice_h, _ = _alice(client)
    bob, bob_h, _ = _bob(client)
    asset = _image_asset(client, alice_h, fake_storage)

    # Image with caption via the atomic start.
    first = client.post(
        f"{CONV}/direct",
        json={"participant_id": bob["id"], "body": "look!", "media_ids": [asset["id"]]},
        headers=alice_h,
    )
    assert first.status_code == 201, first.text
    assert len(first.json()["message"]["media"]) == 1
    assert first.json()["message"]["media"][0]["secure_url"] == "https://x/y"

    # Image-only follow-up in the existing thread.
    asset2 = _image_asset(client, alice_h, fake_storage)
    conv_id = first.json()["conversation"]["id"]
    second = client.post(
        f"{CONV}/{conv_id}/messages",
        json={"body": "", "media_ids": [asset2["id"]]},
        headers=alice_h,
    )
    assert second.status_code == 201, second.text

    # History carries attachments for the participant.
    history = client.get(f"{CONV}/{conv_id}/messages", headers=bob_h).json()
    with_media = [m for m in history["items"] if m["media"]]
    assert len(with_media) == 2

    # Empty text AND no media is rejected.
    assert (
        client.post(
            f"{CONV}/{conv_id}/messages", json={"body": "  "}, headers=alice_h
        ).status_code
        == 422
    )


def test_attachment_rejections(client: TestClient, fake_storage) -> None:
    alice, alice_h, _ = _alice(client)
    bob, bob_h, _ = _bob(client)
    own = _image_asset(client, alice_h, fake_storage)
    theirs = _image_asset(client, bob_h, fake_storage)
    video = _image_asset(client, alice_h, fake_storage, mime="video/mp4")

    # Someone else's asset.
    assert (
        client.post(
            f"{CONV}/direct",
            json={"participant_id": bob["id"], "body": "", "media_ids": [theirs["id"]]},
            headers=alice_h,
        ).status_code
        == 403
    )
    # Video assets rejected for chat (images only in this phase).
    conv = _start_dm(client, alice_h, bob["id"], "hey")["conversation"]["id"]
    assert (
        client.post(
            f"{CONV}/{conv}/messages",
            json={"media_ids": [video["id"]]},
            headers=alice_h,
        ).status_code
        == 422
    )
    # Nonexistent asset.
    assert (
        client.post(
            f"{CONV}/{conv}/messages",
            json={"media_ids": ["00000000-0000-0000-0000-000000000000"]},
            headers=alice_h,
        ).status_code
        == 422
    )
    # Too many attachments.
    assert (
        client.post(
            f"{CONV}/direct",
            json={"participant_id": bob["id"], "media_ids": [own["id"]] * 6},
            headers=alice_h,
        ).status_code
        == 422
    )
