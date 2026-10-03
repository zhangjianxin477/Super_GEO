# Proposal

## Why

Creating a workspace currently provisions only the tenant and its administrator. A new customer is then routed to an unusable empty dashboard because no brand project, market package, query cohort, provider plan, or initial collection work has been created. This breaks the product's primary GEO workflow and leaves the governed evidence, diagnosis, content, and reporting capabilities inaccessible.

## What Changes

- Replace the empty-workspace first-use path with a guided diagnostic-project onboarding flow.
- Introduce a server-side onboarding aggregate that atomically creates a workspace, brand profile, one or more market packages, a draft Query Gap dataset, selected provider collection plans, and an initial assessment run.
- Create reviewable AI-generated query suggestions without representing suggestions as collected model answers or completed evidence.
- Create controlled-manual collection tasks for domestic and international AI providers, showing the next required operator action and collection completeness.`n- Add governed problem monitoring that fixes one approved Query × provider scope, queues only operator-triggered rechecks, and preserves the evidence and audit boundary.
- Route new users from the landing-page CTA into onboarding and, after creation, into their project task view rather than an empty dashboard.
- Preserve existing tenant isolation, RBAC, audit events, evidence lineage, human approval gates, and outcome/no-guarantee disclosures.
- **BREAKING**: `POST /api/workspaces` is no longer the product's first-use creation flow; the UI will use the dedicated onboarding endpoint. The low-level route remains available for controlled administrative/API use.

## Capabilities

### New Capabilities
- `geo-diagnostic-onboarding`: A tenant-safe brand-project setup workflow that converts brand, market, objective, provider, and competitor inputs into a reviewable GEO diagnostic plan.
- `controlled-collection-plan`: Provider-specific, controlled-manual answer collection plans, monitoring recheck plans, and task states that make evidence incompleteness explicit before diagnostic conclusions are shown.

### Modified Capabilities
- None. The repository has no published baseline OpenSpec capabilities; existing change-local delta specs are not canonical main specifications.

## Impact

- Backend: `server/application.mjs`, `server/repositories/harnessRepository.mjs`, validation helpers, migrations, and seeded workflow creation will gain an onboarding aggregate, controlled monitoring plans, and read models.
- Frontend: `src/App.tsx`, `src/api.ts`, `src/useLiveWorkspace.ts`, and styling will add a Chinese diagnostic setup wizard, an actionable post-create task state, and a governed problem-monitoring screen.
- Tests: server integration and frontend interaction tests will cover atomic initialization, tenant/RBAC behavior, market isolation, provider-plan completeness, and no fabricated collection results.
- Documentation: `README.md` and the development flow will describe onboarding, controlled-manual collection, and the distinction between query suggestions and imported AI answers.
