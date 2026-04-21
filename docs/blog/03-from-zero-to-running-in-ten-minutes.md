---
title: "From Zero to Running CORE in Ten Minutes"
description: Part 3 of a three-part series on CORE Discovery. A hands-on walkthrough covering local setup, Azure configuration, and running your first discovery session through all four phases.
author: Bryan Ortiz
ms.date: 2026-04-09
ms.topic: how-to
keywords:
  - setup guide
  - CORE framework
  - local development
  - Azure deployment
  - Ollama
  - discovery session
estimated_reading_time: 4
---

## Two ways to run CORE

CORE supports two deployment modes. Local-only mode uses Ollama for LLM and JSON files for storage. Azure mode swaps in Azure OpenAI, Cosmos DB, Blob Storage, and Speech Services. Both use the same codebase. The difference is four environment variables.

Start local. Move to Azure when you are ready. No code changes required.

## Local setup

You need Node.js 20+, pnpm 10+, Python 3.11+, and Ollama installed.

Clone the repo and install frontend dependencies:

```bash
git clone https://github.com/zitro/core-framework.git
cd core-framework
pnpm install
```

Copy the frontend environment template:

```bash
cp .env.local.example .env.local
```

Set up the backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
# & .\.venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -e ".[local,dev]"
cp .env.example .env
```

Pull a model and start Ollama:

```bash
ollama pull llama3.1
ollama serve
```

The default `.env` is configured for local mode:

```env
LLM_PROVIDER=local
STORAGE_PROVIDER=local
AUTH_PROVIDER=none
SPEECH_PROVIDER=none
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

Start the backend:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verify it is healthy:

```bash
curl http://localhost:8000/api/health
```

You should see all providers reporting their local configuration. Open a second terminal, go back to the project root, and start the frontend:

```bash
pnpm dev
```

Open `http://localhost:3000`. That is it. No API keys, no cloud accounts, no configuration wizards.

## Azure setup

When you are ready for persistent storage and faster LLM inference, switch to Azure. You need an Azure subscription and the Azure CLI.

The key resources: Azure OpenAI (for LLM), Cosmos DB (for storage), a Storage Account (for file uploads), and optionally Azure Speech Services (for audio transcription).

Create the resources:

```bash
az cognitiveservices account create \
  --name "<OPENAI_RESOURCE_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --kind "OpenAI" --sku "S0" --location "eastus"

az cosmosdb create \
  --name "<COSMOS_ACCOUNT_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --capabilities "EnableServerless" --locations regionName="eastus2"

az storage account create \
  --name "<STORAGE_ACCOUNT_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --sku "Standard_LRS" --kind "StorageV2"
```

Deploy a model, create the database and containers, and assign RBAC roles. The README has the full commands. The important part: CORE uses `DefaultAzureCredential`, which means no API keys in your `.env`. You authenticate with `az login` and RBAC does the rest.

Update four variables in `backend/.env`:

```env
LLM_PROVIDER=azure
STORAGE_PROVIDER=azure
SPEECH_PROVIDER=azure
AUTH_PROVIDER=none
```

Add your Azure resource endpoints and restart the backend. Same code, different infrastructure.

## Running your first discovery session

Open the dashboard at `http://localhost:3000`. Click "New Discovery" and give it a name and description. Select a mode: Standard for open-ended discovery, FDE for focused engagements, or Workshop Sprint for time-boxed sessions.

### Capture phase

Navigate to Capture from the sidebar. You have two tools here.

**Question generation** creates interview questions tailored to the Capture phase. The AI generates open-ended exploratory questions designed to surface unknowns: "Walk me through what happens when a new patient arrives" instead of "Do you like the current system?" Specify how many questions you want (1 to 20) and generate.

**Transcript analysis** takes raw meeting notes or transcripts and extracts structured insights. Paste the text from a customer conversation, and the platform identifies key insights (with confidence levels), evidence items, sentiment indicators, and recurring themes. Extracted evidence flows automatically into the Evidence Board.

### Orient phase

Evidence from Capture pre-populates the context. Orient has two builders.

**Problem Statement Builder** synthesizes evidence into a structured WHO/WHAT/WHY/IMPACT format. The AI identifies which parts have strong evidence and which rest on assumptions. This becomes the anchor for the rest of the engagement.

**Use Case Builder** generates persona-grounded use cases: who the user is, what they need, why it matters to the business, and how you would measure success.

### Refine phase

The problem statement from Orient loads automatically. Refine gives you three tools.

**Assumption Tracker** lists every assumption underlying your problem statement and use cases. Mark each as untested, validated, or invalidated as you gather more evidence.

**Solution Architect** proposes technology blueprints based on validated use cases. Each blueprint includes specific service recommendations with rationale, not generic architecture patterns.

**Solution Matcher** maps problems to capabilities and identifies gaps. This is where "what we learned" connects to "what we can build."

### Execute phase

Validated insights from Refine feed into Execute. Track **quick wins** (low-effort, high-impact items to build momentum), manage **blockers** (with severity and mitigation plans), and prepare a **handoff package** that captures the full context of the discovery session for the team picking up implementation.

## The Evidence Board

Accessible from any phase via the sidebar. It shows every piece of evidence across the entire discovery, tagged by phase and source. This is the audit trail. When someone asks "why did we decide to build X?", the Evidence Board traces the chain from raw observation through tested assumption to prioritized action.

## Going further

If you have existing engagement materials, configure local documentation scanning in the settings panel. Point CORE at a folder of PDFs, slide decks, or Word docs, and the platform ingests them into the AI context.

If your team uses a structured engagement repo, configure the engagement integration to import project context and export CORE deliverables back to the repo.

Both features are optional. CORE works without them. They become valuable when you want AI analysis that builds on your existing knowledge base, not a fresh start every time.

## The series

This is part three of the CORE Discovery series. [Part one](01-why-discovery-is-broken.md) covers the concept and methodology. [Part two](02-architecture-of-an-ai-coaching-platform.md) dives into the technical architecture, provider pattern, and AI agent design.
