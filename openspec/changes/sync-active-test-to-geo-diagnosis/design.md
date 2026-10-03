# Design

## Context

See `proposal.md` for motivation. The UI currently lists all real-platform test runs and chooses a run with a heuristic that prefers an old `baseline_ready` or reviewed run. Because run history is ordered from oldest to newest, an older Doubao-only run can remain visible even when the active 02 batch has newer DeepSeek, Yuanbao, and Doubao observations.

The product already scopes cases by `workspaceId` and `caseId`. Evidence review is correctly separated from raw collection: only reviewed observations are eligible for formal visibility metrics.

## Goals / Non-Goals

**Goals:**
- Persist one active real-platform test run per project and enforce same-workspace/project ownership.
- Use the active run as the only source for the 03 diagnostic baseline experience.
- Preserve evidence review as the boundary for formal metrics while making collection progress transparent.
- Provide a safe migration so existing projects with historical runs gain a deterministic active source.

**Non-Goals:**
- Change Browser Agent collection adapters, introduce API-based model testing, or alter evidence approval rules.
- Add a customer-controlled selector for historical runs in the normal 02 → 03 workflow.
- Treat unreviewed returned content as formal GEO performance evidence.
- Design a historical trend / retest comparison experience beyond retaining the existing history list.

## Decisions

### Store `active_real_surface_test_run_id` on the project case
Add a nullable active-run reference to the project diagnostic case. It is compact, naturally scoped by the existing workspace and case record, and allows constant-time selection without brittle ordering heuristics.

**Rationale:** A persisted pointer reflects the product rule directly. Selecting by latest update or most-reviewed run would still be vulnerable to old evidence, background updates, and partial retries.

**Alternative considered:** Derive the active run from timestamps. Rejected because updates from Browser Agent retries can reorder history and do not express the user’s formal current-batch intent.

### Set active on formal run creation; retain it on platform append
Creating a formal real-platform test sets the case pointer in the same transaction. Appending platforms continues to use the existing run and does not change the pointer.

**Rationale:** This matches a single frozen Query dataset and one current T0 collection batch. New official retests can create a new run and automatically supersede the previous pointer.

### Resolve active source server-side
Expose the active run in the case detail / diagnostic list payload, with a dedicated repository accessor. The frontend receives a resolved `activeRealSurfaceTestRunId` and either a fetched active run or an explicit no-source state.

**Rationale:** Server-side resolution centralizes ownership validation and avoids each client reimplementing history-selection logic.

**Alternative considered:** Continue returning all runs and have the client locate the active ID. This remains feasible for trend components, but canonical baseline selection must use the server-provided ID and never fallback to heuristic inference.

### Keep diagnostic metric eligibility unchanged
The metric builder continues to include only `reviewed` tasks containing usable raw answers. The diagnosis page derives separate returned, review-pending, and approved totals from the active run.

**Rationale:** Collection state must be visible, but unreviewed observations are not sufficiently controlled to become client-facing performance metrics.

### Migration/backfill prioritizes operationally newest run
For existing cases where the pointer is empty, migration backfills the most recently updated real-platform run for that workspace and case. If no test exists, the pointer remains null. Accessors defensively fall back to the latest run only when legacy pointer data is absent, and persist the recovered pointer where safe.

**Rationale:** The previous behavior incorrectly favored old reviewed evidence. `updated_at` better matches an active collection batch and avoids blanking existing projects after deployment.

## Risks / Trade-offs

- [A stale or deleted active pointer] → Validate ownership when loading; clear invalid pointers and surface an explicit no-current-test state instead of reading another project’s run.
- [Legacy cases have multiple historical runs] → Backfill latest operational run and offer history only as a non-primary future comparison capability.
- [Frontend cached run snapshots lag after review] → Refresh the authoritative test-run response after review actions and re-fetch active run on GEO diagnosis load.
- [Users expect raw returns to count immediately] → Clearly label returned-but-unapproved content as awaiting review and distinguish it from formal metric evidence.

## Migration Plan

1. Add the nullable column with an idempotent SQLite migration.
2. Backfill each case’s pointer using its most recently updated same-project run.
3. Deploy repository/API changes that always verify workspace and case ownership.
4. Deploy the frontend selection change; it uses the active source and shows a clear no-source state.
5. Run regression tests for multi-run ordering, project isolation, returned evidence, approved evidence, and legacy backfill.
6. Rollback is safe because the new pointer is nullable and existing run records remain unchanged; the prior frontend heuristic can still read existing history if code rollback is required.
