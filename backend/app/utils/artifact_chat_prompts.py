"""Prompt-rendering helpers for per-artifact chat (Phase 6H).

Keeps routers/artifact_threads.py focused on routing — these are pure
text transforms with no I/O of their own."""

from __future__ import annotations

from app.models.artifact_thread import CommentRole
from app.providers.storage import get_storage_provider

CHAT_SYSTEM = """You are a helpful assistant grounded in a single artifact
from a customer engagement. Answer questions, propose edits, or summarize
based ONLY on the artifact, the conversation so far, and the engagement
context. If the answer isn't supported, say so plainly. Be concise and
useful — bullets and short paragraphs over essays."""

# Cap how much history we feed the model so token spend stays predictable.
MAX_HISTORY_COMMENTS = 20
MAX_ARTIFACT_BODY_CHARS = 8000
MAX_CONTEXT_CHARS = 4000

ENGAGEMENT_CONTEXTS_COLLECTION = "engagement_contexts"


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n…[truncated]"


def render_artifact_for_prompt(art: dict) -> str:
    """Render an Artifact's body as compact key:value lines so JSON
    noise doesn't dominate the prompt."""
    body = art.get("body") or {}
    body_str = ""
    if isinstance(body, dict) and body:
        lines = []
        for k, v in body.items():
            if isinstance(v, list | dict):
                lines.append(f"- {k}: {v}")
            else:
                s = str(v).strip()
                if s:
                    lines.append(f"- {k}: {s}")
        body_str = "\n".join(lines)
    summary = art.get("summary", "")
    return truncate(
        f"# {art.get('title', '')}\n\n"
        f"_Type: {art.get('type_id', '')} · status: {art.get('status', '')}_\n\n"
        f"{summary}\n\n{body_str}",
        MAX_ARTIFACT_BODY_CHARS,
    )


async def render_engagement_context(project_id: str) -> str:
    """Render the project's EngagementContext as a compact prompt block.
    Returns empty string if no context exists yet."""
    storage = get_storage_provider()
    items = await storage.list(ENGAGEMENT_CONTEXTS_COLLECTION, {"project_id": project_id})
    if not items:
        return ""
    ctx = items[0]
    parts: list[str] = []
    for label, key in (
        ("Title", "title"),
        ("One-liner", "one_liner"),
        ("Phase", "phase"),
        ("Problem", "problem"),
        ("Desired outcome", "desired_outcome"),
    ):
        val = ctx.get(key)
        if val:
            parts.append(f"{label}: {val}")
    for label, key in (
        ("Scope in", "scope_in"),
        ("Scope out", "scope_out"),
        ("Constraints", "constraints"),
        ("Risks", "risks"),
    ):
        items_list = ctx.get(key) or []
        if items_list:
            parts.append(f"{label}: {', '.join(items_list)}")
    return truncate("\n".join(parts), MAX_CONTEXT_CHARS)


def render_history(comments: list[dict]) -> str:
    """Render the last MAX_HISTORY_COMMENTS as a chat transcript."""
    tail = comments[-MAX_HISTORY_COMMENTS:]
    lines = []
    for c in tail:
        role = c.get("role", "user")
        if role == CommentRole.SYSTEM:
            lines.append(f"[system] {c.get('body', '')}")
            continue
        speaker = "User" if role == CommentRole.USER else "Assistant"
        lines.append(f"{speaker}: {c.get('body', '').strip()}")
    return "\n\n".join(lines)
