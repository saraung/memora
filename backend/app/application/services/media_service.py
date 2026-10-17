"""Media upload lifecycle: intents, provider verification, assets."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.application.interfaces.storage import StorageProvider
from app.core.config import settings
from app.core.exceptions import MediaError
from app.domain.enums import MediaStatus
from app.infrastructure.database.models.media import (
    MediaAsset,
    MediaUploadIntent,
)
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import media_repository

INTENT_TTL = timedelta(hours=1)

FORMAT_TO_MIME = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _classify_mime(mime: str) -> str:
    if mime in settings.MEDIA_ALLOWED_IMAGE_TYPES:
        return "image"
    if mime in settings.MEDIA_ALLOWED_VIDEO_TYPES:
        return "video"
    raise MediaError(
        f"Unsupported media type: {mime}",
        code="UNSUPPORTED_MEDIA_TYPE",
        status_code=415,
    )


def _max_bytes(resource_type: str) -> int:
    mb = (
        settings.MEDIA_MAX_IMAGE_MB
        if resource_type == "image"
        else settings.MEDIA_MAX_VIDEO_MB
    )
    return mb * 1024 * 1024


def create_upload_intent(
    db: Session,
    *,
    owner: User,
    expected_mime: str,
    expected_bytes: int,
    storage: StorageProvider,
) -> tuple[MediaUploadIntent, dict]:
    """Authorize an upload and return signed direct-upload params."""
    from app.core.exceptions import StorageUnavailableError

    if not storage.configured:
        raise StorageUnavailableError(
            "Set a real CLOUDINARY_URL to enable media uploads"
        )
    resource_type = _classify_mime(expected_mime)
    if expected_bytes <= 0 or expected_bytes > _max_bytes(resource_type):
        raise MediaError(
            f"File size exceeds the {resource_type} limit",
            code="FILE_TOO_LARGE",
            status_code=413,
        )
    public_id = f"{settings.CLOUDINARY_FOLDER}/{uuid.uuid4().hex}"
    intent = media_repository.create_intent(
        db,
        record=MediaUploadIntent(
            owner_id=owner.id,
            public_id=public_id,
            resource_type=resource_type,
            expected_mime=expected_mime,
            expected_bytes=expected_bytes,
            expires_at=_utcnow() + INTENT_TTL,
        ),
    )
    signed = storage.sign_upload(
        public_id=public_id, resource_type=resource_type
    )
    return intent, {"upload_url": signed.upload_url, "params": signed.params}


def complete_upload_intent(
    db: Session,
    *,
    owner: User,
    intent_id: uuid.UUID,
    storage: StorageProvider,
) -> MediaAsset:
    """Verify a finished provider upload and materialize the asset."""
    from app.core.exceptions import StorageUnavailableError

    if not storage.configured:
        raise StorageUnavailableError(
            "Set a real CLOUDINARY_URL to enable media uploads"
        )
    intent = media_repository.get_intent_by_id(db, intent_id)
    if intent is None:
        raise MediaError("Upload intent not found", code="INTENT_NOT_FOUND",
                         status_code=404)
    if intent.owner_id != owner.id:
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("This upload intent is not yours")
    if intent.used_at is not None:
        raise MediaError(
            "This upload intent was already used", code="INTENT_REUSED",
            status_code=409,
        )
    if intent.expires_at <= _utcnow():
        raise MediaError(
            "This upload intent has expired", code="INTENT_EXPIRED",
            status_code=410,
        )

    verified = storage.verify(
        public_id=intent.public_id, resource_type=intent.resource_type
    )
    if verified.resource_type != intent.resource_type:
        raise MediaError(
            "Uploaded file type does not match the intent",
            code="TYPE_MISMATCH",
        )
    actual_mime = FORMAT_TO_MIME.get(verified.format.lower(), "")
    if actual_mime != intent.expected_mime:
        raise MediaError(
            "Uploaded file type does not match the declared type",
            code="TYPE_MISMATCH",
        )
    if verified.size_bytes > _max_bytes(intent.resource_type):
        raise MediaError(
            "Uploaded file exceeds the size limit", code="FILE_TOO_LARGE",
            status_code=413,
        )
    if intent.resource_type == "image" and not (
        verified.width and verified.height
    ):
        raise MediaError(
            "Uploaded image has no readable dimensions",
            code="INVALID_IMAGE",
        )

    asset = media_repository.create_asset(
        db,
        record=MediaAsset(
            owner_id=owner.id,
            public_id=verified.public_id,
            resource_type=verified.resource_type,
            format=verified.format,
            size_bytes=verified.size_bytes,
            width=verified.width,
            height=verified.height,
            duration=verified.duration,
            secure_url=verified.secure_url,
            version=verified.version,
            status=MediaStatus.READY,
        ),
    )
    intent.used_at = _utcnow()
    media_repository.save_intent(db, intent)
    return asset


def delete_asset(
    db: Session,
    *,
    owner: User,
    asset_id: uuid.UUID,
    storage: StorageProvider,
) -> None:
    asset = media_repository.get_asset_by_id(db, asset_id)
    if asset is None:
        from app.core.exceptions import ResourceNotFoundError

        raise ResourceNotFoundError("Media not found")
    if asset.owner_id != owner.id:
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("You do not own this media")
    if asset.status != MediaStatus.DELETED and storage.configured:
        storage.destroy(
            public_id=asset.public_id, resource_type=asset.resource_type
        )
    asset.status = MediaStatus.DELETED
    media_repository.save_asset(db, asset)
