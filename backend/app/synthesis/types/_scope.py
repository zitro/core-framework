"""ArtifactType entries for the Scope category.

Generated as part of the 300-line cleanup; do not edit by hand
unless you mean to. Add new artifact types here (then the package
__init__ picks them up via the registry list)."""

from __future__ import annotations

from app.synthesis.categories import Category
from app.synthesis.types._base import ArtifactType


SCOPE_TYPES: list[ArtifactType] = [
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
]
