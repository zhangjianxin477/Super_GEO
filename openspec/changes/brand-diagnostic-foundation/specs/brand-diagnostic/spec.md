# Spec Delta

## Purpose

Defines the enterprise GEO diagnostic project lifecycle so teams can establish an evidence-backed, reproducible and auditable brand visibility baseline before optimizing content or reporting results.

## ADDED Requirements

### Requirement: Workspace-scoped diagnostic projects
The system SHALL let an authorized workspace member create, view, update and archive diagnostic projects without exposing projects across workspace boundaries. Each project MUST retain its brand identity, owner, target markets, target personas, business objective, requested delivery date, lifecycle status and current next action.

#### Scenario: Create diagnostic project
- **WHEN** a workspace editor submits a valid diagnostic project scope
- **THEN** the system creates a draft project scoped to that workspace and records an activity event

#### Scenario: Workspace isolation
- **WHEN** a user requests a diagnostic project belonging to another workspace
- **THEN** the system returns no project data and does not reveal its existence

### Requirement: Evidence-backed brand facts
The system SHALL allow editors to maintain brand facts, source URLs or source descriptions, applicable market, review status and forbidden claims for each diagnostic project. Candidate or rejected facts MUST remain visibly distinct from approved facts.

#### Scenario: Review candidate fact
- **WHEN** a reviewer approves a candidate fact with a source
- **THEN** the fact becomes available to the diagnostic evidence pack and an activity event records the reviewer decision

#### Scenario: Reject unsubstantiated fact
- **WHEN** a reviewer rejects a candidate fact
- **THEN** the fact remains retained as rejected and is excluded from the approved evidence count

### Requirement: Reproducible scope and baseline freeze
The system SHALL store a query scope and collection plan for each diagnostic project, including markets, locales, platforms, models, collection mode, frequency and failure policy. A baseline MAY be frozen only when the project has approved facts, a defined query scope and a defined collection plan; the frozen record MUST preserve versions and the scope snapshot used for comparison.

#### Scenario: Prevent incomplete baseline freeze
- **WHEN** an editor attempts to freeze a project lacking an approved fact, query scope or collection plan
- **THEN** the system rejects the action and returns the blocking conditions

#### Scenario: Freeze comparable baseline
- **WHEN** an editor freezes a project with all required diagnostic inputs
- **THEN** the system creates an immutable baseline snapshot and marks the project ready for controlled collection

### Requirement: Controlled manual evidence intake
The system SHALL label diagnostic collection as controlled manual import unless an approved provider integration is selected. The system MUST NOT represent imported evidence as automated model execution.

#### Scenario: Show collection mode
- **WHEN** a user views a diagnostic project configured for manual intake
- **THEN** the project shows controlled manual import in its plan and activity context

### Requirement: Explainable project center
The system SHALL present a project center and detail workspace that surfaces lifecycle state, blocking conditions, current coverage, next action, activity, and evidence-based downstream recommendations. Metric displays MUST identify that they are baseline or pending evidence and MUST NOT imply unsupported model results.

#### Scenario: Show blocked diagnostic
- **WHEN** a diagnostic project lacks required inputs
- **THEN** the project center shows the specific blocker and an action leading to the affected setup area

#### Scenario: Show evidence limitations
- **WHEN** a project has no collected observations
- **THEN** the detail workspace shows pending evidence rather than fabricated performance metrics
