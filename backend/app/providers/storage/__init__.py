from functools import lru_cache

from app.config import settings
from app.providers.storage.base import StorageProvider

KNOWN_COLLECTIONS: list[str] = [
    "discoveries",
    "evidence",
    "question_sets",
    "transcript_analyses",
    "problem_statements",
    "use_cases",
    "solution_blueprints",
    "empathy_maps",
    "hmw_boards",
    "ideation_sessions",
    "assumption_maps",
    "engagements",
    "company_profiles",
    "reviews",
    "audit",
]


@lru_cache(maxsize=1)
def get_storage_provider() -> StorageProvider:
    """Factory that returns the configured storage provider (cached singleton)."""
    match settings.storage_provider:
        case "azure" | "cosmos":
            from app.providers.storage.cosmos import CosmosStorageProvider

            return CosmosStorageProvider()
        case "local":
            from app.providers.storage.local import LocalStorageProvider

            return LocalStorageProvider()
        case _:
            raise ValueError(f"Unknown storage provider: {settings.storage_provider}")
