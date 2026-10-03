# Tasks

## 1. Platform checkpoint resume

- [x] 1.1 Add repository transaction for platform-scoped resume with safe task classification, stale lease recovery, idempotency, and audit records.
- [x] 1.2 Add API route and typed client method returning the refreshed Test Run and resume counts.
- [x] 1.3 Add focused server coverage for failed, needs-human, stale, completed, active, idempotent, and cross-platform behavior.

## 2. Console workflow

- [x] 2.1 Add resumable count and `继续采集未完成任务` action to the selected platform console.
- [x] 2.2 Rename the single-task fallback action to `重试本条 Query` and keep it scoped to one task.
- [x] 2.3 Add focused frontend coverage and run tests, build, and strict OpenSpec validation.
