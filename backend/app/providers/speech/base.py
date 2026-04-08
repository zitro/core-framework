from abc import ABC, abstractmethod


class SpeechProvider(ABC):
    """Abstract base for speech-to-text transcription."""

    @abstractmethod
    async def transcribe(self, audio_data: bytes, language: str = "en-US") -> str:
        """Transcribe audio bytes to text."""

    @abstractmethod
    async def transcribe_file(self, file_path: str, language: str = "en-US") -> str:
        """Transcribe an audio file to text."""
