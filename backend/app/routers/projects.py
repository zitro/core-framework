"""Projects router — first-class alias for the engagements API.

``Engagement`` is the canonical "Project" entity: one customer per deploy,
many projects per customer. The legacy ``/api/engagements`` path remains for
backward compatibility; new clients should prefer ``/api/projects``.

The actual handlers live in :mod:`app.routers.engagements` and are re-mounted
under both prefixes in :func:`app.main.create_app`.
"""

from app.routers.engagements import router

__all__ = ["router"]
