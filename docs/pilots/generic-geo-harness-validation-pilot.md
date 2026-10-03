# GEO Growth Harness — Generic Enterprise Validation Pilot

**Decision record date:** September 27, 2026  
**Product scope:** A general-purpose, enterprise GEO optimization AI Harness for B2B organizations.  
**Validation tenant:** CoreNote is the first validation workspace only. It supplies a realistic B2B SaaS test case; it is not a required connector, customer vertical, default data model, or product dependency.

## Product boundary

The Harness serves B2B organizations that need a governed lifecycle from verified product knowledge through AI-answer observation, diagnosis, content planning, reviewed distribution, and compatible follow-up reporting. Each client configures its own evidence sources, markets, model providers, competitors, query cohorts, content channels, and access controls.

CoreNote may be connected through the evidence-adapter contract, but a future customer can use a manual source, website source, or another approved knowledge system without changing the core workflow.

## Confirmed initial customer roles

| Role | Pilot responsibility |
| --- | --- |
| Administrator | Creates the tenant, members, approved Market Packs, extensions, and evidence policy. |
| Analyst | Builds the query cohort, imports/collects answer observations, analyzes gaps, and prepares briefs or evidence actions. |
| Reviewer | Approves evidence-backed briefs and drafts; authorizes immutable snapshots and human distribution tasks. |
| Viewer | Reviews reports, evidence provenance, task status, and audit history without editing. |

## China Market Pack

| Configuration | Confirmed decision |
| --- | --- |
| Market / locale | China / `zh-CN` |
| Priority audience | Cross-border SaaS teams, enterprise knowledge-base owners, and AI product leaders |
| P0 validation query | “有哪些支持知识图谱、来源可追溯的 AI 知识库工具？” |
| Initial channels | Official website content center; Zhihu; WeChat Official Account; Juejin; an approved overseas/developer-community alternative when relevant |
| Content formats | Category-discovery page, FAQ, use case, comparison page, editorial article |
| Required preconditions | Approved CN Evidence Pack, approved CN Market Pack, P0 query cohort, completed assessment run, attributable diagnosis, reviewer approval |

## United States Market Pack

| Configuration | Confirmed decision |
| --- | --- |
| Market / locale | United States / `en-US` |
| Priority audience | Cross-border SaaS teams, enterprise knowledge-base owners, and AI product leaders |
| P0 validation query | “What AI knowledge base tools provide knowledge-graph context and source-cited answers for B2B teams?” |
| Initial channels | Official website blog; Help Center; Comparison Page; Medium; LinkedIn |
| Content formats | Category-discovery page, FAQ, use case, comparison page, case study, editorial article |
| Required preconditions | Approved US Evidence Pack, approved US Market Pack, P0 query cohort, completed assessment run, attributable diagnosis, reviewer approval |

## Query-cohort operating target

Each Market Pack starts with its named P0 query and expands through reviewed research toward a **100–200 query** market-specific cohort. The China and US cohorts must be independently authored and reviewed; neither is a translation-derived substitute for the other.

Every query includes intent, business stage, user role, priority, target product/category, locale, market, and expected evidence-backed facts. The P0 queries above must remain in their respective cohorts for compatible before/after measurement.

## Baseline-to-follow-up acceptance goal

The pilot validates the **workflow and observability**, not a promised marketing result.

1. Run a baseline across the approved Query × Provider cohort and retain all raw answers, citations, timestamps, locale, and collection mode.
2. Record evidence, content, and human-reviewed distribution actions as time-stamped actions; do not assert that they caused later outcomes.
3. Execute a follow-up using the same immutable cohort, locale, and metric-eligibility rules.
4. Deliver a client report that compares observed mention rate, recommendation rate, owned/third-party citation rate, factual-accuracy assessment, provider completeness, and competitor visibility gap.
5. Acceptance requires that cohort compatibility and limitations are visible. Positive differences are reported as observed changes, never guaranteed or causal outcomes.

## Pilot brief gates

The two P0 entries above are approved **pilot directions**, not fabricated content briefs. The system may create each actual Brief only after the related evidence version and diagnosis exist:

- **CN Brief:** must reference the approved CN Evidence Pack version, approved CN diagnosis, and the immutable China P0 query ID.
- **US Brief:** must reference the approved US Evidence Pack version, approved US diagnosis, and the immutable US P0 query ID.

Both briefs require reviewer approval before a draft, customer delivery, or human distribution task can be created.

## Explicit non-goals

- Do not guarantee AI citations, recommendations, rankings, leads, or revenue.
- Do not fabricate reviews, citations, sources, customer proof, competitor claims, or completion evidence.
- Do not auto-publish or mass-publish without human review.
- Do not treat CoreNote-specific facts as generic enterprise facts.
