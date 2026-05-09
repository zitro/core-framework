"""Refine router — expert advisory panel for validating Orchestrate handoff."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.models.core import (
    RefineAgentDefinition,
    RefineChatMessage,
    RefineAgentOpinion,
    RefineReview,
    RefineRoundtableTurn,
    RefineSolutionOption,
    RefineSynthesis,
    RefineWorkItem,
)
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create
from app.utils.context import gather_context
from app.utils.review_gate import auto_request_review

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


AGENT_DEFINITIONS: list[RefineAgentDefinition] = [
    RefineAgentDefinition(
        id="solution_architect",
        title="Solution Architect",
        role="Principal solution architect who turns validated discovery direction into an initial architecture candidate.",
        mission=(
            "Evaluate whether the Orchestrate handoff can become a coherent technical solution. "
            "Identify system boundaries, integration points, platform choices, non-functional concerns, "
            "and the smallest architecture that can prove value without overbuilding."
        ),
        goal=(
            "Create the first credible architecture point of view, identify the technical decisions that matter, "
            "and define the architecture questions needed before Execute packages the recommendation."
        ),
        review_lens=[
            "architecture fit to the problem and use case",
            "service boundaries, integrations, and data flows",
            "scalability, reliability, security, and operational complexity",
            "build-versus-buy and platform fit based on configured solution providers",
            "quick architecture candidate for the first useful version",
        ],
        expected_outputs=[
            "initial architecture candidate",
            "major architecture risks and tradeoffs",
            "recommended technical direction",
            "open architecture decisions",
        ],
        signature_questions=[
            "What is the smallest architecture that proves the use case?",
            "Where are the integration and data ownership boundaries?",
            "Which technical decisions would be expensive to reverse?",
        ],
        work_item_focus=[
            "architecture decision records",
            "integration mapping",
            "technical risk spikes",
            "non-functional requirement validation",
        ],
    ),
    RefineAgentDefinition(
        id="principal_engineer",
        title="Principal Software Engineer",
        role="Principal-level engineer who reviews implementation feasibility and technical execution risk.",
        mission=(
            "Pressure-test how this recommendation would actually be built. Identify complexity, sequencing, "
            "dependencies, API contracts, maintainability risks, unknowns, and what should be prototyped before commitment."
        ),
        goal=(
            "Translate the recommendation into build reality by finding implementation traps, sequencing constraints, "
            "missing contracts, and the engineering work items needed to reduce delivery uncertainty."
        ),
        review_lens=[
            "implementation feasibility and hidden complexity",
            "dependency, sequencing, and migration risk",
            "maintainability, testability, observability, and supportability",
            "API boundaries, data contracts, and failure modes",
            "engineering spikes needed before delivery planning",
        ],
        expected_outputs=[
            "implementation risk review",
            "engineering spike recommendations",
            "dependency map and sequencing warnings",
            "build confidence assessment",
        ],
        signature_questions=[
            "What would make this hard to build or maintain?",
            "Which dependencies need to be proven first?",
            "What should engineers spike before estimating delivery?",
        ],
        work_item_focus=[
            "engineering spikes",
            "dependency proof points",
            "API and data contract definition",
            "testability and observability tasks",
        ],
    ),
    RefineAgentDefinition(
        id="technical_program_manager",
        title="Technical Program Manager",
        role="Principal TPM who turns the direction into a delivery-ready decision path without creating final artifacts.",
        mission=(
            "Review the work for execution readiness. Identify milestones, dependencies, decision owners, rollout risks, "
            "stakeholder alignment gaps, and the validation gates needed before Execute generates formal communications."
        ),
        goal=(
            "Make the direction executable by identifying owners, decisions, gates, sequencing, dependencies, and the "
            "work items required before stakeholder-ready artifacts can be trusted."
        ),
        review_lens=[
            "delivery path, milestones, and decision gates",
            "stakeholder alignment and dependency ownership",
            "risks that affect schedule, scope, and adoption",
            "what must be resolved before docs, decks, and status updates are generated",
            "handoff quality for Execute",
        ],
        expected_outputs=[
            "delivery readiness assessment",
            "dependency and blocker review",
            "validation gates",
            "Execute handoff recommendations",
        ],
        signature_questions=[
            "Who needs to make which decision before Execute?",
            "What dependency could block the recommendation?",
            "What should be validated before a weekly update or executive memo claims progress?",
        ],
        work_item_focus=[
            "decision gates",
            "owner and dependency mapping",
            "milestone planning",
            "risk and blocker tracking",
        ],
    ),
    RefineAgentDefinition(
        id="principal_data_scientist",
        title="Principal Data Scientist",
        role="Principal-level data scientist who evaluates data, AI feasibility, measurement, and experimental risk.",
        mission=(
            "Determine whether the proposed AI, analytics, or data-driven direction is justified by the available evidence. "
            "Assess data availability, quality, labeling, evaluation metrics, privacy constraints, bias, and experiment design."
        ),
        goal=(
            "Judge the recommendation through data and experimentation: what can be measured, what data is missing, "
            "whether AI is justified, and which validation experiment should happen before commitment."
        ),
        review_lens=[
            "data availability, quality, freshness, and ownership",
            "model, analytics, or automation suitability",
            "evaluation metrics and experiment design",
            "bias, privacy, and governance concerns",
            "whether AI is necessary or a simpler workflow is stronger",
        ],
        expected_outputs=[
            "data and AI feasibility assessment",
            "measurement plan",
            "data risks and assumptions",
            "recommended validation experiment",
        ],
        signature_questions=[
            "What data proves the recommendation will work?",
            "What metric tells us the AI or analytics path is succeeding?",
            "Is AI justified, or is the problem better solved with process or software first?",
        ],
        work_item_focus=[
            "data readiness checks",
            "evaluation metric design",
            "experiment setup",
            "bias, privacy, and quality validation",
        ],
    ),
    RefineAgentDefinition(
        id="product_strategist",
        title="Product Strategist",
        role="Senior product strategist who tests whether the direction creates user and business value.",
        mission=(
            "Evaluate the problem/use case from a product and adoption lens. Challenge whether the target persona, value proposition, "
            "success metrics, prioritization, and recommended path are strong enough to warrant investment."
        ),
        goal=(
            "Clarify whether this is the right problem to solve now, who gets value first, what adoption risk exists, "
            "and which product decisions or experiments should shape the recommendation."
        ),
        review_lens=[
            "user value, business value, and prioritization",
            "persona fit and adoption risk",
            "success metric quality",
            "differentiation between urgent needs and interesting ideas",
            "recommendation strength against alternatives",
        ],
        expected_outputs=[
            "value and adoption assessment",
            "prioritization recommendation",
            "success metric critique",
            "product risks and pivots",
        ],
        signature_questions=[
            "Who gets measurable value first?",
            "What would make users ignore the solution?",
            "Is this the most valuable problem to solve now?",
        ],
        work_item_focus=[
            "persona and value validation",
            "prioritization decisions",
            "adoption risk testing",
            "success metric refinement",
        ],
    ),
    RefineAgentDefinition(
        id="security_compliance_advisor",
        title="Security and Compliance Advisor",
        role="Senior security and compliance advisor who reviews risk controls before recommendations are packaged.",
        mission=(
            "Identify security, privacy, compliance, data handling, access control, audit, retention, and operational risk. "
            "Clarify which controls or approvals are required before the recommendation can move into Execute."
        ),
        goal=(
            "Protect the recommendation from avoidable governance failure by identifying data exposure, access, audit, "
            "approval, and control work items before the team packages the direction externally."
        ),
        review_lens=[
            "data classification, privacy, and retention",
            "identity, access control, and auditability",
            "security review requirements",
            "regulatory or contractual constraints",
            "risk controls needed before stakeholder-facing outputs",
        ],
        expected_outputs=[
            "security and compliance risk review",
            "control recommendations",
            "approval or policy dependencies",
            "privacy and audit concerns",
        ],
        signature_questions=[
            "What sensitive data might this touch?",
            "Who should be allowed to access the outputs and source material?",
            "What control must exist before this is recommended?",
        ],
        work_item_focus=[
            "privacy and data classification review",
            "access control definition",
            "audit and retention controls",
            "approval and policy dependency tracking",
        ],
    ),
]

AGENTS_BY_ID = {agent.id: agent for agent in AGENT_DEFINITIONS}

ROUNDTABLE_PHASES = [
    "initial_position",
    "evidence_challenge",
    "risk_and_work_items",
    "alignment_and_tradeoffs",
    "current_agreement",
]

ROUNDTABLE_PHASE_DESCRIPTIONS = {
    "initial_position": "Each agent states the role-specific opinion they arrived with.",
    "evidence_challenge": "Agents challenge weak evidence, missing facts, and unsupported leaps.",
    "risk_and_work_items": "Agents convert concerns into concrete questions and work items.",
    "alignment_and_tradeoffs": "Agents respond to each other and name tradeoffs.",
    "current_agreement": "Agents converge on the best shared agreement in the project's current state.",
}

REFINE_REVIEW_SYSTEM = """You are facilitating a Refine-stage expert advisory board.

The Refine phase receives the Orchestrate handoff: captured evidence, project understanding, problem framing, use case drafts, unresolved questions, assumptions, and any candidate solution signals.

Your job is not to create final reports, decks, emails, or stakeholder-ready artifacts. Those belong to Execute. Your job is to improve decision quality before Execute by having selected expert personas review the project from their professional lens.

Important rules:
- Do not reveal hidden chain-of-thought. Provide concise professional rationale, evidence references, tradeoffs, and decision impacts.
- Each selected agent must speak in a distinct expert voice and produce role-specific outputs.
- Each selected agent must create questions that they specifically need answered and work items that follow from their role.
- If multiple agents are selected, include a five-phase roundtable where agents learn from each other, revise their stance when another role adds useful evidence, and converge on the strongest current agreement.
- Challenge weak evidence, risky assumptions, premature architecture, and unsupported recommendations.
- Keep recommendations vendor-neutral unless the context explicitly names configured solution providers.
- Produce the smallest valuable validated direction, not a final implementation package.

The roundtable must include these five phases, using the phase field on every turn:
1. initial_position — each agent states the role-specific opinion they arrived with.
2. evidence_challenge — agents challenge weak evidence, missing facts, and unsupported leaps.
3. risk_and_work_items — agents convert concerns into concrete questions and work items.
4. alignment_and_tradeoffs — agents respond to each other and name tradeoffs.
5. current_agreement — agents converge on the best shared agreement in the project's current state.

Return JSON with this exact format:
{
  "opinions": [
    {
      "agent_id": "selected agent id",
      "role": "role title",
      "title": "short opinion title",
      "position": "clear 2-4 sentence expert position",
      "confidence": 0,
      "strengths": ["what is strong or well supported"],
      "concerns": ["specific concern grounded in the handoff"],
      "assumptions": ["assumption this agent believes must be tested"],
      "risks": ["risk if this direction is wrong or premature"],
      "recommendations": ["specific refinement recommendation"],
      "questions": ["question this expert would ask next"],
            "work_items": [
                {
                    "title": "specific work item",
                    "owner_role": "role that should own it",
                    "priority": "high | medium | low",
                    "rationale": "why this work matters",
                    "next_step": "immediate next action"
                }
            ],
      "artifact": {
        "title": "role-specific artifact title",
        "content": "short artifact text. For the Solution Architect, include an initial architecture candidate. For the TPM, include a delivery-readiness path. For the Data Scientist, include an evaluation or experiment design. For other agents, include their most useful working artifact.",
        "bullets": ["artifact bullet"]
      }
    }
  ],
  "roundtable": [
    {
            "phase": "initial_position | evidence_challenge | risk_and_work_items | alignment_and_tradeoffs | current_agreement",
      "speaker_id": "agent id",
      "speaker": "agent title",
      "message": "visible professional response to another expert or to the recommendation",
      "responds_to": "agent title or topic",
      "decision_impact": "how this changes the recommendation"
    }
  ],
  "synthesis": {
    "consensus": ["where the selected experts agree"],
    "disagreements": ["where experts differ and why it matters"],
    "recommended_direction": "the strongest recommendation after expert review",
    "solution_options": [
      {
        "title": "option name",
        "value": "why it matters",
        "effort": "relative effort",
        "risk": "key risk",
        "evidence_fit": "how well evidence supports it",
        "tradeoffs": ["tradeoff"]
      }
    ],
    "validation_plan": ["concrete validation action before Execute"],
    "execute_readiness": "what must be true before Execute creates final outputs",
    "decision_gate": "ready_for_execute | needs_validation | pivot | return_to_orchestrate",
    "confidence": 0
  }
}"""


class RefineReviewRequest(BaseModel):
    discovery_id: str
    agent_ids: list[str] = Field(default_factory=list)
    user_instructions: str = ""
    trigger_source: str = "manual"


class RefineChatRequest(BaseModel):
    discovery_id: str
    thread_type: str = "group"
    message: str
    agent_id: str = ""


@router.get("/agents", response_model=list[RefineAgentDefinition])
async def list_refine_agents():
    return AGENT_DEFINITIONS


@router.get("/reviews/{discovery_id}", response_model=list[RefineReview])
async def list_refine_reviews(discovery_id: str):
    storage = get_storage_provider()
    items = await storage.list("refine_reviews", {"discoveryId": discovery_id})
    if not items:
        items = await storage.list("refine_reviews", {"discovery_id": discovery_id})
    reviews = [RefineReview(**item) for item in items]
    reviews.sort(key=lambda item: (item.version, item.created_at))
    return reviews


@router.post("/reviews/auto/{discovery_id}", response_model=RefineReview)
async def ensure_full_board_review(discovery_id: str):
    reviews = await list_refine_reviews(discovery_id)
    full_board = {agent.id for agent in AGENT_DEFINITIONS}
    for review in reversed(reviews):
        review_phases = {turn.phase for turn in review.roundtable}
        if (
            set(review.agent_ids) == full_board
            and len(review.opinions) >= len(full_board)
            and all(phase in review_phases for phase in ROUNDTABLE_PHASES)
        ):
            return review
    return await generate_refine_review(
        RefineReviewRequest(
            discovery_id=discovery_id,
            agent_ids=[agent.id for agent in AGENT_DEFINITIONS],
            user_instructions=(
                "Automatically run the full Refine board for the user arrival state. "
                "Every agent must produce their role-specific opinion, questions, work items, and join the five-phase roundtable."
            ),
            trigger_source="automatic_full_board",
        )
    )


@router.post("/reviews/generate", response_model=RefineReview)
async def generate_refine_review(request: RefineReviewRequest):
    storage = get_storage_provider()
    llm = get_llm_provider()

    agent_ids = request.agent_ids or [agent.id for agent in AGENT_DEFINITIONS]
    invalid = [agent_id for agent_id in agent_ids if agent_id not in AGENTS_BY_ID]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown Refine agents: {', '.join(invalid)}")

    context = await _gather_refine_handoff(request.discovery_id)
    if not context.strip():
        raise HTTPException(
            status_code=422,
            detail="No Orchestrate handoff yet. Add evidence, a project brief, a problem statement, or a use case first.",
        )

    selected_agents = [AGENTS_BY_ID[agent_id] for agent_id in agent_ids]
    agent_block = "\n\n".join(
        f"Agent ID: {agent.id}\nTitle: {agent.title}\nRole: {agent.role}\n"
        f"Mission: {agent.mission}\nGoal: {agent.goal}\nReview lens: {'; '.join(agent.review_lens)}\n"
        f"Expected outputs: {'; '.join(agent.expected_outputs)}\n"
        f"Signature questions: {'; '.join(agent.signature_questions)}\n"
        f"Work item focus: {'; '.join(agent.work_item_focus)}"
        for agent in selected_agents
    )

    user_guidance = ""
    if request.user_instructions.strip():
        user_guidance = f"\n\nUser guidance for this review:\n{request.user_instructions.strip()}"

    user_prompt = (
        f"Selected expert agents:\n\n{agent_block}\n\n"
        f"Orchestrate handoff and accumulated project context:\n\n{context}"
        f"{user_guidance}\n\n"
        "Generate the Refine expert review. If only one agent is selected, provide one opinion and a short synthesis; "
        "the roundtable can be empty or contain that agent's response to the overall recommendation."
    )

    try:
        result = await llm.complete_json(REFINE_REVIEW_SYSTEM, user_prompt, max_tokens=5000)
    except Exception:
        logger.exception("LLM call failed for refine expert review")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    result = await _complete_missing_agent_opinions(
        llm,
        selected_agents,
        context,
        request.user_instructions,
        result,
    )
    result = await _complete_missing_roundtable_phases(
        llm,
        selected_agents,
        context,
        request.user_instructions,
        result,
    )
    opinions = _review_opinions_for_agents(selected_agents, result.get("opinions", []))
    roundtable = _review_roundtable_for_agents(selected_agents, result.get("roundtable", []))

    synthesis_data = result.get("synthesis") or {}
    existing_reviews = await list_refine_reviews(request.discovery_id)
    review = RefineReview(
        discovery_id=request.discovery_id,
        version=_next_review_version(existing_reviews),
        trigger_source=request.trigger_source,
        agent_ids=agent_ids,
        opinions=opinions,
        roundtable=roundtable,
        synthesis=RefineSynthesis(
            consensus=synthesis_data.get("consensus", []),
            disagreements=synthesis_data.get("disagreements", []),
            recommended_direction=synthesis_data.get("recommended_direction", ""),
            solution_options=[
                RefineSolutionOption(**item)
                for item in synthesis_data.get("solution_options", [])
            ],
            validation_plan=synthesis_data.get("validation_plan", []),
            execute_readiness=synthesis_data.get("execute_readiness", ""),
            decision_gate=synthesis_data.get("decision_gate", "needs_validation"),
            confidence=synthesis_data.get("confidence", 0),
        ),
        user_instructions=request.user_instructions,
        context_used=context[:4000],
    )

    try:
        saved = await storage.create("refine_reviews", stamp_create(review.model_dump(mode="json")))
    except Exception:
        logger.exception("Failed to save refine expert review")
        raise HTTPException(status_code=500, detail="Failed to save refine review")

    await auto_request_review(
        artifact_collection="refine_reviews",
        artifact_id=str(saved.get("id", "")),
        artifact_title="Refine expert review",
        discovery_id=request.discovery_id,
    )

    return RefineReview(**saved)


async def _complete_missing_agent_opinions(
    llm,
    selected_agents: list[RefineAgentDefinition],
    context: str,
    user_instructions: str,
    result: dict,
) -> dict:
    present_agent_ids = {
        str(item.get("agent_id") or "")
        for item in result.get("opinions", [])
        if isinstance(item, dict)
    }
    missing_agents = [agent for agent in selected_agents if agent.id not in present_agent_ids]
    if not missing_agents:
        return result

    missing_block = "\n\n".join(
        f"Agent ID: {agent.id}\nTitle: {agent.title}\nGoal: {agent.goal}\n"
        f"Mission: {agent.mission}\nReview lens: {'; '.join(agent.review_lens)}\n"
        f"Signature questions: {'; '.join(agent.signature_questions)}\n"
        f"Work item focus: {'; '.join(agent.work_item_focus)}"
        for agent in missing_agents
    )
    supplement_prompt = f"""The previous Refine review response omitted one or more selected expert agents.
Return only the missing agents listed below. Produce exactly one opinion per missing agent and optional five-phase roundtable turns.

Missing agents:
{missing_block}

User guidance:
{user_instructions or 'None'}

Platform and Orchestrate context:
{context}

Return JSON with this exact shape:
{{
  "opinions": [],
  "roundtable": []
}}"""
    try:
        supplement = await llm.complete_json(REFINE_REVIEW_SYSTEM, supplement_prompt, max_tokens=4000)
    except Exception:
        logger.exception("LLM call failed while completing missing refine agent opinions")
        return result

    result["opinions"] = [*(result.get("opinions") or []), *(supplement.get("opinions") or [])]
    result["roundtable"] = [*(result.get("roundtable") or []), *(supplement.get("roundtable") or [])]
    return result


async def _complete_missing_roundtable_phases(
    llm,
    selected_agents: list[RefineAgentDefinition],
    context: str,
    user_instructions: str,
    result: dict,
) -> dict:
    if len(selected_agents) <= 1:
        return result

    present_phases = {
        str(item.get("phase") or "")
        for item in result.get("roundtable", [])
        if isinstance(item, dict)
    }
    missing_phases = [phase for phase in ROUNDTABLE_PHASES if phase not in present_phases]
    if not missing_phases:
        return result

    agent_block = "\n".join(f"- {agent.id}: {agent.title} ({agent.goal})" for agent in selected_agents)
    phase_block = "\n".join(f"- {phase}: {ROUNDTABLE_PHASE_DESCRIPTIONS[phase]}" for phase in missing_phases)
    supplement_prompt = f"""The previous Refine review response omitted required roundtable phases.
Return only roundtable turns for the missing phases below. Include concise role-specific turns from the selected agents, and make the final missing phase converge on the current agreement if it is included.

Selected agents:
{agent_block}

Missing phases:
{phase_block}

User guidance:
{user_instructions or 'None'}

Platform and Orchestrate context:
{context}

Return JSON with this exact shape:
{{
  "roundtable": []
}}"""
    try:
        supplement = await llm.complete_json(REFINE_REVIEW_SYSTEM, supplement_prompt, max_tokens=3500)
    except Exception:
        logger.exception("LLM call failed while completing missing refine roundtable phases")
        return result

    result["roundtable"] = [*(result.get("roundtable") or []), *(supplement.get("roundtable") or [])]
    return result


def _review_opinions_for_agents(
    selected_agents: list[RefineAgentDefinition],
    raw_opinions: list[dict],
) -> list[RefineAgentOpinion]:
    selected_ids = {agent.id for agent in selected_agents}
    opinions_by_agent: dict[str, RefineAgentOpinion] = {}
    for item in raw_opinions:
        try:
            opinion = RefineAgentOpinion(**item)
        except Exception:
            logger.debug("Skipping malformed refine agent opinion", exc_info=True)
            continue
        if opinion.agent_id in selected_ids and opinion.agent_id not in opinions_by_agent:
            opinions_by_agent[opinion.agent_id] = opinion

    for agent in selected_agents:
        if agent.id in opinions_by_agent:
            continue
        opinions_by_agent[agent.id] = RefineAgentOpinion(
            agent_id=agent.id,
            role=agent.title,
            title="Role review needed",
            position=(
                "This role did not return a usable advisory opinion from the AI provider. "
                "Treat this as a role-specific follow-up before Execute packages final outputs."
            ),
            confidence=0,
            questions=agent.signature_questions[:3],
            work_items=[
                RefineWorkItem(
                    title=f"Capture {agent.role.lower()} perspective",
                    description=focus,
                    owner_role=agent.title,
                    priority="high" if index == 0 else "medium",
                )
                for index, focus in enumerate(agent.work_item_focus[:3])
            ],
        )

    return [opinions_by_agent[agent.id] for agent in selected_agents]


def _review_roundtable_for_agents(
    selected_agents: list[RefineAgentDefinition],
    raw_turns: list[dict],
) -> list[RefineRoundtableTurn]:
    if len(selected_agents) <= 1:
        return [RefineRoundtableTurn(**item) for item in raw_turns]

    turns: list[RefineRoundtableTurn] = []
    for item in raw_turns:
        try:
            turn = RefineRoundtableTurn(**item)
        except Exception:
            logger.debug("Skipping malformed refine roundtable turn", exc_info=True)
            continue
        if turn.phase in ROUNDTABLE_PHASES:
            turns.append(turn)

    present_phases = {turn.phase for turn in turns}
    first_agent = selected_agents[0]
    for phase in ROUNDTABLE_PHASES:
        if phase in present_phases:
            continue
        turns.append(
            RefineRoundtableTurn(
                phase=phase,
                speaker_id=first_agent.id,
                speaker=first_agent.title,
                message=(
                    f"The AI provider did not return a usable {phase} turn. "
                    f"Use the role questions and work items to complete this phase before Execute."
                ),
                decision_impact="Roundtable phase requires follow-up before treating the advisory state as complete.",
            )
        )

    phase_order = {phase: index for index, phase in enumerate(ROUNDTABLE_PHASES)}
    return sorted(turns, key=lambda item: phase_order.get(item.phase, len(ROUNDTABLE_PHASES)))


@router.get("/chat/{discovery_id}", response_model=list[RefineChatMessage])
async def list_refine_chat_messages(
    discovery_id: str,
    thread_type: str = Query(default="group"),
    agent_id: str = Query(default=""),
):
    messages = await _list_chat_messages(discovery_id, thread_type, agent_id)
    messages.sort(key=lambda item: item.created_at)
    return messages


@router.post("/chat", response_model=list[RefineChatMessage])
async def send_refine_chat_message(request: RefineChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=422, detail="Message is required")
    if request.thread_type not in {"group", "agent"}:
        raise HTTPException(status_code=400, detail="thread_type must be group or agent")
    if request.thread_type == "agent" and request.agent_id not in AGENTS_BY_ID:
        raise HTTPException(status_code=400, detail="A valid agent_id is required for agent chat")

    storage = get_storage_provider()
    user_message = RefineChatMessage(
        discovery_id=request.discovery_id,
        thread_type=request.thread_type,
        agent_id=request.agent_id if request.thread_type == "agent" else "",
        speaker_id="user",
        speaker="User",
        role="user",
        content=request.message.strip(),
        contribution_type="user_input",
    )
    saved_user = await storage.create(
        "refine_chats",
        stamp_create(user_message.model_dump(mode="json")),
    )

    prior_messages = await _list_chat_messages(
        request.discovery_id,
        request.thread_type,
        request.agent_id if request.thread_type == "agent" else "",
    )
    prior_messages.sort(key=lambda item: item.created_at)

    context = await _gather_refine_handoff(request.discovery_id)
    latest_review = await _latest_review_context(request.discovery_id)
    history = _chat_history_text(prior_messages[-24:])
    llm = get_llm_provider()

    if request.thread_type == "agent":
        agent = AGENTS_BY_ID[request.agent_id]
        system_prompt = f"""You are the {agent.title} in the CORE Refine phase.
Answer only through this role's professional lens.
Goal: {agent.goal}
Mission: {agent.mission}
Review lens: {'; '.join(agent.review_lens)}
Work item focus: {'; '.join(agent.work_item_focus)}

Use the platform context, Orchestrate handoff, prior expert review, and chat history. Do not reveal hidden chain-of-thought. If the user's question is outside your role, answer only the part your role can responsibly address and say what another role should cover.

Return JSON with this exact shape:
{{
  "messages": [
    {{
      "speaker_id": "{agent.id}",
      "speaker": "{agent.title}",
      "content": "role-specific response",
      "contribution_type": "answer | question | work_item | risk | recommendation"
    }}
    ],
    "review_update": {{
        "should_create_version": true,
        "reason": "what changed because of this chat turn",
        "updated_opinions": [],
        "updated_synthesis": null
    }}
}}"""
        user_prompt = (
            f"Platform and Orchestrate context:\n{context}\n\n"
            f"Latest Refine board context:\n{latest_review}\n\n"
            f"Thread history:\n{history}\n\n"
            f"User message:\n{request.message.strip()}"
        )
    else:
        agent_block = "\n\n".join(
            f"Agent ID: {agent.id}\nTitle: {agent.title}\nGoal: {agent.goal}\n"
            f"Mission: {agent.mission}\nLens: {'; '.join(agent.review_lens)}\n"
            f"Work item focus: {'; '.join(agent.work_item_focus)}"
            for agent in AGENT_DEFINITIONS
        )
        system_prompt = f"""You are facilitating the CORE Refine group advisory chat.
The user can speak into the group thread. Agents should respond only when their role adds useful value, and they should build on what other agents have learned.

Agents:
{agent_block}

Rules:
- Do not reveal hidden chain-of-thought.
- Keep each response concise and role-specific.
- Let agents explicitly reference useful points from other roles when it changes their view.
- Convert useful debate into questions, risks, recommendations, or work items.
- Do not create final decks, docs, emails, or stakeholder packages; those belong to Execute.
- This is not an autonomous loop. Produce one bounded response pass for the user's latest message, then stop.
- At most one new advisory-state version may be created from this chat turn.

Return JSON with this exact shape:
{{
  "messages": [
    {{
      "speaker_id": "agent id",
      "speaker": "agent title",
      "content": "agent response in the group thread",
      "contribution_type": "answer | question | work_item | risk | recommendation | agreement"
    }}
    ],
    "review_update": {{
        "should_create_version": true,
        "reason": "what changed because of this chat turn",
        "updated_opinions": [],
        "updated_synthesis": null
    }}
}}"""
        user_prompt = (
            f"Platform and Orchestrate context:\n{context}\n\n"
            f"Latest Refine board context:\n{latest_review}\n\n"
            f"Group thread history:\n{history}\n\n"
            f"User message to the board:\n{request.message.strip()}"
        )

    try:
        result = await llm.complete_json(system_prompt, user_prompt, max_tokens=3500)
    except Exception:
        logger.exception("LLM call failed for refine chat")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    saved_agent_messages: list[RefineChatMessage] = []
    for item in result.get("messages", [])[:8]:
        speaker_id = str(item.get("speaker_id") or request.agent_id or "agent")
        speaker = str(item.get("speaker") or AGENTS_BY_ID.get(speaker_id, AGENT_DEFINITIONS[0]).title)
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        agent_message = RefineChatMessage(
            discovery_id=request.discovery_id,
            thread_type=request.thread_type,
            agent_id=request.agent_id if request.thread_type == "agent" else speaker_id,
            speaker_id=speaker_id,
            speaker=speaker,
            role="agent",
            content=content,
            contribution_type=str(item.get("contribution_type") or "response"),
        )
        saved = await storage.create(
            "refine_chats",
            stamp_create(agent_message.model_dump(mode="json")),
        )
        saved_agent_messages.append(RefineChatMessage(**saved))

    review_version = await _save_chat_review_version(
        request.discovery_id,
        request.thread_type,
        request.agent_id,
        result,
        saved_agent_messages,
    )
    if review_version:
        saved_user["review_version"] = review_version
        if saved_user.get("id"):
            try:
                await storage.update("refine_chats", str(saved_user["id"]), {"review_version": review_version})
            except Exception:
                logger.debug("Could not stamp user refine chat message with review version")
        for message in saved_agent_messages:
            message.review_version = review_version
            if message.id:
                try:
                    await storage.update("refine_chats", message.id, {"review_version": review_version})
                except Exception:
                    logger.debug("Could not stamp refine chat message with review version")

    return [RefineChatMessage(**saved_user), *saved_agent_messages]


async def _gather_refine_handoff(discovery_id: str) -> str:
    storage = get_storage_provider()
    parts: list[str] = []

    base_context = await gather_context(discovery_id)
    if base_context:
        parts.append(base_context)

    for collection, label, limit in [
        ("context_briefs", "Latest Project Understanding", 1),
        ("problem_statements", "Latest Problem Statement Version", 1),
        ("use_cases", "Latest Use Case Version", 1),
    ]:
        items = await _list_by_discovery(storage, collection, discovery_id)
        if items:
            latest = sorted(items, key=lambda item: item.get("version", 0))[-limit:]
            parts.append(f"{label}:\n{latest[-1]}")

    question_sets = await _list_by_discovery(storage, "question_sets", discovery_id)
    unresolved = [item for item in question_sets if str(item.get("phase", "")).lower() in {"orchestrate", "orient", "refine"}]
    if unresolved:
        parts.append("Recent Orchestrate/Refine question context:\n" + "\n".join(str(item) for item in unresolved[-3:]))

    return "\n\n".join(parts)


async def _list_chat_messages(
    discovery_id: str,
    thread_type: str,
    agent_id: str = "",
) -> list[RefineChatMessage]:
    storage = get_storage_provider()
    items = await storage.list("refine_chats", {"discoveryId": discovery_id})
    if not items:
        items = await storage.list("refine_chats", {"discovery_id": discovery_id})
    messages = [RefineChatMessage(**item) for item in items]
    filtered = [message for message in messages if message.thread_type == thread_type]
    if thread_type == "agent":
        filtered = [message for message in filtered if message.agent_id == agent_id]
    filtered.sort(key=lambda item: item.created_at)
    return filtered


def _next_review_version(reviews: list[RefineReview]) -> int:
    if not reviews:
        return 1
    return max(review.version for review in reviews) + 1


async def _save_chat_review_version(
    discovery_id: str,
    thread_type: str,
    agent_id: str,
    result: dict,
    messages: list[RefineChatMessage],
) -> int:
    if not messages:
        return 0

    update = result.get("review_update") or {}
    contribution_types = {message.contribution_type for message in messages}
    should_create = bool(update.get("should_create_version")) or bool(
        contribution_types.intersection({"question", "work_item", "risk", "recommendation", "agreement"})
    )
    if not should_create:
        return 0

    reviews = await list_refine_reviews(discovery_id)
    latest = reviews[-1] if reviews else None
    if not latest:
        latest = await ensure_full_board_review(discovery_id)
        reviews = await list_refine_reviews(discovery_id)

    updated_opinions_data = update.get("updated_opinions") or []
    latest_opinions = latest.opinions if latest else []
    opinion_by_agent = {opinion.agent_id: opinion for opinion in latest_opinions}
    for item in updated_opinions_data:
        try:
            opinion = RefineAgentOpinion(**item)
        except Exception:
            continue
        opinion_by_agent[opinion.agent_id] = opinion

    if thread_type == "agent" and agent_id in AGENTS_BY_ID and not updated_opinions_data:
        agent = AGENTS_BY_ID[agent_id]
        combined = "\n\n".join(message.content for message in messages if message.speaker_id == agent_id)
        existing = opinion_by_agent.get(agent_id)
        if existing:
            existing.recommendations = [*existing.recommendations, combined][:12]
            opinion_by_agent[agent_id] = existing
        else:
            opinion_by_agent[agent_id] = RefineAgentOpinion(
                agent_id=agent.id,
                role=agent.title,
                title="Chat-driven perspective update",
                position=combined,
                confidence=60,
                recommendations=[combined],
            )

    synthesis_data = update.get("updated_synthesis") or {}
    if synthesis_data:
        try:
            synthesis = RefineSynthesis(
                consensus=synthesis_data.get("consensus", []),
                disagreements=synthesis_data.get("disagreements", []),
                recommended_direction=synthesis_data.get("recommended_direction", ""),
                solution_options=[
                    RefineSolutionOption(**item)
                    for item in synthesis_data.get("solution_options", [])
                ],
                validation_plan=synthesis_data.get("validation_plan", []),
                execute_readiness=synthesis_data.get("execute_readiness", ""),
                decision_gate=synthesis_data.get("decision_gate", "needs_validation"),
                confidence=synthesis_data.get("confidence", 0),
            )
        except Exception:
            synthesis = latest.synthesis if latest else RefineSynthesis()
    else:
        synthesis = latest.synthesis if latest else RefineSynthesis()

    chat_context = "\n".join(
        f"{message.speaker} ({message.contribution_type}): {message.content}"
        for message in messages
    )
    version = _next_review_version(reviews)
    review = RefineReview(
        discovery_id=discovery_id,
        version=version,
        parent_review_id=latest.id if latest else "",
        trigger_source="group_chat" if thread_type == "group" else "agent_chat",
        agent_ids=[agent.id for agent in AGENT_DEFINITIONS],
        opinions=list(opinion_by_agent.values()),
        roundtable=latest.roundtable if latest else [],
        synthesis=synthesis,
        user_instructions=str(update.get("reason") or "Chat-driven advisory update"),
        context_used=chat_context[:4000],
    )

    storage = get_storage_provider()
    await storage.create("refine_reviews", stamp_create(review.model_dump(mode="json")))
    return version


async def _latest_review_context(discovery_id: str) -> str:
    reviews = await list_refine_reviews(discovery_id)
    if not reviews:
        return "No Refine review exists yet."
    review = reviews[-1]
    opinion_lines = [
        f"- {opinion.role or opinion.agent_id}: {opinion.position} Questions: {'; '.join(opinion.questions[:3])}. Work items: {'; '.join(item.title for item in opinion.work_items[:3])}."
        for opinion in review.opinions
    ]
    synthesis = review.synthesis
    return "\n".join(
        [
            f"Decision gate: {synthesis.decision_gate}",
            f"Recommended direction: {synthesis.recommended_direction}",
            f"Consensus: {'; '.join(synthesis.consensus)}",
            f"Disagreements: {'; '.join(synthesis.disagreements)}",
            "Agent opinions:",
            *opinion_lines,
        ]
    )


def _chat_history_text(messages: list[RefineChatMessage]) -> str:
    if not messages:
        return "No prior messages."
    return "\n".join(
        f"{message.speaker} ({message.role}, {message.contribution_type or 'message'}): {message.content}"
        for message in messages
    )


async def _list_by_discovery(storage, collection: str, discovery_id: str) -> list[dict]:
    items = await storage.list(collection, {"discoveryId": discovery_id})
    if not items:
        items = await storage.list(collection, {"discovery_id": discovery_id})
    return items
