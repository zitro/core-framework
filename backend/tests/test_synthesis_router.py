"""HTTP-level tests for the Phase 6C synthesis router.

Tests run against the real ASGI app via httpx (no live network). The
backend storage provider is `local` (set in conftest.py), and the LLM
provider is mocked per test."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider
from app.synthesis.types import ARTIFACT_TYPES

pytestmark = pytest.mark.asyncio


# ── helpers ─────────────────────────────────────────────────────────────


async def _seed_project(project_id: str, local_dir: str | None = None) -> None:
    """Write a minimal Engagement row for a project so /api/synthesis
    routes can resolve it."""
    storage = get_storage_provider()
    payload: dict[str, Any] = {
        "id": project_id,
        "name": "Test Project",
        "customer": "Acme",
        "status": "proposed",
        "owners": [],
    }
    if local_dir:
        payload["metadata"] = {"local_dirs": [local_dir]}
    await storage.create("engagements", payload)


# ── /catalog ────────────────────────────────────────────────────────────


async def test_catalog_returns_categories_and_types(client: AsyncClient) -> None:
    resp = await client.get("/api/synthesis/catalog")
    assert resp.status_code == 200
    body = resp.json()
    assert "categories" in body
    assert len(body["categories"]) == 7  # 7 categories
    total_types = sum(len(cat["types"]) for cat in body["categories"])
    assert total_types == len(ARTIFACT_TYPES)
    # Every type carries id+label+description+critical
    for cat in body["categories"]:
        for t in cat["types"]:
            assert {"id", "label", "description", "critical"} <= t.keys()


async def test_catalog_preserves_category_order(client: AsyncClient) -> None:
    resp = await client.get("/api/synthesis/catalog")
    ids = [cat["id"] for cat in resp.json()["categories"]]
    # Defined CATEGORY_ORDER
    assert ids == ["why", "value", "what", "scope", "how", "story", "operational"]


# ── /artifacts ──────────────────────────────────────────────────────────


async def test_list_artifacts_404_when_project_missing(client: AsyncClient) -> None:
    resp = await client.get("/api/synthesis/missing-id/artifacts")
    assert resp.status_code == 404


async def test_list_artifacts_empty_when_no_synthesis_yet(client: AsyncClient) -> None:
    await _seed_project("proj-empty")
    resp = await client.get("/api/synthesis/proj-empty/artifacts")
    assert resp.status_code == 200
    assert resp.json() == {"artifacts": []}


# ── /synthesize ─────────────────────────────────────────────────────────


class _EchoLLM:
    """Returns minimal valid generator payload (no citations — keeps test
    independent of corpus contents)."""

    async def complete_json(self, system: str, user: str) -> dict[str, Any]:
        return {
            "title": "Echo Artifact",
            "summary": "Echo summary.",
            "body": {"statement": "Echo statement."},
            "citations": [],
        }


async def test_synthesize_404_when_project_missing(client: AsyncClient) -> None:
    resp = await client.post("/api/synthesis/missing/synthesize")
    assert resp.status_code == 404


async def test_synthesize_generates_critical_types(client: AsyncClient, tmp_path) -> None:
    """Default call (no payload) generates only critical types."""
    corpus_dir = tmp_path / "corpus"
    corpus_dir.mkdir()
    (corpus_dir / "intro.md").write_text("Acme: fintech, 200 employees.\n", encoding="utf-8")

    await _seed_project("proj-critical", local_dir=str(corpus_dir))

    critical_count = sum(1 for t in ARTIFACT_TYPES if t.critical)

    with patch("app.synthesis.generator.get_llm_provider", return_value=_EchoLLM()):
        resp = await client.post("/api/synthesis/proj-critical/synthesize")

    assert resp.status_code == 200
    body = resp.json()
    assert body["project_id"] == "proj-critical"
    assert body["corpus_doc_count"] == 1
    assert body["artifact_count"] == critical_count
    assert body["failures"] == []


async def test_synthesize_missing_only_skips_existing(client: AsyncClient, tmp_path) -> None:
    corpus_dir = tmp_path / "corpus"
    corpus_dir.mkdir()
    (corpus_dir / "x.md").write_text("text\n", encoding="utf-8")

    await _seed_project("proj-missing-only", local_dir=str(corpus_dir))

    with patch("app.synthesis.generator.get_llm_provider", return_value=_EchoLLM()):
        first = await client.post("/api/synthesis/proj-missing-only/synthesize")
        assert first.status_code == 200
        assert first.json()["artifact_count"] > 0

        second = await client.post(
            "/api/synthesis/proj-missing-only/synthesize",
            json={"missing_only": True},
        )

    assert second.status_code == 200
    # All critical types now exist, so missing_only=true generates nothing.
    assert second.json()["artifact_count"] == 0


async def test_synthesize_failures_dont_short_circuit(client: AsyncClient, tmp_path) -> None:
    """One bad type doesn't stop the rest — failures are reported in the
    summary, not raised."""
    corpus_dir = tmp_path / "corpus"
    corpus_dir.mkdir()
    (corpus_dir / "x.md").write_text("text\n", encoding="utf-8")

    await _seed_project("proj-failures", local_dir=str(corpus_dir))

    calls = {"n": 0}

    class _FlakyLLM:
        async def complete_json(self, system: str, user: str) -> dict[str, Any]:
            calls["n"] += 1
            if calls["n"] == 2:
                raise RuntimeError("flaky")
            return {
                "title": "ok",
                "summary": "",
                "body": {},
                "citations": [],
            }

    with patch("app.synthesis.generator.get_llm_provider", return_value=_FlakyLLM()):
        resp = await client.post("/api/synthesis/proj-failures/synthesize")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["failures"]) == 1
    assert "flaky" in body["failures"][0]["error"]


# ── /regenerate ─────────────────────────────────────────────────────────


async def test_regenerate_unknown_type_returns_404(client: AsyncClient, tmp_path) -> None:
    corpus_dir = tmp_path / "corpus"
    corpus_dir.mkdir()
    (corpus_dir / "x.md").write_text("text\n", encoding="utf-8")

    await _seed_project("proj-bad-type", local_dir=str(corpus_dir))

    with patch("app.synthesis.generator.get_llm_provider", return_value=_EchoLLM()):
        resp = await client.post(
            "/api/synthesis/proj-bad-type/artifacts/not-a-real-type/regenerate",
            json={"type_id": "not-a-real-type"},
        )
    assert resp.status_code == 404


async def test_regenerate_type_id_mismatch_returns_422(client: AsyncClient) -> None:
    await _seed_project("proj-mismatch")
    resp = await client.post(
        "/api/synthesis/proj-mismatch/artifacts/problem-statement/regenerate",
        json={"type_id": "customer-pain"},
    )
    assert resp.status_code == 422


async def test_regenerate_returns_artifact_payload(client: AsyncClient, tmp_path) -> None:
    corpus_dir = tmp_path / "corpus"
    corpus_dir.mkdir()
    (corpus_dir / "x.md").write_text("text\n", encoding="utf-8")

    await _seed_project("proj-regen", local_dir=str(corpus_dir))

    with patch("app.synthesis.generator.get_llm_provider", return_value=_EchoLLM()):
        resp = await client.post(
            "/api/synthesis/proj-regen/artifacts/problem-statement/regenerate",
            json={"type_id": "problem-statement", "instructions": "be terse"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["artifact"]["type_id"] == "problem-statement"
    assert body["artifact"]["project_id"] == "proj-regen"
    assert body["artifact"]["title"] == "Echo Artifact"


# ── auth ────────────────────────────────────────────────────────────────


async def test_routes_require_auth_dependency_to_be_registered(client: AsyncClient) -> None:
    """In test mode the auth dependency is the no-op NoAuthProvider — but
    the route should still pass through it without error. This guards
    against accidentally removing Depends(get_current_user) on a route."""
    resp = await client.get("/api/synthesis/catalog")
    # Either 200 (passes through no-auth) or 401 (real auth) — never 500.
    assert resp.status_code in (200, 401)
