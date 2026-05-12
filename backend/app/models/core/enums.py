from enum import StrEnum


class CorePhase(StrEnum):
    CAPTURE = "capture"
    ORCHESTRATE = "orchestrate"
    REFINE = "refine"
    EXECUTE = "execute"

    @classmethod
    def _missing_(cls, value):
        # Backward compatibility for legacy deployments that still emit/use
        # the old phase label "orient".
        if isinstance(value, str) and value.lower() == "orient":
            return cls.ORCHESTRATE
        return None


class DiscoveryMode(StrEnum):
    STANDARD = "standard"
    FDE = "fde"
    WORKSHOP_SPRINT = "workshop_sprint"


class ConfidenceLevel(StrEnum):
    VALIDATED = "validated"
    ASSUMED = "assumed"
    UNKNOWN = "unknown"
    CONFLICTING = "conflicting"


class EvidenceType(StrEnum):
    """Design-thinking-aligned evidence taxonomy.

    `GENERAL` is the legacy default for items captured before the taxonomy
    existed. New items should pick a specific type.
    """

    GENERAL = "general"
    OBSERVATION = "observation"
    QUOTE = "quote"
    PAIN_POINT = "pain_point"
    JTBD = "jtbd"
    ASSUMPTION = "assumption"
    HYPOTHESIS = "hypothesis"
    INSIGHT = "insight"


class EngagementSourceType(StrEnum):
    LOCAL_FOLDER = "local_folder"
    REPOSITORY = "repository"


class EngagementStatus(StrEnum):
    PROPOSED = "proposed"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ReviewStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"
