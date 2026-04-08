import logging
import tempfile
from pathlib import Path

import azure.cognitiveservices.speech as speechsdk
from azure.identity import DefaultAzureCredential

from app.config import settings
from app.providers.speech.base import SpeechProvider

logger = logging.getLogger(__name__)

_SPEECH_SCOPE = "https://cognitiveservices.azure.com/.default"


def _get_speech_config() -> speechsdk.SpeechConfig:
    """Build SpeechConfig using key auth or Entra ID token."""
    if settings.azure_speech_key:
        return speechsdk.SpeechConfig(
            subscription=settings.azure_speech_key,
            region=settings.azure_speech_region,
        )
    credential = DefaultAzureCredential()
    token = credential.get_token(_SPEECH_SCOPE)
    auth = speechsdk.auth.AuthorizationToken(
        auth_token=f"aad#{settings.azure_speech_resource_id}#{token.token}"
    )
    return speechsdk.SpeechConfig(auth_token=auth.token, region=settings.azure_speech_region)


class AzureSpeechProvider(SpeechProvider):
    """Azure Speech Services provider with Entra ID auth."""

    def __init__(self):
        self.speech_config = _get_speech_config()
        self.speech_config.speech_recognition_language = "en-US"

    async def transcribe(self, audio_data: bytes, language: str = "en-US") -> str:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name
        try:
            return await self.transcribe_file(tmp_path, language)
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    async def transcribe_file(self, file_path: str, language: str = "en-US") -> str:
        self.speech_config.speech_recognition_language = language
        audio_config = speechsdk.AudioConfig(filename=file_path)
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config, audio_config=audio_config
        )
        done = False
        segments: list[str] = []

        def on_recognized(evt):
            if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
                segments.append(evt.result.text)

        def on_session_stopped(evt):
            nonlocal done
            done = True

        def on_canceled(evt):
            nonlocal done
            if evt.cancellation_details.reason == speechsdk.CancellationReason.Error:
                logger.error("Speech recognition error: %s", evt.cancellation_details.error_details)
            done = True

        recognizer.recognized.connect(on_recognized)
        recognizer.session_stopped.connect(on_session_stopped)
        recognizer.canceled.connect(on_canceled)

        recognizer.start_continuous_recognition()

        import asyncio

        while not done:
            await asyncio.sleep(0.1)

        recognizer.stop_continuous_recognition()
        return " ".join(segments)
