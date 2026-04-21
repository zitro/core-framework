"""Shared helpers for design-thinking sub-agents.

Each DT agent follows the same shape:
1. Gather context for a discovery.
2. Send a system + user prompt to the LLM expecting JSON.
3. Persist the result under a per-agent collection.

`run_dt_agent` centralises that flow so each agent file only needs its
prompts and a thin wrapper.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from app.agents.base import AgentResult, BaseAgent

logger = logging.getLogger(__name__)


async def run_dt_agent(
    agent: BaseAgent,
    *,
    discovery_id: str,
    system_prompt: str,
    user_prompt_template: str,
    user_instructions: str = "",
    extra_context: str = "",
    max_tokens: int = 2000,
) -> AgentResult:
    """Standard run loop for design-thinking agents.

    `user_prompt_template` is formatted with `{context}`, `{user_instructions}`,
    and `{extra_context}` placeholders.
    """
    context = await agent._context(discovery_id)
    user_prompt = user_prompt_template.format(
        context=context or "(no discovery context yet)",
        user_instructions=user_instructions or "(none)",
        extra_context=extra_context or "(none)",
    )

    try:
        result = await agent._llm().complete_json(system_prompt, user_prompt, max_tokens=max_tokens)
    except Exception:
        logger.exception("%s LLM call failed", agent.meta.agent_id)
        raise HTTPException(status_code=502, detail="AI service unavailable") from None

    payload: dict[str, Any] = {
        "discovery_id": discovery_id,
        "agent_id": agent.meta.agent_id,
        "user_instructions": user_instructions,
        "result": result,
    }

    try:
        saved = await agent._save(payload)
    except Exception:
        logger.exception("Failed to persist %s output", agent.meta.agent_id)
        raise HTTPException(status_code=500, detail="Failed to save output") from None

    return AgentResult(
        agent_id=agent.meta.agent_id,
        agent_name=agent.meta.name,
        data=saved,
    )
