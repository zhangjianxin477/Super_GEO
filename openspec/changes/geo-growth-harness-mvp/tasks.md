# Tasks

## 1. Discovery, boundaries, and component adoption

- [x] 1.1 Define the CoreNote pilot workspace, its China and global target market packs, initial customer roles, and success criteria; verify the signed-off pilot brief contains both market packs and an explicit baseline-to-follow-up goal.
- [x] 1.2 Confirm the authorized CoreNote integration surface (API, export, webhook, or controlled manual workflow) and document authentication, data fields, rate limits, and failure behavior; verify the connector discovery record is reviewed by the CoreNote owner.
- [x] 1.3 Confirm authorized initial domestic and international model providers plus any manual-import fallback; verify provider access, locale configuration, and collection evidence requirements are recorded for every chosen provider.
- [x] 1.4 Confirm the initial China and overseas owned and third-party content channels that the pilot can legitimately use; verify each channel has an owner, editorial constraints, and a reviewed distribution path.
- [x] 1.5 Establish the adopt-first component decision record template and evaluate candidate GitHub/open-source modules for workflow jobs, model observability/evaluation, extraction, editor, reporting/charting, and identity; verify every selected category records license, maintenance, security, compatibility, and custom-build rationale where no component is adopted.

## 2. Application foundation and Harness contracts

- [x] 2.1 Scaffold the modular-monolith application, local development environment, configuration handling, database migration mechanism, object-artifact storage abstraction, and automated test runner; verify a clean checkout can start the app and execute the baseline test command.
- [x] 2.2 Implement workspace isolation, member roles, audit-event persistence, and authorization middleware; verify automated tests prove that a viewer cannot modify a workspace and that cross-workspace reads are denied.
- [x] 2.3 Implement versioned domain entities for workspaces, brand facts, evidence packs, market packs, competitors, query datasets, assessment runs, observations, findings, briefs, drafts, actions, and reports; verify migrations run on an empty database and version links are preserved by repository tests.
- [x] 2.4 Define and implement Harness extension descriptors and registration validation for evidence sources, model providers, answer importers, analysis skills, content skills, workflow actions, and report renderers; verify tests reject undeclared input, output, permission, locale, and failure contracts.
- [x] 2.5 Implement governed extension execution and audit references; verify a misconfigured or unauthorized extension cannot change approved evidence, published status, or completed observations.

## 3. Workspace, brand evidence, and CoreNote integration

- [x] 3.1 Build workspace setup screens and APIs for brand names, products, customer segments, markets, locales, approved websites, competitors, roles, and claim policy; verify an administrator can configure a China-plus-global workspace and a viewer cannot edit it.
- [x] 3.2 Implement versioned evidence-pack management with brand identity, capability, customer segment, use case, case study, policy, comparison, and prohibited-claim taxonomy; verify a changed approved claim creates a new version and preserves prior references.
- [x] 3.3 Implement the CoreNote evidence adapter using the approved integration surface and map imported items to source-linked evidence entries; verify an authorized CoreNote product document can be imported with title, excerpt, source reference, status, and import timestamp.
- [x] 3.4 Implement website and manual evidence adapters as fallbacks under the same canonical evidence model; verify a workspace without CoreNote access can create an approved website-source evidence entry.
- [x] 3.5 Add evidence review, approval, synchronization status, and failure-preservation behavior; verify a failed synchronization retains the last approved evidence version and displays an authorized-user warning.
- [x] 3.6 Document the evidence policy and CoreNote connector setup for pilot administrators; verify the documented onboarding flow can be completed in a clean pilot workspace.

## 4. GEO Query Lab and market packs

- [x] 4.1 Build market-pack configuration for locale, target region, audience, competitors, selected providers, target channels, and query cohort; verify one China pack and one global pack can share a brand evidence pack while retaining independent configuration.
- [x] 4.2 Implement query datasets with query text, language, market, role, business stage, intent category, priority, target product, expected facts, and risk metadata; verify analysts can create and filter a multi-language dataset.
- [x] 4.3 Implement draft, approved, retired, and superseded dataset states with immutable versions; verify editing an approved dataset produces a new version and earlier assessment runs retain the original version.
- [x] 4.4 Seed and review the CoreNote pilot query corpus with an initial high-priority cohort for Chinese and English category, scenario, comparison, alternative, and brand queries; verify the review record contains at least the agreed MVP cohort and maps every query to an intent category.
- [x] 4.5 Implement cohort selection and compatibility checks for assessments and comparisons; verify a follow-up that omits an original baseline query is visibly marked non-comparable.
- [x] 4.6 Document query-design rules, including safe handling of product claims and intended user roles; verify the reviewer checklist is linked from dataset approval.

## 5. AI Answer Observatory

- [x] 5.1 Implement model-provider configuration and secret handling behind the ModelProvider contract; verify unsupported or incomplete provider configuration is rejected before execution.
- [x] 5.2 Implement assessment-run creation for an approved dataset version, selected market pack, provider set, locale, and run label; verify a run receives an immutable identifier and stores its full configuration snapshot.
- [x] 5.3 Implement queue-backed execution with retry, timeout, per-query status, and resumable run state using the adopted job component or documented custom substitute; verify an injected provider timeout produces a failed observation without marking the overall run complete.
- [x] 5.4 Normalize and persist raw answer evidence, model/provider identity, timestamps, locale, citations/URLs, run status, error details, and object-storage references for large artifacts; verify an answer with two citations preserves both URLs and links back to the raw result.
- [x] 5.5 Implement analyst-controlled manual observation import with collector, source, collection time, and supporting-artifact requirements; verify imported results are visibly distinct from directly executed results.
- [x] 5.6 Build run detail and completion UI/API that exposes planned, completed, failed, and imported observations; verify incomplete data cannot be presented as a complete assessment by integration tests.
- [x] 5.7 Document provider configuration, run reproducibility, and manual-import procedures; verify operations can reproduce a configured baseline run from the run record.

## 6. GEO Intelligence and competitive analysis

- [x] 6.1 Implement answer analysis for configured brand and competitor mentions, recommendation context, observable relative list position, citations, and risk context while retaining links to raw evidence; verify a fixture containing two competitors and no client brand records the expected omission and competitor recommendations.
- [x] 6.2 Implement evidence-grounded claim analysis that categorizes product claims as supported, unsupported, conflicting, or insufficient evidence against a selected evidence-pack version; verify an unsupported feature claim is flagged with its evidence-version reference.
- [x] 6.3 Implement transparent metric calculations for mention rate, recommendation rate, owned-source citation rate, third-party citation rate, factual-accuracy rate, and competitor visibility gap; verify metric tests expose numerators, denominators, and failure/import exclusions.
- [x] 6.4 Implement diagnosis generation that links a material gap to affected queries, answer evidence, gap category, recommended action, confidence, and uncertainty; verify a category-discovery absence produces a non-guaranteed content/evidence recommendation.
- [x] 6.5 Implement competitor content and source-ecosystem research through permitted, attributable source adapters; verify research results store source provenance, collection time, extraction status, and no bypassed-access behavior.
- [x] 6.6 Build dashboards for market-pack, provider, query-intent, competitor, citation, and factual-accuracy drill-down; verify a user can navigate an aggregate result back to its underlying answer evidence.
- [x] 6.7 Document GEO metric definitions, diagnostic limitations, and responsible competitor-research rules; verify those definitions appear in the pilot dashboard and report glossary.

## 7. Content Strategy Studio and review workflow

- [x] 7.1 Implement content-brief generation from selected diagnoses, evidence-pack version, query cohort, market, locale, channel, and content type; verify a brief includes mandatory facts, source links, prohibited claims, competitor context, outline, review criteria, and success measures.
- [x] 7.2 Implement channel-specific content skills for website pages, FAQ entries, use-case pages, comparison pages, case studies, and editorial articles, using the adopted model/content components where approved; verify each generated draft retains source brief, locale, channel, and evidence references.
- [x] 7.3 Implement claim-coverage validation for generated drafts and reviewer resolution for unsupported claims; verify an unreferenced measurable performance claim prevents draft approval until resolved or rejected.
- [x] 7.4 Implement draft review states, reviewer comments, approval/rejection decisions, and immutable approved-content snapshots; verify only authorized reviewers can approve a draft for client delivery or publication task creation.
- [x] 7.5 Implement human-reviewed distribution tasks with owner, channel, editorial constraints, target queries, status, date, and proof-of-completion reference; verify an unreviewed draft cannot generate a public-distribution task.
- [x] 7.6 Add ethical guardrails for fabricated reviews, fabricated citations, deceptive link schemes, and unreviewed mass publication; verify prohibited requests are blocked and logged with an explanation.
- [ ] 7.7 Document the brief-to-draft-to-review workflow and create CoreNote pilot briefs for the agreed high-priority Chinese and English gaps; verify each pilot brief is traceable to a diagnosis and approved evidence version.

## 8. Measurement, reporting, and pilot validation

- [x] 8.1 Implement baseline designation and compatible follow-up comparison using immutable cohort, locale, and metric-eligibility rules; verify a compatible run produces deltas while a mismatched cohort is labeled non-comparable.
- [x] 8.2 Implement action timeline and observational association views that display content/evidence/distribution actions alongside later metric movement without claiming causality; verify the timeline labels results as observational.
- [x] 8.3 Implement client report generation containing scope, providers, query cohort, dates, completeness, metrics, evidence examples, competitors, actions, recommendations, and limitations; verify an incomplete-provider report visibly includes its limitations.
- [x] 8.4 Implement no-guarantee language rules for dashboards and reports; verify a positive metric delta is described as an observed change rather than a guaranteed or caused outcome.
- [ ] 8.5 Run the CoreNote pilot baseline assessment across the agreed domestic and international provider cohorts, review result quality, and resolve material extraction/scoring defects; verify the signed pilot baseline report links to every underlying run and query-dataset version.
- [ ] 8.6 Execute at least one approved content/evidence action for the CoreNote pilot, conduct a compatible follow-up assessment, and generate a before/after client report; verify the report lists actions, cohort compatibility, observed deltas, and limitations.
- [x] 8.7 Perform end-to-end security, isolation, auditability, error-recovery, accessibility, and performance checks for the pilot path; verify the release checklist passes and all high-severity findings are resolved or explicitly accepted.












