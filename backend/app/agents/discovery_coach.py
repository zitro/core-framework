"""Discovery Coach — generates phase-appropriate discovery questions."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.registry import register
from app.models.core import CorePhase, Question, QuestionSet
from app.utils.local_docs import read_docs_content

logger = logging.getLogger(__name__)

PHASE_PROMPTS = {
    CorePhase.CAPTURE: (
        "You are the Discovery Coach operating in the Capture phase, the\n"
        "design-thinking Empathize stage.\n"
        "Generate questions that help the team:\n"
        "- Map the stakeholder ecosystem\n"
        "- Understand current workflows and pain points (use direct observation prompts)\n"
        "- Surface jobs-to-be-done: When [situation], I want [motivation], "
        "so I can [outcome]\n"
        "- Gather raw evidence and verbatim quotes before forming opinions\n"
        "- Identify who is affected and how\n"
        "Use empathy-map framing (say / think / do / feel) when appropriate.\n"
        "Focus on LISTENING and PROBING. Avoid leading questions."
    ),
    CorePhase.ORIENT: (
        "You are the Discovery Coach operating in the Orient phase, the\n"
        "design-thinking Define stage.\n"
        "Generate sensemaking questions that help the team:\n"
        "- Cluster evidence into themes (affinity mapping)\n"
        "- Push from symptom to root cause using 5 Whys\n"
        "- Frame the real problem as a 'How Might We...' invitation\n"
        "- Build personas and journey maps from the evidence\n"
        "- Challenge assumptions with 'what if we are wrong about...'\n"
        "Focus on PATTERN RECOGNITION and FRAMING."
    ),
    CorePhase.REFINE: (
        "You are the Discovery Coach operating in the Refine phase, the\n"
        "design-thinking Ideate / Prototype stage.\n"
        "Generate solution exploration questions that help the team:\n"
        "- Diverge widely before converging (Crazy 8s, brainwriting)\n"
        "- Name and rank assumptions by risk and certainty\n"
        "- Design the cheapest test for the riskiest assumption\n"
        "- Evaluate solutions against real evidence, not preference\n"
        "- Match problems to existing capabilities\n"
        "Focus on VALIDATING and SIMULATING."
    ),
    CorePhase.EXECUTE: (
        "You are the Discovery Coach operating in the Execute phase, the\n"
        "design-thinking Test / Deliver stage.\n"
        "Generate execution planning questions that help the team:\n"
        "- Identify the ONE quick win that proves value in weeks, not months\n"
        "- Define success metrics BEFORE the work starts\n"
        "- Plan the blocker remediation roadmap with named owners\n"
        "- Design the retro and learning loop\n"
        "- Prepare the RPI handoff\n"
        "Focus on DELIVERING and MOBILISING."
    ),
}


class DiscoveryCoach(BaseAgent):
    meta = AgentMeta(
        agent_id="discovery-coach",
        name="Discovery Coach",
        role="Generates phase-appropriate discovery questions to guide customer conversations.",
        description=(
            "Adapts its questioning style to the current CORE phase — "
            "probing in Capture, pattern-seeking in Orient, validating "
            "in Refine, and mobilising in Execute."
        ),
        icon="MessageCircleQuestion",
        phase="capture",
        expertise=[
            "discovery questioning",
            "stakeholder interviews",
            "sensemaking",
            "assumption testing",
        ],
    )
    system_prompt = ""  # selected per-phase at runtime
    collection = "question_sets"

    async def run(
        self,
        discovery_id: str,
        user_instructions: str = "",
        *,
        phase: CorePhase = CorePhase.CAPTURE,
        context: str = "",
        num_questions: int = 8,
        **kwargs: Any,
    ) -> AgentResult:
        system_prompt = PHASE_PROMPTS[phase]

        # Include local docs if configured
        docs_context = ""
        try:
            storage = self._storage()
            disc = await storage.get("discoveries", discovery_id)
            docs_path = (disc or {}).get("docs_path", "")
            if docs_path:
                content = read_docs_content(docs_path)
                if content:
                    docs_context = f"\n\nProject documents:\n{content}"
        except Exception:
            pass

        user_prompt = (
            f"Context about this discovery engagement:\n"
            f"{context}{docs_context}\n\n"
            f"Generate {num_questions} questions for the "
            f"{phase.value} phase.\n"
            f"Return JSON with format:\n"
            f'{{"questions": [{{"text": "...", "purpose": "...", '
            f'"follow_ups": ["..."]}}]}}'
        )

        try:
            result = await self._llm().complete_json(system_prompt, user_prompt)
        except Exception:
            logger.exception("Discovery Coach LLM call failed")
            raise HTTPException(status_code=502, detail="AI service unavailable")

        raw_questions = result.get("questions", [])
        questions = [
            Question(
                text=q.get("text", ""),
                purpose=q.get("purpose", ""),
                follow_ups=q.get("follow_ups", []),
            )
            for q in raw_questions
            if q.get("text")
        ]

        question_set = QuestionSet(
            discovery_id=discovery_id,
            phase=phase,
            context=context,
            questions=questions,
        )

        try:
            saved = await self._save(question_set.model_dump(mode="json"))
        except Exception:
            logger.exception("Failed to persist question set")
            raise HTTPException(status_code=500, detail="Failed to save questions")

        return AgentResult(
            agent_id=self.meta.agent_id,
            agent_name=self.meta.name,
            data=saved,
        )


discovery_coach = register(DiscoveryCoach())
