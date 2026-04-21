"""Problem Analyst — synthesises context into evidence-backed problem statements."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.registry import register
from app.models.core import ProblemStatementVersion

logger = logging.getLogger(__name__)

SYSTEM = (
    "You are the Problem Analyst, a specialist sub-agent in the CORE "
    "Discovery Framework. You synthesize all available context — "
    "transcript analyses, evidence, sensemaking questions, local "
    "documents — into a clear, evidence-backed problem statement.\n\n"
    "A strong problem statement answers:\n"
    "- WHO is affected?\n"
    "- WHAT do they need?\n"
    "- WHY does the problem exist (root cause)?\n"
    "- IMPACT: what happens if it's solved?\n\n"
    "The output should be specific, grounded in evidence, and avoid "
    "solution-jumping.\n\n"
    "Return JSON with this exact format:\n"
    "{\n"
    '  "who": "the specific user group or persona affected",\n'
    '  "what": "what they need or the unmet need",\n'
    '  "why": "root cause or systemic reason",\n'
    '  "impact": "measurable outcome if solved",\n'
    '  "statement": "A single-paragraph problem statement tying it all '
    'together"\n'
    "}"
)


class ProblemAnalyst(BaseAgent):
    meta = AgentMeta(
        agent_id="problem-analyst",
        name="Problem Analyst",
        role="Synthesises discovery context into evidence-backed problem statements.",
        description=(
            "Examines all evidence, transcripts, and sensemaking to "
            "produce a structured problem statement identifying who is "
            "affected, what they need, root cause, and measurable impact."
        ),
        icon="Target",
        phase="orient",
        expertise=[
            "problem framing",
            "root cause analysis",
            "evidence synthesis",
            "impact quantification",
        ],
    )
    system_prompt = SYSTEM
    collection = "problem_statements"

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
            user_block = f"\n\nUser instructions for this version:\n{user_instructions}"

        user_prompt = (
            f"Here is everything we know about this discovery:\n\n"
            f"{context}{user_block}\n\n"
            f"Synthesize a problem statement (version {version_num}).\n"
            f"Return JSON with: who, what, why, impact, statement."
        )

        try:
            result = await self._llm().complete_json(self.system_prompt, user_prompt)
        except Exception:
            logger.exception("Problem Analyst LLM call failed")
            raise HTTPException(status_code=502, detail="AI service unavailable")

        version = ProblemStatementVersion(
            discovery_id=discovery_id,
            version=version_num,
            who=result.get("who", ""),
            what=result.get("what", ""),
            why=result.get("why", ""),
            impact=result.get("impact", ""),
            statement=result.get("statement", ""),
            user_instructions=user_instructions,
            context_used=context[:2000],
        )

        try:
            saved = await self._save(version.model_dump(mode="json"))
        except Exception:
            logger.exception("Failed to persist problem statement")
            raise HTTPException(status_code=500, detail="Failed to save problem statement")

        # Also update the discovery's problem_statement field
        try:
            storage = self._storage()
            await storage.update(
                "discoveries",
                discovery_id,
                {
                    "problem_statement": {
                        "who": version.who,
                        "what": version.what,
                        "why": version.why,
                        "impact": version.impact,
                        "statement": version.statement,
                        "confidence": "assumed",
                    }
                },
            )
        except Exception:
            logger.debug("Could not update discovery problem_statement")

        return AgentResult(
            agent_id=self.meta.agent_id,
            agent_name=self.meta.name,
            data=saved,
        )


problem_analyst = register(ProblemAnalyst())
