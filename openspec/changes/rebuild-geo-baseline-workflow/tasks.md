# Tasks

## 1. Contract and persistence
- [x] 1.1 Add additive migration for baseline query sets, seed queries, real-surface test runs, collection tasks, observations, and audit events with workspace-safe indexes and unique constraints.
- [x] 1.2 Add repository serializers and transactional operations for generated query sets, approvals, test-run matrix creation, task claim, evidence submission, review, and derived readiness.
- [x] 1.3 Add server route validation and endpoints for baseline query sets and controlled-manual real-surface test runs.

## 2. First-baseline frontend
- [x] 2.1 Rename and reposition current Brand Diagnostic creation/detail experiences as Project settings / Product profile without deleting legacy data.
- [x] 2.2 Implement the Core Queries & first baseline workspace: generate/review Seed Queries, create Test Run, task queue, copyable operator protocol, evidence import, and review states.
- [x] 2.3 Rebuild sidebar and route copy around phase-correct GEO workflow, separating settings and governance from numbered operations.
- [x] 2.4 Apply compact, accessible enterprise UI states with responsive card/table transformations and no horizontal body overflow.

## 3. Verification
- [x] 3.1 Add/extend server tests for the lifecycle and isolation boundaries.
- [x] 3.2 Add/extend UI tests for first-use, active collection, failed import, and baseline-ready calls to action.
- [x] 3.3 Run server tests, Vitest, TypeScript, build/release checks, migrations, and manual desktop/mobile UI QA; fix discovered regressions.

## 4. Configurable Query generation and model connections
- [x] 4.1 Add additive persistence for query-generation prompts, invocation provenance, and OpenAI-compatible execution settings without exposing API secrets.
- [x] 4.2 Add repository and server routes for prompt retrieval/update, manual Seed Query creation, paged custom-count generation, connection settings, credential configuration, and server-side model invocation.
- [x] 4.3 Implement the visible 模型与 API 连接 page and route it from Operations & governance.
- [x] 4.4 Redesign the first-baseline generation/review experience for keyword + intent + prompt + selected connection, explicit template fallback, manual creation, and 10-row pagination.
- [x] 4.5 Add server/UI coverage for custom count, prompt provenance, manual Query creation, connection validation, no-connection state, pagination, and errors; run the validation suite and rendered UI QA.

