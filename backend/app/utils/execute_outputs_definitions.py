"""Execute output definitions and audience/style guides."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

Audience = Literal["executive", "technical", "customer", "internal"]
Style = Literal["narrative", "brief", "outline"]
Category = Literal["stakeholder", "delivery", "technical"]


class ExecuteOutputDefinition(BaseModel):
    id: str
    title: str
    description: str
    audience: Audience
    style: Style
    focus: str
    category: Category


OUTPUT_DEFINITIONS: list[ExecuteOutputDefinition] = [
    ExecuteOutputDefinition(
        id="executive-brief",
        title="Executive Decision Brief",
        description="Decision-ready summary with recommendation, evidence, risks, and asks.",
        audience="executive",
        style="brief",
        focus="Create a final executive decision brief for sponsors. Include the recommendation, why now, evidence, risks, decisions needed, and next steps.",
        category="stakeholder",
    ),
    ExecuteOutputDefinition(
        id="customer-summary",
        title="Customer Summary Update",
        description="Customer-facing recap that confirms what was heard and what happens next.",
        audience="customer",
        style="brief",
        focus="Create a customer-facing discovery summary update. Reflect the customer's language, summarize what we heard, what we recommend, open questions, and next actions.",
        category="stakeholder",
    ),
    ExecuteOutputDefinition(
        id="weekly-update",
        title="Weekly Update Email",
        description="Copy-ready weekly update with progress, decisions, blockers, and next week plan.",
        audience="internal",
        style="brief",
        focus="Create a weekly status email. Include progress this week, key decisions, blockers, risks, asks, and next week priorities.",
        category="delivery",
    ),
    ExecuteOutputDefinition(
        id="deck-outline",
        title="Stakeholder Deck Outline",
        description="Slide-by-slide storyline for the final presentation package.",
        audience="executive",
        style="outline",
        focus="Create a stakeholder deck outline. Include slide titles, slide purpose, key message, and the evidence or artifact each slide should reference.",
        category="stakeholder",
    ),
    ExecuteOutputDefinition(
        id="technical-handoff",
        title="Technical Handoff Brief",
        description="Build-team handoff with architecture, dependencies, risks, and open decisions.",
        audience="technical",
        style="outline",
        focus="Create a technical handoff brief for implementation leads. Include architecture direction, integration points, dependencies, validation gaps, risks, and immediate engineering work items.",
        category="technical",
    ),
]

OUTPUT_BY_ID: dict[str, ExecuteOutputDefinition] = {
    definition.id: definition for definition in OUTPUT_DEFINITIONS
}

AUDIENCE_GUIDE: dict[str, str] = {
    "executive": (
        "Audience: senior executives. Lead with business outcomes, decisions required, "
        "material risks, and the recommendation. Avoid jargon."
    ),
    "technical": (
        "Audience: implementation and architecture leads. Surface architecture direction, "
        "technical constraints, dependencies, integration risks, and open decisions."
    ),
    "customer": (
        "Audience: the customer team. Reflect their language, validate what was heard, "
        "and make next steps clear without overclaiming."
    ),
    "internal": (
        "Audience: the delivery team. Be candid about progress, risks, blockers, owners, "
        "and what needs attention next."
    ),
}

STYLE_GUIDE: dict[str, str] = {
    "narrative": "Write in flowing prose. 3-5 sections, each 1-2 paragraphs.",
    "brief": "Tight brief. Headline + concise bullets or short paragraphs per section.",
    "outline": "Structured outline with clear headings and bullets. No long prose.",
}


def build_system_prompt(definition: ExecuteOutputDefinition) -> str:
    return (
        "You are the CORE Execute artifact generator. Create final, stakeholder-ready "
        "delivery material from the complete discovery record across Capture, Orchestrate, "
        "Refine, and Execute. Use only supplied context; do not invent facts. If evidence is "
        "missing, say what is not yet supported.\n\n"
        f"Artifact: {definition.title}\n"
        f"{AUDIENCE_GUIDE[definition.audience]}\n"
        f"{STYLE_GUIDE[definition.style]}\n\n"
        "Return JSON with this exact shape:\n"
        "{\n"
        '  "headline": "single-sentence framing",\n'
        '  "summary": "2-3 sentence summary",\n'
        '  "sections": [{"title": "...", "body": "..."}]\n'
        "}\n"
    )
