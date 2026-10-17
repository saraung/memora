"""Persistence for media assets and upload intents."""

from __future__ import annotations

import uuid

from sqlmodel import Session, select

from app.infrastructure.database.models.media import (
    MediaAsset,
    MediaUploadIntent,
)


def create_intent(
    session: Session, *, record: MediaUploadIntent
) -> MediaUploadIntent:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_intent_by_id(
    session: Session, intent_id: uuid.UUID
) -> MediaUploadIntent | None:
    return session.get(MediaUploadIntent, intent_id)


def get_intent_by_public_id(
    session: Session, public_id: str
) -> MediaUploadIntent | None:
    return session.exec(
        select(MediaUploadIntent).where(
            MediaUploadIntent.public_id == public_id
        )
    ).first()


def save_intent(
    session: Session, record: MediaUploadIntent
) -> MediaUploadIntent:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def create_asset(session: Session, *, record: MediaAsset) -> MediaAsset:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_asset_by_id(
    session: Session, asset_id: uuid.UUID
) -> MediaAsset | None:
    return session.get(MediaAsset, asset_id)


def get_assets_by_ids(
    session: Session, asset_ids: list[uuid.UUID]
) -> list[MediaAsset]:
    if not asset_ids:
        return []
    return list(
        session.exec(
            select(MediaAsset).where(MediaAsset.id.in_(asset_ids))
        ).all()
    )


def save_asset(session: Session, record: MediaAsset) -> MediaAsset:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record
