from functools import lru_cache

from app.config import settings
from app.providers.blob.base import BlobProvider


@lru_cache(maxsize=1)
def get_blob_provider() -> BlobProvider:
    """Factory that returns the configured blob storage provider (cached singleton)."""
    match settings.storage_provider:
        case "azure" | "cosmos":
            from app.providers.blob.azure_blob import AzureBlobProvider

            return AzureBlobProvider()
        case "local":
            from app.providers.blob.local_blob import LocalBlobProvider

            return LocalBlobProvider()
        case _:
            raise ValueError(f"Unknown storage provider for blobs: {settings.storage_provider}")
