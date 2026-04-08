from fastapi import APIRouter
from pydantic import BaseModel

from app.models.core import ConfidenceLevel, CorePhase, Evidence, TranscriptAnalysis
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider

router = APIRouter()

TRANSCRIPT_SYSTEM_PROMPT = """You are an expert product discovery analyst using the CORE framework.
Analyze this meeting transcript and extract:
1. Key insights (with confidence levels: validated, assumed, unknown, conflicting)
2. Evidence items that map to CORE phases (capture, orient, refine, execute)
3. Sentiment indicators for stakeholder engagement
4. Key themes and patterns

Return JSON with format:
{
  "insights": [{"text": "...", "confidence": "validated|assumed|unknown|conflicting", "phase": "capture|orient|refine|execute"}],
  "evidence": [{"content": "...", "source": "transcript", "confidence": "...", "phase": "...", "tags": [...]}],
  "sentiment": "positive|neutral|negative|mixed",
  "key_themes": ["..."]
}"""


class TranscriptRequest(BaseModel):
    discovery_id: str
    transcript_text: str


@router.post("/analyze", response_model=TranscriptAnalysis)
async def analyze_transcript(request: TranscriptRequest):
    llm = get_llm_provider()
    storage = get_storage_provider()

    result = await llm.complete_json(
        TRANSCRIPT_SYSTEM_PROMPT,
        f"Analyze this transcript:\n\n{request.transcript_text[:15000]}",
        max_tokens=4000,
    )

    evidence_items = [
        Evidence(
            discovery_id=request.discovery_id,
            phase=CorePhase(e.get("phase", "capture")),
            content=e.get("content", ""),
            source="transcript",
            confidence=ConfidenceLevel(e.get("confidence", "unknown")),
            tags=e.get("tags", []),
        )
        for e in result.get("evidence", [])
    ]

    analysis = TranscriptAnalysis(
        discovery_id=request.discovery_id,
        transcript_text=request.transcript_text[:500] + "...",
        insights=result.get("insights", []),
        evidence_extracted=evidence_items,
        sentiment=result.get("sentiment", ""),
        key_themes=result.get("key_themes", []),
    )

    saved = await storage.create("transcript_analyses", analysis.model_dump(mode="json"))
    return TranscriptAnalysis(**saved)
