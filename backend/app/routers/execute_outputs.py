"""Execute output router — persisted final artifacts generated from discovery context."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.models.core import ExecuteOutputVersion
from app.utils.execute_outputs_context import (
    execute_context,
    fingerprint,
    latest_by_output,
    load_outputs,
)
from app.utils.execute_outputs_definitions import (
    OUTPUT_BY_ID,
    OUTPUT_DEFINITIONS,
    ExecuteOutputDefinition,
)
from app.utils.execute_outputs_generate import generate_output

router = APIRouter(dependencies=[Depends(get_current_user)])


class ExecuteOutputGenerateRequest(BaseModel):
    discovery_id: str = Field(min_length=1)
    output_id: str = Field(min_length=1)
    force: bool = False


class ExecuteOutputEnsureRequest(BaseModel):
    discovery_id: str = Field(min_length=1)
    output_ids: list[str] = Field(default_factory=list)
    force: bool = False


@router.get("/definitions", response_model=list[ExecuteOutputDefinition])
async def list_execute_output_definitions():
    return OUTPUT_DEFINITIONS


@router.get("/{discovery_id}", response_model=list[ExecuteOutputVersion])
async def list_execute_outputs(discovery_id: str):
    return await load_outputs(discovery_id)


@router.post("/generate", response_model=ExecuteOutputVersion)
async def generate_execute_output(request: ExecuteOutputGenerateRequest):
    definition = OUTPUT_BY_ID.get(request.output_id)
    if definition is None:
        raise HTTPException(status_code=400, detail=f"Unknown Execute output: {request.output_id}")

    context = await execute_context(request.discovery_id)
    context_fingerprint = fingerprint(context)
    latest = latest_by_output(await load_outputs(request.discovery_id)).get(request.output_id)
    if latest and latest.context_fingerprint == context_fingerprint and not request.force:
        return latest

    return await generate_output(request.discovery_id, definition, context, context_fingerprint)


@router.post("/ensure", response_model=list[ExecuteOutputVersion])
async def ensure_execute_outputs(request: ExecuteOutputEnsureRequest):
    requested_ids = request.output_ids or [definition.id for definition in OUTPUT_DEFINITIONS]
    unknown = [output_id for output_id in requested_ids if output_id not in OUTPUT_BY_ID]
    if unknown:
        raise HTTPException(
            status_code=400, detail=f"Unknown Execute outputs: {', '.join(unknown)}"
        )

    context = await execute_context(request.discovery_id)
    context_fingerprint = fingerprint(context)
    existing = await load_outputs(request.discovery_id)
    latest = latest_by_output(existing)
    ensured_by_id: dict[str, ExecuteOutputVersion] = {}
    generation_tasks: list[tuple[str, asyncio.Task[ExecuteOutputVersion]]] = []

    for output_id in requested_ids:
        current = latest.get(output_id)
        if current and current.context_fingerprint == context_fingerprint and not request.force:
            ensured_by_id[output_id] = current
            continue
        generation_tasks.append(
            (
                output_id,
                asyncio.create_task(
                    generate_output(
                        request.discovery_id,
                        OUTPUT_BY_ID[output_id],
                        context,
                        context_fingerprint,
                    )
                ),
            )
        )

    for output_id, task in generation_tasks:
        ensured_by_id[output_id] = await task

    ensured = [
        ensured_by_id[output_id] for output_id in requested_ids if output_id in ensured_by_id
    ]
    ensured.sort(key=lambda item: requested_ids.index(item.output_id))
    return ensured
