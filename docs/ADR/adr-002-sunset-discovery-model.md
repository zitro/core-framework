---
title: ADR-002 — Sunset the Discovery model in favor of Project + Synthesis
description: Plan and rationale for removing the legacy Discovery domain
author: Bryan Ortiz
ms.date: 2026-04-22
ms.topic: reference
keywords:
  - adr
  - architecture decision
  - discovery
  - synthesis
  - migration
estimated_reading_time: 6
---

## Status

Accepted

## Context

The framework currently exposes two parallel domains:

* **Discovery** — the original IA. Surfaces `Capture / Orient / Refine /
  Execute` phases, a `Discoveries` collection, and ~14 backend routers
  (`agents`, `advisor`, `blueprints`, `engagement`, `evidence`,
  `narrative`, `problem_statements`, `questions`, `realtime`, `reviews`,
  `transcripts`, plus the `discovery` router itself).
* **Synthesis** — the v1.4+ model. Project-first, evidence-cited, with
  a generator catalog, source connectors (v1.9), DT Compass, and
  auto-rebuild.

Synthesis has reached feature parity for everything we ship to
customers. Discovery now exists primarily as legacy surface area:

* It owns no UX a customer-facing engagement actually uses.
* Its tests (`test_discovery.py`, `test_engagements.py`, etc.) anchor
  ~12 backend test files and slow the suite.
* It blocks rebranding — the product still calls itself "CORE Discovery"
  in the sidebar header because of it.
* It costs cognitive overhead: every new contributor asks "do I add this
  to Discovery or Synthesis?"

The PRD `docs/PRD/v1.3-to-v2.0.md` flagged removal as v2.0.0 work. We
are now executing that removal, but per current product policy the
version number is held at `1.9.0`.

## Decision drivers

* Remove dead surface area before adding new features on top of it.
* Stop confusing contributors with two competing domain models.
* Unblock rebranding ("CORE Discovery" → "CORE").
* Keep the running `core-allstate` deployment functional throughout.

## Options considered

### Option 1 — Big-bang delete

Delete every Discovery file, router, page, and test in a single commit.
Tag a major version.

* Pro: smallest blast radius in time.
* Con: unrecoverable for any consumer that still relies on Discovery
  endpoints. No upgrade path for existing `discoveries` rows.

### Option 2 — Staged sunset (chosen)

Five sequential, individually-deployable commits:

1. **Migration script** — converts existing `discoveries` storage rows
   into Synthesis projects + artifacts. Idempotent, dry-run by default.
2. **Deprecate routers** — keep them mounted but log a deprecation
   warning per request. Frontend already does not call them.
3. **Remove sidebar nav** — drops Discovery / phase links from the IA
   without touching backend.
4. **Delete pages** — removes `/capture`, `/orient`, `/refine`,
   `/execute`, `/discoveries` route handlers and their components.
5. **Delete routers + tests** — removes Discovery routers,
   `discovery_coach` agent, `discoveries` storage collection, and the
   ~12 Discovery-anchored test files. Rebrand "CORE Discovery" → "CORE".

Each step keeps the backend boot-clean and the frontend type-clean.

### Option 3 — Feature flag

Hide Discovery behind an env flag, leave the code in place.

* Pro: zero deletion risk.
* Con: doubles maintenance forever; never solves the "two models"
  problem; we already know we want it gone.

## Decision

Adopt **Option 2 — Staged sunset.** Each stage ships as its own commit
on `master`, with `pytest` and `pnpm lint` green before pushing.

## Consequences

### Positive

* Single source of truth (Synthesis) for all customer engagements.
* Sidebar / header no longer say "CORE Discovery" — clean rebrand.
* `pytest` suite shrinks from 124 tests to roughly 60–70.
* Clear story for new contributors: "everything is a Project + Synthesis."

### Negative

* Any external consumer hitting `/api/discovery/*`, `/api/agents/*`,
  `/api/blueprints/*`, etc. breaks at stage 5. Mitigated by stage 2's
  deprecation log giving operators a heads-up.
* Existing `discoveries` storage rows must be migrated before stage 5,
  or they become orphaned data.

### Migration contract

The migration script (`backend/scripts/migrate_discoveries_to_synthesis.py`):

* Reads every row in the `discoveries` storage collection.
* For each, ensures a Synthesis `engagements` row exists with the same
  `id` (creates one if missing).
* Promotes the Discovery's `evidence`, `transcripts`, and `questions`
  into Synthesis source documents under
  `metadata.sources.discovery_archive`.
* Writes nothing to the old collection. Old rows remain until stage 5
  drops the collection registration.

## Related

* `docs/PRD/v1.3-to-v2.0.md` §10–§11 — IA changes and roadmap.
* `docs/ADR/adr-001-provider-abstraction.md` — the provider model that
  makes the Synthesis adapter contract possible.
