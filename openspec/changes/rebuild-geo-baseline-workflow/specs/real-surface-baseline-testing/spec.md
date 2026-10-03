# real-surface-baseline-testing Specification

## Purpose

Provide an auditable first GEO visibility baseline from controlled human collection on real AI platform surfaces.

## ADDED Requirements

### Requirement: The system SHALL generate a reviewable Seed Query set from Product Profile data
The system SHALL generate a draft set of 5–20 Seed Queries for a selected market pack from a workspace-scoped Product Profile. Every generated item SHALL include the question, intent, market, locale, rationale, priority, and provenance. The system SHALL not call a provider or make an LLM output claim if no configured, approved model connector is available.

#### Scenario: Operator generates a Chinese first-baseline set
- **WHEN** an operator selects the CN market pack and requests 10 questions for a saved Product Profile
- **THEN** the system creates a draft set containing 5–20 Chinese questions derived from the profile's category, audience, and stated user intents
- **AND THEN** each item identifies its deterministic/template provenance and rationale.

#### Scenario: Generated questions require review
- **WHEN** a draft query set is generated
- **THEN** no query is eligible for Test Run task creation until an operator explicitly approves it
- **AND THEN** excluded questions do not appear in the test matrix.

### Requirement: The system SHALL create a controlled-manual Test Run matrix from approved queries
The system SHALL create one unique collection task for each approved Seed Query × selected platform combination. A Test Run SHALL record market, locale, controlled-manual collection mode, and explicit freshness/search-environment instructions. It SHALL not represent itself as web automation.

#### Scenario: User starts a US Test Run
- **WHEN** an operator creates a US Test Run using three approved English Seed Queries and ChatGPT, Gemini, Claude, and Perplexity
- **THEN** the system creates exactly 12 unassigned tasks
- **AND THEN** every task presents the standard real-platform protocol and the copied query text.

#### Scenario: Duplicate run creation request is retried
- **WHEN** a client retries creation using an already-created Test Run request identity
- **THEN** the system returns the existing run or rejects the duplicate without duplicating tasks.

### Requirement: The system SHALL preserve real-surface evidence and collection context
The system SHALL require submitted raw answer text, observed timestamp, source/citation links (which may be empty only if the platform provided no citations), fresh-session state, search-enabled state, and collector identity. It SHALL record an audit event for claim, submit, revision request, and review transitions.

#### Scenario: Collector submits an observation
- **WHEN** a task claimant submits a captured ChatGPT answer with its context metadata
- **THEN** the task moves to submitted and the system saves the exact raw answer, citation links, and collector/timestamp information
- **AND THEN** the platform answer is labelled as a real-surface import rather than API output.

#### Scenario: Evidence contains no citations
- **WHEN** a platform response provides no citations
- **THEN** the collector can record an empty citation list with the explicit no-citation context
- **AND THEN** the task is still eligible for reviewer evaluation.

### Requirement: The system SHALL derive baseline readiness from reviewed evidence
The server SHALL derive, not accept from the client, a Test Run readiness state. A run SHALL become ready-for-review after every non-skipped task has submitted evidence, and baseline-ready only after every non-skipped observation is reviewed.

#### Scenario: Run reaches baseline ready
- **WHEN** all non-skipped Test Run tasks have reviewer-approved observations
- **THEN** the server returns baseline-ready with task counts
- **AND THEN** the user is directed to Visibility & Citation Baseline rather than a fabricated diagnostic conclusion.

### Requirement: The system SHALL enforce workspace isolation and claim safety
All query sets, runs, tasks, and observations SHALL be workspace-scoped. Claiming an unassigned task SHALL be atomic; a different collector cannot claim a task already claimed by another collector.

#### Scenario: Two operators claim the same task
- **WHEN** one operator successfully claims an unassigned collection task
- **THEN** a second claim attempt returns a conflict
- **AND THEN** the first assignment remains unchanged.

## ADDED Requirements

### Configurable, model-backed Query generation and configuration

### Requirement: The system SHALL support configurable, paginated Seed Query volumes
The system SHALL accept a target Seed Query count from 1 through 200. It SHALL display 10 review rows per page, preserve approval and exclusion state across pages, and continue to recommend 5–20 questions for a first T0 baseline without imposing that recommendation as a hard limit.

#### Scenario: Operator asks for 24 Queries
- **WHEN** an operator requests 24 Seed Queries
- **THEN** the system creates a 24-item draft set when the selected generator succeeds
- **AND THEN** the review screen displays no more than 10 Query rows at one time with page controls.

### Requirement: The system SHALL provide model-backed and manual Query intake
The system SHALL support AI-generated and manually-created Seed Queries. AI generation SHALL accept keywords, at least one intent, a selected prompt version, and a selected executable model connection. Manual Query creation SHALL capture question, intent, market/locale, priority, and rationale/source. Both paths SHALL create items in the same review lifecycle, with distinct provenance.

#### Scenario: AI generates Queries through an approved connection
- **WHEN** an operator selects an executable OpenAI-compatible connection, supplies keywords and intent, then requests a Query set
- **THEN** the server SHALL render the saved prompt with Product Profile and operator inputs, invoke the configured provider only from the server, validate the structured answer, and store prompt and connection provenance with the run.

#### Scenario: No executable connection exists
- **WHEN** no connection with a saved credential and executor configuration is available
- **THEN** the UI SHALL explain that AI generation cannot run and direct the operator to Model & API connections
- **AND THEN** no response SHALL be labelled LLM-generated unless a model invocation completed.

#### Scenario: Operator adds a manual Query
- **WHEN** an operator supplies a valid manual question and metadata
- **THEN** it SHALL appear in the active Query Set as `manual` provenance and be eligible for approval and Test Run matrix creation.

### Requirement: The system SHALL expose secure model and prompt configuration
The system SHALL provide a visible Model & API connections page in Operations & governance. It SHALL support a versioned Query-generation prompt and an OpenAI-compatible endpoint configuration with a mode, base URL, model, credential status, test action, and non-secret error/status feedback. It SHALL never render a previously saved API key or send it to client-side model code.

#### Scenario: Administrator saves a connection
- **WHEN** an administrator configures an official API or enterprise gateway connection with a base URL, model name, and API key
- **THEN** the server SHALL encrypt the key, return only masked credential metadata, and make the connection available for explicit Query-generation selection.





