"""ArtifactType entries for the Operational category.

Generated as part of the 300-line cleanup; do not edit by hand
unless you mean to. Add new artifact types here (then the package
__init__ picks them up via the registry list)."""

from __future__ import annotations

from app.synthesis.categories import Category
from app.synthesis.types._base import ArtifactType


OPERATIONAL_TYPES: list[ArtifactType] = [
    ArtifactType(
        id="status-update",
        category=Category.OPERATIONAL,
        label="Weekly Status Update",
        description="Internal/customer-shareable status: shipped, blocked, next.",
        body_schema={
            "summary": "One-paragraph executive summary.",
            "shipped": "Bullets of what landed since last update.",
            "blocked": "Bullets of what's blocked and the ask.",
            "next": "Bullets of what's planned for the next interval.",
            "risks": "Optional bullets of new or escalating risks.",
        },
        prompt=(
            "Draft a weekly status update for this engagement. Keep tone "
            "factual and concise. Source `shipped` from synthesised artifacts "
            "and source documents updated since the last status. Source "
            "`blocked` and `risks` from critic issues and detector signals. "
            "Keep `next` aligned with the engagement plan if present."
        ),
    ),
    ArtifactType(
        id="weekly-email-update",
        category=Category.OPERATIONAL,
        label="Weekly Email Update",
        description="Send-ready email summarising progress from the past 7 days only.",
        body_schema={
            "subject": "Email subject line. Format: '[Project] Weekly update — <Mon DD>'.",
            "greeting": "One-line greeting addressed to the customer stakeholder group.",
            "body": (
                "Markdown body, 150-300 words. Sections: ## Highlights, ## In flight, "
                "## Blocked / need from you, ## Up next. Bullets only, one line each."
            ),
            "signoff": "One-line sign-off plus owner name.",
        },
        prompt=(
            "Draft a weekly email update for the customer. CRITICAL: include only "
            "items that changed in the past 7 days based on artifact `updated_at` "
            "or source `last_modified`. Do not restate the entire engagement. "
            "Tone is direct and confident, written by an MSFT FDE to a customer "
            "stakeholder. Highlights first, then in-flight, then asks, then "
            "what's coming. If there is genuinely no movement in a section, "
            "write 'Nothing this week.' rather than padding."
        ),
    ),
    ArtifactType(
        id="wrap-up",
        category=Category.OPERATIONAL,
        label="Engagement Wrap-up",
        description="Closing artifact summarising outcomes, learnings, and handoff.",
        body_schema={
            "outcomes": "Bullets — what we delivered and the business impact.",
            "decisions": "Bullets — decisions made and who owns them going forward.",
            "open_items": "Bullets — what remains and the recommended owner.",
            "learnings": "Bullets — what would we do differently next time.",
            "handoff": "Paragraph — who continues the work, what artifacts they receive.",
        },
        prompt=(
            "Write the engagement wrap-up. Pull `outcomes` from accepted "
            "artifacts and decision-extractor signals. Pull `open_items` from "
            "outstanding questions and warn/blocker signals. `learnings` is "
            "honest \u2014 do not flatter."
        ),
        critical=True,
    ),
    ArtifactType(
        id="retro",
        category=Category.OPERATIONAL,
        label="Retrospective",
        description="Short, candid review: start / stop / continue + action items.",
        body_schema={
            "start": "Bullets — practices to begin doing.",
            "stop": "Bullets — practices to discontinue.",
            "continue": "Bullets — practices to keep.",
            "action_items": (
                "List of {action, owner_role, due_week_offset}. Each action "
                "must have a single owning role and a relative due date."
            ),
        },
        prompt=(
            "Run the retrospective for this engagement or sprint. Pull from "
            "corpus signals about what worked and what did not. Be candid; "
            "flattery wastes the team's time. Every action item must have an "
            "owning role and a relative due date."
        ),
    ),
]
