# Spec Delta

## Purpose

把自动执行与受控人工导入的模型回答统一保存为可追溯证据，既支持引用率和曝光率分析，也保证客户可以回看原始回答、引用链接、采集时间和结构化抽取依据。

## ADDED Requirements

### Requirement: Completed observations preserve raw and structured evidence
系统 SHALL 为每个完成的 Run + Query + Provider + Model 执行单元保存不可变的原始回答工件、采集时间、Provider/模型身份、请求关联标识（如可用）、引用链接列表、结果来源方式和结构化分析结果；结构化分析必须可追溯到原始工件或人工提供的来源引用。

#### Scenario: Authorized provider returns an answer with citations
- **WHEN** 自动执行单元成功返回回答及可识别引用
- **THEN** 系统保存原始回答与标准化引用链接，并将其关联至对应 Run、Query、Provider 和模型快照
- **AND THEN** 后续指标计算可使用该证据但不得覆盖原始回答

#### Scenario: Provider response contains no citations
- **WHEN** 已完成回答不包含可识别的引用链接
- **THEN** 系统将引用集合记录为空并保留原始回答
- **AND THEN** 系统不得伪造、补写或推断为该 Provider 实际返回的引用链接

### Requirement: Normalized analysis distinguishes observation from inference
系统 SHALL 将品牌提及、推荐、位置、竞品提及、竞品推荐、主张和链接归类等分析标记为结构化抽取或人工审核结论，并保存分析方法、版本、置信度和证据范围。

#### Scenario: Analysis extracts a brand mention
- **WHEN** 规则或 LLM 分析在原始回答中识别到品牌名称
- **THEN** 系统保存提及结论、使用的方法和原文证据范围
- **AND THEN** 操作者可以区分该结论与 Provider 原始回答内容

### Requirement: Manual imports are retained as a controlled fallback
系统 SHALL 允许在授权自动集成不可用时受控导入人工获得的回答、回答来源链接和引用链接；人工导入 SHALL 标注导入人、导入时间、来源平台与验证状态，且不得伪装成自动执行结果。

#### Scenario: Operator imports an answer for an unsupported provider
- **WHEN** 操作者为待人工的 Query-Provider 单元提交人工导入回答
- **THEN** 系统将该记录标记为人工导入并保留操作者与来源信息
- **AND THEN** 该记录可参与与同类证据一致的覆盖率分析，同时在报告中披露其采集方式

### Requirement: Evidence is isolated by workspace and protected from silent mutation
系统 SHALL 仅向拥有相应工作区权限的主体展示证据，并禁止用后续 Run 或重复导入静默替换已关联到历史报告的原始证据。

#### Scenario: Follow-up run completes for a previously measured query
- **WHEN** 同一 Query 在后续 Run 中产生新回答
- **THEN** 系统将其保存为新的观测证据并保留原 Run 的证据不变
- **AND THEN** 基线和复测比较能够分别引用两个时间点的结果

### Requirement: Historical platform mention trends preserve comparability boundaries
系统 SHALL 使用历史 Run 中已审核、且保留非空原始回答的真实证据，按日、周或月计算每个 AI 平台的品牌提及率。默认趋势 SHALL 仅包含与当前 T0 使用相同 Query 集、市场和语言的批次；不同口径批次必须明确排除，不能被混入同一增长曲线。

#### Scenario: Operator changes the trend granularity
- **WHEN** 操作者在可见度与引用基线中选择日、周或月
- **THEN** 系统按所选时间桶及平台汇总品牌提及数 / 已审核有效回答数，并展示对应提及率
- **AND THEN** 没有已审核真实证据的时间桶保持为空档，不得显示为 0% 或用模拟数据补点

#### Scenario: Historical run is not comparable to the selected baseline
- **WHEN** 历史 Run 使用了不同的 Query 集、市场或语言
- **THEN** 系统不将其计入当前 T0 的平台趋势
- **AND THEN** 界面说明被排除的批次数量和比较口径

#### Scenario: Multiple answers are reviewed in one platform-period bucket
- **WHEN** 同一平台在一个时间桶内有多条可比较的已审核真实回答
- **THEN** 系统以该桶内的品牌提及数除以已审核有效回答数计算提及率
- **AND THEN** 操作者可以查看该点的分子、分母、平台与时间信息

### Requirement: Visibility inspection differentiates citation coverage and collection state
系统 SHALL 在与当前 T0 使用相同 Query 集、市场和语言的可比较历史批次中，按日、周或月分别展示各 AI 平台的自有域名引用率。自有链接引用率的分母 SHALL 为已审核且原始回答非空的真实证据，分子 SHALL 为正文引用集合中存在客户自有域名的回答；空引用集合只能计为已审核回答的 0 次自有引用，不得补写或推断链接。

系统 SHALL 进一步在当前 T0 中提供 Query × 平台矩阵，并把“提及 + 自有链接”“仅品牌提及”“已审核但未提及”“待审核”“采集失败”“待采集/不适用”显示为不同的可访问状态，不能将待审核、失败、未采集或不适用静默折算为 0% 或“未提及”。矩阵 SHALL 支持在 Query 超过 10 条时分页，并在操作者选择单元格后展示该单元的审核数量、提及率、自有链接引用率与状态说明。

#### Scenario: Operator compares owned-link citation coverage by platform
- **WHEN** 操作者在可见度与引用基线中查看自有链接引用趋势
- **THEN** 系统按所选时间桶及平台显示“含自有域名引用的已审核有效回答数 / 已审核有效回答数”
- **AND THEN** 外部链接或空引用集合不会被误标为自有链接引用
- **AND THEN** 没有已审核真实证据的时间桶保持为空档

#### Scenario: Current baseline includes incomplete Query-platform collection
- **WHEN** 某个核心 Query 在一个平台仍待审核、失败、未采集或被跳过
- **THEN** 矩阵展示相应的非绩效状态和解释，而非显示为“未提及”
- **AND THEN** 操作者可以选择该单元查看审核数、提及率与自有链接引用率是否为不可用

### Requirement: Market-wide platform coverage stays distinct from actual run results
系统 SHALL 在可见度与引用基线中同时展示当前市场支持的平台目录、当前批次实际纳入的平台及其真实结果。单平台行 SHALL 展示是否纳入、真实回答回传数、已审核数、已审核回答中的品牌提及数和自有链接引用数；全部平台汇总 SHALL 只汇总当前批次实际纳入的平台。对于未纳入、未回传、待复核、失败或无可审核证据的平台，系统不得显示合成的 0% 或虚构样本。

日粒度趋势 SHALL 以自然日建立时间轴刻度，并允许操作者通过日期刻度或数据点读取完整日期；只有已审核、原始回答非空的真实证据可形成趋势数据点。市场目录中的未纳入平台必须在图例中可见并被明确标记，不得被伪装为没有发生的 0% 曲线。

#### Scenario: First baseline scopes only one supported platform
- **WHEN** 中国市场的首轮批次只创建了豆包的 Query × 平台任务
- **THEN** 页面仍展示 DeepSeek、通义千问、豆包、Kimi、元宝、智谱清言（GLM）和文心一言的市场目录
- **AND THEN** 豆包行显示其真实回传、复核和引用结果，其他平台显示“未纳入当前批次”及不可用指标
- **AND THEN** 全部平台汇总只计算豆包任务，不将其他六个平台计作 0% 或失败

#### Scenario: Operator reads daily trend evidence
- **WHEN** 操作者选择“日”粒度查看品牌提及率或自有链接引用率
- **THEN** 图表为每个自然日呈现日期刻度，并在悬浮/选中数据点时展示完整日期、分子和分母
- **AND THEN** 没有真实已审核证据的日期保持为空档，未纳入平台在图例中显示为“未纳入”

### Requirement: Dashboard refresh status does not misrepresent scheduled evidence collection
系统 SHALL 区分“页面读取/轮询”与“真实平台复测”。已完成或待审核的 T0 基线页面不得因固定定时器每 5 秒进入全页加载态，也不得把本地页面轮询描述为实时平台同步。仅在存在已授权、进行中的 Browser Agent 采集批次时，页面 MAY 每 5 秒静默检查一次是否有新的证据回传；该检查不得重新遮罩或闪烁既有指标。

固定时间的复测计划 SHALL 在创建新的真实平台采集批次并得到 Browser Agent 明确启动授权后才可改变正式指标；页面读取本身不得在每天固定时间自行访问第三方 AI 平台、绕过登录或替代用户授权。

#### Scenario: Completed baseline stays stable after evidence collection finishes
- **WHEN** 当前项目没有进行中的 Browser Agent 采集任务
- **THEN** 基线页面不再以 5 秒间隔重新加载或闪烁
- **AND THEN** 页面将数据标注为在真实证据回传、复核或操作者手动刷新后更新

#### Scenario: Authorized Browser Agent batch is collecting
- **WHEN** 当前项目存在正在运行或等待执行的 Browser Agent 任务
- **THEN** 页面可以每 5 秒静默读取新回传的证据状态
- **AND THEN** 页面明确显示“采集中”而不把轮询描述为已经完成的平台复测



### Requirement: Project-scoped evidence can be permanently deleted only through a confirmed administrator action
The system SHALL allow an administrator to permanently delete a Brand Diagnostic project only after the actor enters the exact project name. The deletion SHALL be scoped to the current workspace, transactional, auditable at workspace level, and remove project-owned facts, Query datasets, test runs, saved answers and citation evidence. It SHALL not delete other workspace projects or workspace-level settings.

#### Scenario: Administrator confirms a project deletion
- **WHEN** an administrator enters the exact project name and confirms permanent deletion
- **THEN** the system deletes the scoped project and its dependent evidence records, records a workspace audit event, and returns the user to the project list or its empty state

#### Scenario: Confirmation or workspace scope does not match
- **WHEN** a caller supplies a non-matching confirmation name or a case identifier from another workspace
- **THEN** the system SHALL reject the operation and preserve all project records

### Requirement: Page-visible answer tables are preserved as Markdown evidence

The evidence normalizer SHALL retain every page-visible table inside the task-bound assistant answer as Markdown in the immutable raw-answer artifact. It SHALL support native HTML `table` elements and visible ARIA `table` / `grid` structures; cell line breaks and pipe characters are escaped without inventing unexposed values. Capture metadata SHALL record the number of detected and serialized answer tables.

#### Scenario: Qwen returns a comparison table
- **WHEN** the current Qwen assistant answer includes a visible comparison table
- **THEN** the stored raw answer includes the answer prose and a labelled Markdown table section with the visible header and rows
- **AND THEN** the observation records table-capture counts for audit

#### Scenario: A table cannot be structurally read
- **WHEN** a visible answer region contains a decorative or malformed table-like layout without readable rows and cells
- **THEN** the collector retains ordinary visible answer text and records no fabricated Markdown rows
- **AND THEN** it does not infer a table from spacing or image pixels
