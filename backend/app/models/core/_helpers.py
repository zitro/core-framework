from datetime import UTC, datetime


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_confidence(value) -> int:
    try:
        confidence = float(value or 0)
    except (TypeError, ValueError):
        return 0
    if 0 < confidence <= 1:
        confidence *= 100
    return max(0, min(100, round(confidence)))
