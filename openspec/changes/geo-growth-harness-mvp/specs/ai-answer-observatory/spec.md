# Spec Delta

## Purpose

Capture reproducible, evidence-preserving observations of how domestic and international AI answer providers respond to an approved GEO query cohort.

## ADDED Requirements

### Requirement: Model assessment run
The system SHALL allow an authorized user to create an assessment run by selecting a workspace, an approved query-dataset version, one or more configured model providers, market and locale context, and a run label.

#### Scenario: Analyst starts a dual-market assessment
- **WHEN** an analyst selects approved Chinese and English query cohorts and configured domestic and international model providers
- **THEN** the system creates a run with the selected configuration and a traceable run identifier

### Requirement: Raw response evidence retention
For every completed query-provider execution, the system SHALL retain the exact query, execution time, provider identity, available model identity, locale context, raw answer, cited URLs or source references, execution status, and error details when applicable.

#### Scenario: Provider returns an answer with citations
- **WHEN** a provider returns an answer containing two cited URLs
- **THEN** the system stores the raw answer and both URLs alongside the query-provider execution record

### Requirement: Importable observation evidence
The system SHALL permit an authorized analyst to import externally collected answer observations when direct provider execution is unavailable and SHALL require source, collection time, collector, and supporting evidence for the import.

#### Scenario: Analyst imports a manually captured answer
- **WHEN** an analyst imports an answer captured from an unsupported provider with a timestamp and screenshot reference
- **THEN** the system stores it as imported evidence and distinguishes it from directly executed results

### Requirement: Incomplete-run transparency
The system SHALL show the completion status for every planned query-provider execution and SHALL not present incomplete runs as complete assessments.

#### Scenario: One provider execution fails
- **WHEN** one query-provider execution fails during a batch
- **THEN** the assessment displays the failure, preserves its error details, and excludes the missing result from aggregate metrics unless the user explicitly includes incomplete data
