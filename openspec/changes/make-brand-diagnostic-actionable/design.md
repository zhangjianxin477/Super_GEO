# Design

## Context

The diagnostic foundation persists cases, facts, Query Scope, collection plans, baselines, and activities. Its creation wizard exposes free-text operational fields before the product can show a concrete result. Provider configuration exists as an administrative capability but is not expressed as an actionable business-side readiness state.

## Goals / Non-Goals

**Goals:**
- Store a structured diagnostic brief and derive an inspectable launch plan from it.
- Replace comma-delimited business input with predefined market, audience, objective, and platform selections.
- Make no unsupported model-execution claim; indicate connector readiness and create only permitted work.
- Keep the existing diagnostic case, fact, scope, plan, and baseline data compatible.

**Non-Goals:**
- This change does not automate consumer model websites, bypass access controls, or scrape protected pages.
- This change does not build the future provider adapter dispatcher or a broad crawler; it only creates an honest launch readiness contract.

## Decisions

### Persist a separate diagnostic brief
A separate additive table holds business-facing choices. This avoids overloading the original case with mutable planning fields and permits an immutable launch-plan snapshot. A case-column-only design was rejected because the brief must evolve independently and show version history.

### Compute launch-plan counts server-side
The server derives work counts from structured selections: each selected intent creates a Query category, each selected market determines platform/channel recommendations, and each selected competitor creates a research work item. Client-side estimates alone were rejected because downstream data must remain auditable.

### Use market packages and execution preference
Market packages map the user-visible market choice to a locale, recommended provider set, and content channels. The selected execution preference remains distinct from connector configuration. The brief can request AI assistance, but server readiness remains blocked until an approved connector can satisfy it.

### Keep launch output honest
The system will create a `ready`, `manual-ready`, or `configuration-required` launch state. It will not create fake LLM output. Future provider-adapter work can consume the persisted brief and launch snapshot without changing the business workflow.

## Risks / Trade-offs

- [A configured credential may not mean a compatible adapter exists] → expose this as a connector-readiness state, never as a completed run.
- [Predefined market packages may not cover all customers] → allow a structured custom market entry while retaining required locale and provider selection.
- [Estimated Query counts are not generated Query rows] → label estimates as planning output and retain final approval in Query Research.

## Migration Plan

1. Add additive tables for brief and launch-plan versions.
2. Backfill existing diagnostics lazily as `legacy-manual` when opened; never infer AI analysis.
3. Deploy endpoint and UI changes behind the current diagnostic routes.
4. Roll back by leaving the additive tables unused; old case records and baseline behavior remain valid.
