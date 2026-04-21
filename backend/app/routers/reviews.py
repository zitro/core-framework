"""Reviews router — human-in-the-loop approval gates for any artifact."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user
from app.models.core import Review, ReviewDecision, ReviewStatus
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create, stamp_update
from app.utils.audit_log import audit

router = APIRouter(dependencies=[Depends(get_current_user)])
COLLECTION = "reviews"


@router.post("/", response_model=Review, status_code=201)
async def request_review(review: Review, claims: dict = Depends(get_current_user)) -> Review:
    """Open a review request for an artifact."""
    storage = get_storage_provider()
    if not review.requested_by:
        review.requested_by = claims.get("name") or claims.get("sub") or "unknown"
    item = await storage.create(COLLECTION, stamp_create(review.model_dump(mode="json")))
    return Review(**item)


@router.get("/", response_model=list[Review])
async def list_reviews(
    discovery_id: str | None = Query(default=None),
    engagement_id: str | None = Query(default=None),
    status: ReviewStatus | None = Query(default=None),
) -> list[Review]:
    storage = get_storage_provider()
    filters: dict = {}
    if discovery_id:
        filters["discovery_id"] = discovery_id
    if status:
        filters["status"] = status.value
    items = await storage.list(COLLECTION, filters or None)
    if engagement_id:
        engagement = await storage.get("engagements", engagement_id)
        if not engagement:
            raise HTTPException(status_code=404, detail="Engagement not found")
        allowed = set(engagement.get("discovery_ids") or [])
        items = [i for i in items if i.get("discovery_id") in allowed]
    return [Review(**item) for item in items]


@router.get("/{review_id}", response_model=Review)
async def get_review(review_id: str) -> Review:
    storage = get_storage_provider()
    item = await storage.get(COLLECTION, review_id)
    if not item:
        raise HTTPException(status_code=404, detail="Review not found")
    return Review(**item)


@router.post("/{review_id}/decision", response_model=Review)
async def decide_review(
    review_id: str,
    decision: ReviewDecision,
    claims: dict = Depends(get_current_user),
) -> Review:
    storage = get_storage_provider()
    existing = await storage.get(COLLECTION, review_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Review not found")
    reviewer = decision.reviewer or claims.get("name") or claims.get("sub") or "unknown"
    updates = stamp_update(
        {
            "status": decision.status.value,
            "reviewer": reviewer,
            "comment": decision.comment,
            "decided_at": datetime.now(UTC).isoformat(),
        }
    )
    item = await storage.update(COLLECTION, review_id, updates)
    await audit(
        "review_decision",
        collection=existing.get("artifact_collection", ""),
        item_id=existing.get("artifact_id", ""),
        summary=f"{decision.status.value} by {reviewer}",
        after={"review_id": review_id, "status": decision.status.value},
    )
    return Review(**item)
