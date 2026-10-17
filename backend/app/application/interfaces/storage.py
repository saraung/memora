"""Storage-provider abstraction. Cloudinary today, swappable tomorrow."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class SignedUpload:
    """Everything the browser needs for a direct-to-provider upload."""

    upload_url: str
    params: dict[str, Any]


@dataclass
class VerifiedAsset:
    """Provider-confirmed metadata for an uploaded file."""

    public_id: str
    resource_type: str  # "image" | "video"
    version: str
    secure_url: str
    format: str
    size_bytes: int
    width: int | None
    height: int | None
    duration: float | None


class StorageProvider(Protocol):
    @property
    def configured(self) -> bool:
        """False when credentials are missing/dummy."""
        ...

    def sign_upload(
        self, *, public_id: str, resource_type: str
    ) -> SignedUpload:
        """Sign a direct browser upload for an intent's public_id."""
        ...

    def verify(
        self, *, public_id: str, resource_type: str
    ) -> VerifiedAsset:
        """Fetch provider-side metadata after upload. Raises on missing."""
        ...

    def destroy(self, *, public_id: str, resource_type: str) -> bool:
        """Delete the asset provider-side. Returns True when gone."""
        ...
