# Changelog

All notable changes to CORE Discovery are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
