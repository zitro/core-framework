---
title: CORE Discovery Framework
description: An AI-powered product discovery coaching platform built on the CORE methodology (Capture, Orient, Refine, Execute) with a Next.js frontend and FastAPI backend.
ms.date: 2026-04-08
---

## Overview

CORE Discovery is a full-stack application that guides product teams through structured discovery engagements using the CORE methodology. Each phase builds on the previous one, creating a connected chain of evidence, insights, and decisions.

The four phases work together:

1. Capture: Probe the system, gather evidence, map stakeholders. Generate tailored interview questions
   and analyze meeting transcripts. Extracted evidence flows automatically into the Evidence Board.
2. Orient: Recognize patterns, frame the real problem. Evidence from Capture pre-populates the context.
   Build a structured problem statement that carries forward.
3. Refine: Test assumptions, match solutions to capabilities. The problem statement from Orient loads
   automatically. Assumptions and solution matches persist across sessions.
4. Execute: Deliver quick wins, resolve blockers, prepare handoff. The validated problem statement and
   assumptions from earlier phases display as context.

## Architecture

```text
┌─────────────────────────┐     ┌──────────────────────────┐
│   Next.js Frontend      │     │   FastAPI Backend         │
│   (React 19, TS, TW4)   │────▶│   (Python 3.11+)         │
│   localhost:3000         │     │   localhost:8000          │
└─────────────────────────┘     └──────────┬───────────────┘
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

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | Next.js 16, React 19, TypeScript 5.9    |
| Styling  | Tailwind CSS v4, shadcn/ui (base-nova)  |
| Backend  | FastAPI, Pydantic 2, uvicorn            |
| LLM      | Azure OpenAI or Ollama (local)          |
| Storage  | Azure Cosmos DB or local JSON files     |
| Blobs    | Azure Blob Storage or local filesystem  |
| Speech   | Azure Speech Services (optional)        |
| Auth     | Azure Entra ID or none (local)          |

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

All examples assume a resource group named `<RESOURCE_GROUP>`. Adjust names as needed.

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
│   │   ├── layout/               # Sidebar, app shell
│   │   ├── execute/              # QuickWinTracker, BlockerList, HandoffPanel
│   │   ├── refine/               # AssumptionTracker, SolutionMatcherPanel
│   │   └── ui/                   # shadcn/ui primitives
│   ├── stores/                   # React context stores
│   │   └── discovery-store.tsx   # Active discovery state management
│   ├── lib/                      # API client, utilities
│   └── types/                    # TypeScript type definitions
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── main.py               # App factory, CORS, router registration
│   │   ├── config.py             # Settings from environment variables
│   │   ├── models/               # Pydantic models (Discovery, Evidence, etc.)
│   │   ├── routers/              # API endpoints
│   │   │   ├── discovery.py      # CRUD for discovery sessions
│   │   │   ├── questions.py      # Question generation + solution matching
│   │   │   ├── transcripts.py    # Transcript analysis + audio upload
│   │   │   └── evidence.py       # Evidence CRUD scoped by discovery
│   │   └── providers/            # Pluggable service providers
│   │       ├── llm/              # Azure OpenAI, OpenAI, Ollama
│   │       ├── storage/          # Cosmos DB, local JSON
│   │       ├── blob/             # Azure Blob, local filesystem
│   │       ├── speech/           # Azure Speech Services
│   │       └── auth/             # Azure Entra ID, no-auth
│   ├── .env.example              # Template for backend environment
│   └── pyproject.toml            # Python dependencies and project metadata
├── docs/                         # Documentation
│   ├── BRD/                      # Business Requirements Document
│   ├── TRD/                      # Technical Requirements Document
│   └── ADR/                      # Architecture Decision Records
├── .env.local.example            # Template for frontend environment
└── package.json                  # Frontend dependencies and scripts
```

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Path                            | Purpose                           |
|--------|---------------------------------|-----------------------------------|
| GET    | `/api/health`                   | Health check with provider status |
| GET    | `/api/discovery/`               | List all discoveries              |
| POST   | `/api/discovery/`               | Create a new discovery            |
| GET    | `/api/discovery/{id}`           | Get a single discovery            |
| PATCH  | `/api/discovery/{id}`           | Update a discovery                |
| DELETE | `/api/discovery/{id}`           | Delete a discovery                |
| POST   | `/api/questions/generate`       | Generate phase-specific questions |
| POST   | `/api/questions/solution-match` | Match problems to capabilities    |
| POST   | `/api/transcripts/analyze`      | Analyze a text transcript         |
| POST   | `/api/transcripts/upload-audio` | Upload audio for speech-to-text   |
| GET    | `/api/evidence/{discoveryId}`   | List evidence for a discovery     |
| POST   | `/api/evidence/`                | Create an evidence item           |
| PATCH  | `/api/evidence/{id}`            | Update an evidence item           |
| DELETE | `/api/evidence/{id}`            | Delete an evidence item           |

Interactive API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs)
when the backend is running.

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

All data is scoped to the active discovery session. When you select a discovery from the Dashboard or
the sidebar, every phase page and the Evidence Board operate within that discovery's context.

## Documentation

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

```bash
cd backend
pytest
```
