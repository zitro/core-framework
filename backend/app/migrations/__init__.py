"""Migration pipeline for on-disk file shapes.

Each schema kind has its own subpackage under
``app.migrations.<kind>``. A migrator file is named
``vX_Y_Z_to_vA_B_C.py`` and exposes a ``migrate(raw: dict) -> dict``
function that transforms a payload from one version to the next. A
baseline file (``vX_Y_Z_baseline.py``) declares the version with no
transform.

If MAJOR didn't change between two intermediate versions, no migrator
file is required for that step (identity).

``run_migrator_chain`` builds the path from ``from_`` to ``to`` by
importing the per-kind subpackage and walking its registered
migrators in order. Used by the typed loader to bring legacy
on-disk files forward to the supported schema version before Pydantic
validates them.
"""

from __future__ import annotations

import copy
import importlib
import logging
import pkgutil
from typing import Any, Protocol

from app.schemas._constants import KNOWN_KINDS

logger = logging.getLogger(__name__)


class MigrationGapError(Exception):
    """No migrator chain exists from ``from_version`` to ``to_version``."""

    def __init__(self, kind: str, from_version: str, to_version: str) -> None:
        self.kind = kind
        self.from_version = from_version
        self.to_version = to_version
        super().__init__(
            f"No migrator chain for kind={kind!r} from {from_version!r} to {to_version!r}"
        )


class SchemaTooNew(Exception):  # noqa: N818
    """File at a schema_version newer than this backend supports."""

    def __init__(self, kind: str, file_version: str, supported: list[str]) -> None:
        self.kind = kind
        self.file_version = file_version
        self.supported = supported
        super().__init__(
            f"kind={kind!r} file_version={file_version!r} is newer than supported {supported!r}"
        )


class _Migrator(Protocol):
    FROM: str
    TO: str

    def migrate(self, raw: dict[str, Any]) -> dict[str, Any]: ...


def _semver_key(value: str) -> tuple[int, int, int]:
    """Return a sortable (major, minor, patch) tuple. Pre-release /
    build metadata are stripped — migrations key on the X.Y.Z core."""
    core = value.split("-", 1)[0].split("+", 1)[0]
    parts = core.split(".")
    if len(parts) != 3:
        raise ValueError(f"non-SemVer migrator version: {value!r}")
    return (int(parts[0]), int(parts[1]), int(parts[2]))


def _load_migrators(kind: str) -> list[_Migrator]:
    """Import every migrator module under ``app.migrations.<kind>`` and
    return them sorted by (FROM, TO). Baseline files are skipped."""
    if kind not in KNOWN_KINDS:
        raise ValueError(f"unknown migration kind: {kind!r}")
    pkg_name = f"app.migrations.{kind}"
    pkg = importlib.import_module(pkg_name)
    migrators: list[_Migrator] = []
    for info in pkgutil.iter_modules(pkg.__path__):
        if info.name.endswith("_baseline"):
            continue
        mod = importlib.import_module(f"{pkg_name}.{info.name}")
        if not all(hasattr(mod, attr) for attr in ("FROM", "TO", "migrate")):
            logger.warning(
                "Migrator %s missing FROM/TO/migrate; ignoring",
                f"{pkg_name}.{info.name}",
            )
            continue
        migrators.append(mod)  # type: ignore[arg-type]
    migrators.sort(key=lambda m: (_semver_key(m.FROM), _semver_key(m.TO)))
    return migrators


def run_migrator_chain(
    raw: dict[str, Any],
    *,
    kind: str,
    from_: str,
    to: str,
) -> dict[str, Any]:
    """Apply migrators to bring ``raw`` from ``from_`` to ``to``.

    Returns a new dict (input is never mutated). Raises
    :class:`MigrationGapError` if no chain exists, or if the
    requested ``from_`` is newer than ``to``.
    """
    if from_ == to:
        return copy.deepcopy(raw)
    if kind not in KNOWN_KINDS:
        raise ValueError(f"unknown migration kind: {kind!r}")
    if _semver_key(from_) > _semver_key(to):
        raise MigrationGapError(kind, from_, to)

    migrators = _load_migrators(kind)
    cursor = from_
    payload = copy.deepcopy(raw)
    while cursor != to:
        next_step = next(
            (m for m in migrators if m.FROM == cursor and _semver_key(m.TO) <= _semver_key(to)),
            None,
        )
        if next_step is None:
            raise MigrationGapError(kind, from_, to)
        payload = next_step.migrate(payload)
        payload["schema_version"] = next_step.TO
        cursor = next_step.TO
    return payload
