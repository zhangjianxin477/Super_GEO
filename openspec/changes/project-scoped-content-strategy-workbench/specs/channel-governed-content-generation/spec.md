# Spec Delta

## Purpose

Provide controlled, channel-aware AI content generation that uses approved project evidence, exposes model execution status, and requires structured human review before manual external delivery.

## ADDED Requirements

### Requirement: Channel contracts govern content generation
The system SHALL maintain a versioned contract for each supported channel that defines allowed content forms, structural requirements, tone, CTA rules, source/link expectations, and channel-specific boundaries. The system MUST recommend compatible writing profiles based on the selected channel and content type and MUST visibly warn before a member uses a mismatched profile.

#### Scenario: Supported channel recommends compatible profile
- **WHEN** a member selects a supported channel and content type for a Brief
- **THEN** the system recommends compatible profile versions and applies the channel contract to the planned output.

#### Scenario: Mismatched profile requires an explicit decision
- **WHEN** a member selects a profile that is incompatible with the channel contract
- **THEN** the system explains the mismatch and requires an explicit confirmation or a compatible replacement before generation.

### Requirement: Briefs retain editable Query and evidence decisions
The system SHALL let authorized members define core, supporting, and excluded Queries; choose an AI-proposed content angle; edit title, audience, objective, CTA, outline, and evidence scope; and record a structured approval or return-for-revision decision before drafting.

#### Scenario: A reviewer returns a Brief for revision
- **WHEN** a reviewer returns a Brief with a structured reason
- **THEN** the Brief remains editable, retains its prior version and review history, and cannot generate an approved draft until it is approved again.

### Requirement: AI generation is observable and fail-closed
The system SHALL display structured generation states including queued, preparing evidence, running, validating output, completed, retryable failure, and terminal failure. It MUST retain model identity, profile version, rendered prompt artifact, input evidence references, duration, and error classification. The system MUST NOT silently substitute a template for a failed model invocation.

#### Scenario: Provider failure is recoverable
- **WHEN** a configured model request times out, is rate limited, or returns invalid structured output
- **THEN** the system records the failure class and offers an authorized member a retry, model replacement, or evidence-scope reduction action.

#### Scenario: Template preview is not presented as AI output
- **WHEN** a member explicitly requests a template-only preview
- **THEN** the system labels it as non-LLM output and prevents it from being represented as a completed AI generation.

### Requirement: Claim review forms an evidence-backed approval gate
The system SHALL identify material factual, comparative, numerical, and outcome-oriented claims in a draft. Each unresolved material claim MUST record its risk level, evidence references and excerpts, reviewer decision, reviewer identity, and timestamp before approval. A rejected claim MUST require a subsequent content verification before the reviewer can close it.

#### Scenario: Unsupported claim blocks approval
- **WHEN** a draft contains an unresolved high-risk claim
- **THEN** the system blocks approval and identifies the required evidence, rewrite, deletion, or subject-matter-expert action.

### Requirement: Approved content is delivered as a manual publishing package
The system SHALL make an approved content asset available as a channel-aware manual delivery package that includes the content body, metadata, evidence map, publishing checklist, and immutable follow-up scope. The system MUST NOT automate external publication as part of this capability.

#### Scenario: Approved asset is exported for a channel
- **WHEN** a reviewer approves an asset for a supported channel
- **THEN** the system provides the relevant delivery package and records an export event separately from publication.
