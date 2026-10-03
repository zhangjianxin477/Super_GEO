# Spec Delta

## Purpose

确保每个项目的 GEO 诊断只使用该项目当前真实平台测试批次，并将 02 的回传与审核证据自动反映到 03 的进度和正式基线指标中。

## ADDED Requirements

### Requirement: Project has one automatic current diagnostic test source
The system SHALL maintain one current real-platform test batch for each project within its workspace. The current batch SHALL be selected automatically when a formal real-platform test is created, without exposing a manual test-batch selector in the normal diagnostic workflow.

#### Scenario: Creating a formal test establishes the current source
- **WHEN** a user creates a real-platform test for a project from the approved Query dataset
- **THEN** that test becomes the project’s current GEO diagnostic data source
- **AND** the selected source belongs to the same workspace and project

#### Scenario: Appending platforms preserves the current source
- **WHEN** a user appends supported platforms to the project’s current real-platform test
- **THEN** the additional tasks remain in the same current source batch
- **AND** previously collected evidence in that batch remains available to GEO diagnosis

### Requirement: GEO diagnosis reads the project current test source
The GEO diagnosis and baseline view SHALL load data from the project’s current real-platform test source instead of inferring a source from historical test state, creation order, or reviewed evidence.

#### Scenario: A newer current test supersedes an older reviewed test
- **GIVEN** a project has an older test with reviewed evidence and a newer test marked as current
- **WHEN** a user opens GEO diagnosis
- **THEN** the view shows task, platform, query, and collection data from the newer current test
- **AND** the older test does not replace the current source automatically

#### Scenario: Projects remain isolated
- **GIVEN** two projects have real-platform test batches in the same workspace
- **WHEN** a user opens GEO diagnosis for one project
- **THEN** the view only reads the current source associated with that project

### Requirement: Evidence states remain visible without corrupting formal metrics
The GEO diagnosis view SHALL show collection and review state for every task in the current test source. It SHALL count only approved evidence in formal visibility metrics.

#### Scenario: Returned evidence is awaiting review
- **GIVEN** the current test contains returned observations that are not yet approved
- **WHEN** a user opens GEO diagnosis
- **THEN** the view shows returned and pending-review counts for the current source
- **AND** labels formal visibility metrics as pending review rather than presenting a 0% performance result

#### Scenario: Approved evidence updates formal metrics
- **GIVEN** a returned observation in the current test is approved
- **WHEN** the user refreshes or opens GEO diagnosis
- **THEN** the view includes that evidence in eligible visibility metrics
- **AND** updates affected platform and Query status without requiring a manual synchronization action

### Requirement: Source provenance is understandable in the workflow
The real-platform testing and GEO diagnosis views SHALL communicate that approved evidence from the project’s current 02 test batch automatically supplies 03 GEO diagnosis.

#### Scenario: User reviews evidence in real-platform testing
- **WHEN** a user approves an observation in the current real-platform test
- **THEN** the testing view confirms that it will automatically update GEO diagnosis

#### Scenario: No current test exists
- **WHEN** a user opens GEO diagnosis for a project without a current real-platform test
- **THEN** the view clearly explains that the user must create and run the project’s real-platform test before formal diagnosis can be calculated
