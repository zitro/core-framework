import logging

from app.models.core import (
    RefineAgentDefinition,
    RefineAgentOpinion,
    RefineChatMessage,
    RefineReview,
    RefineRoundtableTurn,
    RefineSolutionOption,
    RefineSynthesis,
    RefineWorkItem,
)
from app.providers.storage import get_storage_provider
from app.routers.refine.agents import AGENT_DEFINITIONS, AGENTS_BY_ID, ROUNDTABLE_PHASES
from app.routers.refine.context import next_review_version
from app.routers.refine.prompts import (
    REFINE_REVIEW_SYSTEM,
    build_missing_opinions_prompt,
    build_missing_phases_prompt,
)
from app.utils.audit import stamp_create

logger = logging.getLogger(__name__)


async def complete_missing_agent_opinions(
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

    supplement_prompt = build_missing_opinions_prompt(missing_agents, context, user_instructions)
    try:
        supplement = await llm.complete_json(
            REFINE_REVIEW_SYSTEM, supplement_prompt, max_tokens=4000
        )
    except Exception:
        logger.exception("LLM call failed while completing missing refine agent opinions")
        return result

    result["opinions"] = [*(result.get("opinions") or []), *(supplement.get("opinions") or [])]
    result["roundtable"] = [
        *(result.get("roundtable") or []),
        *(supplement.get("roundtable") or []),
    ]
    return result


async def complete_missing_roundtable_phases(
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

    supplement_prompt = build_missing_phases_prompt(
        selected_agents, missing_phases, context, user_instructions
    )
    try:
        supplement = await llm.complete_json(
            REFINE_REVIEW_SYSTEM, supplement_prompt, max_tokens=3500
        )
    except Exception:
        logger.exception("LLM call failed while completing missing refine roundtable phases")
        return result

    result["roundtable"] = [
        *(result.get("roundtable") or []),
        *(supplement.get("roundtable") or []),
    ]
    return result


def review_opinions_for_agents(
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


def review_roundtable_for_agents(
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


def build_synthesis(synthesis_data: dict) -> RefineSynthesis:
    return RefineSynthesis(
        consensus=synthesis_data.get("consensus", []),
        disagreements=synthesis_data.get("disagreements", []),
        recommended_direction=synthesis_data.get("recommended_direction", ""),
        solution_options=[
            RefineSolutionOption(**item) for item in synthesis_data.get("solution_options", [])
        ],
        validation_plan=synthesis_data.get("validation_plan", []),
        execute_readiness=synthesis_data.get("execute_readiness", ""),
        decision_gate=synthesis_data.get("decision_gate", "needs_validation"),
        confidence=synthesis_data.get("confidence", 0),
    )


async def save_chat_review_version(
    discovery_id: str,
    thread_type: str,
    agent_id: str,
    result: dict,
    messages: list[RefineChatMessage],
    reviews_loader,
    ensure_full_board,
) -> int:
    if not messages:
        return 0

    update = result.get("review_update") or {}
    contribution_types = {message.contribution_type for message in messages}
    should_create = bool(update.get("should_create_version")) or bool(
        contribution_types.intersection(
            {"question", "work_item", "risk", "recommendation", "agreement"}
        )
    )
    if not should_create:
        return 0

    reviews = await reviews_loader(discovery_id)
    latest = reviews[-1] if reviews else None
    if not latest:
        latest = await ensure_full_board(discovery_id)
        reviews = await reviews_loader(discovery_id)

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
        combined = "\n\n".join(
            message.content for message in messages if message.speaker_id == agent_id
        )
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
            synthesis = build_synthesis(synthesis_data)
        except Exception:
            synthesis = latest.synthesis if latest else RefineSynthesis()
    else:
        synthesis = latest.synthesis if latest else RefineSynthesis()

    chat_context = "\n".join(
        f"{message.speaker} ({message.contribution_type}): {message.content}"
        for message in messages
    )
    version = next_review_version(reviews)
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
