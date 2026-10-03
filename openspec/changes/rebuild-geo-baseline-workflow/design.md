# Design

## Context

The product serves B2B teams that need to improve their visibility inside AI answers. Existing “Brand Diagnostic” functionality stores useful product facts but incorrectly presents project configuration as if it were a completed diagnosis. The first result customers should receive is a real-platform T0 baseline, backed by raw answers and citations. This change creates the first operational slice of that workflow.

## Goals / Non-Goals

**Goals:**
- Make Product Profile a durable configuration object and make first-baseline testing the first numbered operational phase.
- Turn profile inputs into transparent, editable Seed Query suggestions (5–20) with intent, rationale, market, language, and provenance.
- Orchestrate parallel human collection without browser automation, log actual observation context, and preserve originals for later deterministic metrics and LLM-assisted analysis.
- Give an operator one clear next action at every state: generate, approve, create Test Run, claim, import, review, or calculate baseline.
- Follow compact enterprise-operational UI conventions: a scan-friendly overview, explicit phases, visible focus, inline form validation, clear loading/error/empty states, and no unintended horizontal scrolling.

**Non-Goals:**
- Automating logins, prompts, clicks, CAPTCHAs, or scraping of consumer AI sites.
- Treating API output as equivalent to ChatGPT, Perplexity, DeepSeek, or other real web/app surfaces.
- Implementing full GEO diagnosis, 80–200 Query expansion, competitive research, publishing, or reporting in this first module.
- Replacing existing project records; existing Brand Diagnostic data remains readable and is presented as Product Profile data.

## Architecture and Data Model

### Product Profile
Existing `brand_diagnostic_cases` and associated facts/scopes remain the profile store. UI renames the experience to Product Profile and does not claim an output baseline exists merely because profile fields were saved.

### Seed Query Set
New additive tables:
- `baseline_query_sets`: workspace, profile/case, name, market pack, locale, generation mode (`template` / `llm-assisted`), status (`draft`, `approved`, `superseded`), source profile version, timestamps.
- `baseline_seed_queries`: query set, sequence, question, intent, rationale, market, locale, priority, status (`draft`, `approved`, `excluded`), generation provenance, timestamps.

Generation is deterministic from product category, audiences, intents, existing evidence, and market pack. A future LLM may propose additional wording only through the configured provider route, and every model-generated question must be marked as such and reviewed before task creation.

### Test Run and Collection Task
New additive tables:
- `real_surface_test_runs`: profile/case, query set, name, market, locale, collection mode fixed as `controlled_manual`, state (`draft`, `active`, `collecting`, `ready_for_review`, `baseline_ready`, `closed`), session/search requirements, timestamps.
- `real_surface_collection_tasks`: test run, seed query, platform, provider family, task state (`unassigned`, `claimed`, `submitted`, `needs_revision`, `reviewed`, `failed`, `skipped`), operator, claimed/submitted timestamps, failure reason, attempt number.
- `real_surface_observations`: task, raw answer, citations JSON, answer URL, capture reference, fresh-session flag, search-enabled flag, platform label/version, observed timestamp, submitted/reviewed by and timestamps, reviewer note.
- `real_surface_audit_events`: workspace, entity type/id, action, actor, payload JSON, created timestamp.

Task uniqueness is Test Run × Query × Platform. The server creates the complete matrix transactionally and ignores duplicate request retries. Claiming uses a conditional transition so two operators cannot claim the same open task.

### Baseline Readiness
Readiness is derived server-side: a Test Run becomes `ready_for_review` after all non-skipped tasks have observations; it becomes `baseline_ready` after those observations are reviewed. The change exposes counts and readiness only; metric calculation and GEO diagnostic remain downstream modules. No client can set baseline status directly.

## API

- `POST /api/workspaces/:workspaceId/brand-diagnostics/:caseId/baseline-query-sets/generate` — create a draft query set from profile data; accepts selected market pack and requested count 5–20.
- `GET /api/workspaces/:workspaceId/brand-diagnostics/:caseId/baseline-query-sets` — list summary and current queries.
- `PATCH /api/workspaces/:workspaceId/baseline-query-sets/:querySetId/queries/:queryId` — revise or approve a query; server validates meaningful question text, market, and status transitions.
- `POST /api/workspaces/:workspaceId/brand-diagnostics/:caseId/real-surface-test-runs` — create controlled-manual matrix from approved queries and selected supported platforms.
- `GET /api/workspaces/:workspaceId/real-surface-test-runs/:testRunId` — return run progress, tasks, and environment checklist.
- `POST /api/workspaces/:workspaceId/real-surface-test-runs/:testRunId/tasks/:taskId/claim` — claim an open task using current actor identity.
- `POST /api/workspaces/:workspaceId/real-surface-test-runs/:testRunId/tasks/:taskId/observation` — submit raw real-surface evidence with structured citation links and context flags.
- `POST /api/workspaces/:workspaceId/real-surface-test-runs/:testRunId/tasks/:taskId/review` — accept or request revision; recompute run readiness.

### Supported platforms

The server validates only explicit, current MVP labels: DeepSeek, 通义千问, 豆包, Kimi, 元宝, 智谱清言（GLM）, 文心一言, ChatGPT, Gemini, Claude, Perplexity. Market packs provide recommended defaults (CN / US), but a user may choose an approved subset.

## UI / Interaction

### Navigation

**Project settings** (un-numbered): Project overview, Product profile, Owned sources & evidence, Market & ICP, Competitor seeds.

**GEO workflow**: 01 Core Queries & first baseline, 02 Multi-platform real test, 03 Visibility & citation baseline, 04 GEO diagnosis, 05 Query research, 06 Industry & competitor research, 07 Content strategy & AI writing, 08 Content action & retest, 09 Reports.

**Operations & governance**: Continuous monitoring, Harness management. They appear below a visible divider.

### First-baseline workspace

- Header: current phase, concise value statement, T0 status, last activity, primary action.
- State A, no query set: explanatory empty state with inputs limited to Market Pack and 5/10/15/20 target questions; primary “Generate core queries.”
- State B, draft queries: table with question, intent, market/language, rationale, provenance, edit/approve/exclude controls; bulk approval action is disabled until all selected questions validate.
- State C, approved query set: compact Test Run form that explains real-platform manual collection, creates platform matrix, and presents platform checkboxes preselected per market.
- State D, active run: queue dashboard with progress counts, filters, task cards/table, claimed-state ownership, copyable standard test instructions, and an evidence entry drawer/modal. The UI must clearly say that the operator performs the question on the real platform; the product never claims it sent the prompt.
- State E, review: list submitted evidence and reviewer action. Once ready, direct to phase 03 instead of displaying a faux “diagnostic report.”

### Error and accessibility states

All network operations render loading and error recovery. Forms validate on blur and at submission. Buttons retain semantic labels and visible focus. Status chips use text plus color. Tables collapse into labeled cards on small screens. The layout must not introduce horizontal body scrolling.

## Security / Governance

Raw imported answer text and evidence links are workspace-scoped. Observations keep actor and timestamps. The system rejects unsupported collection modes and does not store third-party user credentials. The baseline is not marked ready without reviewed evidence.

## Migration / Compatibility

New tables are additive and link to the existing diagnostic case. Existing cases display as “Product profile ready” when sufficient facts exist, otherwise “Complete your profile”; no existing baseline is manufactured. Current manual import behavior remains available until it is bridged to the new task-record API.

## Validation Plan

- Server tests cover query generation count/content/provenance, approvals, matrix creation, duplicate prevention, task claim conflicts, validation of real-surface evidence, review transitions, and workspace isolation.
- UI tests cover empty, draft, active queue, submit-error, and baseline-ready pathways.
- Run TypeScript, Vitest, server tests, release checks, Vite build, and a local rendered desktop/mobile inspection of the changed screens.

## Amendment — generation and configuration design

### Query generator

The first-baseline workspace starts with an explicit source chooser: **AI 生成** or **手动创建**. AI mode presents compact inputs in the order operators need them: project/profile, market, keywords, intent chips, prompt version, model connection, target count and a primary generation action. If no executable connector exists, the primary action is disabled with an explanatory CTA to `模型与 API 连接`; an operator may instead explicitly select `模板草案` and the resulting rows are labelled `模板`.

A query-set review table is paginated at exactly 10 items per page. Each row shows question, intent, priority, provenance (`LLM` / `模板` / `手动`), and state. Approval controls operate on rows without resetting the current page. Manual creation uses a focused drawer/form and places the created row in the same set.

### Connections and prompt governance

Add an unnumbered `模型与 API 连接` page under Operations & governance. The page owns server-side connection configuration and a default versioned `核心 Query 生成 Prompt`. Connection configuration is only for an OpenAI-compatible Chat Completions implementation in this increment; unsupported catalogue labels can be stored only as controlled-manual and must not claim to execute. The connection form captures provider label, collection mode, endpoint URL, model, API key update and enabled state. Key values are write-only and return only a masked credential indicator.

The persistence layer records prompt versions and generation invocations separately from output Query sets. Invocation storage contains no plaintext secret. Outputs are accepted only after strict JSON shape validation, canonical deduplication and count-bound enforcement; failures are reported as non-secret statuses and never silently substituted with LLM provenance.
