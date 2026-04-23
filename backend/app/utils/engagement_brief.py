"""Render an EngagementContext to ``engagement-brief.md``.

Pure function: typed record in, markdown string out. No I/O. Caller
decides where to write (vertex source, local folder, response body).

Layout aims to be diff-friendly: stable section order, short YAML
front-matter, bulleted lists with one item per line. The output is the
shape humans will read in /orient and that AI calls will be grounded
on, so it must read cleanly without rendering.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.models.engagement_context import EngagementContext


def _bullets(items: list[str], empty: str = "_(none captured)_") -> str:
    return "\n".join(f"- {it}" for it in items) if items else empty


def _stakeholders(items) -> str:
    if not items:
        return "_(no stakeholders captured)_"
    rows = ["| Name | Role | Org | Influence |", "|------|------|-----|-----------|"]
    for s in items:
        rows.append(
            f"| {s.name or '—'} | {s.role or '—'} | {s.org or '—'} | {s.influence or '—'} |"
        )
    return "\n".join(rows)


def _metrics(items) -> str:
    if not items:
        return "_(no success metrics defined)_"
    rows = ["| Metric | Baseline | Target |", "|--------|----------|--------|"]
    for m in items:
        rows.append(f"| {m.name or '—'} | {m.baseline or '—'} | {m.target or '—'} |")
    return "\n".join(rows)


def _milestones(items) -> str:
    if not items:
        return "_(no milestones set)_"
    return "\n".join(
        f"- **{m.label}** — {m.target_date or 'TBD'}" + (f" — {m.notes}" if m.notes else "")
        for m in items
    )


def render_engagement_brief(ctx: EngagementContext) -> str:
    """Return the canonical markdown projection of an EngagementContext."""
    now = datetime.now(UTC).strftime("%Y-%m-%d")
    parts = [
        "---",
        f'title: "{ctx.title or "Engagement Brief"}"',
        f"phase: {ctx.phase.value}",
        f"generated: {now}",
        f"project_id: {ctx.project_id}",
        "type: engagement-brief",
        "---",
        "",
        f"# {ctx.title or 'Engagement Brief'}",
        "",
    ]
    if ctx.one_liner:
        parts += [f"> {ctx.one_liner}", ""]

    parts += [
        "## Problem",
        ctx.problem or "_(not yet articulated)_",
        "",
        "## Desired outcome",
        ctx.desired_outcome or "_(not yet defined)_",
        "",
        "## Scope",
        "**In scope**",
        _bullets(ctx.scope_in),
        "",
        "**Out of scope**",
        _bullets(ctx.scope_out),
        "",
        "## Constraints",
        _bullets(ctx.constraints),
        "",
        "## Assumptions",
        _bullets(ctx.assumptions),
        "",
        "## Risks",
        _bullets(ctx.risks),
        "",
        "## Stakeholders",
        _stakeholders(ctx.stakeholders),
        "",
        "## Success metrics",
        _metrics(ctx.success_metrics),
        "",
        "## Milestones",
        _milestones(ctx.milestones),
        "",
    ]
    if ctx.notes.strip():
        parts += ["## Notes", ctx.notes.strip(), ""]
    return "\n".join(parts).rstrip() + "\n"


BRIEF_FILENAME = "engagement-brief.md"
