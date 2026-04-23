# Changelog

All notable changes to CORE Discovery are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.0] - 2026-04-23

Customer + multi-source workspace, drop-zone capture, engagement-brief
context, per-artifact threads with grounded chat, Reports view inside
Execute, and one-click push to vertex from any artifact.

### Added

- **Multi-source customers (B+E)**: new `customers` collection holds a
  display name, slug, summary, and a list of `Source` records. Each
  source has a kind (`github | local | folder`), role (`vertex | core |
  notes | reference`), `writable` flag, optional branch, and Fernet-
  encrypted PAT (only `pat_last4` ever returns to the client). New
  `/api/customers` REST surface (list/get/create/update/delete + add/
  update/delete/sync source). Settings → Customer tab now hosts a real
  CRUD panel with embedded source list, sync action, and add form.
- **Capture (D1)**: `/capture` rebuilt around a drop zone that calls
  `/api/capture/extract-classify`; results render as cards mapped back
  to artifact types so users can promote them into the corpus.
- **Engagement context (B+D2)**: `/api/engagement-context/{pid}` GETs
  and PUTs a structured engagement brief (industry, phase, stakeholders,
  metrics, milestones). `/orient` replaces the old free-form notes with
  a scoped form; optional `?write_to_source_id=` writes the brief back
  to a source as `engagement-brief.md`.
- **Per-artifact threads + chat (B+D3)**: `/api/synthesis/{pid}/
  artifacts/{aid}/thread`, `…/comments`, `…/chat` back a comment
  stream and grounded chat per artifact. Refine view now opens an
  `ArtifactDetailModal` with Detail / Thread / Chat tabs.
- **Reports view (D4)**: `/execute?view=reports` toggles the artifact
  grid into a late-stage-categories report layout (URL-driven).
- **Per-artifact push (E3)**: `/api/synthesis/{pid}/artifacts/{aid}/
  push` ships one card via `VertexWriteBack`. Detail modal exposes a
  "Push to vertex" button that toasts the commit sha on success.

### Changed

- `src/lib/api.ts` adds typed namespaces for `capture`,
  `engagementContext`, `threads`, `customers`, and `artifacts`.
- Settings page replaces the `CustomerPanel` placeholder with the real
  CRUD component; preferences tab unchanged.



### Fixed

- **Markdown rendering on /vertex**: installed `@tailwindcss/typography` (the `prose` classes were no-ops without the plugin in Tailwind v4), strip leading YAML frontmatter and HTML comments before rendering, beef up heading styles (H1/H2 with under-borders, larger sizes, clear vertical rhythm). ADR/template files now render with proper hierarchy instead of as one flat paragraph.

## [2.1.1] - 2026-04-22

### Fixed

- **Frontend container healthcheck**: switched to `127.0.0.1` (was `localhost`, which resolves to IPv6 inside the alpine image while Next.js binds IPv4 only) and bumped `start-period` to 30s. Containers now report `healthy` instead of stuck `unhealthy`.

## [2.1.0] - 2026-04-22

IA collapse, beautiful markdown, and an AI-powered drop zone for the vertex repo. Sidebar shrinks from 14 entries across 5 sections to 8 entries across 3 groups + Settings; every legacy route still resolves through Next.js redirects.

### Added

- **Beautiful markdown rendering**: new `MarkdownView` component (`remark-gfm`, `rehype-slug`, `react-syntax-highlighter`) with prose typography, dark-mode aware code highlighting, bordered/zebra tables, capped reading width. Replaces raw `ReactMarkdown` in the `/vertex` viewer.
- **Vertex drop zone**: side sheet on `/vertex` with paste / file upload / URL modes feeds new endpoints:
  - `POST /api/v2/{project_id}/vertex/extract` — text from URL, `.pdf` (`pypdf`), `.docx` (`python-docx`), `.html` (`trafilatura`).
  - `POST /api/v2/{project_id}/vertex/classify` — strict-JSON LLM call proposes `dest_path` + `filename` against the repo's existing folders; falls back to `inbox/` on low confidence or LLM error.
  - `POST /api/v2/{project_id}/vertex/write` — writes the file with path-traversal guard, 409 on conflict unless `overwrite=true`, audits to `.vertex-log.jsonl` at repo root.
- **/sources page**: unified inputs view with URL-driven tabs (`Connectors | Company | Web | Evidence`).
- **/reports page**: saved view of the artifact catalog filtered to story-category outputs (executive briefs, deck outlines, narratives, wrap-ups).
- **/settings page**: tabs for `Engagement | Reviews | Connections | Preferences` consolidating five legacy pages.

### Changed

- **Sidebar IA**: collapsed from 14 items across 5 sections to 8 items across 3 groups (`WORK`, `INSIGHT`, `REFERENCE`) plus a separate `Settings` entry. Vertex Repo stays conditional on `repo_path`.
- **Command palette**: rebuilt to match new IA with sub-tab shortcuts for Sources and Settings; covers every route including those without a sidebar entry.
- **Stage-aware /artifacts**: hides operational/closing-stage artifacts (wrap-up, retro) until project status is `completed` or `cancelled`, with status pill in the page header and an opt-in toggle. Adds backend tests previously deferred (156 backend tests now passing).

### Routes

- Redirects (302): `/connectors → /sources?tab=connectors`, `/company → /sources?tab=company`, `/search → /sources?tab=web`, `/evidence → /sources?tab=evidence`, `/narrative → /reports`, `/context → /settings?tab=engagement`, `/reviews → /settings?tab=reviews`, `/m365 → /settings?tab=connections`.
- Kept (Cmd+K only): `/grounding`, `/engagements` (also reachable via project switcher).

### Dependencies

- Frontend: `remark-gfm`, `rehype-slug`, `react-syntax-highlighter`, `@types/react-syntax-highlighter`.
- Backend: `pypdf`, `trafilatura` added to base deps (lazy-imported by extract endpoint).

## [2.0.0] - 2026-04-22

Methodology parity, image generation, vertex repo viewer, top-level Artifacts page, and a global command palette. Additive release; existing routes and behavior preserved.

### Added

- **Synthesis catalog**: 9 new design-thinking artifact types (catalog 33 -> 42) â€” `interview-guide`, `empathy-map`, `jtbd`, `emerging-themes`, `root-cause`, `assumption-matrix`, `storyboard`, `quick-win`, `retro`. Closes the gap where 11 of 16 advertised methods had no AI generator.
- **Image generation**: `IMAGE_PROVIDER` provider abstraction (`none` default, `local` deterministic SVG, `azure_openai` DALL-E 3 via `AZURE_OPENAI_IMAGE_DEPLOYMENT`). New `POST /api/v2/{project_id}/artifacts/{artifact_id}/images` endpoint generates one image per storyboard frame whose `image_url` is empty (idempotent).
- **Vertex repo viewer**: `GET /api/v2/{project_id}/vertex/tree` and `/vertex/file?path=` back a new `/vertex` page that renders the connected vertex repo as a tree on the left and rendered markdown on the right. Path traversal is rejected at the API.
- **/artifacts page**: top-level read-and-share gallery of every generated artifact with category filter chips and search.
- **Storyboard frame UI**: `ArtifactCard` now renders storyboard `frames[]` as image cards with a one-click "Generate images" action that fills any frame missing `image_url`.
- **Cmd+K command palette**: global keyboard shortcut (`Cmd/Ctrl+K`) opens a quick-jump palette covering all top-level routes; conditionally surfaces Vertex when the project has a `repo_path`.
- **Sidebar**: top-level Artifacts entry on every project; conditional Vertex Repo entry when a repo is connected.

### Changed

- API title now `CORE Framework API` (was `CORE Discovery Framework API`); FastAPI version reports `2.0.0`.
- `backend-discovery-api` package description updated; legacy "Discovery" naming retained at the route level for backwards compatibility.

### Notes

- No data migration required; v1.x artifacts and projects continue to work unchanged.
- Discovery routes (`/api/discovery`) remain mounted; full removal is deferred to a future major.

## [1.9.3] - 2026-04-22

CI: drop dependency caches that depend on the degraded Azure-hosted GitHub Actions cache, and add a 15-minute timeout to the test job so future infra hangs fail fast.

### Changed

- `.github/workflows/release.yml`: removed `cache: pip` from `actions/setup-python` and `cache: pnpm` from `actions/setup-node`; added `timeout-minutes: 15` to the test matrix.

## [1.9.2] - 2026-04-22

Republish of 1.9.1 release after a GitHub Actions cache outage hung the original release run. No source changes beyond version metadata.

## [1.9.1] - 2026-04-22

Project-first information architecture; legacy CORE phase pages removed.

### Changed

- Sidebar restructured around active project: project switcher in header, four phase groups (Capture / Orient / Refine / Execute) each containing the relevant tools.
- Header simplified to active project name plus active discovery phase badge.
- Discovery store now wraps the project store; the discoveries list and active discovery are auto-scoped to the active project (active discovery persisted per-project in localStorage, falling back to the most recently updated discovery).
- Root layout nests `DiscoveryProvider` inside `ProjectProvider`; document title `CORE Discovery` shortened to `CORE`.
- Dashboard rebuilt as a project-first overview (hero card, four phase entry-point cards, scoped discoveries grid, new-project dialog).

### Added

- `src/app/connectors/page.tsx` (project-scoped Connectors entry under Capture).
- `src/components/dashboard/new-project-dialog.tsx` (extracted form for project creation).

### Removed

- `src/app/{capture,orient,refine,execute,discoveries}/` route trees.
- `src/components/{capture,orient,refine,execute}/` legacy phase widgets.
- `src/components/layout/phase-shell.tsx` and `src/components/layout/phase-evidence-panel.tsx`.

### Notes

- Backend Discovery routers, agents, and models are unchanged in this release.
- No API or schema changes; SemVer patch bump.

## [1.9.0] - 2026-04-22

Enterprise source connectors: GitHub, Web URLs, and generic HTTP JSON.

### Added

- **GitHub source adapter** (`backend/app/synthesis/sources/github.py`):
  walks one or more repositories via the GitHub REST API, decodes
  markdown blobs, and emits `SourceDoc`s. Optional PAT for private
  repos.
- **Web source adapter** (`backend/app/synthesis/sources/web.py`):
  fetches a small list of URLs and strips HTML to plain text using only
  the stdlib (`html.parser`); plain-text/markdown responses pass
  through unchanged.
- **HTTP JSON source adapter**
  (`backend/app/synthesis/sources/http_json.py`): generic JSON endpoint
  reader for Jira/ADO/Confluence-style APIs. Maps records to docs via
  simple dot-paths (`items_path`, `id_field`, `title_field`,
  `text_field`).
- **Connector marketplace** (`backend/app/synthesis/connectors.py`):
  static registry with JSON-schema for every shipped adapter, exposed
  at `GET /api/synthesis/connectors`. Per-project config can now be
  set via `PUT /api/synthesis/{project_id}/connectors`.
- **ConnectorsPanel** in the synthesis aside: lists configurable
  connectors, lets the user paste/edit per-project JSON config, save,
  or clear.
- `SourceKind.GITHUB`, `SourceKind.WEB`, `SourceKind.HTTP_JSON` enum
  values.
- 9 new backend tests (`tests/test_connectors.py`) using
  `httpx.MockTransport` — no live network.

### Changed

- `corpus.get_adapters()` now returns six adapters; new ones are safe
  no-ops when the project has no matching `metadata.sources.<kind>`
  block.
- Backend `1.8.0` → `1.9.0`; frontend `1.8.0` → `1.9.0`; FastAPI app
  version `1.8.0` → `1.9.0`.

## [1.8.0] - 2026-04-22

Operational close: weekly emails, wrap-ups, DT Compass, and auto-rebuild
on source refresh. Builds on v1.7.0 detectors; no breaking changes.

### Added

- **OPERATIONAL category** in `synthesis/categories.py` for engagement-running
  artifacts (status updates, wrap-ups, weekly emails). Compass renders it
  alongside the five DT categories plus Story.
- **Three operational artifact types** in `synthesis/types.py`:
  - `status-update` — weekly status (shipped / blocked / next / risks)
  - `weekly-email-update` — send-ready customer email scoped to the past
    7 days only; `subject + greeting + body + signoff` body schema
  - `wrap-up` (critical) — engagement closing artifact with outcomes,
    decisions, open items, learnings, handoff
- **DT Compass** (`backend/app/synthesis/compass.py`):
  - Per-category health snapshot (`green` / `amber` / `red`) computed
    from artifacts + detector signals. Pure function, no persistence.
  - Health rule: red if any blocker_signals or critical_missing; amber
    if any warn_signals or draft > present; green otherwise.
  - `GET /api/synthesis/{project_id}/compass` returns per-category
    counts plus overall health.
- **Auto-rebuild** on source refresh:
  - `POST /api/synthesis/{project_id}/sources/refresh` rebuilds the
    corpus and, when `metadata.auto_rebuild` is true, regenerates
    artifacts tied to `stale-vs-corpus` or `broken-citation` signals
    only. Low-grounding and contradiction signals are intentionally
    skipped — those need human input.
  - `PUT /api/synthesis/{project_id}/settings/operational` toggles the
    flag from the UI.
- **CompassPanel** at the top of the synthesis aside: per-category dots
  with severity tone, overall badge, refresh-sources button, and
  auto-rebuild checkbox.
- **EmailActions** on `weekly-email-update` artifact cards: "Open in
  mail" (mailto: link) and "Copy" (clipboard) buttons.
- **9 new tests** in `tests/test_compass.py` for compass health, overall
  rollup, and `types_to_auto_regenerate` selection. Backend total: 115.

### Changed

- Backend `1.7.0` → `1.8.0`; frontend `1.7.0` → `1.8.0`; FastAPI app
  version updated.
- `SynthesisCategoryId` adds `"operational"`.
- `api-synthesis.ts` adds `compass()`, `refreshSources()`,
  `updateOperationalSettings()` plus `SynthesisCompass`,
  `CompassCategoryHealth`, `CompassHealth`, `SynthesisRefreshResponse`
  types.

## [1.7.0] - 2026-04-22

Detector pass: cheap, deterministic rules that surface what to fix next.
Builds on v1.6.0; no breaking changes.

### Added

- **Detector subsystem** (`backend/app/synthesis/detectors.py`) — six
  pure-function rules computed on demand from
  `(artifacts, critiques, corpus)`:
  - `missing-critical` — a `critical=True` artifact type has no artifact
  - `low-grounding` — critic score < 0.5 or any blocker issue
  - `broken-citation` — citations reference source ids absent from corpus
  - `contradiction` — critic flagged dimension `contradiction`
  - `thin-coverage` — required body schema fields are empty/null
  - `stale-vs-corpus` — a cited source was updated after the artifact
- **Signal model** with deterministic id (sha1[:16]), severity reused
  from `IssueSeverity` (info/warn/blocker), action hint
  (`regenerate` for now). No persistence — signals recompute every
  request.
- **API**: `GET /api/synthesis/{project_id}/signals` returns `counts`
  (per-severity) plus the sorted signal list (blocker > warn > info).
- **Tests**: 15 new unit tests in `tests/test_detectors.py` pinning
  each rule's contract. Brings backend test count to 106.
- **Frontend**: `components/synthesis/signals-panel.tsx` — top of the
  Synthesis aside; per-severity badges in header; per-signal
  "Regenerate" action wires straight into the existing
  `regenerate(typeId)` handler. Auto-refreshes when artifacts change.
- `lib/api-synthesis.ts` adds `signals()` plus `SynthesisSignal`,
  `SynthesisSignalsResponse`, `SynthesisSignalSeverity` types.

### Changed

- Backend `1.6.0` → `1.7.0`; frontend `1.6.0` → `1.7.0`; FastAPI app
  version updated.

## [1.6.0] - 2026-04-22

Chat over corpus and a UI toggle for vertex bidirectional write-back.
Builds on v1.5.0; no breaking changes.

### Added

- **Chat agent** (`backend/app/synthesis/chat.py`) — `ChatAgent` answers
  user questions strictly from a project's corpus. Citations are
  validated against `corpus.docs[].id` exactly like the generator;
  unknown source ids are dropped before the response is returned. New
  `synthesis_chats` collection persists each turn (partitioned by
  `project_id`); replaying a session is `list({project_id, session_id})`
  ordered by `created_at`.
- **Chat API surface**
  - `POST /api/synthesis/{project_id}/chat` — answer one user message,
    persists user + assistant turn, returns reply + citations +
    follow_up_questions.
  - `GET  /api/synthesis/{project_id}/chat` — list chat sessions for the
    project (id, started_at, last_at, turn count).
  - `GET  /api/synthesis/{project_id}/chat/{session_id}` — return the
    full ordered turn list for a session.
- **Vertex settings endpoint**
  - `PUT /api/synthesis/{project_id}/settings/vertex` — set
    `metadata.vertex.write_enabled` and optional `write_subdir` without
    hand-editing project JSON.
- **Frontend**
  - `components/synthesis/chat-panel.tsx` — chat surface with grounded
    citations + follow-ups, Ctrl/Cmd+Enter send.
  - `components/synthesis/vertex-toggle.tsx` — one-click ON/OFF toggle
    for vertex write-back, persists via the new settings endpoint.
  - Synthesis page mounts the chat panel in the right-hand aside and
    the vertex toggle in the header alongside Push to vertex.
  - `lib/api-synthesis.ts` extended with `chat`, `chatHistory`,
    `chatSessions`, `updateVertexSettings`, and `SynthesisChat*` types.

### Changed

- Storage `KNOWN_COLLECTIONS` + `PARTITIONED_COLLECTIONS` add
  `synthesis_chats`.
- Backend `1.5.0` → `1.6.0`; frontend `1.5.0` → `1.6.0`; FastAPI app
  version updated.

## [1.5.0] - 2026-04-22

Story category, customer-ready Office exports, and bidirectional vertex
write-back. Builds on the v1.4.0 synthesis platform; no breaking changes.

### Added

- **Story category** (`backend/app/synthesis/categories.py`,
  `synthesis/types.py`) — five new artifact types tuned for customer-facing
  narrative: `executive-brief` (SCRA one-pager), `elevator-pitch`,
  `deck-outline` (slide-by-slide story arc), `customer-readout` (long-form
  prose), `press-release` (Amazon-style future PR). Brings the catalog to
  30 types across 6 categories.
- **Office exporters** (`backend/app/synthesis/exporters/`) —
  `export_docx` builds a single readout document grouped by category;
  `export_pptx` prefers a generated `deck-outline` artifact when present,
  otherwise falls back to one slide per artifact. Both use the
  `python-docx` / `python-pptx` deps already in `pyproject.toml`.
- **Vertex bidirectional write-back** (`backend/app/synthesis/writers/`) —
  `VertexWriteBack` pushes generated artifacts back into the connected
  vertex repo as markdown under `<repo>/synthesis/<category>/<type>.md`,
  plus an auto-maintained `_index.md`. Opt-in per project via
  `metadata.vertex.write_enabled` (default `false`); never touches files
  outside its own subfolder so customer-authored vertex content is safe.
- **Synthesis API surface**
  - `GET /api/synthesis/{project_id}/export/docx` — download readout.
  - `GET /api/synthesis/{project_id}/export/pptx` — download deck.
  - `POST /api/synthesis/{project_id}/writeback/vertex` — push artifacts.
  - `POST /api/synthesis/{project_id}/synthesize` now also runs vertex
    write-back as part of a full synthesize cycle and returns the result
    in `writeback.vertex`.
- **Frontend** — Synthesis page header gains `.docx`, `.pptx`, and
  **Push to vertex** buttons (alongside Resynthesize). Typed client adds
  `writebackVertex`, `exportDocxUrl`, `exportPptxUrl` and the new `story`
  category. Disabled-state messaging when no artifacts exist or when
  vertex write-back is not enabled on the project.

### Changed

- `Category` enum extended with `STORY`; `CATEGORY_ORDER`,
  `CATEGORY_LABELS`, `CATEGORY_DESCRIPTIONS` updated in lockstep.
- `synthesize` endpoint return shape includes `writeback` block.
- Backend version `1.4.0` → `1.5.0`; frontend `package.json` `1.4.0` →
  `1.5.0`; FastAPI app version updated.

## [1.4.0] - 2026-04-22

First cut of the project-first synthesis platform described in
`docs/PRD/v1.3-to-v2.0.md`. Discovery routes are unchanged; everything new
lives under `/api/synthesis` and `/synthesis`.

### Added

- **Synthesis subsystem (`backend/app/synthesis/`)**
  - 25 artifact types across 5 categories (Why / Value / What / Scope / How).
    Registry lives in `synthesis/types.py` — adding a type is one entry.
  - Pluggable source adapters: `vertex` (walks the project's vertex repo for
    `vertex.json` + every markdown file), `local_dir` (additional paths from
    `project.metadata.local_dirs` or `localdir:` tags), `ms_graph` (wraps the
    existing `GraphProvider` for files / mail / meetings).
  - `GeneratorEngine` produces drafts with citations validated against the
    corpus; unknown source ids are dropped before persistence.
  - `CriticAgent` scores each artifact 0.0–1.0 across grounding,
    completeness, clarity, and contradiction. Deterministic checks
    (citations exist + valid, required body fields filled, summary present)
    cap the LLM score so a missing citation cannot pass review.
  - `QuestionAgent` ranks customer questions whose answers would unblock
    missing or weak artifacts.
- **Routes (`/api/synthesis`)**
  - `GET  /catalog` — full artifact-type registry, grouped by category.
  - `GET  /{project_id}/artifacts` — artifacts + per-artifact critique.
  - `GET  /{project_id}/sources` — current corpus manifest.
  - `GET  /{project_id}/questions` — open questions, ordered by priority.
  - `GET  /{project_id}/critique` — raw critic results.
  - `POST /{project_id}/synthesize` — generate every critical artifact +
    critique + questions.
  - `POST /{project_id}/artifacts/{type_id}/regenerate` — regenerate one.
  - `POST /{project_id}/questions/refresh` — recompute questions only.
- **Storage:** new partitioned collections `artifacts`, `critiques`,
  `synthesis_questions`, `source_indexes`. Registered in
  `KNOWN_COLLECTIONS` and `PARTITIONED_COLLECTIONS`.
- **Frontend (`/synthesis`)**
  - New page that loads the active project's artifacts grouped by category.
  - `ArtifactCard` shows summary, expandable body / citations / critic
    findings, and a per-artifact regenerate button.
  - `QuestionsPanel` lists ranked customer questions with a refresh action.
  - `SourcesPanel` summarises the corpus.
  - `CritiqueChip` renders score + blocker / warning counts.
  - Synthesis link added to the sidebar.
  - `src/lib/api-synthesis.ts` typed client.

### Notes

- The methodology page (`/methodology`) and the existing 4-phase IA are
  unchanged. Synthesis is additive.
- Microsoft Graph is wired through the existing provider; if
  `graph_provider=none` the adapter yields nothing instead of failing.

## [1.2.5] - 2026-04-21

### Fixed

- **Cosmos:** `get`, `update`, and `delete` now fall back to a cross-partition
  query by `id` when the direct partition-key lookup misses. This unblocks
  customers whose containers were provisioned by older framework versions
  with custom partition-key paths (e.g. `/discoveryId`) — previously every
  delete returned 404 even when the document existed.

## [1.2.4] - 2026-04-21

### Added

- **UI:** Trash icon on each card in the **All Discoveries** page
  (`/discoveries`) with the same confirm prompt used on the Dashboard. Closes
  the gap where the dedicated Discoveries view had no delete affordance.

## [1.2.3] - 2026-04-21

### Added

- **API:** `DELETE /api/transcripts/analysis/{id}` removes a saved transcript
  analysis. Evidence imported from the analysis is left intact (already on
  the Evidence Board) and must be deleted separately via the Evidence API.
- **UI:** Trash icon on each Discovery card on the dashboard with a confirm
  prompt. Active discovery is cleared if it was the one deleted.
- **UI:** Trash icon on each "Previous Analyses" card on the Capture page
  with a confirm prompt.

## [1.2.2] - 2026-04-21

### Fixed

- **Backend image:** Production Docker image was missing the `azure` extras
  (`azure-cosmos`, `azure-identity`, `azure-storage-blob`, `aiohttp`,
  `azure-cognitiveservices-speech`, `PyJWT[crypto]`,
  `azure-monitor-opentelemetry`, OpenTelemetry instrumentations). Any
  deployment configured with `STORAGE_PROVIDER=azure` or
  `LLM_PROVIDER=azure` crashed at first API call with
  `ModuleNotFoundError: No module named 'azure'`. Health endpoint reported
  `providers=azure` because it only inspects config strings, not import
  success. Dockerfile now installs both `.[local]` and `.[azure]` extras so
  the image supports either provider out of the box.

## [1.2.1] - 2026-04-21

### Fixed

- **Frontend:** Project switcher dropdown crashed with Base UI error #31
  (`MenuGroupRootContext is missing`). `DropdownMenuLabel` now wrapped in
  `DropdownMenuGroup` per Base UI contract.
- **Backend:** Named volumes mounted at `/data/storage` were created
  root-owned, blocking writes from non-root `appuser`. Dockerfile now
  pre-creates `/data/{storage,projects,prompts,extensions}` with
  `appuser:appuser` so volumes inherit correct ownership on first mount.

## [1.2.0] - 2026-04-21

Per-project Cosmos partitioning (opt-in) + extension API for per-customer
agents and providers. Builds on the v1.1.0 project model foundation.

### Added

- `settings.cosmos_partition_strategy` — `"id"` (legacy default) or
  `"project_id"` (v1.2+). When set to `project_id`, collections in
  `PARTITIONED_COLLECTIONS` are created with `/project_id` as the Cosmos
  partition key for hard per-project isolation.
- `app.utils.project_context.current_project_id` — request-scoped ContextVar
  populated by middleware reading the `X-Project-Id` header.
- Project-context middleware in `create_app` — propagates the active project
  id into the storage layer transparently (no router changes required).
- `app.providers.storage.partitioning` — single source of truth for partition
  key path/value selection per collection.
- Storage providers (Cosmos + local) now auto-stamp `project_id` on writes to
  partitioned collections and auto-scope `list()` results to the active
  project. Reads/updates/deletes use `project_id` as the partition key value.
- `project_id` field on `Discovery`, `Evidence`, `QuestionSet`,
  `TranscriptAnalysis`, `ProblemStatementVersion`, `UseCaseVersion`,
  `SolutionBlueprint`, and `Review` models so the field round-trips cleanly.
- `app.extensions.load_extensions` — startup loader that discovers `*.py`
  plugins in `settings.extensions_dir` and calls each module's
  `register(app, settings)`.
- Example extension at `examples/extensions/hello_extension.py` plus a
  README explaining the contract.
- `settings.extensions_dir` (default `./extensions`) — mount point for
  per-customer plugins.
- 11 new tests: `test_partitioning.py`, `test_project_context.py`,
  `test_extensions.py` (90 backend tests total).

### Changed

- API + package version bumped to `1.2.0`.
- `PARTITIONED_COLLECTIONS` registry exposed from `app.providers.storage`.
- Cosmos provider raises a clear `ValueError` when a write to a project-
  partitioned collection is attempted without an active `X-Project-Id` —
  fail-fast instead of silent cross-tenant leakage.

### Migration notes

- **Existing Cosmos deployments are unaffected** — the strategy default
  remains `"id"`. To opt in, set `COSMOS_PARTITION_STRATEGY=project_id` in a
  fresh Cosmos account (or fresh database) and let `ensure_collections`
  create the partitioned containers.
- **Cosmos partition keys are immutable.** Switching strategy on an existing
  account requires recreating the affected containers and re-uploading data.
  No automated migration is shipped in v1.2.
- The `engagements` and `audit` collections are intentionally never
  partitioned by `project_id` — engagements *are* the projects, and audit is
  a cross-project log.

## [1.1.0] - 2026-04-21

First-class **Project model** — the foundation for multi-project, per-customer
deploys (one `core-*` repo per customer, many projects per repo).

### Added

- `Engagement.slug` — URL- and filesystem-safe identifier auto-derived from
  `name` on create. Capped at 64 chars, deduplicated with `-2`, `-3`, …
  suffixes when collisions occur.
- `GET /api/engagements/by-slug/{slug}` — lookup by stable identifier.
- `/api/projects/*` — first-class alias for `/api/engagements/*`. New clients
  should prefer the projects vocabulary; the engagements path remains for
  backward compatibility.
- `settings.projects_root` (default `./data/projects`) — mount convention.
  Customer deploys mount their `./projects` folder here so engagements can
  reference subdirectories by name (`repo_path: "allstate-claims"`) instead
  of leaking host paths.
- `app.utils.project_paths.resolve_project_repo_path` — central resolver used
  by every `/api/engagement/*` endpoint that takes a `repo_path`. Absolute
  paths pass through; relative paths join under `projects_root`.
- Frontend `ProjectProvider` + `useProject` hook + sidebar `ProjectSwitcher`.
  Active project is persisted in `localStorage` and re-hydrated on reload.
- `X-Project-Id` request header sent automatically by the frontend HTTP
  client. Foundation for v1.2 partition-key scoping.
- `app.utils.slug.slugify` utility + tests.
- Backend tests: `test_projects.py`, `test_project_paths.py`, `test_slug.py`
  (12 new tests, total 79 passing).

### Changed

- API version bumped to `1.1.0`; package version bumped to `1.1.0`.
- `Engagement` model docstring rewritten to reflect the project-first vocabulary.
- `Project` type alias exported from `@/types/fde` for new code paths.

### Migration notes

- Existing engagements without a `slug` will keep working (the field defaults
  to empty). Run a one-time backfill by `PATCH`ing each with `{"slug": ""}` —
  the router will derive one from the name.
- The legacy `/api/engagements/*` paths and shape are unchanged. No frontend
  consumers need to migrate; the `/api/projects/*` alias is purely additive.

## [1.0.2] - 2026-04-21

Second 5-pass review after v1.0.1 — focused on file-size discipline,
security hardening, and operational reproducibility.

### Added

- `SECURITY.md` documenting the threat model, controls in place, known
  authorization limitations, and out-of-scope items.
- WebSocket per-room connection cap (50) and per-message size cap (64 KiB)
  to prevent resource exhaustion.
- Startup guard that refuses `CORS_ORIGINS=["*"]` when credentials are
  enabled (CORS spec violation and credential exposure risk).
- HEALTHCHECK directives in both backend and frontend Dockerfiles for
  orchestrator-driven liveness probes.
- `--proxy-headers --forwarded-allow-ips=*` on the backend uvicorn
  command so client IPs reflect the real client behind a reverse proxy
  (per-user rate limiting depends on this).

### Changed

- Backend startup migrated from deprecated `@app.on_event("startup")` to
  the FastAPI `lifespan` context manager — removes deprecation warnings
  in test output.
- Frontend Dockerfile pins `pnpm` to `10.13.1` (matches the lockfile)
  instead of floating to `latest` for reproducible builds.
- `src/app/capture/page.tsx` refactored from 358 lines down to 212 lines
  by extracting `QuestionList`, `TranscriptAnalysisResult`,
  `PreviousAnalysesList`, and `ConfidenceBadge` into
  `src/components/capture/`.
- `CONTRIBUTING.md` documents the <300-line file rule and the single
  exemption (`src/components/ui/sidebar.tsx`, vendored from shadcn/ui).

### Removed

- Stale unused `src/components/capture/transcript-results.tsx`.

## [1.0.1] - 2026-04-21

Follow-up audit pass after v1.0.0 — 5 review passes (correctness, security, architecture, ops, docs) flagged consistency cleanups.

### Changed

- `routers/reviews.py` and `utils/review_gate.py` now use `stamp_create` and `user_label` for actor / timestamp stamping (was hand-rolled in two places, drifting from the rest of the codebase)
- `routers/engagements.py` `update`, `delete`, `attach_discovery`, and `detach_discovery` now write meaningful audit entries (full `after` snapshot on update, captured `before` on delete, and dedicated `attach_discovery` / `detach_discovery` actions)
- Backend, frontend, and FastAPI versions bumped to `1.0.1`

## [1.0.0] - 2026-04-21

First stable release. Consolidates the v0.1–v0.9 work into a documented, audited, observable, multi-engagement discovery platform with human-in-the-loop review gates, Microsoft 365 read-only surfaces, optional Azure Monitor telemetry, and an OpenAPI-typed frontend.

### Added

- README refresh covering engagements, reviews, audit log, telemetry, typed API client, Storybook scaffold, M365 surfaces, and the bearer-token WebSocket
- Release / license / Python / Next.js badges at the top of the README
- Documented `pnpm gen:api`, opt-in Storybook workflow, and `/api/audit` filter examples

### Changed

- API endpoint table updated to include engagements, reviews, audit, agents run, M365, grounding, and the `?token=` WS auth
- Tech stack table now lists HITL review gates, OpenAPI client tooling, Storybook scaffold, and observability
- Backend, frontend, and FastAPI versions bumped to `1.0.0`

## [0.9.0] - 2026-04-21

### Added

- Backend tests for the new HITL + scoping surfaces: `test_engagements.py`, `test_reviews.py`, `test_audit.py`, `test_review_gate.py`
- Storybook scaffold (`.storybook/main.ts`, `.storybook/preview.ts`) plus opt-in `pnpm storybook` and `pnpm build-storybook` scripts
- Initial stories for `Button`, `Badge`, and `Card` shadcn primitives

### Changed

- `StorageProvider.list` annotation updated under `from __future__ import annotations` so the abstract base loads cleanly when imported in isolation
- Backend, frontend, and FastAPI versions bumped to `0.9.0`
- `tsconfig.json` excludes `**/*.stories.tsx` and `.storybook` so Storybook deps stay opt-in

## [0.8.0] - 2026-04-21

### Added

- Append-only audit log: new `audit` collection plus `utils/audit_log.py` helper that records actor, action, before/after hashes, and a short summary
- `/api/audit` read endpoint with filters for `collection`, `item_id`, and `actor`
- BaseAgent `_save` now records an `agent_run` audit event for every produced artifact
- Engagement create/update/delete and review decision routes record audit events
- Optional OpenTelemetry / Application Insights wiring via `utils/telemetry.py` — auto-enabled when `APPLICATIONINSIGHTS_CONNECTION_STRING` or `OTEL_EXPORTER_OTLP_ENDPOINT` is set; instruments FastAPI and httpx; `agent.run` produces a span with `agent.id` and `discovery.id` attributes
- New `azure` extras: `azure-monitor-opentelemetry`, `opentelemetry-instrumentation-fastapi`, `opentelemetry-instrumentation-httpx`
- `pnpm gen:api` script and `scripts/gen-api-types.mjs` that dump the FastAPI OpenAPI schema and run `openapi-typescript` to produce `src/types/api.ts`

### Changed

- Backend FastAPI version and frontend sidebar badge bumped to `0.8.0`

## [0.7.0] - 2026-04-21

### Added

- Human-in-the-loop review gates: `BaseAgent` opens a pending `Review` for every artifact when `requires_review = True`; flagged on problem analyst, use case analyst, solution architect, company researcher, empathy researcher, and HMW framer
- Review gates also wired into the non-agent POST routes for problem statements, use cases, and solution blueprints
- `engagement_id` filter on `GET /api/discovery/`, `GET /api/evidence/`, and `GET /api/reviews/` so teams can scope a workspace to one engagement
- Engagement export now writes company profiles, empathy maps, and HMW boards in addition to problem statements, use cases, and blueprints
- Engagement export skips artifacts whose latest review status is `pending`, `changes_requested`, or `rejected`, and reports them under `skipped`
- Engagements page lists attached discoveries inline with attach/detach controls

### Changed

- `routers/engagement.py` slimmed by extracting markdown renderers to `utils/engagement_export.py`
- Backend FastAPI version and frontend sidebar badge bumped to `0.7.0`

## [0.6.0] - 2026-04-21

### Added

- WebSocket auth gate: `/ws/{discovery_id}` now validates a `?token=` bearer via the configured auth provider and closes with policy violation when the token is missing or invalid
- SPA token refresh: HTTP requests that 401 once attempt a forced silent MSAL token refresh and retry; a hard failure triggers `loginRedirect`
- Per-user rate limiting: `slowapi` keys by Entra `sub` when authenticated, falling back to remote address otherwise
- Audit attribution: `created_by` / `updated_by` fields on `Discovery`, `Engagement`, `Evidence`, and `Review`; backend stamps them automatically from the active user's claims via a `ContextVar`-backed helper
- `BaseAgent._save` now stamps audit fields, so all agent-produced artifacts capture the invoking user
- `LocalStorageProvider.ensure_collections` now pre-creates each collection directory so `KNOWN_COLLECTIONS` works under both Cosmos and local providers
- Microsoft Graph and Dataverse providers fall back to `DefaultAzureCredential` when no `AZURE_CLIENT_SECRET` is set, enabling Managed Identity / Workload Identity in production
- `COSMOS_ENSURE_COLLECTIONS` setting (default `false`) gates container provisioning on startup so production restarts don't pay the round-trip every boot

### Changed

- `.env.example` documents the production secret-management path (Managed Identity + Key Vault) and the new ensure-collections flag
- Backend FastAPI version and frontend sidebar badge bumped to `0.6.0`

## [0.5.0] - 2026-04-21

### Added

- Microsoft Graph provider abstraction with `none` and `msgraph` (app-only client credentials) implementations covering files, messages, and meetings
- `/api/graph/{status,files,messages,meetings}` read-only routes powered by Graph search and calendarView
- Dynamics 365 / Dataverse provider abstraction with `none` and `dataverse` implementations for account search and lookup
- `/api/dynamics/{status,accounts,accounts/{id}}` read-only routes
- Grounded answer endpoint at `/api/grounding/answer` that combines the configured search provider with the LLM and returns inline `[source:N]` citations
- `AZURE_CLIENT_SECRET`, `GRAPH_PROVIDER`, `DYNAMICS_PROVIDER`, and `DYNAMICS_URL` configuration and validation warnings
- Frontend Microsoft 365 page with tabs for Files, Messages, Meetings, and Accounts plus a Grounded Answers page
- New "M365" sidebar group and `lib/api-m365.ts` typed client
- Health endpoint now reports `search`, `graph`, and `dynamics` provider selection

### Changed

- Backend FastAPI version and frontend sidebar badge bumped to `0.5.0`

## [0.4.0] - 2026-04-21

### Added

- `Engagement` entity and `/api/engagements` CRUD with attach/detach helpers for grouping discoveries under a customer engagement
- `EngagementStatus` lifecycle: proposed, active, paused, completed, cancelled
- `Review` entity and `/api/reviews` for human-in-the-loop approval gates on any artifact (collection + item id), with pending, approved, rejected, and changes requested states
- Company Researcher agent that combines the configured search provider with the LLM to produce a structured company profile (priorities, products, competitive landscape, news, sources, open questions)
- Frontend Engagements, Company Research, and Reviews pages plus an "FDE" sidebar group
- Shared `lib/http.ts` helper exposing `request`, `authHeader`, and `API_URL`, and a focused `lib/api-fde.ts` for the new endpoints
- `KNOWN_COLLECTIONS` extended with `engagements`, `company_profiles`, and `reviews` so Cosmos auto-provisioning covers them on startup

### Changed

- Generic agent run endpoint now forwards arbitrary extra fields (e.g. `company`) to the agent so specialised agents can accept structured input
- Backend FastAPI version and frontend sidebar badge bumped to `0.4.0`

## [0.3.0] - 2026-04-21

### Added

- `/api/me` identity endpoint that returns the active principal in both local and Entra modes
- Frontend MSAL Browser integration with redirect login, sign-in/out button in the header, and automatic `Authorization: Bearer` token injection on every API call
- `NEXT_PUBLIC_AUTH_ENABLED`, `NEXT_PUBLIC_AZURE_TENANT_ID`, and `NEXT_PUBLIC_AZURE_CLIENT_ID` environment toggles for the SPA
- Cosmos DB storage provider now auto-creates the database and all known containers on startup (idempotent), and exposes `ensure_collections()` on the `StorageProvider` base
- `KNOWN_COLLECTIONS` registry covering all 11 entities (discoveries, evidence, question sets, transcript analyses, problem statements, use cases, solution blueprints, empathy maps, HMW boards, ideation sessions, assumption maps)
- `docs/auth.md` covering Entra app-registration setup, scopes, and storage activation

### Changed

- Backend FastAPI version and frontend sidebar badge bumped to `0.3.0`

## [0.2.0] - 2026-04-21

### Added

- Web search provider abstraction with `none`, `duckduckgo`, and `bing` implementations and `POST /api/search`
- File upload ingest endpoint that converts PDF, DOCX, PPTX, XLSX, MD, and TXT into markdown and routes through the existing classification flow
- Auto-generated `references.md` index regenerated on every engagement write, with `POST /api/engagement/references/rebuild` for manual refresh
- Discovery Narrator: `POST /api/narrative/generate` synthesizes discovery context into a shareable story tunable by audience and style
- Generic agent registry exposed at `GET /api/agents`, `POST /api/agents/{id}/run`, and `GET /api/agents/{id}/outputs/{discovery_id}`
- Four design-thinking sub-agents: Empathy Researcher, HMW Framer, Ideation Facilitator, and Assumption Tester
- `EvidenceType` taxonomy aligned to design thinking: observation, quote, pain point, jobs-to-be-done, assumption, hypothesis, insight, general
- Five design-thinking artifact templates (empathy map, persona, journey map, HMW board, assumption matrix) plus `/api/dt-templates` to list, fetch, and drop them into an engagement repo
- `docs/design-thinking.md` mapping CORE phases to design-thinking stages and methods
- In-app Methodology page and per-phase Design Thinking guidance panel
- Frontend Narrative, Web Search, and Methodology pages plus sidebar entries
- Shared `dt-methods.ts` catalog reused by the methodology page and the per-phase panel

### Changed

- Existing agent prompts (Discovery Coach, Problem Analyst, Use Case Analyst, Solution Architect, Transcript Analyst) reference design-thinking methods and stages explicitly
- Transcript Analyst output schema now includes `evidence_type` per evidence item
- Backend FastAPI `version` and frontend sidebar badge bumped to `0.2.0`

## [0.1.1] - 2026-04-21

### Added

- `LICENSE` file (MIT) so the `org.opencontainers.image.licenses=MIT` label is accurate
- Multi-architecture container images: `linux/amd64` and `linux/arm64`
- Cosign keyless image signing via OIDC
- Build provenance attestations (SLSA) pushed to the registry
- Trivy CVE scanning of published images with results uploaded to the Security tab
- Release pipeline now re-runs the test suite on the tagged commit before publishing
- CI workflow triggers on `v*` tags as well as branches and PRs

### Changed

- All GitHub Actions are pinned to commit SHAs (supply-chain hardening)
- `latest` tag is now only applied to non-prerelease versions (semver-aware)
- Release tag pattern accepts `v*` (including prereleases like `v0.2.0-rc1`), not just `v*.*.*`

## [0.1.0] - 2026-04-21

Baseline release. First tagged version of CORE Discovery, establishing the foundation
for the package distribution model. Future releases publish container images to GHCR
on every tag.

### Added

- Four-phase discovery flow (Capture, Orient, Refine, Execute) with AI-assisted question generation
- Engagement context system with markdown ingestion, search, type filters, and AI-powered classification
- Provider abstractions for LLM (Ollama, Azure OpenAI, OpenAI), storage (local JSON, Cosmos DB), auth (none, Entra ID), blob storage, and speech
- Real-time collaboration via WebSocket presence tracking
- Transcript analysis with audio upload support
- Evidence board, problem statements, use cases, and solution blueprints
- Docker compose setup for local development and production deployment
- GitHub Actions release pipeline that publishes images to GitHub Container Registry

[Unreleased]: https://github.com/zitro/core-framework/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/zitro/core-framework/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/zitro/core-framework/releases/tag/v0.1.0
