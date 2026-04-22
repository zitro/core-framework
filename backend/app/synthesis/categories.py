"""Synthesis categories.

Five outcome-anchored buckets that mirror the Design Thinking modes
(empathize / define / ideate / prototype / test) but speak the language a
Microsoft FDE / TPM uses when talking to a customer:

    why    -> empathize  : the pain, the user, the context
    value  -> define     : the upside if we solve it
    what   -> ideate     : the things we'd actually build / do
    scope  -> prototype  : how big, how fast, in which container (FDE / workshop / hackathon / MVE / MVP)
    how    -> test       : the technical and operational shape, the risks
"""

from __future__ import annotations

from enum import StrEnum


class Category(StrEnum):
    WHY = "why"
    VALUE = "value"
    WHAT = "what"
    SCOPE = "scope"
    HOW = "how"


CATEGORY_ORDER: tuple[Category, ...] = (
    Category.WHY,
    Category.VALUE,
    Category.WHAT,
    Category.SCOPE,
    Category.HOW,
)


CATEGORY_LABELS: dict[Category, str] = {
    Category.WHY: "Why",
    Category.VALUE: "Value",
    Category.WHAT: "What",
    Category.SCOPE: "Scope",
    Category.HOW: "How",
}


CATEGORY_DESCRIPTIONS: dict[Category, str] = {
    Category.WHY: "The pain we're solving and the people who feel it.",
    Category.VALUE: "What changes for the business if we solve it.",
    Category.WHAT: "The work we'd actually do — workstreams, capabilities, features.",
    Category.SCOPE: "How big and how fast — FDE, workshop, hackathon, MVE, MVP.",
    Category.HOW: "Technical shape, data flow, and the risks worth naming.",
}
