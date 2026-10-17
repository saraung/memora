"""Delete abandoned upload assets (completed but never referenced).

An asset is orphaned when it is READY, older than --older-than-hours,
and referenced by no post, story, reel, or message. Supports --dry-run
(default) and --apply (deletes provider-side too, marks rows DELETED).

Usage:
    uv run python scripts/cleanup_orphan_media.py --dry-run
    uv run python scripts/cleanup_orphan_media.py --apply
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import Session, select  # noqa: E402

from app.domain.enums import MediaStatus  # noqa: E402
from app.infrastructure.database.models.content import (  # noqa: E402
    PostMedia,
    Reel,
    Story,
)
from app.infrastructure.database.models.media import MediaAsset  # noqa: E402
from app.infrastructure.database.models.messaging import MessageMedia  # noqa: E402
from app.infrastructure.database.repositories import media_repository  # noqa: E402
from app.infrastructure.database.session import engine  # noqa: E402
from app.infrastructure.storage.cloudinary_provider import (  # noqa: E402
    CloudinaryStorageProvider,
)


def _referenced_ids(session: Session) -> set:
    ids: set = set()
    ids.update(
        session.exec(select(PostMedia.media_id)).all()
    )
    ids.update(session.exec(select(Story.media_id)).all())
    ids.update(session.exec(select(Reel.video_id)).all())
    ids.update(
        r for r in session.exec(select(Reel.cover_id)).all() if r is not None
    )
    ids.update(session.exec(select(MessageMedia.media_id)).all())
    return set(ids)


def find_orphans(session: Session, cutoff: datetime) -> list[MediaAsset]:
    """READY assets older than `cutoff` with no content references."""
    referenced = _referenced_ids(session)
    return [
        asset
        for asset in session.exec(
            select(MediaAsset).where(
                MediaAsset.status == MediaStatus.READY,
                MediaAsset.created_at < cutoff,
            )
        ).all()
        if asset.id not in referenced
    ]


def cleanup_orphans(
    session: Session,
    *,
    storage: CloudinaryStorageProvider,
    cutoff: datetime,
    apply: bool,
) -> tuple[int, int]:
    """Mark orphan assets DELETED (destroying provider files if apply).

    Returns (found, removed).
    """
    found = removed = 0
    for asset in find_orphans(session, cutoff):
        found += 1
        print(f"orphan: {asset.id} {asset.public_id} ({asset.size_bytes}b)")
        if not apply:
            continue
        if storage.configured:
            try:
                storage.destroy(
                    public_id=asset.public_id,
                    resource_type=asset.resource_type,
                )
            except Exception as exc:  # noqa: BLE001
                print(f"  provider delete failed: {exc}")
                continue
        asset.status = MediaStatus.DELETED
        media_repository.save_asset(session, asset)
        removed += 1
    return found, removed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete (default is dry-run).",
    )
    parser.add_argument(
        "--older-than-hours",
        type=int,
        default=24,
        help="Only consider assets older than this.",
    )
    args = parser.parse_args()

    cutoff = datetime.now(timezone.utc) - timedelta(hours=args.older_than_hours)
    storage = CloudinaryStorageProvider()
    with Session(engine) as db:
        found, removed = cleanup_orphans(
            db, storage=storage, cutoff=cutoff, apply=args.apply
        )
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] {found} orphan(s) found, {removed} removed")


if __name__ == "__main__":
    main()
