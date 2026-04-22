"""Minimal CORE Discovery extension — adds a hello endpoint at /api/ext/hello.

Customer deploys mount their ``extensions/`` directory into the backend
container; the framework loads every ``*.py`` here and calls ``register``.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def hello() -> dict:
    return {"message": "hello from a CORE Discovery extension"}


def register(app, settings) -> None:  # noqa: ARG001
    app.include_router(router, prefix="/api/ext/hello", tags=["ext:hello"])
