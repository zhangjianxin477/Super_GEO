# Design

## Context

See `proposal.md` for motivation and the new capability specs for behavior. The repository already has a Node HTTP API, SQL-backed repository, tenant-aware authorization, governed GEO workflow resources, and a Vite React application. The current React application imports `src/data/demo.ts` directly, so it bypasses the available API and makes operational states indistinguishable from fixtures.

The target user experience follows a mature GEO product's diagnostic-first operating flow, while preserving this product's distinctive evidence, approval, audit, and no-guarantee controls. The controlled-manual observation route remains the formal MVP collection mechanism; no automated interaction with third-party AI platforms is introduced by this change.

## Goals / Non-Goals

**Goals:**

- Make the browser application render tenant-scoped live data from the local API.
- Establish a stable dashboard read model for the summary and drill-down information users need most often.
- Make assessment operations understandable and actionable across China and global market packs.
- Preserve evidence provenance, source links, completeness, comparability, and authorization information at every navigation layer.
- Deliver a Chinese-first enterprise experience with locale codes, provider names, source URLs, and stored answer content preserved where appropriate.

**Non-Goals:**

- Pixel-copying or reproducing another vendor's proprietary UI, code, content, reports, prompts, or brand assets.
- Running automated browser agents against AI providers, scraping restricted sites, or bypassing provider/platform access controls.
- Claiming causal uplift, guaranteed citations, AI recommendation, ranking, traffic, lead, or revenue outcomes.
- Replacing the governed backend model or completing the remaining CoreNote real-world pilot evidence tasks.

## Decisions

### 1. Add a dashboard-oriented API read model

Add a tenant-scoped `GET /api/workspaces/{workspaceId}/market-packs/{marketPackId}/dashboard` endpoint, with optional `assessmentRunId` and `baselineRunId` parameters. It will compose existing governed records into a single response containing: workspace identity, market pack, selected run, eligible metrics, completeness, comparison status, provider coverage, diagnoses, linked actions, and stable references for evidence drill-down.

This avoids forcing the browser to issue a fragile fan-out of low-level requests and ensures dashboard aggregates use the same authorization and metric rules as reporting. Existing resource endpoints remain the source for detailed editing and record inspection.

**Alternative considered:** fetch every existing resource independently from the browser. Rejected because it multiplies partial-failure states, duplicates server-side aggregation rules, and makes authorization/completeness presentation inconsistent.

### 2. Introduce an API client and application data boundary

Create a small browser API client configured through `VITE_API_BASE_URL` (defaulting to same-origin in production and local API in development). It will centralize request IDs, JSON validation, error normalization, development identity headers, and abortable requests.

Replace direct `demoWorkspace` reads with an application data hook/context that owns selected workspace, market pack, run context, ready/loading/empty/error state, and retry. Keep the visual components data-driven and free of fixture imports.

**Alternative considered:** retain the fixture import and merge API responses into it. Rejected because it masks missing records and encourages demo values to be presented as live data.

### 3. Use explicit development bootstrap instead of implicit production fixtures

Provide a documented, explicit development-only bootstrap command or endpoint that creates a sample tenant/workspace and marks it `sampleData: true`. The frontend will show a non-production sample-data badge only when that flag is returned. It will not silently substitute the sample when API data is unavailable.

**Alternative considered:** automatically seed CoreNote on app load. Rejected because it risks confusing demo evidence with customer evidence and violates the product's evidence-governance posture.

### 4. Organize UI around diagnostic-first routes and evidence drill-down

Retain the left-side enterprise navigation but make the initial route a diagnostic overview. The route hierarchy will be: Overview; Brand and sources; Query cohorts; Assessment operations; GEO intelligence; Content strategy; Client reports; Extensions and audit. Each aggregate link will navigate to an evidence-bearing detail view rather than a static toast.

The dashboard will display: scoped period/run, metric definitions and values, provider completeness, comparability, competitor gaps, prioritized actions, and explicit limitation language. A raw-answer drawer/detail route will show the original answer and derived signals, citations, claim checks, and provenance.

**Alternative considered:** treat the dashboard as a purely visual redesign. Rejected because the immediate product risk is the absent data connection, not visual polish alone.

### 5. Preserve Chinese-first copy through source localization, not DOM mutation

Move visible UI copy into typed Chinese-first labels or a lightweight localization dictionary used during component render. Remove the post-render DOM mutation approach as the API-backed redesign lands, so React ownership, accessibility labels, and testability remain deterministic.

**Alternative considered:** keep translating rendered DOM nodes. Rejected because it can obscure missing translations, complicate React updates, and makes language behavior harder to test.

### 6. Phase delivery around live read paths before write workflows

Phase 1 implements bootstrap, client wiring, workspace context, dashboard read model, and evidence drill-down. Phase 2 connects query/assessment operations and controlled-manual imports. Phase 3 connects diagnosis-to-brief, report previews, and navigation from actions to governed artifacts.

This sequencing makes the product demonstrably real before adding broad editing surfaces and keeps the MVP's human-controlled collection boundary intact.

## Risks / Trade-offs

- [The local API and frontend run on separate ports in development] → Configure a Vite development proxy or explicit API base URL, document the required environment variable, and test both same-origin and separate-origin paths.
- [Existing resources may not expose every dashboard field as a single response] → Add the read model only for aggregates; retain existing detailed resources as canonical records.
- [A real empty tenant can look like a broken product] → Design distinct empty-state onboarding that guides the user to configure a workspace rather than showing fixture values.
- [Stored observation content can be multilingual] → Translate product chrome and preserve raw queries/answers in their source language for audit integrity.
- [Dashboard metrics can be over-interpreted] → Always expose scope, completeness, comparability, and no-guarantee limitations alongside the values.
- [Local bootstrap data can leak into a real demonstration] → Mark it explicitly, gate it to development configuration, and never select it automatically for authenticated production users.

## Migration Plan

1. Add API contracts and server integration tests without changing the current fixture UI.
2. Add development bootstrap and document the explicit local setup flow.
3. Add the frontend client/context and replace the overview route with live API rendering.
4. Migrate remaining screens one route at a time, deleting fixture dependencies only after each equivalent live path is verified.
5. Remove the DOM-based localization layer after render-time Chinese labels cover the migrated screens.
6. Run server tests, frontend tests, release preflight, production build, and a local browser smoke test against the seeded sample workspace.

Rollback consists of deploying the prior frontend build; server read-model endpoints are additive and do not alter existing workflow records.

## Open Questions

- The product will begin with an explicit local sample bootstrap. Production tenant provisioning and external identity-provider integration remain future work and do not change the API-first UI approach.
