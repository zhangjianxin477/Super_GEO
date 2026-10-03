# Tasks

## 1. Current test-source persistence

- [x] 1.1 Add an idempotent SQLite schema migration for each project’s nullable active real-platform test-run reference, backfill it from the newest same-project run, and verify migration against a database containing multiple historical runs.
- [x] 1.2 Add repository accessors and ownership validation for the active test source; make formal test creation update the pointer atomically and verify that appending platforms retains the same active run.
- [x] 1.3 Expose the active test source through the diagnostic API/client contract and verify a project cannot retrieve another project’s active source.

## 2. Diagnostic data-source behavior

- [x] 2.1 Replace the GEO diagnosis history heuristic with the active real-platform source and verify an older reviewed run cannot replace a newer current run.
- [x] 2.2 Render source provenance, collection progress, pending-review state, and no-current-test guidance in GEO diagnosis; verify returned-but-unapproved evidence is not presented as a 0% formal result.
- [x] 2.3 Clarify in the real-platform testing workspace that the current batch automatically supplies GEO diagnosis after review, and verify the message appears without a manual sync control.

## 3. Regression coverage and validation

- [x] 3.1 Add server tests for active-run selection, migration/backfill, same-project ownership, and creation/append behavior; verify with `npm run test:server`.
- [x] 3.2 Add frontend tests for active-run rendering, historical-run exclusion, and returned-versus-reviewed metric states; verify with `npm test`.
- [x] 3.3 Run `npm run build` and perform a focused local smoke check showing current 02 data in 03 for the selected project.

