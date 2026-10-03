# Spec Delta

## Purpose

使企业 GEO 工作台在首次使用时把复杂的受控人工采集流程转化为清晰、可执行且可恢复的操作路径，同时不突破第三方模型和内容渠道的人工控制边界。

## ADDED Requirements

### Requirement: Activated workspaces provide a single next action
系统 SHALL 在已激活但尚未完成评估的工作区中显示当前所处阶段、完成第一条回答证据的目的、累计保存进度，以及唯一的下一步操作入口。

#### Scenario: Incomplete assessment opens the dashboard
- **WHEN** 操作者打开存在待采集任务的已激活工作区
- **THEN** 系统展示中文的当前阶段和“去采集第一条回答”行动入口
- **AND THEN** 系统不得将计划中的任务或草案问题呈现为已获得的模型结论

### Requirement: Manual collection task provides an official platform handoff
系统 SHALL 在每一条已领取的人工采集任务中提供对应 AI 平台的官方入口，并明确说明打开入口不会让系统登录、提问、抓取回答或代替操作者发布内容。

#### Scenario: Operator opens a provider from a task
- **WHEN** 操作者在已领取的任务中选择“打开 [AI 平台]”
- **THEN** 系统在新标签页打开该平台的官方入口
- **AND THEN** 当前任务、输入内容和任务归属保持在工作区中不变

### Requirement: Workflow gates explain recovery in operator language
系统 SHALL 在分析、内容或报告页面因前置工作未完成而无法继续时，显示未完成原因、当前缺少的工作、以及一个返回下一步的明确操作。

#### Scenario: Operator opens analysis before evidence is complete
- **WHEN** 已选评估仍存在未导入的回答证据
- **THEN** 系统说明该页依赖已保存的回答和引用证据
- **AND THEN** 系统提供进入回答采集页面的操作，而不是仅显示不可用状态

### Requirement: Task progress stays understandable during refresh and recovery
系统 SHALL 在刷新工作区数据或恢复未完成任务时保持已渲染的工作页面可用，并以中文状态反馈说明正在刷新或已恢复任务。

#### Scenario: Operator refreshes while working on a task
- **WHEN** 操作者在领取任务后刷新工作区数据
- **THEN** 当前页面持续可见且显示刷新状态
- **AND THEN** 未完成任务仍可恢复，并且重复领取不会分配额外任务
