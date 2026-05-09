import tempfile
from pathlib import Path

from openai import AsyncOpenAI

from app.config import settings
from app.providers.speech.base import SpeechProvider


class OpenAISpeechProvider(SpeechProvider):
    """OpenAI-compatible audio transcription provider."""

    def __init__(self):
        api_key = settings.openai_transcription_api_key.strip() or settings.openai_api_key
        base_url = (
            settings.openai_transcription_base_url.strip()
            or settings.openai_base_url.strip()
            or None
        )
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = settings.openai_transcription_model.strip() or "gpt-4o-transcribe"

    async def transcribe(self, audio_data: bytes, language: str = "en-US") -> str:
        with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name
        try:
            return await self.transcribe_file(tmp_path, language)
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    async def transcribe_file(self, file_path: str, language: str = "en-US") -> str:
        with Path(file_path).open("rb") as audio_file:
            result = await self.client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
            )
        text = getattr(result, "text", "")
        return str(text or "").strip()
