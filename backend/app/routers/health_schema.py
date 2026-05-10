"""Schema-health endpoint.

Surfaces (a) the set of schema kinds the backend knows about and
the schema_version values each currently supports, and (b) any
on-disk files that failed to load through ``load_with_migrations``.
Consumed by the frontend to render a persistent banner when a
customer instance has degraded files.
"""

from __future__ import annotations

from typing import Any, get_args

from fastapi import APIRouter
from pydantic import BaseModel

from app.schemas._constants import KNOWN_KINDS
from app.schemas._export import SCHEMA_BY_KIND
from app.schemas.incompatibility import snapshot

router = APIRouter()


class _SchemaKindInfo(BaseModel):
    kind: str
    supported_versions: list[str]


class SchemaHealthResponse(BaseModel):
    known_kinds: list[str]
    kinds: list[_SchemaKindInfo]
    incompatibilities: dict[str, list[dict[str, Any]]]


def _supported_versions(model: type[BaseModel]) -> list[str]:
    field = model.model_fields.get("schema_version")
    if field is None:
        return []
    return [str(v) for v in get_args(field.annotation)]


@router.get("/schema", response_model=SchemaHealthResponse)
async def schema_health() -> SchemaHealthResponse:
    """Report schema-versioning state for this backend process."""
    kinds = sorted(KNOWN_KINDS)
    return SchemaHealthResponse(
        known_kinds=kinds,
        kinds=[
            _SchemaKindInfo(kind=k, supported_versions=_supported_versions(SCHEMA_BY_KIND[k]))
            for k in kinds
        ],
        incompatibilities=snapshot(),
    )
