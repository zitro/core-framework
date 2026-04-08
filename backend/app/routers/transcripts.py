import logging
import uuid

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.models.core import (
    ConfidenceLevel,
    CorePhase,
    Evidence,
    TranscriptAnalysis,
    TranscriptInsight,
)
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider

logger = logging.getLogger(__name__)

router = APIRouter()

TRANSCRIPT_SYSTEM_PROMPT = """You are an expert product discovery analyst using the CORE framework.
Analyze this meeting transcript and extract:
1. Key insights (with confidence levels: validated, assumed, unknown, conflicting)
2. Evidence items that map to CORE phases (capture, orient, refine, execute)
3. Sentiment indicators for stakeholder engagement
4. Key themes and patterns

Return JSON with format:
{
  "insights": [
    {"text": "...", "confidence": "validated|assumed|unknown|conflicting",
     "phase": "capture|orient|refine|execute"}
  ],
  "evidence": [
    {"content": "...", "source": "transcript",
     "confidence": "...", "phase": "...", "tags": [...]}
  ],
  "sentiment": "positive|neutral|negative|mixed",
  "key_themes": ["..."]
}"""

MAX_TRANSCRIPT_LENGTH = 50000


class TranscriptRequest(BaseModel):
    discovery_id: str
    transcript_text: str = Field(..., max_length=MAX_TRANSCRIPT_LENGTH)


@router.post("/analyze", response_model=TranscriptAnalysis)
async def analyze_transcript(request: TranscriptRequest):
    llm = get_llm_provider()
    storage = get_storage_provider()

    try:
        result = await llm.complete_json(
            TRANSCRIPT_SYSTEM_PROMPT,
            f"Analyze this transcript:\n\n{request.transcript_text[:15000]}",
            max_tokens=4000,
        )
    except Exception:
        logger.exception("LLM call failed for transcript analysis")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    evidence_items = []
    for e in result.get("evidence", []):
        try:
            evidence_items.append(
                Evidence(
                    discovery_id=request.discovery_id,
                    phase=CorePhase(e.get("phase", "capture")),
                    content=e.get("content", ""),
                    source="transcript",
                    confidence=ConfidenceLevel(e.get("confidence", "unknown")),
                    tags=e.get("tags", []),
                )
            )
        except ValueError:
            continue  # Skip evidence with invalid enum values

    insights = []
    for i in result.get("insights", []):
        try:
            insights.append(
                TranscriptInsight(
                    text=i.get("text", ""),
                    confidence=ConfidenceLevel(i.get("confidence", "unknown")),
                    phase=CorePhase(i.get("phase", "capture")),
                )
            )
        except ValueError:
            continue

    analysis = TranscriptAnalysis(
        discovery_id=request.discovery_id,
        transcript_text=request.transcript_text[:500] + "...",
        insights=insights,
        evidence_extracted=evidence_items,
        sentiment=result.get("sentiment", ""),
        key_themes=result.get("key_themes", []),
    )

    saved = await storage.create("transcript_analyses", analysis.model_dump(mode="json"))
    return TranscriptAnalysis(**saved)


MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post("/upload-audio")
async def upload_and_transcribe(discovery_id: str, file: UploadFile):
    """Upload an audio file, store in blob, transcribe via Speech, then analyze."""
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio type")

    audio_data = await file.read()
    if len(audio_data) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=413, detail="Audio file exceeds 25 MB limit")

    from app.providers.blob import get_blob_provider
    from app.providers.speech import get_speech_provider

    blob = get_blob_provider()
    speech = get_speech_provider()

    blob_name = f"{discovery_id}/{uuid.uuid4()}-{file.filename}"
    try:
        await blob.upload("transcripts", blob_name, audio_data, file.content_type)
    except Exception:
        logger.exception("Failed to upload audio to blob storage")
        raise HTTPException(status_code=502, detail="File storage unavailable")

    try:
        transcript_text = await speech.transcribe(audio_data)
    except Exception:
        logger.exception("Speech transcription failed")
        raise HTTPException(status_code=502, detail="Speech service unavailable")

    if not transcript_text.strip():
        raise HTTPException(status_code=422, detail="No speech detected in audio")

    request = TranscriptRequest(discovery_id=discovery_id, transcript_text=transcript_text)
    return await analyze_transcript(request)
