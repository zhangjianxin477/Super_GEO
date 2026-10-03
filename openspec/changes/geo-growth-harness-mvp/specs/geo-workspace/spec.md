# Spec Delta

## Purpose

Provide a tenant-isolated workspace that records a client’s approved brand facts, product scope, markets, competitors, roles, and evidence policy before any GEO assessment or content work begins.

## ADDED Requirements

### Requirement: Enterprise workspace configuration
The system SHALL allow an authorized workspace administrator to create and update one enterprise GEO workspace with a display name, operating markets, supported locales, brand names, products, target customer segments, approved websites, and named competitors.

#### Scenario: Administrator configures a cross-market workspace
- **WHEN** an administrator saves China and United States as markets with Chinese and English as their locales
- **THEN** the workspace stores the configuration and makes it available to query, assessment, content, and reporting workflows

### Requirement: Versioned brand fact policy
The system SHALL maintain a versioned set of approved brand facts, claims, prohibited claims, and evidence references for each workspace.

#### Scenario: Reviewer changes an approved product claim
- **WHEN** a reviewer replaces an approved claim with an updated, evidence-linked claim
- **THEN** the system records a new version and identifies which later content or assessments used the prior version

### Requirement: Workspace isolation and role controls
The system SHALL prevent members of one enterprise workspace from viewing or modifying the configuration, evidence, results, content, or reports of another workspace and SHALL distinguish administrator, analyst, reviewer, and viewer roles.

#### Scenario: Viewer attempts to edit a brand profile
- **WHEN** a user assigned the viewer role submits a brand-profile edit
- **THEN** the system rejects the change and records the denied action in the workspace audit trail
