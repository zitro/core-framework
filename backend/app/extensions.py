"""Extension API — load per-customer plugin modules at startup.

Each ``*.py`` file in :data:`app.config.Settings.extensions_dir` is imported
and (if present) its ``register(app, settings)`` function is called. Plugins
may add routers, register custom agents/providers, or override prompts —
without touching framework source.

Example plugin (``extensions/hello.py``)::

    from fastapi import APIRouter

    router = APIRouter()

    @router.get("/")
    async def hello():
        return {"message": "hello from a plugin"}

    def register(app, settings):
        app.include_router(router, prefix="/api/ext/hello", tags=["ext:hello"])

The loader is best-effort: a failing plugin is logged and skipped, never
fatal to the framework boot.
"""

from __future__ import annotations

import importlib.util
import logging
import sys
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = logging.getLogger(__name__)

_REGISTER_FN = "register"


def load_extensions(app: FastAPI, extensions_dir: str, settings_obj: object) -> list[str]:
    """Discover and register every ``*.py`` plugin in ``extensions_dir``.

    Returns the list of plugin module names that successfully registered.
    Missing or empty directories are a no-op.
    """
    root = Path(extensions_dir).expanduser()
    if not root.is_dir():
        logger.info("Extensions: %s does not exist; skipping", root)
        return []

    loaded: list[str] = []
    for path in sorted(root.glob("*.py")):
        if path.name.startswith("_"):
            continue
        mod_name = f"core_ext_{path.stem}"
        try:
            spec = importlib.util.spec_from_file_location(mod_name, path)
            if spec is None or spec.loader is None:
                logger.warning("Extensions: could not load spec for %s", path)
                continue
            module = importlib.util.module_from_spec(spec)
            sys.modules[mod_name] = module
            spec.loader.exec_module(module)  # type: ignore[union-attr]
            register = getattr(module, _REGISTER_FN, None)
            if not callable(register):
                logger.warning(
                    "Extensions: %s has no callable %s(app, settings); skipping",
                    path.name,
                    _REGISTER_FN,
                )
                continue
            register(app, settings_obj)
            loaded.append(path.stem)
            logger.info("Extensions: loaded %s", path.stem)
        except Exception:  # noqa: BLE001
            logger.exception("Extensions: failed to load %s", path.name)
    return loaded
