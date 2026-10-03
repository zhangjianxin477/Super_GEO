# Spec Delta

## Purpose

为企业 GEO 工作区建立可解释、可审查、可复现的 Query 研究能力，使每条进入评估的 Query 都有明确的业务意图、来源和审批历史，而不是来源不明的示例问题。

## ADDED Requirements

### Requirement: Query candidates retain generation provenance
系统 SHALL 允许操作者以品牌事实包、已授权的公开内容 URL、客户问题、目标 ICP、市场/语言、竞品、行业术语和种子问题作为输入，生成或导入 Query 候选；每个候选 SHALL 记录文本、市场、语言、Persona、意图、旅程阶段、主题、品牌关系、来源证据引用、生成理由、生成方式、模型身份、Prompt 版本、生成时间和责任主体。

#### Scenario: LLM generates a candidate set from approved inputs
- **WHEN** 操作者提交包含至少一个事实或问题来源的 Query 研究输入并请求生成候选
- **THEN** 系统返回可编辑的候选 Query 集，并为每条候选展示其来源、生成理由和生成元数据
- **AND THEN** 系统不得将候选 Query 自动标记为已批准或已进入评估

#### Scenario: Operator imports a manually authored query
- **WHEN** 操作者手动录入或导入 Query
- **THEN** 系统将生成方式标记为 `manually-authored` 或 `imported`
- **AND THEN** 系统要求操作者提供最少的市场、语言、意图和来源说明后才可进入审核

### Requirement: Candidate quality is assessed before approval
系统 SHALL 对候选 Query 执行可解释的去重、语言/市场一致性、事实支撑、敏感或虚假能力风险和主题聚类检查，并向审核人呈现每条候选的质量状态、重复簇、优先级评分和需处理原因。

#### Scenario: Candidate conflicts with approved product facts
- **WHEN** 候选 Query 隐含未经批准的产品能力或与事实包冲突
- **THEN** 系统将该候选标记为需要处理，并显示冲突的事实来源或风险说明
- **AND THEN** 该候选不得被批准进入正式 Dataset，直至被修改或明确排除

### Requirement: Approved datasets are immutable and versioned
系统 SHALL 将已批准的 Query Dataset 作为带版本号的评估输入；对已批准 Dataset 的任何内容修改 SHALL 创建新的草稿版本，并保留前一版本、审核清单、审核意见和版本关系。

#### Scenario: Reviewer approves a reviewed candidate set
- **WHEN** 有权限的审核人批准一个已完成质量检查的 Dataset 草稿
- **THEN** 系统固定该版本的 Query 内容与元数据，并允许其用于创建正式评估
- **AND THEN** 后续编辑不得改变已批准版本中的 Query

#### Scenario: Operator revises an approved dataset
- **WHEN** 操作者基于已批准 Dataset 增删或修改 Query
- **THEN** 系统创建新的草稿版本并保持原批准版本可用于历史结果复现
### Requirement: Query coverage map makes Dataset gaps actionable
系统 SHALL 在“Query 研究”内为当前项目、当前 Query Dataset 版本提供“Query 列表 / 覆盖地图 / 生成与补齐”视图。覆盖地图 SHALL 以 Query 主类型 × 用户旅程阶段呈现每个单元格的已有数量、建议目标、覆盖状态与可解释缺口；系统 SHALL 只统计当前 Dataset 中未排除的 Query，并保留每格的 Query 明细入口。

#### Scenario: Reviewer finds a coverage gap
- **WHEN** 审核人在当前 Dataset 的覆盖地图中查看一个已有数量低于建议目标的单元格
- **THEN** 系统显示该单元格的已有 Query、缺口数量和补齐建议
- **AND THEN** 审核人可以从该单元格进入生成与补齐或手动创建流程，而不离开当前项目和 Dataset

#### Scenario: Reviewer calibrates an inapplicable cell
- **WHEN** 审核人将某个主类型 × 旅程阶段的目标数量设为 0
- **THEN** 系统将该单元格标记为“不适用”，不把它列入覆盖缺口
- **AND THEN** 系统持久化该 Dataset 版本的目标设置，并在复制新版本时带入该设置

#### Scenario: Published Dataset remains immutable
- **WHEN** 已发布或已冻结 Dataset 的审核人尝试调整覆盖地图目标
- **THEN** 系统不修改历史版本
- **AND THEN** 系统提示审核人复制为新版本后再调整 Query 或覆盖目标

### Requirement: Dataset history is managed without polluting operational selectors
系统 SHALL 在当前项目上下文内提供紧凑的 Query Dataset 管理抽屉，而不是新增独立页面。抽屉 SHALL 展示每个版本的市场/locale、版本、生命周期、已批准/已排除数量、当前使用中标记、归档状态与真实平台测试关联状态；管理操作 SHALL 保持工作区与项目隔离并产生审计记录。

#### Scenario: Operator archives a Dataset version
- **WHEN** 有写入权限的操作者归档当前项目的一个 Dataset
- **THEN** 系统保留其 Query、已完成的真实平台测试、诊断与报告关联
- **AND THEN** 该 Dataset 不再出现在真实平台测试的默认选择器中
- **AND THEN** 若该版本为当前使用中版本，系统选择另一个可用的未归档版本或清除当前标记

#### Scenario: Operator restores or designates a current Dataset
- **WHEN** 操作者恢复已归档版本或将未归档版本设为当前
- **THEN** 系统保留版本内容和审计历史
- **AND THEN** 同一工作区与项目最多存在一个当前使用中的 Dataset

#### Scenario: Administrator removes an unused draft Dataset
- **WHEN** 管理员输入完整 Dataset 名称确认删除一个未发布、未冻结且从未进入真实平台测试的草稿
- **THEN** 系统永久移除该 Dataset 及其草稿 Query
- **AND THEN** 系统保留删除操作的工作区审计事件

#### Scenario: Tested or published Dataset cannot be permanently removed
- **WHEN** 操作者尝试删除已发布、已冻结、已替代或已有真实平台测试关联的 Dataset
- **THEN** 系统拒绝永久删除
- **AND THEN** 系统提示操作者使用归档或复制新版本

#### Scenario: Operational selector only presents testable Dataset versions
- **WHEN** 操作者在真实平台测试中选择 Query Dataset
- **THEN** 系统仅展示未归档、处于可测试生命周期且至少包含一条已批准 Query 的版本
- **AND THEN** 空草稿、未批准草稿和已归档版本不污染选择器

#### Scenario: Reviewer excludes an approved Query before testing
- **WHEN** 可编辑 Dataset 的审核人排除一条已批准 Query
- **THEN** 系统将其作为可恢复的软排除记录保留审计历史
- **AND THEN** 该 Query 不计入覆盖地图或后续真实平台测试任务
- **AND THEN** 已进入真实平台测试的 Query 保持不可直接修改
