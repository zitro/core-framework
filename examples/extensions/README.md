# Extensions

Drop ``*.py`` files in this directory and the framework will load them on
startup. Each plugin module must expose a ``register(app, settings)`` function.

Plugins can:

- Add FastAPI routers under ``/api/ext/<name>``
- Register custom agents in the agent registry
- Override prompts or providers

Files prefixed with ``_`` are ignored. Failures in a plugin are logged but
never abort framework startup.

See ``hello_extension.py`` for a minimal working example.

To enable in your customer deploy, mount this directory into the backend
container::

    volumes:
      - ./extensions:/data/extensions:ro

…and set ``EXTENSIONS_DIR=/data/extensions`` (this is the default).
