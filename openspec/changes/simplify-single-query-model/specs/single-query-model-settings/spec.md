# Spec Delta

## Purpose

Provide a focused, secure model connection used only for AI-assisted Query generation, so an operator can configure the model once, understand a test result, and proceed to Query research with confidence.

## ADDED Requirements

### Requirement: Single active Query-generation model
The system SHALL present and use one current model configuration for AI Query generation in each workspace.

#### Scenario: Replacing the active model
- **WHEN** an operator saves a different Query-generation model configuration
- **THEN** the new configuration becomes the sole active configuration for Query generation
- **AND** previously active configurations are retained for audit history but are not eligible for generation

### Requirement: Focused configuration screen
The system SHALL provide a compact configuration screen containing provider selection, model name, API Base URL, API Key, connection status, and one primary save-and-test action.

#### Scenario: Viewing the Query model settings
- **WHEN** an operator opens the model settings screen
- **THEN** the system shows only the current Query-generation model rather than a list of inactive providers
- **AND** the screen does not expose Query prompt editing or prompt optimization controls

### Requirement: Actionable connection diagnostics
The system SHALL show a safe, actionable failure diagnosis adjacent to a failed connection test.

#### Scenario: Authentication test failure
- **WHEN** the provider rejects the connection with HTTP 401 or 403
- **THEN** the system records and displays that the key is invalid, unauthorized, or lacks model access
- **AND** the system advises the operator to verify the API key and model permission
- **AND** the system does not expose secret values or raw authorization headers

#### Scenario: Configuration, quota, upstream, or timeout failure
- **WHEN** a connection test fails due to HTTP 404, HTTP 429, HTTP 5xx, or a network timeout
- **THEN** the system records and displays a diagnosis and a recovery action appropriate to that failure class
- **AND** the operator can retry the test after correcting the configuration

### Requirement: Verified connection gating
The system SHALL permit AI Query generation only with the current model configuration after it has passed a connection test.

#### Scenario: Model is not verified
- **WHEN** no current Query-generation model is successfully verified
- **THEN** the system prevents AI Query generation from starting
- **AND** explains that the model must be saved and tested first

### Requirement: Secure credential handling
The system SHALL store the API key securely and return only non-secret credential indicators to clients.

#### Scenario: Reading settings after configuration
- **WHEN** the client retrieves the Query-generation model settings
- **THEN** the response includes whether a key is configured and its masked suffix where available
- **AND** the response never includes the plaintext API key

### Requirement: Connection-to-workflow handoff
The system SHALL provide a clear continuation action after a successful Query-generation model test.

#### Scenario: Returning after verification
- **WHEN** the current Query-generation model has a verified connection test
- **THEN** the model settings screen shows an action to return to **核心 Query 与首轮基线**
- **AND** selecting the action returns the operator to that workflow page without exposing a secret.

### Requirement: Baseline-owned Prompt management
The system SHALL make the active Query-generation prompt manageable from the core Query baseline workflow without returning Prompt controls to the model connection screen.

#### Scenario: Inspecting and editing the Prompt
- **WHEN** an operator opens Prompt management from the baseline workspace
- **THEN** the system shows the active Prompt name, version, body, required variables, and an input preview based on the current generation context
- **AND** validates required variables before allowing a save
- **AND** saves changes as a new active Prompt version rather than mutating the historic version.

#### Scenario: Recovering an earlier Prompt
- **WHEN** an operator chooses a historic Prompt version
- **THEN** the system presents its metadata and template
- **AND** restoration creates a new active version containing that historic template
- **AND** previous versions remain auditable.

#### Scenario: Requesting an LLM optimization suggestion
- **WHEN** the operator asks to optimize the Prompt using the verified Query model
- **THEN** the system returns a suggested template for review in the Prompt manager
- **AND** does not save or activate it until the operator explicitly saves it.

### Requirement: Observable Query generation
The system SHALL make LLM Query generation execution and outcomes explicit in the baseline workspace.

#### Scenario: Calling the LLM
- **WHEN** an operator starts LLM Query generation with a verified model
- **THEN** the UI displays a running state identifying the model, Prompt version, market, locale, requested count, and intents
- **AND** prevents duplicate submissions until the request completes.

#### Scenario: Generation succeeds or fails
- **WHEN** the generation request completes successfully
- **THEN** the UI selects the newly returned Query set, reports the generated count and provenance, and directs focus to Query review
- **WHEN** it fails
- **THEN** the UI shows an actionable inline failure without hiding the server diagnostic
- **AND** the separately labelled template fallback remains available.
