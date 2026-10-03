# Evidence onboarding for pilot administrators

This runbook configures a new enterprise GEO workspace using the **controlled manual export / manual entry** MVP boundary. It applies to CoreNote, official website, and manual evidence sources; CoreNote is an optional validation source, not a system prerequisite.

## Before you begin

The administrator must confirm all of the following:

- The workspace has a named administrator, analysts, reviewers, and viewers.
- The collector is authorized to access each source and to export the selected material.
- The evidence is limited to the customer workspace and is eligible for the intended GEO/content use.
- No access-control bypass, scraping of authenticated pages, shared personal credentials, or external-model upload is being attempted.
- Every material claim can be supported by an exact excerpt and a retained source reference.

## 1. Create the workspace and assign roles

Create one workspace per customer tenant. The workspace needs a legal/working name, brand name, product list, and initial administrator. Add only workspace members who need access:

| Role | Responsibility |
| --- | --- |
| Administrator | Workspace configuration, extension governance, members, and audit review. |
| Analyst | Imports evidence, manages query cohorts, and prepares observations/briefs. |
| Reviewer | Approves evidence and public-facing content decisions. |
| Viewer | Reads approved material only. |

A viewer must never be granted write access simply to complete an import.

## 2. Prepare an evidence batch

For each source item, retain the following canonical fields before upload:

- `title` — source title or reviewer-assigned label;
- `excerpt` — bounded fact, not a generated summary presented as source text;
- `taxonomy` — brand identity, product capability, customer segment, use case, case study, policy, comparison, or prohibited claim;
- `sourceRef` — approved URL, document ID, export reference, or internal source reference;
- `sourceType` — `corenote`, `website`, or `manual`;
- collector identity and the actual `collectedAt` timestamp.

Use a distinct batch when the factual scope, source authority, or intended public claim differs materially. Do not overwrite a prior approved pack to correct a claim; submit a new evidence version.

## 3. Submit a controlled manual import

Use `POST /api/workspaces/{workspaceId}/evidence/controlled-manual-import` with:

```json
{
  "collectionMode": "controlled-manual",
  "sourceType": "corenote",
  "sourceSystem": "CoreNote controlled export",
  "collector": "authorized-analyst-id",
  "collectedAt": "2026-09-27T08:30:00.000Z",
  "status": "draft",
  "items": [
    {
      "title": "Product capability source",
      "excerpt": "Bounded source-backed factual excerpt.",
      "taxonomy": "product-capability",
      "sourceRef": "corenote://export/reference"
    }
  ]
}
```

The endpoint creates a tenant-scoped import artifact, retains the collector and collection time, maps each item to the canonical evidence model, and creates a new Evidence Pack version. The same endpoint accepts `website` and `manual` source types for authorized fallbacks.

## 4. Review and approve the Evidence Pack

1. Confirm the item title, source reference, excerpt, taxonomy, and intended claim are correct.
2. Confirm prohibited claims are identified as `prohibited-claim` rather than used as public support.
3. Confirm the source is authorized and does not contain customer/private data outside the workspace’s approved scope.
4. Have a reviewer approve the pack before it is used for market packs, analysis, briefs, or drafts. Submit `POST /api/workspaces/{workspaceId}/evidence/{evidencePackId}/review` as a reviewer or administrator with `{ "decision": "approved", "reviewComment": "..." }`.
5. Preserve the prior approved pack. A correction is a new version, never an in-place rewrite. An analyst can create only a `draft` pack; an approved pack requires the `evidence:approve` permission.

## 5. Handle failures safely

| Situation | Required response |
| --- | --- |
| Export unavailable or incomplete | Record the gap; do not recreate facts from memory. |
| Incorrect source mapping | Leave the approved Evidence Pack unchanged and submit a corrected draft import. |
| Source reference missing | Keep the batch out of approved evidence until traceability is restored. |
| Controlled manual import/synchronization fails | Record a `failed` event through `POST /api/workspaces/{workspaceId}/evidence/sync-events`; do not replace any evidence. Authorized users can retrieve `GET /api/workspaces/{workspaceId}/evidence/sync-status`, which returns a warning and the preserved last-approved pack. |
| Future API or webhook configuration fails | Fail closed, log the event, and retain the last approved version. A live connector requires separate authorization and security review. |

## Pilot completion check

A clean pilot workspace is ready for downstream GEO work only when it has: a configured administrator and reviewer; at least one approved, versioned Evidence Pack; retained source/import artifacts; an audit trail; a China and/or global Market Pack linked to the approved evidence version; and no unreviewed evidence represented as public fact.
