from app.config import settings
from app.providers.storage.base import StorageProvider


def get_storage_provider() -> StorageProvider:
    """Factory that returns the configured storage provider."""
    match settings.storage_provider:
        case "azure" | "cosmos":
            from app.providers.storage.cosmos import CosmosStorageProvider

            return CosmosStorageProvider()
        case "local":
            from app.providers.storage.local import LocalStorageProvider

            return LocalStorageProvider()
        case _:
            raise ValueError(f"Unknown storage provider: {settings.storage_provider}")
