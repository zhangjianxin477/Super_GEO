# Spec Delta

## Purpose

Define a minimal, reusable enterprise AI Harness contract so GEO is the first complete workflow while future knowledge, sales, service, or industry plugins can reuse governed integrations, skills, evaluation, and audit capabilities.

## ADDED Requirements

### Requirement: Standard extension descriptors
The system SHALL register each knowledge adapter, model provider, analysis skill, content skill, workflow action, and future plugin with a descriptor that declares its inputs, outputs, permissions, required configuration, supported markets or locales, and failure behavior.

#### Scenario: A content skill is registered
- **WHEN** an administrator registers a comparison-page content skill
- **THEN** the system stores its declared input evidence, output draft format, required reviewer permission, locale support, and error behavior

### Requirement: Governed extension execution
The system SHALL execute an extension only after validating its declared configuration and caller permissions and SHALL record the extension identity, input references, output references, time, and execution status in the audit trail.

#### Scenario: Analyst invokes an unconfigured model provider
- **WHEN** an analyst starts an assessment using a provider missing required credentials or market configuration
- **THEN** the system rejects the execution before it starts and records the configuration failure

### Requirement: Adopt-first component review
Before a new non-domain technical module is implemented, the system’s delivery process SHALL record whether existing open-source or GitHub components were evaluated and SHALL document the chosen component or the reason custom implementation is necessary.

#### Scenario: Team needs a workflow-execution module
- **WHEN** the delivery team introduces workflow execution capability
- **THEN** the implementation record identifies evaluated candidate components, license and maintenance checks, integration decision, and any rationale for building a custom module

### Requirement: Extension containment
The system SHALL prevent a failed or unauthorized extension execution from modifying approved evidence, published-content status, or completed assessment evidence outside its declared output scope.

#### Scenario: Website adapter returns malformed data
- **WHEN** a website-source adapter returns malformed extraction data during evidence import
- **THEN** the system marks the import failed and leaves the currently approved evidence version unchanged
