# Design

## Context

The dashboard reload function currently changes a ready workspace back to the full-page loading phase. The task-claim UI awaits this reload before saving the returned observation to local component state, so the component is unmounted and the task is not displayed. The repository claim operation only searches queued work, so repeated clicks reserve separate observations.

## Goals / Non-Goals

**Goals:**
- Preserve an already loaded workspace during a refresh and expose a lightweight refreshing state.
- Make successful manual task claims immediately actionable.
- Make repeated claims by one operator and assessment run idempotent.
- Prevent existing collecting tasks from becoming hidden work.

**Non-Goals:**
- Automating logins, prompts, answer collection, or publishing on third-party AI platforms.
- Reassigning work between operators, changing RBAC, or changing API routes.
- Recovering collecting tasks owned by another operator.

## Decisions

- The workspace hook keeps `phase: ready` during refresh and exposes `isRefreshing`; only the initial load uses `phase: loading`. This retains route-local UI state and avoids a disruptive visual reset. The alternative, retaining a separate copy of the task across unmounts, is less reliable because every page component would have to coordinate storage.
- The collection page sets the claimed observation before starting a non-blocking refresh. A visible local success message establishes the next manual action even if a follow-up read fails. Waiting for refresh is rejected because it recreates the unmount race.
- The repository searches for an observation with `status = queued`, `collection_state = collecting`, and the same `collector_id` before querying eligible queued observations. The original claim is preserved intact: no attempt count increment and no new reservation on a repeated click.
- The start panel describes planned, available, and current work in operator language. It does not hide the provider/query grid or suggest that any external model is automated.

## Risks / Trade-offs

- [A background refresh can fail after a claim] → Keep the claimed task in local state, show the task and an explicit refresh message, and preserve the next manual step.
- [An operator may change browser or user identity] → Only resume a task matching the server-side workspace, assessment run, and actor ID; other users cannot take it through this path.
- [A stale dashboard count may briefly lag after claim] → Refresh in the background and label counts as current at the last successful refresh rather than blocking task work.

## Migration Plan

1. Deploy the server and frontend changes together.
2. Existing collecting observations automatically become recoverable for their recorded collector through the updated claim endpoint.
3. If rollback is needed, the stored observations remain valid; only the safer resume behavior is removed.
