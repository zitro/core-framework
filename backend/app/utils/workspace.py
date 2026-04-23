"""Customer multi-source workspace resolver (v2.2).

A Customer can connect any number of Sources. Each Source is one of:

  * ``GITHUB`` — remote git repo. Cloned on demand into
    ``{customers_workspace_root}/{customer-slug}/{source-id}/``.
  * ``LOCAL``  — already-cloned git repo on disk; ``location`` is the
    absolute path. Used as-is.
  * ``FOLDER`` — plain folder, no git semantics. ``location`` is the
    absolute path. Used as-is.

Inside any source root, the "projects" directory is autodetected with a
3-tier convention so the same code works for vertex repos, core overlays,
and ad-hoc note folders:

  1. ``{root}/{customer-slug}/`` — vertex spec
     (``commercial-software-engineering/vertex`` follows this).
  2. ``{root}/projects/`` — core-framework overlay convention.
  3. ``{root}`` — fallback for plain folders.

This module is pure path math — no I/O beyond ``Path.is_dir`` /
``iterdir``. Git operations live in :mod:`app.utils.git_ops`.
"""

from __future__ import annotations

from pathlib import Path

from app.config import settings
from app.models.customer import Source, SourceKind


def workspace_root() -> Path:
    """Absolute root for cloned customer workspaces."""
    return Path(settings.customers_workspace_root).expanduser().resolve()


def source_root(customer_slug: str, source: Source) -> Path:
    """Return the on-disk root of ``source`` for ``customer_slug``.

    For GITHUB sources this is the local clone path (parent dir is
    auto-created; the clone itself is created by ``git_ops.ensure_clone``).
    For LOCAL / FOLDER sources this is ``source.location`` resolved to
    an absolute path.
    """
    if source.kind == SourceKind.GITHUB:
        return workspace_root() / customer_slug / source.id
    return Path(source.location).expanduser().resolve()


def resolve_projects_dir(customer_slug: str, root: Path) -> Path:
    """Return the projects directory inside ``root`` using 3-tier autodetect.

    Order:
      1. ``{root}/{customer_slug}/`` if it exists and is non-empty
         (matches the vertex spec).
      2. ``{root}/projects/`` if it exists (core-framework overlay).
      3. ``{root}`` itself (plain folder).
    """
    if not root.is_dir():
        return root
    cand = root / customer_slug
    if cand.is_dir() and any(cand.iterdir()):
        return cand
    cand = root / "projects"
    if cand.is_dir():
        return cand
    return root


def resolve_source_projects(customer_slug: str, source: Source) -> Path:
    """Convenience: source_root + resolve_projects_dir in one call."""
    return resolve_projects_dir(customer_slug, source_root(customer_slug, source))


def list_writable_sources(sources: list[Source]) -> list[Source]:
    """Filter to sources flagged ``writable=True``."""
    return [s for s in sources if s.writable]


def default_vertex_target(sources: list[Source]) -> Source | None:
    """Pick a default writable vertex Source if exactly one exists.

    Used by /execute "push to vertex" to preselect a target. Returns
    ``None`` when there are zero or multiple candidates (UI must prompt).
    """
    from app.models.customer import SourceRole

    candidates = [s for s in sources if s.writable and s.role == SourceRole.VERTEX]
    return candidates[0] if len(candidates) == 1 else None
