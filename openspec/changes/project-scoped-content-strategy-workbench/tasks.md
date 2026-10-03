# Tasks

## 1. Project-scoped content persistence

- [ ] 1.1 Add an additive SQLite migration that assigns nullable `project_id` ownership and indexes to content strategies, briefs, drafts, approved snapshots, publications, claim reviews, and content-related AI invocations; preserve existing records as explicit unassigned legacy data and verify a clean migration plus fixture upgrade succeeds.
- [ ] 1.2 Extend repository serializers and project-scoped queries/mutations so every new content asset has one project and cross-project reads/writes fail closed; verify repository round-trip and negative-isolation tests.
- [ ] 1.3 Add an administrator-visible legacy assignment/archive path that never guesses a project and document the migration behavior; verify unassigned content cannot appear in a normal project workspace.

## 2. Project API and content opportunity pipeline

- [ ] 2.1 Introduce project-nested content API routes and retire frontend use of unsafe workspace-only content routes; verify workspace authorization, project authorization, and cross-project rejection API tests.
- [ ] 2.2 Derive project-scoped content opportunities from approved GEO diagnoses, immutable assessment scopes, approved real-platform evidence, approved competitor candidates, and product facts; verify a qualifying diagnosis returns attributable opportunities and missing prerequisites return structured next actions.
- [ ] 2.3 Persist an immutable opportunity-context snapshot when a Content Strategy starts; verify later diagnosis changes do not rewrite existing strategy provenance.

## 3. Content strategy and Brief operations

- [ ] 3.1 Make Content Strategy a visible parent entity with market, locale, Query scope, channel plan, evidence scope, review state, and ordered Brief assets; verify one strategy can create and list multiple briefs without mixing projects.
- [ ] 3.2 Extend Brief contracts and review APIs for core/supporting/excluded Queries, selected angle, editable task fields, structured return reasons, and version history; verify returned Briefs remain editable and cannot generate a draft until re-approved.
- [ ] 3.3 Add server and domain validation for immutable evidence scope, channel/content-type compatibility acknowledgement, and prohibited unsupported content claims; verify invalid requests fail with actionable errors.

## 4. Channel-governed AI generation

- [ ] 4.1 Define seeded versioned channel contracts for launch channels: 官网 Blog、Help Center、Comparison Page、知乎、微信公众号、掘金、Medium、LinkedIn; verify each contract exposes supported content forms, structural rules, CTA boundaries, and source/link expectations.
- [ ] 4.2 Extend writing profiles with compatible channel/content-type tags and implement recommendation plus explicit mismatch acknowledgement; verify compatible profiles are suggested and mismatches are retained in the Brief audit trail.
- [ ] 4.3 Upgrade content AI invocations to observable stateful execution with prompt/evidence artifacts, duration, available token/cost metadata, error classification, retry lineage, and fail-closed generation; verify provider timeout, rate-limit, invalid-output, and template-preview cases.

## 5. Draft and claim-review governance

- [ ] 5.1 Add draft version history and comparison metadata that preserves the generating model/profile/evidence snapshot; verify editing or regenerating does not overwrite prior approved content versions.
- [ ] 5.2 Replace simple claim toggles with claim-to-evidence review records including type, risk, evidence excerpts, decision, reviewer, timestamp, and revalidation requirement; verify unresolved high-risk claims block approval.
- [ ] 5.3 Implement content revalidation after a rejected claim is rewritten or removed; verify the system prevents closing the issue until the updated draft has been inspected.

## 6. Compact Content Studio workspace

- [ ] 6.1 Refactor Content Studio data loading into project-aware services/state and remove the temporary logic that clears opportunities, Briefs, drafts, and publications; verify switching projects never leaks content state.
- [ ] 6.2 Implement the compact enterprise workspace with project context bar, content opportunity list, strategy/asset workspace, and evidence/risk tray; verify keyboard navigation, responsive collapse, loading, empty, error, disabled, and recovery states.
- [ ] 6.3 Add strategy, Brief, draft, and claim-review interactions with a single legitimate next action per lifecycle state; verify no-diagnosis users see a direct path to the prerequisite workflow rather than an inert writer form.
- [ ] 6.4 Add visible AI execution progress, error recovery actions, version history, and Prompt/evidence previews; verify model failures cannot be mistaken for completed AI output.

## 7. Manual delivery and monitoring handoff

- [x] 7.1 Produce channel-aware approved-content delivery packages containing Markdown, metadata, evidence map, publishing checklist, and immutable follow-up scope; verify export is distinct from publication.
- [ ] 7.2 Move publication registration and retest scheduling into secondary delivery actions and hand the immutable scope to monitoring/reporting; verify status copy never represents publication as GEO impact.
- [ ] 7.3 Update operator documentation for project isolation, approved evidence boundaries, manual publishing, model execution recovery, and legacy content handling; verify documented flows match API behavior.

## 8. End-to-end validation

- [ ] 8.1 Add server, repository, migration, and frontend tests for multi-project isolation, diagnosis-to-opportunity loading, strategy-to-multi-Brief planning, profile/channel compatibility, AI failure recovery, claim gates, export, and retest scope integrity; verify the targeted suites pass.
- [ ] 8.2 Run production build and a rendered desktop/narrow-screen review of the Content Studio; verify no overflow, card nesting, inaccessible controls, misleading outcome claims, or broken empty/error states remain.

