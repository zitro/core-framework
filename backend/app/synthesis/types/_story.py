"""ArtifactType entries for the Story category.

Generated as part of the 300-line cleanup; do not edit by hand
unless you mean to. Add new artifact types here (then the package
__init__ picks them up via the registry list)."""

from __future__ import annotations

from app.synthesis.categories import Category
from app.synthesis.types._base import ArtifactType


STORY_TYPES: list[ArtifactType] = [
    ArtifactType(
        id="executive-brief",
        category=Category.STORY,
        label="Executive Brief",
        description="One-page narrative for a customer exec.",
        body_schema={
            "headline": "Single sentence the exec will remember.",
            "situation": "Two sentences on the current state.",
            "complication": "Two sentences on what's forcing change.",
            "resolution": "Two sentences on the proposed path.",
            "ask": "One sentence on what we need from them next.",
        },
        prompt=(
            "Write a one-page executive brief in the SCRA structure "
            "(Situation, Complication, Resolution, Ask). Tone: confident, "
            "consultative, no jargon. Pull every claim from the corpus."
        ),
        critical=True,
    ),
    ArtifactType(
        id="elevator-pitch",
        category=Category.STORY,
        label="Elevator Pitch",
        description="The 30-second version.",
        body_schema={
            "pitch": "60–90 word spoken-style pitch.",
            "proof_point": "One sentence of evidence from the corpus.",
        },
        prompt=(
            "Write the elevator pitch as if delivered in person. Conversational, "
            "no buzzwords, ends with a clear next step."
        ),
    ),
    ArtifactType(
        id="deck-outline",
        category=Category.STORY,
        label="Deck Outline",
        description="Slide-by-slide story for the customer readout.",
        body_schema={
            "title": "Deck title.",
            "slides": (
                "Ordered list of {slide_number, title, key_point, supporting_bullets, visual_hint}"
            ),
        },
        prompt=(
            "Outline a 10–15 slide customer deck. Each slide has one key point "
            "and 2–4 supporting bullets. Story arc: why → value → what → "
            "scope → how → ask. The opening slide must restate the customer's "
            "own words back to them."
        ),
        critical=True,
    ),
    ArtifactType(
        id="customer-readout",
        category=Category.STORY,
        label="Customer Readout",
        description="Long-form narrative document for the customer.",
        body_schema={
            "sections": ("Ordered list of {heading, body (markdown, 2–4 paragraphs), callouts}"),
        },
        prompt=(
            "Write a long-form customer readout document. Headings cover the "
            "engagement narrative end-to-end. Each section is 2–4 paragraphs "
            "of prose, not bullets. Cite the corpus inline."
        ),
    ),
    ArtifactType(
        id="press-release",
        category=Category.STORY,
        label="Future Press Release",
        description="Amazon-style PR for the moment we succeed.",
        body_schema={
            "headline": "What the world reads.",
            "subhead": "One supporting sentence.",
            "body": "Three short paragraphs: announcement, customer quote, MSFT quote.",
        },
        prompt=(
            "Write the future press release announcing this initiative as a "
            "success. Date it 12–18 months from kickoff. The customer quote "
            "must sound like the personas we wrote, not like marketing."
        ),
    ),
    ArtifactType(
        id="storyboard",
        category=Category.STORY,
        label="Storyboard",
        description="Visual narrative of how the solution plays out, frame by frame.",
        body_schema={
            "persona": "Persona this story follows.",
            "frames": (
                "Ordered list of {caption, description, persona_action, "
                "image_prompt, image_url}. 4-8 frames. image_prompt is the "
                "text passed to the image generator; image_url is filled in "
                "after generation runs."
            ),
            "takeaway": "One-sentence summary the audience should leave with.",
        },
        prompt=(
            "Tell the solution as a 4-8 frame visual story for a non-technical "
            "audience. Each frame describes one moment in the persona's day. "
            "For each frame write an image_prompt suitable for an AI image "
            "generator: concise, concrete, no proper nouns, no trademarks. "
            "Keep image_url empty — the generator fills it in afterward."
        ),
    ),
]
