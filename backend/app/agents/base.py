"""Base agent class — shared contract for all CORE sub-agents."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field

from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.context import gather_context

logger = logging.getLogger(__name__)


class AgentMeta(BaseModel):
    """Metadata that identifies a sub-agent to the frontend."""

    agent_id: str
    name: str
    role: str
    description: str
    icon: str  # lucide icon name for frontend rendering
    phase: str  # primary CORE phase: capture | orient | refine | execute
    expertise: list[str] = Field(default_factory=list)


class AgentResult(BaseModel):
    """Standardised wrapper returned by every agent run."""

    agent_id: str
    agent_name: str
    data: dict[str, Any]


class BaseAgent(ABC):
    """Abstract base every CORE sub-agent inherits from."""

    meta: AgentMeta
    system_prompt: str
    collection: str  # Cosmos container name

    # ── helpers ────────────────────────────────────────────

    @staticmethod
    def _llm():
        return get_llm_provider()

    @staticmethod
    def _storage():
        return get_storage_provider()

    @staticmethod
    async def _context(discovery_id: str) -> str:
        return await gather_context(discovery_id)

    async def _next_version(self, discovery_id: str) -> int:
        storage = self._storage()
        items = await storage.list(self.collection, {"discoveryId": discovery_id})
        if not items:
            items = await storage.list(self.collection, {"discovery_id": discovery_id})
        return len(items) + 1

    async def _save(self, data: dict) -> dict:
        storage = self._storage()
        return await storage.create(self.collection, data)

    async def _list(self, discovery_id: str) -> list[dict]:
        storage = self._storage()
        items = await storage.list(self.collection, {"discoveryId": discovery_id})
        if not items:
            items = await storage.list(self.collection, {"discovery_id": discovery_id})
        return items

    # ── contract ──────────────────────────────────────────

    @abstractmethod
    async def run(
        self, discovery_id: str, user_instructions: str = "", **kwargs: Any
    ) -> AgentResult:
        """Execute the agent's primary task and return a result."""

    async def list_outputs(self, discovery_id: str) -> list[dict]:
        """Return previously generated outputs for a discovery."""
        return await self._list(discovery_id)
