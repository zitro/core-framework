# Project model

CORE Discovery is built around a **one-customer-per-deploy, many-projects-per-customer** mental model. Each customer gets their own `core-<customer>` repository that pulls signed framework images from GHCR; within that deployment, work is organized into Projects.

## Vocabulary

- **Customer** — the organization that owns a deployment (e.g. Allstate). Implied by the deploy itself; not a stored entity.
- **Project** — a unit of work for that customer. Stored as an `Engagement` record (the legacy name) and exposed at both `/api/projects/*` (preferred) and `/api/engagements/*` (compatibility).
- **Discovery** — a CORE-method workstream within a Project (capture → orient → refine → execute).
- **Evidence**, **Question Set**, **Problem Statement**, **Use Case**, **Blueprint**, etc. — artifacts attached to a Discovery.

```
Customer (Allstate)              ← implied by deploy
└── Project (a.k.a. Engagement)  ← e.g. "Claims Modernization"
    └── Discovery                ← e.g. "FNOL pilot scoping"
        └── Evidence, Questions, Statements, Blueprints …
```

## Project identifiers

Every Project has two identifiers:

| Field | Stable? | Used for |
|---|---|---|
| `id` (UUID) | Yes | Internal references, `X-Project-Id` header, foreign keys |
| `slug` | Yes (per deployment) | URLs, filesystem paths under `projects_root`, container partition keys (v1.2+) |

The `slug` is auto-derived from `name` on creation:

- lowercased
- non-alphanumeric runs collapsed to `-`
- leading/trailing `-` stripped
- capped at 64 chars
- de-duplicated with `-2`, `-3`, … suffixes if a collision exists

`PATCH /api/projects/{id} {"slug": "new-slug"}` re-normalizes.

## Filesystem mount convention

Customer deploys mount a single `projects/` directory into the backend container:

```yaml
# customer repo: compose.yaml
services:
  backend:
    image: ghcr.io/zitro/core-framework-backend:1.1.0
    environment:
      PROJECTS_ROOT: /data/projects
    volumes:
      - ./projects:/data/projects:ro
```

Inside that mount, each Project's source content lives under its slug (or any name you reference in `repo_path`):

```
core-allstate/
└── projects/
    ├── claims-modernization/   ← repo_path: "claims-modernization"
    │   └── content/
    ├── fnol-pilot/             ← repo_path: "fnol-pilot"
    │   └── content/
    └── data-platform/          ← repo_path: "data-platform"
        └── content/
```

Engagements with an empty `repo_path` resolve to `projects_root` itself; relative paths join under it; absolute paths pass through unchanged.

## Frontend project context

The active Project is selected via the sidebar `ProjectSwitcher`, persisted in `localStorage`, and sent on every API request as the `X-Project-Id` header. Backend handlers may read it from `Request.headers["x-project-id"]`; in v1.2+ it will also be enforced as a Cosmos partition key.

To get the active project in a component:

```tsx
import { useProject } from "@/stores/project-store";

const { activeProject } = useProject();
```

## Roadmap

- **v1.2** — Per-project Cosmos partition keys (hard isolation), extension API for per-customer agents and providers.
- **v1.3** — Per-project RBAC (membership + role-gated routes/UI).
