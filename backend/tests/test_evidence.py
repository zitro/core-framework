"""Tests for the evidence router — CRUD and filtering."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_evidence(client: AsyncClient):
    resp = await client.post(
        "/api/evidence/",
        json={
            "discovery_id": "disc-1",
            "phase": "capture",
            "content": "User mentioned pain with reporting",
            "source": "interview",
            "confidence": "assumed",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "User mentioned pain with reporting"
    assert data["phase"] == "capture"


@pytest.mark.asyncio
async def test_upload_evidence_extracts_text_file(client: AsyncClient):
    resp = await client.post(
        "/api/evidence/upload",
        data={
            "discovery_id": "disc-upload-1",
            "phase": "capture",
            "evidence_type": "general",
            "note": "Customer sent discovery notes",
            "tags": "document,customer-input",
        },
        files={"file": ("notes.txt", b"The claims workflow is manual.", "text/plain")},
    )

    assert resp.status_code == 201
    data = resp.json()
    assert "Customer sent discovery notes" in data["content"]
    assert "The claims workflow is manual." in data["content"]
    assert data["source"] == "notes.txt"
    assert "extracted-text" in data["tags"]


@pytest.mark.asyncio
async def test_upload_evidence_saves_unsupported_file_metadata(client: AsyncClient):
    resp = await client.post(
        "/api/evidence/upload",
        data={"discovery_id": "disc-upload-2", "phase": "capture"},
        files={"file": ("recording.bin", b"binary-content", "application/octet-stream")},
    )

    assert resp.status_code == 201
    data = resp.json()
    assert "Attached file: recording.bin" in data["content"]
    assert "Size:" in data["content"]
    assert "attachment" in data["tags"]


@pytest.mark.asyncio
async def test_upload_evidence_accepts_recording_without_speech_provider(
    client: AsyncClient, monkeypatch
):
    from app.config import settings

    original_provider = settings.speech_provider
    try:
        monkeypatch.setattr(settings, "speech_provider", "none")
        resp = await client.post(
            "/api/evidence/upload",
            data={
                "discovery_id": "disc-recording-1",
                "phase": "capture",
                "tags": "recording",
            },
            files={"file": ("meeting.mp3", b"fake-audio", "audio/mpeg")},
        )
    finally:
        monkeypatch.setattr(settings, "speech_provider", original_provider)

    assert resp.status_code == 201
    data = resp.json()
    assert "Attached file: meeting.mp3" in data["content"]
    assert "media" in data["tags"]
    assert "attachment" in data["tags"]
    assert "recording" in data["tags"]


@pytest.mark.asyncio
async def test_upload_evidence_transcribes_recording_with_speech_provider(
    client: AsyncClient, monkeypatch
):
    from app.config import settings

    class FakeSpeechProvider:
        async def transcribe(self, audio_data: bytes, language: str = "en-US") -> str:
            return "unused"

        async def transcribe_file(self, file_path: str, language: str = "en-US") -> str:
            assert file_path.endswith(".mp3")
            return "Meeting transcript from speech provider."

    original_provider = settings.speech_provider
    try:
        monkeypatch.setattr(settings, "speech_provider", "azure")
        monkeypatch.setattr(
            "app.providers.speech.get_speech_provider", lambda: FakeSpeechProvider()
        )
        resp = await client.post(
            "/api/evidence/upload",
            data={"discovery_id": "disc-recording-2", "phase": "capture"},
            files={"file": ("meeting.mp3", b"fake-audio", "audio/mpeg")},
        )
    finally:
        monkeypatch.setattr(settings, "speech_provider", original_provider)

    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "Meeting transcript from speech provider."
    assert "media" in data["tags"]
    assert "transcribed" in data["tags"]


@pytest.mark.asyncio
async def test_list_evidence_by_discovery(client: AsyncClient):
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "capture", "content": "Evidence A"},
    )
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "orchestrate", "content": "Evidence B"},
    )
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d2", "phase": "capture", "content": "Other"},
    )

    resp = await client.get("/api/evidence/d1")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2


@pytest.mark.asyncio
async def test_list_evidence_with_phase_filter(client: AsyncClient):
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "capture", "content": "A"},
    )
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "orchestrate", "content": "B"},
    )

    resp = await client.get("/api/evidence/d1?phase=capture")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["phase"] == "capture"


@pytest.mark.asyncio
async def test_update_evidence(client: AsyncClient):
    create = await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "capture", "content": "Original"},
    )
    eid = create.json()["id"]
    resp = await client.patch(f"/api/evidence/{eid}", json={"content": "Revised"})
    assert resp.status_code == 200
    assert resp.json()["content"] == "Revised"


@pytest.mark.asyncio
async def test_delete_evidence(client: AsyncClient):
    create = await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "capture", "content": "Temp"},
    )
    eid = create.json()["id"]
    resp = await client.delete(f"/api/evidence/{eid}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
