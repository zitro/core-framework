"""Smoke-test the discovery → synthesis migration script.

Uses the local in-memory storage provider so the test exercises the real
write path without touching Cosmos.
"""

from __future__ import annotations

import os

import pytest

# Force local provider before importing the module under test.
os.environ.setdefault("STORAGE_PROVIDER", "local")
os.environ.setdefault("LLM_PROVIDER", "local")
os.environ.setdefault("AUTH_PROVIDER", "none")

from app.providers.storage import get_storage_provider  # noqa: E402
from scripts.migrate_discoveries_to_synthesis import (  # noqa: E402
    ARCHIVE_KEY,
    ENGAGEMENTS,
    migrate,
)


@pytest.mark.asyncio
async def test_dry_run_does_not_write():
    storage = get_storage_provider()
    await storage.create(
        "discoveries",
        {
            "id": "disc-dry",
            "name": "Dry Discovery",
            "evidence": [{"id": "e1", "title": "A", "content": "alpha"}],
        },
    )
    counts = await migrate(apply=False)
    assert counts["create"] >= 1
    # Engagement must NOT exist yet.
    assert (await storage.get(ENGAGEMENTS, "disc-dry")) is None


@pytest.mark.asyncio
async def test_apply_creates_engagement_with_archive():
    storage = get_storage_provider()
    await storage.create(
        "discoveries",
        {
            "id": "disc-apply",
            "name": "Apply Discovery",
            "description": "from migration",
            "evidence": [{"id": "e1", "title": "Quote", "content": "customer said x"}],
        },
    )
    await migrate(apply=True)

    eng = await storage.get(ENGAGEMENTS, "disc-apply")
    assert eng is not None
    archive = ((eng.get("metadata") or {}).get("sources") or {}).get(ARCHIVE_KEY)
    assert archive is not None
    docs = archive.get("docs") or []
    assert any(d["text"] == "customer said x" for d in docs)


@pytest.mark.asyncio
async def test_apply_merges_into_existing_engagement():
    storage = get_storage_provider()
    await storage.create(
        ENGAGEMENTS,
        {"id": "disc-merge", "name": "Existing", "metadata": {"keep": True}},
    )
    await storage.create(
        "discoveries",
        {
            "id": "disc-merge",
            "name": "Existing",
            "evidence": [{"id": "e1", "content": "merged-evidence"}],
        },
    )
    await migrate(apply=True)
    eng = await storage.get(ENGAGEMENTS, "disc-merge")
    assert eng["metadata"]["keep"] is True  # untouched
    docs = eng["metadata"]["sources"][ARCHIVE_KEY]["docs"]
    assert any("merged-evidence" in d["text"] for d in docs)
