# Spec Delta

## ADDED Requirements

### Requirement: Resume a platform lane from a checkpoint
The system SHALL resume an existing real-platform Test Run for one selected platform without creating a new Test Run or changing the frozen Query Dataset.

#### Scenario: Failed tasks are resumed
- **WHEN** the selected lane contains `failed` or `needs-human` Browser Agent tasks and the selected Agent is online and supports the platform
- **THEN** those tasks are rebound to that Agent, returned to `unassigned` with `agentState=queued`, and returned in `resumedTaskIds`

#### Scenario: Completed evidence is preserved
- **WHEN** the selected lane contains submitted, reviewed, skipped, or captured-for-review tasks
- **THEN** the operation does not clear their evidence, change their task state, or include them in `resumedTaskIds`

#### Scenario: Stale leases are recovered
- **WHEN** a queued/running Browser Agent task has been claimed longer than the lease timeout
- **THEN** the claim is released and the task is safely requeued for the selected Agent

#### Scenario: Resume is repeated
- **WHEN** the operator resumes the same lane again before any new failure
- **THEN** the server does not create duplicate tasks or increment attempts for already queued tasks

### Requirement: Show resumable work in the console
The platform task console SHALL show the number of failed, needs-human, and stale resumable tasks and provide a platform-scoped resume action.

#### Scenario: Operator resumes a lane
- **WHEN** the operator clicks the resume action with a compatible online Browser Agent
- **THEN** the UI refreshes the same Test Run and explains that completed tasks were skipped and the lane is ready to start again

### Requirement: Preserve the real browser execution path
The resume operation SHALL not call any model API or fabricate an answer; it only requeues tasks for the existing customer-side Browser Agent flow.

#### Scenario: Browser Agent remains the execution path
- **WHEN** the operator resumes a platform lane
- **THEN** the system only prepares queued work for the selected customer-side Browser Agent and requires the existing platform start action to execute it
