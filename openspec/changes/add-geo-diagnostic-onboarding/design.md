# Design

## Context

The existing API separates workspace provisioning from creation of evidence packs, query datasets, market packages, providers, and assessment runs. The existing local development seed demonstrates that the repository can create a fully operated project, but the product UI calls the lightweight workspace route and therefore receives an empty market-pack list. `useLiveWorkspace` correctly identifies that condition, but the `EmptyWorkspace` UI has no governed way to transform the tenant into a diagnostic project.

This design implements the behavior defined in the proposal and specs while keeping the established controlled-manual collection boundary.

## Goals / Non-Goals

**Goals:**
- Give first-time administrators a single, recoverable route from brand brief to initial collection tasks.
- Keep project initialization server-owned and transactionally consistent.
- Produce reviewable drafts and plans, not fabricated model observations, citations, rankings, published content, or GEO outcomes.
- Reuse the existing evidence, dataset, market pack, provider, assessment-run, audit, and dashboard models where their invariants already apply.
- Keep Chinese `zh-CN` and United States `en-US` records distinct even when a workspace contains both.`n- Let an operator monitor one approved question over time without introducing automated provider execution.

**Non-Goals:**
- Live execution against third-party AI platforms, scraping, credential automation, or automatic content publication.
- Automatic approval of evidence packs or Query Gap datasets.
- A promise that diagnostics will yield a particular mention rate, citation rate, ranking, traffic, leads, or revenue.
- Replacing the existing low-level administrative APIs or redesigning all operational dashboard views.

## Decisions

### 1. Add a server-owned onboarding aggregate

Add `POST /api/workspaces/onboard` as the first-use product API. It will validate the entire request before writing and execute a repository-level transaction that returns workspace identity, project identity/read context, initialized market packages, draft dataset summaries, provider collection tasks, planned runs, and a deterministic next-step descriptor.

The existing `POST /api/workspaces` remains a narrow administrative provisioning API. The UI will not use it as its normal new-customer CTA.

**Rationale:** coordinating multiple existing low-level endpoints in the browser would create partial projects, make audit/error behavior inconsistent, and expose sequencing rules to the client.

**Alternative considered:** let the frontend invoke existing resource endpoints in order. Rejected because network failure could leave a user with the current empty state or a partially configured tenant.

### 2. Model a project as an onboarding aggregate without duplicating tenant ownership

A workspace remains the tenant boundary and current source of membership/RBAC. The onboarding response will carry a persistent, named brand-project descriptor (stored with workspace metadata/configuration or a dedicated lightweight record if migration review determines it is needed) and link its initialized market packages, dataset keys, and baseline run identifiers.

**Rationale:** existing child resources are already tenant-scoped; adding a second authorization root would risk access-control divergence. The project descriptor gives the UI an explicit product-level identity without weakening tenant controls.

**Alternative considered:** treat a workspace itself as the only brand project. Rejected because the user journey and future multi-brand support need an explicit project-oriented read model.

### 3. Seed drafts only; approvals and observations remain separate workflow events

Initialization creates a draft evidence/brand context and draft Query Gap datasets. It does not auto-approve either. Query suggestions use a deterministic, labelled starter cohort based on market, category, brand/product, customer segment, and objective. Where an AI-suggestion provider is added later, it must write versioned suggestions under the same draft/approval model.

**Rationale:** the current workflow-readiness rules already require approved inputs before a run can be collected or concluded; retaining that gate prevents a polished onboarding flow from manufacturing diagnostic evidence.

**Alternative considered:** automatically approve the initial query cohort to make the first dashboard appear populated. Rejected because that would bypass the required human review and misstate readiness.

### 4. Create controlled-manual collection tasks from provider plans

For every selected market/provider combination, create a collection-plan task linked to the draft query dataset and planned initial run. Tasks start as `planned`; imported evidence advances provider/query coverage. The setup read model summarizes provider count, query count, imported coverage, blockers, and the current operator action.

**Rationale:** it maps the chosen MVP integration boundary directly to work users can perform and avoids pretending an external model call occurred.

**Alternative considered:** show only provider chips on the dashboard. Rejected because chips do not identify what must be collected, by whom, or whether the baseline is sufficiently complete.

### 5. Add controlled-manual problem monitoring

A monitoring plan is scoped to one approved market package, one approved query, and a selected subset of that market’s configured providers. It stores a cadence as a planning aid, not an autonomous schedule. An authorized operator can create a recheck only while the plan is active; the repository creates a new assessment run with controlled-manual collection tasks and audit history. It never logs in to an AI platform, sends prompts, scrapes answers, or publishes content. The UI routes the operator to the evidence-import queue so conclusions remain grounded in retained observations.

### 6. Frontend uses a Chinese multi-step wizard and task-state landing page

The landing CTA opens a progressive disclosure setup wizard: (1) brand and audience, (2) markets/providers/objective/competitors, (3) review of planned assets. After submission, the UI opens a diagnostic setup view showing draft Query Gap, provider collection tasks, approval gates, and a next-action button. Legacy empty workspaces show a clear “开始品牌诊断” recovery action.

The UI will follow the existing Chinese product language, show manual-import limitations prominently, and have loading, validation, error/retry, success, and empty/legacy states. It will be responsive and keyboard-accessible.

**Rationale:** the customer must understand that onboarding creates a plan rather than a completed report, while still receiving a concrete task list immediately.

**Alternative considered:** create defaults silently and take users directly to the dashboard. Rejected because it conceals scope choices and can be mistaken for actual collection results.

## Risks / Trade-offs

- [Onboarding request includes many dependent records] → Validate all request data before opening the write transaction and roll back all writes on error; cover failed initialization in integration tests.
- [No third-party model automation in MVP] → Use unambiguous labels such as “待人工导入” and show collection coverage/limitations wherever diagnostic metrics would otherwise appear.
- [Large query cohorts could slow first-use requests] → Generate a concise starter cohort synchronously, leave the 100–200 expansion workflow as draft/approved incremental creation, and document the distinction.
- [Provider defaults change by market] → Keep market/provider catalogs in a validated server-owned policy map with explicit supported locales and client-readable options.
- [Existing sessions reference empty workspaces] → Preserve the legacy empty state but turn it into an onboarding recovery route rather than silently creating data.

## Migration Plan

1. Add schema/repository support and the aggregate onboarding endpoint behind tests.
2. Add client API types, request validation, and setup/onboarding UI without deleting existing operational views.
3. Route new landing-page CTA traffic to onboarding; preserve the low-level workspace route and legacy session recovery.
4. Run server, client, release, build, and browser smoke tests for a new `zh-CN`, an `en-US`, and a dual-market project.
5. If rollout defects occur, keep read access to created projects and revert only the CTA/wizard routing; the initialized records remain valid governed drafts and plans.

## Open Questions

None. The initial MVP uses the previously agreed controlled-manual import method; future provider connectors remain pluggable enhancements rather than requirements for this change.

## First-use task guidance refinement

The dashboard becomes an action-first home rather than an evidence ledger. For an incomplete assessment, the header is followed immediately by a compact progress card: `第 2 步 / 5：导入第一条 AI 回答`, a three-minute estimate, and one primary button. Metric cards remain visible beneath the card as empty baseline context, but do not compete with the required action.

The controlled-collection screen uses an explicit task model. A `claim-next` request chooses the next queued query-provider pair server-side. The screen then surfaces: the platform name, the exact question, a copy button, a four-step operator checklist, and a simplified import form. The form defaults to the claimed task and does not require a new operator to understand Query × Provider. Users can still inspect evidence records after import.

The language hierarchy uses `问题`, `AI 平台`, `回答证据`, `诊断结果`, `内容计划`, and `复测报告` as primary labels. Terms such as `Query × Provider`, assessment status, tenant scope, and controlled-manual restrictions move into secondary explanation and tooltips. The existing no-automation boundary remains clear but is not used as the page headline.

Downstream screens remain accessible for orientation, but when prerequisite evidence is missing they render a reusable dependency notice with a single recovery action. This preserves enterprise transparency and makes the workflow recoverable without dead-end empty states.

