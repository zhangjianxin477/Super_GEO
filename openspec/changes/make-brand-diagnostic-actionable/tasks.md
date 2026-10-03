# Tasks

## 1. Actionable diagnostic contract

- [x] 1.1 Add an additive migration and repository serializers for versioned diagnostic briefs and launch-plan snapshots; verify a new case round-trips business selections without modifying legacy cases.
- [x] 1.2 Add workspace-scoped create/read/update diagnostic-brief and launch-plan APIs that derive platform, channel, evidence, Query, and competitor work counts server-side; verify unauthorised workspace access is rejected and a complete brief returns a concrete plan.
- [x] 1.3 Add connector-readiness evaluation that returns `ready`, `manual-ready`, or `configuration-required` without exposing credentials or claiming an LLM invocation; verify controlled-manual and unconfigured AI-assisted scenarios.

## 2. Guided business workflow

- [x] 2.1 Replace free-text project registration with a three-stage diagnostic launcher using goal, category, market packages, audiences, intents, evidence URLs, competitors, and execution preference; verify all business inputs display what downstream work they control.
- [x] 2.2 Render a launch-preview and post-create control panel with explicit output counts, connector status, and the next allowable action; verify no technical retry or credential fields appear in the business flow.
- [x] 2.3 Add an administrative handoff from configuration-blocked state to Harness settings and a governed manual-evidence fallback; verify no user-facing control implies browser automation or a completed model run.

## 3. Quality and verification

- [x] 3.1 Add server tests for brief persistence, market-package derivation, launch-plan counts, workspace isolation, and readiness states; verify the server suite passes.
- [x] 3.2 Add UI tests for guided selections, explanatory text, launch preview, and configuration-blocked/manual-ready state; verify TypeScript, client tests, and production build pass.
- [x] 3.3 Validate the OpenSpec change and inspect the rendered launcher/control panel at desktop size; verify the implemented flow meets all scenarios in the delta spec.
