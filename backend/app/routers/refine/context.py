from app.models.core import RefineChatMessage, RefineReview
from app.providers.storage import get_storage_provider
from app.utils.context import gather_context


async def list_by_discovery(storage, collection: str, discovery_id: str) -> list[dict]:
    items = await storage.list(collection, {"discoveryId": discovery_id})
    if not items:
        items = await storage.list(collection, {"discovery_id": discovery_id})
    return items


async def gather_refine_handoff(discovery_id: str) -> str:
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
        items = await list_by_discovery(storage, collection, discovery_id)
        if items:
            latest = sorted(items, key=lambda item: item.get("version", 0))[-limit:]
            parts.append(f"{label}:\n{latest[-1]}")

    question_sets = await list_by_discovery(storage, "question_sets", discovery_id)
    unresolved = [
        item
        for item in question_sets
        if str(item.get("phase", "")).lower() in {"orchestrate", "orient", "refine"}
    ]
    if unresolved:
        parts.append(
            "Recent Orchestrate/Refine question context:\n"
            + "\n".join(str(item) for item in unresolved[-3:])
        )

    return "\n\n".join(parts)


async def list_chat_messages(
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


def next_review_version(reviews: list[RefineReview]) -> int:
    if not reviews:
        return 1
    return max(review.version for review in reviews) + 1


def chat_history_text(messages: list[RefineChatMessage]) -> str:
    if not messages:
        return "No prior messages."
    return "\n".join(
        f"{message.speaker} ({message.role}, {message.contribution_type or 'message'}): {message.content}"
        for message in messages
    )


def latest_review_text(review: RefineReview) -> str:
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
