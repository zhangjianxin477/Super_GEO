# CoreNote Pilot: Controlled-Manual Collection and Brief Readiness Kit

## Purpose

This kit prepares the **first pilot tenant** for the general-purpose GEO Harness. It does not make the Harness CoreNote-specific. It provides the minimum traceable inputs needed to create the two agreed P0 briefs after evidence and controlled-manual observations are available.

No answer, citation, competitor position, exposure result, recommendation, or performance result is included in this kit. Operators must enter only real, retained observations from the named provider interfaces.

## Fixed P0 gaps

| Market pack | Locale | Query | Intended brief/channel candidates |
| --- | --- | --- | --- |
| China | `zh-CN` | `有哪些支持知识图谱、来源可追溯的 AI 知识库工具？` | 官网内容中心、知乎、微信公众号、掘金或合规海外替代渠道 |
| Global / United States | `en-US` | `What AI knowledge base tools provide knowledge-graph context and source-cited answers for B2B teams?` | Blog、Help Center、Comparison Page、Medium、LinkedIn |

The two market packs must remain independent: no mechanical translation, shared result, or copied competitor conclusion is permitted.

## Required collection packs

### China market pack

- Providers: DeepSeek、通义千问、豆包、Kimi、元宝、GLM、文心一言.
- Record the provider UI name, model identity displayed by the provider, locale, collection timestamp, query, complete answer, visible cited URLs, and a permitted capture/export reference.
- Preserve the original provider wording; do not rewrite an answer before import.

### Global market pack

- Providers: ChatGPT、Gemini、Claude、Perplexity.
- Use `en-US` and the same controlled-manual retention fields.
- Record any provider limitation or unavailable result rather than silently dropping it.

## Evidence-pack intake

1. Export or manually collect approved CoreNote source material through the agreed controlled-manual route.
2. For every item, record `title`, exact supporting excerpt, taxonomy, source reference, source type, collector, and collection timestamp.
3. Create the Evidence Pack in `draft`, have a reviewer approve it, then record its immutable ID and version below.
4. Include prohibited claims explicitly. A content draft may not imply unverified integrations, measured performance, ranking, citation guarantees, or customer outcomes.

| Market pack | Approved evidence pack ID | Version | Reviewer / timestamp | Status |
| --- | --- | --- | --- | --- |
| China | _To be recorded after approval_ | _TBD_ | _TBD_ | Blocked pending evidence |
| Global | _To be recorded after approval_ | _TBD_ | _TBD_ | Blocked pending evidence |

## Manual answer capture row

Create one retained capture-proof artifact before importing each row.

| Field | Required value |
| --- | --- |
| Market pack / locale | `CN / zh-CN` or `GLOBAL / en-US` |
| Query ID + exact text | Immutable ID from approved query dataset + unchanged query text |
| Provider and shown model identity | Exact interface labels |
| Collection time | ISO 8601 timestamp |
| Raw answer | Complete retained answer, unedited |
| Cited URLs | Visible URLs and citation kind when observable |
| Source reference | Permitted export/capture reference |
| Supporting artifact | Tenant-scoped proof artifact ID |
| Operator notes | Missing answer, interface limitation, or ambiguity—never inferred results |

## Brief creation gate

For each market, create a brief only when all rows below have real IDs and a human reviewer has checked the material.

| Brief | Diagnosis ID | Query dataset/version | Evidence pack/version | Approved channel | Review state |
| --- | --- | --- | --- | --- | --- |
| `corenote-cn-category-discovery` | _TBD after diagnosis generation_ | _TBD_ | _TBD_ | _TBD_ | Blocked pending real diagnosis |
| `corenote-global-category-discovery` | _TBD after diagnosis generation_ | _TBD_ | _TBD_ | _TBD_ | Blocked pending real diagnosis |

The Harness will create a brief only from a completed run's generated diagnosis, immutable query IDs, an approved evidence version, and an allowed channel. Brief generation is AI-assisted prompt/package preparation; any external model must be configured as a governed extension, and every draft still requires human review.

## Workflow readiness checkpoint

Before creating a run, and again after controlled-manual evidence has been imported, read the selected market pack's readiness state:

```text
GET /api/workspaces/{workspaceId}/market-packs/{marketPackId}/workflow-readiness
GET /api/workspaces/{workspaceId}/market-packs/{marketPackId}/workflow-readiness?assessmentRunId={assessmentRunId}
```

The endpoint is tenant-scoped and read-only. It does **not** invoke an AI provider, scrape any website, generate content, or publish anything. It reports only retained workflow records and returns:

- the approved evidence-pack reference and version match;
- an approved dataset that is compatible with the market and locale;
- expected market-pack providers, controlled-manual configurations, and missing configurations;
- selected-run observation completeness, including queued, failed, and imported observations;
- diagnoses and content briefs that are traceable to the selected run, market pack, and evidence version;
- `stage`, `blockingReasons`, and `nextAllowedOperation` for the next human-approved step.

Do not treat `content-brief-ready` as permission to publish. It only means a traceable diagnosis exists and an analyst may prepare a brief for reviewer approval.
## Operator sequence

1. Configure the CoreNote pilot workspace and the two independent Market Packs.
2. Seed/review the query dataset; confirm the two P0 queries are included unchanged.
3. Import evidence and obtain Evidence Pack approval.
4. Configure each named provider as `controlled-manual`.
5. Run the queued collection; attach a proof artifact and import each real answer.
6. Run evidence-grounded analysis and generate category-discovery diagnoses.
7. Create the two briefs using the returned diagnosis IDs and market-specific approved channels.
8. Review a brief; only then generate a provisional draft and validate all claims.
9. Create a human-only distribution task from an approved immutable snapshot; attach real completion proof later.
10. Repeat the identical immutable cohort for the follow-up assessment. Report any movement as observational, not causal.

## API references

- `POST /api/workspaces/:workspaceId/evidence/controlled-manual-import`
- `POST /api/workspaces/:workspaceId/datasets/seed-corenote-pilot`
- `POST /api/workspaces/:workspaceId/assessment-runs/:runId/observations/import`
- `POST /api/workspaces/:workspaceId/assessment-runs/:runId/analysis`
- `POST /api/workspaces/:workspaceId/assessment-runs/:runId/diagnoses/generate`
- `GET /api/workspaces/:workspaceId/market-packs/:marketPackId/workflow-readiness`
- `POST /api/workspaces/:workspaceId/content-briefs`

See [the governed brief-to-distribution workflow](../workflows/content-brief-to-distribution.md) and [the release checklist](../../release/pilot-release-checklist.md) before enabling a client pilot.

