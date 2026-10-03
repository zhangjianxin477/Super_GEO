# Content Brief-to-Distribution Workflow

## Purpose

This operating workflow converts a verified GEO gap into a controlled, evidence-grounded content action. It is designed for enterprise B2B use: each artifact remains tenant-scoped, versioned, attributable, and auditable. It does **not** guarantee model mentions, citations, rankings, leads, or commercial outcomes.

## Required inputs

Before creating a content brief, the workspace must have:

1. An approved Evidence Pack version containing source-linked product facts and prohibited claims.
2. An approved Market Pack for the target market and locale.
3. An immutable completed assessment run with a governed query cohort.
4. A diagnosis tied to that run and the same approved Evidence Pack version.
5. A declared target channel permitted by the Market Pack.

For a CoreNote pilot, create independent China and global Market Packs. They are not translations of one another: each must own its locale, customer language, query cohort, competitors, provider cohort, and channel rules.

## Controlled workflow

### 1. Select a diagnosis and create a brief

An analyst selects a GEO diagnosis, the diagnosed query IDs, target channel, content type, and title. The Harness validates the market, locale, cohort, Evidence Pack version, and target channel before creating a `needs-review` brief. The output contains:

- mandatory, evidence-linked facts and source links;
- query intent and competitor context;
- prohibited claims and competitor-handling rules;
- channel-specific outline, review criteria, and success measures;
- prompt/invocation provenance, with a clear boundary when no external model ran.

### 2. Reviewer approves the brief

Only a reviewer or administrator can approve or reject the brief. Approval is a requirement for generating any draft; it is not permission to publish content.

### 3. Generate a provisional draft

A draft retains its source brief, locale, channel, content type, Evidence Pack version, source links, and evidence references. In the current pilot implementation, draft scaffolding uses the internal `evidence-safe-template-composer-v1 (non-LLM)` and is recorded accordingly. Any future external model invocation must run through an authorized, configured extension and retain prompt and output references.

### 4. Validate claims and approve an immutable snapshot

The system flags measurable performance, guarantees, ranking, and AI-citation claims. A reviewer must either support each flag with approved evidence or reject the draft. Approving a compliant draft creates an immutable Approved Content Snapshot; that snapshot—not a mutable draft—is the only source permitted for client delivery or a public-distribution task.

### 5. Create a human distribution task

A reviewer or administrator creates a task from one Approved Content Snapshot. The task records the assigned owner, immutable channel, editorial constraints, selected brief query IDs, scheduled date, and status. It begins as `planned` and may move through `in-progress`, `submitted`, `completed`, `blocked`, or `cancelled` according to governed transitions.

The Harness does not publish material to a channel. When a person completes a task, they attach a tenant-scoped proof artifact, such as a permitted channel URL, editorial confirmation, or captured submission record. The system records the action as observational evidence, not proof that a model will cite or recommend the product.

## CoreNote pilot brief readiness manifest

Create the following two briefs only after the named evidence, diagnosis, and channel are approved. Do not replace these references with assumptions or generic marketing claims.

| Pilot brief | Market/locale | Required diagnosis and cohort | Required evidence | Candidate channel | Status |
| --- | --- | --- | --- | --- | --- |
| CN category-discovery brief — `有哪些支持知识图谱、来源可追溯的 AI 知识库工具？` | China / `zh-CN` | Approved P0 Chinese category-discovery diagnosis and its immutable query ID | Approved CoreNote CN Evidence Pack version | Approved Chinese website, knowledge-base, or editorial channel | Blocked pending real controlled-manual answer evidence and diagnosis |
| Global category-discovery brief — `What AI knowledge base tools provide knowledge-graph context and source-cited answers for B2B teams?` | Global / `en-US` | Approved P0 English category-discovery diagnosis and its immutable query ID | Approved CoreNote global Evidence Pack version | Approved English website, help-center, comparison, or editorial channel | Blocked pending real controlled-manual answer evidence and diagnosis |

Use the [CoreNote controlled-manual pilot kit](../pilots/corenote/controlled-manual-pilot-kit.md) to record real evidence, collection artifacts, diagnoses, and returned brief IDs. The kit is a readiness artifact, not a substitute for a created brief.

## Ethical and governance rules

- Do not request or create fabricated reviews, fabricated citations, deceptive link schemes, or unreviewed mass publication.
- Do not state causality or promise visibility, citations, rankings, leads, or revenue.
- Do not present imported/manual model observations as direct provider executions.
- Retain evidence and proof references; do not overwrite approved versions.
- Handle competitor material as attributable observations, not unverified assertions.

## Completion checklist

- [ ] CN pilot gap, customer segment, channel, and owner agreed.
- [ ] Global pilot gap, customer segment, channel, and owner agreed.
- [ ] Separate approved CN and global Evidence Pack versions are available.
- [ ] Separate approved Market Packs and query cohorts are available.
- [ ] Diagnoses are tied to completed assessment runs.
- [ ] Both briefs are reviewer-approved and traceable to their diagnoses and evidence versions.
- [ ] Any distribution task references an immutable approved snapshot and has human completion proof.
