# Spec Delta

## Purpose

Defines controlled-manual AI answer collection plans so GEO evidence remains traceable and incomplete collection cannot be misrepresented as a finished diagnostic result.

## ADDED Requirements

### Requirement: Provider-specific collection plans
The system SHALL create a collection plan for each selected provider in each market, including the linked query cohort, operator instructions, collection method, current status, and due context.

#### Scenario: Domestic providers are selected
- **WHEN** a China market project selects DeepSeek, 通义千问, 豆包, Kimi, 元宝, GLM, or 文心一言
- **THEN** the system creates separate controlled-manual collection tasks for the selected providers only

#### Scenario: Global providers are selected
- **WHEN** an `en-US` market project selects ChatGPT, Gemini, Claude, or Perplexity
- **THEN** the system creates separate controlled-manual collection tasks for the selected providers only

### Requirement: Explicit collection completeness
The system SHALL show planned, collecting, imported, blocked, and failed collection states and SHALL surface provider/query coverage before presenting baseline metrics.

#### Scenario: No answers have been imported
- **WHEN** every collection task is planned or collecting
- **THEN** the project setup view labels the baseline as not ready and does not display unqualified mention, recommendation, citation, sentiment, or ranking conclusions

#### Scenario: Only some providers are imported
- **WHEN** completed imports cover fewer providers or queries than the collection plan
- **THEN** the system displays the measured coverage and limitations alongside any partial findings

### Requirement: Human-entered evidence provenance
The system SHALL require imported AI-answer evidence to retain source text or artifact reference, provider identity, observed time, actor/import provenance, and any source links supplied by the answer.

#### Scenario: An operator submits incomplete answer evidence
- **WHEN** required provenance fields are absent from a controlled-manual import
- **THEN** the system rejects the import and states which fields are required

#### Scenario: An operator imports valid evidence
- **WHEN** all required provenance is supplied for a planned provider/query task
- **THEN** the system records the evidence against the appropriate market, run, provider, and query for later review

### Requirement: No fabricated provider execution
The system SHALL not represent a provider plan, query suggestion, or draft diagnostic as a model execution, citation, publication, or GEO outcome.

#### Scenario: A collection plan is created
- **WHEN** onboarding creates provider tasks
- **THEN** the UI and API identify them as controlled-manual work awaiting evidence import

### Requirement: Governed problem monitoring and manual rechecks
The system SHALL allow an authorized operator to create a monitoring plan only for an approved market package, approved query cohort, and configured provider subset. A monitoring plan SHALL expose an active or paused state and MAY record a suggested cadence, but it SHALL not autonomously execute a provider, submit a prompt, scrape a result, or publish content.

#### Scenario: An active monitoring plan is rechecked
- **WHEN** an authorized operator triggers a recheck for an active plan
- **THEN** the system creates a new single-query controlled-manual assessment run, records the audit event, and directs the operator to import retained answer evidence for only the selected providers

#### Scenario: A paused monitoring plan is rechecked
- **WHEN** an operator tries to create a recheck for a paused plan
- **THEN** the system rejects the request and creates no assessment run or collection tasks