"""Export router — download discoveries as JSON or CSV."""

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/{discovery_id}")
async def export_discovery(
    discovery_id: str,
    format: str = Query("json", pattern="^(json|csv)$"),
):
    """Export a discovery and its evidence in JSON or CSV format."""
    storage = get_storage_provider()

    discovery = await storage.get("discoveries", discovery_id)
    if not discovery:
        raise HTTPException(status_code=404, detail="Discovery not found")

    evidence_items = await storage.list("evidence", {"discovery_id": discovery_id})

    if format == "csv":
        return _export_csv(discovery, evidence_items)
    return _export_json(discovery, evidence_items)


def _export_json(discovery: dict, evidence: list[dict]) -> StreamingResponse:
    payload = {
        "discovery": discovery,
        "evidence": evidence,
    }
    content = json.dumps(payload, indent=2, default=str)
    name = discovery.get("name", "discovery").replace(" ", "-").lower()
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{name}.json"'},
    )


def _export_csv(discovery: dict, evidence: list[dict]) -> StreamingResponse:
    output = io.StringIO()
    writer = csv.writer(output)

    # Discovery metadata header
    writer.writerow(["Discovery", discovery.get("name", "")])
    writer.writerow(["Phase", discovery.get("current_phase", "")])
    writer.writerow(["Mode", discovery.get("mode", "")])
    writer.writerow(["Description", discovery.get("description", "")])
    writer.writerow([])

    # Evidence table
    writer.writerow(["Phase", "Content", "Source", "Confidence", "Tags", "Created"])
    for e in evidence:
        writer.writerow([
            e.get("phase", ""),
            e.get("content", ""),
            e.get("source", ""),
            e.get("confidence", ""),
            "; ".join(e.get("tags", [])),
            e.get("created_at", ""),
        ])

    name = discovery.get("name", "discovery").replace(" ", "-").lower()
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}.csv"'},
    )
