# Spec Delta

## Purpose

Provide a diagnostic-first enterprise GEO dashboard that turns governed AI-answer observations into explainable visibility priorities and evidence-linked next actions.

## ADDED Requirements

### Requirement: Actionable GEO visibility overview
The system SHALL present the selected workspace and market pack's current mention rate, recommendation rate, owned-source citation rate, factual-accuracy rate, provider completeness, and competitor visibility context in one diagnostic overview.

#### Scenario: Complete assessment overview
- **WHEN** a selected market pack has a completed assessment run with eligible observations
- **THEN** the dashboard displays the applicable metrics, their observation scope, and the run period

#### Scenario: Incomplete provider collection
- **WHEN** one or more included providers have failed, queued, or unavailable observations
- **THEN** the dashboard identifies the incomplete providers and excludes ineligible results according to the metric definition

### Requirement: Governed comparison presentation
The system SHALL show baseline-to-follow-up movement only when the selected runs meet the stored comparability rules and SHALL label non-comparable results without a calculated uplift conclusion.

#### Scenario: Comparable follow-up
- **WHEN** the user selects a compatible baseline and follow-up run
- **THEN** the dashboard displays observed metric deltas together with cohort, market, locale, and collection context

#### Scenario: Incompatible comparison
- **WHEN** the selected run differs from the baseline's required cohort or eligibility context
- **THEN** the dashboard labels the comparison non-comparable and does not present it as an uplift result

### Requirement: Evidence-linked diagnostic drill-down
The system SHALL let users navigate from a dashboard metric, competitor gap, or risk to the preserved answer evidence, citations, model/provider details, query, and diagnosis that support the displayed signal.

#### Scenario: User inspects a competitor gap
- **WHEN** a user selects a competitor visibility gap
- **THEN** the application shows the affected query cohort, relevant observations, competitor references, and linked diagnosis records

### Requirement: Prioritized next actions
The system SHALL display the highest-priority approved or reviewable next actions with their linked diagnosis, target queries, evidence requirements, channel, and current workflow state.

#### Scenario: Diagnosis has a content action
- **WHEN** a material diagnosis has a linked content brief or distribution task
- **THEN** the dashboard displays the action's priority, status, target channel, and an evidence-traceable route to its source records

### Requirement: No-guarantee interpretation language
The system SHALL describe dashboard changes as observations and SHALL not claim that an action caused, guarantees, or will guarantee AI visibility, citation, ranking, traffic, leads, or revenue.

#### Scenario: Positive visibility movement is displayed
- **WHEN** a follow-up run has a positive metric delta
- **THEN** the dashboard labels it as observed change and displays the relevant limitations
