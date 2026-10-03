# Design

## Context

See `proposal.md` for motivation and the capability deltas for externally observable requirements. The current service already persists versioned `query_datasets`, review decisions, provider configurations, assessment observations and a manual collection queue, but `collection_mode` is restricted to `controlled-manual` and the API rejects other modes. The frontend's collection page consequently centers on a single-task handoff to a provider portal. The revised product decision is that a customer-side Browser Agent, not Provider API output, is the formal path for real-platform GEO baselines. Existing content entities (`content_briefs`, `content_drafts`, approved snapshots and distribution tasks) already retain high-level evidence-pack references, while `ai_invocations` exists for audit metadata.

The implementation must preserve the following observed constraints:

- current SQLite repository and local artifact storage are the source of truth for the MVP;
- all tenant-scoped records are workspace-isolated and write audit events;
- a Dataset version is already associated with an assessment run and must remain reproducible;
- operators need Chinese, action-oriented workflow pages;
- the first delivery cannot assume credentials for DeepSeek, Qwen, Doubao, Kimi, Yuanbao, GLM, ERNIE, ChatGPT, Gemini, Claude or Perplexity.

## Goals / Non-Goals

**Goals:**

- Replace manual copy/paste as the default collection workflow with a customer-authorized Browser Agent that runs approved Queries in the customer's real, visible browser environment.
- Treat Browser Agent observations as the only formal webpage GEO baseline; official API, enterprise gateway and MCP output may be retained as supplementary research data but must never be represented as webpage baseline results.
- Make each proposed Query explainable before approval, then immutable once it participates in a formal run.
- Process independent Query × Platform × Repetition units with per-device and per-platform limits, restart-safe progress and clear manual fallback.
- Store retained raw evidence separately from normalized analysis, so later extraction and metrics changes do not rewrite history.
- Ground every generated Content Brief and channel draft in identified evidence, Query Gap and claim-validation outcomes.

**Non-Goals:**

- Build a cloud-side browser bot, bypass logins/CAPTCHAs/anti-bot measures, scrape protected model UIs, export browser cookies, or evade third-party platform terms.
- Ship active credentials, cookies or direct production integrations for every listed model provider in the first implementation. The first working adapter is a customer-authorized Doubao browser-adapter reference path plus a deterministic test adapter; every additional platform requires explicit adapter review and validation in a customer-owned browser environment.
- Automatically publish to content channels. Publication remains an approved human or explicitly authorized channel integration step.
- Treat LLM extraction, scoring, or generated prose as verified provider facts without linked evidence and human review gates.

## Decisions

### 0. Browser Agent is the formal GEO-baseline execution path

A real-platform baseline is collected only through a customer-authorized Browser Agent running in a customer-controlled browser profile. The SaaS control plane creates immutable `Query × Platform × Repetition` units, but never receives passwords, cookies or a browser profile. A customer user logs into each platform locally, chooses a dedicated test profile, reviews the planned workload and explicitly starts the batch.

The Browser Agent maintains an outbound authenticated connection, reports device and adapter readiness, requests only scoped work items, and uploads a bounded evidence package. Each package includes the original visible answer, page-visible citation URLs, capture timestamps, platform/adapter version, test environment metadata and an integrity hash. Screenshots or structured page snapshots are optional evidence artifacts; they must never include unrelated browsing history.

`browser-agent` and `controlled-manual` are valid formal baseline collection modes. `official-api`, `enterprise-gateway` and `mcp` modes are supplementary research modes only: the product labels them as non-baseline and prevents them from completing a real-platform T0 baseline. Browser automation stops and requires human action whenever login expires, a verification/CAPTCHA appears, consent is missing or a platform adapter cannot reliably identify the intended page elements.

The first production-facing adapter target is `doubao-web`. It uses a customer-installed Chromium extension plus a local agent registration protocol, runs a new visible conversation per attempt, records the observed search state where identifiable, and exposes platform-specific limits (default one task per account at a time).

### 0.1. One-click local start is an explicit, time-bounded authorization

The former local-only extension click is replaced by a controlled handoff: an authorized operator starts a specific test run from the SaaS UI, selects an online Browser Agent and confirms its target platform. The server creates a short-lived, single-use `browser_agent_start_request` bound to the workspace, agent, test run and platform. It has an opaque nonce, a requester/audit trail, an expiry and explicit lifecycle states: `requested`, `acknowledged`, `launching-browser`, `waiting-login`, `running`, `completed`, `failed`, `cancelled`.

The local Agent receives only its own active request through authenticated polling. Once acknowledged, it may launch or focus only the operator-preconfigured browser executable and local Profile, then navigate to the adapter's known platform URL. It neither reads, exports nor uploads cookies, credentials, browser history or profile files. The extension polls the localhost Agent for the active authorization and invokes its existing batch-resume path automatically. Popup start/pause remains an operator-visible fallback.

A start request is not background authorization: it expires quickly, can be cancelled from the SaaS UI, cannot start a different run or platform, and must halt with `waiting-login` or `needs-human` when the platform session needs login, consent, CAPTCHA, an unsupported page state or an adapter selector failure. The SaaS UI polls the run and start request status so operators see browser launch, adapter readiness, current Query, completed/pending/attention counts, last sync and readable failure reasons.
### 1. Use a single Provider Adapter contract behind an Execution Gateway

The server will introduce a provider adapter registry that resolves configured adapters by an immutable configuration snapshot. Each adapter presents a small common contract:

```text
capabilities() -> supported providers/models/locales, execution modes, limits
validateConfiguration(configRef) -> usable | blocked with operator reason
execute(request, idempotencyKey) -> accepted/completed/failed + raw response artifact
normalize(response) -> answer text, citations, response metadata
```

`executionMode` is one of `official-api`, `enterprise-gateway`, `mcp`, or `controlled-manual`. The last mode remains a fallback adapter that produces a work item rather than running a browser. Credential material stays in the configured secret store/reference and is never passed to browser clients or written into the database/result artifacts.

**Why:** this decouples workflow behavior from a provider-specific API and supports the customer requirement to plug in MCP or internal gateway capability without making unofficial web automation the product's core.

**Alternatives considered:**

- Provider-specific endpoints in the frontend: rejected because it leaks complexity, makes concurrency handling inconsistent, and cannot safely hold credentials.
- Browser automation as a universal adapter: rejected because it is fragile, violates the required authorization boundary, and cannot guarantee reproducible enterprise execution.
- A generic “LLM API” only: rejected because companies commonly route models through a gateway or MCP server, which needs capability discovery and a distinct audit boundary.

### 2. Persist execution units and dispatch asynchronously

An assessment Run will create immutable execution units keyed by `(assessmentRunId, queryId, providerConfigSnapshotId, modelIdentity)`. A database-backed queue/lease record will hold status, attempt count, scheduled retry time, idempotency key and worker ownership. The API will only enqueue, cancel where allowed, and read progress; a server-side dispatcher invokes adapters up to the per-config concurrency and rate-limit budgets.

The initial service will run the dispatcher in-process with safe startup recovery and a testable clock/adapter seam. Its persisted state allows a later dedicated worker process to claim the same queue without changing the public API or evidence schema.

**Why:** database persistence gives deterministic recovery and auditability in the project’s existing SQLite architecture while avoiding a premature external queue dependency.

**Alternatives considered:**

- Browser-side `Promise.all`: rejected because it exposes credentials, stops on page close and cannot safely rate-limit or audit.
- A new hosted queue dependency now: deferred because the current product has no deployment topology or worker infrastructure; the job contract is designed for extraction later.
- Sequential execution: rejected because it fails the user requirement for production throughput.

### 3. Add Query Research as a provenance-first staged workflow

Query research will use a `query_research_job` and per-query `query_candidate` model. A job references only an approved/explicitly chosen fact pack, allowed public sources, customer-question imports, competitor set, target market/persona and optional seeds. An LLM generation invocation is stored through the existing AI-invocation audit concept with additional prompt template version, input evidence references and model identity.

The pipeline is:

```text
input pack → LLM candidate generation → deterministic validation / normalization
→ semantic or lexical deduplication + clustering → quality/risk scoring
→ reviewer edits/approves/rejects → immutable Query Dataset version
```

Candidates do not silently become Dataset items. Generation carries `generationMethod` (`llm`, `imported`, `manually-authored`), `generationRationale`, `sourceEvidenceIds`, model and prompt versions. Rule checks flag unsupported capability language; LLM quality assessment is advisory and recorded as an inference, not a fact.

**Why:** it answers “where did this Query come from?” at the per-Query level and permits future connectors such as Search Console, CRM, ticket systems or CoreNote without redefining the data model.

**Alternatives considered:**

- Seed 100–200 opaque questions in the database: rejected because customers cannot audit relevance, bias, or content claims.
- Generate queries directly into approved datasets: rejected because it prevents editorial governance and reliable re-runs.

### 4. Separate immutable evidence from derived analysis

Successful adapter results are stored as raw artifacts plus a normalized observation envelope. Citation parsing, brand/competitor recognition, recommendation position, claims and confidence are stored as analysis revisions referencing evidence offsets/links and analysis method/version. No process may update the raw artifact or make a derived analysis look like provider-supplied content.

Manual input uses the same envelope but has `collectionMethod: controlled-manual`, `importedBy`, source platform and verification status. Metrics and reports read the collection method so their limitations can be disclosed.

**Why:** preserving primary evidence lets the customer audit link frequency and answer interpretation, which is the central result of the harness.

**Alternatives considered:**

- Store parsed fields only: rejected because citations and AI wording cannot later be verified.
- Overwrite existing observations on re-run: rejected because it destroys baseline/follow-up comparability.



### 4.1. Make time-series visibility explicit without fabricating history

The Visibility Baseline view will aggregate only reviewed observations with non-empty raw answers into daily, weekly and monthly platform-specific mention-rate points. Its default comparison cohort is locked to the displayed T0's `querySetId`, market pack and locale. The UI makes those scope boundaries visible, exposes daily / weekly / monthly and 30-day / 90-day / all-history controls, supports individual platform series toggles, and reveals the numerator and denominator for the selected point.

A bucket with no comparable reviewed evidence renders as a gap rather than a zero. The view does not backfill synthetic points, interpolate between runs, or mingle altered Query datasets with the T0 trajectory. This keeps a sparse early trend honest while still allowing a customer to inspect the platform-specific result as repeat tests accumulate.


The same comparability filter also powers a second platform-specific trend for owned-domain citation rate. It uses the reviewed-answer count as the denominator and only a citation URL that matches the customer-owned domain as the numerator; an external URL or an empty citation list is never treated as a self citation. Under both trends, a paginated Query × platform matrix surfaces the current T0's operational state: self-citation, mention-only, reviewed-not-mentioned, pending review, failed, not collected, or not applicable. The matrix is evidence-state-first rather than score-first, so it does not turn incomplete execution into negative performance. Selecting a matrix cell exposes the underlying review count and available rates before an analyst acts on it.

The measurement page additionally distinguishes the **market support catalog** from the **current run scope**. For a Chinese market run it lists DeepSeek、通义千问、豆包、Kimi、元宝、智谱清言（GLM）和文心一言; for a United States run it lists ChatGPT、Gemini、Claude 和 Perplexity. Each row declares whether Query × platform tasks were actually created, how many genuine answers were returned, how many were reviewed, and the reviewed mention / owned-link counts. A platform outside the run scope, or a scoped platform without a returned answer, is rendered as `未纳入` / `—` / an operational collection state rather than `0%`. Aggregate cards only add up platforms actually scoped into that run. Trend legends retain every supported market platform and mark unscoped ones, while the daily chart uses a natural-day tick and full date disclosure in its tick/data-point affordances. This allows the UI to remain informative with a sparse first run without inventing measurements.


The dashboard treats UI freshness separately from platform evidence. A completed or review-pending baseline is stable and only rereads source data on page entry or an explicit manual refresh. Five-second silent polling is reserved for an active authorized Browser Agent batch, so incoming evidence can appear promptly without resetting the dashboard or falsely presenting a timer as real-time GEO measurement. A future 08:00 / 17:00 cadence can create a retest request, but may not open a third-party platform or change formal metrics until the customer-side Browser Agent receives explicit start authorization.

### 6.3. Manage Dataset history in a compact drawer

Query Dataset history is an operational governance concern, not a separate workflow destination. The Query Research and real-platform testing surfaces therefore use one compact, focus-managed right-side drawer rather than a new page. The drawer lists every Dataset version for the current project, shows its market/locale, lifecycle, approved/excluded counts, current-version marker and whether formal testing has begun, and provides lifecycle-safe actions.

A Dataset has two independent facts: its immutable content lifecycle (`draft`, `in_review`, `ready_for_test`, `locked_for_baseline`, `superseded`) and its visibility in active operational selectors (`archived_at`, `is_active`). Archive is reversible and preserves all queries, test runs, observations, diagnostic inputs, reports and audit history. Only one non-archived Dataset per workspace/project can be marked current. Newly generated or revised Datasets become current so the operator has an explicit working version; when the current Dataset is archived, the system selects the most recently usable non-archived version or leaves no current version.

Only an unreferenced draft Dataset may be permanently removed. The API requires an administrator, the exact Dataset name as confirmation, and proof that no real-platform Test Run references it. Published, frozen, superseded, or tested Datasets remain auditable and can only be archived or copied into a new draft. Each archive, restore, activation and deletion action emits a workspace-scoped audit event.

Operational Dataset selectors in real-platform testing intentionally show only non-archived, ready/locked Datasets with at least one approved Query. This avoids accidental selection of empty drafts while preserving full historical access in Query Research. Individual approved Queries can be soft-excluded in an editable Dataset; excluded Queries do not enter coverage totals or new Test Runs, while any Query already used by a Test Run remains immutable.

**Why:** history remains traceable without flooding the day-to-day testing selector, and deletion cannot break completed GEO evidence.

**Alternatives considered:**

- A dedicated Dataset management page: rejected because it fragments a short administrative task and interrupts Query research/testing context.
- Hard-deleting every unwanted Dataset: rejected because it could invalidate test, diagnostic and report provenance.

### 5. Evidence-led Content Studio extends the current content entities

A Content Brief will gain structured source links to target Query cluster(s), the selected Query Gap/diagnoses, fact/evidence items, competitor observations, prohibited claims, channel constraints and acceptance criteria. Draft generation uses a versioned prompt and stores a claim-to-evidence map with each draft. Claim validation blocks approval/distribution if a required claim has no approved evidence, an explicit prohibited-claim match, an invalid required link, or unresolved channel policy condition.

Existing approved snapshots and distribution tasks remain the publication handoff. Recording a post creates a linked publication proof and permits scheduling a follow-up run against the same approved Dataset; the reporting layer labels baseline and post-publication observation distinctly.

**Why:** the current content data model is already versioned and reviewable, so adding evidence lineage is less disruptive than introducing a separate content subsystem.

**Alternatives considered:**

- General text generator button: rejected because it cannot explain content quality or stop unsupported promotion claims.
- Automatically post from a generated draft: rejected because human/channel approval is a required governance boundary.

### 6. Offer a production-oriented but staged UI

The Query Lab will become an explicit “Query 研究” workflow: select sources and target market → generate candidates → review reasons/duplicates/risk → approve dataset. Assessment launch will show per-provider integration availability, one action to run authorized providers in batch, and a distinct manual fallback count. The results view will show completion progress, raw answer/citation evidence, method label, model/run metadata, and analysis explanation.

The Content view will start from a diagnosed gap and show evidence coverage before exposing generation. This avoids presenting LLM copy as the user’s next task before inputs are ready.


### 6.1. Keep project lifecycle controls explicit and non-destructive by default

The project list and project detail expose deletion as a secondary destructive action, never as the primary workflow CTA. A permanent delete requires an administrator to type the exact project name, names the dependent data that will be removed, performs the deletion in one transaction, and writes a workspace audit record after the project records are gone. The detail header removes the empty horizontal overview rail: the lifecycle summary is the default context and its existing contextual controls route users to the next actionable section.

## Risks / Trade-offs

- [Provider API contract, quota, or model output format changes] → Adapter capability negotiation, per-provider snapshots, normalized error codes, contract tests and a manual fallback.
- [A single in-process worker is unavailable during redeploy] → persisted leases, retry scheduling and startup recovery; keep execution ownership abstract for later dedicated worker deployment.
- [LLM-generated Queries skew generic or introduce false product implications] → require source inputs, display per-query rationale, rule risk flags, duplicate clustering and human approval.
- [LLM extraction incorrectly interprets a recommendation or citation] → retain raw artifacts, evidence offsets, confidence/method labels, and allow reviewer correction without rewriting primary evidence.
- [Raw model answers contain sensitive customer context] → workspace isolation, strict artifact authorization, configurable retention/deletion policy, and no secrets in result payloads.
- [High parallelism incurs unbounded cost] → provider-level concurrency/rate/cost ceilings, preflight quantity estimate, usage ledger and stop/cancel controls.
- [Content still becomes generic despite evidence] → require explicit Query Gap, source pack and channel structure in every approved Brief; block unsupported claims at approval.

## Migration Plan

1. Add additive tables/columns for research jobs/candidates, integration capabilities, execution units/leases, evidence-analysis revisions, content-evidence mapping and publication/retest linkage. Keep existing manual records valid.
2. Migrate existing `controlled-manual` provider configurations to the adapter configuration model and preserve them as fallback integrations.
3. Backfill existing query items as `imported` with an explicit “legacy seed / provenance unavailable” status, never as LLM-generated; expose this status for review before reusing them in a new approved Dataset.
4. Release adapter registry and deterministic test adapter first, then enable the gateway/MCP reference adapter only for configuration-tested tenants.
5. Release Query Research and evidence views before making batch execution the dashboard primary action; keep “人工导入” as a clearly labeled fallback.
6. Deploy content-evidence validation in warning mode for existing drafts, then enforce it for newly created briefs/drafts after migration verification.
7. Roll back by disabling automatic adapter modes at configuration level. Queued/running units become paused or manual-fallback; historical observations, datasets and artifacts remain readable.

## Open Questions

- The first real external adapter needs an enterprise-owned endpoint and credential/reference format. This does not change the architecture or task breakdown; implementation will ship the adapter contract, test adapter and configuration UX without embedding a third-party key.
- Pricing/cost normalization differs by provider. The initial schema stores provider-reported usage/cost where available and “not reported” otherwise; cross-provider cost allocation rules can be added after commercial requirements are set.

## Domestic platform browser-adapter registry

The local Agent SHALL advertise a registry of supported domestic web adapters: `doubao-web`, `yuanbao-web`, `deepseek-web`, `wenxin-web`, `glm-web`, and `kimi-web`. A platform entry supplies the only permitted homepage and the extension content-script match pattern. The server continues to schedule a task only when its selected platform is declared by the paired Agent.

The browser extension SHALL use one adapter-neutral controller for launch authorization, task handoff, progress reports and evidence delivery. Platform profiles provide bounded DOM selectors for input, send controls, assistant-message identification, stop/loading indicators, visible source panels and login/captcha detection. Dispatch must select a tab whose hostname matches the task platform; it must never send a selected platform's Query into a different platform tab. A failure to identify an expected page element must return `needs-human` with the platform-specific reason, rather than guessing or retrying indefinitely.

The UI shall distinguish **available on this device**, **requires login**, **running**, **captured**, and **needs human attention** for every selected platform. The default remains one visible browser task at a time per device; selecting several platforms creates separate platform tasks that advance serially under explicit batch authorization.

## 2026-09-29 Content Studio interaction refinement

### Problem observed
The earlier four-step Content Studio exposes governance objects as a multi-field strategy form. For an operator who has already selected a diagnosis, most of those fields are system-derived, so the page makes the user recreate the evidence model manually and does not make an LLM invocation or writing style legible.

### Revised interaction model

The active Content Studio becomes a three-step, progressive-disclosure workflow:

1. **Select opportunity** — choose a genuine Diagnosis / Query Gap. Show scope, uncertainty and evidence availability. No free-text strategy form.
2. **AI plan & Brief** — select channel, content format and a named writing profile. The application compiles the diagnosis, immutable Query scope, approved evidence, source/competitor context and prohibited claims. The user presses `AI 生成内容方案`; the selected verified model returns an editable content plan/Brief. Advanced CTA, internal-link and acceptance controls live in a collapsed review section.
3. **AI write & review** — select the approved plan, inspect provider/model and prompt-profile version, invoke the model to draft, then edit/review claims. Approved drafts can be copied/downloaded for manual external upload.

The existing publication and retest records are retained for compatibility, but the current Content Studio release does not display the publication/retest tab. A later measurement is triggered separately from the monitoring flow after manual channel upload.

### Content prompt profile contract

A content prompt profile is a versioned configuration composed of:

- a name and intended channel / audience;
- a system instruction with evidence and non-guarantee boundaries;
- writing style/tone and structure directives;
- channel-specific adaptation; and
- an output contract (plan JSON or Markdown draft).

The system renders the profile against the evidence-bound briefing context. Each LLM invocation records the chosen model/provider, profile/version and rendered prompt metadata. The user sees this data in a compact “AI execution” strip. Deterministic template generation remains available only as a labelled fallback and never appears as an AI invocation.

### UI decisions

- Use a single primary action per step; never ask the user to fill system-derived fields before that action.
- Keep evidence lineage in a collapsed/side review area so it remains auditable without competing with the task.
- Use labelled, controlled selects for channel, format, profile and model; do not use placeholder-only form fields.
- Use `aria-live="polite"` for generation, save and review state changes.
- For manual delivery, provide `复制 Markdown` and `下载 Markdown` only after draft approval and label them as manual upload material, not as published output.

### 5. Domestic adapter evidence-completeness gate

A browser task cannot be marked `completed` merely because an automation selector found visible text. The page adapter binds the response to the just-submitted Query and captures the full current assistant-message root. A DeepSeek source disclosure such as “12 个网页” is treated as a current-answer source control: the adapter opens only that visible control, reads only the newly opened result drawer, scrolls the drawer when needed, and records visible result URLs and displayed search-term chips without opening external links. 元宝 validates that the captured element is a current assistant-message container rather than a quick-action chip, prompt suggestion, or navigation text; when this cannot be proven, the task becomes `needs-human` with a page-specific reason. The product surfaces source/answer completeness and adapter readiness so an unavailable 文心一言 or 通义千问 lane is actionable rather than indistinguishable from an empty measurement.

## Domestic real-page completion and table-evidence hardening

The documented homepage for a platform is an execution boundary, not a brand landing page. 文心一言 launch SHALL use the customer-visible chat entry at `https://yiyan.baidu.com/`; legacy ERNIE hosts may remain recognized only for compatibility with an already-open valid chat tab and must not be selected as the new-browser launch target.

For every domestic adapter, answer discovery SHALL select the smallest visible assistant turn that is after the current submitted-user anchor. A broad conversation shell that contains multiple user/assistant turns is not an answer root. If a framework reuses a DOM node for the next turn, a changed task-bound assistant text may qualify only after the current Query has been submitted and the prior snapshot proves the text is new. Completion reports are queued by the extension background relay and an execution-side delivery failure is surfaced as a terminal, diagnosable task result rather than silently waiting for a watchdog.

Evidence text serialization SHALL retain page-visible data tables inside the selected assistant answer. Native HTML tables and visible ARIA table/grid structures are normalized into escaped Markdown tables, appended under a labelled table-evidence section, and counted in capture metadata. The collector never invents headers, rows, URLs, or values not exposed in the current answer DOM.


### 6.2. Keep Query coverage inspection inside Query Research

The Query Research workspace exposes three views of the same active Dataset: list, coverage map, and generation/fill. The coverage map is a compact Query-type × journey matrix rather than a decorative graph. Every cell reports eligible Query count, configured target and coverage state; target zero is an intentional non-applicable state. A detail panel exposes the filtered Query list and routes to either contextual AI generation or manual creation. Targets are persisted per Dataset version, copied into a revision, and immutable after publication/freeze so historical baseline scope remains reconstructable.
