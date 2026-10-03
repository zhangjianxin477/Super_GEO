# Proposal

## Why

The current GEO Growth Harness backend already exposes governed workspace, query, assessment, observation, diagnosis, content, distribution, and reporting capabilities, but the frontend renders a static CoreNote demonstration. Enterprise users therefore cannot operate the product on live API data or use it as a diagnostic-first GEO workspace comparable in workflow depth to mature GEO platforms.

This change aligns the product to a diagnostic-first GEO operating flow: configure a brand project, collect or import AI-answer evidence, inspect brand and competitor visibility, turn verified gaps into approved actions, and verify later observations. It replaces the demo-only frontend path with tenant-scoped API integration while retaining evidence governance and no-guarantee reporting.

## What Changes

- Replace the static demo-data application path with a tenant-scoped API client, loading, empty, error, and retry states.
- Add a diagnostic-first GEO dashboard that foregrounds overall visibility, mention, recommendation, citation, accuracy, completeness, competitor gap, current risks, and prioritized actions.
- Add a task-oriented assessment workspace for query cohorts, domestic and international model coverage, manual evidence import, run status, and raw-answer drill-down.
- Add brand, competitor, source, diagnosis, and action views backed by the existing server resources rather than fixture data.
- Add client-report preview and operational navigation from evidence to diagnosis, content brief, distribution task, and compatible follow-up measurement.
- Preserve multi-tenant isolation, role controls, auditability, evidence/version traceability, explicit collection completeness, and no-guarantee language.
- **BREAKING**: the single hard-coded CoreNote dashboard is replaced by a workspace-aware application flow; a local development bootstrap may remain only as an explicit development fixture.

## Capabilities

### New Capabilities
- `live-geo-workspace`: Tenant-scoped frontend data access, workspace selection, operational loading/error states, and a live API-backed GEO navigation shell.
- `diagnostic-first-geo-dashboard`: Enterprise GEO dashboard showing actionable visibility, source, competitor, provider-completeness, and recommendation views with evidence drill-down.
- `assessment-operations-console`: Query-cohort, model-provider, controlled-manual import, assessment-run, and answer-evidence operations for domestic and international GEO monitoring.

### Modified Capabilities
- None. The repository has no published baseline OpenSpec capability specs; this change introduces the first reusable requirements for the live product interface.

## Impact

- Frontend: `src/App.tsx` will be decomposed from a fixture-driven screen into API-backed routes/views, data hooks, and reusable diagnostic components.
- Frontend data: `src/data/demo.ts` will no longer be the production data source; development fixtures will be isolated behind an explicit bootstrap path.
- Backend: `server/application.mjs` and `server/repositories/harnessRepository.mjs` may gain dashboard/read-model endpoints and safe development bootstrap support where existing APIs cannot provide the required aggregate.
- Tests: frontend API/view tests and server integration tests will cover tenant scoping, error handling, governed workflow transitions, and diagnostic aggregate correctness.
- Documentation: README and OpenSpec documentation will describe the API-first local run path and controlled-manual MVP collection boundary.
