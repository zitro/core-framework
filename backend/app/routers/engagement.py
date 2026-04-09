"""Engagement repo router — scan, preview, and export to engagement repos."""

import logging
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider
from app.utils.engagement import scan_engagement_repo

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


class RepoPathRequest(BaseModel):
    path: str


class ExportRequest(BaseModel):
    discovery_id: str
    engagement_repo_path: str
    initiative_dir: str = ""


@router.post("/scan")
async def scan_repo(request: RepoPathRequest):
    """Scan a engagement repo directory and return its structure."""
    root = Path(request.path)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    return scan_engagement_repo(request.path)


@router.post("/export")
async def export_to_repo(request: ExportRequest):
    """Export CORE outputs as engagement-compatible markdown files.

    Writes problem statements, use cases, and solution blueprints
    into the engagement initiative's decisions/ directory.
    """
    storage = get_storage_provider()
    root = Path(request.engagement_repo_path)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="engagement repo not found")

    disc = await storage.get("discoveries", request.discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")

    # Find the initiative directory to write into
    if request.initiative_dir:
        initiative_path = root / request.initiative_dir
    else:
        # Auto-detect: find first customer dir, then first initiative
        from app.utils.engagement import _find_content_dir

        customer_dir = _find_content_dir(root)
        if not customer_dir:
            raise HTTPException(
                status_code=422,
                detail="No customer directory found in engagement repo",
            )
        initiatives = [
            d
            for d in sorted(customer_dir.iterdir())
            if d.is_dir() and (d / "initiative-overview.md").exists()
        ]
        if not initiatives:
            raise HTTPException(
                status_code=422,
                detail="No initiative found in engagement repo",
            )
        initiative_path = initiatives[0]

    if not initiative_path.is_dir():
        raise HTTPException(
            status_code=400, detail="Initiative directory not found"
        )

    decisions_dir = initiative_path / "decisions"
    decisions_dir.mkdir(exist_ok=True)

    exported: list[str] = []
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    discovery_name = disc.get("name", "CORE Discovery")

    # Export problem statements
    ps_items = await storage.list(
        "problem_statements", {"discoveryId": request.discovery_id}
    )
    if not ps_items:
        ps_items = await storage.list(
            "problem_statements",
            {"discovery_id": request.discovery_id},
        )
    for ps in ps_items:
        version = ps.get("version", 1)
        filename = f"core-problem-statement-v{version}.md"
        filepath = decisions_dir / filename
        content = _render_problem_statement(ps, discovery_name, today)
        filepath.write_text(content, encoding="utf-8")
        exported.append(str(filepath.relative_to(root)))

    # Export use cases
    uc_items = await storage.list(
        "use_cases", {"discoveryId": request.discovery_id}
    )
    if not uc_items:
        uc_items = await storage.list(
            "use_cases", {"discovery_id": request.discovery_id}
        )
    for uc in uc_items:
        version = uc.get("version", 1)
        filename = f"core-use-case-v{version}.md"
        filepath = decisions_dir / filename
        content = _render_use_case(uc, discovery_name, today)
        filepath.write_text(content, encoding="utf-8")
        exported.append(str(filepath.relative_to(root)))

    # Export solution blueprints
    bp_items = await storage.list(
        "solution_blueprints", {"discoveryId": request.discovery_id}
    )
    if not bp_items:
        bp_items = await storage.list(
            "solution_blueprints",
            {"discovery_id": request.discovery_id},
        )
    for bp in bp_items:
        version = bp.get("version", 1)
        filename = f"core-solution-blueprint-v{version}.md"
        filepath = decisions_dir / filename
        content = _render_blueprint(bp, discovery_name, today)
        filepath.write_text(content, encoding="utf-8")
        exported.append(str(filepath.relative_to(root)))

    return {
        "exported": exported,
        "count": len(exported),
        "target_dir": str(decisions_dir.relative_to(root)),
    }


# ── Markdown renderers ───────────────────────────────────


def _render_problem_statement(
    ps: dict, discovery: str, date: str
) -> str:
    return (
        f"---\n"
        f'title: "Problem Statement v{ps.get("version", 1)}"\n'
        f"date: {date}\n"
        f"type: decision\n"
        f'initiative: "{discovery}"\n'
        f"source: CORE Discovery Framework\n"
        f"---\n\n"
        f"# Problem Statement v{ps.get('version', 1)}\n\n"
        f"| Dimension | Detail |\n"
        f"| --------- | ------ |\n"
        f"| Who | {ps.get('who', '')} |\n"
        f"| What | {ps.get('what', '')} |\n"
        f"| Why | {ps.get('why', '')} |\n"
        f"| Impact | {ps.get('impact', '')} |\n\n"
        f"## Statement\n\n"
        f"{ps.get('statement', '')}\n"
    )


def _render_use_case(uc: dict, discovery: str, date: str) -> str:
    metrics = uc.get("success_metrics", [])
    metrics_md = "\n".join(f"- {m}" for m in metrics) if metrics else "- TBD"
    return (
        f"---\n"
        f'title: "{uc.get("title", "Use Case")}"\n'
        f"date: {date}\n"
        f"type: decision\n"
        f'initiative: "{discovery}"\n'
        f"source: CORE Discovery Framework\n"
        f"---\n\n"
        f"# {uc.get('title', 'Use Case')}\n\n"
        f"**Persona:** {uc.get('persona', '')}\n\n"
        f"**Goal:** {uc.get('goal', '')}\n\n"
        f"## Current State\n\n{uc.get('current_state', '')}\n\n"
        f"## Desired State\n\n{uc.get('desired_state', '')}\n\n"
        f"## Business Value\n\n{uc.get('business_value', '')}\n\n"
        f"## Business Impact\n\n{uc.get('business_impact', '')}\n\n"
        f"## Success Metrics\n\n{metrics_md}\n\n"
        f"## Summary\n\n{uc.get('summary', '')}\n"
    )


def _render_blueprint(bp: dict, discovery: str, date: str) -> str:
    services = bp.get("services", [])
    svc_rows = "\n".join(
        f"| {s.get('service', '')} | {s.get('purpose', '')} "
        f"| {s.get('rationale', '')} |"
        for s in services
    )
    svc_table = (
        "| Service | Purpose | Rationale |\n"
        "| ------- | ------- | --------- |\n" + svc_rows
        if services
        else "No services specified."
    )

    oq = bp.get("open_questions", [])
    oq_md = "\n".join(f"- {q}" for q in oq) if oq else "- None identified"

    fq = bp.get("follow_up_questions", [])
    fq_md = "\n".join(f"- {q}" for q in fq) if fq else "- None identified"

    providers = ", ".join(bp.get("target_providers", []))
    return (
        f"---\n"
        f'title: "{bp.get("approach_title", "Solution Blueprint")}"\n'
        f"date: {date}\n"
        f"type: decision\n"
        f'initiative: "{discovery}"\n'
        f"source: CORE Discovery Framework\n"
        f"---\n\n"
        f"# {bp.get('approach_title', 'Solution Blueprint')}\n\n"
        f"**Target Providers:** {providers}\n\n"
        f"**Estimated Effort:** {bp.get('estimated_effort', 'TBD')}\n\n"
        f"## Approach\n\n{bp.get('approach_summary', '')}\n\n"
        f"## Recommended Services\n\n{svc_table}\n\n"
        f"## Architecture Overview\n\n"
        f"{bp.get('architecture_overview', '')}\n\n"
        f"## Quick Win\n\n{bp.get('quick_win_suggestion', '')}\n\n"
        f"## Open Questions\n\n{oq_md}\n\n"
        f"## Follow-up Questions\n\n{fq_md}\n"
    )
