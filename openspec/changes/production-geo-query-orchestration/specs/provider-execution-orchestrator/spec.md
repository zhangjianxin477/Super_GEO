# Spec Delta

## Purpose

为 GEO Harness 提供 Browser Agent 优先的真实平台采集能力。客户在自己的受控浏览器配置文件中登录并显式启动批次，系统通过平台浏览器适配器执行已批准 Query、保留真实页面可见的回答与引用证据，并在代理不可用时使用受控人工导入兜底。官方 API、企业网关和 MCP 输出可以作为补充研究数据，但不得作为正式网页 GEO 基线。

## ADDED Requirements

### Requirement: Formal GEO baselines use customer-authorized Browser Agents
系统 SHALL 仅允许由客户工作区授权、已登记且就绪的 Browser Agent 完成正式真实平台 GEO 基线。Agent SHALL 在客户本地或客户受控环境中运行，并由用户在已登录的真实浏览器配置文件内显式启动；服务端不得接收、保存或返回浏览器密码、Cookie、完整浏览器 Profile 或未关联本次任务的浏览内容。

#### Scenario: An administrator registers a Browser Agent
- **WHEN** 工作区管理员创建一次性设备登记请求，客户侧 Agent 使用该请求完成配对
- **THEN** 系统创建绑定到该工作区的设备身份、能力快照和可撤销认证引用
- **AND THEN** UI 展示 Agent 在线状态、支持的平台适配器、最后心跳和需要人工处理的原因

#### Scenario: No ready Browser Agent is available
- **WHEN** 操作者尝试创建一个正式网页基线批次，但所选平台没有对应的已就绪 Browser Agent
- **THEN** 系统将该平台标记为等待代理、等待登录或仅可人工导入
- **AND THEN** 系统不得以 Provider API、企业网关或 MCP 的结果替代该网页基线

### Requirement: A SaaS-started batch authorizes one local browser launch only
系统 SHALL 允许具有工作区执行权限的操作者在测试批次页面，对已就绪、已登记的 Browser Agent 明确发起一次「启动本地自动采集」。服务端 SHALL 创建绑定 `workspace + agent + test run + platform` 的、短时有效且单次使用的启动请求，并记录请求人、确认时间、状态流转、失败原因和取消事件。启动请求不得包含或要求密码、Cookie、完整浏览器 Profile、验证码或其他登录秘密。

#### Scenario: An operator starts a Doubao batch from the GEO system
- **WHEN** 操作者选择在线且支持 `doubao-web` 的 Agent，并在系统内确认开始某个待执行的豆包测试批次
- **THEN** 系统创建仅属于该 Agent、该批次和豆包平台的有效启动请求
- **AND THEN** 本地 Agent 在客户预先配置且已登录的可见浏览器 Profile 中打开或聚焦豆包页面，并将阶段更新为启动浏览器、等待登录或运行中
- **AND THEN** 已安装扩展自动接收该一次性授权并执行当前批次的下一条 Query，无需用户再点击扩展按钮

#### Scenario: Start authorization expires or is cancelled
- **WHEN** 启动请求到期、被操作者取消，或与当前运行/平台不匹配
- **THEN** 本地 Agent 和扩展不得启动或继续该请求对应的浏览器自动化
- **AND THEN** 系统保留审计记录并在批次页面显示可重试的原因

#### Scenario: Login or verification requires attention
- **WHEN** 本地浏览器打开后发现登录失效、用户同意页面、验证码、反自动化提示或不可识别的页面状态
- **THEN** Agent 将启动请求和关联任务更新为 `waiting-login` 或 `needs-human`
- **AND THEN** 系统提示客户在本地可见浏览器中自行处理
- **AND THEN** Agent、扩展和服务端不得尝试绕过该限制
#### Scenario: The newest explicit start controls the device queue
- **WHEN** 同一 Browser Agent 已有未完成的其他测试批次，操作者又在系统内明确启动新的测试批次
- **THEN** 系统撤销旧批次的有效启动授权、将未完成的旧任务安全归还原队列，并将该 Agent 的活动批次切换到新批次
- **AND THEN** Agent 仅领取与当前有效启动授权相同的 `testRunId + platform` 任务，旧批次的迟到回传不得写入当前批次

### Requirement: Browser execution is explicit, visible and bounded
系统 SHALL 将每个正式运行单元定义为固定 Query Dataset 版本中的 Query、平台、市场/语言、重复次数和 Browser Agent 配置组合。每个单元 SHALL 在用户显式启动的可见浏览器环境中执行；系统 SHALL 尊重平台及账号的并发、间隔、暂停、取消和重试限制。

#### Scenario: User starts a real-platform batch
- **WHEN** 用户在 Browser Agent 中确认准备好的平台登录态与计划任务数后启动批次
- **THEN** 系统按 Agent 与平台声明的并发上限调度独立 Query-Platform-Attempt 单元
- **AND THEN** UI 展示排队、运行、已捕获、待人工、已暂停、失败和重试状态

#### Scenario: Browser execution needs human attention
- **WHEN** 登录失效、需要验证码、平台页面结构不可识别或用户取消执行
- **THEN** Agent 停止该平台的自动动作并将任务标记为需要人工处理
- **AND THEN** 系统不得绕过登录、验证码、访问控制、反爬机制或平台服务条款

### Requirement: Browser adapters capture immutable visible evidence
系统 SHALL 为每个成功的 Browser Agent 采集保存不可变证据包，包括原始可见回答、页面明确显示的引用 URL、观测时间、平台与适配器版本、市场/语言、会话/搜索状态（可识别时）、采集方式和完整性标识。

#### Scenario: Doubao browser adapter captures a completed response
- **WHEN** 已登记的 `doubao-web` 适配器在新会话中确认回答已完成
- **THEN** 系统保存原始回答和页面可见引用链接，并记录 Browser Agent、适配器和尝试元数据
- **AND THEN** 后续分析可将品牌提及、推荐、竞品和链接分类标记为系统推断，而不修改原始证据

#### Scenario: Page has no visible citations
- **WHEN** 浏览器页面回答不包含可识别的引用链接
- **THEN** 系统将引用集合保存为空，并保留原始回答与采集元数据
- **AND THEN** 系统不得推测或补写为平台实际返回的链接

### Requirement: Controlled manual import remains an auditable fallback
系统 SHALL 在某个平台没有就绪 Browser Agent、Agent 报告需人工处理或操作者主动选择兜底时允许受控人工导入。人工导入 SHALL 复用同一 Query-Platform-Attempt 身份，并明确展示其采集方式、操作人、导入时间和限制。

#### Scenario: A browser task falls back to manual evidence
- **WHEN** Browser Agent 因登录失效或页面变更将任务标记为需要人工处理
- **THEN** 操作者可以在同一任务中提交人工取得的原始回答和引用链接
- **AND THEN** 报告将该观测标记为人工兜底，而非 Browser Agent 自动采集

### Requirement: Supplementary integrations cannot contaminate webpage baselines
系统 SHALL 允许官方 API、企业网关或 MCP 作为可配置的补充研究连接器，但 SHALL 明确标记其采集模式，并禁止其完成或替代正式 Browser Agent 网页基线。

#### Scenario: A user configures an API research connector
- **WHEN** 用户运行 API、企业网关或 MCP 研究任务
- **THEN** 系统保存其来源与限制，供 Query 研究或辅助分析使用
- **AND THEN** T0 基线、网页可见度和真实平台引用指标不得将该结果计入


### Requirement: Selected domestic platforms use their matching real-web adapter
The system SHALL support browser-only formal-baseline adapters for 豆包、元宝、DeepSeek、文心一言、智谱清言（GLM）和 Kimi when the paired Browser Agent declares that platform ready. The selected platform determines its user-visible homepage, matching extension adapter, task dispatch target and evidence provenance; one platform’s page or result SHALL never satisfy another platform’s task.

#### Scenario: Operator selects a ready domestic platform
- **WHEN** an operator selects one or more ready domestic platforms while creating a real-platform Test Run
- **THEN** the system creates Query × selected-platform tasks only for those selections
- **AND THEN** each Browser Agent launch opens the homepage and dispatches only the adapter matching the currently authorized platform

#### Scenario: Selected platform has no valid page adapter or login state
- **WHEN** the user selects a domestic platform that is not supported by the local Agent, is not logged in, requires verification, or whose page structure cannot be identified
- **THEN** the affected task is marked `needs-human` with the platform-specific reason and remains eligible for controlled-manual fallback
- **AND THEN** the Agent does not attempt to bypass login, verification, access controls or platform limits

#### Scenario: Mixed platform batch advances without cross-platform dispatch
- **WHEN** a Test Run includes multiple selected domestic platforms on one Browser Agent
- **THEN** the local Agent executes at most one visible task at a time and proceeds to the next task only after the current platform result is acknowledged
- **AND THEN** the extension verifies that the active tab hostname belongs to the current task platform before inserting its Query

### Requirement: Domestic adapters preserve task-bound visible evidence

系统 SHALL 为豆包、元宝、DeepSeek、通义千问、文心一言、智谱清言（GLM）和 Kimi 提供按已授权真实网页运行的 Browser Agent 适配器。每个适配器 SHALL 只把当前已提交 Query 之后、可绑定到当前 assistant message 的完整页面可见回答作为正式证据；不得将建议词、导航、快捷操作、旧会话或其他 Query 的内容标记为成功回答。

#### Scenario: DeepSeek expands a current-answer web-source drawer
- **WHEN** 当前 DeepSeek 回答显示 “N 个网页” 或等价的可见资料入口
- **THEN** Agent SHALL 仅点击当前回答内或与其直接绑定的安全入口
- **AND THEN** Agent SHALL 只读取该次点击后新显示的、页面可见的搜索结果、显示关键词和外部 URL
- **AND THEN** Agent SHALL NOT 导航到外部资料链接、推断 URL 或复用另一 Query 的资料抽屉

#### Scenario: A platform cannot prove an answer root
- **WHEN** 元宝、文心一言、通义千问或其他已支持平台的页面结构不能将可见文本绑定为当前 assistant answer
- **THEN** 系统 SHALL 将该任务标记为 `needs-human`，保存平台特定诊断
- **AND THEN** 系统 SHALL NOT 将页面短标签、提示词或快捷项提交为完整回答

#### Scenario: A selected domestic platform is not ready
- **WHEN** 操作者向现有批次追加通义千问或文心一言，而登记 Agent 尚未声明匹配适配器、页面未登录或输入框不可识别
- **THEN** 系统 SHALL 展示明确的就绪/登录/页面变更原因和下一步
- **AND THEN** 不得静默隐藏该平台或将其标记为已采集

### Requirement: Domestic adapter launch and terminal evidence delivery are task-bound

The Browser Agent SHALL open the documented customer-visible chat entry for the selected adapter. 文心一言 SHALL launch at `https://yiyan.baidu.com/`, not an ERNIE editorial or brand landing page. A domestic adapter SHALL bind a reply to the just-submitted Query using a new user anchor or an equivalent proven submission signal, select one bounded assistant turn rather than a multi-turn conversation wrapper, and deliver either a completed evidence record or a diagnosable `needs-human` result through the local relay.

#### Scenario: 文心一言 is launched for a new batch
- **WHEN** an authorized Browser Agent receives a 文心一言 start request
- **THEN** it opens the 文心一言 chat entry at `https://yiyan.baidu.com/`
- **AND THEN** a legacy ERNIE host is not used as the new-window launch target

#### Scenario: A later Qwen or GLM answer reuses page DOM
- **WHEN** a platform updates an existing DOM shell for a second Query
- **THEN** the adapter may use the changed assistant text only when it is after the current Query submission and differs from the pre-send snapshot
- **AND THEN** it SHALL NOT reuse the earlier Query’s answer or submit a full multi-turn conversation as the current answer

#### Scenario: A terminal report cannot immediately reach the local relay
- **WHEN** a completed or needs-human report cannot be delivered on its first message attempt
- **THEN** the extension SHALL queue and retry the task-bound report through its local relay
- **AND THEN** an unrecoverable delivery error SHALL be exposed with task and adapter diagnostics rather than silently leaving the task running until an unrelated watchdog expires
