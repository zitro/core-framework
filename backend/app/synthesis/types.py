"""Artifact-type registry.

Each ``ArtifactType`` describes one thing the generator knows how to produce:
its category, a human label, the JSON shape its ``body`` will fill, and a
generation prompt fragment. The full prompt is assembled in ``prompts.py``
from this fragment + a shared system frame + the corpus + critic feedback.

Adding a new artifact type = appending one entry to ``ARTIFACT_TYPES``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.synthesis.categories import Category


@dataclass(frozen=True)
class ArtifactType:
    id: str
    category: Category
    label: str
    description: str
    # JSON-schema-ish hint shown to the LLM. Keys are body fields, values are
    # short descriptions of what that field should contain.
    body_schema: dict[str, str] = field(default_factory=dict)
    # Prompt fragment appended after the shared system frame.
    prompt: str = ""
    # Critical types must exist for a project to be considered "complete".
    critical: bool = False


ARTIFACT_TYPES: list[ArtifactType] = [
    # ── WHY ───────────────────────────────────────────────────────────
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
    # ── VALUE ─────────────────────────────────────────────────────────
    ArtifactType(
        id="value-hypothesis",
        category=Category.VALUE,
        label="Value Hypothesis",
        description="If we do X, then Y, because Z.",
        body_schema={
            "hypothesis": "Single if/then/because sentence.",
            "leading_indicators": "List of early signals success is happening.",
        },
        prompt=(
            "Frame the value as a falsifiable hypothesis. The 'because' must "
            "be defensible from the corpus."
        ),
        critical=True,
    ),
    ArtifactType(
        id="kpi",
        category=Category.VALUE,
        label="Outcome KPIs",
        description="The measurable results we're chasing.",
        body_schema={
            "kpis": ("List of {name, baseline, target, timeframe, measurement_method}"),
        },
        prompt=(
            "Pick 3–6 KPIs that prove value, not effort. Prefer outcome "
            "metrics over output metrics."
        ),
    ),
    ArtifactType(
        id="roi-narrative",
        category=Category.VALUE,
        label="ROI Narrative",
        description="The money story, in plain English.",
        body_schema={
            "current_cost": "What this problem costs today (best estimate, with assumptions).",
            "expected_savings": "What changes if we solve it.",
            "assumptions": "List of stated assumptions.",
        },
        prompt=(
            "Tell the ROI story. Be explicit about assumptions; never fabricate "
            "numbers. If the corpus has no figures, say so."
        ),
    ),
    ArtifactType(
        id="strategic-alignment",
        category=Category.VALUE,
        label="Strategic Alignment",
        description="Why this matches the customer's stated strategy.",
        body_schema={
            "customer_priorities": "Their published / cited priorities.",
            "alignment": "How this work maps to each priority.",
        },
        prompt=(
            "Show how the proposed work aligns with the customer's "
            "publicly-stated or corpus-evidenced strategic priorities."
        ),
    ),
    ArtifactType(
        id="success-criteria",
        category=Category.VALUE,
        label="Success Criteria",
        description="How we'll know we're done.",
        body_schema={"criteria": "List of {criterion, measurement, owner}"},
        prompt="Define unambiguous, measurable success criteria for the engagement.",
    ),
    # ── WHAT ──────────────────────────────────────────────────────────
    ArtifactType(
        id="workstream",
        category=Category.WHAT,
        label="Workstreams",
        description="The parallel tracks of work.",
        body_schema={
            "workstreams": ("List of {name, goal, key_outcomes, owner_role, dependencies}"),
        },
        prompt=(
            "Decompose the engagement into 2–5 workstreams. Each must have a "
            "single owning role and a single goal."
        ),
        critical=True,
    ),
    ArtifactType(
        id="capability",
        category=Category.WHAT,
        label="Required Capabilities",
        description="Capabilities the solution must have.",
        body_schema={
            "capabilities": "List of {capability, why_needed, current_gap}",
        },
        prompt=(
            "List the capabilities the solution must provide. Note which ones "
            "the customer already has and which are net-new."
        ),
    ),
    ArtifactType(
        id="feature",
        category=Category.WHAT,
        label="Candidate Features",
        description="Concrete features worth prototyping.",
        body_schema={
            "features": ("List of {name, user_story, acceptance, priority (must|should|could)}"),
        },
        prompt=(
            "Propose candidate features as user stories. Use MoSCoW priority. "
            "Stay close to what the corpus actually asks for."
        ),
    ),
    ArtifactType(
        id="hmw",
        category=Category.WHAT,
        label="How-Might-We Statements",
        description="Reframed problems as solution prompts.",
        body_schema={"hmws": "List of HMW statements with the pain they reframe."},
        prompt=(
            "Write 5–8 'How might we…' statements that reframe each major pain "
            "as a solvable design challenge."
        ),
    ),
    ArtifactType(
        id="solution-sketch",
        category=Category.WHAT,
        label="Solution Sketch",
        description="The plain-English shape of the solution.",
        body_schema={
            "elevator_pitch": "Two sentences a non-technical exec would understand.",
            "key_components": "List of {component, responsibility}",
        },
        prompt=(
            "Sketch the solution as you'd whiteboard it for the CIO. No "
            "vendor names unless the corpus asks for them."
        ),
        critical=True,
    ),
    # ── SCOPE ─────────────────────────────────────────────────────────
    ArtifactType(
        id="phase-plan",
        category=Category.SCOPE,
        label="Phase Plan",
        description="FDE / Workshop / Hackathon / MVE / MVP envelope.",
        body_schema={
            "phases": (
                "Ordered list of {phase (fde|workshop|hackathon|mve|mvp), "
                "duration, goal, exit_criteria}"
            ),
        },
        prompt=(
            "Propose a phased plan across the standard Microsoft envelopes "
            "(FDE Triage, design workshop, hackathon, MVE, MVP). Pick only "
            "the phases that fit; skip the ones that don't."
        ),
        critical=True,
    ),
    ArtifactType(
        id="in-out-of-scope",
        category=Category.SCOPE,
        label="In / Out of Scope",
        description="The boundary line, drawn explicitly.",
        body_schema={
            "in_scope": "List of items.",
            "out_of_scope": "List of items, each with a 1-line reason.",
        },
        prompt=(
            "Draw the scope line. Out-of-scope items must each have a stated "
            "reason — deferred, owned by another team, requires more discovery."
        ),
        critical=True,
    ),
    ArtifactType(
        id="timeline",
        category=Category.SCOPE,
        label="Timeline",
        description="Milestones with dates or week offsets.",
        body_schema={
            "milestones": "List of {name, week_offset, deliverables, decision}",
        },
        prompt=(
            "Lay out milestones using week offsets from kickoff. Each "
            "milestone must produce a deliverable AND a decision."
        ),
    ),
    ArtifactType(
        id="resource-plan",
        category=Category.SCOPE,
        label="Resource Plan",
        description="Who's needed, from where, when.",
        body_schema={
            "roles": "List of {role, allocation_pct, source (msft|customer|partner), phases}",
        },
        prompt=(
            "Identify the roles required across phases. Mark Microsoft, "
            "customer, and partner contributions separately."
        ),
    ),
    ArtifactType(
        id="workshop-plan",
        category=Category.SCOPE,
        label="Workshop Plan",
        description="Agenda for the design workshop.",
        body_schema={
            "objectives": "What the workshop must deliver.",
            "agenda": "Ordered list of {block, duration_min, method, owner}",
            "preread": "List of preread items participants need.",
        },
        prompt=(
            "Design a 1–2 day workshop agenda. Each block names a Design "
            "Thinking method from the methodology catalog when applicable."
        ),
    ),
    # ── HOW ───────────────────────────────────────────────────────────
    ArtifactType(
        id="tech-option",
        category=Category.HOW,
        label="Technology Options",
        description="Candidate technical approaches with trade-offs.",
        body_schema={
            "options": ("List of {name, summary, pros, cons, fit_score (1-5), azure_services}"),
        },
        prompt=(
            "Compare 2–4 candidate technical approaches. Be honest about the "
            "cons. Prefer Microsoft / Azure services when the corpus signals "
            "they're the right fit; do not force them."
        ),
        critical=True,
    ),
    ArtifactType(
        id="architecture-sketch",
        category=Category.HOW,
        label="Architecture Sketch",
        description="High-level boxes and lines.",
        body_schema={
            "components": "List of {name, role, technology}",
            "flows": "List of {from, to, payload, sync_or_async}",
            "narrative": "Two-paragraph plain-English description.",
        },
        prompt=(
            "Sketch a target architecture. Keep it at the level of boxes and "
            "lines — not the line-of-code level."
        ),
    ),
    ArtifactType(
        id="data-flow",
        category=Category.HOW,
        label="Data Flow",
        description="What data moves where, with sensitivity.",
        body_schema={
            "sources": "List of source systems and the data they emit.",
            "transformations": "List of {step, what_changes}",
            "sinks": "List of {sink, retention, sensitivity}",
        },
        prompt=(
            "Describe the data flow end-to-end. Call out sensitive data and "
            "the boundary it crosses."
        ),
    ),
    ArtifactType(
        id="risk-register",
        category=Category.HOW,
        label="Risk Register",
        description="What could go wrong and what we'd do about it.",
        body_schema={
            "risks": ("List of {risk, likelihood (1-5), impact (1-5), mitigation, owner}"),
        },
        prompt=(
            "Build a risk register for the engagement. Include execution, "
            "data, security, change-management, and stakeholder risks."
        ),
        critical=True,
    ),
    ArtifactType(
        id="open-questions",
        category=Category.HOW,
        label="Open Questions",
        description="Decisions we still need to make.",
        body_schema={
            "questions": "List of {question, blocks_what, owner, due}",
        },
        prompt=(
            "List the open questions whose answers would unblock the next "
            "phase. Each must name what it's currently blocking."
        ),
    ),
]


_BY_ID: dict[str, ArtifactType] = {t.id: t for t in ARTIFACT_TYPES}


def get_type(type_id: str) -> ArtifactType:
    if type_id not in _BY_ID:
        raise KeyError(f"Unknown artifact type: {type_id}")
    return _BY_ID[type_id]


def types_for_category(category: Category) -> list[ArtifactType]:
    return [t for t in ARTIFACT_TYPES if t.category == category]
