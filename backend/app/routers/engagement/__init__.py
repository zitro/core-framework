"""Engagement repo router — scan, preview, ingest, and export.

Mounted at ``/api/engagement``. Submodules register their decorators on the
shared router instance defined in ``_router.py``.
"""

from __future__ import annotations

from app.routers.engagement import (
    _export,  # noqa: F401
    _ingest,  # noqa: F401
    _scan,  # noqa: F401
)
from app.routers.engagement._router import router

__all__ = ["router"]
