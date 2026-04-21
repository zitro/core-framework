---
title: "ADR-001: Provider Abstraction for External Dependencies"
description: Architecture decision record for using the provider pattern to abstract LLM, storage, and future external service integrations
author: Bryan Ortiz
ms.date: 2026-04-08
ms.topic: reference
keywords:
  - adr
  - provider pattern
  - abstraction
  - multi-tenant
  - portability
estimated_reading_time: 4
---

## Status

Accepted

## Context

The CORE Discovery Framework depends on two categories of external services: LLM inference (for question generation and transcript analysis) and data storage (for sessions and evidence). Different teams will want to use different providers based on their organization's constraints, existing infrastructure, and budget.

Without abstraction, every router and business logic function would import a specific provider directly. Switching from Ollama to Azure OpenAI would require editing every file that calls the LLM. This makes the system unusable for teams with different infrastructure requirements.

## Decision drivers

* BO-05: Create a reusable, multi-tenant architecture so other teams can adopt their own instance
* BO-06: Incrementally prove out system access; start with what we can reach, expand as trust is established
* NFR-01: Local-first operation with no mandatory cloud dependencies
* NFR-04: Data isolation between team instances

## Options considered

### Abstract base class with factory function

Define an ABC (`LLMProvider`, `StorageProvider`) with required methods. Factory functions read config and return the correct concrete implementation. Factories use `@lru_cache` for singleton semantics.

Trade-offs: Simple, no framework dependency, easy to test. Does not support runtime provider switching, but that is not a requirement.

### FastAPI dependency injection

Use `Depends()` to inject providers into route handlers. Providers registered in a DI container.

Trade-offs: Works with FastAPI's existing DI. Adds coupling to the web framework; makes the provider layer non-portable if we ever replace FastAPI.

### Plugin/registry pattern

Providers register themselves via entry points or a plugin registry. Discovery at startup.

Trade-offs: Maximum decoupling. Overkill for 3-4 providers; adds complexity that is not justified at this scale.

## Decision

Use abstract base classes with factory functions cached via `@lru_cache(maxsize=1)`.

The factory reads `settings.llm_provider` or `settings.storage_provider`, matches a known string, and returns the corresponding concrete implementation. The return type annotation is the abstract base class, so routers only ever reference the interface.

This was chosen because:

* It is the simplest approach that achieves full provider portability
* It has no dependency on FastAPI or any web framework
* `@lru_cache` gives singleton semantics without a DI container
* New providers are added by creating one file and adding one `elif` branch

## Consequences

### Positive

* Any team can run CORE with their preferred LLM and storage by changing two environment variables
* Routers and business logic are completely decoupled from provider implementation details
* Testing is straightforward: mock the factory function's return value
* Adding Cosmos DB, Anthropic, or Mistral requires zero changes to existing code

### Negative

* Provider switching requires a restart (lru_cache is per-process)
* The factory function has a growing `if/elif` chain; this is acceptable for fewer than ten providers
* Abstract base classes add a small amount of boilerplate per provider

### Reusability impact

This is the primary enabler for BO-05. Without this pattern, each team would need to fork and modify the codebase. With it, teams configure via `.env` and deploy.

## References

* [BRD FR-05: Provider portability](../BRD/core-discovery-brd.md)
* [TRD: Provider abstraction pattern](../TRD/core-discovery-trd.md)
