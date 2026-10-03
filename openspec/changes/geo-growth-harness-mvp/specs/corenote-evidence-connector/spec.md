# Spec Delta

## Purpose

Use CoreNote as the preferred knowledge-and-evidence source for the first GEO client case while allowing website and manual evidence sources when CoreNote access is absent, unavailable, or insufficient.

## ADDED Requirements

### Requirement: Source-linked CoreNote evidence import
The system SHALL import authorized CoreNote knowledge items into a workspace evidence pack with source identifiers, content title, relevant excerpts, access status, import time, and original-reference links where available.

#### Scenario: Authorized CoreNote product document is imported
- **WHEN** an authorized user imports a CoreNote product document into a GEO workspace
- **THEN** the system creates source-linked evidence entries that can be cited by factual checks and content briefs

### Requirement: Evidence taxonomy and review
The system SHALL classify imported or manually added evidence as brand identity, product capability, customer segment, use case, case study, policy, comparison, prohibited claim, or other and SHALL require review before it becomes an approved source for public-facing content.

#### Scenario: Unreviewed case-study note is added
- **WHEN** an analyst imports an internal case-study note
- **THEN** the note remains unapproved for public content until a reviewer assigns an appropriate taxonomy and approval status

### Requirement: Fallback evidence sources
The system SHALL allow approved website-source and manual-evidence entries when a CoreNote connection is unavailable and SHALL record the source type and evidence limitations.

#### Scenario: Client has no CoreNote connection
- **WHEN** an analyst adds an approved official website page as evidence for a workspace without CoreNote access
- **THEN** the system makes the page available to the evidence pack and labels it as a website fallback source

### Requirement: Synchronization failure visibility
The system SHALL preserve the last successful evidence version when a source synchronization fails and SHALL show the failure state, source, and time to authorized users.

#### Scenario: CoreNote synchronization fails after a prior import
- **WHEN** a scheduled or requested CoreNote synchronization cannot complete
- **THEN** the system retains the prior approved evidence version and displays a synchronization warning without silently replacing evidence
