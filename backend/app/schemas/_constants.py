"""Schema-kind registry shared across schemas, migrations, and the
generator. Adding a new schema kind = adding it here, dropping a
Pydantic model in this package, and adding ``<kind>/`` under
``app/migrations/``."""

from __future__ import annotations

# Stable identifiers used by:
#   - app/migrations/__init__.py to discover per-kind migrator chains
#   - scripts/gen-schemas.mjs to derive output filenames
#   - tests asserting Pydantic ↔ JSON Schema parity
KNOWN_KINDS: frozenset[str] = frozenset(
    {
        "core_discovery_marker",
    }
)
