# Spec Delta

## Purpose

Provide a project-isolated content-operations lifecycle that turns approved GEO evidence into traceable strategies, briefs, drafts, manual-delivery records, and comparable follow-up observations.

## ADDED Requirements

### Requirement: Content records are isolated to one project
The system SHALL require every newly created content strategy, brief, draft, approved snapshot, publication, and content-related AI invocation to belong to exactly one project. Project-scoped reads and mutations MUST reject records from another project even when the actor belongs to the same workspace.

#### Scenario: Cross-project content access is rejected
- **WHEN** a workspace member requests a content record through a different project context
- **THEN** the system rejects the request and does not disclose the record or its evidence.

#### Scenario: Legacy content remains safe until assigned
- **WHEN** a workspace-scoped legacy content record has no project assignment
- **THEN** the system excludes it from project workspaces and identifies it as unassigned for an explicit administrator-led assignment or archive decision.

### Requirement: Content opportunities are derived from approved project evidence
The system SHALL expose a content opportunity only when the active project has an approved GEO diagnosis with an eligible Query scope. Each opportunity MUST identify the source diagnosis, affected Query scope, observed platform context, evidence references, and a non-guaranteed recommended action.

#### Scenario: Approved diagnosis produces an actionable opportunity
- **WHEN** an approved project diagnosis identifies an eligible visibility, citation, mention, or competitor-occupancy gap
- **THEN** the content workspace shows a project-scoped opportunity with its diagnosis and evidence context.

#### Scenario: Missing prerequisites have a recoverable empty state
- **WHEN** the project has no approved diagnosis or no eligible evidence
- **THEN** the workspace explains the missing prerequisite and provides the correct next workflow action without presenting a misleading empty writer form.

### Requirement: A strategy can coordinate multiple content assets
The system SHALL let an authorized member create and review a Content Strategy linked to one project opportunity. A strategy MUST retain market, locale, Query scope, channel plan, evidence scope, status, and ordered Brief assets; one strategy MAY contain multiple briefs.

#### Scenario: One opportunity creates a multi-channel strategy
- **WHEN** a member creates a strategy from an opportunity and selects several supported channels
- **THEN** the system records one strategy and permits multiple channel-specific briefs under its approved scope.

### Requirement: Content lifecycle preserves delivery and observation boundaries
The system SHALL distinguish content states for approved, exported, manually published, and retest-planned assets. It MUST retain the immutable source Query scope for a publication follow-up and MUST NOT represent approval, export, or publication as proof of GEO impact.

#### Scenario: Publication does not imply outcome
- **WHEN** a member records an externally published URL for an approved asset
- **THEN** the system records a manual publication and presents any follow-up measurement as a same-scope observation rather than a causal performance claim.
