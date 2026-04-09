"""Transcript Analyst — analyses meeting transcripts for insights and evidence."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from app.agents.base import AgentMeta, AgentResult, BaseAgent
from app.agents.registry import register
from app.models.core import (
    ConfidenceLevel,
    CorePhase,
    Evidence,
    TranscriptAnalysis,
    TranscriptInsight,
)
from app.utils.local_docs import read_docs_content

logger = logging.getLogger(__name__)

SYSTEM = (
    "You are the Transcript Analyst, a specialist sub-agent in the CORE "
    "Discovery Framework. You analyse meeting transcripts and extract "
    "structured insights, evidence items, sentiment, and key themes.\n\n"
    "For each insight you assess confidence: validated, assumed, unknown, "
    "or conflicting.\n"
    "For each evidence item you map it to a CORE phase: capture, orient, "
    "refine, or execute.\n\n"
    "Return JSON with format:\n"
    "{\n"
    '  "insights": [\n'
    '    {"text": "...", "confidence": "validated|assumed|unknown|conflicting",\n'
    '     "phase": "capture|orient|refine|execute"}\n'
    "  ],\n"
    '  "evidence": [\n'
    '    {"content": "...", "source": "transcript",\n'
    '     "confidence": "...", "phase": "...", "tags": [...]}\n'
    "  ],\n"
    '  "sentiment": "positive|neutral|negative|mixed",\n'
    '  "key_themes": ["..."]\n'
    "}"
)


class TranscriptAnalystAgent(BaseAgent):
    meta = AgentMeta(
        agent_id="transcript-analyst",
        name="Transcript Analyst",
        role="Analyses meeting transcripts to extract insights, evidence, "
        "and sentiment.",
        description=(
            "Processes meeting transcripts and produces structured "
            "insights with confidence levels, evidence mapped to CORE "
            "phases, sentiment indicators, and key themes."
        ),
        icon="FileAudio",
        phase="capture",
        expertise=[
            "transcript analysis",
            "insight extraction",
            "evidence mapping",
            "sentiment analysis",
            "theme identification",
        ],
    )
    system_prompt = SYSTEM
    collection = "transcript_analyses"

    async def run(
        self,
        discovery_id: str,
        user_instructions: str = "",
        *,
        transcript_text: str = "",
        **kwargs: Any,
    ) -> AgentResult:
        if not transcript_text.strip():
            raise HTTPException(
                status_code=422, detail="No transcript text provided."
            )

        storage = self._storage()

        # Include local docs for richer analysis
        docs_context = ""
        try:
            disc = await storage.get("discoveries", discovery_id)
            docs_path = (disc or {}).get("docs_path", "")
            if docs_path:
                content = read_docs_content(docs_path)
                if content:
                    docs_context = (
                        f"\n\nProject documents for context:\n{content}"
                    )
        except Exception:
            pass

        user_prompt = (
            f"Analyze this transcript:\n\n"
            f"{transcript_text[:15000]}{docs_context}"
        )

        try:
            result = await self._llm().complete_json(
                self.system_prompt, user_prompt, max_tokens=4000
            )
        except Exception:
            logger.exception("Transcript Analyst LLM call failed")
            raise HTTPException(
                status_code=502, detail="AI service unavailable"
            )

        evidence_items = []
        for e in result.get("evidence", []):
            try:
                evidence_items.append(
                    Evidence(
                        discovery_id=discovery_id,
                        phase=CorePhase(e.get("phase", "capture")),
                        content=e.get("content", ""),
                        source="transcript",
                        confidence=ConfidenceLevel(
                            e.get("confidence", "unknown")
                        ),
                        tags=e.get("tags", []),
                    )
                )
            except ValueError:
                continue

        insights = []
        for i in result.get("insights", []):
            try:
                insights.append(
                    TranscriptInsight(
                        text=i.get("text", ""),
                        confidence=ConfidenceLevel(
                            i.get("confidence", "unknown")
                        ),
                        phase=CorePhase(i.get("phase", "capture")),
                    )
                )
            except ValueError:
                continue

        analysis = TranscriptAnalysis(
            discovery_id=discovery_id,
            transcript_text=transcript_text[:500] + "...",
            insights=insights,
            evidence_extracted=evidence_items,
            sentiment=result.get("sentiment", ""),
            key_themes=result.get("key_themes", []),
        )

        try:
            saved = await self._save(analysis.model_dump(mode="json"))
        except Exception:
            logger.exception("Failed to persist transcript analysis")
            raise HTTPException(
                status_code=500, detail="Failed to save analysis"
            )

        return AgentResult(
            agent_id=self.meta.agent_id,
            agent_name=self.meta.name,
            data=saved,
        )


transcript_analyst = register(TranscriptAnalystAgent())
