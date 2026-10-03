# Spec Delta

## Purpose

Provides a first-use enterprise GEO project flow that turns a customer brand brief into an actionable, reviewable diagnostic baseline instead of an empty tenant workspace.

## ADDED Requirements

### Requirement: Guided brand-project creation
The system SHALL provide a guided diagnostic-project creation flow that collects a workspace name, brand or product name, website, industry/category, customer segments, at least one target market and locale, a diagnostic objective, selected AI providers, and optional competitors.

#### Scenario: Required project inputs are supplied
- **WHEN** an administrator submits a valid onboarding form with at least one market and one provider
- **THEN** the system creates a tenant-scoped diagnostic project and returns its workspace, market, and next-step context

#### Scenario: Required project inputs are missing
- **WHEN** an administrator submits onboarding without a required brand, market, or provider selection
- **THEN** the system rejects the request with field-level validation errors and creates no partial project

### Requirement: Atomic GEO baseline initialization
The system SHALL atomically initialize each selected market with a market package, draft evidence/brand context, a draft Query Gap dataset, selected provider configuration, and a planned initial assessment run.

#### Scenario: A dual-market project is created
- **WHEN** an administrator selects both China `zh-CN` and United States `en-US` markets
- **THEN** the system creates independently scoped market packages, datasets, provider plans, and planned runs for each market

#### Scenario: Initialization fails
- **WHEN** any required initialization record cannot be created
- **THEN** the system returns an error and does not expose a partially initialized project as ready for diagnosis

### Requirement: Reviewable query-gap suggestions
The system SHALL create an explicitly draft query cohort grouped by market, locale, intent, funnel stage, and priority, and SHALL distinguish generated suggestions from approved queries and imported AI answers.

#### Scenario: New query suggestions are shown
- **WHEN** onboarding completes
- **THEN** the operator can see a labelled draft query cohort and the next action required to review or approve it before assessment collection

#### Scenario: Query suggestions have not been approved
- **WHEN** a draft cohort has not completed the required approval step
- **THEN** the system does not represent it as a completed assessment input or a diagnostic finding

### Requirement: Actionable post-create destination
The system SHALL route a newly created project to an actionable setup state that explains the active market, query-review status, collection-plan status, and the next required operator action.

#### Scenario: A project is newly created
- **WHEN** the backend returns a successful onboarding response
- **THEN** the UI opens the project's setup/task view rather than an empty-workspace placeholder

#### Scenario: A legacy empty workspace is opened
- **WHEN** a user opens an existing workspace that has no market package
- **THEN** the UI offers a clear action to begin guided project setup without presenting placeholder performance metrics

### Requirement: Tenant, role, and audit controls
The system SHALL restrict project initialization to an authorized workspace administrator, scope all initialized records to the tenant, and record auditable initialization activity.

#### Scenario: A non-administrator attempts onboarding within an existing tenant
- **WHEN** a member without administrative write authority submits project initialization
- **THEN** the system denies the request and writes no tenant records

#### Scenario: Onboarding succeeds
- **WHEN** an authorized administrator creates a diagnostic project
- **THEN** the audit trail records the actor, project target, and initialization outcome

### Requirement: First-use task guidance
The system SHALL present a plain-language, action-first next step at the top of every incomplete diagnostic state, before performance metrics or governance detail. The guidance SHALL identify the workflow step, the user's immediate goal, the expected effort, and a primary action that opens the required workspace.

#### Scenario: A newly activated baseline has no imported answers
- **WHEN** an operator opens a baseline whose planned observations have not yet been imported
- **THEN** the dashboard shows that the operator is at the answer-evidence step, explains that the goal is to add the first AI answer, and provides a primary action to open the answer-collection workspace

#### Scenario: A baseline has completed collection
- **WHEN** all observations for the selected baseline are complete or imported and evidence-grounded diagnoses are available to generate
- **THEN** the dashboard presents diagnosis generation as the next primary action and explains that it uses only retained evidence

### Requirement: Task-based controlled collection workspace
The system SHALL provide a guided controlled-manual collection workspace that lets an authorized operator claim the next queued query-provider task and complete the evidence import without having to manually choose an arbitrary query or provider first.

#### Scenario: An operator starts the first answer import
- **WHEN** the operator selects the primary action to start answer collection
- **THEN** the system claims the next queued observation, shows the AI platform and question to ask, provides a copyable question, and explains the four manual steps: ask externally, retain the raw answer, retain citation links, and save the evidence

#### Scenario: An operator saves imported evidence
- **WHEN** a valid raw answer and required provenance fields are saved for a claimed task
- **THEN** the system refreshes the collection progress and offers the next queued task without implying that the system accessed the third-party AI platform

### Requirement: Dependency-aware downstream navigation
The system SHALL explain the evidence prerequisite when a downstream module has no usable inputs, and SHALL provide a direct action to return to the required upstream collection or diagnosis workflow.

#### Scenario: An operator opens a downstream module before collection is complete
- **WHEN** the selected assessment does not yet contain the evidence required by the requested research, content, or report workflow
- **THEN** the module displays a plain-language prerequisite message and a direct navigation action instead of an unexplained empty state

