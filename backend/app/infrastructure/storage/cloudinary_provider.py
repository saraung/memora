"""Cloudinary storage provider: signed uploads + admin verification."""

from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlparse

import cloudinary
import cloudinary.api
import cloudinary.uploader
from cloudinary.utils import api_sign_request

from app.application.interfaces.storage import (
    SignedUpload,
    StorageProvider,
    VerifiedAsset,
)
from app.core.config import settings
from app.core.exceptions import MediaError


def _parse_cloudinary_url(value: str) -> dict[str, str]:
    """Split cloudinary://key:secret@cloud_name into parts."""
    parsed = urlparse(value)
    return {
        "cloud_name": parsed.hostname or "",
        "api_key": parsed.username or "",
        "api_secret": parsed.password or "",
    }


class CloudinaryStorageProvider(StorageProvider):
    def __init__(self) -> None:
        parts = _parse_cloudinary_url(
            settings.CLOUDINARY_URL.get_secret_value()
        )
        self._cloud_name = parts["cloud_name"]
        self._api_key = parts["api_key"]
        self._api_secret = parts["api_secret"]
        cloudinary.config(
            cloud_name=self._cloud_name or None,
            api_key=self._api_key or None,
            api_secret=self._api_secret or None,
            secure=True,
        )

    @property
    def configured(self) -> bool:
        return bool(
            self._cloud_name
            and self._cloud_name != "dummy-cloud"
            and self._api_key
            and self._api_secret
        )

    def _require_configured(self) -> None:
        from app.core.exceptions import StorageUnavailableError

        if not self.configured:
            raise StorageUnavailableError(
                "Set a real CLOUDINARY_URL to enable media uploads"
            )

    def sign_upload(
        self, *, public_id: str, resource_type: str
    ) -> SignedUpload:
        self._require_configured()
        timestamp = int(time.time())
        # NOTE: public_id already contains the folder prefix
        # (e.g. "memora/<uuid>"). Do NOT also send `folder`: Cloudinary
        # concatenates them and the asset would land at
        # "memora/memora/<uuid>", breaking verification.
        params: dict[str, Any] = {
            "timestamp": timestamp,
            "public_id": public_id,
        }
        signature = api_sign_request(params, self._api_secret)
        return SignedUpload(
            upload_url=(
                f"https://api.cloudinary.com/v1_1/"
                f"{self._cloud_name}/{resource_type}/upload"
            ),
            params={
                **params,
                "signature": signature,
                "api_key": self._api_key,
            },
        )

    def verify(
        self, *, public_id: str, resource_type: str
    ) -> VerifiedAsset:
        self._require_configured()
        try:
            resource = cloudinary.api.resource(
                public_id, resource_type=resource_type
            )
        except Exception as exc:
            raise MediaError(
                "Upload not found at the storage provider",
                code="UPLOAD_NOT_FOUND",
                status_code=404,
            ) from exc
        return VerifiedAsset(
            public_id=public_id,
            resource_type=resource.get("resource_type", resource_type),
            version=str(resource.get("version", "")),
            secure_url=resource.get("secure_url", ""),
            format=str(resource.get("format", "")),
            size_bytes=int(resource.get("bytes", 0)),
            width=resource.get("width"),
            height=resource.get("height"),
            duration=resource.get("duration"),
        )

    def destroy(self, *, public_id: str, resource_type: str) -> bool:
        self._require_configured()
        try:
            result = cloudinary.uploader.destroy(
                public_id, resource_type=resource_type
            )
        except Exception:
            return False
        return result.get("result") in ("ok", "not found")
