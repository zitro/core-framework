"""Agent registry — central lookup for all CORE sub-agents."""

from __future__ import annotations

from app.agents.base import AgentMeta, BaseAgent

_AGENTS: dict[str, BaseAgent] = {}


def register(agent: BaseAgent) -> BaseAgent:
    """Register an agent instance by its ID."""
    _AGENTS[agent.meta.agent_id] = agent
    return agent


def get_agent(agent_id: str) -> BaseAgent:
    """Lookup a registered agent by ID."""
    if agent_id not in _AGENTS:
        raise KeyError(f"Unknown agent: {agent_id}")
    return _AGENTS[agent_id]


def agent_registry() -> dict[str, AgentMeta]:
    """Return metadata for every registered agent."""
    return {aid: a.meta for aid, a in _AGENTS.items()}
