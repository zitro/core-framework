"""ArtifactType entries for the What category.

Generated as part of the 300-line cleanup; do not edit by hand
unless you mean to. Add new artifact types here (then the package
__init__ picks them up via the registry list)."""

from __future__ import annotations

from app.synthesis.categories import Category
from app.synthesis.types._base import ArtifactType

WHAT_TYPES: list[ArtifactType] = [
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
]
