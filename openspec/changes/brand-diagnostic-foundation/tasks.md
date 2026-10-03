# Tasks

## 1. Diagnostic persistence and API

- [x] 1.1 Add additive SQLite migration and repository models for workspace-scoped diagnostic projects, facts, sources, scope, collection plans, immutable baseline snapshots, activities and recommendations; verify migration and repository tests pass.
- [x] 1.2 Implement role-checked diagnostic project, fact, scope, plan, baseline and activity API endpoints; verify server tests cover validation, workspace isolation and blocked baseline freeze.
- [x] 1.3 Add clearly marked development seed data and API payload formatting for project center / detail reads; verify a seeded API list and detail response contain lifecycle, blocker and provenance fields.

## 2. Brand diagnostic product UI

- [x] 2.1 Build a data-backed diagnostic project center with status, coverage, blocker and next-action views; verify it renders live API data and safe loading/error states.
- [x] 2.2 Build a five-step create/edit diagnostic workflow for scope, brand facts, query scope, collection plan and freeze review; verify user submissions persist through the API and incomplete freeze errors remain visible.
- [x] 2.3 Build a flat diagnostic detail workspace for overview, facts, dataset, testing evidence, baseline, actions and activity; verify manual collection labeling and pending-evidence states prevent fabricated performance output.
- [x] 2.4 Apply the existing product design system and UI/UX Pro Max accessibility guidance to responsive controls, tabs, tables, dialog feedback and keyboard focus; verify TypeScript and client tests pass.

## 3. Integrated verification

- [x] 3.1 Run API, client, release preflight and production-build verification; verify all commands pass and record any environment-specific runner constraint.
- [x] 3.2 Review the rendered diagnostic center and create flow against the acceptance scenarios, including scoped data, blocker visibility, manual-import disclosure and baseline freeze; verify the test evidence is documented in the change.

## Validation record — 2026-09-27

- Server: `C:\Users\ZJX\AppData\Local\Node.js-v24.21.0\node.exe scripts/run-server-tests.mjs` — 45 tests passed, including workspace isolation, incomplete-freeze rejection, fact review, scope/plan persistence, immutable snapshot, and pending-evidence behavior.
- Client: `C:\Users\ZJX\AppData\Local\Node.js-v24.21.0\node.exe .\node_modules\vitest\vitest.mjs run` — 39 tests passed, including the API-backed project center and recoverable error state.
- Release/build: release preflight passed; Vite production build passed.
- Rendered QA: inspected `http://127.0.0.1:5173/` after restarting the local API and Vite services. The project center displayed persisted status, Query Scope, controlled-manual evidence boundary, coverage pending import, and next action without fabricated metrics.
- Runner note: the restricted sandbox blocks child-process spawning with `EPERM`; full Node 24 test/build commands were run outside the sandbox. The elevated host defaulted to Node 20, so explicit Node 24 was used for `node:sqlite` compatibility.
