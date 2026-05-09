"""Background technology research enrichment for discovery targets."""

from __future__ import annotations

import logging
import re
from typing import Any

from app.models.core import CorePhase, Evidence, EvidenceType, TechnologyTarget
from app.providers.llm import get_llm_provider
from app.providers.search import SearchResult, get_search_provider
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create

logger = logging.getLogger(__name__)

_RESULTS_PER_QUERY = 4
_MAX_RESULTS = 12
_TECH_RESEARCH_TAG = "technology-research"


def technology_target_key(target: TechnologyTarget | dict[str, Any]) -> str:
    """Return a stable comparison key for a technology target."""
    if isinstance(target, TechnologyTarget):
        name = target.name
        focus = target.focus
    else:
        name = str(target.get("name", ""))
        focus = str(target.get("focus", ""))
    return f"{name.strip().lower()}|{focus.strip().lower()}"


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:64] or "technology"


def _research_fingerprint(target: TechnologyTarget) -> str:
    return f"tech-research:{_slug(target.name)}:{_slug(target.focus or 'general')}"


def _queries_for_target(target: TechnologyTarget) -> list[str]:
    base = target.name.strip()
    focus = target.focus.strip()
    scoped = f"{base} {focus}" if focus else base
    return [
        f"{scoped} overview common use cases",
        f"{scoped} pros cons limitations",
        f"{scoped} alternatives compared",
    ]


async def _collect_search_results(target: TechnologyTarget) -> list[SearchResult]:
    search = get_search_provider()
    if not search.enabled:
        return []

    results: list[SearchResult] = []
    seen: set[str] = set()
    for query in _queries_for_target(target):
        try:
            hits = await search.search(query, limit=_RESULTS_PER_QUERY)
        except Exception:
            logger.warning("Technology research search failed for %s", query, exc_info=True)
            continue
        for hit in hits:
            if hit.url in seen:
                continue
            seen.add(hit.url)
            results.append(hit)
            if len(results) >= _MAX_RESULTS:
                return results
    return results


async def _synthesize_research(target: TechnologyTarget, results: list[SearchResult]) -> str:
    source_lines = [
        f"- {item.title}: {item.snippet} ({item.url})" for item in results if item.snippet.strip()
    ]
    if not source_lines:
        return _fallback_content(target, results)

    system_prompt = (
        "You synthesize technology research for product discovery teams. "
        "Use only the provided search snippets. Be concise, neutral, and practical. "
        "Do not invent claims that are not supported by the snippets."
    )
    user_prompt = f"""Technology: {target.name}
Focus: {target.focus or "general"}

Search snippets:
{chr(10).join(source_lines)}

Return markdown with these exact sections:
## What It Is
## What People Use It For
## What People Are Saying
## Pros
## Cons / Watchouts
## Related Technologies And Alternatives
## Sources

Keep each section short. Under Sources, include markdown bullets with source title and URL.
"""
    try:
        return (await get_llm_provider().complete(system_prompt, user_prompt)).strip()
    except Exception:
        logger.warning("Technology research synthesis failed for %s", target.name, exc_info=True)
        return _fallback_content(target, results)


def _fallback_content(target: TechnologyTarget, results: list[SearchResult]) -> str:
    title = target.name.strip()
    focus = target.focus.strip()
    lines = [
        "## What It Is",
        f"Background research for {title}{f' with focus on {focus}' if focus else ''}.",
        "",
        "## What People Use It For",
        "Review the linked sources below for common patterns, use cases, and adoption context.",
        "",
        "## What People Are Saying",
        "The search snippets below capture external descriptions and commentary for "
        "discovery review.",
        "",
        "## Pros",
        "- Identify advantages from source snippets before using this in downstream "
        "recommendations.",
        "",
        "## Cons / Watchouts",
        "- Validate limitations, tradeoffs, licensing, operational burden, and fit for "
        "this project context.",
        "",
        "## Related Technologies And Alternatives",
        "- Compare against adjacent tools, platforms, and implementation patterns "
        "mentioned in the sources.",
        "",
        "## Sources",
    ]
    if not results:
        lines.append(
            "- No search results were available. Configure SEARCH_PROVIDER to enable "
            "source-backed research."
        )
    else:
        for item in results:
            snippet = f" — {item.snippet}" if item.snippet else ""
            lines.append(f"- [{item.title}]({item.url}){snippet}")
    return "\n".join(lines)


async def enrich_technology_target(discovery_id: str, target: TechnologyTarget) -> None:
    """Research a technology target and persist the result as Orchestrate evidence."""
    if not discovery_id or not target.name.strip():
        return

    storage = get_storage_provider()
    fingerprint = _research_fingerprint(target)
    try:
        existing = await storage.list("evidence", {"discovery_id": discovery_id})
        if any(fingerprint in (item.get("tags") or []) for item in existing):
            return

        discovery = await storage.get("discoveries", discovery_id)
        results = await _collect_search_results(target)
        content = await _synthesize_research(target, results)
        evidence = Evidence(
            discovery_id=discovery_id,
            project_id=str((discovery or {}).get("project_id") or ""),
            phase=CorePhase.ORCHESTRATE,
            content=content,
            source=f"Technology research: {target.name}",
            evidence_type=EvidenceType.INSIGHT,
            tags=[
                _TECH_RESEARCH_TAG,
                fingerprint,
                f"technology:{_slug(target.name)}",
                "auto-generated",
            ],
        )
        await storage.create("evidence", stamp_create(evidence.model_dump(mode="json")))
    except Exception:
        logger.exception("Technology enrichment failed for discovery %s", discovery_id)
