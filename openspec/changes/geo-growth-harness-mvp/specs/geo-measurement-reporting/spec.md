# Spec Delta

## Purpose

Measure change over time using consistent query cohorts, connect observed movement to recorded GEO actions, and generate traceable reports that communicate results and uncertainty to B2B clients.

## ADDED Requirements

### Requirement: Baseline and follow-up comparison
The system SHALL allow an approved completed assessment to be designated as a baseline and SHALL compare a later completed assessment only when the selected query cohort, locale, and metric eligibility rules are compatible.

#### Scenario: Compatible follow-up run is selected
- **WHEN** an analyst selects a later completed run using the same approved query-dataset version and locale as the baseline
- **THEN** the system displays metric deltas for the two runs and identifies the compared run identifiers

### Requirement: Action-to-measurement traceability
The system SHALL let users record content, evidence, and distribution actions with dates, channel, target queries, status, and linked briefs, and SHALL show those actions alongside subsequent measurement changes without asserting unproven causation.

#### Scenario: Published use-case page is linked to a follow-up run
- **WHEN** a reviewer records a completed website use-case page action before a follow-up assessment
- **THEN** the system displays the action in the comparison timeline and labels any relationship to metric movement as observational

### Requirement: Client report generation
The system SHALL generate a client-facing report containing scope, query cohort, providers, date range, completeness, baseline and follow-up metrics, representative evidence, competitor observations, completed actions, next recommendations, and limitations.

#### Scenario: Account lead produces a monthly GEO report
- **WHEN** an account lead requests a report for a completed comparison period
- **THEN** the system creates a report that includes the underlying cohort and notes incomplete providers, non-comparable inputs, and other measurement limitations

### Requirement: No-guarantee outcome language
The system SHALL label GEO results as observations for the configured models, queries, locales, and dates and SHALL not represent content or distribution work as guaranteeing a model citation, recommendation, ranking, or business outcome.

#### Scenario: Report includes a positive metric delta
- **WHEN** a report shows an increase in brand mention rate after tracked actions
- **THEN** the report describes the increase as an observed change and does not claim that the tracked action caused or guarantees the outcome
