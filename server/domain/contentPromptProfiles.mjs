const builtinProfiles = [
  {
    id: 'b2b-explainer-zh-v1', version: 'v2', name: 'B2B 问题解答与教育',
    description: '把真实 Query 中的买方问题讲清楚，适合官网 Blog、知识库与解决方案页。', tone: '清晰、务实、可核验',
    channelGuidance: '先直接回答目标 Query，再说明判断标准、可验证的能力、适用边界与下一步。',
    systemInstruction: '面向企业买方写作。先解释问题和判断标准，再用给定证据说明可验证的能力与边界。把真实模型回答和竞品页面看作研究输入，不能把其中的营销表述当作我方事实。避免夸张营销词和泛泛而谈。',
    outputContract: '使用 Markdown；先给直接答案，再给可审阅的大纲、正文、来源与限制；每个重要事实紧贴 [Evidence: evidence-id]。',
    channelTags: ['官网 Blog', '知识库', '解决方案页'], contentTypeTags: ['官网专题页', '行业观点 / Blog', '使用场景页'],
  },
  {
    id: 'decision-guide-zh-v1', version: 'v2', name: '选型决策指南',
    description: '面向 AI 产品负责人、知识库负责人等决策角色的中立选型内容。', tone: '中立、结构化、决策导向',
    channelGuidance: '围绕目标 Query、评估维度、适用条件与需要验证的问题组织内容，不贬损竞争对手。',
    systemInstruction: '提供中立决策框架。只能使用给定证据描述能力或边界；对竞品只写可归因、可核验的中性信息。明确区分竞品链接中的公开信息、我方事实包和待确认项。',
    outputContract: '使用 Markdown；包含直接答案、评估清单、适用边界、待确认项和来源。',
    channelTags: ['官网 Comparison Page', 'LinkedIn', '知乎'], contentTypeTags: ['中立对比页', '行业观点 / Blog'],
  },
  {
    id: 'technical-help-center-zh-v1', version: 'v2', name: '技术 Help Center / FAQ',
    description: '将目标 Query 改写成可执行、可检索、可持续维护的 FAQ 或帮助中心页面。', tone: '直接、精确、步骤化',
    channelGuidance: '开头给出简短答案，随后给出步骤、限制、相关问题与证据链接。',
    systemInstruction: '像资深技术文档作者一样写作。所有步骤与结论必须来自提供的事实包；真实模型回答只能帮助识别用户提问方式和常见困惑，证据不足时明确标记为待确认。',
    outputContract: '使用 Markdown；包含简答、步骤、限制、相关问题与来源。',
    channelTags: ['Help Center', '官网 Blog', '公众号'], contentTypeTags: ['FAQ / Help Center', '官网专题页'],
  },
  {
    id: 'comparison-neutral-zh-v1', version: 'v2', name: '中立对比说明',
    description: '用于 Comparison Page，强调公开可证实的能力边界和选择建议。', tone: '审慎、透明、买方视角',
    channelGuidance: '按公开评估维度组织内容，不写排名、贬损、无法核验的替代方案结论。',
    systemInstruction: '以买方评估为中心，透明地区分事实、假设和待确认项。不得给出绝对推荐或任何效果承诺。仅引用经过选择的竞品来源；不要从链接标题推断未验证的能力。',
    outputContract: '使用 Markdown；包含比较维度、事实边界、适配建议与来源。',
    channelTags: ['官网 Comparison Page', 'Medium', 'LinkedIn'], contentTypeTags: ['中立对比页', '选型决策指南'],
  },
]

export const contentPromptProfiles = Object.freeze(builtinProfiles.map((profile) => Object.freeze({ ...profile, source: 'builtin', editable: false, status: 'active' })))

export function toContentPromptProfileSummary(profile) {
  const { systemInstruction, outputContract, channelGuidance, ...summary } = profile
  return { ...summary, source: profile.source ?? 'workspace', editable: profile.editable ?? true }
}

export function profileSnapshot(profile) {
  return {
    id: profile.id, version: profile.version, name: profile.name, description: profile.description,
    tone: profile.tone, channelGuidance: profile.channelGuidance, systemInstruction: profile.systemInstruction,
    outputContract: profile.outputContract, channelTags: profile.channelTags ?? [], contentTypeTags: profile.contentTypeTags ?? [],
    source: profile.source ?? 'workspace', editable: false, status: profile.status ?? 'active',
  }
}

export function listContentPromptProfiles() { return contentPromptProfiles.map(toContentPromptProfileSummary) }
export function getContentPromptProfile(id) { return contentPromptProfiles.find((profile) => profile.id === id) ?? null }

const profileTemplateKey = (prefix, profile) => profile.source === 'builtin' ? `${prefix}-${profile.id}` : `${prefix}-${profile.id}-v${profile.version}`

const evidenceRules = '仅把已批准事实包作为我方产品事实。真实模型回答只用于识别 Query、用户语言和可观察的回答缺口；竞品链接或页面分析只用于可归因的公开对比。缺少来源时明确写“待确认”，不得补写。'

export function renderContentPlanPrompt({ profile, brief, title }) {
  return {
    templateVersion: profileTemplateKey('content-plan', profile) + '-task-v2',
    profile: profileSnapshot(profile),
    system: `${profile.systemInstruction}\n\n渠道写作策略：${profile.channelGuidance}\n输出结构与验收：${profile.outputContract}\n\n${evidenceRules}\n\n你是企业级 GEO 内容策略助手。先从 contentTask.primaryQuery、读者、目标、漏斗阶段、渠道与 CTA 理解任务。基于输入给出 3 个可区分的内容角度；每个角度说明回答什么 Query、覆盖何种竞品/回答缺口、依赖哪些证据及还缺什么事实。然后推荐一个角度，并给出可审核的大纲。不要虚构产品能力、客户案例、指标、外链、竞品结论、AI 引用、排名或业务结果；不承诺曝光、引用、推荐、流量或转化。`,
    input: { requestedTitle: title, contentBrief: brief },
    expectedOutput: 'Three evidence-grounded content angles, a recommended angle, an outline, evidence-to-section mapping, gaps requiring SME confirmation, and a no-guarantee measurement boundary.',
  }
}

export function renderContentDraftPrompt({ profile, brief, title, logicalKey }) {
  return {
    templateVersion: profileTemplateKey('content-draft', profile) + '-task-v2',
    profile: profileSnapshot(profile),
    system: `${profile.systemInstruction}\n\n渠道写作策略：${profile.channelGuidance}\n输出结构与验收：${profile.outputContract}\n\n${evidenceRules}\n\n你是企业级 GEO 内容写作助手。按 contentTask 中的目标 Query、读者、目标、渠道、形式和 CTA 写作。开头直接回答 primaryQuery，再使用批准事实和已选来源展开。保留边界、待确认项和来源。不要暗示内容一定被任何 AI 模型引用、推荐或带来业务结果。`,
    input: { requestedTitle: title, logicalKey, contentBrief: brief },
    expectedOutput: 'A channel-ready Markdown draft with a direct Query answer, source-aware sections, explicit limitations, and no unsupported claims.',
  }
}
