# Proposal

## Why

The current first screen calls a project-registration workflow a “brand diagnostic.” It asks users for setup text without producing a real AI visibility result, blurs the line between configuration and analysis, and lets users mistake API or placeholder data for actual model-surface observations. A GEO product must first establish an auditable baseline from real platform interactions, then diagnose evidence-backed gaps and prescribe content work.

## What Changes

- **BREAKING (information architecture):** Reframe “Brand Diagnostic” as Project settings / Product profile and make the first numbered GEO step “Core Queries & first baseline.”
- Introduce persisted Seed Query and Test Run records that turn a product profile into 5–20 reviewable, brand-neutral core questions for a selected market.
- Add controlled-manual, real-surface test runs that create one assignable task for every Query × Platform × Market combination; they record fresh-session/search-environment requirements without automating third-party model websites.
- Add a governed evidence-import flow for raw answer text, citations, source links, capture metadata, reviewer state, failure reason, and audit events.
- Surface useful next actions instead of internal setup flags, and add a baseline-ready workflow state for subsequent Visibility & Citation Baseline and GEO Diagnostic modules.
- Reorder navigation around the actual GEO delivery sequence and isolate ongoing monitoring / Harness administration from the numbered project workflow.

## Capabilities

### New Capabilities
- `real-surface-baseline-testing`: Generate approved Seed Queries, create compliant real-platform Test Runs, coordinate controlled human collection, and preserve evidence for T0 measurement.
- `geo-workflow-navigation`: Present a task-oriented, phase-correct enterprise GEO workflow and distinguish project setup from evidence-backed diagnostic work.

### Modified Capabilities
- None.

## Impact

- Frontend: application navigation, Product Profile/diagnostic screens, Query Lab, multi-platform testing workspace, API client, and responsive operational UI styles.
- Backend: additive SQLite migration, repository serialization, deterministic seed-query planning, test-run/task/evidence endpoints, derived baseline readiness, and audit records.
- Tests: server endpoint and repository behavior plus component-level empty, active, error, and complete workflow states.
- Integrations: controlled human entry is the MVP formal path; model APIs and future browser-assistance connectors must remain explicitly labelled as separate surfaces.

## Amendment — configurable, model-backed Query generation

- Replace the fixed 5/10/15/20-only Seed Query control with a custom target count (1–200). The first-baseline UI will keep 5–20 as a recommended range, but must not block a valid larger research set. Review results render ten items per page rather than an unbounded list.
- Add two explicit Query intake paths: **AI generation** and **manual creation**. AI generation takes product profile context, operator-entered keywords, selected intent categories, a saved configurable prompt, and a chosen approved model connection. Manual items join the same review and Test Run lifecycle with manual provenance.
- Add a workspace-level **Model & API connections** experience. It must expose only supported, server-side configured connections and never return API keys to the browser. The initial executable connector is OpenAI-compatible Chat Completions through an official API or enterprise gateway; unavailable connections must show a clear setup state instead of silently falling back to a template.
- Version the Query-generation prompt and preserve invocation provenance: template/version, rendered prompt, inputs, configured provider/model, outcome, timestamps and non-secret error information. Template generation remains an explicit labelled fallback only when the operator elects it.
