# Spec Delta

## Purpose

Provide an API-backed, tenant-scoped GEO workspace experience so enterprise users operate current governed records rather than a fixed demonstration dataset.

## ADDED Requirements

### Requirement: API-backed workspace context
The system SHALL load the authenticated user's permitted workspace context from tenant-scoped API data and SHALL not present a hard-coded customer workspace as production data.

#### Scenario: Authorized workspace opens
- **WHEN** an authorized user opens the GEO application with an accessible workspace
- **THEN** the application displays that workspace's name, available market packs, and current governed data context

#### Scenario: User has no accessible workspaces
- **WHEN** an authenticated user has no workspace access
- **THEN** the application displays an empty-state explanation and does not display another tenant's records

### Requirement: Explicit asynchronous states
The system SHALL visibly distinguish loading, empty, failed, and ready states for every primary workspace data view.

#### Scenario: Dashboard data is loading
- **WHEN** the selected workspace dashboard request is in progress
- **THEN** the application shows a loading state without substituting fixture metrics as live results

#### Scenario: Dashboard request fails
- **WHEN** a workspace data request fails
- **THEN** the application displays a recoverable error state with retry guidance and preserves no stale value as if it were current

### Requirement: Tenant-scoped data boundaries
The system SHALL request and display only records that belong to the selected tenant workspace and SHALL preserve server-enforced authorization errors as actionable UI messages.

#### Scenario: Cross-tenant record is requested
- **WHEN** a user requests a resource outside their workspace authorization
- **THEN** the application does not render the record and displays an access-denied state

### Requirement: Controlled development bootstrap
The system SHALL keep any local sample data behind an explicit development bootstrap path and SHALL label it as sample data.

#### Scenario: Development bootstrap is used
- **WHEN** a developer elects to load the local sample workspace
- **THEN** the application visibly identifies the workspace as sample data and does not imply it is a live client result
