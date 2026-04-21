# Security

## Reporting

Email security findings privately to the maintainers; do not file public
issues for unpatched vulnerabilities.

## Threat model

The CORE framework is an internal collaboration tool for discovery
engagements. It assumes:

- All authenticated users belong to a single trusted tenant configured by
  `AZURE_TENANT_ID` / `AZURE_CLIENT_ID`.
- The Microsoft Entra ID provider validates JWTs with `RS256`, audience,
  issuer, and expiry checks via `PyJWKClient`.
- Local development runs with `AUTH_PROVIDER=none`, which short-circuits
  validation and must never be enabled in production.

## Controls in place

- **Authentication.** Every HTTP route depends on `get_current_user`, which
  rejects requests without a valid bearer token. WebSocket upgrades require
  the same token via `?token=` query parameter.
- **Path traversal.** Local storage validates every collection and item ID
  against `^[a-zA-Z0-9_-]+$` before touching the filesystem.
- **Rate limiting.** `slowapi` keys per-user (falling back to IP) at
  `RATE_LIMIT` requests per window (default `100/minute`).
- **CORS.** `allow_origins` is an explicit allowlist. Wildcard `*` is
  rejected at startup when credentials are enabled.
- **WebSocket bounds.** Per-room connection cap (50) and per-message size
  cap (64 KiB) prevent resource exhaustion via collaboration sockets.
- **Audit log.** All agent runs and review/engagement mutations write to the
  `audit` collection with actor, timestamp, action, and SHA-256 truncated
  before/after hashes.

## Known limitations

These are tracked and intentionally documented here rather than silently
left in code:

- **Per-discovery authorization.** Any authenticated user can read or join
  any discovery, evidence record, or WebSocket room. The current model
  trusts the tenant boundary. Fine-grained per-discovery ACLs (owner / role
  enforcement) are roadmap.
- **Audit log enumeration.** `/api/audit/?actor=<email>` lets any
  authenticated user enumerate another user's actions. This is intentional
  for compliance review but should be restricted to an admin role once
  roles ship.
- **WebSocket token in query string.** Browsers cannot set `Authorization`
  on `new WebSocket(...)`, so the bearer token is passed via query string.
  Tokens may appear in proxy access logs that capture URLs; deploy behind a
  proxy that scrubs query strings, or terminate WebSocket auth at the edge.

## Out of scope

- Multi-tenancy isolation (the framework targets single-tenant deployments).
- Offline mode and field secrets management.
