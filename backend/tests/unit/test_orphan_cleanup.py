"""Unit tests for the orphan media GC (scripts/cleanup_orphan_media.py)."""

from __future__ import annotations

import importlib.util
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlmodel import Session, select

from app.domain.enums import MediaStatus
from app.infrastructure.database.models.media import MediaAsset
from app.infrastructure.database.models.messaging import Message, MessageMedia
from app.infrastructure.database.models.user import User
from app.infrastructure.storage.fake import FakeStorageProvider


def _load_gc():
    path = (
        Path(__file__).parents[2] / "scripts" / "cleanup_orphan_media.py"
    )
    spec = importlib.util.spec_from_file_location(
        "cleanup_orphan_media", path
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _asset(public_id: str, *, days_old: int) -> MediaAsset:
    return MediaAsset(
        id=uuid.uuid4(),
        owner_id=None,
        public_id=public_id,
        resource_type="image",
        format="jpg",
        size_bytes=100,
        secure_url="https://x/y.jpg",
        status=MediaStatus.READY,
        created_at=datetime.now(timezone.utc) - timedelta(days=days_old),
    )


def _user(db: Session, n: int) -> User:
    user = User(
        email=f"gc{n}@example.com",
        username=f"gcuser{n}",
        password_hash="x",
        display_name=f"gc{n}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_dry_run_changes_nothing(db: Session) -> None:
    gc = _load_gc()
    storage = FakeStorageProvider()
    db.add(_asset("dry-run-1", days_old=3))
    db.commit()

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    found, removed = gc.cleanup_orphans(
        db, storage=storage, cutoff=cutoff, apply=False
    )
    assert (found, removed) == (1, 0)
    assert storage.destroyed == []
    assert (
        db.exec(
            select(MediaAsset).where(
                MediaAsset.public_id == "dry-run-1"
            )
        ).first()
        is not None
    )


def test_apply_removes_orphans_and_keeps_referenced(db: Session) -> None:
    gc = _load_gc()
    storage = FakeStorageProvider()
    alice = _user(db, 1)
    bob = _user(db, 2)

    db.add(_asset("orphan-old", days_old=3))
    db.add(_asset("orphan-new", days_old=0))
    referenced = _asset("referenced", days_old=3)
    db.add(referenced)
    db.commit()

    # Reference one asset from a message so it must be kept.
    from app.infrastructure.database.models.messaging import Conversation

    conv = Conversation(dm_key="gc-test")
    db.add(conv)
    db.commit()
    message = Message(
        conversation_id=conv.id, sender_id=alice.id, body="hi"
    )
    db.add(message)
    db.commit()
    db.add(
        MessageMedia(
            message_id=message.id, media_id=referenced.id, position=0
        )
    )
    db.commit()
    _ = bob

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    found, removed = gc.cleanup_orphans(
        db, storage=storage, cutoff=cutoff, apply=True
    )
    assert found == 1
    assert removed == 1
    assert storage.destroyed == ["orphan-old"]

    statuses = {
        row[0]: row[1]
        for row in db.exec(
            select(MediaAsset.public_id, MediaAsset.status)
        ).all()
    }
    assert statuses["orphan-old"] == MediaStatus.DELETED
    assert statuses["orphan-new"] == MediaStatus.READY
    assert statuses["referenced"] == MediaStatus.READY
