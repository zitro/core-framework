"""ArtifactType entries for the How category.

Generated as part of the 300-line cleanup; do not edit by hand
unless you mean to. Add new artifact types here (then the package
__init__ picks them up via the registry list)."""

from __future__ import annotations

from app.synthesis.categories import Category
from app.synthesis.types._base import ArtifactType

HOW_TYPES: list[ArtifactType] = [
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
