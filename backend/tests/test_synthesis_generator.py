"""End-to-end happy path for the synthesis generator.

Wires the real local LLM provider (an echo provider that returns the
prompts verbatim) + the local storage provider + the LocalDir source
adapter against a tmp directory. Asserts:

  build_corpus → docs → generator.generate → Artifact saved to storage
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from app.synthesis.categories import Category
from app.synthesis.corpus import build_corpus
from app.synthesis.generator import ARTIFACTS_COLLECTION, GeneratorEngine
from app.synthesis.models import Artifact, SourceKind

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Fake LLM that returns a valid generator payload echoed from the prompt
# ---------------------------------------------------------------------------


class _EchoLLM:
    """LLM stand-in for tests. Returns a deterministic JSON payload.

    The real generator validates citations against the corpus source ids,
    so the test injects the first valid source id directly when
    constructing the LLM (no fragile prompt parsing)."""

    def __init__(self, source_id: str = "") -> None:
        self.source_id = source_id

    async def complete_json(self, system: str, user: str) -> dict[str, Any]:
        return {
            "title": "Echo Problem Statement",
            "summary": "Echo summary from the fake LLM.",
            "body": {"statement": "The team needs faster onboarding.", "evidence": []},
            "citations": (
                [{"source_id": self.source_id, "quote": "echoed", "note": "fake"}]
                if self.source_id
                else []
            ),
        }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def project(tmp_path: Path) -> dict:
    """A project record with a local_dirs entry pointing at a tmp dir
    populated with two markdown files."""
    docs_dir = tmp_path / "corpus"
    docs_dir.mkdir()
    (docs_dir / "intro.md").write_text(
        "# Intro\nAcme is a fintech with 200 employees.\n", encoding="utf-8"
    )
    (docs_dir / "interview.md").write_text(
        "Sarah (VP Ops): onboarding takes 6 weeks.\n", encoding="utf-8"
    )
    return {
        "id": "proj-acme",
        "metadata": {"local_dirs": [str(docs_dir)]},
        "tags": [],
    }


# Note: storage isolation comes from conftest.py's autouse
# _clean_test_data fixture, which sets LOCAL_STORAGE_PATH=./test_data
# before app.config.settings imports, and clears the dir between tests.
# Trying to monkeypatch the env later doesn't help — settings is a
# module-level singleton.


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_local_dir_adapter_walks_dirs(project: dict) -> None:
    from app.synthesis.sources.local_dir import LocalDirSourceAdapter

    adapter = LocalDirSourceAdapter()
    docs = await adapter.fetch(project)
    assert len(docs) == 2
    titles = sorted(d.title for d in docs)
    assert titles == ["interview.md", "intro.md"]
    for d in docs:
        assert d.kind is SourceKind.LOCAL_DIR
        assert d.text
        assert d.id.startswith("local:corpus/")


async def test_build_corpus_collects_docs(project: dict) -> None:
    corpus = await build_corpus(project)
    assert corpus.project_id == "proj-acme"
    assert len(corpus.docs) == 2


async def test_generator_round_trip(project: dict) -> None:
    """generate() → Artifact persisted under ARTIFACTS_COLLECTION."""
    corpus = await build_corpus(project)
    assert len(corpus.docs) > 0

    engine = GeneratorEngine()
    valid_ids = {d.id for d in corpus.docs}
    fake_llm = _EchoLLM(source_id=next(iter(valid_ids)))
    with patch("app.synthesis.generator.get_llm_provider", return_value=fake_llm):
        art = await engine.generate(project, type_id="problem-statement", corpus=corpus)

    assert isinstance(art, Artifact)
    assert art.project_id == "proj-acme"
    assert art.type_id == "problem-statement"
    assert art.category is Category.WHY
    assert art.title == "Echo Problem Statement"
    assert art.summary.startswith("Echo")
    assert art.body["statement"]
    assert len(art.citations) == 1
    assert art.citations[0].source_id in valid_ids


async def test_generator_filters_invalid_citations(project: dict) -> None:
    """Citations pointing at unknown source_ids get dropped."""
    corpus = await build_corpus(project)

    class _BadCitationLLM:
        async def complete_json(self, system: str, user: str) -> dict[str, Any]:
            return {
                "title": "X",
                "summary": "",
                "body": {"statement": "fabricated"},
                "citations": [
                    {"source_id": "made-up-id", "quote": "fake"},
                    {"source_id": list({d.id for d in corpus.docs})[0], "quote": "real"},
                ],
            }

    engine = GeneratorEngine()
    with patch("app.synthesis.generator.get_llm_provider", return_value=_BadCitationLLM()):
        art = await engine.generate(project, type_id="problem-statement", corpus=corpus)

    # Only the real-source-id citation survives.
    assert len(art.citations) == 1
    valid_ids = {d.id for d in corpus.docs}
    assert art.citations[0].source_id in valid_ids


async def test_generator_persists_to_local_storage(project: dict) -> None:
    """Saved artifact is retrievable via storage.list — the persistence
    contract the rest of the system relies on."""
    from app.providers.storage import get_storage_provider

    corpus = await build_corpus(project)
    engine = GeneratorEngine()
    valid_ids = {d.id for d in corpus.docs}
    fake_llm = _EchoLLM(source_id=next(iter(valid_ids)))
    with patch("app.synthesis.generator.get_llm_provider", return_value=fake_llm):
        await engine.generate(project, type_id="problem-statement", corpus=corpus)

    storage = get_storage_provider()
    rows = await storage.list(ARTIFACTS_COLLECTION, {"project_id": "proj-acme"})
    assert len(rows) == 1
    assert rows[0]["type_id"] == "problem-statement"
    assert rows[0]["project_id"] == "proj-acme"
    assert rows[0]["category"] == "why"


async def test_regenerate_increments_version(project: dict) -> None:
    corpus = await build_corpus(project)
    engine = GeneratorEngine()
    valid_ids = {d.id for d in corpus.docs}
    fake_llm = _EchoLLM(source_id=next(iter(valid_ids)))
    with patch("app.synthesis.generator.get_llm_provider", return_value=fake_llm):
        first = await engine.generate(project, type_id="problem-statement", corpus=corpus)
        second = await engine.generate(project, type_id="problem-statement", corpus=corpus)

    assert first.id
    assert second.id == first.id
    assert second.version == first.version + 1
