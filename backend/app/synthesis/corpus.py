"""Source registry + corpus assembly.

``build_corpus(project)`` runs every enabled adapter, flattens the results
into a single ``Corpus`` and persists a lightweight index entry so the UI can
show "last refreshed N minutes ago" without touching disk again.
"""

from __future__ import annotations

import logging

from app.providers.storage import get_storage_provider
from app.synthesis.models import Corpus, SourceDoc
from app.synthesis.sources.base import SourceAdapter
from app.synthesis.sources.github import GitHubSourceAdapter
from app.synthesis.sources.http_json import HttpJsonSourceAdapter
from app.synthesis.sources.local_dir import LocalDirSourceAdapter
from app.synthesis.sources.msgraph import MsGraphSourceAdapter
from app.synthesis.sources.user_notes import UserNotesSourceAdapter
from app.synthesis.sources.vertex import VertexSourceAdapter
from app.synthesis.sources.web import WebSourceAdapter
from app.utils.audit import stamp_create

logger = logging.getLogger(__name__)

INDEX_COLLECTION = "source_indexes"


def get_adapters() -> list[SourceAdapter]:
    """Return the active set of source adapters in priority order."""
    return [
        VertexSourceAdapter(),
        LocalDirSourceAdapter(),
        MsGraphSourceAdapter(),
        GitHubSourceAdapter(),
        WebSourceAdapter(),
        HttpJsonSourceAdapter(),
        UserNotesSourceAdapter(),
    ]


async def build_corpus(project: dict) -> Corpus:
    """Materialise the corpus for ``project`` by querying every adapter."""
    project_id = str(project.get("id") or "")
    if not project_id:
        raise ValueError("project missing id")

    docs: list[SourceDoc] = []
    for adapter in get_adapters():
        if not adapter.enabled:
            continue
        try:
            adapter_docs = await adapter.fetch(project)
        except Exception:
            logger.exception("source adapter %s failed", adapter.kind)
            continue
        docs.extend(adapter_docs)

    corpus = Corpus(project_id=project_id, docs=docs)
    await _persist_index(corpus)
    return corpus


async def _persist_index(corpus: Corpus) -> None:
    storage = get_storage_provider()
    item_id = f"index-{corpus.project_id}"
    payload = {
        "id": item_id,
        "project_id": corpus.project_id,
        "doc_count": len(corpus.docs),
        "by_kind": _count_by_kind(corpus.docs),
        "built_at": corpus.built_at.isoformat(),
    }
    try:
        existing = await storage.get(INDEX_COLLECTION, item_id)
    except Exception:
        existing = None
    try:
        if existing:
            await storage.update(INDEX_COLLECTION, item_id, payload)
        else:
            await storage.create(INDEX_COLLECTION, stamp_create(payload))
    except Exception:
        logger.warning("source index persist failed", exc_info=True)


def _count_by_kind(docs: list[SourceDoc]) -> dict[str, int]:
    out: dict[str, int] = {}
    for d in docs:
        out[d.kind.value] = out.get(d.kind.value, 0) + 1
    return out
