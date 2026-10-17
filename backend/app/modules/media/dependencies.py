"""Storage provider wiring (overridable in tests)."""

from app.application.interfaces.storage import StorageProvider
from app.infrastructure.storage.cloudinary_provider import (
    CloudinaryStorageProvider,
)


def get_storage_provider() -> StorageProvider:
    return CloudinaryStorageProvider()
