import type { ScaffoldOptions } from "./scaffold.js";

export function composeYaml(o: ScaffoldOptions): string {
  return `# ${o.displayName} CORE Discovery — local dev compose
#
# Pulls signed framework images from GHCR. No framework source lives in this
# repo — only ${o.displayName}-specific deploy config, project content, and customizations.
#
# Renovate watches both image tags and opens grouped PRs when newer
# minor/patch releases ship.

services:
  backend:
    image: ghcr.io/zitro/core-framework-backend:${o.version}
    container_name: core-${o.name}-backend
    restart: unless-stopped
    env_file:
      - .env
    environment:
      PROJECTS_ROOT: /data/projects
      LOCAL_STORAGE_PATH: /data/storage
      EXTENSIONS_DIR: /data/extensions
    volumes:
      - ./projects:/data/projects:ro
      - ./config/prompts:/data/prompts:ro
      - ./extensions:/data/extensions:ro
      - backend-storage:/data/storage
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  frontend:
    image: ghcr.io/zitro/core-framework-frontend:${o.version}
    container_name: core-${o.name}-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    ports:
      - "3000:3000"

volumes:
  backend-storage:
`;
}

export function envExample(o: ScaffoldOptions): string {
  const partition = o.storage === "azure" ? "project_id" : "id";
  return `# ─── Provider selection ────────────────────────────────────────────────
LLM_PROVIDER=${o.llm}
STORAGE_PROVIDER=${o.storage}
AUTH_PROVIDER=${o.auth}

# ─── Azure OpenAI (LLM_PROVIDER=azure) ─────────────────────────────────
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# ─── OpenAI direct (LLM_PROVIDER=openai) ───────────────────────────────
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o

# ─── Cosmos DB (STORAGE_PROVIDER=azure) ────────────────────────────────
COSMOS_ENDPOINT=
COSMOS_KEY=
COSMOS_DATABASE=core-discovery
COSMOS_ENSURE_COLLECTIONS=true
# IMMUTABLE per Cosmos container — set before first ensure_collections run.
COSMOS_PARTITION_STRATEGY=${partition}

# ─── Entra ID (AUTH_PROVIDER=azure) ────────────────────────────────────
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=

# ─── CORS ──────────────────────────────────────────────────────────────
CORS_ORIGINS=["http://localhost:3000"]

# ─── Project + extension mounts ────────────────────────────────────────
PROJECTS_ROOT=/data/projects
EXTENSIONS_DIR=/data/extensions
`;
}

export function gitignore(): string {
  return `# data + secrets
.env
data/
projects/*/storage/

# OS / editor cruft
.DS_Store
Thumbs.db
.vscode/
.idea/
`;
}

export function readme(o: ScaffoldOptions): string {
  return `# core-${o.name}

${o.displayName}'s instance of the **CORE Discovery** framework.

This repository holds **only** ${o.displayName}-specific deploy configuration, project content, and customizations. The framework runs as signed container images pulled from GHCR.

## Prerequisites

- Docker Desktop (running)
- Git

## Quick start

\`\`\`powershell
docker compose pull
docker compose up -d
start http://localhost:3000
\`\`\`

## Adding a project

Drop content into \`projects/<slug>/\`, then register it:

\`\`\`powershell
$body = @{ name = "My Project"; slug = "my-project"; repo_path = "my-project" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:8000/api/projects -Method Post \`
  -ContentType "application/json" -Body $body
\`\`\`

## Updating the framework

Renovate watches the GHCR image tags pinned in \`compose.yaml\` and opens PRs when new releases ship. Patch bumps auto-merge after CI; minor/major need human review.

## Releases

| Framework version | Pinned in \`compose.yaml\` |
|---|---|
| v${o.version} | current |
`;
}

export function renovateJson(): string {
  return `{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":semanticCommits", ":dependencyDashboard"],
  "packageRules": [
    {
      "matchPackagePatterns": ["^ghcr.io/zitro/core-framework-"],
      "groupName": "core-framework images",
      "automerge": true,
      "automergeType": "pr",
      "matchUpdateTypes": ["patch"]
    }
  ]
}
`;
}

export function infraReadme(o: ScaffoldOptions): string {
  return `# infra

Azure deploy targets for ${o.displayName}.

Scaffolding only. No \`.bicep\` files committed yet — added in a follow-up once the local-compose path is validated.

Planned topology: Container Apps (backend + frontend) + Cosmos DB + Application Insights, fronted by Azure Front Door, behind Entra ID auth.
`;
}

export function extensionsReadme(): string {
  return `# extensions

Drop \`*.py\` plugin modules here. Each module exposes a \`register(app, settings)\` function called at backend startup.

See https://github.com/zitro/core-framework/blob/master/docs/EXTENSIONS.md for the contract.
`;
}
