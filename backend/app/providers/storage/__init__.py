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
    # v1.4.0 synthesis subsystem
    "artifacts",
    "critiques",
    "synthesis_questions",
    "source_indexes",
    # v1.6.0 chat over corpus
    "synthesis_chats",
    # v2.2.0 customer + multi-source workspace
    "customers",
    "engagement_contexts",
    "engagement_context_versions",
    "artifact_threads",
    "artifact_comments",
    # v2.2.8 user-authored project notes (added via Refine "+ Add")
    "project_notes",
]

# Collections partitioned by ``project_id`` when
# ``settings.cosmos_partition_strategy == "project_id"``. Items in these
# collections are scoped to a single project — listing automatically filters by
# the active ``current_project_id`` ContextVar.
#
# Excluded by design:
#   - ``engagements``: the project record itself; partitioned by ``/id``.
#   - ``audit``: cross-project log; partitioned by ``/id``.
PARTITIONED_COLLECTIONS: frozenset[str] = frozenset(
    {
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
        "company_profiles",
        "reviews",
        "artifacts",
        "critiques",
        "synthesis_questions",
        "source_indexes",
        "synthesis_chats",
        "engagement_contexts",
        "engagement_context_versions",
        "artifact_threads",
        "artifact_comments",
        "project_notes",
    }
)


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
