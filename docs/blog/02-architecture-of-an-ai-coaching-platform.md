---
title: "Building an AI Coaching Platform That Runs Anywhere"
description: Part 2 of a three-part series on CORE Discovery. A technical deep-dive into the provider abstraction pattern, AI agent architecture, and design decisions behind a portable full-stack AI application.
author: Bryan Ortiz
ms.date: 2026-04-09
ms.topic: concept
keywords:
  - provider abstraction
  - AI agents
  - FastAPI
  - Next.js
  - system architecture
  - Cosmos DB
  - Ollama
estimated_reading_time: 4
---

## The constraint that shaped everything

CORE had one non-negotiable requirement: it must run on a laptop with zero cloud accounts and also scale to Azure when a team is ready. No code changes. No forks. Flip an environment variable and go.

This constraint drove every technical decision in the project. The result is a provider abstraction pattern that makes the entire backend infrastructure-agnostic and a set of pluggable AI agents that work the same way regardless of which LLM is underneath.

## Two tiers, one purpose

CORE is a Next.js 16 frontend talking to a FastAPI backend over REST and WebSocket. Two processes, clear separation. The frontend handles UI, routing, and client-side state. The backend handles business logic, LLM orchestration, and data persistence.

A single Next.js app with API routes was considered. I chose a separate Python backend because the LLM ecosystem lives in Python. Prompt engineering, transcript analysis, and document parsing all iterate faster with Python libraries. Separate deployment also means a team that wants a different UI can replace the frontend without touching the backend.

## Provider abstraction: the core pattern

Every external dependency defines an abstract base class. Concrete implementations inherit from it. A factory function reads configuration and returns the right one.

```text
providers/
  llm/       → Azure OpenAI, OpenAI direct, Ollama
  storage/   → Cosmos DB, local JSON files
  blob/      → Azure Blob Storage, local filesystem
  speech/    → Azure Speech Services
  auth/      → Azure Entra ID, no-auth
```

Routers call the abstract interface. They never import a concrete provider. The factory uses `@lru_cache(maxsize=1)` to guarantee a single provider instance per process, avoiding new HTTP clients per request.

Adding a new provider means creating one file and adding one branch to the factory. No router changes. No frontend changes. This is how a team starts with Ollama on a developer laptop and moves to Azure OpenAI six months later without touching a single line of business logic.

## Five AI agents, one registry

The backend includes five specialized agents that power the AI capabilities across the CORE phases:

**Discovery Coach** adapts its entire personality to the current phase. In Capture, it generates listening and probing questions ("What is the workflow you are trying to improve?"). In Orient, it shifts to sensemaking ("What pattern connects these three observations?"). In Refine, it stress-tests assumptions ("What evidence would disprove this hypothesis?"). Same agent, four different prompt strategies.

**Transcript Analyst** takes raw meeting notes and extracts structured output: key insights with confidence levels (validated, assumed, unknown, conflicting), evidence items tagged by phase, sentiment indicators, and recurring themes. One paste operation produces a structured analysis that would take thirty minutes to do by hand.

**Problem Analyst** synthesizes accumulated evidence into structured problem statements using the WHO/WHAT/WHY/IMPACT format. It does not just summarize; it identifies which parts of the problem have strong evidence and which rest on assumptions.

**Use Case Analyst** generates persona-grounded use cases from the evidence. Each use case includes the persona, their goal, the business value, and measurable success metrics.

**Solution Architect** proposes technology blueprints with specific service recommendations and rationale. It maps from validated use cases to architecture patterns, not the reverse. The architecture follows from the problem, not from what is trendy.

All five agents share a common base class (`AgentMeta` for identity, `AgentResult` for output) and register themselves in a central registry. This means the system knows what agents are available, what phase each one targets, and what expertise each brings to a session.

## Context flows forward

The most important technical detail is how data moves between phases. When a practitioner runs transcript analysis in Capture, the extracted evidence flows into the Evidence Board. When they open Orient, that evidence pre-populates the context. The problem statement built in Orient automatically loads in Refine. Validated assumptions from Refine appear as context in Execute.

This is not magic. The backend gathers context dynamically. When an AI agent runs, the context gathering utility pulls in the discovery session, its evidence, and (if configured) content from engagement repos and local documentation. Each agent receives the full accumulated context of the session, not a blank prompt.

## Engagement repo integration as a design case study

One example of how the architecture stays modular: engagement repo integration. An engagement repo is a Git-backed markdown knowledge base for a project or customer. CORE integrates with it bidirectionally, but the integration is entirely optional.

On ingest, a utility function scans a repo path, auto-detects the content directory, and parses YAML frontmatter from markdown files. It returns structured metadata grouped by type, with labels derived dynamically from the frontmatter `type` field. Size caps (200 KB per file, 500 KB total) prevent prompt overflow.

On export, CORE renders its deliverables (problem statements, use cases, blueprints) as markdown with `type: decision` frontmatter. Drop the files into the engagement repo and they become part of the project record.

Neither of these features touches the core routing or agent logic. The repo scanner is a utility. The exporter is a router. The context gatherer calls the scanner when the discovery session has an engagement repo path set. Remove the engagement feature and nothing else changes. That is the provider pattern applied at the feature level, not just the infrastructure level.

## What Pydantic buys you

Every data structure in CORE is a Pydantic `BaseModel`. This is runtime enforcement, not just type hints. API endpoints receive typed models; Pydantic rejects malformed input before business logic runs. LLM output parses into typed models; unexpected JSON structure is caught at the boundary, not in the frontend.

Typed update models prevent mass assignment. `DiscoveryUpdate` does not accept `id`, `created_at`, or other system fields. The OpenAPI schema self-documents which fields are updateable. These are not abstract security concerns; they are the kind of thing that causes real bugs when an LLM returns a slightly different JSON shape than expected.

## What is next

In [part three](03-from-zero-to-running-in-ten-minutes.md), I walk through setting up CORE from scratch: local-only mode with Ollama, Azure-backed mode with Cosmos DB and OpenAI, and running your first discovery session through all four phases.

If you missed it, [part one](01-why-discovery-is-broken.md) covers the concept: why discovery needs structure, what the four phases are, and who CORE is built for.
