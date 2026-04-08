from app.config import settings
from app.providers.llm.base import LLMProvider


def get_llm_provider() -> LLMProvider:
    """Factory that returns the configured LLM provider."""
    match settings.llm_provider:
        case "azure":
            from app.providers.llm.azure_openai import AzureOpenAIProvider

            return AzureOpenAIProvider()
        case "openai":
            from app.providers.llm.openai_provider import OpenAIProvider

            return OpenAIProvider()
        case "local" | "ollama":
            from app.providers.llm.ollama import OllamaProvider

            return OllamaProvider()
        case _:
            raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")
