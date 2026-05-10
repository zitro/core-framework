"""Per-worker in-memory registry of on-disk files that failed to
load. Populated by ``load_with_migrations`` when a file can't be
brought forward to the supported schema version, surfaced via
``GET /api/health/schema`` so the UI can show a persistent banner.

The registry is intentionally per-uvicorn-worker (in-memory) — this
is a degraded-mode indicator, not a durable audit log. The audit
trail belongs to ``app/utils/audit_log.py``.
"""

from __future__ import annotations

import threading
from dataclasses import asdict, dataclass
from typing import Any

_lock = threading.Lock()
_records: dict[str, list[dict[str, Any]]] = {}


@dataclass(frozen=True, slots=True)
class IncompatibilityRecord:
    kind: str
    path: str
    file_version: str
    supported_version: str
    reason: str


def record_incompatibility(record: IncompatibilityRecord) -> None:
    """Add a record. Idempotent on (kind, path) — last writer wins."""
    payload = asdict(record)
    with _lock:
        bucket = _records.setdefault(record.kind, [])
        # Replace any earlier record for the same path so the registry
        # shows the latest reason rather than stale stacked entries.
        for i, existing in enumerate(bucket):
            if existing.get("path") == record.path:
                bucket[i] = payload
                return
        bucket.append(payload)


def snapshot() -> dict[str, list[dict[str, Any]]]:
    """Return a deep-ish copy safe to serialize."""
    with _lock:
        return {kind: list(records) for kind, records in _records.items()}


def clear() -> None:
    """Wipe the registry. Tests use this between cases."""
    with _lock:
        _records.clear()
