# Spec Delta

## Purpose

Make the Query-generation prompt a visible, validated, versioned instruction asset that can be safely improved through an eligible LLM connection without silently changing production behavior.

## ADDED Requirements

### Requirement: Readable required-variable validation
The system SHALL display all required Query prompt variables as legible labeled tokens, report how many are present, and prevent saving a version that omits any required variable.

#### Scenario: Prompt retains every required variable
- **WHEN** a user edits a Query-generation prompt containing the required variables
- **THEN** the interface reports validation success and permits saving it as a new version

#### Scenario: Prompt omits a required variable
- **WHEN** a user removes one or more required variables
- **THEN** the interface identifies the missing variables near the editor and does not save a new active version

### Requirement: Non-destructive AI optimization preview
The system SHALL let a user choose an eligible verified connection, supply an optimization goal, and request an AI-suggested Query prompt draft. The system MUST validate that required variables are retained before offering it for application.

#### Scenario: Apply a valid suggestion
- **WHEN** the selected connection produces a valid optimized prompt with all required variables
- **THEN** the user can preview the suggestion and explicitly apply it to the editable draft without creating a version yet

#### Scenario: Invalid suggested output
- **WHEN** optimization output omits a required variable or cannot be parsed into a prompt
- **THEN** the system preserves the active draft and reports that the suggestion was not applied

### Requirement: User-controlled versioned prompt save
The system SHALL create a new version only when the user explicitly saves a valid draft, preserve prior versions for traceability, and show the resulting active version.

#### Scenario: Save optimized draft
- **WHEN** a user applies an optimization suggestion and selects save as new version
- **THEN** the system records a new active prompt version and reports its version identifier
