"""Shared FastAPI APIRouter instance for the synthesis package.

Lives in its own module to avoid circular imports — every endpoint file
imports the router from here, and the package ``__init__`` imports each
endpoint file to register its decorators."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

# Engagement-as-Project storage key. Mirrors backend/app/routers/engagements.py.
PROJECTS_COLLECTION = "engagements"
