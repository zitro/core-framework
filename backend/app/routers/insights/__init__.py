from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user

from . import activity, coverage, decisions, inbox, search, stakeholders

router = APIRouter(dependencies=[Depends(get_current_user)])
router.include_router(coverage.router)
router.include_router(inbox.router)
router.include_router(activity.router)
router.include_router(stakeholders.router)
router.include_router(decisions.router)
router.include_router(search.router)

__all__ = ["router"]
