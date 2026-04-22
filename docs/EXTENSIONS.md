# Extensions

CORE Discovery supports per-customer plugin modules so each `core-<customer>` deploy can add agents, providers, prompt overrides, or custom routers without forking framework source.

## How it works

On startup the framework scans `settings.extensions_dir` (default `./extensions`, env `EXTENSIONS_DIR`) for `*.py` files. Each file is imported and, if it exposes a `register(app, settings)` function, that function is called with the FastAPI app and live settings instance.

Files prefixed with `_` are skipped. Failures in a plugin are logged but never abort framework startup.

## Customer deploy wiring

Mount your extensions directory into the backend container:

```yaml
# customer compose.yaml
services:
  backend:
    image: ghcr.io/zitro/core-framework-backend:1.2.0
    environment:
      EXTENSIONS_DIR: /data/extensions
    volumes:
      - ./extensions:/data/extensions:ro
```

## Plugin contract

```python
# extensions/my_plugin.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def my_endpoint() -> dict:
    return {"hello": "from my plugin"}

def register(app, settings) -> None:
    """Called once on framework startup."""
    app.include_router(router, prefix="/api/ext/my-plugin", tags=["ext:my-plugin"])
```

After deploy, the endpoint is reachable at `GET /api/ext/my-plugin/`.

## What plugins can do

- **Add routers.** Mount under `/api/ext/<your-name>/` to avoid conflicts with future framework routes.
- **Override providers.** Replace `get_storage_provider()` / `get_llm_provider()` etc. with custom implementations by monkey-patching the registry. (Use sparingly; prefer composition.)
- **Add agents.** Register a new agent in `app.agents.registry` so it shows up in the UI agent list.
- **Override prompts.** Read from a prompt directory mounted by the customer and inject as system prompts.

## What plugins cannot do (in v1.2)

- Plugins do **not** get a stable API contract yet — internal framework symbols may shift between minor versions. Pin your `compose.yaml` to a specific framework tag and test before bumping.
- Plugins cannot replace core models or change Cosmos schemas.
- There is no sandboxing — plugin code runs with the same privileges as the framework. Only mount extensions you trust.

A formal stable extension API is planned for v2.0. Until then, treat extensions as **deployment-time customizations**, not redistributable packages.

## See also

- [`PROJECT_MODEL.md`](PROJECT_MODEL.md) — multi-project architecture
- `examples/extensions/hello_extension.py` — minimal working plugin
