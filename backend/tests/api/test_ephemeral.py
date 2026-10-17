"""API tests for stories and reels."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.application.interfaces.storage import VerifiedAsset
from app.infrastructure.database.models.content import Story
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


def _asset_fixture(public_id: str, *, video: bool = False) -> VerifiedAsset:
    if video:
        return VerifiedAsset(
            public_id=public_id,
            resource_type="video",
            version="1",
            secure_url=f"https://res.cloudinary.com/dummy/video/upload/{public_id}.mp4",
            format="mp4",
            size_bytes=2048,
            width=720,
            height=1280,
            duration=10.0,
        )
    return VerifiedAsset(
        public_id=public_id,
        resource_type="image",
        version="1",
        secure_url=f"https://res.cloudinary.com/dummy/image/upload/{public_id}.jpg",
        format="jpg",
        size_bytes=1024,
        width=800,
        height=600,
        duration=None,
    )


def _upload(
    client: TestClient, headers, fake_storage: FakeStorageProvider,
    *, mime: str = "image/jpeg",
) -> dict:
    intent = client.post(
        "/api/v1/media/upload-intents",
        json={"expected_mime": mime, "expected_bytes": 1024},
        headers=headers,
    )
    assert intent.status_code == 201, intent.text
    body = intent.json()
    fake_storage.add_fixture(
        _asset_fixture(body["public_id"], video=mime.startswith("video/"))
    )
    done = client.post(
        f"/api/v1/media/upload-intents/{body['id']}/complete",
        headers=headers,
    )
    assert done.status_code == 200, done.text
    return done.json()


def _publish_story(client, headers, fake_storage, **overrides) -> dict:
    asset = _upload(client, headers, fake_storage)
    payload = {"media_id": asset["id"], "caption": "Day one"}
    payload.update(overrides)
    response = client.post("/api/v1/stories", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _publish_reel(client, headers, fake_storage, **overrides) -> dict:
    video = _upload(client, headers, fake_storage, mime="video/mp4")
    payload = {"video_id": video["id"], "caption": "My reel"}
    payload.update(overrides)
    response = client.post("/api/v1/reels", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_story_lifecycle(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    alice, alice_h = _alice(client)
    _, bob_h = _bob(client)
    client.post(f"/api/v1/users/{alice['id']}/follow", headers=bob_h)

    story = _publish_story(client, alice_h, fake_storage)
    assert story["viewed"] is False
    assert story["media"]["secure_url"]

    # Bob's feed groups alice's stories with unseen flag.
    feed = client.get("/api/v1/stories/feed", headers=bob_h).json()
    assert len(feed["items"]) == 1
    assert feed["items"][0]["author"]["username"] == "alice"
    assert feed["items"][0]["has_unseen"] is True

    # View records once; owner sees viewers.
    assert (
        client.post(f"/api/v1/stories/{story['id']}/views", headers=bob_h).json()[
            "viewed"
        ]
        is True
    )
    assert (
        client.post(f"/api/v1/stories/{story['id']}/views", headers=bob_h).status_code
        == 200
    )
    viewers = client.get(
        f"/api/v1/stories/{story['id']}/viewers", headers=alice_h
    ).json()
    assert [v["username"] for v in viewers] == ["bob"]

    # Non-owner cannot see viewers.
    assert (
        client.get(f"/api/v1/stories/{story['id']}/viewers", headers=bob_h).status_code
        == 403
    )

    # Owner deletes.
    assert (
        client.delete(f"/api/v1/stories/{story['id']}", headers=alice_h).status_code
        == 204
    )
    assert client.get(f"/api/v1/stories/{story['id']}", headers=bob_h).status_code == 404


def test_story_expiry_is_hard_cutoff(
    client: TestClient, fake_storage: FakeStorageProvider, db: Session
) -> None:
    alice, alice_h = _alice(client)
    _, bob_h = _bob(client)
    client.post(f"/api/v1/users/{alice['id']}/follow", headers=bob_h)
    story = _publish_story(client, alice_h, fake_storage)

    # Force expiry without running any cleanup job.
    record = db.get(Story, story["id"])
    assert record is not None
    record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.add(record)
    db.commit()

    assert client.get(f"/api/v1/stories/{story['id']}", headers=bob_h).status_code == 404
    assert client.get(f"/api/v1/stories/{story['id']}", headers=alice_h).status_code == 404
    assert client.get("/api/v1/stories/feed", headers=bob_h).json()["items"] == []
    assert (
        client.get(f"/api/v1/stories/{story['id']}/viewers", headers=alice_h).status_code
        == 404
    )
    assert (
        client.post(f"/api/v1/stories/{story['id']}/views", headers=bob_h).status_code
        == 404
    )


def test_story_private_author_hidden(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    alice, alice_h = _alice(client)
    bob, bob_h = _bob(client)
    story = _publish_story(client, bob_h, fake_storage)
    client.patch("/api/v1/users/me/privacy", json={"is_private": True}, headers=bob_h)

    assert client.get(f"/api/v1/stories/{story['id']}", headers=alice_h).status_code == 404
    client.post(f"/api/v1/users/{bob['id']}/follow", headers=alice_h)
    incoming = client.get("/api/v1/follow-requests", headers=bob_h).json()
    client.post(f"/api/v1/follow-requests/{incoming[0]['id']}/approve", headers=bob_h)
    assert client.get(f"/api/v1/stories/{story['id']}", headers=alice_h).status_code == 200


def test_story_video_length_limit(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    _, headers = _alice(client)
    intent = client.post(
        "/api/v1/media/upload-intents",
        json={"expected_mime": "video/mp4", "expected_bytes": 1024},
        headers=headers,
    ).json()
    asset = _asset_fixture(intent["public_id"], video=True)
    asset = VerifiedAsset(
        public_id=asset.public_id,
        resource_type=asset.resource_type,
        version=asset.version,
        secure_url=asset.secure_url,
        format=asset.format,
        size_bytes=asset.size_bytes,
        width=asset.width,
        height=asset.height,
        duration=120.0,
    )
    fake_storage.add_fixture(asset)
    done = client.post(
        f"/api/v1/media/upload-intents/{intent['id']}/complete", headers=headers
    )
    assert done.status_code == 200
    response = client.post(
        "/api/v1/stories", json={"media_id": done.json()["id"]}, headers=headers
    )
    assert response.status_code == 422


def test_reel_lifecycle(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    _, alice_h = _alice(client)
    _, bob_h = _bob(client)

    reel = _publish_reel(client, alice_h, fake_storage)
    assert reel["view_count"] == 0
    assert reel["liked"] is False

    # First qualified view counts; repeat within 24h does not.
    first = client.post(f"/api/v1/reels/{reel['id']}/views", headers=bob_h).json()
    assert first["counted"] is True and first["view_count"] == 1
    second = client.post(f"/api/v1/reels/{reel['id']}/views", headers=bob_h).json()
    assert second["counted"] is False and second["view_count"] == 1

    # Likes are idempotent; authors may like their own reel.
    assert client.put(f"/api/v1/reels/{reel['id']}/like", headers=bob_h).json()["status"] == "liked"
    assert client.put(f"/api/v1/reels/{reel['id']}/like", headers=bob_h).json()["status"] == "liked"
    assert client.put(f"/api/v1/reels/{reel['id']}/like", headers=alice_h).json()["status"] == "liked"
    assert client.put(f"/api/v1/reels/{reel['id']}/like", headers=alice_h).json()["status"] == "liked"
    assert client.get(f"/api/v1/reels/{reel['id']}", headers=bob_h).json()["like_count"] == 2

    # Feed shows it; delete removes it.
    assert len(client.get("/api/v1/reels/feed", headers=bob_h).json()["items"]) == 1
    assert client.delete(f"/api/v1/reels/{reel['id']}", headers=alice_h).status_code == 204
    assert client.get(f"/api/v1/reels/{reel['id']}", headers=bob_h).status_code == 404


def test_reel_visibility(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    alice, alice_h = _alice(client)
    bob, bob_h = _bob(client)
    reel = _publish_reel(client, bob_h, fake_storage)
    client.patch("/api/v1/users/me/privacy", json={"is_private": True}, headers=bob_h)

    assert client.get(f"/api/v1/reels/{reel['id']}", headers=alice_h).status_code == 404
    assert client.get("/api/v1/reels/feed", headers=alice_h).json()["items"] == []

    client.post(f"/api/v1/users/{alice['id']}/block", headers=bob_h)
    client.patch("/api/v1/users/me/privacy", json={"is_private": False}, headers=bob_h)
    assert client.get(f"/api/v1/reels/{reel['id']}", headers=alice_h).status_code == 404


def test_user_stories_stranger_sees_public(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    _, alice_h = _alice(client)
    bob, bob_h = _bob(client)
    story = _publish_story(client, bob_h, fake_storage)

    # Stranger (and anonymous) sees a public account's stories.
    page = client.get("/api/v1/users/bob/stories", headers=alice_h).json()
    assert [s["id"] for s in page["items"]] == [story["id"]]
    anon = client.get("/api/v1/users/bob/stories")
    assert [s["id"] for s in anon.json()["items"]] == [story["id"]]

    # Private account hides them from strangers, shows followers.
    client.patch("/api/v1/users/me/privacy", json={"is_private": True}, headers=bob_h)
    assert client.get("/api/v1/users/bob/stories", headers=alice_h).status_code == 404
    assert client.get("/api/v1/users/bob/stories").status_code == 404
    client.post(f"/api/v1/users/{bob['id']}/follow", headers=alice_h)
    incoming = client.get("/api/v1/follow-requests", headers=bob_h).json()
    client.post(f"/api/v1/follow-requests/{incoming[0]['id']}/approve", headers=bob_h)
    assert [s["id"] for s in client.get("/api/v1/users/bob/stories", headers=alice_h).json()["items"]] == [story["id"]]

    # Blocked either way hides them.
    client.post(f"/api/v1/users/{bob['id']}/block", headers=alice_h)
    assert client.get("/api/v1/users/bob/stories", headers=alice_h).status_code == 404
    assert client.get("/api/v1/users/alice/stories", headers=bob_h).status_code == 404


def test_user_reels_stranger_sees_public(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    _, alice_h = _alice(client)
    bob, bob_h = _bob(client)
    reel = _publish_reel(client, bob_h, fake_storage)

    # Stranger (and anonymous) sees a public account's reels.
    page = client.get("/api/v1/users/bob/reels", headers=alice_h).json()
    assert [r["id"] for r in page["items"]] == [reel["id"]]
    anon = client.get("/api/v1/users/bob/reels")
    assert [r["id"] for r in anon.json()["items"]] == [reel["id"]]

    # Private account hides them from strangers, shows followers.
    client.patch("/api/v1/users/me/privacy", json={"is_private": True}, headers=bob_h)
    assert client.get("/api/v1/users/bob/reels", headers=alice_h).status_code == 404
    assert client.get("/api/v1/users/bob/reels").status_code == 404
    client.post(f"/api/v1/users/{bob['id']}/follow", headers=alice_h)
    incoming = client.get("/api/v1/follow-requests", headers=bob_h).json()
    client.post(f"/api/v1/follow-requests/{incoming[0]['id']}/approve", headers=bob_h)
    assert [
        r["id"]
        for r in client.get("/api/v1/users/bob/reels", headers=alice_h).json()["items"]
    ] == [reel["id"]]

    # Blocked either way hides them.
    client.post(f"/api/v1/users/{bob['id']}/block", headers=alice_h)
    assert client.get("/api/v1/users/bob/reels", headers=alice_h).status_code == 404


def test_reel_comments(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    alice, alice_h = _alice(client)
    bob, bob_h = _bob(client)
    reel = _publish_reel(client, bob_h, fake_storage)
    base = f"/api/v1/reels/{reel['id']}"

    # A viewer comments on the reel.
    created = client.post(
        f"{base}/comments", json={"body": "nice one!"}, headers=alice_h
    )
    assert created.status_code == 201, created.text
    cid = created.json()["id"]
    assert client.get(base, headers=alice_h).json()["comment_count"] == 1

    # The author replies, threading on the parent id.
    reply = client.post(
        f"{base}/comments",
        json={"body": "thank you", "parent_id": cid},
        headers=bob_h,
    )
    assert reply.status_code == 201
    rid = reply.json()["id"]
    assert reply.json()["parent_id"] == cid
    assert client.get(base, headers=bob_h).json()["comment_count"] == 2

    page = client.get(f"{base}/comments", headers=alice_h).json()
    assert {c["id"] for c in page["items"]} == {cid, rid}

    # The reply notifies the commenter being answered (bob -> alice).
    notifs = client.get("/api/v1/notifications", headers=alice_h).json()
    comment_notifs = [n for n in notifs["items"] if n["type"] == "comment"]
    assert comment_notifs and comment_notifs[0]["actor"]["username"] == "bob"

    # Only the comment author or reel author may delete.
    assert (
        client.delete(f"{base}/comments/{rid}", headers=alice_h).status_code
        == 403
    )
    assert (
        client.delete(f"{base}/comments/{rid}", headers=bob_h).status_code
        == 204
    )
    assert client.get(base, headers=alice_h).json()["comment_count"] == 1

    # Anonymous can read but not write.
    assert client.get(f"{base}/comments").status_code == 200
    assert (
        client.post(f"{base}/comments", json={"body": "hi"}).status_code == 401
    )

    # A foreign parent_id is rejected.
    bad = client.post(
        f"{base}/comments",
        json={
            "body": "x",
            "parent_id": "00000000-0000-0000-0000-000000000000",
        },
        headers=alice_h,
    )
    assert bad.status_code == 422


def test_reel_save(
    client: TestClient, fake_storage: FakeStorageProvider
) -> None:
    _, alice_h = _alice(client)
    _, bob_h = _bob(client)
    reel = _publish_reel(client, bob_h, fake_storage)
    base = f"/api/v1/reels/{reel['id']}"

    assert client.get(base, headers=alice_h).json()["saved"] is False
    # Saving is idempotent and reflected on the reel.
    assert (
        client.put(f"{base}/save", headers=alice_h).json()["status"]
        == "saved"
    )
    assert (
        client.put(f"{base}/save", headers=alice_h).json()["status"]
        == "saved"
    )
    assert client.get(base, headers=alice_h).json()["saved"] is True

    # The saved list is private to the saver and needs auth.
    saved = client.get("/api/v1/reels/saved", headers=alice_h).json()
    assert [r["id"] for r in saved["items"]] == [reel["id"]]
    assert (
        client.get("/api/v1/reels/saved", headers=bob_h).json()["items"] == []
    )
    assert client.get("/api/v1/reels/saved").status_code == 401

    # Unsaving clears both the flag and the list.
    assert (
        client.delete(f"{base}/save", headers=alice_h).json()["status"]
        == "unsaved"
    )
    assert client.get(base, headers=alice_h).json()["saved"] is False
    assert (
        client.get("/api/v1/reels/saved", headers=alice_h).json()["items"]
        == []
    )
