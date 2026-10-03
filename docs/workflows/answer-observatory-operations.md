# AI Answer Observatory Operations

## Purpose and operating boundary

The Observatory produces a traceable, tenant-isolated record of how a configured AI provider answered an immutable GEO query cohort at a point in time. The MVP is **controlled-manual only**: it does not store raw provider credentials, automate model interactions, scrape platforms, or publish content. Every observation remains an input to human review, not proof of ranking, causality, leads, or revenue.

## Configure a provider

1. An administrator adds a provider from the approved catalog for its matching market and locale.
2. Set `collectionMode` to `controlled-manual`. The service rejects other modes.
3. If a credential system is used outside the Harness, record only a `secret://...` reference. Never submit an API key, token, or secret to the Harness.
4. Disable a configuration before it should no longer be selected for a new run. Existing runs keep their immutable configuration snapshot.

## Create a reproducible baseline run

1. Select an **approved** query-dataset version and an **approved** market pack with the same market and locale.
2. Select configured providers declared by that market pack and give the run a descriptive label.
3. Retain the generated run identifier. The record freezes the dataset ID/version, market pack ID, locale, ordered provider list, provider configuration versions, and cohort query IDs.
4. Use the same immutable cohort, locale, market pack, and ordered provider set for a follow-up. The compatibility endpoint reports any mismatch; do not label mismatched runs as comparable.

## Controlled manual collection queue

The MVP uses a documented custom substitute for an external job component: a durable SQLite-backed collection queue. It is intentional because all configured providers are manual-only.

1. Each query-provider pair is created as a queued observation with a maximum attempt count (default 3; 1–5 allowed).
2. A permitted analyst claims the next due observation using the queue endpoint. The observation becomes `collecting` and records the collector, attempt count, and timestamp.
3. Collect the answer through an authorized user workflow. Preserve the exact query, provider/model identity, locale, collection time, raw answer, cited URLs, and capture proof.
4. Import the result with an immutable supporting-artifact reference. Imported evidence is visibly marked `providerKind: imported` and excluded from metrics unless an analyst explicitly requests imported evidence.
5. If collection times out, record the timeout. The system preserves structured error details and schedules a retry until the maximum attempt count is reached; then it marks the observation failed and the run partial.
6. A failed observation can be deliberately resumed with additional allowed attempts. The original attempt count and audit trail remain retained.

## Evidence and proof requirements

Manual imports require all of the following:

- query ID and configured provider ID from the planned observation;
- exact raw answer, source reference, collection timestamp, and optional model identity;
- collector identity (the authenticated analyst is stored automatically);
- one tenant-scoped supporting artifact, such as an approved capture-proof record;
- normalized citation URLs with a source kind (`owned`, `third-party`, or `unknown`).

The system creates a separate raw-answer artifact. Its reference, storage key, and checksum remain linked from the observation. Large capture material belongs in the artifact storage abstraction rather than the observation row.

## Completion, reporting, and recovery

- Run detail exposes planned, queued, collecting, completed, imported, and failed counts plus an explicit `isComplete` flag and incomplete reason.
- A run with failed, queued, or collecting observations is **not** complete and must not be presented as a complete assessment.
- Diagnose and report only the eligible evidence described by the metric response. By default, imported results are visibly excluded from aggregate metrics.
- Keep a copy of the run record and its provider snapshots for any baseline delivered to a client. This is the reproducibility record for operations.
- Review timeout, import, resume, and artifact events in the workspace audit trail before closing a collection cycle.

## Prohibited operations

Do not fabricate an answer, citation, screenshot, review, competitor result, or performance outcome. Do not bypass provider access controls, run unattended collection, or convert observation data into an assurance that content changes will cause AI mentions or citations.
