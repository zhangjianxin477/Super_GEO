# Spec Delta

## Purpose

Ensure each enterprise operator can reliably resume one controlled-manual AI-answer collection task without losing context or reserving duplicate evidence work after a page refresh.

## ADDED Requirements

### Requirement: Preserve usable workspace during refresh
After the initial workspace load has completed, the system SHALL retain the current actionable workspace state while a refresh is in progress.

#### Scenario: Refreshing a ready collection workspace
- **WHEN** an operator refreshes data from a ready collection workspace
- **THEN** the collection screen remains mounted and usable until refreshed data replaces it

### Requirement: Reveal claimed task before background refresh
The system SHALL show the returned provider and exact query immediately after a controlled-manual task is successfully claimed, without waiting for dashboard refresh completion.

#### Scenario: Operator claims the next task
- **WHEN** the claim request returns an unfinished observation
- **THEN** the interface shows the current task, manual collection guidance, and evidence-import form

### Requirement: Resume one unfinished operator task
The system SHALL return an unfinished `collecting` observation assigned to the requesting operator in the selected assessment run before it claims another queued observation.

#### Scenario: Operator repeats the claim request
- **WHEN** the same operator requests the next task while an observation is already collecting for that operator and run
- **THEN** the system returns that existing observation without increasing its attempt count or reserving another observation

### Requirement: Explain collection progress and recovery
The collection screen SHALL state the total planned scope, the operator's current task when present, and the remaining queue, and SHALL explain that refreshes preserve the unfinished task.

#### Scenario: Operator starts manual collection
- **WHEN** a run has planned observations and no task is currently displayed
- **THEN** the start panel explains the one-task workflow and recovery behavior before the operator claims work
