"""CORE Discovery sub-agents — specialist AI personas for each capability.

Importing this package triggers registration of every concrete agent
into the central registry (each module ends with `register(...)`).
"""

# Import side-effect: each module registers itself with the registry.
from app.agents import (  # noqa: F401
    assumption_tester,
    discovery_coach,
    empathy_researcher,
    hmw_framer,
    ideation_facilitator,
    problem_analyst,
    solution_architect,
    transcript_analyst,
    use_case_analyst,
)
from app.agents.registry import agent_registry, get_agent

__all__ = ["agent_registry", "get_agent"]
