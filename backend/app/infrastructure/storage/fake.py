"""In-memory storage double for tests and local development."""

from __future__ import annotations

from app.application.interfaces.storage import (
    SignedUpload,
    StorageProvider,
    VerifiedAsset,
)


class FakeStorageProvider(StorageProvider):
    """Pretends uploads land instantly; verification echoes test fixtures."""

    def __init__(self) -> None:
        self.signed: list[str] = []
        self.destroyed: list[str] = []
        self.fixtures: dict[str, VerifiedAsset] = {}

    @property
    def configured(self) -> bool:
        return True

    def sign_upload(
        self, *, public_id: str, resource_type: str
    ) -> SignedUpload:
        self.signed.append(public_id)
        return SignedUpload(
            upload_url=f"https://fake-storage.test/{resource_type}/upload",
            params={
                "public_id": public_id,
                "timestamp": 0,
                "signature": "fake",
                "api_key": "fake",
            },
        )

    def add_fixture(self, asset: VerifiedAsset) -> None:
        self.fixtures[asset.public_id] = asset

    def verify(
        self, *, public_id: str, resource_type: str
    ) -> VerifiedAsset:
        from app.core.exceptions import MediaError

        asset = self.fixtures.get(public_id)
        if asset is None:
            raise MediaError(
                "Upload not found at the storage provider",
                code="UPLOAD_NOT_FOUND",
                status_code=404,
            )
        return asset

    def destroy(self, *, public_id: str, resource_type: str) -> bool:
        self.destroyed.append(public_id)
        self.fixtures.pop(public_id, None)
        return True
