from functools import lru_cache

from app.config import settings
from app.providers.speech.base import SpeechProvider


@lru_cache(maxsize=1)
def get_speech_provider() -> SpeechProvider:
    """Factory that returns the configured speech provider (cached singleton)."""
    match settings.speech_provider:
        case "azure":
            from app.providers.speech.azure_speech import AzureSpeechProvider

            return AzureSpeechProvider()
        case "none":
            raise RuntimeError(
                "No speech provider configured. Set SPEECH_PROVIDER=azure in .env"
            )
        case _:
            raise ValueError(f"Unknown speech provider: {settings.speech_provider}")
