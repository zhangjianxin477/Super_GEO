# Spec Delta

## Purpose

Turn preserved AI answers and approved brand evidence into transparent GEO signals, competitor comparisons, and prioritized diagnostic explanations without implying guaranteed platform ranking outcomes.

## ADDED Requirements

### Requirement: Answer-level brand and competitor analysis
The system SHALL identify configured brand and competitor mentions, recommendation context, relative list position when observable, cited URLs, and sentiment or risk context for every completed answer observation.

#### Scenario: Answer recommends two configured competitors but not the client brand
- **WHEN** an observed answer names two configured competitors in a recommended-tools list and omits the client brand
- **THEN** the system records both competitor recommendations and a client-brand omission for that observation

### Requirement: Transparent GEO metrics
The system SHALL calculate and display, for a selected completed cohort, brand mention rate, recommendation rate, owned-source citation rate, third-party citation rate, factual-accuracy rate, and competitor visibility gap with documented numerator, denominator, and exclusions.

#### Scenario: User opens a citation metric
- **WHEN** a user views the owned-source citation rate for a model and cohort
- **THEN** the system displays the counted answer observations, the total eligible observations, and any excluded failures or imports

### Requirement: Evidence-grounded factual assessment
The system SHALL compare answer claims about a client’s brand or product against the workspace’s approved evidence version and categorize claims as supported, unsupported, conflicting, or insufficient-evidence.

#### Scenario: Answer attributes an unsupported feature to the product
- **WHEN** an answer claims the client product includes a feature absent from the approved evidence pack
- **THEN** the system flags the claim as unsupported and links the result to the applicable evidence pack version

### Requirement: Actionable diagnosis and prioritization
The system SHALL generate a diagnosis for material visibility gaps that identifies the affected query cohort, observed evidence, likely gap category, recommended next action, confidence level, and explicit uncertainty where causation cannot be established.

#### Scenario: Category-discovery coverage is weak
- **WHEN** the client brand is absent from a high-priority category-discovery cohort while competitors are repeatedly cited
- **THEN** the system produces a diagnosis referencing the missing-query evidence and suggests a prioritized content or evidence action without guaranteeing a future ranking result
