"""Pytest fixtures: isolated PostgreSQL test DB and API client.

Tests run against memora_test (same container, different database).
Tables are created once per session and truncated after each test.
"""

from __future__ import annotations

import os

os.environ["DATABASE_URL"] = (
    "postgresql+psycopg://memora:change_me@localhost:5433/memora_test"
)
# Rate limiting is infrastructure policy, tested in isolation
# (tests/api/test_ratelimit.py). Disabled for the rest of the suite:
# all test traffic shares one client IP and would trip shared buckets.
os.environ["RATE_LIMIT_ENABLED"] = "false"

from collections.abc import Iterator  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlmodel import Session, SQLModel  # noqa: E402

from app.infrastructure.database import base  # noqa: E402,F401 (register tables)
from app.infrastructure.database.session import get_session  # noqa: E402
from app.main import app  # noqa: E402

test_engine = create_engine(
    os.environ["DATABASE_URL"], pool_pre_ping=True
)
TestingSessionLocal = sessionmaker(
    bind=test_engine, class_=Session, expire_on_commit=False
)

TABLES = (
    "audit_events, email_verification_tokens, password_reset_tokens, "
    "refresh_sessions, user_roles, role_permissions, users, roles, "
    "permissions, follows, follow_requests, blocks, media_upload_intents, "
    "media_assets, posts, post_media, likes, comments, bookmarks, "
    "hashtags, post_hashtags, mentions, stories, story_views, reels, "
    "reel_views, reel_likes, conversations, conversation_participants, "
    "messages, message_receipts, message_media, notifications"
)


@pytest.fixture(scope="session", autouse=True)
def _schema() -> Iterator[None]:
    SQLModel.metadata.create_all(test_engine)
    yield
    SQLModel.metadata.drop_all(test_engine)


@pytest.fixture()
def db() -> Iterator[Session]:
    with TestingSessionLocal() as session:
        yield session
    with test_engine.connect() as conn:
        conn.execute(text(f"TRUNCATE {TABLES} CASCADE;"))
        conn.commit()


@pytest.fixture()
def client(db: Session) -> Iterator[TestClient]:
    def _override():
        yield db

    app.dependency_overrides[get_session] = _override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def fake_storage(client: TestClient):
    """In-memory storage double with per-test override cleanup."""
    from app.infrastructure.storage.fake import FakeStorageProvider
    from app.modules.media.dependencies import get_storage_provider

    storage = FakeStorageProvider()
    app.dependency_overrides[get_storage_provider] = lambda: storage
    yield storage
    # `client` teardown clears all overrides afterwards.


def register_payload(**overrides) -> dict:
    payload = {
        "email": "alice@example.com",
        "username": "alice",
        "password": "supersecret1",
    }
    payload.update(overrides)
    return payload
