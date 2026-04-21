"""Solution Architect — proposes technology solutions constrained to providers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.registry import register
from app.models.core import SolutionBlueprint
from app.utils.context import get_solution_providers

logger = logging.getLogger(__name__)

SYSTEM = (
    "You are the Solution Architect, a specialist sub-agent in the CORE "
    "Discovery Framework. You operate in the design-thinking Prototype / "
    "Test stage — you translate validated direction into a buildable "
    "approach focused on the smallest valuable thing.\n\n"
    "You think about:\n"
    "- Which services or products solve each piece of the problem\n"
    "- How the pieces connect into a coherent architecture\n"
    "- A quick-win the customer can see working in 1-2 weeks\n"
    "- The riskiest assumption embedded in the proposal and how to test it cheaply\n"
    "- Open questions that still need answers\n"
    "- Follow-up questions to ask the customer for clarity\n"
    "- Rough effort estimation\n\n"
    "You ONLY recommend services from the specified target providers.\n\n"
    "Return JSON with this exact format:\n"
    "{\n"
    '  "approach_title": "short title for this solution approach",\n'
    '  "approach_summary": "2-3 paragraph description of the approach",\n'
    '  "services": [\n'
    '    {"service": "Service Name", "purpose": "what it solves",\n'
    '     "rationale": "why this over alternatives"}\n'
    "  ],\n"
    '  "architecture_overview": "text description of how pieces connect",\n'
    '  "quick_win_suggestion": "what can be demo\'d in 1-2 weeks",\n'
    '  "estimated_effort": "rough T-shirt size and timeline",\n'
    '  "open_questions": ["question about unknowns"],\n'
    '  "follow_up_questions": ["question to ask the customer next"]\n'
    "}"
)


class SolutionArchitectAgent(BaseAgent):
    meta = AgentMeta(
        agent_id="solution-architect",
        name="Solution Architect",
        role="Architects technology solutions constrained to target providers.",
        description=(
            "Takes the discovery context and proposes a concrete solution "
            "approach with specific services, architecture overview, "
            "quick wins, and follow-up questions — all scoped to the "
            "configured solution providers."
        ),
        icon="Cpu",
        phase="refine",
        expertise=[
            "solution architecture",
            "technology selection",
            "quick-win identification",
            "effort estimation",
            "follow-up questions",
        ],
    )
    system_prompt = SYSTEM
    collection = "solution_blueprints"

    async def run(
        self, discovery_id: str, user_instructions: str = "", **kwargs: Any
    ) -> AgentResult:
        context = await self._context(discovery_id)
        if not context.strip():
            raise HTTPException(
                status_code=422,
                detail="No context yet. Add evidence or transcripts first.",
            )

        providers = await get_solution_providers(discovery_id)
        provider_str = ", ".join(providers)
        version_num = await self._next_version(discovery_id)

        user_block = ""
        if user_instructions:
            user_block = f"\n\nUser guidance for this version:\n{user_instructions}"

        user_prompt = (
            f"Discovery context:\n\n{context}{user_block}\n\n"
            f"Target technology providers: {provider_str}\n"
            f"Propose services and architecture ONLY from these providers.\n\n"
            f"Generate solution blueprint version {version_num}."
        )

        try:
            result = await self._llm().complete_json(self.system_prompt, user_prompt)
        except Exception:
            logger.exception("Solution Architect LLM call failed")
            raise HTTPException(status_code=502, detail="AI service unavailable")

        blueprint = SolutionBlueprint(
            discovery_id=discovery_id,
            version=version_num,
            approach_title=result.get("approach_title", ""),
            approach_summary=result.get("approach_summary", ""),
            services=[
                {
                    "service": s.get("service", ""),
                    "purpose": s.get("purpose", ""),
                    "rationale": s.get("rationale", ""),
                }
                for s in result.get("services", [])
            ],
            architecture_overview=result.get("architecture_overview", ""),
            quick_win_suggestion=result.get("quick_win_suggestion", ""),
            estimated_effort=result.get("estimated_effort", ""),
            open_questions=result.get("open_questions", []),
            follow_up_questions=result.get("follow_up_questions", []),
            target_providers=providers,
            user_instructions=user_instructions,
            context_used=context[:2000],
        )

        try:
            saved = await self._save(blueprint.model_dump(mode="json"))
        except Exception:
            logger.exception("Failed to persist solution blueprint")
            raise HTTPException(status_code=500, detail="Failed to save")

        return AgentResult(
            agent_id=self.meta.agent_id,
            agent_name=self.meta.name,
            data=saved,
        )


solution_architect = register(SolutionArchitectAgent())
