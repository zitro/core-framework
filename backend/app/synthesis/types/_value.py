"""ArtifactType entries for the Value category.

Generated as part of the 300-line cleanup; do not edit by hand
unless you mean to. Add new artifact types here (then the package
__init__ picks them up via the registry list)."""

from __future__ import annotations

from app.synthesis.categories import Category
from app.synthesis.types._base import ArtifactType

VALUE_TYPES: list[ArtifactType] = [
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
]
