"""Empathy Researcher — synthesizes interviews/transcripts into an empathy map."""

from __future__ import annotations

from typing import Any

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.dt_helpers import run_dt_agent
from app.agents.registry import register

SYSTEM = (
    "You are the Empathy Researcher, a design-thinking specialist in the "
    "Empathize stage of the CORE framework. You read raw interview "
    "transcripts, evidence, and notes and synthesize them into an "
    "empathy map for a primary persona.\n\n"
    "An empathy map captures four quadrants:\n"
    "- SAYS: verbatim quotes (use real wording from the source)\n"
    "- THINKS: inferred beliefs and concerns\n"
    "- DOES: observed behaviours and routines\n"
    "- FEELS: emotional state, frustrations, motivations\n"
    "Plus PAINS (top friction) and GAINS (what success looks like).\n\n"
    "Stay grounded in the supplied evidence. If a quadrant lacks "
    "evidence, return an empty array rather than inventing content.\n\n"
    "Return JSON with this exact format:\n"
    "{\n"
    '  "persona": "name or short descriptor of the persona",\n'
    '  "says": ["quote 1", "quote 2"],\n'
    '  "thinks": ["..."],\n'
    '  "does": ["..."],\n'
    '  "feels": ["..."],\n'
    '  "pains": ["..."],\n'
    '  "gains": ["..."],\n'
    '  "summary": "1-2 sentences naming the dominant theme"\n'
    "}"
)

USER_TEMPLATE = (
    "Discovery context:\n{context}\n\n"
    "User instructions: {user_instructions}\n\n"
    "Build an empathy map for the most prominent persona."
)


class EmpathyResearcher(BaseAgent):
    meta = AgentMeta(
        agent_id="empathy-researcher",
        name="Empathy Researcher",
        role="Synthesises interviews and evidence into an empathy map for a persona.",
        description=(
            "Reads transcripts and evidence and produces a says/thinks/"
            "does/feels empathy map plus pains and gains, grounded in "
            "verbatim quotes."
        ),
        icon="HeartHandshake",
        phase="capture",
        expertise=[
            "empathy mapping",
            "interview synthesis",
            "verbatim quote extraction",
            "persona research",
        ],
    )
    system_prompt = SYSTEM
    collection = "empathy_maps"
    requires_review = True

    async def run(
        self,
        discovery_id: str,
        user_instructions: str = "",
        **kwargs: Any,
    ) -> AgentResult:
        return await run_dt_agent(
            self,
            discovery_id=discovery_id,
            system_prompt=self.system_prompt,
            user_prompt_template=USER_TEMPLATE,
            user_instructions=user_instructions,
        )


empathy_researcher = register(EmpathyResearcher())
