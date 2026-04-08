---
title: CORE Discovery Framework BRD
description: Business requirements document for the CORE Discovery Framework, an AI-assisted product discovery coaching system
author: Bryan Ortiz
ms.date: 2026-04-08
ms.topic: overview
keywords:
  - core framework
  - discovery
  - product coaching
  - customer questions
  - ai-assisted
estimated_reading_time: 10
---

## Business context and background

Product teams need to ask the right questions to understand customer problems before building solutions. Today, the discovery process depends on individual skill: experienced product managers know what to ask, while newer team members struggle with question quality, coverage gaps, and cognitive bias.

This inconsistency has real costs. Poor discovery questions lead to misunderstood requirements, wasted development cycles, and features that miss the mark. There is no structured system that coaches teams through discovery in a repeatable, improvable way.

The CORE Discovery Framework addresses this gap. It provides an AI-assisted system that guides practitioners through four phases of product discovery: Capture raw context, Orient around themes, Refine assumptions into testable hypotheses, and Execute with prioritized action plans.

## Problem statement and business drivers

Teams lack a structured, repeatable methodology for generating high-quality customer discovery questions. The current process is ad-hoc and depends on tribal knowledge.

Primary business drivers:

* Reduce ramp-up time for new product managers conducting customer discovery
* Improve question quality and coverage across customer interviews
* Create a traceable evidence chain from raw observations to prioritized decisions
* Automate the tedious parts of transcript analysis and theme extraction
* Build institutional knowledge that compounds across discovery sessions

### Alignment to organizational objectives

| Org Objective | How CORE Serves It |
|---|---|
| BO-01: Reduce admin burden on ICs and managers | Automates transcript analysis, theme extraction, and question generation that would otherwise be manual |
| BO-03: Improve accuracy and timeliness of reporting | Creates structured evidence trails with timestamps, confidence scores, and phase progression |
| BO-04: Single conversational interface for workflows | Provides one interface where practitioners interact with all four phases of discovery |
| BO-05: Reusable multi-tenant architecture | Provider abstraction pattern allows any team to deploy their own instance with their own LLM and storage |
| BO-06: Incremental system access expansion | Starts with local-only data (no external dependencies), adds Azure/cloud integrations as trust is established |

## Business objectives and success metrics

### Objectives

* Enable any practitioner to generate context-appropriate discovery questions across all four CORE phases
* Capture and analyze customer transcripts to extract insights, evidence, and themes automatically
* Track discovery progress with confidence scoring so teams know when they have enough evidence to act
* Make the entire system portable so other teams adopt it without rewriting infrastructure

### Success metrics

| Metric | Target | Why this matters |
|---|---|---|
| Time from raw notes to actionable questions | Under 5 minutes per session | Discovery coaching value comes from speed; delays mean context is lost |
| Question relevance score (user rating) | 4 out of 5 average | Generated questions must be useful, not just plentiful |
| Discovery phase completion rate | 80% of sessions reach Refine | If users drop off before Refine, the framework is not guiding effectively |
| Reuse across teams | 2+ teams running their own instance within 6 months | Validates the multi-tenant, provider-abstraction investment |

## Stakeholders and roles

* Product managers: primary users who conduct discovery sessions
* Engineering leads: contribute technical context and review evidence trails
* Team managers: review discovery outcomes and track team capability growth
* Platform engineers: deploy and maintain team-specific instances
* Practitioners of any role: anyone conducting customer conversations

## Scope

### In scope

* Four-phase guided discovery workflow (Capture, Orient, Refine, Execute)
* AI-generated questions tailored to each phase's purpose
* Transcript upload and automated insight extraction
* Evidence board for linking observations to themes and hypotheses
* Discovery session management (create, progress, review)
* Provider abstraction for LLM, storage, and future auth/speech integrations
* Local-first operation with no mandatory cloud dependencies
* Docker-based deployment for isolated team instances

### Out of scope

* Real-time meeting transcription (users paste or upload transcripts)
* CRM or project management tool integrations in initial release
* Automated scheduling or interview coordination
* Multi-user real-time collaboration on a single discovery session
* Production-grade auth and RBAC in initial release

## The CORE framework: why four phases

Each phase exists because discovery has distinct cognitive modes. Combining them loses information.

### Capture: why separate raw collection

Discovery starts with unstructured, messy input: meeting notes, transcript snippets, gut feelings. Capture exists to lower the barrier to entry. No judgment, no structure required. Users dump everything in.

Why this matters for business: If the tool demands structured input up front, practitioners skip it. They go straight to building. Capture removes that friction.

### Orient: why a separate analysis step

Raw data needs interpretation. Orient takes what was captured and identifies themes, patterns, and gaps. The AI acts as a second pair of eyes that catches what the practitioner might miss.

Why this matters for business: Individual practitioners have blind spots shaped by their experience. Orient systematically surfaces what human attention might skip. It also creates the structured output that Refine needs.

### Refine: why test before acting

Orient produces themes. Refine challenges them. Are these real patterns or confirmation bias? What assumptions are hiding underneath? Refine generates questions that stress-test the themes before teams commit resources.

Why this matters for business: This is where the framework saves the most money. One well-targeted follow-up question in Refine can prevent a quarter of wasted engineering work.

### Execute: why a separate action phase

Once assumptions are tested, Execute translates validated insights into prioritized actions with owners and deadlines. It produces the output that goes into sprint planning.

Why this matters for business: Discovery without action is just research. Execute bridges the gap between "we learned something" and "here is what we are building next."

## Functional requirements

### FR-01: Discovery session lifecycle

The system must support creating, viewing, updating, and progressing discovery sessions.

* Users create a session with a name, product area, and initial context
* Sessions track current phase, mode, confidence level, and progress metrics
* Sessions can be updated with new context as discovery evolves
* Each session maintains a complete history of inputs and AI-generated outputs

Why: Without session management, there is no continuity between discovery activities. Sessions are the unit of work.

### FR-02: Phase-aware question generation

The system must generate questions appropriate to the current discovery phase.

* Capture phase: open-ended exploratory questions to surface unknowns
* Orient phase: analytical questions to identify patterns and themes
* Refine phase: precision questions to test assumptions and fill evidence gaps
* Execute phase: prioritization questions to drive actionable outcomes
* Users specify the number of questions to generate (1 to 20)

Why: Generic questions are not useful. A Capture question ("Tell me about your workflow") is wrong for Refine (where you need "What evidence would disprove this assumption?"). Phase-awareness is the core differentiator.

### FR-03: Transcript analysis

The system must analyze uploaded transcript text and extract structured insights.

* Accept plain-text transcripts up to 50,000 characters
* Extract insights with confidence scores and phase classification
* Extract evidence items for the evidence board
* Map extracted items to their source context

Why: Manual transcript analysis is the biggest time sink in discovery. This is the primary automation value.

### FR-04: Evidence management

The system must maintain a structured evidence board linked to discovery sessions.

* Evidence items capture observations, quotes, and data points
* Each piece of evidence is associated with a discovery session and source
* Evidence can be created, viewed, updated, and searched
* Evidence feeds into the Orient and Refine phases as input

Why: Evidence without traceability is anecdote. The evidence board creates the audit trail that justifies decisions.

### FR-05: Provider portability

The system must function with different LLM and storage backends without code changes.

* Configuration-driven provider selection (environment variables)
* Local operation with Ollama for LLM and JSON files for storage
* Azure OpenAI and Cosmos DB as cloud-scale alternatives
* OpenAI direct API as a third LLM option
* Adding a new provider requires implementing a defined interface, not modifying routers

Why: This directly serves BO-05 (reusable multi-tenant architecture) and BO-06 (incremental expansion). A team starts locally, proves value, then moves to Azure when ready. No rewrite required.

## Non-functional requirements

### NFR-01: Local-first operation

The system must run entirely on a developer laptop with no external service accounts.

Why: Discovery happens in the moment. If the tool requires Azure credentials or API keys to even start, adoption dies. Ollama and local JSON files provide zero-config startup.

### NFR-02: Response time

AI-generated questions and transcript analysis must return results within 30 seconds for local LLM and 15 seconds for cloud LLM.

Why: Discovery is a flow activity. Long waits break the practitioner's train of thought.

### NFR-03: Resilience to LLM failures

The system must handle LLM unavailability gracefully with clear error messages.

Why: LLM services are unreliable by nature. The app must not crash; it must tell the user what happened and what to try.

### NFR-04: Data isolation

Each team instance must store data independently with no shared state between instances.

Why: Serves BO-05 (multi-tenant). Customer discovery data is sensitive; one team must not see another's insights.

### NFR-05: Input validation and security

All user input must be validated at the API boundary before reaching business logic.

Why: Even for internal tools, input validation prevents data corruption and injection. This is a baseline quality standard.

### NFR-06: Deployment portability

The system must deploy via Docker containers with no host-specific dependencies.

Why: Teams run different operating systems. Docker normalizes the environment and makes "works on my machine" irrelevant.

## UX requirements

* Discovery dashboard shows all sessions with phase status at a glance
* Each phase page provides clear guidance on what this phase is for and what to do
* Question generation results display immediately without page navigation
* Transcript analysis shows extracted insights inline with confidence indicators
* Evidence board is accessible from any phase for cross-referencing

## Validation and acceptance criteria

A release meets acceptance when all criteria pass:

* All four CORE phases render and accept user input
* Question generation returns phase-appropriate results for each phase
* Transcript analysis extracts at least one insight and one evidence item from a sample transcript
* Evidence items persist and are retrievable by session
* The system runs locally with Ollama and JSON storage with no cloud accounts
* Docker compose brings up both frontend and backend in a single command
* Frontend build produces zero TypeScript errors
* Backend starts with zero import errors

## Reusability design principles

The following principles guide every architectural decision to ensure CORE is not a one-off tool but a pattern other teams can adopt.

* Provider interfaces define what, not how: routers call abstract interfaces, not concrete implementations
* Configuration over code: switching from local to cloud is a `.env` change, not a code change
* Phase structure is data-driven: the four-phase model lives in the data layer, not hardcoded in routes
* Frontend and backend are independently deployable: different teams may want different UIs
* Domain logic is framework-agnostic: the CORE model (phases, sessions, evidence) does not depend on FastAPI, Next.js, or any specific library

## Dependencies

* Frontend: Next.js, React, Tailwind CSS v4, shadcn/ui base-nova components
* Backend: Python 3.11+, FastAPI, Pydantic, uvicorn
* Local LLM: Ollama with any compatible model (default: llama3.1)
* Containerization: Docker and Docker Compose

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LLM output quality varies by model | Questions may be generic or off-target | Prompt engineering per phase; model selection guidance in docs |
| Low adoption if setup is complex | Teams skip it for ad-hoc methods | Zero-config local mode; single docker-compose command |
| Discovery data sensitivity concerns | Teams avoid capturing real customer feedback | Local-first storage; no data leaves the machine unless user configures cloud |
| Phase model may not fit every team's workflow | Rigid phases frustrate experienced practitioners | Phases guide but do not gate; users can skip or revisit any phase |
