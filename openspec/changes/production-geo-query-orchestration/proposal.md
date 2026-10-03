# Proposal

## Why

当前 GEO Harness 的主路径仍以“复制 Query、打开模型网页、手动粘贴回答”为中心，只能验证受控人工导入，无法满足企业客户对批量执行、可追溯结果、可审计成本与可复测性的要求。现有示例 Query 亦缺少可解释的产生依据，内容产出没有被严格约束到事实包、Query Gap 与竞品证据，难以形成可信的 GEO 交付闭环。

## What Changes

- 新增由 LLM 协助的 Query Intelligence：从品牌事实包、客户问题、目标市场、竞品和种子问题生成候选 Query，并记录来源证据、生成理由、意图、聚类、质量评分、模型/Prompt 版本与人工审批结果。
- 新增可版本化、可审核的 Query Dataset 工作流：只允许已批准版本进入正式评估；保留人工编写和导入 Query，并清楚区分其来源。
- 新增 Browser Agent 优先的真实平台执行层：客户在自己的受控浏览器配置文件中完成登录；用户在系统内对某个批次明确点击一次「启动本地自动采集」后，已登记的本地 Agent 可在客户预先批准的浏览器与 Profile 中打开或聚焦指定平台、唤醒扩展并批量执行 Query。系统保留可见回答与引用证据，并提供设备注册、平台就绪检查、启动指令、实时进度、并发/限速、暂停、重试、人工兜底和审计记录。官方 API、企业网关或 MCP 仅可作为补充研究数据或企业私有模型连接，不得伪装为真实网页 GEO 基线。
- 新增规范化证据结果：将浏览器页面中真实可见的原始回答、页面引用链接、截图/快照、浏览器/平台适配器版本、执行时间、品牌/竞品提及和结构化分析以不可变的 Run + Query + Provider + Attempt 单位保存；浏览器代理不可用时保留受控人工导入作为明确标记的 fallback。
- 改造内容工作流为证据驱动：Content Brief 和渠道草稿必须引用目标 Query Cluster、Query Gap、来源包、竞品空白、禁止主张和事实校验结果；LLM 只生成可审核草稿，不能凭空生成产品事实。
- 明确第三方边界：浏览器代理只在客户已登录、显式授权并可见的受控浏览器环境内运行；系统不得读取或上传 Cookie/密码、不得绕过登录、验证码、访问控制、反爬或平台服务条款。

## Capabilities

### New Capabilities
- `query-intelligence`: LLM 生成、校验、聚类、评分、审批和版本化的企业 GEO Query 数据集。
- `provider-execution-orchestrator`: 面向客户侧 Browser Agent、平台浏览器适配器和受控人工兜底的真实网页执行、队列与审计能力；API/网关/MCP 只能作为非基线补充连接器。
- `evidence-normalization`: 原始模型回答、引用链接、结构化提取、运行元数据和人工 fallback 的统一证据模型。
- `evidence-grounded-content-studio`: 由事实包、Query Gap 与竞品证据约束的 Content Brief 和 LLM 渠道草稿能力。

### Modified Capabilities
- None.

## Impact

- 受影响前端：`src/App.tsx`、`src/api.ts`、`src/useLiveWorkspace.ts`、`src/domain/models.ts`、`src/domain/extensions.ts`、`src/styles.css`。
- 受影响后端：`server/application.mjs`、`server/repositories/harnessRepository.mjs`、`server/domain/*`、浏览器代理设备注册/任务协议、迁移与种子数据。
- 受影响测试：前端工作流/API 客户端测试，及服务端并发、权限、审计、Dataset 版本、证据与内容证据链测试。
- 不在本变更中接入或绕过任何未授权的第三方模型网页登录态；客户登录态和 Cookie 始终留在客户浏览器本地，每个实际平台适配器均须经明确的能力、条款和页面变更评估后启用。

## 2026-09-29 Scope extension: domestic real-web adapters

The first production Browser Agent validated the `doubao-web` path. This change now expands the same visible, customer-side browser workflow to **元宝、DeepSeek、文心一言、智谱清言（GLM）和 Kimi**. An operator's selected platform must determine the launched homepage, the matching page adapter, task dispatch, evidence capture and progress shown in the product. These adapters remain browser-only formal baseline collectors; no API, MCP, password, Cookie or CAPTCHA bypass may be substituted.


## 2026-09-29 Scope extension: safe project lifecycle controls

Product-profile removal is an enterprise lifecycle operation. The product now supports an administrator-only, workspace-isolated **permanent deletion** path with exact-name confirmation. It removes the project-scoped facts, Query datasets, runs, saved answers and citation evidence through audited, transactional deletion, while leaving other workspace projects and settings untouched. The project-detail page removes the redundant empty overview tab rail; users act from the lifecycle summary and its contextual next-step controls instead.

## 2026-09-29 Scope refinement: AI-guided content creation, not a manual strategy form

The first Content Studio implementation preserved every governance field as editable input. That makes the evidence model visible, but creates an operator experience that feels like a static demo and requires users to hand-author system-derived information. The primary workflow is refined as follows:

- The system SHALL compile the existing diagnosis, immutable Query scope, approved evidence pack, competitor context, market/channel rules and prohibited-claim boundary into a **briefing context** automatically.
- The operator SHALL normally select only a target channel, content format and a reusable writing profile; advanced evidence/CTA/linking/acceptance details are disclosed in an editable review panel rather than required as a first-step form.
- An explicit, verified content-capable LLM connection SHALL generate both the proposed content plan and the channel draft when selected. The UI SHALL show the active provider/model, prompt profile/version, invocation state and generated-output boundary. A fixed template remains an explicitly labelled fallback, never an implied AI result.
- Prompt and writing profiles SHALL be first-class, versioned configuration: they define system instruction, channel adaptation, style/tone, output structure and safety constraints. The active profile and model metadata SHALL be retained with generated plans and drafts.
- The current product release SHALL stop at reviewer-approved draft export/copy for **manual external upload**. The Content Studio UI SHALL hide the publication-URL registration and scheduled-retest workflow for now. Existing publication/retest storage remains backward-compatible but is not presented as an active step; later measurement remains initiated from the separate monitoring workflow after the operator performs the publication manually.

## 2026-09-29 Scope extension: capture-complete domestic adapters

The domestic real-web adapter scope now also includes **通义千问**. The release must correct evidence quality regressions before presenting a task as completed: DeepSeek must preserve the full current assistant answer and explicitly expand the current answer's “N 个网页” source drawer to collect only visible result URLs and displayed search terms; 元宝 must not accept shortcut chips or page chrome as an answer and must fall back to `needs-human` when a full current assistant answer cannot be bound; 文心一言 must expose readiness and an actionable unavailability reason rather than being silently omitted. Each platform remains a customer-authorized, visible-browser collector and must keep Query evidence isolated by platform and task.

## 2026-09-29 Scope extension: real-page completion and table-evidence reliability

Real-page regression testing found that a platform can render an answer without the extension being able to bind and deliver it reliably, and that visually rendered tables can be lost when only plain text is stored. This change therefore hardens domestic adapters to open the correct chat surface, bind every captured answer to the just-submitted Query, preserve visible HTML/ARIA tables as Markdown in the immutable raw answer, and report terminal evidence through the local relay without silently relying on watchdog expiry.


### Query Coverage Map

The Query Research workflow also needs a coverage-first operating view. Rather than presenting a long flat list only, it will expose the current Dataset as a Query type × journey map with transparent targets, explicit gaps, and direct actions to generate or manually add the missing Query. Target calibration belongs to the Dataset version and must preserve approved/frozen versions.
