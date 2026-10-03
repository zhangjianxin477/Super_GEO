# Tasks

## 1. Server-owned diagnostic initialization

- [x] 1.1 Define and validate the onboarding request, supported market/locale/provider catalog, objective, brand, competitor, and administrator inputs; verify invalid payload tests return field-level errors without creating records.
- [x] 1.2 Add a transactional repository onboarding aggregate that creates the workspace/project context, draft evidence context, draft Query Gap dataset, market package, provider configuration, provider collection plans, planned assessment run, and audit events; verify a failure rolls back every created record.
- [x] 1.3 Add `POST /api/workspaces/onboard` and its authenticated existing-workspace recovery variant; verify authorized administrators receive the aggregated setup response and unauthorized or cross-tenant requests are rejected.
- [x] 1.4 Add server integration tests for China, United States, and dual-market initialization, provider scoping, audit entries, market separation, and no fabricated imported answers or baseline conclusions.
- [x] 1.5 Document the onboarding API, controlled-manual collection boundary, required approval gates, and legacy workspace recovery route in `README.md`; verify documented local API examples work against the development server.

## 2. Controlled-manual collection workflow

- [x] 2.1 Add persistent collection-plan/task records or a compatible repository read model linked to market package, provider, draft dataset, and planned run; verify planned, collecting, imported, blocked, and failed states are representable.
- [x] 2.2 Connect controlled-manual evidence import to collection-plan coverage and enforce provenance requirements; verify invalid imports are rejected and valid imports update only the matching tenant, market, provider, and query task.
- [x] 2.3 Add a setup read endpoint or expand the onboarding/dashboard read model with draft/approval state, collection coverage, limitations, and deterministic next action; verify incomplete collection cannot appear as a completed diagnostic report.
- [x] 2.4 Add server tests for partial provider/query coverage, status transitions, explicit limitations, and tenant isolation; verify `npm run test:server` passes.
- [x] 2.5 Add a tenant-scoped monitoring plan and operator-triggered manual recheck queue; verify provider, market, query, paused-state, and audit boundaries are enforced.

## 3. Chinese onboarding and project setup experience

- [x] 3.1 Add typed client APIs and session handling for onboarding, setup state, provider/task data, validation errors, and recovery of legacy empty workspaces; verify client API tests cover successful and failed responses.
- [x] 3.2 Replace the landing-page “create empty workspace” path with an accessible Chinese brand-diagnostic wizard for brand/audience, market/providers/objective/competitors, and final review; verify keyboard operation, inline validation, loading, retry, and responsive layouts.
- [x] 3.3 Add a post-create diagnostic setup view that shows draft Query Gap, approval gates, provider collection tasks, coverage, limitations, and the next required action; verify it never renders draft/planned data as actual AI-answer results.
- [x] 3.4 Convert the legacy empty-workspace state into a clear “开始品牌诊断” recovery action while retaining safe reset/switch behavior; verify an existing empty session can reach onboarding without losing tenant isolation.
- [x] 3.5 Add frontend tests for the wizard, market-specific provider selection, dual-market setup, partial/empty collection states, and route transitions; verify `npm test` and `npm run build` pass.
- [x] 3.6 Add Chinese problem-monitoring UI for a fixed Query × AI platform scope, manual recheck creation, pause/resume, loading/error states, and transfer to evidence import.

## 4. End-to-end quality verification

- [x] 4.1 Run the full verification suite (`npm run verify` and strict OpenSpec validation) and resolve failures; verify all commands pass under Node 24.
- [x] 4.2 Perform browser smoke tests for a newly created `zh-CN` project, an `en-US` project, a dual-market project, and a recovered legacy empty workspace; verify each reaches an actionable setup/collection state rather than a blank dashboard.
- [x] 4.3 Inspect the rendered onboarding and setup screens at desktop and narrow mobile widths using the UI/UX quality checklist; verify visible focus, error states, long provider lists, no horizontal overflow, and no claims of automated execution or guaranteed GEO outcomes.

## 5. First-use task guidance and usable manual collection

- [x] 5.1 Update the activated-baseline dashboard so its first visible content is a plain-language progress card with the current workflow step, immediate goal, effort cue, and a direct primary action.
- [x] 5.2 Expose the existing server-side next-observation claim endpoint through the typed frontend API client and cover its path, method, identity headers, and optional provider filter.
- [x] 5.3 Rebuild the answer-collection screen as a task-based workspace: claim the next queued task, show the exact provider and question, support copying the question, and explain the manual evidence workflow without automating external platforms.
- [x] 5.4 Simplify the evidence-import form around a claimed task, refresh collection progress after save, and offer the next queued task.
- [x] 5.5 Add dependency-aware empty states for research, content, and report screens with direct recovery navigation to collection or diagnosis.
- [x] 5.6 Add frontend coverage for the claimed-task API client and run the complete verification suite plus desktop/narrow browser smoke checks for the updated workflow.

