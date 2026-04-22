---
title: CORE Discovery Framework
description: An AI-powered product discovery coaching platform built on the CORE methodology (Capture, Orient, Refine, Execute) with a Next.js frontend, FastAPI backend, pluggable AI agents, audited human-in-the-loop review gates, and bidirectional engagement repo integration.
ms.date: 2026-04-21
---

[![Release](https://img.shields.io/github/v/tag/zitro/core-framework?label=release)](https://github.com/zitro/core-framework/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg)](backend/pyproject.toml)
[![Next.js](https://img.shields.io/badge/next.js-16-black.svg)](package.json)

## Overview

CORE Discovery is a full-stack application that guides product teams through structured discovery
engagements using the CORE methodology. Each phase builds on the previous one, creating a connected
chain of evidence, insights, and decisions.

The four phases work together:

1. Capture: Probe the system, gather evidence, map stakeholders. Generate tailored interview questions
   and analyze meeting transcripts. Extracted evidence flows automatically into the Evidence Board.
2. Orient: Recognize patterns, frame the real problem. Evidence from Capture pre-populates the context.
   Build structured problem statements and use cases that carry forward.
3. Refine: Test assumptions, match solutions to capabilities. The problem statement from Orient loads
   automatically. Generate solution architecture blueprints. Assumptions and solution matches persist
   across sessions.
4. Execute: Deliver quick wins, resolve blockers, prepare handoff. The validated problem statement and
   assumptions from earlier phases display as context.

Beyond the four phases, the platform includes:

- Specialized AI agents (discovery coach, problem analyst, transcript analyst, use case analyst,
  solution architect, company researcher, empathy researcher, HMW framer) that power the analysis
  behind each phase. Most agents open a pending review on every artifact they produce so a human can
  approve before it leaves the workspace.
- An AI advisor that generates use case proposals and solution architecture blueprints from accumulated
  evidence.
- Engagement workspaces that group multiple discoveries under one customer with attach/detach
  controls, scoped review queues, and one-click export of all artifact families to a structured
  markdown repo (skipping anything still pending or rejected in review).
- Microsoft 365 read-only surfaces (Files, Messages, Meetings, Accounts) backed by Microsoft Graph
  and Dataverse providers, plus a Grounded Answers page that combines web search with the LLM and
  returns inline `[source:N]` citations.
- Append-only audit log capturing every create, update, delete, agent run, and review decision —
  who, when, what, plus before/after content hashes — exposed via `/api/audit`.
- Optional OpenTelemetry / Application Insights instrumentation that wraps every agent run in a
  span tagged with `agent.id` and `discovery.id`, auto-enabled when the relevant env var is set.
- Bidirectional engagement repo integration for importing context from and exporting deliverables to
  structured markdown repositories.
- Local documentation scanning that ingests PDF, PPTX, DOCX, XLSX, and text files to feed context
  into the AI agents.
- Real-time WebSocket collaboration with bearer-token auth and SPA token-refresh on 401, so multiple
  users can work on a discovery session simultaneously without losing state on token expiry.
- JSON, CSV, and structured markdown export for sharing discovery outputs externally.

## Deploying for a customer

This repo is the **framework source**. Customer engagements run as separate "instance" repos that pull signed framework images from GHCR rather than forking source. One repo per customer, multiple discovery projects per repo.

```text
┌──────────────────────────┐         ┌──────────────────────────┐
│  zitro/core-framework    │  build  │  ghcr.io/zitro/          │
│  (this repo)             ├────────▶│  core-framework-backend  │
│                          │  push   │  core-framework-frontend │
│  Tagged release v1.2.x   │         │  (signed, SLSA, Trivy)   │
└──────────────────────────┘         └──────────┬───────────────┘
                                                │
                                                │ docker compose pull
                                                ▼
                                     ┌──────────────────────────┐
                                     │  core-<customer> repo    │
                                     │                          │
                                     │  compose.yaml (pinned)   │
                                     │  .env (provider knobs)   │
                                     │  projects/<slug>/        │
                                     │  extensions/*.py         │
                                     │  config/prompts/         │
                                     │  Renovate auto-bumps     │
                                     └──────────────────────────┘
```

### Spinning up a new customer

Two ways. Both produce the same layout.

**Option A — CLI (recommended)**

```bash
npx create-core-discovery-app acme
cd acme
docker compose pull
docker compose up -d
```

The CLI prompts for display name, LLM/storage/auth providers, framework version pin, and an optional initial project slug. It writes a self-contained customer repo with `compose.yaml`, `.env`, `renovate.json`, and the right scaffold directories — no manual editing.

Source: <https://www.npmjs.com/package/create-core-discovery-app> · <packages/create-core-app/>

**Option B — GitHub template**

Click "Use this template" on <https://github.com/zitro/core-discovery-template>, name your repo (e.g. `core-acme`), then clone and search-and-replace the `Your Customer` / `your-customer` placeholders.

The template repo is regenerated from the CLI to stay in sync, so both paths converge.

### What lives in a customer repo (and what doesn't)

| Lives in customer repo | Lives in framework (this repo) |
|---|---|
| `compose.yaml` pinned to image tags | Backend (`backend/`) and frontend (`src/`) source |
| `.env` with provider credentials | All AI agents, providers, models |
| `projects/<slug>/` markdown content | OpenAPI schema, types, UI components |
| `extensions/*.py` per-customer plugins | Container build, release pipeline |
| `config/prompts/` overrides | Default prompts |
| `infra/` (IaC for cloud deploy) | — |

This split means customer repos stay tiny (~20 files) and framework upgrades are a single Renovate PR bumping image tags.

### Adding a project to a customer

Drop content into `projects/<slug>/`, then register it with the running backend:

```powershell
$body = @{ name = "My Project"; slug = "my-project"; repo_path = "my-project" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:8000/api/projects -Method Post `
  -ContentType "application/json" -Body $body
```

The backend mounts `./projects` read-only and a `ContextVar`-scoped `project_id` flows through every request so each project sees its own evidence, agents, and exports.

### Updating the framework in a customer repo

Renovate watches the GHCR image tags pinned in `compose.yaml` and opens grouped PRs when new releases ship. Patch bumps (`v1.2.1 → v1.2.2`) auto-merge after CI; minor and major need human review.

### Framework releases

Tagging this repo with `vX.Y.Z` triggers the release pipeline: lint → test → build amd64 → push to GHCR → cosign keyless sign → SLSA provenance → Trivy scan. Customer repos pick up the new images on the next Renovate run.

---

The rest of this README covers **framework development**: running the dev stack against your own backend source, contributing changes, and configuring Azure for end-to-end tests. If you just want to deploy CORE Discovery for a customer, the CLI flow above is all you need.



```text
┌─────────────────────────┐     ┌──────────────────────────┐
│   Next.js Frontend      │     │   FastAPI Backend         │
│   (React 19, TS, TW4)   │────▶│   (Python 3.11+)         │
│   localhost:3000         │     │   localhost:8000          │
└─────────────────────────┘     └──────────┬───────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │  AI Agents  │
                                    │  (5 agents) │
                                    └──────┬──────┘
                                           │
                              ┌────────────┼────────────┐
                              │            │            │
                         ┌────▼───┐  ┌─────▼────┐ ┌────▼────┐
                         │  LLM   │  │ Storage  │ │  Blob   │
                         │Provider│  │ Provider │ │Provider │
                         └────┬───┘  └─────┬────┘ └────┬────┘
                              │            │            │
                  ┌───────────┼──┐    ┌────┼────┐  ┌───┼────┐
                  │Azure  │Local │    │Cosmos│Local│  │Azure│Local│
                  │OpenAI │Ollama│    │ DB  │JSON │  │Blob │File │
                  └───────┴─────┘    └─────┴─────┘  └─────┴─────┘
```

The backend uses a provider abstraction pattern. Swap between local development and Azure production by changing environment variables. No code changes required. See
[ADR-001](docs/ADR/adr-001-provider-abstraction.md) for the architectural rationale.

### Tech Stack

| Layer        | Technology                                          |
|--------------|-----------------------------------------------------|
| Frontend     | Next.js 16, React 19, TypeScript 5.9                |
| Styling      | Tailwind CSS v4, shadcn/ui (base-nova)              |
| Backend      | FastAPI, Pydantic 2, uvicorn                        |
| AI Agents    | Specialized agents with base class, registry, and opt-in HITL review gates |
| LLM          | Azure OpenAI, OpenAI direct, or Ollama (local)      |
| Storage      | Azure Cosmos DB or local JSON files                 |
| Blobs        | Azure Blob Storage or local filesystem              |
| Speech       | Azure Speech Services (optional)                    |
| Auth         | Azure Entra ID (MSAL on the SPA, bearer on the API) or none (local) |
| Microsoft 365| Microsoft Graph (files, messages, meetings) + Dataverse (accounts) |
| Realtime     | WebSocket hub for live collaboration with bearer-token gate |
| Docs Parsing | PDF, PPTX, DOCX, XLSX via pymupdf and python-pptx   |
| Integration  | Engagement repos (scan, ingest, and export)         |
| Observability| Append-only audit log + optional Azure Monitor / OTLP tracing |
| Tooling      | OpenAPI typed-client generation (`pnpm gen:api`), Storybook scaffold |
| CI/CD        | GitHub Actions (lint, test, build), tag-driven multi-arch release pipeline |

## Prerequisites

You need these installed before proceeding:

| Tool       | Version  | Purpose                              |
|------------|----------|--------------------------------------|
| Node.js    | 20+      | Frontend runtime                     |
| pnpm       | 10+      | Frontend package manager             |
| Python     | 3.11+    | Backend runtime                      |
| Git        | 2.40+    | Version control                      |

For local-only development (no Azure), you also need:

| Tool       | Version  | Purpose                              |
|------------|----------|--------------------------------------|
| Ollama     | latest   | Local LLM inference                  |

For Azure deployment, you also need:

| Tool       | Version  | Purpose                              |
|------------|----------|--------------------------------------|
| Azure CLI  | 2.60+    | Azure resource management            |

## Running Locally

### 1. Clone and install frontend dependencies

```bash
git clone https://github.com/zitro/core-framework.git
cd core-framework
pnpm install
```

### 2. Configure the frontend environment

```bash
cp .env.local.example .env.local
```

The default configuration points at the backend on `http://localhost:8000`. Edit `.env.local` if your
backend runs on a different port.

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Set up the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```powershell
# Windows PowerShell
& .\.venv\Scripts\Activate.ps1
```

```bash
# macOS/Linux
source .venv/bin/activate
```

Install dependencies. For local-only development:

```bash
pip install -e ".[local,dev]"
```

For Azure-backed development:

```bash
pip install -e ".[azure,dev]"
```

### 4. Configure the backend environment

```bash
cp .env.example .env
```

The default `.env` uses local providers. This requires Ollama running with a model pulled:

```bash
ollama pull llama3.1
ollama serve
```

Your `.env` should look like this for local development:

```env
LLM_PROVIDER=local
STORAGE_PROVIDER=local
AUTH_PROVIDER=none
SPEECH_PROVIDER=none

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

CORS_ORIGINS=["http://localhost:3000"]
```

### 5. Start the backend

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verify it's running:

```bash
curl http://localhost:8000/api/health
```

You should see:

```json
{
  "status": "healthy",
  "providers": {
    "llm": "local",
    "storage": "local",
    "speech": "none",
    "auth": "none"
  }
}
```

### 6. Start the frontend

Open a second terminal at the project root:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running with Azure

Azure mode replaces local storage and LLM with managed Azure services. This gives you persistent
Cosmos DB storage, Azure OpenAI for question generation and transcript analysis, Azure Blob Storage
for file uploads, and Azure Speech Services for audio transcription.

### Required Azure Resources

| Resource               | SKU/Tier       | Purpose                              |
|------------------------|----------------|--------------------------------------|
| Azure OpenAI           | Standard S0    | LLM inference (gpt-4o deployment)    |
| Azure Cosmos DB        | Serverless     | Discovery and evidence persistence   |
| Azure Storage Account  | Standard LRS   | Transcript and export file storage   |
| Azure Speech Services  | Free F0 or S0  | Audio-to-text transcription          |

### Azure Resource Setup

All examples assume a resource group named `my-resource-group`. Adjust names as needed.

Create an Azure OpenAI resource and deploy a model:

```bash
az cognitiveservices account create \
  --name "<OPENAI_RESOURCE_NAME>" \
  --resource-group "<RESOURCE_GROUP>" \
  --kind "OpenAI" \
  --sku "S0" \
  --location "eastus"

az cognitiveservices account deployment create \
  --name "<OPENAI_RESOURCE_NAME>" \
  --resource-group "<RESOURCE_GROUP>" \
  --deployment-name "gpt-4o" \
  --model-name "gpt-4o" \
  --model-version "2024-11-20" \
  --model-format "OpenAI" \
  --sku-capacity 10 \
  --sku-name "GlobalStandard"
```

Create a Cosmos DB account with a database and containers:

```bash
az cosmosdb create \
  --name "<COSMOS_ACCOUNT_NAME>" \
  --resource-group "<RESOURCE_GROUP>" \
  --capabilities "EnableServerless" \
  --locations regionName="eastus2"

az cosmosdb sql database create \
  --account-name "<COSMOS_ACCOUNT_NAME>" \
  --resource-group "<RESOURCE_GROUP>" \
  --name "core-discovery"

az cosmosdb sql container create \
  --account-name "<COSMOS_ACCOUNT_NAME>" \
  --resource-group "<RESOURCE_GROUP>" \
  --database-name "core-discovery" \
  --name "discoveries" \
  --partition-key-path "/id"

az cosmosdb sql container create \
  --account-name "<COSMOS_ACCOUNT_NAME>" \
  --resource-group "<RESOURCE_GROUP>" \
  --database-name "core-discovery" \
  --name "evidence" \
  --partition-key-path "/discoveryId"
```

Create a Storage Account:

```bash
az storage account create \
  --name "<STORAGE_ACCOUNT_NAME>" \
  --resource-group "<RESOURCE_GROUP>" \
  --sku "Standard_LRS" \
  --kind "StorageV2"

az storage container create --name "transcripts" --account-name "<STORAGE_ACCOUNT_NAME>"
az storage container create --name "exports" --account-name "<STORAGE_ACCOUNT_NAME>"
```

Create a Speech Services resource (optional, for audio transcription):

```bash
az cognitiveservices account create \
  --name "<SPEECH_RESOURCE_NAME>" \
  --resource-group "<RESOURCE_GROUP>" \
  --kind "SpeechServices" \
  --sku "F0" \
  --location "eastus"
```

### RBAC Configuration

The application authenticates to Azure using `DefaultAzureCredential`, which works with your Azure CLI
login during development. Assign these roles to your user principal:

```bash
# Get your principal ID
PRINCIPAL_ID=$(az ad signed-in-user show --query id -o tsv)

# Azure OpenAI
az role assignment create \
  --role "Cognitive Services OpenAI User" \
  --assignee "$PRINCIPAL_ID" \
  --scope "/subscriptions/<SUB_ID>/resourceGroups/<RESOURCE_GROUP>/providers/Microsoft.CognitiveServices/accounts/<OPENAI_RESOURCE_NAME>"

# Cosmos DB (SQL RBAC, not ARM RBAC)
az cosmosdb sql role assignment create \
  --account-name "<COSMOS_ACCOUNT_NAME>" \
  --resource-group "<RESOURCE_GROUP>" \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id "$PRINCIPAL_ID" \
  --scope "/"

# Blob Storage
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee "$PRINCIPAL_ID" \
  --scope "/subscriptions/<SUB_ID>/resourceGroups/<RESOURCE_GROUP>/providers/Microsoft.Storage/storageAccounts/<STORAGE_ACCOUNT_NAME>"

# Speech Services
az role assignment create \
  --role "Cognitive Services Speech User" \
  --assignee "$PRINCIPAL_ID" \
  --scope "/subscriptions/<SUB_ID>/resourceGroups/<RESOURCE_GROUP>/providers/Microsoft.CognitiveServices/accounts/<SPEECH_RESOURCE_NAME>"
```

Replace `<SUB_ID>` with your Azure subscription ID.

### Azure Backend Configuration

Update `backend/.env` to use Azure providers:

```env
LLM_PROVIDER=azure
STORAGE_PROVIDER=azure
AUTH_PROVIDER=none
SPEECH_PROVIDER=azure

AZURE_OPENAI_ENDPOINT=https://<OPENAI_RESOURCE_NAME>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview

COSMOS_ENDPOINT=https://<COSMOS_ACCOUNT_NAME>.documents.azure.com:443/
COSMOS_DATABASE=core-discovery

AZURE_STORAGE_ACCOUNT=<STORAGE_ACCOUNT_NAME>
AZURE_STORAGE_CONTAINER=transcripts

AZURE_SPEECH_REGION=eastus
AZURE_SPEECH_RESOURCE_ID=/subscriptions/<SUB_ID>/resourceGroups/<RESOURCE_GROUP>/providers/Microsoft.CognitiveServices/accounts/<SPEECH_RESOURCE_NAME>

CORS_ORIGINS=["http://localhost:3000"]
```

> [!NOTE]
> No API keys are needed when using `DefaultAzureCredential` with RBAC. Make sure you are logged in
> with `az login` before starting the backend.

Start the backend (Azure CLI must be on PATH):

```powershell
# Windows: refresh PATH so DefaultAzureCredential can find az CLI
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
cd backend
& .\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```bash
# macOS/Linux
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Project Structure

```text
core-framework/
├── src/                          # Next.js frontend
│   ├── app/                      # App router pages
│   │   ├── page.tsx              # Dashboard: create and select discoveries
│   │   ├── capture/page.tsx      # Question generation + transcript analysis
│   │   ├── orient/page.tsx       # Sensemaking + problem statement builder
│   │   ├── refine/page.tsx       # Assumption tracker + solution matcher
│   │   ├── execute/page.tsx      # Quick wins, blockers, handoff
│   │   ├── discoveries/page.tsx  # Browse all past discoveries
│   │   └── evidence/page.tsx     # Cross-phase evidence board
│   ├── components/               # Shared and feature components
│   │   ├── layout/               # Sidebar, header, theme toggle, phase shell
│   │   ├── capture/              # TranscriptResults
│   │   ├── orient/               # ProblemStatementBuilder, UseCaseBuilder
│   │   ├── refine/               # AssumptionTracker, SolutionArchitect, SolutionMatcher
│   │   ├── execute/              # QuickWinTracker, BlockerList, HandoffPanel
│   │   ├── settings/             # DocsPathConfig, EngagementConfig
│   │   └── ui/                   # shadcn/ui primitives (16 components)
│   ├── stores/                   # React context stores
│   │   └── discovery-store.tsx   # Active discovery state management
│   ├── lib/                      # API client, utilities, realtime hook
│   ├── hooks/                    # Custom React hooks
│   ├── __tests__/                # Frontend tests (vitest)
│   └── types/                    # TypeScript type definitions
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── main.py               # App factory, middleware, router registration
│   │   ├── config.py             # Settings and startup validation
│   │   ├── dependencies.py       # Auth dependency for route protection
│   │   ├── models/               # Pydantic models (Discovery, Evidence, etc.)
│   │   ├── agents/               # AI sub-agents
│   │   │   ├── base.py           # Base agent class with AgentMeta/AgentResult
│   │   │   ├── registry.py       # Agent discovery and registry
│   │   │   ├── discovery_coach.py     # Phase-appropriate question generation
│   │   │   ├── problem_analyst.py     # Evidence-to-problem-statement analysis
│   │   │   ├── transcript_analyst.py  # Transcript insight extraction
│   │   │   ├── use_case_analyst.py    # Persona and use case generation
│   │   │   └── solution_architect.py  # Solution blueprint proposals
│   │   ├── routers/              # API endpoints
│   │   │   ├── discovery.py      # CRUD for discovery sessions
│   │   │   ├── questions.py      # Question generation + solution matching
│   │   │   ├── transcripts.py    # Transcript analysis + audio upload
│   │   │   ├── evidence.py       # Evidence CRUD scoped by discovery
│   │   │   ├── problem_statements.py  # Problem statement generation
│   │   │   ├── advisor.py        # Use case proposal generation
│   │   │   ├── blueprints.py     # Solution architecture generation
│   │   │   ├── export.py         # JSON/CSV export downloads
│   │   │   ├── docs.py           # Local documentation scanning
│   │   │   ├── engagement.py     # Engagement repo integration
│   │   │   └── realtime.py       # WebSocket hub for live collaboration
│   │   ├── utils/                # Utilities
│   │   │   ├── context.py        # Context gathering (includes engagement data)
│   │   │   ├── local_docs.py     # Binary document parsing (PDF, PPTX, etc.)
│   │   │   └── engagement.py     # Engagement repo scanning and frontmatter parsing
│   │   └── providers/            # Pluggable service providers
│   │       ├── llm/              # Azure OpenAI, OpenAI, Ollama
│   │       ├── storage/          # Cosmos DB, local JSON
│   │       ├── blob/             # Azure Blob, local filesystem
│   │       ├── speech/           # Azure Speech Services
│   │       └── auth/             # Azure Entra ID, no-auth
│   ├── .env.example              # Template for backend environment
│   ├── tests/                    # Backend tests (pytest)
│   └── pyproject.toml            # Python dependencies and project metadata
├── .github/
│   └── workflows/ci.yml          # CI pipeline: lint, test, build
├── docs/                         # Documentation
│   ├── BRD/                      # Business Requirements Document
│   ├── TRD/                      # Technical Requirements Document
│   └── ADR/                      # Architecture Decision Records
├── docker-compose.yml            # Production containerization
├── docker-compose.dev.yml        # Local containerization
├── Dockerfile                    # Frontend container
├── .env.local.example            # Template for frontend environment
├── vitest.config.ts              # Frontend test configuration
└── package.json                  # Frontend dependencies and scripts
```

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Path                                  | Purpose                                |
|--------|---------------------------------------|----------------------------------------|
| GET    | `/api/health`                         | Health check with provider status      |
| GET    | `/api/me`                             | Active principal (Entra or local)      |
| GET    | `/api/discovery/`                     | List discoveries (filter `?engagement_id=`) |
| POST   | `/api/discovery/`                     | Create a new discovery                 |
| GET    | `/api/discovery/{id}`                 | Get a single discovery                 |
| PATCH  | `/api/discovery/{id}`                 | Update a discovery                     |
| DELETE | `/api/discovery/{id}`                 | Delete a discovery                     |
| POST   | `/api/questions/generate`             | Generate phase-specific questions      |
| POST   | `/api/questions/solution-match`       | Match problems to capabilities         |
| POST   | `/api/transcripts/analyze`            | Analyze a text transcript              |
| POST   | `/api/transcripts/upload-audio`       | Upload audio for speech-to-text        |
| GET    | `/api/evidence/`                      | List evidence (filter by `engagement_id` and `phase`) |
| POST   | `/api/evidence/`                      | Create an evidence item                |
| PATCH  | `/api/evidence/{id}`                  | Update an evidence item                |
| DELETE | `/api/evidence/{id}`                  | Delete an evidence item                |
| POST   | `/api/problem-statements/generate`    | Generate evidence-backed problem stmt  |
| POST   | `/api/advisor/use-cases/generate`     | Generate use case proposals            |
| POST   | `/api/blueprints/generate`            | Generate solution architecture         |
| POST   | `/api/agents/{agent_id}/run`          | Run any registered agent (traced span) |
| GET    | `/api/engagements/`                   | List engagements                       |
| POST   | `/api/engagements/`                   | Create an engagement                   |
| PATCH  | `/api/engagements/{id}`               | Update an engagement                   |
| DELETE | `/api/engagements/{id}`               | Delete an engagement                   |
| POST   | `/api/engagements/{id}/discoveries/{discovery_id}` | Attach a discovery   |
| DELETE | `/api/engagements/{id}/discoveries/{discovery_id}` | Detach a discovery   |
| POST   | `/api/engagement/scan`                | Scan an engagement repo                |
| POST   | `/api/engagement/export`              | Export deliverables (skips items pending/rejected in review) |
| GET    | `/api/reviews/`                       | List reviews (filter `?engagement_id=`)|
| POST   | `/api/reviews/`                       | Open a review request                  |
| POST   | `/api/reviews/{id}/decision`          | Approve / reject / request changes     |
| GET    | `/api/audit/`                         | Read audit log (filter `?collection=`, `?item_id=`, `?actor=`) |
| GET    | `/api/graph/{status,files,messages,meetings}` | Microsoft Graph read-only      |
| GET    | `/api/dynamics/{status,accounts}`     | Dataverse account read-only            |
| POST   | `/api/grounding/answer`               | LLM answer with `[source:N]` citations |
| POST   | `/api/docs/scan`                      | Scan local documentation directory     |
| GET    | `/api/export/{id}?format=json`        | Export discovery as JSON               |
| GET    | `/api/export/{id}?format=csv`         | Export discovery as CSV                |
| WS     | `/ws/{discoveryId}?token=<bearer>`    | Real-time collaboration channel        |

Interactive API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs)
when the backend is running. Generate a typed TypeScript client from the schema at any time with
`pnpm gen:api` (writes `src/types/api.ts`).

## Data Flow

Data flows forward through the CORE phases to build a connected narrative:

```text
Capture ──▶ Orient ──▶ Refine ──▶ Execute
  │            │          │          │
  │ Evidence   │ Problem  │ Assump.  │ Handoff
  │ extracted  │ statement│ validated│ package
  │ from       │ built    │ solution │ with full
  │ transcripts│ from     │ matches  │ context
  │            │ evidence │ persisted│
  ▼            ▼          ▼          ▼
  Evidence Board (cross-phase, scoped per discovery)
```

## Human-in-the-Loop Reviews

Most agent-produced artifacts (problem statements, use cases, blueprints, company profiles, empathy
maps, HMW boards) automatically open a `Review` in the `pending` state. Reviewers approve, reject,
or request changes from the **Reviews** page. The engagement export route skips any artifact whose
latest review is `pending`, `changes_requested`, or `rejected` and reports it under `skipped`, so
nothing leaves the workspace without a human signoff.

Filter the queue by engagement to keep reviewers focused:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/reviews/?engagement_id=$ENG_ID"
```

## Audit Log

Every create, update, delete, agent run, and review decision writes a row to the append-only `audit`
collection. Each row captures the actor (from the active Entra principal), action, collection,
item id, before/after content hashes, and a short summary. Read it via:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/audit/?collection=engagements&item_id=$ID"
```

## Telemetry

OpenTelemetry instrumentation is opt-in. Set either of the following and the backend will configure
exporters at startup, instrument FastAPI and httpx, and wrap each `agent.run` in a span tagged with
`agent.id` and `discovery.id`:

| Variable                                     | Effect                                  |
|----------------------------------------------|-----------------------------------------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING`      | Send traces and metrics to App Insights |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                | Send traces over OTLP HTTP              |

When neither is set, telemetry is a no-op and pulls zero extra weight.

## Typed API Client

The frontend can consume types generated directly from the live FastAPI OpenAPI schema:

```bash
# Backend must be running on the URL configured in scripts/gen-api-types.mjs
pnpm gen:api
```

This produces `src/types/api.ts`. New API modules import the generated `paths` type and derive
request / response shapes from it instead of restating them by hand.

## UI Component Catalog (Storybook)

Storybook is included as an opt-in dev tool — config and stories ship with the repo, but the
package isn't a default dependency. Install and run it on demand:

```bash
pnpm add -D @storybook/nextjs @storybook/react storybook
pnpm storybook
```

Stories for the shadcn primitives (`Button`, `Badge`, `Card`) live next to each component as
`*.stories.tsx`. The TypeScript build excludes them so missing Storybook deps never break the
production build.

All data is scoped to the active discovery session. When you select a discovery from the Dashboard or
the sidebar, every phase page and the Evidence Board operate within that discovery's context.

## Documentation

- [Project model](docs/PROJECT_MODEL.md): one-customer-per-deploy, many-projects-per-customer
  architecture (v1.1+)
- [Business Requirements Document](docs/BRD/core-discovery-brd.md): stakeholder needs and success
  criteria
- [Technical Requirements Document](docs/TRD/core-discovery-trd.md): technical design and constraints
- [ADR-001: Provider Abstraction](docs/ADR/adr-001-provider-abstraction.md): rationale for the
  pluggable provider pattern

## Development

### Linting

Frontend:

```bash
pnpm lint
```

Backend:

```bash
cd backend
ruff check .
ruff format --check .
```

### Building for Production

```bash
pnpm build
```

This creates an optimized production build in `.next/`. All pages are statically generated where
possible.

### Running Tests

Backend (27 tests):

```bash
cd backend
pytest tests/ -v
```

Frontend (7 tests):

```bash
pnpm test
```

## Security

All API routes (except `/api/health`) require authentication. The auth dependency uses the configured
provider:

- `AUTH_PROVIDER=none`: All requests pass through with a local-dev user (development only).
- `AUTH_PROVIDER=azure`: Validates Entra ID JWT bearer tokens. Requires `AZURE_TENANT_ID` and
  `AZURE_CLIENT_ID`.

Rate limiting is enforced globally at 100 requests per minute per IP address. Configure via the
`RATE_LIMIT` environment variable (default: `100/minute`).

Startup validation checks that required environment variables are set for the selected providers and
logs warnings if any are missing.

## Real-Time Collaboration

The WebSocket endpoint at `/ws/{discoveryId}` enables live multi-user collaboration on discovery
sessions. Connected clients receive:

- Presence updates when users join or leave.
- Phase change notifications.
- Evidence additions relayed to all participants.

The frontend `useRealtime` hook manages the connection lifecycle and exposes `send`, `activeUsers`,
and `connected` state.

## AI Agents

The backend includes five specialized AI agents, each focused on one aspect of the discovery
process. All agents share a common base class (`AgentMeta` for identity, `AgentResult` for output)
and register themselves in a central registry for discoverability.

| Agent              | Phase   | Responsibility                                           |
|--------------------|---------|----------------------------------------------------------|
| Discovery Coach    | All     | Generates phase-appropriate interview questions           |
| Problem Analyst    | Orient  | Synthesizes evidence into structured problem statements   |
| Transcript Analyst | Capture | Extracts insights, evidence, themes from meeting notes    |
| Use Case Analyst   | Orient  | Builds personas and use case proposals from evidence      |
| Solution Architect | Refine  | Proposes architecture blueprints with service selections  |

Each agent defines its own LLM system prompt with phase-specific guidance. The Discovery Coach, for
example, uses different prompt strategies for Capture (listening and probing) versus Orient
(sensemaking and pattern recognition) versus Refine (assumption testing).

## Engagement Repo Integration

CORE integrates bidirectionally with structured markdown engagement repositories. The engagement
repo serves as a knowledge base for a project, while CORE provides the AI analysis layer.

### Ingest (Repo to CORE)

Point CORE at an engagement repo path and it scans the directory structure, auto-detects the
content directory (skipping templates, scripts, and hidden dirs), and parses YAML frontmatter
from all markdown files. The scan returns structured metadata: content name, project list, and
file counts grouped by type (labels are derived dynamically from the frontmatter `type` field).

When a discovery session has an `engagement_repo_path` set, the context gathering utility
automatically calls `read_engagement_context()` to load relevant files, grouped by type, into
the AI agents' context window. Size caps (200 KB per file, 500 KB total) prevent prompt overflow.

### Export (CORE to Repo)

The export endpoint renders CORE deliverables (problem statements, use cases, solution blueprints)
as markdown files with `type: decision` YAML frontmatter. Drop the exported files into the
engagement repo and they become part of the project record.

### Frontend Configuration

The settings panel provides an engagement repo configuration card where you enter the repo path,
scan to preview the contents (content name, project count, file counts by type), and export CORE
outputs back to the repo.

## Local Documentation Scanning

The `/api/docs/scan` endpoint reads a local directory of documents and feeds their content into the
AI context. Supported formats:

- PDF (via PyMuPDF)
- PowerPoint (.pptx)
- Word (.docx)
- Excel (.xlsx)
- Plain text and markdown

The frontend settings panel includes a docs path configuration card for pointing CORE at a local
folder of existing engagement materials (SOWs, slide decks, architecture docs). The parsed content
is available to all AI agents during analysis.

## Dark Mode

The application supports light and dark themes. Toggle via the sun/moon button in the sidebar footer.
Theme preference persists in `localStorage` and respects the system setting by default.
