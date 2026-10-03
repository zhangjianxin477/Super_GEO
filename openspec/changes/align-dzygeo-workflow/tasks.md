# Tasks

## 1. API read-model foundation

- [x] 1.1 Inventory the existing workspace, market-pack, assessment, observation, diagnosis, action, and report read paths; document which fields feed the new dashboard response and verify the inventory against server integration tests.
- [x] 1.2 Implement a tenant-authorized dashboard read endpoint for workspace and market-pack context, selected run, metrics, completeness, comparison state, diagnoses, linked actions, and evidence references; verify authorized and cross-tenant server tests pass.
- [x] 1.3 Validate dashboard query parameters for market pack, selected run, and baseline run; verify malformed or unauthorized identifiers return safe, actionable API errors.
- [x] 1.4 Add dashboard read-model tests for complete, incomplete, comparable, and non-comparable assessment states; verify metric scope and limitations are returned with each response.
- [x] 1.5 Document the dashboard endpoint and controlled-manual collection boundary in README; verify the documented request succeeds against the local API.

## 2. Development bootstrap and API client

- [x] 2.1 Add an explicit development-only sample workspace bootstrap path that creates identifiable sample records without auto-selecting them; verify it is unavailable or disabled in production configuration.
- [x] 2.2 Add a typed frontend API client with configurable API base URL, request cancellation, JSON/error normalization, and local development identity support; verify client tests cover success, validation error, authorization error, and network failure.
- [x] 2.3 Add development proxy or documented cross-origin configuration for Vite-to-API communication; verify the frontend can read the local API at ports 5173 and 8787.
- [x] 2.4 Add a frontend workspace data provider/hook that owns selected workspace, market pack, run, ready/loading/empty/error states, and retry; verify an empty state never falls back to fixture metrics.
- [x] 2.5 Document local bootstrap and API-first startup commands; verify a fresh local run can create sample data and open the live dashboard.

## 3. Diagnostic-first live dashboard

- [x] 3.1 Replace fixture-driven overview data with the dashboard read model and render scoped mention, recommendation, owned-citation, factual-accuracy, provider-completeness, and competitor visibility signals; verify rendered values match the API response.
- [x] 3.2 Implement baseline/follow-up selector behavior using server comparability data; verify comparable runs show observed deltas and mismatched runs show a non-comparable limitation instead of an uplift conclusion.
- [x] 3.3 Implement provider-completeness, observation scope, and limitation panels; verify failed, queued, imported, and unavailable states remain visible and respect metric eligibility.
- [x] 3.4 Implement linked next-action cards with priority, diagnosis, target queries, channel, workflow status, and evidence trace; verify each card navigates to an underlying governed record.
- [x] 3.5 Replace post-render DOM translation with render-time Chinese-first product copy and accessible labels for the migrated dashboard; verify keyboard labels and visible chrome are Chinese while raw query/answer evidence remains unchanged.
- [x] 3.6 Add component/integration tests for loading, empty, error, ready, incomplete, and non-comparable dashboard states; verify the frontend test suite passes.

## 4. Assessment operations and evidence drill-down

- [x] 4.1 Connect the Query Lab to live versioned cohorts, market/locale filters, priorities, intents, and expected facts; verify an approved cohort revision remains immutable when a later revision is created.
- [x] 4.2 Connect the AI Answer Observatory to live assessment runs, provider coverage, observation state, and controlled-manual import entry points; verify imported observations retain provenance and failures cannot be reported as completed answers.
- [x] 4.3 Replace the fixture answer drawer with live raw-answer, citation, claim-check, risk, provider, query, and provenance details; verify an observation's dashboard drill-down reaches its preserved source data.
- [x] 4.4 Add form and API validation feedback for controlled-manual imports; verify incomplete provider, model, query, execution state, or provenance values produce field-level guidance.
- [x] 4.5 Add route-level tests for domestic and international provider views, empty cohorts, provider failures, and evidence access denial; verify tenant boundaries hold across all assessment reads.

## 5. Governed workflow navigation and reporting

- [x] 5.1 Connect GEO Intelligence to live diagnoses, competitor context, evidence references, confidence, and no-guarantee recommendations; verify aggregate cards drill down to the linked diagnosis and observations.
- [x] 5.2 Connect Content Strategy, distribution tasks, and report preview routes to existing governed API resources; verify a user can navigate from a prioritized action to its brief, approval state, and report context without static placeholder content.
- [x] 5.3 Implement report preview states that expose scope, completeness, comparison compatibility, limitations, and source evidence; verify incomplete or non-comparable runs cannot appear as unqualified client conclusions.
- [x] 5.4 Add server and frontend tests covering evidence-to-diagnosis-to-action-to-report navigation; verify no route claims a guaranteed or caused GEO outcome.
- [x] 5.5 Update README with the live workflow map, API route references, and sample-data labeling behavior; verify the documentation matches the running application.

## 6. Integration, quality, and release verification

- [x] 6.1 Remove production reliance on `src/data/demo.ts` and the DOM-mutation localization layer after all equivalent routes use live data; verify a production build contains no fixture fallback in the live workspace path.
- [x] 6.2 Run server tests, frontend tests, release preflight, production build, and strict OpenSpec validation; verify all commands pass with Node 24.
- [ ] 6.3 Perform a browser smoke test against the explicit sample workspace: load dashboard, change market/run context, inspect evidence, reach a linked action, and open report preview; verify loading/error/empty states remain recoverable.
- [x] 6.4 Review tenant isolation, RBAC responses, audit references, accessibility labels, and no-guarantee wording across migrated routes; verify high-severity defects are resolved or explicitly documented before release.
