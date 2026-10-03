# Spec Delta

## Purpose

让 GEO 内容产出从泛化文案生成转为由品牌事实、模型回答缺口、竞品证据和渠道规则共同约束的可审核工作流，避免把未经验证的产品主张写入对外内容。

## ADDED Requirements

### Requirement: Content briefs are grounded in evidence packs and query gaps
系统 SHALL 为每个 Content Brief 关联目标 Query Cluster、市场/语言、渠道、相关 Query Gap、可用事实来源、竞品证据、禁止主张、推荐结构、CTA、链接建议和验收标准；没有有效证据来源的关键主张不得作为 Brief 的推荐主张。

#### Scenario: Operator creates a brief for a citation coverage gap
- **WHEN** 操作者从已完成评估或竞品研究中选择一个 Query Gap 创建 Brief
- **THEN** 系统生成或要求填写与该 Gap 相关的目标 Query、可用来源和渠道约束
- **AND THEN** 系统展示尚无证据支持的主张为风险项，而非作为可直接发布的结论

### Requirement: LLM drafts identify their factual support and constraints
系统 SHALL 支持使用 LLM 为已准备的 Brief 生成渠道化草稿，但每一份草稿 SHALL 记录所用 Brief、模型/Prompt 版本、支持其关键主张的来源引用、未解决风险和生成时间；LLM 草稿不得自动视为已发布内容。

#### Scenario: LLM generates a Help Center draft from an approved brief
- **WHEN** 操作者对包含事实包和渠道约束的 Brief 请求生成草稿
- **THEN** 系统返回带标题、结构和关键主张来源标记的渠道草稿
- **AND THEN** 系统将草稿状态设为需要审核，且不创建任何外部发布动作

### Requirement: Claim validation gates approval and distribution
系统 SHALL 在草稿审批前对关键产品主张执行事实支持、禁止主张、链接可用性和渠道合规检查，并向审核人展示通过、失败和不确定的检查项及其证据。

#### Scenario: Draft includes an unsupported claim
- **WHEN** 草稿检查发现某个关键主张没有获批准的事实支持
- **THEN** 系统将该草稿标记为需修改或需人工复核
- **AND THEN** 系统不得允许其进入已批准或待发布状态，直至风险被解决或被明确豁免并留下审计说明

### Requirement: Publication and retest links remain traceable
系统 SHALL 允许在人工或已授权渠道发布后登记内容 URL、渠道、发布时间、证明工件和目标 Query；系统 SHALL 支持为关联 Dataset 创建预定复测，并在报告中区分发布前基线与发布后观测。

#### Scenario: Operator records a published article
- **WHEN** 操作者提交已发布内容的 URL、渠道和发布时间
- **THEN** 系统将发布记录关联到其草稿、Brief 和目标 Query
- **AND THEN** 系统允许为该 Dataset 创建后续复测任务且不将首次发布后快照误标为基线
### Requirement: AI-guided content planning minimizes manual configuration
The system SHALL derive a briefing context from the selected diagnosis, immutable Query scope, approved evidence pack, competitor context, market pack and channel rules. Before content planning, the operator SHALL only be required to choose a channel, content format and writing profile unless they intentionally open advanced controls. Evidence scope, prohibited claims, CTA, internal-linking guidance and acceptance criteria SHALL be visible and editable in a review surface rather than required as unstructured first-step input.

#### Scenario: Operator starts from a Query Gap
- **WHEN** an operator selects a content opportunity backed by a completed Diagnosis
- **THEN** the system SHALL prefill the controlled briefing context from the associated assessment, evidence and market records
- **AND THEN** the page SHALL explain what the system will send to the configured model and which facts remain constrained by approved evidence

### Requirement: Content AI invocations retain a visible prompt and writing-profile contract
The system SHALL provide reusable content prompt/writing profiles containing a system instruction, channel adaptation, style/tone, required output structure and safety boundary. Generating a plan or draft with AI SHALL require an executable, verified content-capable model connection and SHALL persist the provider/model identity, profile identity/version, rendered prompt input and generation time. A deterministic template fallback, if offered, SHALL be an explicit user choice and SHALL state that no LLM was called.

#### Scenario: Operator generates a channel draft with a verified model
- **WHEN** an operator chooses a verified content model and writing profile then requests a draft
- **THEN** the system SHALL invoke that model using the evidence-bound briefing context and selected profile
- **AND THEN** the interface SHALL show the model, profile/version, invocation result and review-required state without representing the output as a verified fact or published content

#### Scenario: No executable content model is configured
- **WHEN** no verified content-capable model connection is available
- **THEN** the AI generation action SHALL be disabled with a clear path to configuration
- **AND THEN** the system SHALL not silently substitute a deterministic template or claim that AI generation occurred

### Requirement: Content delivery is manual-export only in the current release
The Content Studio SHALL provide reviewer-approved draft export and copy actions for manual channel upload. It SHALL not require publication URL, publication proof or a scheduled retest as part of the active creation workflow in this release. Any historical publication/retest records remain available through retained APIs but SHALL not be presented as a completed delivery or evidence of GEO impact.

#### Scenario: Reviewer approves a draft for manual upload
- **WHEN** a reviewer approves a compliant draft
- **THEN** the operator SHALL be able to copy or download the draft with its channel and evidence metadata
- **AND THEN** the interface SHALL state that external upload and later measurement are manual, separate actions
