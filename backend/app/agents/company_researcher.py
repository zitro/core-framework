"""Company Researcher — synthesises a company profile from web search + LLM."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.registry import register
from app.providers.search import get_search_provider

logger = logging.getLogger(__name__)

SYSTEM = (
    "You are the Company Researcher, an FDE-grade analyst that builds a "
    "structured company profile from public web evidence and the discovery "
    "context. Stay grounded in the supplied snippets; do not invent facts.\n\n"
    "Return JSON with this exact shape:\n"
    "{\n"
    '  "company": "official company name",\n'
    '  "industry": "primary industry / sector",\n'
    '  "headquarters": "city, country if known",\n'
    '  "size_estimate": "employees / revenue band if known",\n'
    '  "summary": "3-5 sentence neutral description of the business",\n'
    '  "strategic_priorities": ["..."],\n'
    '  "products_services": ["..."],\n'
    '  "competitive_landscape": ["..."],\n'
    '  "recent_news": [{"title": "...", "url": "...", "date": "..."}],\n'
    '  "open_questions": ["follow-ups to validate with the customer"],\n'
    '  "sources": [{"title": "...", "url": "..."}]\n'
    "}\n"
    "Mark anything you are unsure about as an open question rather than "
    "asserting it."
)


class CompanyResearcher(BaseAgent):
    meta = AgentMeta(
        agent_id="company-researcher",
        name="Company Researcher",
        role="Builds a company profile from web search and discovery context.",
        description=(
            "Runs the configured search provider against the company name, "
            "feeds snippets to the LLM, and produces a structured profile "
            "with priorities, products, competitors, news, and sources."
        ),
        icon="Building2",
        phase="capture",
        expertise=[
            "company research",
            "competitive landscape",
            "industry analysis",
            "news synthesis",
        ],
    )
    system_prompt = SYSTEM
    collection = "company_profiles"
    requires_review = True

    async def run(
        self,
        discovery_id: str,
        user_instructions: str = "",
        **kwargs: Any,
    ) -> AgentResult:
        company = (kwargs.get("company") or user_instructions or "").strip()
        if not company:
            raise HTTPException(
                status_code=422,
                detail="company name required (pass `company` or use user_instructions)",
            )

        search = get_search_provider()
        snippets: list[dict] = []
        if search.enabled:
            try:
                results = await search.search(company, limit=8)
                snippets = [
                    {"title": r.title, "url": r.url, "snippet": r.snippet}
                    for r in results
                ]
            except Exception:  # noqa: BLE001
                logger.warning("Company search failed for %s", company, exc_info=True)

        context = await self._context(discovery_id) if discovery_id else ""
        snippet_block = (
            "\n".join(f"- {s['title']} <{s['url']}>\n  {s['snippet']}" for s in snippets)
            or "(search disabled or no results)"
        )

        user_prompt = (
            f"Company: {company}\n\n"
            f"User instructions: {user_instructions or '(none)'}\n\n"
            f"Web search snippets:\n{snippet_block}\n\n"
            f"Discovery context:\n{context or '(none)'}"
        )

        try:
            result = await self._llm().complete_json(
                self.system_prompt, user_prompt, max_tokens=2500
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Company Researcher LLM call failed")
            raise HTTPException(status_code=502, detail="AI service unavailable") from exc

        # Always include the raw sources we sent so the UI can show provenance.
        if isinstance(result, dict):
            result.setdefault(
                "sources",
                [{"title": s["title"], "url": s["url"]} for s in snippets],
            )

        payload = {
            "discovery_id": discovery_id,
            "agent_id": self.meta.agent_id,
            "company": company,
            "user_instructions": user_instructions,
            "result": result,
        }
        try:
            saved = await self._save(payload)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to persist company profile")
            raise HTTPException(status_code=500, detail="Failed to save output") from exc

        return AgentResult(
            agent_id=self.meta.agent_id,
            agent_name=self.meta.name,
            data=saved,
        )


company_researcher = register(CompanyResearcher())
