---
title: CORE Discovery Framework TRD
description: Technical requirements document covering architecture decisions, provider abstractions, security model, and implementation standards for the CORE Discovery Framework
author: Bryan Ortiz
ms.date: 2026-04-08
ms.topic: reference
keywords:
  - core framework
  - technical requirements
  - architecture
  - provider abstraction
  - fastapi
  - nextjs
estimated_reading_time: 12
---

## Purpose

This document captures the technical requirements, architecture decisions, and implementation standards for the CORE Discovery Framework. It serves as the developer reference for understanding why each technical choice was made and how the pieces fit together.

For business context, objectives, and stakeholder information, see the [BRD](../BRD/core-discovery-brd.md).

## Architecture overview

CORE uses a two-tier architecture with a clear separation of concerns:

* Frontend: Next.js application handling UI, routing, and client-side state
* Backend: FastAPI application handling business logic, LLM orchestration, and data persistence

These two tiers communicate via REST API and are independently deployable.

### Why two tiers instead of one

A single Next.js app with API routes was considered. We chose a separate Python backend because:

1. The LLM ecosystem has stronger Python libraries and tooling (langchain, transformers, Ollama SDK)
2. Transcript analysis and prompt engineering iterate faster in Python
3. Separate deployment means a team can replace the frontend without touching the backend
4. Python typing with Pydantic gives us runtime validation that TypeScript API routes would not

### Why not a microservices architecture

CORE is a small, focused tool. Microservices add network complexity, deployment overhead, and debugging difficulty that are not justified at this scale. If the system grows to need independent scaling of transcript analysis vs. question generation, we extract services then.

## Technology choices

### Frontend

| Technology | Version | Why |
|---|---|---|
| Next.js | 16.x | App Router provides file-based routing and React Server Components for future optimization |
| React | 19.x | Concurrent features and improved hooks performance |
| TypeScript | 5.x | Compile-time type safety prevents the class of bugs that runtime-only JavaScript allows |
| Tailwind CSS | v4 | Utility-first CSS avoids specificity wars; v4 brings CSS-native configuration |
| shadcn/ui | base-nova | Unstyled, accessible primitives with base-ui underneath; no vendor lock-in |
| pnpm | 10.x | Strict, fast package manager with workspace support |

### Backend

| Technology | Version | Why |
|---|---|---|
| Python | 3.11+ | Required for StrEnum, modern typing, and performance improvements |
| FastAPI | 0.135.x | Automatic OpenAPI docs, Pydantic-native request validation, async support |
| Pydantic | 2.x | Runtime data validation at API boundaries; catches malformed LLM output before it reaches storage |
| uvicorn | 0.44.x | ASGI server with hot reload for development, production-grade performance |
| ruff | 0.15.x | Single tool for linting and formatting; replaces flake8, black, isort |

### Infrastructure

| Technology | Why |
|---|---|
| Docker | Reproducible builds; eliminates "works on my machine" |
| Docker Compose | Single-command orchestration for both services |
| Ollama | Local LLM inference with no API keys, no external network calls |

## Provider abstraction pattern

The provider pattern is the most important architectural decision in the codebase. It serves BO-05 (reusable multi-tenant architecture) and BO-06 (incremental system access expansion).

### How it works

Each external dependency (LLM, storage, future: auth, speech) defines an abstract base class with a fixed interface. Concrete implementations inherit from it. A factory function reads configuration and returns the appropriate concrete provider.

```
providers/
  llm/
    __init__.py        # Factory: get_llm_provider() -> LLMProvider
    base.py            # Abstract: LLMProvider(ABC)
    azure_openai.py    # Concrete: AzureOpenAIProvider
    openai_provider.py # Concrete: OpenAIProvider
    ollama.py          # Concrete: OllamaProvider
  storage/
    __init__.py        # Factory: get_storage_provider() -> StorageProvider
    base.py            # Abstract: StorageProvider(ABC)
    local.py           # Concrete: LocalStorageProvider
```

### Why this pattern

* Routers call the abstract interface. They never import a concrete provider. This means switching from Ollama to Azure OpenAI is a `.env` change, not a code change.
* New providers (Anthropic, Mistral, Azure Cosmos) implement the interface and register in the factory. No router code changes.
* The factory uses `@lru_cache(maxsize=1)` to guarantee a single provider instance per process. This avoids creating new HTTP clients per request.

### Why not dependency injection

FastAPI supports `Depends()` for dependency injection. We use factory functions instead because:

1. `@lru_cache` on the factory gives us singleton semantics without a DI container
2. The provider choice is static for the lifetime of the process (configuration does not change at runtime)
3. Factories are simpler to test: mock the factory return, not a DI framework

### Adding a new provider

To add a new LLM provider (example: Anthropic):

1. Create `providers/llm/anthropic.py` implementing `LLMProvider`
2. Add `"anthropic"` case to the factory in `providers/llm/__init__.py`
3. Add any required config fields to `config.py`
4. Set `LLM_PROVIDER=anthropic` in `.env`

No router changes. No frontend changes.

## Data model

### Why Pydantic models over raw dicts

Every data structure in the system is a Pydantic `BaseModel`. This is not just type annotation; it is runtime enforcement.

* API endpoints receive typed models, not `dict`. Pydantic rejects malformed input before business logic runs.
* LLM output is parsed into typed models. If the LLM returns unexpected JSON structure, we catch it at the parse boundary, not in the frontend.
* Typed models generate accurate OpenAPI schemas so the API is self-documenting.

### Core models

| Model | Purpose | Why it exists separately |
|---|---|---|
| `DiscoverySession` | Tracks a complete discovery engagement | The unit of work; everything else hangs off a session |
| `QuestionSet` | Collection of generated questions for a phase | Questions are ephemeral outputs, not persistent state; separate from session |
| `TranscriptAnalysis` | Structured output from transcript processing | Analysis results have their own lifecycle (regeneration, comparison) |
| `EvidenceItem` | Single piece of linked evidence | Atomic evidence items allow cross-referencing across sessions |
| `Question` | Individual question with purpose and follow-ups | Typed structure prevents silent field mismatches between LLM output and frontend |
| `TranscriptInsight` | Single insight with confidence and phase | Extracted independently so each can be scored and categorized |

### Why typed update models

PATCH endpoints use `DiscoveryUpdate` and `EvidenceUpdate` instead of accepting arbitrary `dict`:

* Prevents mass assignment: callers cannot overwrite `id`, `created_at`, or other system-managed fields
* Self-documenting: the OpenAPI schema shows exactly which fields are updatable
* Validation: Pydantic enforces field types even on partial updates

### Timestamps

All timestamps use `datetime.now(UTC)` (timezone-aware UTC). `datetime.utcnow()` was deprecated in Python 3.12 because it returns naive datetimes that cause comparison bugs when mixed with timezone-aware values.

## API design

### Route structure

```
/api/health              GET     Health check
/api/discovery           GET     List all sessions
/api/discovery           POST    Create session         (201)
/api/discovery/{id}      GET     Get single session
/api/discovery/{id}      PATCH   Update session
/api/questions/generate  POST    Generate questions
/api/transcripts/analyze POST    Analyze transcript
/api/evidence            GET     List by session
/api/evidence            POST    Create evidence        (201)
/api/evidence/{id}       GET     Get single evidence
/api/evidence/{id}       PATCH   Update evidence
```

### Why RESTful over RPC-style

The discovery domain maps naturally to resources (sessions, evidence, questions). RESTful routes give predictable behavior: GET reads, POST creates, PATCH updates. This reduces cognitive load for any developer consuming the API.

The two RPC-style routes (`/generate`, `/analyze`) are intentional exceptions. Question generation and transcript analysis are command operations, not CRUD on a resource. Making them POST to a verb route is clearer than forcing them into a resource model.

### Why status codes matter

* `201 Created` on POST: tells the client the resource was persisted, not just accepted
* `404 Not Found` on missing resources: distinguishes "not found" from "server error"
* `422 Unprocessable Entity` (Pydantic default): input was syntactically valid JSON but semantically wrong
* `502 Bad Gateway` on LLM failures: the backend is a proxy to the LLM; gateway error is semantically correct

## Security model

### Current state (local development)

Auth is not implemented. The system is designed for single-user, local-network operation in its current release.

### Input validation

All input is validated at the API boundary:

* Pydantic models reject unknown fields, wrong types, and constraint violations
* Transcript text has a `max_length=50000` limit to prevent memory exhaustion
* Question count is bounded with `Field(ge=1, le=20)`
* Storage provider validates collection names and item IDs against `^[a-zA-Z0-9_-]+$` to prevent path traversal
* File paths are resolved with `.resolve()` and validated to stay within the data directory

### Why path traversal protection

The local storage provider constructs file paths from user-provided collection and ID values. Without validation, a request like `GET /api/discovery/../../etc/passwd` would read arbitrary files. The regex allowlist (`^[a-zA-Z0-9_-]+$`) ensures only safe characters reach the filesystem.

### CORS

CORS is configured via `CORS_ORIGINS` environment variable (default: `http://localhost:3000`). In production, this must be restricted to the actual frontend origin.

## Error handling strategy

### Why structured error handling

Unhandled exceptions in web frameworks return generic 500 responses that leak implementation details (stack traces, file paths). Every external call (LLM, storage) is wrapped in try/except that:

1. Logs the full exception with `logger.exception()` for debugging
2. Returns a structured HTTP error to the client
3. Uses appropriate status codes (502 for upstream failures, 404 for missing data)

### LLM error handling

LLM calls are the most failure-prone path. The error handling pattern is:

```python
try:
    result = await llm.complete_json(prompt, system_prompt)
except Exception:
    logger.exception("LLM call failed for %s", context)
    raise HTTPException(status_code=502, detail="AI service unavailable")
```

Why `502` specifically: the backend acts as a gateway to the LLM. When the upstream service fails, `502 Bad Gateway` communicates this accurately. The frontend can show a meaningful retry message.

## Frontend architecture

### State management

Discovery state lives in a Zustand store (`discovery-store.tsx`). Component-local state handles UI concerns (form values, open/close toggles).

Why Zustand over React Context: Context causes re-renders of every consumer when any value changes. Zustand supports selector-based subscriptions so components only re-render when their slice changes.

### API client

A centralized API client (`lib/api.ts`) handles all backend communication. Components never call `fetch` directly.

Why: Centralizing HTTP calls means error handling, base URL configuration, and response parsing happen in one place. If the API contract changes, fixes happen in one file.

### Component library

shadcn/ui components use the base-nova style with base-ui primitives underneath. These use the `render` prop pattern, not `asChild`.

Why base-ui: Headless primitives with no style opinions. Tailwind handles all styling. This avoids the common problem of fighting a component library's built-in styles.

### Why immutable state updates

React state must never be mutated directly. The `.sort()` method mutates arrays in-place, which bypasses React's change detection. All array transformations use spread-then-transform: `[...array].sort()`.

## Testing strategy (planned)

### Backend

* Unit tests: provider implementations with mocked external services
* Integration tests: router endpoints with in-memory storage
* Contract tests: Pydantic model serialization matches frontend TypeScript types

### Frontend

* Component tests: each phase page renders and handles user interaction
* Store tests: discovery store state transitions
* API client tests: mocked fetch responses

## Docker deployment

### Why multi-stage builds

The frontend Dockerfile uses two stages:

1. Builder stage: installs dependencies and runs `next build`
2. Runtime stage: copies only the build output into a minimal image

Why: The final image contains no `node_modules`, no source code, no dev dependencies. This reduces image size by 80%+ and eliminates supply chain attack surface.

### Why non-root user

Both Dockerfiles run the application as a non-root user. This follows container security best practices: if the application is compromised, the attacker has limited system access.

## Reusability checklist

Every technical decision is evaluated against this checklist:

| Question | If No, Reconsider |
|---|---|
| Can another team use this without modifying source code? | Configuration must drive behavior |
| Can another team swap this component for their preferred alternative? | Interfaces must be abstract |
| Does this create a dependency on a specific vendor? | Provider pattern must be applied |
| Does this assume a specific deployment environment? | Docker must be the deployment unit |
| Does this duplicate logic that exists elsewhere? | Extract and share |

## Conventions and standards

### Backend

* Python 3.11+ with type annotations on all function signatures
* Pydantic BaseModel for all data structures
* ruff for linting and formatting
* Conventional commits for all git messages
* Routers are thin: validation and HTTP concerns only, delegate to providers

### Frontend

* TypeScript strict mode
* Tailwind v4 for all styling (no CSS modules, no styled-components)
* shadcn/ui base-nova components
* Zustand for cross-component state
* Named exports for components, default export for pages
