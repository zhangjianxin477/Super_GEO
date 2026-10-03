# Tasks

## 1. Reliable manual collection recovery

- [ ] 1.1 Preserve the ready workspace view during data refresh and expose an in-place refresh state; verify the live-workspace integration test confirms ready content remains rendered while reload resolves.
- [ ] 1.2 Show a claimed task before starting background refresh, add clear one-task recovery guidance and collection counters, and verify the answer-collection route renders provider, query, and evidence fields immediately after claim.
- [ ] 1.3 Make repeated `claim-next` requests resume the current operator's collecting observation before reserving new work; verify server integration tests confirm the observation ID and attempt count are unchanged.

## 2. Regression verification

- [ ] 2.1 Run focused frontend and server tests, `npm run build`, and strict OpenSpec validation; verify all pass under Node 24.
- [ ] 2.2 Smoke-test the running collection UI: claim or resume a task, refresh, and confirm the same task is restored with an actionable evidence form.
