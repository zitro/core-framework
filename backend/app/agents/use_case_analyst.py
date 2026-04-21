"""Use Case Analyst — distils discovery data into structured use cases."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.registry import register
from app.models.core import UseCaseVersion

logger = logging.getLogger(__name__)

SYSTEM = (
    "You are the Use Case Analyst, a specialist sub-agent in the CORE "
    "Discovery Framework. You operate in the design-thinking Define stage. "
    "Your job is to listen to everything the discovery team has collected — "
    "transcripts, evidence, sensemaking questions, local documents — and "
    "distil it into a crisp, structured use case that a product team can "
    "rally behind.\n\n"
    "Use jobs-to-be-done framing for the goal: 'When [situation], the "
    "persona wants to [motivation] so they can [outcome].' Define success "
    "metrics BEFORE the work starts. Stay in problem space; never jump to "
    "solutions.\n\n"
    "Return JSON with this exact format:\n"
    "{\n"
    '  "title": "concise use case title",\n'
    '  "persona": "who is the primary user/beneficiary",\n'
    '  "goal": "what they are trying to achieve",\n'
    '  "current_state": "how they do it today and what is broken",\n'
    '  "desired_state": "what the ideal outcome looks like",\n'
    '  "business_value": "qualitative value proposition (1-2 sentences)",\n'
    '  "business_impact": "quantitative or measurable impact statement",\n'
    '  "success_metrics": ["metric 1", "metric 2", "metric 3"],\n'
    '  "summary": "2-3 paragraph narrative tying everything together"\n'
    "}"
)


class UseCaseAnalyst(BaseAgent):
    meta = AgentMeta(
        agent_id="use-case-analyst",
        name="Use Case Analyst",
        role="Distils discovery data into structured use cases with clear business value.",
        description=(
            "Synthesises transcripts, evidence, and sensemaking into a "
            "use case definition with persona, goal, current/desired "
            "state, business value, impact, and success metrics."
        ),
        icon="Briefcase",
        phase="orient",
        expertise=[
            "use case definition",
            "business value analysis",
            "persona identification",
            "impact measurement",
        ],
    )
    system_prompt = SYSTEM
    collection = "use_cases"
    requires_review = True

    async def run(
        self, discovery_id: str, user_instructions: str = "", **kwargs: Any
    ) -> AgentResult:
        context = await self._context(discovery_id)
        if not context.strip():
            raise HTTPException(
                status_code=422,
                detail="No context yet. Add evidence or transcripts first.",
            )

        version_num = await self._next_version(discovery_id)

        user_block = ""
        if user_instructions:
            user_block = f"\n\nUser guidance for this version:\n{user_instructions}"

        user_prompt = (
            f"Here is everything we know about this discovery:\n\n"
            f"{context}{user_block}\n\n"
            f"Synthesize a use case (version {version_num}).\n"
            f"Return JSON with: title, persona, goal, current_state, "
            f"desired_state, business_value, business_impact, "
            f"success_metrics, summary."
        )

        try:
            result = await self._llm().complete_json(self.system_prompt, user_prompt)
        except Exception:
            logger.exception("Use Case Analyst LLM call failed")
            raise HTTPException(status_code=502, detail="AI service unavailable")

        version = UseCaseVersion(
            discovery_id=discovery_id,
            version=version_num,
            title=result.get("title", ""),
            persona=result.get("persona", ""),
            goal=result.get("goal", ""),
            current_state=result.get("current_state", ""),
            desired_state=result.get("desired_state", ""),
            business_value=result.get("business_value", ""),
            business_impact=result.get("business_impact", ""),
            success_metrics=result.get("success_metrics", []),
            summary=result.get("summary", ""),
            user_instructions=user_instructions,
            context_used=context[:2000],
        )

        try:
            saved = await self._save(version.model_dump(mode="json"))
        except Exception:
            logger.exception("Failed to persist use case version")
            raise HTTPException(status_code=500, detail="Failed to save")

        return AgentResult(
            agent_id=self.meta.agent_id,
            agent_name=self.meta.name,
            data=saved,
        )


use_case_analyst = register(UseCaseAnalyst())
