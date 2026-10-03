# Tasks

## 1. Browser Agent data contracts and safe migration

- [ ] 1.1 Add additive SQLite migrations for Browser Agent devices/enrollment, platform-adapter readiness snapshots, browser execution units/attempts, immutable visible-evidence envelopes, manual-fallback linkage, plus existing query-research/evidence entities; verify a clean database migrates successfully and existing fixture data remains readable.
- [ ] 1.2 Extend repository serializers and frontend domain/API types for Browser Agent enrollment/readiness, platform execution plans, Query × Platform × Attempt progress, browser evidence provenance, manual fallback linkage, claim-to-source mappings, and publication evidence; verify TypeScript compilation and repository round-trip tests preserve all new fields.
- [ ] 1.3 Migrate existing controlled-manual provider configurations and legacy seed queries without fabricating provenance; verify legacy entries show `controlled-manual` and `legacy provenance unavailable`/`imported` status rather than LLM-generation metadata.
- [ ] 1.4 Document data-retention, secret-reference, and workspace-isolation rules for the new entities in `docs/`; verify no API or artifact payload schema includes plaintext credentials.

## 2. Browser Agent and platform-adapter execution gateway

- [ ] 2.1 Define a server-side execution registry and capability contract for `browser-agent`, `controlled-manual`, and non-baseline supplementary `official-api`/`enterprise-gateway`/`mcp` modes; verify no non-browser mode can complete a formal webpage baseline.
- [ ] 2.2 Implement administrator-only Browser Agent enrollment, device revocation, readiness/heartbeat and immutable platform-adapter configuration snapshots; verify a Run retains the original device/adapter snapshot after later changes.
- [ ] 2.3 Implement a deterministic Browser Agent test adapter plus the first `doubao-web` extension/local-agent adapter protocol; verify contract tests cover queued, accepted, completed, needs-human, retryable-failure, terminal-failure and citation-bearing responses.
- [ ] 2.4 Preserve controlled-manual as a fallback adapter linked to the same execution unit; verify the fallback never invokes browser actions, and that Browser Agent enrollment never requests or uploads customer passwords/Cookies.
- [ ] 2.5 Add Browser Agent operator, privacy and platform-adapter documentation, including explicit prohibition on bypassing login, access control, CAPTCHA/anti-bot mechanisms or platform terms; verify README/operator guidance matches behavior.

## 2A. SaaS-initiated local Browser Agent launch

- [x] 2A.1 Add a workspace-isolated, expiring and auditable Browser Agent start-request record and authenticated APIs to create, poll, acknowledge, advance, cancel and inspect it; verify another agent, platform or run cannot consume it.
- [x] 2A.2 Add local Agent browser launch configuration and a Windows implementation that opens or focuses only a user-preconfigured browser executable/profile and the requested platform homepage; verify no Cookie, password, profile data or CAPTCHA is read, sent or bypassed.
- [x] 2A.3 Extend the browser extension to detect a valid localhost start authorization, acknowledge it, automatically resume the authorized batch and preserve popup start/pause as a fallback; verify stale, cancelled and mismatched authorizations do not run.
- [x] 2A.4 Add Chinese batch-page controls and live progress for one-click local launch, Browser/extension readiness, current Query, completion counts, last synchronization, cancellation and human-attention reasons; verify users can understand the required local action without reading logs.
- [x] 2A.5 Add server, local-Agent and extension protocol tests for start-request expiry, authorization isolation, lifecycle transitions, browser-launch failure, auto-resume and task-result synchronization; run applicable test and production-build suites successfully.
- [x] 2A.6 Harden local start authorization so an Agent's active Test Run, current start request, claimed task and late result are strictly bound to the newest explicitly started `testRunId + platform`; safely requeue superseded leases and add regression coverage.
## 3. Browser execution scheduling, progress, and audit

- [ ] 3.1 Create immutable execution units for each eligible Run × Query × Platform × Repetition × Browser Agent snapshot combination with idempotency keys, state transitions, attempts, scheduling and lease metadata; verify duplicate requests do not produce duplicate completed observations.
- [ ] 3.2 Implement a recoverable Browser Agent dispatcher that claims eligible units up to per-agent and per-platform concurrency/interval limits; verify independent platforms can progress without exceeding configured limits.
- [ ] 3.3 Implement retry, backoff, timeout, cancellation/pause, startup recovery and terminal-failure handling; verify transient failures retry without blocking unrelated units and restarts recover leased work safely.
- [ ] 3.4 Record timing, Browser Agent/adapter snapshot, test-environment metadata, failure codes, actor and audit events for every execution attempt; verify run-detail APIs expose progress without exposing secrets, Cookies or passwords.
- [ ] 3.5 Add server tests for mixed browser-agent/manual runs, per-platform throttling, idempotency, retry/recovery, tenant isolation and audit records; run the server test suite successfully.

## 4. Query Intelligence and governed Dataset approval

- [ ] 4.1 Implement Query Research job creation from selected evidence/fact sources, customer-question inputs, ICP, markets, competitors, taxonomy and optional seeds; verify requests without the required minimum source input are rejected.
- [ ] 4.2 Add an LLM generation adapter seam that records model identity, prompt version, input evidence references and output linkage using the existing AI-invocation audit pattern; verify deterministic test generation returns per-Query rationale and provenance.
- [ ] 4.3 Implement candidate normalization, locale/market validation, duplicate clustering, quality/risk flags and priority scoring while preserving original candidate text; verify unsupported capability language is flagged and not automatically approved.
- [ ] 4.4 Add reviewer APIs to edit, approve, reject and group candidates into a draft Dataset; verify only approved Dataset versions can launch a formal assessment and revisions leave prior approved versions unchanged.
- [ ] 4.5 Build the Chinese “Query 研究” workflow UI with source selection, generation progress, rationale/duplicate/risk review, and versioned approval actions; verify a user can trace every displayed Query to its generation method and source references.
- [ ] 4.6 Add unit/integration tests and operator documentation for manually authored, imported and LLM-generated Query paths; run frontend tests and query-governance server tests successfully.
- [x] 4.7 Add a persisted Query Coverage Map for the active Dataset version: Query type × journey cells, default and reviewer-calibrated targets, not-applicable handling, gap drill-down and direct generate/manual fill actions; verify project/version isolation, immutable Dataset protection, responsive Chinese UI, and frontend/server regression coverage.
- [x] 4.8 Add compact in-context Query Dataset history management: archive/restore, unique current-version designation, administrator-confirmed deletion only for unused drafts, lifecycle-aware operational selectors, approved Query exclusion, tenant/immutability safeguards, Chinese responsive drawer UX, and frontend/server regression coverage.

## 5. Evidence normalization and result inspection

- [ ] 5.1 Store automatic and manual answers as immutable raw artifacts plus a normalized observation envelope with collection method, model identity, timestamps, citations and provenance; verify a citation-free response stores an empty citation list without inventing links.
- [ ] 5.2 Implement versioned structured analysis for brand mention, recommendation, position, competitor mentions, claims and link classification with method, confidence and evidence spans; verify clients can distinguish provider content from system inference.
- [ ] 5.3 Update assessment/run APIs and frontend results views to show batch progress, execution method, raw answer, source links, citations and analysis rationale in Chinese; verify manual imports remain visibly labeled and usable in metrics with their collection limitation.
- [ ] 5.4 Protect historical evidence from overwrite and ensure later runs create new observations; verify baseline/follow-up reports can read distinct time-stamped evidence for the same Query and provider.
- [ ] 5.5 Add API/repository/frontend regression tests for normalized citations, raw artifact authorization, analysis revisions, manual fallback disclosure, and baseline preservation; run the relevant suites successfully.
- [x] 5.6 Build a comparable historical platform mention-rate trend in the Visibility Baseline view with daily/weekly/monthly and range controls, platform series toggles, evidence-point numerator/denominator disclosure, and empty-period gaps; verify trend metrics never turn missing evidence into 0% and exclude changed Query/market/locale scopes.
- [x] 5.7 Add evidence-only owned-link citation trends and a paginated Query × platform visibility matrix; distinguish owned citation, mention-only, reviewed-not-mentioned, pending review, failed, not-collected and not-applicable states, and verify incomplete collection never becomes a synthetic 0% or “未提及”.
- [x] 5.8 Make monitoring refresh state evidence-aware: reserve five-second silent polling for active authorized Browser Agent batches, keep completed baselines stable, and label UI reads separately from real platform collection; verify no full-page flashing occurs during silent refresh.
- [x] 5.9 Add market-wide measurement coverage beside current-run performance: show every supported market platform, distinguish unscoped/unreturned/reviewed states, show real per-platform and scoped-aggregate answer/link counts, retain unscoped platforms in trend legends, and disclose natural-day dates without synthetic evidence; verify UI and metrics regression tests.

## 6. Evidence-grounded Content Studio and retest linkage

- [x] 6.1 Extend Content Brief creation to require or record target Query clusters, selected gap/diagnosis, source pack, competitor evidence, prohibited claims, channel rules, CTA, linking guidance and acceptance criteria; verify unsupported key claims are surfaced as risks.
- [x] 6.2 Generate channel-specific drafts only from a prepared Brief and store model/prompt metadata plus a claim-to-evidence map; verify a generated draft starts in review-required status and creates no publishing action.
- [x] 6.3 Extend claim validation to block approval/distribution when a material claim lacks evidence, violates a prohibited claim, has a failed required link, or has unresolved channel policy risk; verify reviewer resolution is audited before approval succeeds.
- [x] 6.4 Record post-publication URL, channel, timestamp and proof artifact against the approved snapshot, then support scheduling a retest against the same approved Dataset; verify reports distinguish pre-publication baseline from post-publication observations.
- [x] 6.5 Update the Chinese Content/Reports UI to present evidence coverage before draft generation and publication/retest linkage after review; verify no screen presents LLM output as an already-published or verified fact.
- [x] 6.6 Add end-to-end tests covering Query Gap → evidence-grounded brief → draft review → publication proof → follow-up run/report; document the enterprise review and rollout workflow.

## 7. Integration release verification

- [ ] 7.1 Seed a non-CoreNote-specific enterprise demo with provenance-visible queries, one configured test/gateway adapter, one manual fallback provider, citation-bearing observations and an evidence-grounded content brief; verify the demo does not hard-code CoreNote as product behavior.
- [x] 7.2 Run database migrations, server tests, frontend tests, lint/type checks and production build; verify all pass and record any intentionally unavailable external provider integrations as configuration-dependent.
- [ ] 7.3 Perform a role-based smoke test for administrator, analyst, reviewer and viewer across query generation, batch execution, manual fallback, evidence inspection, content approval and retest scheduling; verify unauthorized users cannot configure adapters, view other workspaces, or approve restricted steps.
## 0. Diagnostic-first frontend prototype

- [x] 0.1 Replace the dashboard-first primary navigation with a business-user workflow: Brand Diagnostics, Query Monitoring, Market & Competitor Research, Knowledge Assets, Content Actions, and Reports; place Harness management in a separate administrator area.
- [x] 0.2 Build a clickable four-step Diagnostic wizard that captures brand facts, makes Query generation provenance and human approval visible, selects a compliant collection path, and confirms the repeatable baseline scope.
- [x] 0.3 Build a diagnostic execution and report prototype that keeps task-unit detail secondary, distinguishes controlled-manual collection from authorized integration, and routes users to monitoring, research, assets, content, and reports.
- [x] 0.4 Provide interactive prototype views for Query monitoring, competitor/source research, evidence-governed knowledge assets, content briefs/draft review, reports, and the separate Harness configuration area.
- [x] 0.5 Use Chinese enterprise UI copy, visible interaction feedback, accessible semantic controls, and responsive layouts; validate with unit tests, production build, and rendered browser review before presenting for user acceptance.



- [x] 2A.7 Add and harden production domestic Browser Agent adapters for 元宝、DeepSeek、通义千问、文心一言、智谱清言（GLM）和 Kimi using the same explicit customer-side workflow as 豆包; drive launch/dispatch from the selected platform, isolate matching tab hosts, preserve a complete task-bound assistant answer, expand only current-answer visible source drawers (including DeepSeek “N 个网页”), emit platform-specific needs-human/readiness reasons, and add adapter/selection regression coverage.
- [x] 2A.8 Fix domestic real-page adapter regressions: submit 文心一言 queries through the current icon-only composer, fail closed while GLM is searching/generating so a later Query cannot interrupt it, and diagnose/restart stale local Agent capabilities before enabling 通义千问; add regression coverage.
- [x] 2A.9 Fix real-page completion regressions: launch 文心一言 at its chat entry, bind GLM/Qwen current-turn answers reliably (including later DOM-reused turns), preserve visible answer tables as Markdown evidence, and make terminal report delivery diagnosable/retryable; add focused adapter, registry and production-build regression coverage.
- [x] 2A.10 Fail closed for Qwen page chrome and source drawers, recognize Wenxin plaintext/role-based composers, narrow GLM generation state detection, and release expired local lanes so the next same-platform Query can continue; add regression coverage and validate production builds.
- [x] 2A.11 Recover Qwen task-bound answer capture for structurally valid current-turn cards that lack explicit assistant metadata; downgrade 文心一言 to controlled-manual collection in the registry, server and UI; add regression coverage and release validation.
- [x] 2A.12 Fix same-platform terminal-report handoff so Qwen and other serial platform lanes release the completed page task before background dispatches the next Query; add immediate two-Query race regression coverage and validate the versioned release build.

## 8. Project lifecycle controls

- [x] 8.1 Add an administrator-only, workspace-isolated permanent delete endpoint with exact-name confirmation, transactional cascade cleanup and a retained workspace audit event; verify mismatched confirmation and cross-workspace IDs cannot delete data.
- [x] 8.2 Add secondary project-list and detail-page deletion controls with a strong confirmation dialog, honest post-delete empty state, and no implicit demo-project recreation; remove the redundant empty overview tab rail and verify the focused frontend workflow.



## 6A. AI-guided Content Studio simplification

- [x] 6A.1 Add versioned reusable content prompt/writing profiles and content-capable model selection; retain provider/model/profile/rendered-prompt metadata for AI-generated plans and drafts, and fail closed when no verified content model exists.
- [x] 6A.2 Replace the manual strategy-first UI with the three-step opportunity → AI plan/Brief → AI write/review workflow; prefill controlled evidence context, keep advanced governance fields as progressive-disclosure review controls, and show an accessible AI execution status strip.
- [x] 6A.3 Replace the active publication/retest UI with reviewer-approved Markdown copy/download for manual external upload; preserve retained publication/retest APIs without treating them as current delivery or GEO impact.
- [x] 6A.4 Add server and frontend coverage for verified-model invocation, profile metadata persistence, no-model blocking, template fallback disclosure, manual-export gating, and the simplified Chinese workflow; update operator documentation and validate the production build.





