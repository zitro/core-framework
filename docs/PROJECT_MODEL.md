# Project model

CORE Discovery is built around a **one-customer-per-deploy, many-projects-per-customer** mental model. Each customer gets their own `core-<customer>` repository that pulls signed framework images from GHCR; within that deployment, work is organized into Projects.

## Vocabulary

- **Customer** — the organization that owns a deployment. Implied by the deploy itself; not a stored entity.
- **Project** — a unit of work for that customer. Stored as an `Engagement` record (the legacy name) and exposed at both `/api/projects/*` (preferred) and `/api/engagements/*` (compatibility).
- **Discovery** — a CORE-method workstream within a Project (capture → orient → refine → execute).
- **Evidence**, **Question Set**, **Problem Statement**, **Use Case**, **Blueprint**, etc. — artifacts attached to a Discovery.

```
Customer                         ← implied by deploy
└── Project (a.k.a. Engagement)  ← e.g. "Platform Modernization"
    └── Discovery                ← e.g. "Pilot scoping"
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
core-<customer>/
└── projects/
    ├── platform-modernization/ ← repo_path: "platform-modernization"
    │   └── content/
    ├── pilot-one/              ← repo_path: "pilot-one"
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

## Partitioning (v1.2+)

When `COSMOS_PARTITION_STRATEGY=project_id`, every collection in `PARTITIONED_COLLECTIONS` (discoveries, evidence, question sets, transcripts, problem statements, use cases, blueprints, empathy maps, HMW boards, ideation, assumption maps, company profiles, reviews) is created with `/project_id` as the Cosmos partition key. Items are auto-stamped with the active project on write and queries auto-scope on read — no router changes required.

Two collections opt out and stay partitioned by `/id`:

- **`engagements`** — the project record itself; cross-project listing is by design.
- **`audit`** — cross-project log.

Partition keys are immutable in Cosmos, so the strategy must be set **before** containers are created. See the v1.2 CHANGELOG entry for migration guidance.

## Extensions (v1.2+)

Per-customer plugin modules can add agents, providers, prompts, and routers without forking framework source. See [EXTENSIONS.md](EXTENSIONS.md) for the contract and example.

## Roadmap

- **v1.3** — Per-project RBAC (membership + role-gated routes/UI).
