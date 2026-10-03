# GEO Query Design and Dataset Approval Rules

## Purpose

This workflow governs reusable GEO query datasets for enterprise AI-visibility measurement. It applies to every workspace and market pack; the CoreNote corpus is a validation seed, not a product restriction.

## Design rules

1. **Start from buyer language, not campaign slogans.** Queries must represent plausible discovery, scenario, comparison, alternative, or brand-validation questions from the stated user role.
2. **Keep China and global research independent.** `CN / zh-CN` and `GLOBAL / en-US` query wording, user behavior, competitors, and channels are researched independently. Do not translate one market pack mechanically into the other.
3. **Classify every query.** Each item needs market, locale, language, user role, business stage, intent, priority, target product, expected facts, and risk metadata.
4. **Use safe factual phrasing.** Do not embed unsupported product features, customer names, certifications, rankings, recommendations, citation outcomes, lead volumes, or revenue outcomes as presumed facts. Put requested facts in `expectedFacts` only when those facts are evidence-backed and reviewer-verifiable.
5. **Separate observation from advocacy.** Category, comparison, and alternative queries must not use deceptive phrasing, fabricated competitors, or leading claims designed to force an answer.
6. **Preserve comparability.** A baseline cohort is immutable. Revise approved datasets through a new version; never edit an approved version in place. A follow-up that changes the cohort must be labeled non-comparable.
7. **Use P0 deliberately.** P0 is reserved for pilot-critical category discovery, scenario, comparison, alternative, and brand queries; it is not a promise of traffic, citations, rankings, or recommendation.

## Dataset approval checklist

The reviewer must provide this checklist when approving a draft dataset at [the approval endpoint](../../server/application.mjs):

- `intentMapped`: every query maps to an allowed intent category.
- `localeAndLanguage`: wording, market, locale, and language match the intended audience.
- `roleAndStage`: user role and business stage are plausible and explicit.
- `claimsSafe`: no query assumes unsupported claims, rankings, citations, endorsements, or performance outcomes.
- `noOutcomeGuarantees`: dataset, report, and downstream content do not promise AI visibility, citations, recommendations, leads, revenue, or causality.

The required metadata is:

```json
{
  "status": "approved",
  "checklist": {
    "version": "query-review-v1",
    "reference": "docs/workflows/query-design-rules.md#dataset-approval-checklist",
    "checks": {
      "intentMapped": true,
      "localeAndLanguage": true,
      "roleAndStage": true,
      "claimsSafe": true,
      "noOutcomeGuarantees": true
    }
  },
  "reviewNotes": "Reviewed for cohort completeness and safe product-claim handling."
}
```

## CoreNote validation corpus

The controlled pilot corpus contains 100 P0 queries: 50 `CN / zh-CN` and 50 `GLOBAL / en-US`. Each market covers ten queries across five intents: category discovery, scenario, comparison, alternative, and brand discovery. It includes the agreed MVP queries:

- `有哪些支持知识图谱、来源可追溯的 AI 知识库工具？`
- `What AI knowledge base tools provide knowledge-graph context and source-cited answers for B2B teams?`

Use the dataset seed only for the CoreNote validation workspace. Other tenants should build their own evidence-grounded query corpus from this structure, not inherit CoreNote product assumptions.

## Review, revisions, and retention

- Analysts create draft datasets and draft revisions.
- Reviewers or administrators approve or retire datasets using the checklist above.
- Approval of a revision marks its prior approved version `superseded` only after the new version is approved.
- Assessment runs retain the exact dataset ID, version, and selected query IDs they used.
- Preserve the review record, query classification, and audit event for client-report defensibility.
