from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Abstract base for LLM providers. Swap Azure OpenAI, direct OpenAI, or Ollama."""

    @abstractmethod
    async def complete(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        """Generate a completion from the LLM."""

    @abstractmethod
    async def complete_json(self, system_prompt: str, user_prompt: str, **kwargs) -> dict:
        """Generate a structured JSON completion."""

    @abstractmethod
    async def stream(self, system_prompt: str, user_prompt: str, **kwargs):
        """Stream a completion from the LLM."""
