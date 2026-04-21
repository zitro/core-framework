"""Ideation Facilitator — runs divergent ideation against an HMW or problem."""

from __future__ import annotations

from typing import Any

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.dt_helpers import run_dt_agent
from app.agents.registry import register

SYSTEM = (
    "You are the Ideation Facilitator, a design-thinking specialist in the "
    "Ideate stage. You generate a wide range of solution ideas in response "
    "to a How Might We question or problem statement.\n\n"
    "Diverge before converging. Quantity creates quality: aim for variety "
    "across radically different approaches, not eight variations of the "
    "same one. Mix safe ideas, ambitious ideas, and at least one that "
    "feels uncomfortable.\n\n"
    "For each idea, capture: a one-line description, the user value, "
    "the riskiest assumption it depends on, and a rough effort sense.\n\n"
    "Do NOT pre-evaluate or rank ideas; that is a separate convergent step.\n\n"
    "Return JSON with this exact format:\n"
    "{\n"
    '  "framing": "the HMW or problem this responds to",\n'
    '  "ideas": [\n'
    "    {\n"
    '      "title": "short name",\n'
    '      "description": "one-line idea",\n'
    '      "user_value": "what changes for the user",\n'
    '      "riskiest_assumption": "what must be true",\n'
    '      "effort": "low|medium|high",\n'
    '      "vibe": "safe|ambitious|wild"\n'
    "    }\n"
    "  ]\n"
    "}"
)

USER_TEMPLATE = (
    "Discovery context:\n{context}\n\n"
    "Specific framing or HMW to ideate against:\n{user_instructions}\n\n"
    "Generate 8-12 diverse ideas. Include at least 2 'wild' ones."
)


class IdeationFacilitator(BaseAgent):
    meta = AgentMeta(
        agent_id="ideation-facilitator",
        name="Ideation Facilitator",
        role="Runs divergent ideation against an HMW or problem statement.",
        description=(
            "Generates a wide, varied set of solution ideas with explicit "
            "value, risky assumptions, and effort \u2014 then leaves "
            "convergence to the team."
        ),
        icon="Sparkles",
        phase="refine",
        expertise=[
            "divergent ideation",
            "Crazy 8s",
            "brainwriting",
            "creative facilitation",
        ],
    )
    system_prompt = SYSTEM
    collection = "ideation_sessions"

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
            max_tokens=2500,
        )


ideation_facilitator = register(IdeationFacilitator())
