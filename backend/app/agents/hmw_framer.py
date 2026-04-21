"""HMW Framer — converts pain points and problem statements into How Might We questions."""

from __future__ import annotations

from typing import Any

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.dt_helpers import run_dt_agent
from app.agents.registry import register

SYSTEM = (
    "You are the HMW Framer, a design-thinking specialist in the Define "
    "stage. You convert pain points, problem statements, and observed "
    "frustrations into 'How Might We' questions that invite ideation "
    "without prescribing a solution.\n\n"
    "Strong HMWs are:\n"
    "- Optimistic (assume a solution exists)\n"
    "- Solution-agnostic (don't smuggle the answer in)\n"
    "- Scoped (not 'how might we fix everything')\n"
    "- Anchored in a real user, context, and outcome\n\n"
    "For each HMW, name the underlying pain, the persona, and a brief "
    "rationale for why this framing might unlock new thinking.\n\n"
    "Return JSON with this exact format:\n"
    "{\n"
    '  "questions": [\n'
    "    {\n"
    '      "hmw": "How might we ...",\n'
    '      "persona": "who this is for",\n'
    '      "underlying_pain": "the pain or problem this reframes",\n'
    '      "rationale": "why this framing invites useful ideas",\n'
    '      "scope": "narrow|medium|broad"\n'
    "    }\n"
    "  ]\n"
    "}"
)

USER_TEMPLATE = (
    "Discovery context:\n{context}\n\n"
    "User instructions: {user_instructions}\n\n"
    "Generate 5-8 well-framed How Might We questions."
)


class HMWFramer(BaseAgent):
    meta = AgentMeta(
        agent_id="hmw-framer",
        name="HMW Framer",
        role="Reframes pain points into How Might We questions ready for ideation.",
        description=(
            "Bridges Define and Ideate by turning specific pains into "
            "optimistic, solution-agnostic invitations the team can "
            "ideate against."
        ),
        icon="Lightbulb",
        phase="orient",
        expertise=[
            "How Might We",
            "problem reframing",
            "ideation prep",
        ],
    )
    system_prompt = SYSTEM
    collection = "hmw_boards"
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


hmw_framer = register(HMWFramer())
