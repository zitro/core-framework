"""Chat-over-corpus agent.

A conversational layer that answers questions strictly from a project's
corpus. Citations are validated against `corpus.docs[].id` exactly the
same way the generator validates artifact citations — anything else is
dropped before the response leaves the backend.

Conversation persistence lives in the `synthesis_chats` collection,
partitioned by `project_id`. Each document is a single turn (so we can
stream-append cheaply). The router composes a session by listing turns
for a project + session_id and ordering by `created_at`.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from app.config import settings
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.synthesis.models import Citation, Corpus
from app.synthesis.prompts import (
    filter_citations,
    list_source_ids,
    render_corpus_block,
)
from app.utils.audit import stamp_create

logger = logging.getLogger(__name__)

CHATS_COLLECTION = "synthesis_chats"

CHAT_FRAME = """You are CORE Chat, a Microsoft FDE-grade strategist.
You answer the user's question using ONLY the provided project corpus.
You never invent specifics not supported by the corpus. Every concrete
claim must be tied to a `source_id` from the corpus block. If the corpus
does not answer the question, say so plainly and propose what to ask the
customer next."""


def chat_prompt(
    history: list[dict],
    user_message: str,
    corpus: Corpus,
) -> tuple[str, str]:
    """Render the (system, user) pair for one chat turn.

    History is the prior turns in this session (oldest first), each:
        {"role": "user"|"assistant", "content": str}
    """
    history_block = "\n\n".join(
        f"{turn.get('role', 'user').upper()}: {turn.get('content', '')}" for turn in history
    )
    if history_block:
        history_block = f"PRIOR CONVERSATION:\n{history_block}\n\n"

    user = f"""{history_block}USER MESSAGE:
{user_message}

CORPUS:
{render_corpus_block(corpus, max_chars=20_000)}

Return strict JSON:
{{
  "answer": "your reply to the user, in plain prose",
  "citations": [
    {{
      "source_id": "id from CORPUS",
      "quote": "verbatim excerpt that supports the answer",
      "note": "optional reasoning"
    }}
  ],
  "follow_up_questions": [
    "optional questions to ask the customer next if the corpus is thin"
  ]
}}

Rules:
- citations[].source_id MUST be one of the source ids in the CORPUS block.
- If the corpus has no support for the answer, set "answer" to a brief
  honest statement of the gap and put the suggested next question in
  follow_up_questions.
- Do NOT invent numbers, names, or quotes."""
    return CHAT_FRAME, user


class ChatAgent:
    """Stateless agent — one call answers one user turn."""

    async def reply(
        self,
        project: dict,
        session_id: str,
        user_message: str,
        corpus: Corpus,
        history: list[dict],
    ) -> dict:
        system, user = chat_prompt(history, user_message, corpus)

        llm = get_llm_provider()
        try:
            raw = await llm.complete_json(system, user)
        except Exception:
            logger.exception("chat: LLM call failed for project=%s", project.get("id"))
            raise

        valid_ids = list_source_ids(corpus)
        clean_citations = filter_citations(raw.get("citations") or [], valid_ids)
        answer = str(raw.get("answer") or "").strip() or "(no answer)"
        follow_ups = [str(q).strip() for q in (raw.get("follow_up_questions") or []) if q]

        await self._persist_turn(project, session_id, "user", user_message)
        assistant_record = await self._persist_turn(
            project,
            session_id,
            "assistant",
            answer,
            citations=clean_citations,
            follow_ups=follow_ups,
        )

        return {
            "session_id": session_id,
            "turn": assistant_record,
            "answer": answer,
            "citations": [Citation(**c).model_dump(mode="json") for c in clean_citations],
            "follow_up_questions": follow_ups,
        }

    async def _persist_turn(
        self,
        project: dict,
        session_id: str,
        role: str,
        content: str,
        *,
        citations: list[dict] | None = None,
        follow_ups: list[str] | None = None,
    ) -> dict:
        storage = get_storage_provider()
        payload = {
            "project_id": str(project.get("id") or ""),
            "session_id": session_id,
            "role": role,
            "content": content,
            "citations": citations or [],
            "follow_up_questions": follow_ups or [],
            "model": getattr(settings, "azure_openai_deployment", "") or settings.llm_provider,
            "created_at": datetime.now(UTC).isoformat(),
        }
        return await storage.create(CHATS_COLLECTION, stamp_create(payload))
