"""Media upload intents and asset metadata."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.application.interfaces.storage import StorageProvider
from app.application.services import media_service
from app.infrastructure.database.models.media import MediaAsset
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import media_repository
from app.infrastructure.database.session import get_session
from app.core.exceptions import ForbiddenError, ResourceNotFoundError
from app.modules.auth.dependencies import get_current_user
from app.modules.media import schemas
from app.modules.media.dependencies import get_storage_provider

router = APIRouter(prefix="/media", tags=["media"])


@router.post(
    "/upload-intents",
    response_model=schemas.UploadIntentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_intent(
    body: schemas.UploadIntentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
    storage: StorageProvider = Depends(get_storage_provider),
) -> schemas.UploadIntentResponse:
    intent, signed = media_service.create_upload_intent(
        db,
        owner=current_user,
        expected_mime=body.expected_mime,
        expected_bytes=body.expected_bytes,
        storage=storage,
    )
    return schemas.UploadIntentResponse(
        id=intent.id,
        public_id=intent.public_id,
        resource_type=intent.resource_type,
        expires_at=intent.expires_at,
        upload_url=signed["upload_url"],
        params=signed["params"],
    )


@router.post(
    "/upload-intents/{intent_id}/complete",
    response_model=schemas.MediaResponse,
)
def complete_intent(
    intent_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
    storage: StorageProvider = Depends(get_storage_provider),
) -> schemas.MediaResponse:
    asset = media_service.complete_upload_intent(
        db, owner=current_user, intent_id=intent_id, storage=storage
    )
    return schemas.MediaResponse.model_validate(asset)


def _media_or_404(db: Session, asset_id: uuid.UUID) -> MediaAsset:
    asset = media_repository.get_asset_by_id(db, asset_id)
    if asset is None:
        raise ResourceNotFoundError("Media not found")
    return asset


@router.get("/{media_id}", response_model=schemas.MediaResponse)
def get_media(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MediaResponse:
    asset = _media_or_404(db, media_id)
    if asset.owner_id != current_user.id:
        # Metadata stays owner-private; delivery URLs are public-capable
        # only once attached to a visible post.
        raise ForbiddenError("You do not own this media")
    return schemas.MediaResponse.model_validate(asset)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
    storage: StorageProvider = Depends(get_storage_provider),
) -> None:
    media_service.delete_asset(
        db, owner=current_user, asset_id=media_id, storage=storage
    )
