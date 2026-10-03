# Proposal

## Why

The controlled-manual answer collection path currently allows a refresh to unmount the active task UI just after a task is claimed. The operator sees no next step even though the task has moved to `collecting`, and repeated clicks can reserve additional tasks. This breaks the first-run workflow shown in the product and makes the enterprise collection queue appear unreliable.

## What Changes

- Keep an already rendered workspace usable while its data refreshes; reserve the full-page loading state for the first load only.
- Display a successfully claimed manual collection task before its background dashboard refresh completes, with clear guidance that one task is reserved at a time.
- Make task claiming idempotent for the same operator and assessment run: return the operator's unfinished collecting task before claiming a new queue entry.
- Clarify collection progress so operators can distinguish the overall task count, their current reserved task, and the remaining queue.
- Add automated regression coverage for refresh continuity and repeated claim requests.

## Capabilities

### New Capabilities
- `manual-collection-task-recovery`: Reliable recovery, display, and idempotent claiming of a controlled-manual AI-answer collection task.

### Modified Capabilities
- None.

## Impact

- Frontend: `src/useLiveWorkspace.ts`, `src/App.tsx`, and live-workspace tests.
- Server: `server/repositories/harnessRepository.mjs` and API integration tests.
- No third-party AI platform automation, cross-tenant access, data fabrication, or externally visible API route changes.
