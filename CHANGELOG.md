# Changelog

All notable changes to CORE Discovery are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
