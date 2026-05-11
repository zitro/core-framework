"""ArtifactType entries for the Why category.

Generated as part of the 300-line cleanup; do not edit by hand
unless you mean to. Add new artifact types here (then the package
__init__ picks them up via the registry list)."""

from __future__ import annotations

from app.synthesis.categories import Category
from app.synthesis.types._base import ArtifactType

WHY_TYPES: list[ArtifactType] = [
    ArtifactType(
        id="problem-statement",
        category=Category.WHY,
        label="Problem Statement",
        description="The single sentence that names the pain.",
        body_schema={
            "statement": "One sentence: who suffers what, when, why it matters.",
            "evidence": "List of short bullets pointing to corpus passages.",
        },
        prompt=(
            "Write the sharpest possible problem statement. One sentence. "
            "It must name the user, the pain, the trigger, and the cost of "
            "inaction. Do not invent specifics that the corpus does not "
            "support."
        ),
        critical=True,
    ),
    ArtifactType(
        id="customer-pain",
        category=Category.WHY,
        label="Customer Pain Points",
        description="Concrete pains, ranked by severity.",
        body_schema={"pains": "List of {pain, who_feels_it, severity (1-5), evidence}"},
        prompt="Extract distinct customer pains. Rank by severity. Cite evidence.",
        critical=True,
    ),
    ArtifactType(
        id="business-driver",
        category=Category.WHY,
        label="Business Drivers",
        description="What is forcing this conversation now.",
        body_schema={"drivers": "List of {driver, urgency_reason, source}"},
        prompt=(
            "Identify the business drivers — regulatory, competitive, "
            "financial, organizational — making this initiative urgent now."
        ),
    ),
    ArtifactType(
        id="persona",
        category=Category.WHY,
        label="Personas",
        description="Who we're designing for.",
        body_schema={
            "personas": ("List of {name, role, goals, frustrations, daily_workflow, tools_used}"),
        },
        prompt=(
            "Describe 2–4 personas grounded in the corpus. No generic clip-art "
            "personas. Goals and frustrations must trace back to source quotes."
        ),
        critical=True,
    ),
    ArtifactType(
        id="journey-map",
        category=Category.WHY,
        label="Journey Map",
        description="What the user does today, step by step.",
        body_schema={
            "persona": "Which persona this journey belongs to.",
            "stages": (
                "Ordered list of {stage, actions, thoughts, emotions (-2..+2), "
                "pain_points, opportunities}"
            ),
        },
        prompt=(
            "Map the current-state journey for the primary persona. Be honest "
            "about the low-emotion moments — those are where value lives."
        ),
    ),
    ArtifactType(
        id="interview-guide",
        category=Category.WHY,
        label="Interview Guide",
        description="Pre-call prep: who, what to ask, what to listen for.",
        body_schema={
            "audience": "Role / persona being interviewed.",
            "objectives": "List of what we need to learn from this conversation.",
            "questions": (
                "List of {question, intent, follow_ups}. Open-ended; never "
                "leading. 8-12 questions max."
            ),
            "listen_for": "List of signals or quotes that would change our framing.",
        },
        prompt=(
            "Draft a stakeholder interview guide. Questions must be open and "
            "non-leading. Order from broad context to specific pain. Each "
            "question states the intent so the interviewer knows when the "
            "answer satisfies it. Pull audience and objectives from the "
            "corpus when possible."
        ),
    ),
    ArtifactType(
        id="empathy-map",
        category=Category.WHY,
        label="Empathy Map",
        description="What the user says, thinks, does, and feels.",
        body_schema={
            "persona": "Persona this map represents.",
            "says": "List of direct quotes or paraphrased statements from the corpus.",
            "thinks": "List of inferred thoughts; mark each as {text, evidence}.",
            "does": "List of observed or reported behaviours.",
            "feels": "List of emotional states with the trigger that caused them.",
        },
        prompt=(
            "Build an empathy map for the primary persona. `says` must be "
            "direct quotes when available. `thinks` are inferences and must "
            "cite the evidence that justifies them. Do not invent emotions; "
            "if the corpus does not support a feeling, omit it."
        ),
    ),
    ArtifactType(
        id="jtbd",
        category=Category.WHY,
        label="Jobs to be Done",
        description="When [situation], I want to [motivation], so I can [outcome].",
        body_schema={
            "jobs": (
                "List of {situation, motivation, outcome, evidence}. 3-6 jobs. "
                "One sentence each in the When/I want/So I can shape."
            ),
        },
        prompt=(
            "Extract the jobs the user is hiring this work to do. Each job "
            "is a triplet of situation, motivation, outcome — phrased as the "
            "user would say it, not as the team interprets it. Cite the "
            "corpus passage for each job."
        ),
    ),
    ArtifactType(
        id="emerging-themes",
        category=Category.WHY,
        label="Emerging Themes",
        description="Recurring patterns in the corpus that may seed future engagements.",
        body_schema={
            "themes": (
                "List of {theme, frequency (1-5), supporting_evidence, "
                "potential_engagement (yes|maybe|no), rationale}"
            ),
            "watchlist": ("Single-line items worth monitoring but not yet a full theme."),
        },
        prompt=(
            "Scan the corpus for recurring patterns that are NOT already "
            "covered by a current artifact. Surface 3-7 themes that appear "
            "in multiple sources. For each, judge whether it could seed a "
            "future engagement (yes / maybe / no) and explain why. This is "
            "an opportunity radar, not a deliverable — be conservative; do "
            "not invent themes from a single mention."
        ),
    ),
    ArtifactType(
        id="root-cause",
        category=Category.WHY,
        label="Root Cause Analysis",
        description="Five Whys from a visible symptom to a defensible root.",
        body_schema={
            "symptom": "The observable problem as it shows up to the user.",
            "whys": (
                "Ordered list of {why_question, answer, evidence}. 3-5 entries; "
                "each answer must cite a corpus passage."
            ),
            "root_cause": "One-sentence statement of the root cause.",
            "confidence": "low|medium|high — based on evidence strength.",
        },
        prompt=(
            "Push from symptom to root cause by asking why up to five times. "
            "Stop when the next 'why' would require speculation beyond the "
            "corpus. Every answer must cite evidence. If evidence is thin, "
            "set confidence to low and say so explicitly. Do not fabricate "
            "causal chains."
        ),
    ),
]
