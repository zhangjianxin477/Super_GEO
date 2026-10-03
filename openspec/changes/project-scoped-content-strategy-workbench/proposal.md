# Proposal

## Why

The current content strategy and AI writing workspace has reliable evidence and model-governance primitives, but content records are workspace-scoped while the GEO product operates through isolated projects. The UI therefore hides legacy content data and cannot consistently transform a project's approved diagnosis and competitor evidence into traceable content work, preventing the module from serving as an enterprise GEO delivery workflow.

## What Changes

- **BREAKING** Scope content strategies, briefs, drafts, approved snapshots, publications, and content-related AI invocation records to a required project; replace workspace-only content list and mutation APIs with project-scoped routes.
- Build a project-scoped content opportunity pipeline from approved GEO diagnoses, selected query groups, verified real-platform evidence, approved competitor sources, and approved product facts.
- Promote Content Strategy to a visible, reviewable strategy package that can plan multiple channel-specific briefs rather than treating it as an invisible single-article side effect.
- Replace the linear writer-first task flow with a compact enterprise workspace: opportunity context, strategy/content assets, and evidence/risk review, with actionable empty, loading, failure, and recovery states.
- Add channel contracts and profile recommendations for the supported China and US launch channels; preserve profile versioning and prevent silent channel/profile mismatches.
- Upgrade Brief and draft governance with core/supporting/excluded Query selection, editable review checkpoints, claim-to-evidence resolution, structured AI invocation status, version history, and export-oriented manual publishing.
- Keep external publishing manual and keep follow-up observations in the monitoring/reporting flow; distinguish approved, exported, published, and retest-planned states without promising visibility or business outcomes.

## Capabilities

### New Capabilities
- `project-scoped-content-operations`: Project-isolated content opportunities, strategies, briefs, drafts, publications, and evidence-aware lifecycle management.
- `channel-governed-content-generation`: Channel contracts, profile recommendations, controlled AI generation, structured review, and export delivery for GEO content assets.

### Modified Capabilities

- None. The repository has no archived main specification for the prior experimental content-studio delta, so this change records the new externally observable requirements as new authoritative capabilities.

## Impact

- Database migrations and repository serializers for content entities, snapshots, claims, publications, and content invocation records.
- Server routes in `server/application.mjs`, repository methods in `server/repositories/harnessRepository.mjs`, and content domain contracts.
- Frontend domain/API types and the Content Studio UI, including project-aware loading, content opportunity context, strategy management, review states, and responsive compact layout.
- Content studio tests, server API/repository tests, migration tests, and documentation covering project isolation, manual publishing, model invocation, and evidence governance.
