# Spec Delta

## Purpose

Provide a governed assessment operations console for building query cohorts, collecting domestic and international AI-answer evidence, and reviewing raw observations before they influence GEO diagnostics.

## ADDED Requirements

### Requirement: Versioned query-cohort operations
The system SHALL let authorized users create, review, and select versioned query cohorts by market, locale, intent, priority, and expected product fact.

#### Scenario: User creates a revised cohort
- **WHEN** an authorized user changes an approved query cohort
- **THEN** the system creates a new revision and retains the prior revision for any linked assessment runs

### Requirement: Provider and market configuration
The system SHALL let authorized users configure included model providers for a market pack and SHALL display the collection mode and availability state for each provider.

#### Scenario: China market providers are configured
- **WHEN** an authorized user opens a China market pack
- **THEN** the console displays its configured domestic model providers and their current collection capability

#### Scenario: Global market providers are configured
- **WHEN** an authorized user opens an international market pack
- **THEN** the console displays its configured international model providers and their current collection capability

### Requirement: Controlled-manual evidence ingestion
The system SHALL support controlled manual entry or import of AI-answer observations during the MVP, requiring provider, model, query, execution time, raw answer or explicit failure, and any retained citation links.

#### Scenario: Valid manual observation is imported
- **WHEN** an analyst submits a complete controlled-manual observation for an approved run and query
- **THEN** the system stores it with imported provenance and makes it available for review and metric eligibility evaluation

#### Scenario: Incomplete manual observation is submitted
- **WHEN** an analyst omits required provenance or response-state information
- **THEN** the system rejects the submission with field-level validation guidance

### Requirement: Assessment-run operations and completeness
The system SHALL display an assessment run's cohort version, selected providers, query count, observation states, exclusions, and collection completeness before it is used for a client-facing conclusion.

#### Scenario: Run contains provider failures
- **WHEN** a run contains failed or unavailable provider collections
- **THEN** the console retains the failures, identifies affected coverage, and prevents the run from being represented as complete

### Requirement: Raw answer and citation review
The system SHALL let authorized users inspect each retained observation's raw answer, citation links, extracted brand and competitor signals, claim checks, risk flags, and provenance before approving it for diagnosis.

#### Scenario: Reviewer opens an observation
- **WHEN** a reviewer selects a retained answer observation
- **THEN** the console shows its raw answer, query, provider, provenance, citation records, extraction results, and claim-review status
