# Changelog

All notable changes to CORE Discovery are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
