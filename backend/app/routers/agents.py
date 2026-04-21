"""Generic agent router — list and invoke any registered CORE sub-agent."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents import agent_registry, get_agent
from app.agents.base import AgentMeta
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


class AgentSummary(BaseModel):
    agent_id: str
    name: str
    role: str
    description: str
    icon: str
    phase: str
    expertise: list[str]


class RunAgentRequest(BaseModel):
    discovery_id: str = ""
    user_instructions: str = ""

    # Allow agent-specific extra fields (e.g. company name for the researcher).
    model_config = {"extra": "allow"}


def _to_summary(meta: AgentMeta) -> AgentSummary:
    return AgentSummary(
        agent_id=meta.agent_id,
        name=meta.name,
        role=meta.role,
        description=meta.description,
        icon=meta.icon,
        phase=meta.phase,
        expertise=meta.expertise,
    )


@router.get("", response_model=list[AgentSummary])
async def list_agents() -> list[AgentSummary]:
    """List every registered sub-agent."""
    return [_to_summary(meta) for meta in agent_registry().values()]


@router.post("/{agent_id}/run")
async def run_agent(agent_id: str, request: RunAgentRequest):
    """Invoke a registered sub-agent against a discovery."""
    try:
        agent = get_agent(agent_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    extras = {
        k: v
        for k, v in request.model_dump().items()
        if k not in ("discovery_id", "user_instructions")
    }
    result = await agent.run(
        discovery_id=request.discovery_id,
        user_instructions=request.user_instructions,
        **extras,
    )
    return result.model_dump(mode="json")


@router.get("/{agent_id}/outputs/{discovery_id}")
async def list_agent_outputs(agent_id: str, discovery_id: str):
    """Return previously generated outputs for an agent + discovery pair."""
    try:
        agent = get_agent(agent_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return await agent.list_outputs(discovery_id)
