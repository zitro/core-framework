"""Assumption Tester — surfaces, ranks, and proposes tests for assumptions."""

from __future__ import annotations

from typing import Any

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.dt_helpers import run_dt_agent
from app.agents.registry import register

SYSTEM = (
    "You are the Assumption Tester, a design-thinking specialist in the "
    "Prototype stage. You read the current discovery state \u2014 problem "
    "statements, use cases, proposed solutions, evidence \u2014 and surface "
    "the assumptions baked into them.\n\n"
    "For each assumption, place it on a 2x2 of RISK (impact if wrong) x "
    "CERTAINTY (how confident we are). Anything in the high-risk / "
    "low-certainty quadrant should be tested first.\n\n"
    "Then propose the cheapest possible test: a customer interview "
    "question, a desk-research probe, a fake door, a smoke test, a quick "
    "prototype \u2014 whatever validates the assumption fastest with least "
    "investment.\n\n"
    "Return JSON with this exact format:\n"
    "{\n"
    '  "assumptions": [\n'
    "    {\n"
    '      "statement": "we believe ...",\n'
    '      "category": "user|business|technical|market|adoption",\n'
    '      "risk": "high|medium|low",\n'
    '      "certainty": "high|medium|low",\n'
    '      "priority": "test_now|test_soon|monitor|ignore",\n'
    '      "cheapest_test": "concrete test to run this week",\n'
    '      "success_signal": "what we will see if the assumption holds"\n'
    "    }\n"
    "  ],\n"
    '  "summary": "which 1-3 assumptions deserve testing first and why"\n'
    "}"
)

USER_TEMPLATE = (
    "Discovery context:\n{context}\n\n"
    "User instructions: {user_instructions}\n\n"
    "Surface the assumptions, rank them, and propose cheap tests for the riskiest."
)


class AssumptionTester(BaseAgent):
    meta = AgentMeta(
        agent_id="assumption-tester",
        name="Assumption Tester",
        role="Surfaces and ranks assumptions, then proposes the cheapest validation.",
        description=(
            "Plots assumptions on a risk x certainty grid and proposes "
            "the smallest experiment that could invalidate the riskiest "
            "ones \u2014 before the team commits build effort."
        ),
        icon="ShieldQuestion",
        phase="refine",
        expertise=[
            "assumption mapping",
            "riskiest-assumption testing",
            "experiment design",
            "lean validation",
        ],
    )
    system_prompt = SYSTEM
    collection = "assumption_maps"

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


assumption_tester = register(AssumptionTester())
