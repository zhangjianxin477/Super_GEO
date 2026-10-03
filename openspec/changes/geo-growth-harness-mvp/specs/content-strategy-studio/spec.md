# Spec Delta

## Purpose

Convert verified GEO findings into reviewable, channel-specific content plans and drafts that are grounded in approved product evidence and cannot be publicly released without human approval.

## ADDED Requirements

### Requirement: Evidence-grounded content brief
The system SHALL generate a content brief from selected GEO diagnoses, approved brand-evidence version, target market, locale, target channel, content type, and target query cohort.

#### Scenario: Analyst creates an English comparison-page brief
- **WHEN** an analyst selects a United States comparison-query gap, an approved evidence version, and a website comparison-page channel
- **THEN** the system generates a brief containing target intent, required facts, evidence links, competitor context, prohibited claims, outline, review criteria, and success measures

### Requirement: Channel-specific draft generation
The system SHALL support drafts for at least website pages, FAQ entries, use-case pages, comparison pages, case studies, and editorial articles and SHALL preserve the target channel and source brief for every draft.

#### Scenario: User generates a FAQ draft
- **WHEN** an approved FAQ brief is used to create a Chinese FAQ draft
- **THEN** the system stores the draft with its brief, locale, target channel, and evidence references

### Requirement: Claim validation and human approval
The system SHALL identify content claims lacking linked approved evidence and SHALL require a reviewer decision before content is marked approved for publication or client delivery.

#### Scenario: Draft contains an unverified performance claim
- **WHEN** a draft states a measurable performance result without an approved evidence reference
- **THEN** the system flags the claim and prevents approval until a reviewer removes it, attaches evidence, or explicitly rejects the draft

### Requirement: Ethical distribution guardrails
The system SHALL prohibit workflow recommendations that depend on fabricated reviews, fabricated citations, deceptive link schemes, or automatic mass publication and SHALL present public distribution as a reviewed task rather than a guaranteed AI-platform submission.

#### Scenario: User requests bulk publication without review
- **WHEN** a user attempts to mark an unreviewed batch of generated drafts for automatic public publication
- **THEN** the system blocks the action and explains that reviewed channel tasks are required
