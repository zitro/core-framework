---
title: CORE Image Release Checklist
description: Short operational checklist for publishing CORE framework images and validating deployments in template and customer instance repositories.
author: CORE Team
ms.date: 2026-05-07
ms.topic: how-to
keywords:
  - release
  - docker
  - ghcr
  - deployment
estimated_reading_time: 4
---

## Purpose

Use this checklist when shipping a new CORE framework release that is consumed as pinned GHCR images by deployment repos.

## Target Version

* Framework package version: `1.2.2`
* Image version tag: `2.2.161`
* Images:
* `ghcr.io/zitro/core-framework-backend:2.2.161`
* `ghcr.io/zitro/core-framework-frontend:2.2.161`

## Publish Steps

1. Confirm framework changes are merged in `core-framework`.
2. Build and publish backend image tag `2.2.161` to GHCR.
3. Build and publish frontend image tag `2.2.161` to GHCR.
4. Verify both image tags exist and are pullable.

## Verify Template Repo

Run from `core-discovery-template`:

```bash
docker compose pull backend frontend
docker compose up -d
docker compose ps
docker compose logs backend --tail 100
docker compose logs frontend --tail 100
```

Expected result:

* Backend is healthy and `/api/health` is reachable.
* Frontend is healthy and serves the app on port `3000`.
* Synthesis updates are visible in UI (phase label and Synthesis page enhancements).

## Verify Customer Instance Safely

Run from your customer instance repo:

```bash
docker compose pull backend frontend
docker compose up -d
docker compose ps
docker compose logs backend --tail 100
docker compose logs frontend --tail 100
```

Safety checks:

* Do not edit customer prompt overrides or seed content during rollout.
* Validate only deployment behavior and framework feature availability.
* Keep customer-specific data and identifiers out of release notes.

## Post-Release Checks

1. Open app in both repos and confirm phase navigation shows `Synthesis`.
2. Confirm Synthesis page loads starter intro-call questions when no saved set exists.
3. Confirm question generation still works end to end.
4. Record release completion with tag, timestamp, and operator.

## Rollback

If validation fails, revert both repos to previous known-good image tags in `compose.yaml` and redeploy with:

```bash
docker compose pull backend frontend
docker compose up -d
```
