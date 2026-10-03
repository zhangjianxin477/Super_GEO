# Proposal

## Why

The current Brand Diagnostic flow stores project-scoping text but does not reliably turn it into operational GEO work. Users cannot tell which input affects query research, provider coverage, evidence collection, or AI-assisted analysis, and technical collection controls are exposed before a meaningful diagnostic exists.

## What Changes

- Replace the generic five-step registration form with a guided diagnostic launcher built around a selected baseline goal, market packs, customer intents, owned evidence, competitors, and an execution choice.
- Add a persisted, versioned diagnostic brief that records how each business-side selection controls downstream query, evidence, platform-test, and competitor-research work.
- Add server-generated launch plans that describe concrete downstream work counts, required operator actions, and whether an AI-assisted analysis can start through an approved connector.
- Move provider, credential, retry, and collection-policy concerns out of the business creation flow; surface only an execution-readiness summary and a clear configuration path.
- Preserve controlled manual collection as the formal fallback and never imply an LLM call or third-party platform automation when no approved connection is configured.

## Capabilities

### New Capabilities
- `actionable-brand-diagnostic`: Turn structured brand-diagnostic decisions into traceable downstream GEO work, launch readiness, and operator-visible outputs.

### Modified Capabilities
- None.

## Impact

- Frontend: `src/BrandDiagnostics.tsx`, `src/api.ts`, `src/App.tsx`, and `src/styles.css`.
- Backend: SQLite migration, diagnostic repository serializers and HTTP endpoints in `server/application.mjs`.
- Tests: brand-diagnostic API and UI tests.
- Existing diagnostic projects remain readable; new fields are additive and legacy projects receive an explicit legacy/manual state rather than inferred AI execution.
