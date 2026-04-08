import logging

from fastapi import APIRouter, HTTPException
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
