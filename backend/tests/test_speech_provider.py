from unittest.mock import AsyncMock

import pytest

from app.config import settings
from app.providers.speech import get_speech_provider
from app.providers.speech.openai_speech import OpenAISpeechProvider


def test_speech_provider_factory_supports_openai(monkeypatch):
    get_speech_provider.cache_clear()
    original_provider = settings.speech_provider
    original_key = settings.openai_transcription_api_key
    try:
        monkeypatch.setattr(settings, "speech_provider", "openai")
        monkeypatch.setattr(settings, "openai_transcription_api_key", "test-key")

        provider = get_speech_provider()

        assert isinstance(provider, OpenAISpeechProvider)
    finally:
        monkeypatch.setattr(settings, "speech_provider", original_provider)
        monkeypatch.setattr(settings, "openai_transcription_api_key", original_key)
        get_speech_provider.cache_clear()


def test_azure_speech_config_supports_entra_auth(monkeypatch):
    pytest.importorskip("azure.cognitiveservices.speech")
    from app.providers.speech import azure_speech

    class FakeToken:
        token = "token-value"

    class FakeCredential:
        def get_token(self, scope: str):
            assert scope == "https://cognitiveservices.azure.com/.default"
            return FakeToken()

    class FakeSpeechConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    original_key = settings.azure_speech_key
    original_region = settings.azure_speech_region
    original_resource_id = settings.azure_speech_resource_id
    try:
        monkeypatch.setattr(settings, "azure_speech_key", "")
        monkeypatch.setattr(settings, "azure_speech_region", "eastus")
        monkeypatch.setattr(settings, "azure_speech_resource_id", "resource-id")
        monkeypatch.setattr(azure_speech, "DefaultAzureCredential", lambda: FakeCredential())
        monkeypatch.setattr(azure_speech.speechsdk, "SpeechConfig", FakeSpeechConfig)

        config = azure_speech._get_speech_config()

        assert config.kwargs == {
            "auth_token": "aad#resource-id#token-value",
            "region": "eastus",
        }
    finally:
        monkeypatch.setattr(settings, "azure_speech_key", original_key)
        monkeypatch.setattr(settings, "azure_speech_region", original_region)
        monkeypatch.setattr(settings, "azure_speech_resource_id", original_resource_id)


@pytest.mark.asyncio
async def test_openai_speech_provider_uses_configured_model(monkeypatch, tmp_path):
    original_model = settings.openai_transcription_model
    original_key = settings.openai_transcription_api_key
    try:
        monkeypatch.setattr(settings, "openai_transcription_model", "custom-transcribe-model")
        monkeypatch.setattr(settings, "openai_transcription_api_key", "test-key")
        provider = OpenAISpeechProvider()
        provider.client.audio.transcriptions.create = AsyncMock(
            return_value=type("Transcription", (), {"text": "Captured transcript"})()
        )
        audio_path = tmp_path / "meeting.mp3"
        audio_path.write_bytes(b"fake-audio")

        text = await provider.transcribe_file(str(audio_path))

        assert text == "Captured transcript"
        provider.client.audio.transcriptions.create.assert_awaited_once()
        call = provider.client.audio.transcriptions.create.await_args.kwargs
        assert call["model"] == "custom-transcribe-model"
    finally:
        monkeypatch.setattr(settings, "openai_transcription_model", original_model)
        monkeypatch.setattr(settings, "openai_transcription_api_key", original_key)