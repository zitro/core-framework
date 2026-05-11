"""Shape tests for the EngagementContext model."""

from __future__ import annotations

from app.models.engagement_context import (
    EngagementContext,
    EngagementContextUpdate,
    EngagementMetric,
    EngagementMilestone,
    EngagementPhase,
    EngagementStakeholder,
)


def test_context_defaults() -> None:
    ctx = EngagementContext(project_id="p1")
    assert ctx.phase is EngagementPhase.DISCOVERY
    assert ctx.scope_in == []
    assert ctx.stakeholders == []


def test_context_round_trips_with_nested_models() -> None:
    ctx = EngagementContext(
        project_id="p1",
        title="Acme Claims",
        one_liner="Reduce claims processing time by 40%",
        phase=EngagementPhase.PILOT,
        scope_in=["intake", "triage"],
        scope_out=["payouts"],
        stakeholders=[EngagementStakeholder(name="Sarah", role="VP Ops", org="customer")],
        success_metrics=[EngagementMetric(name="cycle-time", target="<48h", baseline="120h")],
        milestones=[EngagementMilestone(label="Pilot complete", target_date="2026-07-01")],
    )
    dumped = ctx.model_dump(mode="json")
    reborn = EngagementContext.model_validate(dumped)
    assert reborn.phase is EngagementPhase.PILOT
    assert reborn.stakeholders[0].name == "Sarah"
    assert reborn.success_metrics[0].target == "<48h"


def test_partial_update_accepts_subset_of_fields() -> None:
    upd = EngagementContextUpdate(title="New title", phase=EngagementPhase.BUILD)
    assert upd.title == "New title"
    assert upd.phase is EngagementPhase.BUILD
    # everything else stays None
    assert upd.one_liner is None
    assert upd.stakeholders is None


def test_partial_update_round_trip() -> None:
    upd = EngagementContextUpdate(
        scope_in=["a", "b"],
        risks=["data quality"],
    )
    dumped = upd.model_dump(mode="json", exclude_none=True)
    assert dumped == {"scope_in": ["a", "b"], "risks": ["data quality"]}
