# Spec Delta

## Purpose

Defines an actionable Brand Diagnostic launch contract so business inputs become traceable GEO work rather than unstructured project notes.

## ADDED Requirements

### Requirement: Guided diagnostic brief
The system SHALL collect an actionable diagnostic brief using controlled selections for diagnostic goal, product category, target markets, customer roles, query intents, owned evidence sources, competitors, and execution preference. Each visible business input SHALL explain the downstream GEO work it controls.

#### Scenario: User selects a market package
- **WHEN** a user selects a China or United States market package
- **THEN** the system SHALL show the included locale, recommended AI platforms, and recommended content channels before the user creates the diagnostic.

#### Scenario: User selects a diagnostic objective
- **WHEN** a user selects a discovery, comparison, evaluation, or problem-solving objective
- **THEN** the system SHALL record the objective in the diagnostic brief and include it in the generated Query Research work plan.

### Requirement: Launch plan with concrete outputs
The system SHALL produce a launch plan for every diagnostic brief, including the planned Query categories, estimated candidate Query count, provider-test matrix, evidence tasks, competitor-research tasks, and the next allowable action.

#### Scenario: Successful brief creation
- **WHEN** a user creates a complete diagnostic brief
- **THEN** the system SHALL return a persisted diagnostic project and a launch plan with explicit counts and dependencies.

### Requirement: Governed execution readiness
The system SHALL distinguish business execution preference from technical connector configuration. It SHALL show whether an AI-assisted analysis is launchable, blocked by configuration, or intentionally routed to controlled manual work without exposing credentials or retry policy to a business user.

#### Scenario: No approved AI connection
- **WHEN** the user requests AI-assisted analysis but no eligible authorised connector is configured
- **THEN** the system SHALL persist the preference, mark the launch plan as configuration-blocked, and provide an operator action instead of claiming analysis has started.

#### Scenario: Controlled manual execution
- **WHEN** the user chooses controlled manual evidence collection
- **THEN** the system SHALL generate manual evidence and platform-test work without logging into or automating third-party model websites.

### Requirement: Traceable downstream handoff
The system SHALL preserve the diagnostic brief and launch-plan version for downstream Query Research, multi-platform testing, competitor research, knowledge assets, and content action modules.

#### Scenario: Scope changes after a launch plan exists
- **WHEN** a user changes a brief input that controls market, intent, source, competitor, or execution scope
- **THEN** the system SHALL mark the prior launch plan superseded and require a new plan before downstream work is treated as current.
