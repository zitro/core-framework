import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user
from app.models.core import RefineAgentDefinition, RefineChatMessage, RefineReview
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.routers.refine.agents import AGENT_DEFINITIONS, AGENTS_BY_ID, ROUNDTABLE_PHASES
from app.routers.refine.context import (
    chat_history_text,
    gather_refine_handoff,
    latest_review_text,
    list_chat_messages,
    next_review_version,
)
from app.routers.refine.prompts import (
    REFINE_REVIEW_SYSTEM,
    build_agent_chat_system,
    build_chat_user_prompt,
    build_group_chat_system,
    build_review_user_prompt,
)
from app.routers.refine.schemas import RefineChatRequest, RefineReviewRequest
from app.routers.refine.service import (
    build_synthesis,
    complete_missing_agent_opinions,
    complete_missing_roundtable_phases,
    review_opinions_for_agents,
    review_roundtable_for_agents,
    save_chat_review_version,
)
from app.utils.ai_feedback import render_feedback_block
from app.utils.audit import stamp_create
from app.utils.methodology import render_methodology_block
from app.utils.review_gate import auto_request_review

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


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

    context = await gather_refine_handoff(request.discovery_id)
    if not context.strip():
        raise HTTPException(
            status_code=422,
            detail="No Orchestrate handoff yet. Add evidence, a project brief, a problem statement, or a use case first.",
        )

    selected_agents = [AGENTS_BY_ID[agent_id] for agent_id in agent_ids]

    user_guidance = ""
    if request.user_instructions.strip():
        user_guidance = f"\n\nUser guidance for this review:\n{request.user_instructions.strip()}"

    feedback_block = await render_feedback_block(request.discovery_id, "expert_review")
    if feedback_block:
        user_guidance += f"\n\n{feedback_block}"
    methodology_block = await render_methodology_block(request.discovery_id)
    if methodology_block:
        user_guidance += f"\n\n{methodology_block}"

    user_prompt = build_review_user_prompt(selected_agents, context, user_guidance)

    try:
        result = await llm.complete_json(REFINE_REVIEW_SYSTEM, user_prompt, max_tokens=5000)
    except Exception:
        logger.exception("LLM call failed for refine expert review")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    result = await complete_missing_agent_opinions(
        llm, selected_agents, context, request.user_instructions, result
    )
    result = await complete_missing_roundtable_phases(
        llm, selected_agents, context, request.user_instructions, result
    )
    opinions = review_opinions_for_agents(selected_agents, result.get("opinions", []))
    roundtable = review_roundtable_for_agents(selected_agents, result.get("roundtable", []))

    synthesis_data = result.get("synthesis") or {}
    existing_reviews = await list_refine_reviews(request.discovery_id)
    review = RefineReview(
        discovery_id=request.discovery_id,
        version=next_review_version(existing_reviews),
        trigger_source=request.trigger_source,
        agent_ids=agent_ids,
        opinions=opinions,
        roundtable=roundtable,
        synthesis=build_synthesis(synthesis_data),
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


@router.get("/chat/{discovery_id}", response_model=list[RefineChatMessage])
async def list_refine_chat_messages(
    discovery_id: str,
    thread_type: str = Query(default="group"),
    agent_id: str = Query(default=""),
):
    messages = await list_chat_messages(discovery_id, thread_type, agent_id)
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

    prior_messages = await list_chat_messages(
        request.discovery_id,
        request.thread_type,
        request.agent_id if request.thread_type == "agent" else "",
    )
    prior_messages.sort(key=lambda item: item.created_at)

    context = await gather_refine_handoff(request.discovery_id)
    latest_review = await _latest_review_context(request.discovery_id)
    history = chat_history_text(prior_messages[-24:])
    llm = get_llm_provider()

    is_group = request.thread_type == "group"
    if is_group:
        system_prompt = build_group_chat_system()
    else:
        system_prompt = build_agent_chat_system(AGENTS_BY_ID[request.agent_id])
    user_prompt = build_chat_user_prompt(
        context, latest_review, history, request.message.strip(), is_group
    )

    try:
        result = await llm.complete_json(system_prompt, user_prompt, max_tokens=3500)
    except Exception:
        logger.exception("LLM call failed for refine chat")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    saved_agent_messages: list[RefineChatMessage] = []
    for item in result.get("messages", [])[:8]:
        speaker_id = str(item.get("speaker_id") or request.agent_id or "agent")
        speaker = str(
            item.get("speaker") or AGENTS_BY_ID.get(speaker_id, AGENT_DEFINITIONS[0]).title
        )
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

    review_version = await save_chat_review_version(
        request.discovery_id,
        request.thread_type,
        request.agent_id,
        result,
        saved_agent_messages,
        list_refine_reviews,
        ensure_full_board_review,
    )
    if review_version:
        saved_user["review_version"] = review_version
        if saved_user.get("id"):
            try:
                await storage.update(
                    "refine_chats", str(saved_user["id"]), {"review_version": review_version}
                )
            except Exception:
                logger.debug("Could not stamp user refine chat message with review version")
        for message in saved_agent_messages:
            message.review_version = review_version
            if message.id:
                try:
                    await storage.update(
                        "refine_chats", message.id, {"review_version": review_version}
                    )
                except Exception:
                    logger.debug("Could not stamp refine chat message with review version")

    return [RefineChatMessage(**saved_user), *saved_agent_messages]


async def _latest_review_context(discovery_id: str) -> str:
    reviews = await list_refine_reviews(discovery_id)
    if not reviews:
        return "No Refine review exists yet."
    return latest_review_text(reviews[-1])
