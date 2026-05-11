"""Synthesis router package — 6C/6D/6E surface.

Mounted at ``/api/synthesis``. All project-scoped routes take a
``project_id`` path segment so the project comes from the URL — no
implicit context.

Endpoint surface (split across ``_catalog.py``, ``_artifacts.py``,
``_critic.py``, ``_chat.py``, ``_questions.py``):

  - GET  /catalog                                          ArtifactType registry
  - GET  /{project_id}/artifacts                           list saved artifacts
  - POST /{project_id}/synthesize                          generate critical types
  - POST /{project_id}/artifacts/{artifact_id}/critique    run critic (6D)
  - GET  /{project_id}/signals                             deterministic signals (6D)
  - GET  /{project_id}/compass                             per-category health (6D)
  - POST /{project_id}/chat                                corpus-grounded chat (6E)
  - GET  /{project_id}/chat                                list chat turns (6E)
  - POST /{project_id}/questions/refresh                   regenerate questions (6E)
  - GET  /{project_id}/questions                           list customer questions (6E)
  - POST /{project_id}/artifacts/{type_id}/regenerate      regenerate one

Endpoint additions (6J):
  - POST /{project_id}/export/{fmt}                        docx/pptx readout

Deferred to later sub-phases:
  - engagement-repo write-back       (6K)
  - image generation                 (6L)
"""

from __future__ import annotations

# Importing each submodule registers its @router.<method> decorators on
# the shared router instance. Order doesn't matter — every submodule
# imports `router` from _router.py.
from app.routers.synthesis import (
    _artifacts,  # noqa: F401, E402
    _catalog,  # noqa: F401, E402
    _chat,  # noqa: F401, E402
    _connectors,  # noqa: F401, E402
    _critic,  # noqa: F401, E402
    _exports,  # noqa: F401, E402
    _notes,  # noqa: F401, E402
    _questions,  # noqa: F401, E402
)
from app.routers.synthesis._router import router

__all__ = ["router"]
