"""Discovery Narrative router — synthesizes a coherent story from discovery context.

Reads the same gathered context the AI advisor uses (discovery metadata,
evidence, transcripts, problem statements, engagement repo content) and
asks the LLM to weave it into a narrative the team can share with
stakeholders. Optional `audience` and `style` shape the output.

Narratives are not persisted — clients re-generate on demand from the
latest source-of-truth state.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.providers.llm import get_llm_provider
from app.utils.context import gather_context

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


Audience = Literal["executive", "technical", "customer", "internal"]
Style = Literal["narrative", "brief", "outline"]


class NarrativeRequest(BaseModel):
    discovery_id: str = Field(min_length=1)
    audience: Audience = "executive"
    style: Style = "narrative"
    focus: str = Field(default="", max_length=1000)


class NarrativeResponse(BaseModel):
    discovery_id: str
    audience: Audience
    style: Style
    headline: str
    summary: str
    sections: list[dict[str, str]]


_AUDIENCE_GUIDE = {
    "executive": (
        "Audience: senior executives. Lead with business outcomes, "
        "decisions required, and risk. Avoid jargon."
    ),
    "technical": (
        "Audience: engineering leads. Surface technical constraints, "
        "integration risks, and architectural choices."
    ),
    "customer": (
        "Audience: the customer team. Reflect their language, "
        "validate that we heard them, and propose next steps collaboratively."
    ),
    "internal": (
        "Audience: the internal CORE delivery team. Be candid about "
        "open questions, blockers, and what we still need to learn."
    ),
}

_STYLE_GUIDE = {
    "narrative": "Write in flowing prose. 3-5 sections, each 1-2 paragraphs.",
    "brief": "Tight executive brief. Headline + 5 short bullets per section.",
    "outline": "Structured outline with nested bullets. No prose.",
}


def _build_prompt(audience: Audience, style: Style, focus: str, context: str) -> tuple[str, str]:
    system = (
        "You are the CORE Discovery Narrator. Synthesize discovery context "
        "into a clear, honest narrative that helps the team align and decide. "
        "Never fabricate facts beyond the supplied context. If a section "
        "lacks evidence, say so explicitly.\n\n"
        f"{_AUDIENCE_GUIDE[audience]}\n{_STYLE_GUIDE[style]}\n\n"
        "Return JSON with this shape:\n"
        "{\n"
        '  "headline": "single-sentence framing",\n'
        '  "summary": "2-3 sentence elevator summary",\n'
        '  "sections": [{"title": "...", "body": "..."}]\n'
        "}\n"
        "Recommended sections: Where We Are, What We Heard, What It Means, "
        "Open Questions, Recommended Next Steps."
    )
    user_parts = [f"Discovery context:\n{context or '(no context yet)'}"]
    if focus:
        user_parts.append(f"\nFocus the narrative on: {focus}")
    return system, "\n".join(user_parts)


@router.post("/generate", response_model=NarrativeResponse)
async def generate_narrative(request: NarrativeRequest) -> NarrativeResponse:
    """Generate a Discovery Narrative for the given discovery."""
    try:
        context = await gather_context(request.discovery_id)
    except Exception:
        logger.exception("Failed to gather context for %s", request.discovery_id)
        raise HTTPException(status_code=500, detail="Failed to gather context") from None

    system_prompt, user_prompt = _build_prompt(
        request.audience, request.style, request.focus, context
    )

    llm = get_llm_provider()
    try:
        result = await llm.complete_json(system_prompt, user_prompt, max_tokens=2500)
    except Exception:
        logger.exception("Narrative generation LLM call failed")
        raise HTTPException(status_code=502, detail="AI service unavailable") from None

    raw_sections = result.get("sections") or []
    sections = [
        {"title": str(s.get("title", "")).strip(), "body": str(s.get("body", "")).strip()}
        for s in raw_sections
        if isinstance(s, dict) and s.get("title")
    ]

    return NarrativeResponse(
        discovery_id=request.discovery_id,
        audience=request.audience,
        style=request.style,
        headline=str(result.get("headline", "")).strip(),
        summary=str(result.get("summary", "")).strip(),
        sections=sections,
    )
