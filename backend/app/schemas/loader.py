"""Typed loader: read JSON file → migrate to supported version →
validate with Pydantic → return typed instance.

Used by feature code that consumes schema-versioned on-disk files
(currently the upcoming customer-seed loader and the CLI marker on
the backend side, when one exists). Failures are recorded in the
incompatibility registry surfaced by ``/api/health/schema`` so the
UI can communicate degraded state instead of the backend
mysteriously skipping files at boot.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TypeVar, get_args

from pydantic import BaseModel, ValidationError

from app.migrations import MigrationGapError, run_migrator_chain
from app.schemas._constants import KNOWN_KINDS
from app.schemas.incompatibility import IncompatibilityRecord, record_incompatibility

logger = logging.getLogger(__name__)

# Files that omit schema_version are treated as the first version
# the project ever shipped — the spec's "implicit baseline" rule.
IMPLICIT_BASELINE = "1.0.0"

T = TypeVar("T", bound=BaseModel)


class SchemaLoadError(Exception):
    """Raised on any failure to load a schema-versioned file. The
    incompatibility registry already has a record by the time this
    is raised, so callers that want best-effort behavior can catch
    + skip."""


def _target_version(schema: type[BaseModel]) -> str:
    """Read the supported schema_version off the Pydantic class's
    ``schema_version`` field. Requires the field to be a Literal."""
    field = schema.model_fields.get("schema_version")
    if field is None:
        raise ValueError(
            f"{schema.__name__} has no schema_version field; loader can't determine target version"
        )
    args = get_args(field.annotation)
    if not args:
        raise ValueError(
            f"{schema.__name__}.schema_version is not a Literal[...]; can't determine target version"
        )
    # Use the FIRST literal value as the supported version.
    return str(args[0])


def load_with_migrations(path: Path, *, schema: type[T], kind: str) -> T:
    """Load a JSON file as ``schema``, migrating from its on-disk
    ``schema_version`` to the model's declared version.

    Records the failure path in the incompatibility registry before
    re-raising as :class:`SchemaLoadError`.
    """
    if kind not in KNOWN_KINDS:
        raise ValueError(f"unknown schema kind: {kind!r}")

    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        # Not an incompatibility — file is just missing.
        raise SchemaLoadError(f"{path}: not found") from exc
    except (OSError, json.JSONDecodeError) as exc:
        reason = f"{type(exc).__name__}: {exc}"
        record_incompatibility(
            IncompatibilityRecord(
                kind=kind,
                path=str(path),
                file_version="<unreadable>",
                supported_version=_target_version(schema),
                reason=reason,
            )
        )
        raise SchemaLoadError(f"{path}: {reason}") from exc

    if not isinstance(raw, dict):
        reason = "file is not a JSON object"
        record_incompatibility(
            IncompatibilityRecord(
                kind=kind,
                path=str(path),
                file_version="<unparseable>",
                supported_version=_target_version(schema),
                reason=reason,
            )
        )
        raise SchemaLoadError(f"{path}: {reason}")

    file_version = str(raw.get("schema_version") or IMPLICIT_BASELINE)
    target = _target_version(schema)

    try:
        migrated = run_migrator_chain(raw, kind=kind, from_=file_version, to=target)
    except (MigrationGapError, ValueError) as exc:
        record_incompatibility(
            IncompatibilityRecord(
                kind=kind,
                path=str(path),
                file_version=file_version,
                supported_version=target,
                reason=f"migration: {exc}",
            )
        )
        raise SchemaLoadError(f"{path}: migration failed: {exc}") from exc

    try:
        return schema.model_validate(migrated)
    except ValidationError as exc:
        # Pydantic's message is verbose; keep just the field summary.
        reason = "; ".join(
            f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()
        )
        record_incompatibility(
            IncompatibilityRecord(
                kind=kind,
                path=str(path),
                file_version=file_version,
                supported_version=target,
                reason=f"validation: {reason}",
            )
        )
        raise SchemaLoadError(f"{path}: validation failed: {reason}") from exc
