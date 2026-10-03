# geo-workflow-navigation Specification

## Purpose

Present an enterprise GEO workflow in the order users need to execute it, separating configuration from evidence-backed analysis.

## ADDED Requirements

### Requirement: The system SHALL distinguish Project settings from the GEO workflow
The interface SHALL place Project overview, Product profile, owned evidence, market/ICP, and competitor seeds in an un-numbered settings section. Saving these records SHALL not be presented as a completed GEO diagnosis or baseline.

#### Scenario: New customer opens a profile-only project
- **WHEN** the customer has entered Product Profile information but has not created a Test Run
- **THEN** the project state states that the first baseline has not been established
- **AND THEN** the primary action is to generate core test queries.

### Requirement: The system SHALL show workflow phases in delivery order
The navigation SHALL order numbered phases as Core Queries & first baseline, Multi-platform real test, Visibility & citation baseline, GEO diagnosis, Query research, Industry & competitor research, Content strategy & AI writing, Content action & retest, and Reports. Monitoring and Harness administration SHALL be visually separated as operations/governance.

#### Scenario: User scans the workflow
- **WHEN** the sidebar is displayed
- **THEN** the user can determine the next phase without reading implementation-state labels or technical prerequisite names.

### Requirement: The system SHALL use action-oriented status communication
User-facing status components SHALL state the business meaning, clear next action, and blocking reason when relevant. Internal states such as raw counts or connector configuration SHALL only appear where operationally needed and shall not be the primary explanation of workflow progress.

#### Scenario: No test evidence exists
- **WHEN** the first baseline has no submitted observations
- **THEN** the page explains that no real platform evidence has been collected
- **AND THEN** its primary action points to creating or continuing a controlled-manual Test Run.
