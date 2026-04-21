# Multi-User Authentication

CORE Discovery ships with a pluggable auth provider. Out of the box it runs in
**local mode** with a single in-process user, identical to v0.1.x behaviour. To
enable real multi-user access you wire up Microsoft Entra ID on both the API and
the web app.

## Modes

| Mode | `AUTH_PROVIDER` | Behaviour |
| --- | --- | --- |
| Local | `none` (default) | All requests succeed as `local-dev`. No tokens. |
| Entra ID | `azure` or `entra` | Bearer JWTs validated against your tenant. |

## Backend (FastAPI)

Set the following environment variables on the API:

```
AUTH_PROVIDER=azure
AZURE_TENANT_ID=<your-tenant-guid>
AZURE_CLIENT_ID=<api-app-registration-client-id>
```

Tokens are validated against
`https://login.microsoftonline.com/<tenant>/v2.0`. The `audience` claim must
equal `AZURE_CLIENT_ID`. Routes apply auth via the router-level dependency
`Depends(get_current_user)`; `/api/me` echoes the current principal.

## Frontend (Next.js)

Add to `.env.local`:

```
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_AZURE_TENANT_ID=<tenant-guid>
NEXT_PUBLIC_AZURE_CLIENT_ID=<spa-app-registration-client-id>
```

The SPA uses MSAL Browser with a redirect flow. The acquired access token is
attached as `Authorization: Bearer …` on every API call. With auth disabled the
SPA shows a `Local mode` indicator and skips MSAL entirely.

## App registrations

You need two app registrations in Entra ID:

1. **API** — exposes a scope (e.g. `access_as_user`). Set `AZURE_CLIENT_ID` to
   this app's client id on the backend.
2. **SPA** — single-page application, redirect URI = your frontend origin
   (`http://localhost:3000` in dev). Grant it delegated access to the API
   scope. Set `NEXT_PUBLIC_AZURE_CLIENT_ID` to this app's client id.

Both can live in the same tenant. The SPA requests `api://<api-client-id>/access_as_user`
which the backend validates.

## Storage

When `STORAGE_PROVIDER=azure`, the API auto-creates the Cosmos database and all
known containers on startup (`/id` partition key). Containers managed:

`discoveries, evidence, question_sets, transcript_analyses, problem_statements,
use_cases, solution_blueprints, empathy_maps, hmw_boards, ideation_sessions,
assumption_maps`

Provide either `COSMOS_KEY` for key-based auth or use Managed Identity /
`DefaultAzureCredential` (recommended) by leaving `COSMOS_KEY` empty.
