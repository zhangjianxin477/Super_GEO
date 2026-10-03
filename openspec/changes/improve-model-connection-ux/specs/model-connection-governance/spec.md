# Spec Delta

## Purpose

Provide an enterprise-safe way to configure, test, and select an LLM connection for internal GEO actions without exposing credentials or confusing it with real-platform visibility collection.

## ADDED Requirements

### Requirement: Preset and custom connection setup
The system SHALL let an authorized workspace user start from a recognized provider preset or configure a custom provider label, endpoint, model, market, and locale. A custom label MUST not be rejected solely because it is not in the preset catalog.

#### Scenario: Configure a custom compatible gateway
- **WHEN** an authorized user enters a custom provider label, valid HTTP(S) base URL, model, target market, and locale
- **THEN** the system stores a connection configuration that can be used for internal AI operations after credentials are supplied and it passes testing

#### Scenario: Validate incomplete execution configuration
- **WHEN** a user supplies an API execution mode with only an endpoint or only a model
- **THEN** the system rejects the configuration with a field-level explanation that both values are required

### Requirement: Secure save and connection test feedback
The system SHALL keep API keys server-side, must not return a secret value to the browser, and SHALL allow the user to save and test a configuration with a minimal authorized request.

#### Scenario: Successful save-and-test
- **WHEN** an authorized user saves complete parameters with a valid credential and the endpoint responds with a parseable model result
- **THEN** the UI shows the verified state, model, elapsed time, and test timestamp without revealing the credential

#### Scenario: Recoverable connection failure
- **WHEN** a connection test fails because of a missing credential, invalid endpoint, authentication failure, or model error
- **THEN** the user sees a non-sensitive failure reason and a concrete next action while the existing credential remains hidden

### Requirement: Verified connection selection
The system SHALL expose connection readiness and test state so that only configured, credentialed, successfully verified executable connections are presented as eligible for AI Query or Prompt operations.

#### Scenario: Unverified connection exists
- **WHEN** a saved connection has not yet passed a test
- **THEN** it is shown as unverified and cannot be represented as an eligible AI execution connection

### Requirement: Separate API execution from real-platform collection
The system SHALL state that model connections operate only internal AI actions, while real AI-platform visibility observations remain controlled-manual collection unless a separately authorized connector is implemented.

#### Scenario: User views connection settings
- **WHEN** a user opens the connection settings
- **THEN** the interface distinguishes internal generation connections from the list of real platforms whose observations are manually collected
