"""Migrate Discovery rows into the Synthesis project model.

Idempotent. Dry-run by default. Run from the backend root:

    python -m scripts.migrate_discoveries_to_synthesis            # dry run
    python -m scripts.migrate_discoveries_to_synthesis --apply    # write

For each row in the legacy ``discoveries`` collection:

* Ensure an ``engagements`` row exists with the same id (create if not).
* Promote the Discovery's ``evidence`` items into Synthesis source docs
  parked under ``metadata.sources.discovery_archive``.
* Promote any attached transcripts (id-referenced) the same way.
* Never deletes anything from ``discoveries``. Stage 5 of the sunset
  ADR drops the collection registration.

The script logs a per-row decision: ``create``, ``merge``, ``skip``.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from typing import Any

from app.providers.storage import get_storage_provider

logger = logging.getLogger("migrate_discoveries")

DISCOVERIES = "discoveries"
ENGAGEMENTS = "engagements"
EVIDENCE = "evidence"
TRANSCRIPTS = "transcripts"
ARCHIVE_KEY = "discovery_archive"


async def _evidence_for_discovery(storage: Any, discovery: dict) -> list[dict]:
    """Collect evidence both inline on the Discovery and from the
    standalone Evidence collection where ``discovery_id`` matches.
    """
    out: list[dict] = list(discovery.get("evidence") or [])
    try:
        rows = await storage.list(EVIDENCE)
    except Exception:
        return out
    out.extend([r for r in rows if r.get("discovery_id") == discovery.get("id")])
    return out


async def _transcripts_for_discovery(storage: Any, discovery: dict) -> list[dict]:
    try:
        rows = await storage.list(TRANSCRIPTS)
    except Exception:
        return []
    return [r for r in rows if r.get("discovery_id") == discovery.get("id")]


def _archive_payload(evidence: list[dict], transcripts: list[dict]) -> dict:
    """Reduce evidence + transcripts to the SourceDoc-compatible shape
    the synthesis corpus consumes when it walks ``metadata.sources``.
    """
    docs: list[dict] = []
    for e in evidence:
        text = (e.get("content") or e.get("snippet") or "").strip()
        if not text:
            continue
        docs.append(
            {
                "id": f"discovery-evidence:{e.get('id') or len(docs)}",
                "title": e.get("title") or e.get("evidence_type") or "evidence",
                "uri": e.get("source_url") or "",
                "text": text[:32_000],
            }
        )
    for t in transcripts:
        text = (t.get("transcript") or t.get("text") or "").strip()
        if not text:
            continue
        docs.append(
            {
                "id": f"discovery-transcript:{t.get('id') or len(docs)}",
                "title": t.get("title") or "transcript",
                "uri": "",
                "text": text[:32_000],
            }
        )
    return {"docs": docs}


async def migrate(*, apply: bool) -> dict[str, int]:
    storage = get_storage_provider()
    try:
        discoveries = await storage.list(DISCOVERIES)
    except Exception as exc:
        logger.warning("no discoveries collection (%s) — nothing to migrate", exc)
        return {"create": 0, "merge": 0, "skip": 0}

    counts = {"create": 0, "merge": 0, "skip": 0}
    for d in discoveries:
        did = d.get("id") or ""
        if not did:
            counts["skip"] += 1
            continue

        existing = None
        try:
            existing = await storage.get(ENGAGEMENTS, did)
        except Exception:
            existing = None

        evidence = await _evidence_for_discovery(storage, d)
        transcripts = await _transcripts_for_discovery(storage, d)
        archive = _archive_payload(evidence, transcripts)

        if existing:
            metadata = dict(existing.get("metadata") or {})
            sources = dict(metadata.get("sources") or {})
            if sources.get(ARCHIVE_KEY) and not apply:
                counts["skip"] += 1
                logger.info("skip %s — already archived", did)
                continue
            sources[ARCHIVE_KEY] = archive
            metadata["sources"] = sources
            existing["metadata"] = metadata
            counts["merge"] += 1
            action = "merge"
            payload = existing
        else:
            payload = {
                "id": did,
                "name": d.get("name") or did,
                "description": d.get("description") or "",
                "metadata": {"sources": {ARCHIVE_KEY: archive}},
            }
            counts["create"] += 1
            action = "create"

        logger.info(
            "%s %s — evidence=%d transcripts=%d",
            action,
            did,
            len(evidence),
            len(transcripts),
        )

        if not apply:
            continue

        if existing:
            await storage.update(ENGAGEMENTS, did, payload)
        else:
            await storage.create(ENGAGEMENTS, payload)

    return counts


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--apply",
        action="store_true",
        help="Actually write to storage. Default is dry run.",
    )
    p.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="DEBUG-level logging.",
    )
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    counts = asyncio.run(migrate(apply=args.apply))
    mode = "APPLIED" if args.apply else "DRY RUN"
    logger.info(
        "%s — created=%d merged=%d skipped=%d",
        mode,
        counts["create"],
        counts["merge"],
        counts["skip"],
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
