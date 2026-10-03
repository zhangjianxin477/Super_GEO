import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Download, FileText, LoaderCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { getWorkspaceSession } from './BrandDiagnostics'
import {
  ApiClientError,
  createProjectContentBrief,
  createProjectContentDraft,
  createProjectContentStrategy,
  expandProjectContentQueries,
  getProjectContentDraft,
  getProjectContentOpportunities,
  listModelProviders,
  saveProjectContentDraftQuality,
  type ContentQueryExpansionRow,
  type ModelProviderConfiguration,
  type ProjectContentOpportunityResponse,
  type WorkspaceSession,
} from './api'

export type ContentStudioProps = {
  go: (screen: string) => void
  notice: (message: string) => void
  projectId?: string | null
  geoActionSeed?: unknown
  onGeoActionSeedConsumed?: () => void
}

type BriefType = 'website-page' | 'faq' | 'use-case' | 'comparison-page' | 'case-study' | 'editorial'
type Variant = 'standard' | 'concise' | 'faq'
export type ContentMode = 'brand' | 'case-study' | 'product' | 'how-to' | 'comparison' | 'faq'
type QueryRow = { id: string; text: string; category: string; intent: string; cluster: string; selected: boolean }
type QualityReport = { duplicateScore: number; hallucinationRisk: number; keywordDensity: number; readabilityScore: number; semanticRelevanceScore: number; eeatScore: number; total: number; passed: boolean; issues: string[] }
type Asset = { id: string; draftId: string; query: string; variant: Variant; mode: ContentMode; title: string; markdown: string; html: string; quality: QualityReport; createdAt: string; status: 'ready' | 'needs-rewrite'; model?: string | null }

export const CONTENT_STUDIO_TABS = [['writing', '01 Prompt 与写作'], ['quality', '02 质量初筛']] as const
export const CONTENT_STUDIO_CAPABILITIES = ['从 01 Query 研究带入已验证 Query', '按内容类型配置独立 Prompt', '先生成大纲，再生成可编辑全文', '全文可编辑，并支持 AI 局部修改', '重复、幻觉、密度、可读性与相关性初筛', '质量通过后导出 Markdown / HTML，发布由人工完成'] as const
export const CONTENT_STUDIO_BOUNDARIES = {
  task: '当前项目的 Query、产品事实和 GEO 观测数据只在本项目内使用；未核实信息必须标注“需核验”，不能当作事实写入。',
  plan: 'Prompt 可按内容任务编辑，并会真实发送给对应模型；质量初筛只负责发现风险，不是 GEO 收录或排名结果。',
  draft: '质量分是自动初筛结果，不代表已经收录或获得 GEO 效果，不能把过程状态表述为已验证的 GEO 结果。',
  export: '系统导出内容素材，不自动发布，外部发布仍由人工完成。',
  retest: '投放后使用原始不可变 Query 范围回到 GEO 监测进行复测。',
} as const

export const CONTENT_STUDIO_CONTENT_TYPES: Array<{ id: ContentMode; label: string; hint: string; briefType: BriefType }> = [
  { id: 'brand', label: '品牌介绍类', hint: '品牌 / 项目实体介绍页', briefType: 'editorial' },
  { id: 'case-study', label: '项目案例类', hint: '业务背景、方案与量化成果', briefType: 'case-study' },
  { id: 'product', label: '产品说明类', hint: '功能、场景、前提与边界', briefType: 'website-page' },
  { id: 'how-to', label: '行业干货类', hint: 'How-to / 原理科普 / 最佳实践', briefType: 'use-case' },
  { id: 'comparison', label: '评测对比类', hint: '多产品客观对比与选型', briefType: 'comparison-page' },
  { id: 'faq', label: 'FAQ 问答类', hint: '基础、部署、计费与边界问题', briefType: 'faq' },
]

export const COMMON_GEO_PROMPT = `写作目标：生成Generative Engine Optimization(GEO)内容，作为大模型知识源，优先被AI摘要、问答、对比类回答引用。
写作原则（强制遵守）：
1. E-E-A-T要求：内容保持客观事实风格，减少营销赞美词，必须同时写明能力和局限性，不夸大效果。
2. 信息抽取友好：
   - 开篇必须放TL;DR摘要（1~2句话，放在最顶部，独立段落）
   - 使用Markdown H2/H3标题层级，不要超大段落，单段尽量≤3行
   - 关键数据、定义、结论独立成句，不要埋在长句中间
   - 优先使用表格、无序列表承载结构化信息
   - 减少代词，实体名称完整，不要只用“该产品/它”，每次关键位置写出全名
3. 独立可抽取：每个小节可以单独被大模型截取，不强制依赖全文上下文才能理解。
4. 禁止：华丽修辞、口号式文案、情绪化形容词、模糊表述（如业内顶尖、最强、革命性）。
5. 输出格式：标准Markdown。
6. 文末固定增加2~4条FAQ，Q&A成对，问题简短，答案直接。`

export const WRITING_PROMPT_DEFAULTS: Record<ContentMode, string> = {
  brand: `${COMMON_GEO_PROMPT}\n\n文章类型：品牌介绍类\n主体名称：{名称}\n一句话定位：{一句话描述它是什么，为谁解决什么问题}\n所属领域：{所属领域}\n目标受众：{目标受众}\n核心实体信息清单（必须全部写入正文）：\n- 成立/诞生背景\n- 核心团队/研发主体（如有）\n- 核心业务与能力边界\n- 目标适用人群\n- 核心差异化特点\n- 客观局限性：不适合哪些场景、当前版本短板\n\n输出章节固定H2结构，不可随意删减：\n## TL;DR\n## 项目/品牌简介\n## 核心能力与价值\n## 适用人群与典型使用场景\n## 差异化特点\n## 局限性与适用边界\n## 背景与研发主体信息\n## 常见FAQ\n\n额外约束：\n- 只陈述事实，避免“行业领先”“顶级”这类虚夸形容词；\n- 区分“能做到”和“做不到”，边界清晰，降低大模型幻觉；\n- 所有实体名词保持全称，便于大模型做实体链接。`,
  'case-study': `${COMMON_GEO_PROMPT}\n\n文章类型：项目案例类 / 落地项目案例页\n案例名称：{案例名称}\n客户行业：{客户行业}\n客户业务背景：{客户业务背景}\n客户原始业务痛点：{客户原始业务痛点}\n项目目标：{项目目标}\n解决方案：{解决方案}\n量化指标：{列出可量化成果，如准确率提升、人力节省、耗时下降等}\n方案约束：这个方案不适用的场景\n\n输出章节固定H2结构：\n## TL;DR\n## 项目背景与业务痛点\n## 项目预期目标\n## 落地实施流程\n## 最终成果（使用表格展示量化指标）\n## 复盘：方案优势\n## 复盘：局限与适用边界\n## 常见FAQ\n\n额外约束：\n1. 量化指标优先放入表格，方便大模型直接提取数据；\n2. 不能美化、虚构成果；明确写出该案例的前提条件，不能让读者误以为这个方案万能；\n3. 写清楚：如果缺少关键条件，这个方案无法复现。`,
  product: `${COMMON_GEO_PROMPT}\n\n文章类型：产品说明类 / 产品说明GEO页面\n产品全称：{产品全称}\n一句话定位：{一句话定位}\n核心功能模块列表：{核心功能模块列表}\n目标用户：{目标用户}\n使用前置条件：{使用前置条件}\n付费/交付模式（可选）：{付费/交付模式}\n产品短板、能力边界：{产品短板、能力边界}\n\n输出章节固定H2结构：\n## TL;DR\n## 产品概述\n## 核心功能详情\n## 典型适用场景\n## 使用前提与环境要求\n## 产品优势\n## 能力限制与不适用场景\n## 定价&交付模式（无则删掉该章节）\n## 常见FAQ\n\n额外约束：\n1. 每个功能说明，同时写清楚功能可以干什么，以及它的限制；\n2. 避免模糊描述，不要使用“强大”“一站式”这类空泛营销词；\n3. 功能描述保持原子化，一条功能一段，便于抽取。`,
  'how-to': `${COMMON_GEO_PROMPT}\n\n文章类型：行业干货 How-to / 原理科普\n主题：{主题}\n目标读者：{目标读者}\n文章目标：回答“什么是XX、XX怎么做、XX的最佳实践”这类用户查询。\n\n输出章节固定H2结构：\n## TL;DR\n## 概念定义\n## 底层原理/为什么重要\n## 分步操作指南（How-to，有序列表）\n## 行业常见误区\n## 推荐最佳实践\n## 适用范围与局限性\n## 常见FAQ\n\n额外约束：\n1. 定义单独段落，优先被模型抽取；\n2. 步骤清晰有序列表，不要合并多步到同一段落；\n3. 误区部分写明错误做法以及对应的后果；\n4. 写明这套方法的前提，不适合的场景。`,
  comparison: `${COMMON_GEO_PROMPT}\n\n文章类型：评测对比类 / 多产品评测对比GEO页面\n对比对象：{对比对象A、B、C}\n对比维度列表：{对比维度列表}\n评测环境：{评测环境}\n评测目标：{评测目标}\n评测局限：本次评测的前提、数据边界，哪些场景本对比结论不生效\n\n输出章节固定H2结构：\n## TL;DR\n## 评测说明：评测环境与前提\n## 多维度对比表格（放在靠前位置）\n## 各方案优势拆解\n## 各方案短板与风险\n## 选型建议：不同场景下该如何选择\n## 评测局限性说明\n## 常见FAQ\n\n额外约束：\n1. 对比表格必须放在文章前半部分；表格字段清晰，数据客观；\n2. 不偏袒任意一方，不刻意贬低或者吹捧；\n3. 选型建议绑定场景，而不是简单判定谁最好；\n4. 必须写明评测局限，比如样本量、版本限制，防止大模型无限制泛化结论。`,
  faq: `${COMMON_GEO_PROMPT}\n\n文章类型：FAQ专题页\n主体：{产品/项目/品牌名称}\n领域：{领域}\n问题分类：基础概念、部署使用、计费、能力边界\n\n输出章节固定H2结构：\n## TL;DR\n## 基础概念类问题\n## 使用部署类问题\n## 限制与边界问题\n## 信息适用说明\n## 补充FAQ\n\n额外约束：\n1. Q独立一行，A独立一段；答案简短精炼，不要长篇叙事；\n2. 答案优先直接给出结论，再少量补充解释；\n3. 所有回答必须写明边界，不确定的信息直接说明，不编造；\n4. 不要在答案里堆砌营销话术。`,
}

const MODES = CONTENT_STUDIO_CONTENT_TYPES

const PROMPT_FIELD_HINTS: Record<ContentMode, string> = {
  brand: '补充名称、定位、所属领域、目标受众、研发主体和可核验的能力边界。',
  'case-study': '补充案例名称、客户行业、业务痛点、解决方案、量化指标和不可复现的前提。',
  product: '补充产品全称、定位、功能模块、目标用户、使用前提、交付模式和短板。',
  'how-to': '补充主题、目标读者、希望回答的实践问题，以及方法成立的前提。',
  comparison: '补充对比对象、维度、评测环境、评测目标和样本/版本等限制。',
  faq: '补充主体名称、领域，以及需要覆盖的基础概念、部署、计费和能力边界问题。',
}

const LEGACY_WRITING_PROMPT = '写作目标：满足用户搜索意图，不做硬广。根据内容类型输出对应结构：标题、Meta 描述、H1/H2、正文、FAQ；自然覆盖目标 Query，符合 EEAT，引用客观表述，优先使用项目内已核实来源。支持标准版、精简版、FAQ 版。禁止编造案例、数据、参数或无法验证的承诺；不确定的信息标注“需核验”。输出可直接导出的 Markdown。'
const storedWritingPrompt = (value: unknown, mode: ContentMode) => typeof value === 'string' && value.trim() && value.trim() !== LEGACY_WRITING_PROMPT ? value : WRITING_PROMPT_DEFAULTS[mode]

const labelOf = (value: string) => ({ 'information-seeking': '信息查询', comparison: '对比选型', solution: '解决方案', question: '疑问问题' }[value] ?? value)
const intentOf = (text: string) => /怎么|如何|教程|步骤|实现|配置/.test(text) ? '教程' : /推荐|哪个好|对比|替代|选型/.test(text) ? '产品选型' : /为什么|问题|无法|能否|是否/.test(text) ? '痛点疑问' : '知识性'
const categoryOf = (text: string) => /对比|哪个好|推荐|替代|选型/.test(text) ? 'comparison' : /如何|怎么|教程|步骤|实现|配置/.test(text) ? 'solution' : /为什么|问题|是否|能否/.test(text) ? 'question' : 'information-seeking'
const normalize = (text: string) => text.trim().replace(/[？?。！!]+$/g, '').replace(/\s+/g, ' ')
const clusterOf = (text: string) => { const words = text.replace(/[^\u4e00-\u9fffA-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean); return words.slice(0, 3).join(' ') || '未分类' }
const errorText = (error: unknown) => error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : '操作失败，请稍后重试。'
const variantLabel = (value: Variant) => ({ standard: '标准版', concise: '精简版', faq: 'FAQ 版' }[value] ?? value)
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char))
const markdownToHtml = (markdown: string) => {
  const blocks = markdown.trim().split(/\n{2,}/)
  return blocks.map((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (!lines.length) return ''
    if (lines.length >= 2 && /^\|.*\|$/.test(lines[0]) && /^\|?\s*:?-{3,}/.test(lines[1])) {
      const cells = (line: string) => line.replace(/^\||\|$/g, '').split('|').map((cell) => escapeHtml(cell.trim()))
      const header = cells(lines[0]); const body = lines.slice(2).filter((line) => /^\|.*\|$/.test(line)).map((line) => `<tr>${cells(line).map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
      return `<table><thead><tr>${header.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`
    }
    const text = escapeHtml(block.trim())
    if (text.startsWith('### ')) return `<h3>${text.slice(4)}</h3>`
    if (text.startsWith('## ')) return `<h2>${text.slice(3)}</h2>`
    if (text.startsWith('# ')) return `<h1>${text.slice(2)}</h1>`
    if (lines.every((line) => /^[-*]\s+/.test(line))) return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`
    return `<p>${text.replace(/\n/g, '<br />')}</p>`
  }).join('\n')
}
const contentWords = (text: string) => text.toLowerCase().replace(/[^\u4e00-\u9fffA-Za-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 1)
const jaccardSimilarity = (left: string, right: string) => {
  const a = new Set(contentWords(left)); const b = new Set(contentWords(right))
  if (!a.size || !b.size) return 0
  const intersection = [...a].filter((word) => b.has(word)).length
  return intersection / new Set([...a, ...b]).size
}
const scoreContent = (query: string, content: string, previous: Asset[], mode: ContentMode): QualityReport => {
  const clean = content.trim(); const normalized = clean.toLowerCase(); const queryNormalized = query.toLowerCase()
  const duplicateSimilarity = previous.length ? Math.max(...previous.map((asset) => jaccardSimilarity(clean, asset.markdown))) : 0
  const duplicateScore = Math.round(Math.max(0, 100 - duplicateSimilarity * 100))
  const unsupportedClaims = (clean.match(/\b\d+(?:\.\d+)?[%％万亿倍]|保证|一定|绝对|全球第一|业内领先|零风险|百分之百/g) ?? []).length
  const hallucinationRisk = Math.min(100, unsupportedClaims * 18 + (clean.length < (mode === 'faq' ? 80 : 220) ? 25 : 0))
  const queryMentions = queryNormalized ? (normalized.split(queryNormalized).length - 1) : 0
  const keywordDensity = Math.min(100, Math.round(queryMentions * 13 + (queryMentions > 5 ? 28 : 0)))
  const hasArticleStructure = /(^|\n)#/.test(clean) && /(^|\n)##?\s/.test(clean)
  const hasFaq = /faq|常见问题|问答|\?/.test(normalized)
  const structureOk = mode === 'faq' ? hasFaq : hasArticleStructure && clean.length >= 100
  const readabilityScore = Math.min(100, Math.max(35, 78 + (structureOk ? 12 : -8) - Math.min(25, Math.round(clean.length / 1800))))
  const semanticRelevanceScore = Math.min(100, Math.max(35, 62 + (normalized.includes(queryNormalized) ? 26 : 0) + (structureOk ? 8 : 0)))
  const eeatScore = Math.min(100, Math.max(30, 56 + (/(来源|依据|参考|证据|文档|团队|作者|需核验)/.test(clean) ? 24 : 0) - hallucinationRisk / 3))
  const issues = [
    duplicateScore < 72 ? '与已有内容相似度偏高' : '',
    hallucinationRisk > 40 ? '发现未绑定来源的数字或强断言' : '',
    keywordDensity > 75 ? '目标 Query 出现过密' : '',
    semanticRelevanceScore < 50 ? '与原始 Query 的语义相关性不足' : '',
    !structureOk ? mode === 'faq' ? 'FAQ 未形成清晰的问题—答案结构' : '内容未形成清晰的 Markdown 标题层级或长度不足' : '',
  ].filter(Boolean)
  const total = Math.round(duplicateScore * .18 + (100 - hallucinationRisk) * .2 + (100 - Math.abs(50 - keywordDensity)) * .12 + readabilityScore * .16 + semanticRelevanceScore * .18 + eeatScore * .16)
  return { duplicateScore, hallucinationRisk, keywordDensity, readabilityScore, semanticRelevanceScore, eeatScore, total, passed: total >= 70 && issues.length === 0, issues }
}
const toQueryRow = (item: ContentQueryExpansionRow | { id?: string; question: string; category?: string; intent?: string; cluster?: string }, index: number): QueryRow => {
  const text = normalize('query' in item ? item.query : item.question)
  return { id: 'id' in item && item.id ? item.id : `query-${index}-${text.slice(0, 8)}`, text, category: item.category ?? categoryOf(text), intent: item.intent ?? intentOf(text), cluster: item.cluster ?? clusterOf(text), selected: true }
}


type StudioStep = 'writing' | 'quality'

const STUDIO_STEPS: Array<{ id: StudioStep; number: string; label: string; hint: string }> = [
  { id: 'writing', number: '01', label: 'Prompt 与写作', hint: '输入 → 大纲 → 全文' },
  { id: 'quality', number: '02', label: '质量初筛', hint: '风险检测 → 可导出' },
]

const contentTypeLabel = (mode: ContentMode) => MODES.find((item) => item.id === mode)?.label ?? '文章'
const writingStageLabel = (stage: 'input' | 'outline' | 'full') => ({ input: '准备输入', outline: '大纲待确认', full: '全文可编辑' }[stage])

export function ContentStudio({ go, notice, projectId = null }: ContentStudioProps) {
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [opportunityData, setOpportunityData] = useState<ProjectContentOpportunityResponse | null>(null)
  const [providers, setProviders] = useState<ModelProviderConfiguration[]>([])
  const [queryRows, setQueryRows] = useState<QueryRow[]>([])
  const [selectedQueryId, setSelectedQueryId] = useState('')
  const [mode, setMode] = useState<ContentMode>('brand')
  const [providerId, setProviderId] = useState('')
  const [writingContext, setWritingContext] = useState('')
  const [outline, setOutline] = useState('')
  const [articleMarkdown, setArticleMarkdown] = useState('')
  const [revisionInstruction, setRevisionInstruction] = useState('')
  const [writingStage, setWritingStage] = useState<'input' | 'outline' | 'full'>('input')
  const [writingPrompts, setWritingPrompts] = useState<Record<ContentMode, string>>(() => {
    if (typeof window === 'undefined') return { ...WRITING_PROMPT_DEFAULTS }
    try {
      const stored = JSON.parse(window.localStorage.getItem('geo-writing-prompts') ?? '{}') as Partial<Record<ContentMode, string>>
      return Object.fromEntries(Object.keys(WRITING_PROMPT_DEFAULTS).map((key) => [key, storedWritingPrompt(stored[key as ContentMode], key as ContentMode)])) as Record<ContentMode, string>
    } catch { return { ...WRITING_PROMPT_DEFAULTS } }
  })
  const [assets, setAssets] = useState<Asset[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' })
  const [activeStep, setActiveStep] = useState<StudioStep>('writing')

  const selectedOpportunity = opportunityData?.opportunities[0] ?? null
  const executableProviders = providers.filter((provider) => provider.executable && provider.test?.status === 'verified')
  const writingPrompt = writingPrompts[mode] || WRITING_PROMPT_DEFAULTS[mode]
  const selectedQuery = queryRows.find((row) => row.id === selectedQueryId) ?? queryRows[0] ?? null
  const passed = assets.filter((asset) => asset.quality.passed).length

  const load = useCallback(async () => {
    if (!projectId) { setState('ready'); return }
    try {
      setState('loading'); setError('')
      const current = await getWorkspaceSession(); setSession(current)
      const [opportunity, providerResponse] = await Promise.all([
        getProjectContentOpportunities(current, projectId),
        listModelProviders(current),
      ])
      setOpportunityData(opportunity); setProviders(providerResponse.providers)
      setProviderId((currentId) => currentId || providerResponse.providers.find((item) => item.executable && item.test?.status === 'verified')?.id || '')
      setState('ready')
    } catch (cause) { setError(errorText(cause)); setState('error') }
  }, [projectId])

  useEffect(() => { setOpportunityData(null); setQueryRows([]); setSelectedQueryId(''); setAssets([]); setOutline(''); setArticleMarkdown(''); setWritingContext(''); setWritingStage('input'); setActiveStep('writing'); setError('') }, [projectId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!selectedOpportunity || queryRows.length) return
    const rows = selectedOpportunity.queryScope.map((item, index) => toQueryRow({ id: item.id, question: item.question, intent: item.intent, category: categoryOf(item.question), cluster: clusterOf(item.question) }, index))
    setQueryRows(rows); setSelectedQueryId(rows[0]?.id ?? '')
  }, [selectedOpportunity, queryRows.length])
  useEffect(() => {
    if (!projectId || typeof window === 'undefined') return
    try {
      const saved = JSON.parse(window.localStorage.getItem(`geo-content-editor-${projectId}`) ?? '{}') as { queryId?: string; context?: string; outline?: string; markdown?: string; stage?: 'input' | 'outline' | 'full' }
      if (saved.queryId) setSelectedQueryId(saved.queryId)
      if (saved.context) setWritingContext(saved.context)
      if (saved.outline) setOutline(saved.outline)
      if (saved.markdown) setArticleMarkdown(saved.markdown)
      if (saved.stage) setWritingStage(saved.stage)
    } catch { /* ignore malformed local workspace snapshot */ }
  }, [projectId])

  const saveWritingWorkspace = (next: Partial<{ queryId: string; context: string; outline: string; markdown: string; stage: 'input' | 'outline' | 'full' }> = {}) => {
    if (typeof window === 'undefined' || !projectId) return
    const snapshot = { queryId: selectedQueryId, context: writingContext, outline, markdown: articleMarkdown, stage: writingStage, ...next }
    window.localStorage.setItem(`geo-content-editor-${projectId}`, JSON.stringify(snapshot))
  }
  const saveWritingPrompt = () => { if (typeof window !== 'undefined') window.localStorage.setItem('geo-writing-prompts', JSON.stringify(writingPrompts)); notice(`${contentTypeLabel(mode)} Prompt 已保存，会随生成请求发送给模型。`) }

  const createBriefForWriting = async (query: QueryRow) => {
    if (!session || !projectId || !selectedOpportunity) throw new Error('当前项目没有可用的 GEO 内容机会。')
    const key = `content-${Date.now()}`
    const strategyResponse = await createProjectContentStrategy(session, projectId, { opportunityId: selectedOpportunity.id, logicalKey: key, title: `${query.text} · 内容任务`, objective: '围绕搜索意图生产可验证、可投放、可复测的内容资产。', channels: ['content-studio'], autoApprove: true })
    return createProjectContentBrief(session, projectId, { strategyId: strategyResponse.strategy.id, logicalKey: `${key}-brief`, channel: 'content-studio', contentType: MODES.find((item) => item.id === mode)?.briefType ?? 'editorial', title: `${query.text} · ${contentTypeLabel(mode)}`, autoApprove: true })
  }
  const runDraft = async (prompt: string, label: string) => {
    if (!session || !projectId || !selectedQuery || !providerId) throw new Error('请先选择 Query，并选择已验证的写作模型。')
    setBusy('generate'); setError(''); setProgress({ done: 0, total: 1, label })
    try {
      const brief = await createBriefForWriting(selectedQuery)
      const response = await createProjectContentDraft(session, projectId, brief.brief.id, { logicalKey: `content-${Date.now()}-${writingStage}`, title: `${selectedQuery.text} · ${contentTypeLabel(mode)}`, modelProviderConfigurationId: providerId, promptOverride: prompt })
      const detail = await getProjectContentDraft(session, projectId, response.draft.id)
      const markdown = String(detail.draft.draft?.contentMarkdown ?? '')
      if (!markdown.trim()) throw new Error('模型没有返回内容，请检查 Prompt 或模型连接。')
      return { response, detail, markdown }
    } finally { setBusy(null) }
  }
  const generateOutline = async () => {
    if (!selectedQuery) { setError('没有可用的目标 Query，请先在 01 Query 研究中完成 Query 测试。'); return }
    const prompt = `${writingPrompt}

当前阶段：只生成文章大纲，不要生成正文。
目标 Query：${selectedQuery.text}
用户补充输入：${writingContext || '无'}
请输出可编辑的 Markdown 大纲：文章目标、目标读者、核心结论、H1/H2/H3 结构、每节要回答的问题、需要引用或核验的事实。`
    try { const result = await runDraft(prompt, '正在生成大纲…'); setOutline(result.markdown); setWritingStage('outline'); saveWritingWorkspace({ outline: result.markdown, stage: 'outline' }); notice('大纲已生成，可以人工修改后确认。') } catch (cause) { setError(errorText(cause)); notice('大纲生成失败，请检查模型连接。') }
  }
  const updateAsset = (draftId: string, markdown: string, title: string, model?: string | null) => {
    const quality = scoreContent(selectedQuery?.text ?? '', markdown, assets.filter((asset) => asset.draftId !== draftId), mode)
    const asset: Asset = { id: `${draftId}-standard`, draftId, query: selectedQuery?.text ?? '', variant: 'standard', mode, title, markdown, html: markdownToHtml(markdown), quality, createdAt: new Date().toISOString(), status: quality.passed ? 'ready' : 'needs-rewrite', model }
    setAssets((current) => [asset, ...current.filter((item) => item.draftId !== draftId)])
    setArticleMarkdown(markdown); setWritingStage('full'); saveWritingWorkspace({ markdown, stage: 'full' }); return asset
  }
  const generateFullArticle = async () => {
    if (!outline.trim()) { setError('请先生成或填写大纲，再确认生成全文。'); return }
    const prompt = `${writingPrompt}

当前阶段：根据已确认的大纲生成完整内容。
目标 Query：${selectedQuery?.text ?? ''}
用户补充输入：${writingContext || '无'}
已确认大纲（允许保留结构但必须补全正文）：
${outline}

输出可直接编辑和导出的 Markdown，不要解释生成过程。`
    try { const result = await runDraft(prompt, '正在根据确认的大纲生成全文…'); const asset = updateAsset(result.response.draft.id, result.markdown, result.response.draft.title, result.detail.aiInvocation?.modelIdentity); try { await saveProjectContentDraftQuality(session!, projectId!, result.response.draft.id, asset.quality) } catch { /* local quality remains usable */ } setWritingStage('full'); notice('全文已生成，可以直接编辑或进行局部修改。') } catch (cause) { setError(errorText(cause)); notice('全文生成失败，请检查模型连接。') }
  }
  const saveManualContent = async () => {
    if (!articleMarkdown.trim()) { setError('当前还没有可保存的全文。'); return }
    const current = assets[0]
    if (current && session && projectId) { const asset = updateAsset(current.draftId, articleMarkdown, current.title, current.model); try { await saveProjectContentDraftQuality(session, projectId, current.draftId, asset.quality) } catch { /* local quality remains usable */ } }
    else { saveWritingWorkspace({ markdown: articleMarkdown, stage: 'full' }) }
    notice('手动修改已保存到当前项目工作区。')
  }
  const reviseArticle = async () => {
    if (!articleMarkdown.trim() || !revisionInstruction.trim()) { setError('请先填写局部修改要求。'); return }
    const prompt = `${writingPrompt}

当前阶段：局部修改已有内容。只按修改要求调整相关段落，保留未涉及内容、标题层级、事实边界和 Markdown 结构；不要重写成另一篇文章。
目标 Query：${selectedQuery?.text ?? ''}
当前全文：
${articleMarkdown}

局部修改要求：${revisionInstruction}`
    try { const result = await runDraft(prompt, '正在按修改要求更新局部内容…'); const current = assets[0]; const asset = updateAsset(result.response.draft.id, result.markdown, current?.title ?? result.response.draft.title, result.detail.aiInvocation?.modelIdentity); try { await saveProjectContentDraftQuality(session!, projectId!, result.response.draft.id, asset.quality) } catch { /* local quality remains usable */ } setRevisionInstruction(''); notice('局部修改已完成，可以继续人工调整。') } catch (cause) { setError(errorText(cause)); notice('局部修改失败，请检查模型连接。') }
  }

  const downloadAsset = (asset: Asset, format: 'md' | 'html') => {
    const body = format === 'md' ? asset.markdown : `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(asset.title)}</title></head><body>${asset.html}</body></html>`
    const blob = new Blob([body], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/html;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${asset.title.replace(/[^\u4e00-\u9fffA-Za-z0-9-]+/g, '-')}.${format}`; anchor.click(); URL.revokeObjectURL(url)
  }

  if (!projectId) return <section className="pcw-empty-state"><div className="pcw-empty-icon"><FileText size={22} /></div><h2>先选择一个 GEO 项目</h2><p>内容策略、事实、Query、真实平台测试与发布记录都必须归属于同一项目。</p><button className="primary" onClick={() => go('diagnostics')}>去选择项目 <ArrowRight size={15} /></button></section>
  if (state === 'loading') return <section className="pcw-loading"><LoaderCircle className="spin" size={22} />正在加载内容工作台…</section>
  if (state === 'error') return <section className="pcw-error"><AlertCircle size={20} /><div><strong>内容工作台加载失败</strong><p>{error}</p></div><button className="secondary compact" onClick={() => void load()}><RefreshCw size={14} />重试</button></section>
  if (!selectedOpportunity || !queryRows.length) return <section className="pcw-empty-state pcw-content-prerequisite"><div className="pcw-empty-icon"><ShieldCheck size={22} /></div><h2>还没有可用的 GEO Query</h2><p>先在 01 Query 研究中完成 Query 整理和真实平台测试，系统会把当前项目的目标 Query 带入写作。</p><button className="primary" onClick={() => go('query')}>去 Query 研究 <ArrowRight size={15} /></button></section>

  const canOpenStep = (step: StudioStep) => step === 'writing' || (step === 'quality' && assets.length > 0)
  const navStep = (step: StudioStep) => { if (canOpenStep(step)) { setError(''); setActiveStep(step) } }

  return <section className="pcw-new pcw-content-workbench" aria-label="内容策略与智能写作">
    <header className="pcw-new-header pcw-simple-header">
      <div><span className="pcw-kicker"><Sparkles size={13} />05 内容策略与智能写作</span><h2>从 Query 到可复测内容</h2><p>从 01 Query 研究带入已验证 Query，先生成大纲，再生成可编辑全文；没有审批节点，配置好就运行。</p></div>
      <div className="pcw-new-header-actions"><span className="pcw-project-chip"><ShieldCheck size={14} />{opportunityData?.project.name ?? projectId}</span><button className="secondary compact" onClick={() => void load()}><RefreshCw size={14} />刷新</button></div>
    </header>
    <nav className="pcw-stepbar pcw-simple-stepbar pcw-two-stepbar" aria-label="内容生产流程">
      {STUDIO_STEPS.map((step, index) => <button type="button" key={step.id} className={`${activeStep === step.id ? 'active' : ''} ${canOpenStep(step.id) ? '' : 'locked'}`} onClick={() => navStep(step.id)} disabled={!canOpenStep(step.id)}><b>{step.number}</b><span>{step.label}</span><small>{step.hint}</small></button>)}
    </nav>
    {error && <div className="pcw-inline-error"><AlertCircle size={16} />{error}</div>}

    {activeStep === 'writing' && <div className="pcw-writing-workspace-v3">
      <section className="pcw-card pcw-writing-v3-editor">
        <div className="pcw-card-head">
          <div><span className="pcw-eyebrow">01 AI 写作</span><h3>从目标 Query 生成可编辑内容</h3><p>先生成大纲，再生成全文；配置好后即可运行。</p></div>
          <Sparkles size={18} />
        </div>

        <div className="pcw-writing-v3-form">
          <label>目标 Query
            <select value={selectedQueryId} onChange={(event) => { const value = event.target.value; setSelectedQueryId(value); saveWritingWorkspace({ queryId: value }) }}>
              {queryRows.map((row) => <option key={row.id} value={row.id}>{row.text}</option>)}
            </select>
          </label>
          <div className="pcw-writing-v3-inline-fields">
            <label>内容类型
              <select value={mode} onChange={(event) => setMode(event.target.value as ContentMode)}>
                {MODES.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.hint}</option>)}
              </select>
            </label>
            <label>写作模型
              <select value={providerId} onChange={(event) => setProviderId(event.target.value)}>
                <option value="">选择已验证模型</option>
                {executableProviders.map((item) => <option key={item.id} value={item.id}>{item.providerId} · {item.execution?.modelName ?? '已验证'}</option>)}
              </select>
            </label>
          </div>
          <label>补充内容与写作要求
            <textarea value={writingContext} onChange={(event) => { const value = event.target.value; setWritingContext(value); saveWritingWorkspace({ context: value }) }} placeholder="补充当前类型的真实字段，例如：产品全称、目标用户、功能模块、案例指标、对比对象、评测环境或 FAQ 分类。这里的内容会和目标 Query、Prompt 一起发送给模型。" />
          </label>
          <div className="pcw-writing-v3-actions">
            <button className="primary" disabled={busy !== null || !selectedQuery || !providerId} onClick={() => void generateOutline()}><Sparkles size={15} />{busy === 'generate' ? '生成中…' : '生成大纲'}</button>
            <span className="pcw-writing-v3-hint">当前 Query、输入内容、大纲、全文和 Prompt 会按项目自动记忆。</span>
          </div>
        </div>

        {outline && <section className="pcw-writing-v3-outline">
          <div className="pcw-writing-v3-stage"><div><span className="pcw-eyebrow">步骤 2</span><h4>文章大纲</h4></div><span>{writingStageLabel(writingStage)}</span></div>
          <p className="pcw-writing-v3-help">大纲是可编辑的中间结果。你可以先调整结构、删减章节或补充必须回答的问题。</p>
          <textarea value={outline} onChange={(event) => { const value = event.target.value; setOutline(value); setWritingStage('outline'); saveWritingWorkspace({ outline: value, stage: 'outline' }) }} />
          <div className="pcw-writing-v3-actions"><button className="primary" disabled={busy !== null || !providerId} onClick={() => void generateFullArticle()}><ArrowRight size={15} />生成全文</button><button className="secondary" onClick={() => { setOutline(''); setArticleMarkdown(''); setWritingStage('input'); saveWritingWorkspace({ outline: '', markdown: '', stage: 'input' }) }}>重新开始</button></div>
        </section>}

        {articleMarkdown && <section className="pcw-writing-v3-full">
          <div className="pcw-writing-v3-stage"><div><span className="pcw-eyebrow">步骤 3</span><h4>全文编辑</h4></div><span>{writingStageLabel(writingStage)}</span></div>
          <p className="pcw-writing-v3-help">可以直接编辑 Markdown。保存后会重新计算质量初筛分数。</p>
          <textarea value={articleMarkdown} onChange={(event) => { const value = event.target.value; setArticleMarkdown(value); setWritingStage('full'); saveWritingWorkspace({ markdown: value, stage: 'full' }) }} />
          <div className="pcw-writing-v3-actions"><button className="primary" onClick={() => void saveManualContent()}>保存手动修改</button><button className="secondary" onClick={() => navStep('quality')}>查看质量初筛 <ArrowRight size={14} /></button></div>
          <div className="pcw-writing-v3-revision"><label>局部修改要求
            <textarea value={revisionInstruction} onChange={(event) => setRevisionInstruction(event.target.value)} placeholder="例如：只重写第二部分，让语气更客观，并补充来源边界。其他内容保持不变。" />
          </label><button className="secondary" disabled={busy !== null || !revisionInstruction.trim()} onClick={() => void reviseArticle()}><Sparkles size={14} />AI 局部修改</button></div>
        </section>}
      </section>

      <aside className="pcw-card pcw-writing-v3-prompt">
        <div className="pcw-section-heading"><div><span className="pcw-eyebrow">按内容类型配置</span><h3>{contentTypeLabel(mode)} Prompt</h3><p>不同内容类型使用不同 Prompt。这里的修改会真实发送给模型。</p></div></div>
        <p className="pcw-writing-prompt-help">已自动加载{contentTypeLabel(mode)}模板。Prompt 中的大括号是待补充字段，请在左侧补充真实事实；保存后，系统会将 Query、补充内容和这份 Prompt 一起发送给已验证模型。</p>
        <textarea aria-label={`${contentTypeLabel(mode)} Prompt`} className="pcw-writing-prompt-editor" value={writingPrompt} onChange={(event) => setWritingPrompts((current) => ({ ...current, [mode]: event.target.value }))} />
        <div className="pcw-prompt-field-hint"><strong>本类型建议补充</strong><span>{PROMPT_FIELD_HINTS[mode]}</span></div>
        <div className="pcw-prompt-footer"><span>当前任务：{contentTypeLabel(mode)} · {selectedQuery ? '已绑定 Query' : '未绑定 Query'}</span><button className="secondary compact" onClick={saveWritingPrompt}>保存 Prompt</button></div>
      </aside>
    </div>}

    {activeStep === 'quality' && <div className="pcw-quality-workspace"><section className="pcw-summary-strip"><div><strong>{assets.length}</strong><span>已生成</span></div><div><strong>{passed}</strong><span>通过初筛</span></div><div><strong>{assets.length - passed}</strong><span>需要调整</span></div><div className="pcw-progress-summary">{busy === 'generate' ? <><LoaderCircle className="spin" size={15} />{progress.done}/{progress.total} · {progress.label}</> : '自动初筛只发现内容风险，不代表 GEO 收录或排名结果'}</div><button className="secondary compact" onClick={() => navStep('writing')}>返回写作</button></section>{busy === 'generate' && <section className="pcw-card pcw-running"><strong>正在生成并逐条检查内容</strong><div className="pcw-running-track"><span style={{ width: `${progress.total ? Math.round(progress.done / progress.total * 100) : 0}%` }} /></div><small>{progress.done} / {progress.total} · 完成一条就会显示一条</small></section>}{!assets.length && busy !== 'generate' && <section className="pcw-card pcw-empty-quality"><CheckCircle2 size={24} /><h3>还没有内容资产</h3><p>先在 Prompt 与写作中选择 Query、内容类型，生成并保存一篇内容。</p><button className="primary" onClick={() => navStep('writing')}>去配置并生成 <ArrowRight size={15} /></button></section>}{assets.length > 0 && <section className="pcw-card pcw-assets"><div className="pcw-section-heading"><div><span className="pcw-eyebrow">02 自动质量初筛</span><h3>风险、分数和内容预览</h3><p>检查重复度、幻觉风险、关键词密度、可读性、语义相关性和 EEAT。低质量内容可回写 Prompt 后重新生成。</p></div></div><div className="pcw-asset-list">{assets.map((asset) => <article key={asset.id} className="pcw-asset-row"><div className="pcw-asset-main"><div className="pcw-asset-title"><span className={`pcw-status-dot ${asset.quality.passed ? 'ok' : 'warn'}`} /><strong>{asset.title}</strong><em>{variantLabel(asset.variant)}</em></div><p>{asset.query}</p><div className="pcw-score-bars"><span>总分 <b>{asset.quality.total}</b></span><span>重复 {asset.quality.duplicateScore}</span><span>幻觉风险 {asset.quality.hallucinationRisk}</span><span>密度 {asset.quality.keywordDensity}</span><span>可读性 {asset.quality.readabilityScore}</span><span>语义 {asset.quality.semanticRelevanceScore}</span><span>EEAT {asset.quality.eeatScore}</span></div>{asset.quality.issues.length > 0 && <small className="pcw-issues">建议：{asset.quality.issues.join('；')}</small>}</div><div className="pcw-asset-actions"><button className="secondary compact" disabled={!asset.quality.passed} title={asset.quality.passed ? '下载 Markdown' : '质量初筛未通过，先调整后再导出'} onClick={() => downloadAsset(asset, 'md')}><Download size={13} />MD</button><button className="secondary compact" disabled={!asset.quality.passed} title={asset.quality.passed ? '下载 HTML' : '质量初筛未通过，先调整后再导出'} onClick={() => downloadAsset(asset, 'html')}><Download size={13} />HTML</button></div></article>)}</div></section>}</div>}

    <footer className="pcw-new-footer"><span><ShieldCheck size={14} />当前项目隔离 · 不自动发布 · 配置即运行</span><span>Query → Prompt → 质量 → 导出素材</span></footer>
  </section>
}







