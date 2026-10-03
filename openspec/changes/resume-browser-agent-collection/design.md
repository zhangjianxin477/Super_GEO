# Design

## Scope

The resume operation is scoped to one existing Test Run and one selected platform. It never creates tasks and never reads the mutable Query Dataset. The Test Run's task rows are the immutable work queue.

## Task classification

The server evaluates the selected lane in one transaction:

- **Preserve:** `submitted`, `reviewed`, `skipped`; any task with an existing observation is never overwritten.
- **Preserve active:** `claimed` + `agentState=running`; the local agent may still return a terminal result.
- **Recover:** `failed` and `needs-human`; rebind to the selected online agent and return to `unassigned / queued`.
- **Recover stale lease:** `claimed` + `agentState=queued|running` older than the five-minute lease timeout; release operator/claim fields and requeue.
- **Leave alone:** fresh `queued` / `unassigned` tasks, so a resume does not duplicate work already waiting in the lane.

The response returns the refreshed Test Run plus resumed task IDs and counts for preserved, active, and skipped work. The operation is idempotent: a second resume sees freshly queued tasks and does not increment attempts or create duplicates.

## Browser Agent integration

The browser-agent-start request remains the explicit consent boundary. Resume only prepares the lane; the operator still clicks the existing platform start action. This preserves the customer-side real browser path and avoids API-only model results.

## UI

The selected platform header displays a compact progress summary and a `继续采集未完成任务（N）` button when N > 0. It uses the same online-agent selection logic as start/retry. On success it refreshes the authoritative Test Run and explains that completed tasks were skipped. The individual retry action remains available as `重试本条 Query`.

## Audit and safety

Every recovered task records the previous agent state and reason. The lane-level audit contains the selected platform, agent, recovered IDs, counts, and skipped categories. Errors are returned as conflict responses with actionable Chinese guidance.
