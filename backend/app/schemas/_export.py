"""Export Pydantic schemas to JSON Schema dicts for consumption by
the TypeScript CLI's Ajv validator. Driven by
``scripts/gen-schemas.mjs``; not used at runtime by the FastAPI app.

Kept as plain helpers (no CLI here) so the generator script can call
the export from any Python entrypoint and keep the cross-language
contract reproducible."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.schemas._constants import KNOWN_KINDS
from app.schemas.core_discovery_marker import CoreDiscoveryMarker

# Mapping from schema kind to the Pydantic class that owns it.
# Every entry in KNOWN_KINDS must have a corresponding entry here;
# the generator asserts this on each run.
SCHEMA_BY_KIND: dict[str, type[BaseModel]] = {
    "core_discovery_marker": CoreDiscoveryMarker,
}


def export_json_schema(kind: str) -> dict[str, Any]:
    """Return the JSON Schema dict for ``kind``.

    Raises ``KeyError`` if the kind isn't registered.
    """
    if kind not in SCHEMA_BY_KIND:
        raise KeyError(f"unknown schema kind: {kind!r}")
    return SCHEMA_BY_KIND[kind].model_json_schema()


def assert_registry_matches_known_kinds() -> None:
    """Fail fast if SCHEMA_BY_KIND drifts from KNOWN_KINDS. Run by
    the generator before emitting artifacts."""
    registry_kinds = set(SCHEMA_BY_KIND.keys())
    declared_kinds = set(KNOWN_KINDS)
    missing = declared_kinds - registry_kinds
    extra = registry_kinds - declared_kinds
    if missing or extra:
        raise RuntimeError(
            f"SCHEMA_BY_KIND drift — missing={sorted(missing)} extra={sorted(extra)}"
        )
