"""Shared helper to gather all discovery context for AI prompts."""

import logging

from app.providers.storage import get_storage_provider
from app.utils.engagement import read_engagement_context
from app.utils.local_docs import read_docs_content

logger = logging.getLogger(__name__)


async def gather_context(discovery_id: str) -> str:
    """Collect all available context for a discovery."""
    storage = get_storage_provider()
    parts: list[str] = []
    disc: dict | None = None

    # Discovery metadata
    try:
        disc = await storage.get("discoveries", discovery_id)
        if disc:
            parts.append(f"Discovery: {disc.get('name', '')} — {disc.get('description', '')}")
            ps = disc.get("problem_statement")
            if ps and ps.get("statement"):
                parts.append(f"Current problem statement: {ps['statement']}")
            assumptions = disc.get("assumptions", [])
            if assumptions:
                parts.append("Assumptions: " + "; ".join(a.get("text", "") for a in assumptions))
            providers = disc.get("solution_providers", [])
            if providers:
                parts.append("Target solution providers: " + ", ".join(providers))
    except Exception:
        logger.debug("Could not load discovery %s", discovery_id)

    # Evidence
    try:
        evidence = await storage.list("evidence", {"discoveryId": discovery_id})
        if not evidence:
            evidence = await storage.list("evidence", {"discovery_id": discovery_id})
        if evidence:
            items = [
                f"[{e.get('phase', '?')}/{e.get('confidence', '?')}] {e.get('content', '')}"
                for e in evidence
            ]
            parts.append("Evidence:\n" + "\n".join(items))
    except Exception:
        logger.debug("Could not load evidence for %s", discovery_id)

    # Transcript analyses
    try:
        analyses = await storage.list("transcript_analyses", {"discoveryId": discovery_id})
        if not analyses:
            analyses = await storage.list("transcript_analyses", {"discovery_id": discovery_id})
        for a in analyses:
            themes = ", ".join(a.get("key_themes", []))
            insights = "; ".join(i.get("text", "") for i in a.get("insights", [])[:5])
            parts.append(f"Transcript analysis — themes: {themes}; insights: {insights}")
    except Exception:
        logger.debug("Could not load transcript analyses for %s", discovery_id)

    # Question sets and answers
    try:
        qsets = await storage.list("question_sets", {"discoveryId": discovery_id})
        if not qsets:
            qsets = await storage.list("question_sets", {"discovery_id": discovery_id})
        for qs in qsets:
            phase = qs.get("phase", "?")
            ctx = qs.get("context", "")
            if ctx:
                parts.append(f"Question context ({phase} phase): {ctx}")
    except Exception:
        logger.debug("Could not load question sets for %s", discovery_id)

    # Refine expert reviews
    try:
        reviews = await storage.list("refine_reviews", {"discoveryId": discovery_id})
        if not reviews:
            reviews = await storage.list("refine_reviews", {"discovery_id": discovery_id})
        for review in reviews[-2:]:
            synthesis = review.get("synthesis", {})
            direction = synthesis.get("recommended_direction", "")
            gate = synthesis.get("decision_gate", "")
            assumptions = []
            for opinion in review.get("opinions", []):
                assumptions.extend(opinion.get("assumptions", [])[:3])
            if direction or assumptions:
                parts.append(
                    "Refine expert review — "
                    f"decision gate: {gate}; recommended direction: {direction}; "
                    f"assumptions to validate: {'; '.join(assumptions[:8])}"
                )
    except Exception:
        logger.debug("Could not load refine reviews for %s", discovery_id)

    # Local project documents
    try:
        if not disc:
            disc = await storage.get("discoveries", discovery_id)
        docs_path = (disc or {}).get("docs_path", "")
        if docs_path:
            content = read_docs_content(docs_path)
            if content:
                parts.append(f"Project documents:\n{content}")
    except Exception:
        logger.debug("Could not load local docs for %s", discovery_id)

    # Engagement repo notes
    try:
        if not disc:
            disc = await storage.get("discoveries", discovery_id)
        repo_paths: list[str] = []
        for source in (disc or {}).get("engagement_sources", []) or []:
            value = str((source or {}).get("value", "")).strip()
            if value and value not in repo_paths:
                repo_paths.append(value)
        for candidate in (disc or {}).get("engagement_repo_paths", []) or []:
            value = str(candidate).strip()
            if value and value not in repo_paths:
                repo_paths.append(value)
        legacy_path = str((disc or {}).get("engagement_repo_path", "")).strip()
        if legacy_path and legacy_path not in repo_paths:
            repo_paths.append(legacy_path)

        for engagement_path in repo_paths:
            engagement_ctx = read_engagement_context(engagement_path)
            if engagement_ctx:
                parts.append(engagement_ctx)
    except Exception:
        logger.debug("Could not load engagement notes for %s", discovery_id)

    return "\n\n".join(parts)


async def get_solution_providers(discovery_id: str) -> list[str]:
    """Return the configured solution providers for a discovery."""
    storage = get_storage_provider()
    try:
        disc = await storage.get("discoveries", discovery_id)
        providers = (disc or {}).get("solution_providers", [])
        if providers:
            return providers
    except Exception:
        pass
    return []
