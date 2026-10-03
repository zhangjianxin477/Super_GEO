# Design

## Context

See `proposal.md` for motivation. The current Content Studio reads models, profiles, competitor query groups, and market packs, but intentionally empties opportunities, briefs, drafts, and publications because the stored content entities are workspace-scoped. The active GEO workflow, diagnosis records, and competitor research are already project-scoped. The implementation must not backfill a project relation by guessing from legacy content.

## Goals / Non-Goals

**Goals:**

- Create a secure project-scoped content data path without weakening workspace authorization.
- Make the source diagnosis, Query scope, evidence package, and delivery state visible to a user at every content-production step.
- Preserve reusable workspace-level model connections and writing profiles while recording immutable project-level execution artifacts.
- Improve the Content Studio into a compact operational workspace with predictable loading, empty, error, disabled, and review states.

**Non-Goals:**

- Do not automate publishing to public channels.
- Do not promise ranking, brand mention, citation, traffic, or revenue outcomes.
- Do not import passwords, cookies, or browser credentials into the content workflow.
- Do not infer a legacy content record's project automatically.
- Do not redesign unrelated GEO modules or replace the existing browser-agent baseline workflow.

## Decisions

### 1. Add additive project ownership with an explicit legacy state

New migration `039_project_scoped_content_operations.sql` will add nullable `project_id` and a project ownership index to existing content entities, then enforce project assignment in application-level creates and project-scoped routes. Existing records remain unassigned and are visible only in an administrative migration/assignment view, not in normal project workspaces.

This avoids destructive migration or guessed linkage. A database-level `NOT NULL` migration is deferred until all legacy data is resolved.

### 2. Resolve content context from an approved diagnosis snapshot

A Content Opportunity will be a derived, project-scoped view rather than an independently editable duplicate of diagnosis data. The server will assemble it from a selected approved diagnosis, its immutable assessment scope, approved real-platform evidence, approved competitor candidates, product facts, and recommended GEO actions.

This prevents stale duplicated opportunity rows and makes its provenance explicit. A persisted strategy keeps an immutable opportunity context snapshot when a member starts a strategy.

### 3. Use explicit project routes with workspace authorization

Content APIs will be nested under workspace and project paths. The server will first verify workspace membership, then project membership/ownership, then record-to-project equality. Existing workspace-only endpoints will be maintained temporarily only for legacy management or return a migration-oriented error; frontend project views will use project routes exclusively.

### 4. Treat a Strategy as the parent of Brief assets

Strategies will be visible and manageable entities. Each carries one project, one evidence snapshot, Query scope, market/locale, selected channel plan, status, and ordered briefs. A Brief is one channel-specific deliverable; it can evolve independently without mutating a strategy's original context snapshot.

This supports content clusters and multi-channel planning while keeping a single evidence origin.

### 5. Use channel contracts as deterministic generation controls

Workspace-level channel contracts contain the supported China and US launch channels and versioned requirements. Writing profiles remain reusable workspace assets but declare compatible channel and content-type tags. The server selects/recommends candidates and requires an explicit mismatch acknowledgement that is retained on the brief.

The system does not need third-party channel API access to apply these rules.

### 6. Extend AI invocation records into observable execution attempts

The existing content invocation model will record execution state, error class, elapsed time, token/cost data when returned, prompt and evidence artifact references, and a retry lineage. Calls fail closed; template preview remains an explicit non-LLM path. Generation UI will poll or refresh a project-scoped invocation status until terminal.

### 7. Make claim resolution evidence-linked and content-verified

Claim reviews will store a risk category, linked approved evidence references, evidence excerpt, decision, reviewer, and time. Rejection creates a required revalidation marker; approval is prevented until the affected content has been re-checked against the new text.

### 8. Keep delivery and measurement separate

Approved content can be exported as a generated delivery package. Manual URL registration remains an explicit post-delivery step. A retest plan references the immutable original Query scope and is consumed by monitoring/reporting; it is never a promise of impact.

### 9. Use a compact three-region Content Studio

The first desktop iteration uses a persistent project context bar, an opportunity list, an active strategy/asset workspace, and a right evidence/risk tray. On narrower screens these regions collapse into ordered drawers. Large explanatory hero cards are replaced by inline help, status chips, and expandable details. The primary action is always the next legitimate lifecycle action, not a generic generation button.

## Risks / Trade-offs

- [Legacy records lack a project relation] → Keep them hidden from project views until an explicit assignment or archive action is implemented.
- [Some diagnosis data may not have enough reviewed evidence] → Show a recoverable prerequisite state and forbid evidence-backed generation rather than fabricating context.
- [More governance increases perceived complexity] → Apply progressive disclosure, prefill evidence scopes, and keep advanced evidence review in a tray/drawer.
- [Provider metadata is inconsistent] → Store available metrics and label unavailable token/cost fields instead of inventing values.
- [Breaking route changes affect existing UI/tests] → Introduce project endpoints first, migrate the UI, add compatibility errors/tests, then retire unsafe workspace-only content calls.

## Migration Plan

1. Add additive database migration, indexes, serializers, and project-scoped repository methods; retain legacy records as unassigned.
2. Introduce project APIs and contract tests proving workspace and cross-project rejection.
3. Implement derived content opportunities from approved diagnosis and evidence data, then migrate Content Studio loading to project APIs.
4. Surface strategies and Briefs as the primary workflow, with a compact workspace and clear prerequisite states.
5. Add channel contracts, invocation observability, structured claim review, delivery package export, and end-to-end tests.
6. Release behind the existing Content Studio route, verify project isolation with seeded multi-project data, then offer legacy assignment/archive controls.

Rollback: new columns and records are additive. The previous workspace-only records remain readable for administrative recovery; project UI can be returned to prerequisite-only mode without deleting content.


### 10. 无审批的一键写作工作台

前台内容生成采用四步无审批流程：Query 与关键词预处理 → Prompt 与 AI 批量写作 → 自动质量初筛 → 输出与 GEO 复测。Prompt 按 Query 研究、文章、段落、FAQ、摘要等任务分别配置，并在调用模型时真实发送。

Strategy / Brief 只作为后端不可见的项目上下文快照，用于项目隔离、事实范围、证据追溯和审计，不在前台暴露审批节点。质量检查是自动初筛，不代表 GEO 收录、排名、曝光或引用结果；低质量内容建议调整后再导出。发布仍由人工完成，发布后使用原始 Query 回到 GEO 监测复测。

