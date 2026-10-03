# Spec Delta

## Purpose

Create governed, reusable GEO query datasets that represent real Chinese and international buyer questions and enable comparable baseline and follow-up measurement.

## ADDED Requirements

### Requirement: Query dataset management
The system SHALL let authorized users create a named query dataset for a workspace and add individual queries with locale, market, language, user role, business stage, intent category, priority, and target product metadata.

#### Scenario: Analyst creates a Chinese discovery-query cohort
- **WHEN** an analyst adds a Chinese query about choosing an AI knowledge-base tool and classifies it as a high-priority category-discovery query
- **THEN** the query is stored in the selected dataset with its classification metadata

### Requirement: Dataset review and versioning
The system SHALL support draft, approved, retired, and superseded states for a dataset and SHALL retain an immutable version used by each assessment run.

#### Scenario: Approved dataset is revised after a baseline run
- **WHEN** an analyst adds a new query to an approved dataset after a baseline run completed
- **THEN** the system creates a new dataset version and keeps the baseline run linked to the original version

### Requirement: Comparable cohort selection
The system SHALL allow an assessment to select all approved queries or a defined, filterable cohort and SHALL label results as non-comparable when the follow-up cohort differs from its baseline cohort.

#### Scenario: Follow-up excludes an original high-priority query
- **WHEN** a follow-up assessment omits a query that was present in the chosen baseline cohort
- **THEN** the system flags the comparison as non-comparable and identifies the excluded query
