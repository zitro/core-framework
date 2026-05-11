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
    ArtifactType(
        id="quick-win",
        category=Category.WHAT,
        label="Quick Win",
        description="Smallest scoped delivery that proves value in weeks, not months.",
        body_schema={
            "scope": "One paragraph: what is in, what is out, what it produces.",
            "value": "One sentence: which pain it relieves and for whom.",
            "effort_weeks": "Integer estimate (1-8 weeks; if more, it isn't a quick win).",
            "success_metric": "Single measurable indicator that this worked.",
            "owner_role": "Role accountable for delivery (not a name).",
            "dependencies": "List of blockers that must be cleared before kickoff.",
        },
        prompt=(
            "Define the smallest valuable thing this engagement could ship. "
            "It must be deliverable in 1-8 weeks, tied to one named pain, and "
            "have one measurable success indicator. If you cannot define a "
            "quick win, the problem is not framed sharply enough — say so "
            "explicitly rather than padding scope."
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
        id="assumption-matrix",
        category=Category.SCOPE,
        label="Assumption Matrix",
        description="Assumptions plotted by risk and certainty; test the riskiest first.",
        body_schema={
            "assumptions": (
                "List of {statement, risk (1-5 — impact if wrong), "
                "certainty (1-5 — how sure we are it's true), test_idea, "
                "evidence}. Order by risk descending."
            ),
            "riskiest_unknowns": (
                "Top 3 assumptions where risk is high and certainty is low — "
                "these are what to test next."
            ),
        },
        prompt=(
            "List the assumptions this engagement rests on. For each, score "
            "the risk if it's wrong (1-5) and our certainty it's true (1-5). "
            "Propose a cheap way to test each high-risk / low-certainty item. "
            "Do not pad with safe assumptions; the value is in the dangerous "
            "ones we have not yet proven."
        ),
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
    # ── STORY ─────────────────────────────────────────────────────────
    ArtifactType(
        id="executive-brief",
        category=Category.STORY,
        label="Executive Brief",
        description="One-page narrative for a customer exec.",
        body_schema={
            "headline": "Single sentence the exec will remember.",
            "situation": "Two sentences on the current state.",
            "complication": "Two sentences on what's forcing change.",
            "resolution": "Two sentences on the proposed path.",
            "ask": "One sentence on what we need from them next.",
        },
        prompt=(
            "Write a one-page executive brief in the SCRA structure "
            "(Situation, Complication, Resolution, Ask). Tone: confident, "
            "consultative, no jargon. Pull every claim from the corpus."
        ),
        critical=True,
    ),
    ArtifactType(
        id="elevator-pitch",
        category=Category.STORY,
        label="Elevator Pitch",
        description="The 30-second version.",
        body_schema={
            "pitch": "60–90 word spoken-style pitch.",
            "proof_point": "One sentence of evidence from the corpus.",
        },
        prompt=(
            "Write the elevator pitch as if delivered in person. Conversational, "
            "no buzzwords, ends with a clear next step."
        ),
    ),
    ArtifactType(
        id="deck-outline",
        category=Category.STORY,
        label="Deck Outline",
        description="Slide-by-slide story for the customer readout.",
        body_schema={
            "title": "Deck title.",
            "slides": (
                "Ordered list of {slide_number, title, key_point, supporting_bullets, visual_hint}"
            ),
        },
        prompt=(
            "Outline a 10–15 slide customer deck. Each slide has one key point "
            "and 2–4 supporting bullets. Story arc: why → value → what → "
            "scope → how → ask. The opening slide must restate the customer's "
            "own words back to them."
        ),
        critical=True,
    ),
    ArtifactType(
        id="customer-readout",
        category=Category.STORY,
        label="Customer Readout",
        description="Long-form narrative document for the customer.",
        body_schema={
            "sections": ("Ordered list of {heading, body (markdown, 2–4 paragraphs), callouts}"),
        },
        prompt=(
            "Write a long-form customer readout document. Headings cover the "
            "engagement narrative end-to-end. Each section is 2–4 paragraphs "
            "of prose, not bullets. Cite the corpus inline."
        ),
    ),
    ArtifactType(
        id="press-release",
        category=Category.STORY,
        label="Future Press Release",
        description="Amazon-style PR for the moment we succeed.",
        body_schema={
            "headline": "What the world reads.",
            "subhead": "One supporting sentence.",
            "body": "Three short paragraphs: announcement, customer quote, MSFT quote.",
        },
        prompt=(
            "Write the future press release announcing this initiative as a "
            "success. Date it 12–18 months from kickoff. The customer quote "
            "must sound like the personas we wrote, not like marketing."
        ),
    ),
    ArtifactType(
        id="storyboard",
        category=Category.STORY,
        label="Storyboard",
        description="Visual narrative of how the solution plays out, frame by frame.",
        body_schema={
            "persona": "Persona this story follows.",
            "frames": (
                "Ordered list of {caption, description, persona_action, "
                "image_prompt, image_url}. 4-8 frames. image_prompt is the "
                "text passed to the image generator; image_url is filled in "
                "after generation runs."
            ),
            "takeaway": "One-sentence summary the audience should leave with.",
        },
        prompt=(
            "Tell the solution as a 4-8 frame visual story for a non-technical "
            "audience. Each frame describes one moment in the persona's day. "
            "For each frame write an image_prompt suitable for an AI image "
            "generator: concise, concrete, no proper nouns, no trademarks. "
            "Keep image_url empty — the generator fills it in afterward."
        ),
    ),
    # ── operational ──────────────────────────────────────────────────
    ArtifactType(
        id="status-update",
        category=Category.OPERATIONAL,
        label="Weekly Status Update",
        description="Internal/customer-shareable status: shipped, blocked, next.",
        body_schema={
            "summary": "One-paragraph executive summary.",
            "shipped": "Bullets of what landed since last update.",
            "blocked": "Bullets of what's blocked and the ask.",
            "next": "Bullets of what's planned for the next interval.",
            "risks": "Optional bullets of new or escalating risks.",
        },
        prompt=(
            "Draft a weekly status update for this engagement. Keep tone "
            "factual and concise. Source `shipped` from synthesised artifacts "
            "and source documents updated since the last status. Source "
            "`blocked` and `risks` from critic issues and detector signals. "
            "Keep `next` aligned with the engagement plan if present."
        ),
    ),
    ArtifactType(
        id="weekly-email-update",
        category=Category.OPERATIONAL,
        label="Weekly Email Update",
        description="Send-ready email summarising progress from the past 7 days only.",
        body_schema={
            "subject": "Email subject line. Format: '[Project] Weekly update — <Mon DD>'.",
            "greeting": "One-line greeting addressed to the customer stakeholder group.",
            "body": (
                "Markdown body, 150-300 words. Sections: ## Highlights, ## In flight, "
                "## Blocked / need from you, ## Up next. Bullets only, one line each."
            ),
            "signoff": "One-line sign-off plus owner name.",
        },
        prompt=(
            "Draft a weekly email update for the customer. CRITICAL: include only "
            "items that changed in the past 7 days based on artifact `updated_at` "
            "or source `last_modified`. Do not restate the entire engagement. "
            "Tone is direct and confident, written by an MSFT FDE to a customer "
            "stakeholder. Highlights first, then in-flight, then asks, then "
            "what's coming. If there is genuinely no movement in a section, "
            "write 'Nothing this week.' rather than padding."
        ),
    ),
    ArtifactType(
        id="wrap-up",
        category=Category.OPERATIONAL,
        label="Engagement Wrap-up",
        description="Closing artifact summarising outcomes, learnings, and handoff.",
        body_schema={
            "outcomes": "Bullets — what we delivered and the business impact.",
            "decisions": "Bullets — decisions made and who owns them going forward.",
            "open_items": "Bullets — what remains and the recommended owner.",
            "learnings": "Bullets — what would we do differently next time.",
            "handoff": "Paragraph — who continues the work, what artifacts they receive.",
        },
        prompt=(
            "Write the engagement wrap-up. Pull `outcomes` from accepted "
            "artifacts and decision-extractor signals. Pull `open_items` from "
            "outstanding questions and warn/blocker signals. `learnings` is "
            "honest \u2014 do not flatter."
        ),
        critical=True,
    ),
    ArtifactType(
        id="retro",
        category=Category.OPERATIONAL,
        label="Retrospective",
        description="Short, candid review: start / stop / continue + action items.",
        body_schema={
            "start": "Bullets — practices to begin doing.",
            "stop": "Bullets — practices to discontinue.",
            "continue": "Bullets — practices to keep.",
            "action_items": (
                "List of {action, owner_role, due_week_offset}. Each action "
                "must have a single owning role and a relative due date."
            ),
        },
        prompt=(
            "Run the retrospective for this engagement or sprint. Pull from "
            "corpus signals about what worked and what did not. Be candid; "
            "flattery wastes the team's time. Every action item must have an "
            "owning role and a relative due date."
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
