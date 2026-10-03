# Proposal

## Why

Real-platform collection is intentionally dependent on the customer's logged-in browser and can be interrupted by page changes, login expiry, a crashed local agent, or a single failed query. The current workflow exposes only per-task retry, so a failed lane can appear stuck and operators may have to retry tasks manually. Completed evidence must remain authoritative and must not be recollected.

## What Changes

- Add a platform-scoped checkpoint resume operation for an existing Real-surface Test Run.
- Requeue only recoverable unfinished Browser Agent tasks for the selected platform, while preserving submitted, reviewed, captured-for-review, and currently running work.
- Reclaim stale queued/claimed Browser Agent leases safely and record an audit trail.
- Add a clear "继续采集未完成任务" action in the platform task console and show the number of resumable tasks.
- Keep the existing single-task retry as a surgical fallback, with clearer user-facing language.

## Capabilities

### New Capabilities
- `browser-agent-checkpoint-resume`: Resume a selected platform lane from the last safe checkpoint.

### Modified Capabilities
- `real-surface-baseline-testing`: Expose resumable progress and preserve completed evidence when a lane is resumed.

## Impact

- Server repository, API route, and typed client method.
- Real-platform task console UI and focused tests.
- No new Test Run, Query Dataset, or third-party API execution path is introduced.
