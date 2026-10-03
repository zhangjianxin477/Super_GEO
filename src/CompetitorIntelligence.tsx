import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  FilePlus2,
  FileSearch,
  History,
  Link2,
  LoaderCircle,
  Play,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { getWorkspaceSession } from './BrandDiagnostics'
import {
  approveCompetitorQueryGroupEvidence,
  createCompetitorEvidenceAnalysis,
  createCompetitorLinkPageAnalysis,
  createGeoGapActionContentBrief,
  createGeoGapActionRetestPlan,
  generateGeoGapActions,
  getContentPublicationObservation,
  ensureDefaultCompetitorIntelligenceProfile,
  listApprovedCompetitorEvidence,
  listCompetitorAnalysisPrompts,
  listCompetitorEvidenceAnalyses,
  listCompetitorIntelligenceProfiles,
  listGeoGapActions,
  listCompetitorLinkCandidates,
  listCompetitorQueryGroups,
  listModelProviders,
  restoreCompetitorAnalysisPrompt,
  updateCompetitorAnalysisPrompt,
  updateGeoGapAction,
  type CompetitorAnalysisAgentType,
  type CompetitorAnalysisPrompt,
  type CompetitorEvidenceAnalysis,
  type CompetitorEvidenceOverview,
  type ContentPublicationObservation,
  type CompetitorIntelligenceProfile,
  type CompetitorLinkCandidate,
  type GeoGapAction,
  type CompetitorQueryGroup,
  type ModelProviderConfiguration,
  type WorkspaceSession,
} from './api'

const agentLabels: Record<CompetitorAnalysisAgentType, { label: string; description: string }> = {
  'answer-extraction': { label: '回答解析', description: '从 AI 原始回答中提取竞品、属性、推荐语境与关键词。' },
  'link-classification': { label: '链接归类', description: '区分回答引用、平台检索来源与潜在品牌 / 内容角色。' },
  'page-structure': { label: '页面结构分析', description: '分析公开页面的内容结构、选型信息和证据强度。' },
  'insight-synthesis': { label: '洞察汇总', description: '在明确的 Query 范围内汇总竞品、关键词、场景与内容机会。' },
}
const agentTypes = Object.keys(agentLabels) as CompetitorAnalysisAgentType[]
const prettyDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
  : '—'
const sourceTypeLabel = (value: string) => value === 'answer-citation' ? '回答引用' : value === 'platform-search-result' ? '平台搜索来源' : '其他来源'
const evidenceStateLabel = (state: 'approved'|'captured') => state === 'approved' ? '已批准' : '已捕获，待批准'
function QueryGroupPicker({ groups, value, onChange }: { groups: CompetitorQueryGroup[]; value: string; onChange: (queryGroupId: string) => void }) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const selected = groups.find((group) => group.id === value) ?? groups[0]

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return <div className="ci-query-picker" ref={pickerRef}>
    <button type="button" className="ci-query-picker-trigger" aria-haspopup="listbox" aria-expanded={open} disabled={!groups.length} onClick={() => setOpen((current) => !current)}>
      <span className="ci-query-picker-value" title={selected?.question}>{selected?.question || '请选择研究 Query'}</span>
      <ChevronDown size={15} className={open ? 'is-open' : undefined}/>
    </button>
    {open && groups.length > 0 && <div className="ci-query-picker-menu" role="listbox" aria-label="研究 Query 选项">
      {groups.map((group) => <button key={group.id} type="button" role="option" aria-selected={group.id === value} className={group.id === value ? 'selected' : ''} onClick={() => { onChange(group.id); setOpen(false) }}>
        <span><b>{group.question}</b><small>{group.observations.length} 条真实回答 · {group.linkCount} 个来源</small></span>
        {group.id === value && <Check size={15}/>} 
      </button>)}
    </div>}
  </div>
}

const linkPriority = (candidate: CompetitorLinkCandidate) => {
  if (!candidate.evidenceStates.includes('approved')) return { tone: 'pending', label: '待批准', detail: '对应回答尚未批准，暂不发送给分析模型。' }
  if (candidate.platforms.length > 1 || candidate.approvedOccurrenceCount > 1) return { tone: 'high', label: '高优先级 · 多处出现', detail: '已在多个平台或多条已批准回答中出现，建议优先页面深读。' }
  if (candidate.sourceTypes.includes('answer-citation')) return { tone: 'recommended', label: '建议深读 · 回答引用', detail: '它是模型回答直接引用的公开页面，适合补足页面层证据。' }
  return { tone: 'optional', label: '可选深读 · 搜索来源', detail: '它来自平台搜索来源，可按研究重点选择是否深读。' }
}

function PromptResult({ result }: { result: Record<string, unknown> }) {
  const record = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const list = (value: unknown, limit = 12) => Array.isArray(value) ? value.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return String(item)
    const itemRecord = record(item)
    const title = String(itemRecord.title ?? itemRecord.name ?? itemRecord.competitor ?? itemRecord.brandName ?? itemRecord.topic ?? itemRecord.action ?? itemRecord.heading ?? itemRecord.claim ?? itemRecord.fact ?? itemRecord.recommendedAction ?? '')
    const detail = String(itemRecord.purpose ?? itemRecord.rationale ?? itemRecord.positioning ?? itemRecord.inference ?? itemRecord.reason ?? itemRecord.evidence ?? itemRecord.expectedSignal ?? '')
    return [title, detail && detail !== title ? detail : ''].filter(Boolean).join(' — ')
  }).filter(Boolean).slice(0, limit) : []
  const text = (...values: unknown[]) => {
    const value = values.find((candidate) => (typeof candidate === 'string' && candidate.trim()) || typeof candidate === 'number')
    return value === undefined ? undefined : String(value)
  }
  const page = record(result.page)
  const assessment = record(result.competitiveAssessment)
  const intent = record(result.queryIntent)
  const keywords = record(result.keywords)
  const coverage = record(result.evidenceCoverage)
  const validation = record(result._validation)
  const mentions = Array.isArray(result.mentions) ? result.mentions : Array.isArray(result.competitors) ? result.competitors : []
  const names = mentions.map((item) => String(record(item).brandName ?? record(item).productName ?? record(item).name ?? (typeof item === 'string' ? item : ''))).filter(Boolean)
  const pageSignals = [
    ...list(page.productCapabilities),
    ...list(page.useCases).map((item) => `场景：${item}`),
    ...list(page.integrations).map((item) => `集成：${item}`),
    ...list(page.comparisonSignals).map((item) => `选型信号：${item}`),
    text(page.pricingOrPackaging) && `定价 / 套餐：${text(page.pricingOrPackaging)}`,
    ...list(page.callsToAction).map((item) => `CTA：${item}`),
    ...list(page.trustSignals).map((item) => `信任背书：${item}`),
  ].filter(Boolean) as string[]
  const seo = record(page.seoSignals)
  const seoSignals = [
    ...list(seo.keywords).map((item) => `关键词：${item}`),
    text(seo.contentAngle) && `内容角度：${text(seo.contentAngle)}`,
    text(seo.format) && `内容形式：${text(seo.format)}`,
  ].filter(Boolean) as string[]
  const competitiveAssessment = [
    ...list(assessment.strengths).map((item) => `可见优势：${item}`),
    ...list(assessment.weaknesses).map((item) => `可见短板：${item}`),
    ...list(assessment.differentiators).map((item) => `差异化：${item}`),
    ...list(assessment.opportunities).map((item) => `可利用机会：${item}`),
  ]
  const comparisonRows = (Array.isArray(result.comparisonMatrix) ? result.comparisonMatrix : mentions).map(record).filter((item) => text(item.competitor, item.name, item.brandName))
  const evidenceNotes = [
    text(coverage.approvedAnswerCount) && `已批准回答：${text(coverage.approvedAnswerCount)}`,
    text(coverage.analyzedPageCount) && `已页面深读：${text(coverage.analyzedPageCount)}`,
    ...list(coverage.platforms).map((item) => `平台：${item}`),
    ...list(coverage.limitations).map((item) => `限制：${item}`),
    text(page.evidenceStrength) && `页面证据强度：${text(page.evidenceStrength)}`,
    ...list(result.uncertainties).map((item) => `待验证：${item}`),
  ].filter(Boolean) as string[]
  const List = ({ items }: { items: string[] }) => items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : null
  const Chips = ({ items }: { items: string[] }) => items.length ? <div className="ci-result-chips">{items.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div> : null

  return <div className="ci-analysis-result">
    {validation.status === 'passed' && <p className="ci-validation-pass"><ShieldCheck size={14}/>结构校验通过 · {text(validation.schemaVersion) || 'competitor-analysis-v1'}</p>}
    {Object.keys(page).length > 0 && <div className="ci-result-grid">
      <section><b>页面定位与结构</b><p>{[text(page.pageType), text(page.primaryTopic), text(page.positioning)].filter(Boolean).join(' · ') || '已输出页面结构化判断'}</p><Chips items={list(page.targetAudience)} /><List items={[...list(page.headingOutline), ...list(page.contentSections)]} /></section>
      {pageSignals.length > 0 && <section><b>产品与商业化信号</b><List items={pageSignals} /></section>}
      {seoSignals.length > 0 && <section><b>内容 / SEO 信号</b><List items={seoSignals} /></section>}
      {competitiveAssessment.length > 0 && <section><b>竞争判断</b><List items={competitiveAssessment} /></section>}
    </div>}
    {text(intent.summary, intent.stage) && <section><b>Query 意图</b><p>{[text(intent.summary), text(intent.stage) && `决策阶段：${text(intent.stage)}`].filter(Boolean).join(' · ')}</p><Chips items={list(intent.decisionDrivers)} /></section>}
    {names.length > 0 && <section><b>识别到的竞品 / 实体</b><Chips items={names.slice(0, 16)} /></section>}
    {comparisonRows.length > 0 && <section><b>竞品对比</b><div className="ci-comparison-grid">{comparisonRows.slice(0, 8).map((row, index) => { const name = text(row.competitor, row.name, row.brandName) || '未命名竞品'; const strengths = list(row.strengths ?? row.capabilities, 5); const gaps = list(row.gaps ?? row.weaknesses, 5); return <article key={`${name}-${index}`}><strong>{name}</strong>{text(row.positioning, row.summary) && <p>{text(row.positioning, row.summary)}</p>}{strengths.length > 0 && <div><b>能力 / 优势</b><Chips items={strengths} /></div>}{gaps.length > 0 && <div><b>差距 / 风险</b><Chips items={gaps} /></div>}</article> })}</div></section>}
    {[...list(keywords.repeated), ...list(keywords.byPlatform)].length > 0 && <section><b>决策关键词与内容角度</b><Chips items={[...list(keywords.repeated), ...list(keywords.byPlatform)]} /></section>}
    {list(result.findings, 8).length > 0 && <section><b>关键洞察</b><List items={list(result.findings, 8)} /></section>}
    {(list(result.contentOpportunities, 8).length > 0 || list(result.actionPlan, 8).length > 0) && <div className="ci-result-grid">{list(result.contentOpportunities, 8).length > 0 && <section><b>内容机会</b><List items={list(result.contentOpportunities, 8)} /></section>}{list(result.actionPlan, 8).length > 0 && <section><b>建议行动</b><List items={list(result.actionPlan, 8)} /></section>}</div>}
    {evidenceNotes.length > 0 && <section className="ci-evidence-note"><b>证据范围与限制</b><List items={evidenceNotes} /></section>}
    <details><summary>查看原始结构化结果</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
  </div>
}

function AnalysisProgress({ kind, elapsedSeconds }: { kind: 'page' | 'query' | 'baseline'; elapsedSeconds: number }) {
  const state = kind === 'page'
    ? elapsedSeconds < 3
      ? { title: '正在读取并清洗页面正文…', detail: '先验证页面可访问性，再提取标题层级、正文与来源链路。' }
      : elapsedSeconds < 10
        ? { title: '正在提取页面结构与产品信息…', detail: '正在识别定位、功能、场景、CTA、内容信号与证据强度。' }
        : { title: '正在生成页面竞争判断…', detail: '已将抓取到的页面数据交给模型生成结构化结论。' }
    : kind === 'query'
      ? elapsedSeconds < 3
        ? { title: '正在整理当前 Query 的已批准回答与链接…', detail: '只会使用当前范围内已批准的原始回答和来源记录。' }
        : elapsedSeconds < 10
          ? { title: '正在汇入已完成的页面深读…', detail: '已分析的页面会参与对比；未深读链接不会被编造成页面事实。' }
          : { title: '正在生成可追溯的竞品对比与行动建议…', detail: '正在区分平台事实、推断与待验证项；耗时取决于模型响应。' }
      : elapsedSeconds < 4
        ? { title: '正在整理跨 Query 的已批准基线记录…', detail: '正在按平台和 Query 保留来源差异。' }
        : { title: '正在生成跨 Query 洞察…', detail: '正在聚合趋势与内容机会，耗时取决于模型响应。' }
  return <div className="ci-run-progress" role="status" aria-live="polite"><LoaderCircle size={17}/><div><strong>{state.title}</strong><span>{state.detail}</span></div><em><Clock3 size={13}/>已等待 {elapsedSeconds} 秒</em></div>
}

function AnalysisHistory({ analyses, queryGroupId }: { analyses: CompetitorEvidenceAnalysis[]; queryGroupId: string }) {
  const scoped = analyses.filter((analysis) => {
    if (!queryGroupId) return analysis.scopeType !== 'baseline-cohort'
    return analysis.evidenceSummary.queryGroupId === queryGroupId
      || (analysis.evidenceSummary.kind === 'selected-link-page' && analysis.evidenceSummary.queryGroupId === queryGroupId)
  })
  return <section className="ci-card ci-analysis-history">
    <header className="ci-section-heading"><div><b className="chip blue">可追溯结果</b><h3>该 Query 的页面分析与竞品结论</h3><p>每条结果保留 Prompt 版本、模型、输入快照与来源观察记录。</p></div></header>
    {!scoped.length ? <p className="ci-source-empty">当前 Query 尚未运行页面分析或竞品结论。</p> : <div className="ci-analysis-list">{scoped.map((analysis) => <article key={analysis.id}>
      <header><div><strong>{analysis.evidenceSummary.kind === 'selected-link-page' ? '页面结构分析' : 'Query 竞品结论'}</strong><span>Prompt v{analysis.promptVersion ?? '—'} · {analysis.modelName ?? '未完成'}</span></div><span>{analysis.state === 'succeeded' ? '已完成' : analysis.state === 'failed' ? '失败' : '运行中'}</span></header>
      {analysis.evidenceSummary.finalUrl && <a href={String(analysis.evidenceSummary.finalUrl)} target="_blank" rel="noreferrer" className="ci-history-link">{String(analysis.evidenceSummary.title || analysis.evidenceSummary.finalUrl)} <ExternalLink size={13}/></a>}
      <p className="ci-analysis-meta">{prettyDate(analysis.completedAt ?? analysis.startedAt)} · {analysis.observationIds.length} 条来源观察记录 · {analysis.evidenceSummary.platforms?.join(' / ') || '—'}{analysis.evidenceSummary.recordCount !== undefined && ` · 输入快照：${analysis.evidenceSummary.recordCount} 条已批准记录`}{analysis.evidenceSummary.linkedPageAnalysisCount !== undefined && ` · 同步 ${analysis.evidenceSummary.linkedPageAnalysisCount} 份页面深读`}</p>
      {analysis.state === 'succeeded' ? <PromptResult result={analysis.result}/> : <p className="ci-error-text">{analysis.errorMessage || '正在处理…'}</p>}
    </article>)}</div>}
  </section>
}


const priorityLabel: Record<GeoGapAction['priority'], string> = { high: '高优先级', medium: '中优先级', low: '低优先级' }
const actionStatusLabel: Record<GeoGapAction['status'], string> = { draft: '待确认', 'in-progress': '进行中', completed: '已完成', dismissed: '已搁置' }
const actionWorkflowLabel: Record<string, string> = {
  'action-ready': '待创建内容 Brief',
  'brief-ready': '待进入内容任务',
  'brief-needs-review': '内容 Brief 待审核',
  'brief-approved': '可生成草稿',
  'brief-rejected': 'Brief 需调整',
  'draft-needs-review': '草稿与主张待审核',
  'ready-to-publish': '待人工登记发布',
  'draft-rejected': '草稿需调整',
  'published-awaiting-retest': '已确认发布，待安排复测',
  'retest-scheduled': '复测已安排',
}

function GapActionPanel({ actions, analysis, busy, actionBusyId, publicationObservations, onGenerate, onCreateBrief, onCreateRetest, onStart, onContinueWriting }: {
  actions: GeoGapAction[]; analysis: CompetitorEvidenceAnalysis | null; busy: boolean; actionBusyId: string | null; publicationObservations: Record<string, ContentPublicationObservation>;
  onGenerate: () => void; onCreateBrief: (actionId: string) => void; onCreateRetest: (actionId: string) => void; onStart: (actionId: string) => void; onContinueWriting: (action: GeoGapAction) => void;
}) {
  const visibleActions = analysis ? actions.filter((action) => action.analysisId === analysis.id) : []
  return <section className="ci-card ci-gap-actions">
    <header className="ci-section-heading"><div><b className="chip purple">GEO 差距行动</b><h3>把 Query 结论变成可复核的下一步</h3><p>一张行动卡只处理一个 Query 缺口：人工确认内容假设 → Brief / 草稿审核 → 人工登记发布 → 同范围复测。</p></div><button className="primary" type="button" disabled={busy || !analysis || Boolean(actionBusyId)} onClick={onGenerate}><ClipboardList size={15}/>{analysis ? '生成行动卡' : '先生成 Query 结论'}</button></header>
    {!analysis ? <div className="ci-empty compact"><ClipboardList size={18}/><b>尚无可转换的 Query 结论</b><p>先生成并保留当前 Query 的竞品结论，再将内容机会和建议行动转换为行动卡。</p></div> : !visibleActions.length ? <div className="ci-gap-empty"><p>当前结论尚未生成行动卡。生成后由人工确认内容假设，再进入受控写作和发布后复测。</p></div> : <div className="ci-gap-action-list">{visibleActions.map((action) => {
      const stage = action.contentWorkflow?.stage ?? (action.contentBrief ? 'brief-ready' : 'action-ready')
      const isPublished = ['published-awaiting-retest', 'retest-scheduled'].includes(stage)
      const retestLabel = action.retestPlan ? (stage === 'retest-scheduled' ? '复测已安排' : '复测预案已创建') : isPublished ? '安排发布后复测' : '创建复测预案'
      const publicationId = action.contentWorkflow?.contentPublicationId ?? action.retestPlan?.publicationId
      const publicationObservation = publicationId ? publicationObservations[publicationId] : null
      const mentionDelta = publicationObservation?.observation.deltas?.mentionRate
      const observationStatus = publicationObservation?.status === 'ready'
        ? `同范围复测已完成 · 品牌提及率 ${mentionDelta === null || mentionDelta === undefined ? '—' : `${mentionDelta > 0 ? '+' : ''}${Math.round(mentionDelta * 1000) / 10}pp`}`
        : publicationObservation?.status === 'awaiting-evidence' ? '复测已回传，待完成证据复核'
          : publicationObservation?.status === 'not-comparable' ? '复测范围不可比较，未生成前后差异'
            : publicationObservation?.status === 'scheduled' ? '复测已安排，等待同范围证据回传'
              : publicationObservation?.status === 'not-scheduled' ? '已登记发布，尚未安排正式复测' : null
      return <article key={action.id} className={`ci-gap-action priority-${action.priority}`}>
        <header><div><span className={`ci-action-priority ${action.priority}`}>{priorityLabel[action.priority]}</span><span className={`ci-action-status ${action.status}`}>{actionStatusLabel[action.status]}</span></div><span>{action.actionType.replaceAll('-', ' ')}</span></header>
        <h4>{action.title}</h4><p>{action.gapSummary}</p>
        <div className="ci-gap-evidence"><b>支撑证据</b><span>{action.evidenceSnapshot.approvedAnswerCount ?? 0} 条已批准回答 · {action.evidenceSnapshot.platforms?.join(' / ') || '当前范围平台待确认'}</span>{action.evidenceSnapshot.visibleSources?.length ? <span>{action.evidenceSnapshot.visibleSources.length} 个可见来源线索</span> : null}</div>
        <div className="ci-gap-workflow"><b>当前进度</b><span>{actionWorkflowLabel[stage] ?? '待人工确认'}</span></div>
        {observationStatus && <div className={`ci-gap-observation ${publicationObservation?.status === 'ready' ? 'ready' : ''}`}><b>复测观察</b><span>{observationStatus}</span><small>{publicationObservation?.status === 'ready' ? '仅为同范围前后观察，不构成内容带来变化的因果归因。' : '系统不会在范围不一致或证据未完成时呈现效果变化。'}</small></div>}
        {action.limitations.length > 0 && <p className="ci-gap-limit"><AlertTriangle size={14}/>{action.limitations[0]}</p>}
        <div className="ci-gap-controls">
          {action.status === 'draft' && <button className="secondary" type="button" disabled={busy || Boolean(actionBusyId)} onClick={() => onStart(action.id)}>开始跟进</button>}
          {!action.contentBrief && <button className="secondary" type="button" disabled={busy || Boolean(actionBusyId)} onClick={() => onCreateBrief(action.id)}><FilePlus2 size={14}/>确认并创建 Brief</button>}
          {action.contentBrief && !isPublished && <button className="primary ci-action-writing" type="button" disabled={busy || Boolean(actionBusyId)} onClick={() => onContinueWriting(action)}><Sparkles size={14}/>{stage === 'brief-ready' ? '进入智能写作' : '继续内容工作流'}</button>}
          <button className="secondary" type="button" disabled={busy || Boolean(actionBusyId) || Boolean(action.retestPlan)} onClick={() => onCreateRetest(action.id)}><RotateCcw size={14}/>{retestLabel}</button>
        </div>
        {(action.contentBrief || action.retestPlan || action.contentWorkflow?.contentBriefId) && <details className="ci-gap-detail"><summary>查看工作项与边界</summary><p><b>工作流：</b>{actionWorkflowLabel[stage] ?? '待人工确认'}</p>{action.contentBrief && <p><b>行动 Brief：</b>{action.contentBrief.objective || action.contentBrief.title} · {action.contentBrief.status || '待人工复核'}</p>}{action.contentWorkflow?.contentBriefId && <p><b>已关联内容任务：</b>系统保留 Brief、草稿、发布登记与复测计划的关联，不将可见来源线索当作产品事实。</p>}{action.retestPlan && <p><b>复测计划：</b>{action.retestPlan.scheduledFor ? `${prettyDate(action.retestPlan.scheduledFor)} · ` : ''}{action.retestPlan.trigger || '待发布确认后执行'}</p>}</details>}
      </article>
    })}</div>}
  </section>
}

export function CompetitorIntelligence({ go, notice, projectId = null, onContinueWriting }: { go: (screen: 'baseline'|'connections'|'content') => void; notice: (value: string) => void; projectId?: string | null; onContinueWriting?: (action: GeoGapAction) => void }) {
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  const [profile, setProfile] = useState<CompetitorIntelligenceProfile | null>(null)
  const [prompts, setPrompts] = useState<CompetitorAnalysisPrompt[]>([])
  const [queryGroups, setQueryGroups] = useState<CompetitorQueryGroup[]>([])
  const [candidates, setCandidates] = useState<CompetitorLinkCandidate[]>([])
  const [overview, setOverview] = useState<CompetitorEvidenceOverview | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [analyses, setAnalyses] = useState<CompetitorEvidenceAnalysis[]>([])
  const [gapActions, setGapActions] = useState<GeoGapAction[]>([])
  const [publicationObservations, setPublicationObservations] = useState<Record<string, ContentPublicationObservation>>({})
  const [providers, setProviders] = useState<ModelProviderConfiguration[]>([])
  const [tab, setTab] = useState<'scope'|'evidence'|'insights'|'actions'|'settings'>('scope')
  const [scopeMode, setScopeMode] = useState<'query'|'observation'>('query')
  const [selectedQueryGroupId, setSelectedQueryGroupId] = useState('')
  const [selectedObservationId, setSelectedObservationId] = useState('')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [selectedTestRunId, setSelectedTestRunId] = useState('')
  const [selectedAgentType, setSelectedAgentType] = useState<CompetitorAnalysisAgentType>('page-structure')
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [promptName, setPromptName] = useState('')
  const [promptTemplate, setPromptTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [runKind, setRunKind] = useState<'page'|'query'|'baseline'|null>(null)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState('')

  const selectedQueryGroup = useMemo(() => queryGroups.find((group) => group.id === selectedQueryGroupId) ?? null, [queryGroups, selectedQueryGroupId])
  const selectedCandidate = useMemo(() => candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null, [candidates, selectedCandidateId])
  const selectedPrompt = useMemo(() => prompts.find((item) => item.id === selectedPromptId) ?? null, [prompts, selectedPromptId])
  const selectedCandidateApproved = Boolean(selectedCandidate?.evidenceStates.includes('approved'))
  const verifiedProviders = useMemo(() => providers.filter((provider) => provider.status === 'configured' && ['official-api', 'enterprise-gateway'].includes(provider.collectionMode) && provider.credential?.configured && provider.execution && provider.test?.status === 'verified'), [providers])
  const selectedObservation = selectedQueryGroup?.observations.find((item) => item.observationId === selectedObservationId) ?? null
  const approvalEligibleCount = scopeMode === 'query'
    ? selectedQueryGroup?.approvableCount ?? 0
    : selectedObservation?.approvalEligible ? 1 : 0
  const linkScope = useMemo(() => ({
    queryGroupId: selectedQueryGroupId || undefined,
    observationId: scopeMode === 'observation' ? selectedObservationId || undefined : undefined,
  }), [scopeMode, selectedObservationId, selectedQueryGroupId])
  const completedPageAnalysisCount = useMemo(() => analyses.filter((analysis) => analysis.agentType === 'page-structure' && analysis.state === 'succeeded' && analysis.evidenceSummary.kind === 'selected-link-page' && analysis.evidenceSummary.queryGroupId === selectedQueryGroupId && (scopeMode === 'query' || analysis.evidenceSummary.selectedObservationId === selectedObservationId)).length, [analyses, scopeMode, selectedObservationId, selectedQueryGroupId])
  const latestQueryAnalysis = useMemo(() => analyses.find((analysis) => analysis.scopeType === 'query-cohort' && analysis.state === 'succeeded' && analysis.evidenceSummary.queryGroupId === selectedQueryGroupId && (scopeMode === 'query' || analysis.evidenceSummary.selectedObservationId === selectedObservationId)) ?? null, [analyses, scopeMode, selectedObservationId, selectedQueryGroupId])
  const scopedObservations = useMemo(() => {
    if (!selectedQueryGroup) return []
    return scopeMode === 'query'
      ? selectedQueryGroup.observations
      : selectedQueryGroup.observations.filter((observation) => observation.observationId === selectedObservationId)
  }, [scopeMode, selectedObservationId, selectedQueryGroup])
  const reviewedCount = scopedObservations.filter((observation) => observation.evidenceState === 'approved').length
  const pendingScopedCount = scopedObservations.filter((observation) => observation.evidenceState === 'captured').length
  const selectedProvider = verifiedProviders.find((provider) => provider.id === selectedProviderId) ?? null
  const hasApprovedEvidence = reviewedCount > 0
  const researchStep = useMemo(() => {
    if (!selectedQueryGroup) return 'scope'
    if (pendingScopedCount > 0) return 'evidence'
    if (!latestQueryAnalysis) return 'insights'
    return 'actions'
  }, [latestQueryAnalysis, pendingScopedCount, selectedQueryGroup])

  const choosePrompt = (candidate: CompetitorAnalysisPrompt) => {
    setSelectedPromptId(candidate.id)
    setSelectedAgentType(candidate.agentType)
    setPromptName(candidate.name)
    setPromptTemplate(candidate.template)
  }
  const loadCandidates = async (active: WorkspaceSession, scope = linkScope) => {
    if (!scope.queryGroupId) { setCandidates([]); setSelectedCandidateId(''); return }
    const response = await listCompetitorLinkCandidates(active, scope)
    setCandidates(response.candidates)
    setSelectedCandidateId((current) => response.candidates.some((candidate) => candidate.id === current) ? current : response.candidates[0]?.id ?? '')
  }
  const loadGapActions = async (active: WorkspaceSession, queryGroupId: string) => {
    if (!queryGroupId) { setGapActions([]); return }
    const response = await listGeoGapActions(active, queryGroupId)
    setGapActions(response.actions)
    const publicationIds = [...new Set(response.actions.map((action) => action.contentWorkflow?.contentPublicationId ?? action.retestPlan?.publicationId).filter((id): id is string => Boolean(id)))]
    if (!publicationIds.length) { setPublicationObservations({}); return }
    const results = await Promise.all(publicationIds.map(async (publicationId) => {
      try { return [publicationId, (await getContentPublicationObservation(active, publicationId)).observation] as const } catch { return null }
    }))
    setPublicationObservations(Object.fromEntries(results.filter((item): item is readonly [string, ContentPublicationObservation] => item !== null)))
  }
  const loadProfileResources = async (active: WorkspaceSession, activeProfile: CompetitorIntelligenceProfile) => {
    const [promptResponse, evidenceResponse, analysisResponse, queryGroupResponse] = await Promise.all([
      listCompetitorAnalysisPrompts(active, activeProfile.id),
      listApprovedCompetitorEvidence(active, activeProfile.id),
      listCompetitorEvidenceAnalyses(active, activeProfile.id),
      listCompetitorQueryGroups(active, projectId),
    ])
    const groups = queryGroupResponse.queryGroups
    const nextQueryGroupId = groups.some((group) => group.id === selectedQueryGroupId) ? selectedQueryGroupId : groups[0]?.id ?? ''
    const nextGroup = groups.find((group) => group.id === nextQueryGroupId)
    const nextObservationId = nextGroup?.observations.some((item) => item.observationId === selectedObservationId)
      ? selectedObservationId
      : nextGroup?.observations[0]?.observationId ?? ''
    setPrompts(promptResponse.prompts)
    setOverview(evidenceResponse.overview)
    setPendingCount(evidenceResponse.pendingEvidence.length)
    setAnalyses(analysisResponse.analyses)
    setQueryGroups(groups)
    setSelectedQueryGroupId(nextQueryGroupId)
    setSelectedObservationId(nextObservationId)
    setSelectedTestRunId((current) => evidenceResponse.overview.testRuns.some((item) => item.testRunId === current && item.approvedCount > 0) ? current : evidenceResponse.overview.testRuns.find((item) => item.approvedCount > 0)?.testRunId ?? '')
    const currentPrompt = promptResponse.prompts.find((item) => item.agentType === selectedAgentType && item.status === 'active') ?? promptResponse.prompts.find((item) => item.agentType === 'page-structure' && item.status === 'active')
    if (currentPrompt) choosePrompt(currentPrompt)
    await Promise.all([
      loadCandidates(active, { queryGroupId: nextQueryGroupId || undefined, observationId: scopeMode === 'observation' ? nextObservationId || undefined : undefined }),
      loadGapActions(active, nextQueryGroupId),
    ])
  }
  const load = async (activeSession?: WorkspaceSession) => {
    const active = activeSession ?? session
    if (!active) return
    const [profileResponse, providerResponse] = await Promise.all([listCompetitorIntelligenceProfiles(active), listModelProviders(active)])
    const activeProfile = profileResponse.profiles[0] ?? (await ensureDefaultCompetitorIntelligenceProfile(active)).profile
    setProfile(activeProfile)
    setProviders(providerResponse.providers)
    const available = providerResponse.providers.filter((provider) => provider.status === 'configured' && ['official-api', 'enterprise-gateway'].includes(provider.collectionMode) && provider.credential?.configured && provider.execution && provider.test?.status === 'verified')
    setSelectedProviderId((current) => available.some((provider) => provider.id === current) ? current : available[0]?.id ?? '')
    await loadProfileResources(active, activeProfile)
  }
  useEffect(() => { void (async () => { try { const active = await getWorkspaceSession(); setSession(active); await load(active) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Query 竞品分析加载失败。') } finally { setLoading(false) } })() }, [])
  useEffect(() => { if (session) void load(session).catch((cause) => setError(cause instanceof Error ? cause.message : '切换项目后未能加载 Query 竞品分析。')) }, [projectId])
  useEffect(() => {
    if (!session || !selectedQueryGroupId) return
    void loadCandidates(session).catch((cause) => setError(cause instanceof Error ? cause.message : '该 Query 的来源链接加载失败。'))
    void loadGapActions(session, selectedQueryGroupId).catch((cause) => setError(cause instanceof Error ? cause.message : '该 Query 的行动卡加载失败。'))
  }, [session, selectedQueryGroupId, selectedObservationId, scopeMode])

  useEffect(() => {
    if (!runStartedAt) { setElapsedSeconds(0); return }
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - runStartedAt) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [runStartedAt])

  const selectQueryGroup = (queryGroupId: string) => {
    const group = queryGroups.find((item) => item.id === queryGroupId)
    setSelectedQueryGroupId(queryGroupId)
    setSelectedObservationId(group?.observations[0]?.observationId ?? '')
  }
  const selectAgent = (agentType: CompetitorAnalysisAgentType) => {
    setSelectedAgentType(agentType)
    const next = prompts.find((item) => item.agentType === agentType && item.status === 'active') ?? prompts.find((item) => item.agentType === agentType)
    if (next) choosePrompt(next)
  }
  const savePrompt = async () => {
    if (!session || !profile) return
    try {
      setBusy(true); setError('')
      const response = await updateCompetitorAnalysisPrompt(session, profile.id, { agentType: selectedAgentType, name: promptName, template: promptTemplate })
      await loadProfileResources(session, profile)
      choosePrompt(response.prompt)
      notice(`${agentLabels[selectedAgentType].label} Prompt 已发布为 v${response.prompt.version}。`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '发布 Prompt 失败。') } finally { setBusy(false) }
  }
  const restorePrompt = async () => {
    if (!session || !profile || !selectedPrompt || selectedPrompt.status === 'active') return
    try {
      setBusy(true); setError('')
      const response = await restoreCompetitorAnalysisPrompt(session, profile.id, selectedPrompt.id, selectedPrompt.agentType)
      await loadProfileResources(session, profile)
      choosePrompt(response.prompt)
      notice(`已从 v${selectedPrompt.version} 恢复并发布新版本 v${response.prompt.version}。`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '恢复 Prompt 失败。') } finally { setBusy(false) }
  }
  const generateCurrentGapActions = async () => {
    if (!session || !selectedQueryGroup || !latestQueryAnalysis) { notice('请先生成当前 Query 的竞品结论。'); return }
    try {
      setActionBusyId('generate'); setError('')
      const response = await generateGeoGapActions(session, selectedQueryGroup.id, latestQueryAnalysis.id)
      setGapActions(response.actions)
      notice(`已生成 ${response.actions.length} 张 GEO 差距行动卡，请先人工确认再推进内容动作。`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '生成 GEO 差距行动卡失败。') } finally { setActionBusyId(null) }
  }
  const updateGapAction = async (actionId: string, status: GeoGapAction['status']) => {
    if (!session) return
    try {
      setActionBusyId(actionId); setError('')
      const response = await updateGeoGapAction(session, actionId, status)
      setGapActions((current) => current.map((item) => item.id === actionId ? response.action : item))
      notice(status === 'in-progress' ? '行动卡已标记为进行中。' : '行动卡状态已更新。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '更新行动卡失败。') } finally { setActionBusyId(null) }
  }
  const createGapBrief = async (actionId: string) => {
    if (!session) return
    try {
      setActionBusyId(actionId); setError('')
      const response = await createGeoGapActionContentBrief(session, actionId)
      setGapActions((current) => current.map((item) => item.id === actionId ? response.action : item))
      notice('GEO Content Brief 已创建，下一步请人工复核内容假设与边界。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '创建 Content Brief 失败。') } finally { setActionBusyId(null) }
  }
  const continueGapActionInWriting = async (action: GeoGapAction) => {
    if (!session || !action.contentBrief) return
    try {
      setActionBusyId(action.id); setError('')
      const nextAction = action.status === 'draft'
        ? (await updateGeoGapAction(session, action.id, 'in-progress')).action
        : action
      if (nextAction !== action) setGapActions((current) => current.map((item) => item.id === action.id ? nextAction : item))
      if (onContinueWriting) onContinueWriting(nextAction)
      else go('content')
      notice('已带入内容工作台：请补全内容任务，并选择已批准的产品事实范围。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '带入智能写作失败。') } finally { setActionBusyId(null) }
  }

  const createGapRetest = async (actionId: string) => {
    if (!session) return
    try {
      setActionBusyId(actionId); setError('')
      const response = await createGeoGapActionRetestPlan(session, actionId)
      setGapActions((current) => current.map((item) => item.id === actionId ? response.action : item))
      notice('已加入待复测计划；完成关联内容并确认发布后再执行正式复测。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '创建复测计划失败。') } finally { setActionBusyId(null) }
  }

  const approveCurrentQueryEvidence = async () => {
    if (!session || !profile || !selectedQueryGroup || !approvalEligibleCount) return
    const targetLabel = scopeMode === 'query' ? `当前 Query 下的 ${approvalEligibleCount} 条已捕获模型回答` : '当前所选模型回答'
    if (!window.confirm(`确认批准${targetLabel}吗？批准后，这些原始回答与链接会被作为可追溯证据发送到已验证的模型连接进行分析。`)) return
    try {
      setBusy(true); setError('')
      const response = await approveCompetitorQueryGroupEvidence(session, selectedQueryGroup.id, {
        observationId: scopeMode === 'observation' ? selectedObservationId : undefined,
        reviewNote: '用户在 Query 竞品分析页确认批准，用于后续受控模型分析。',
      })
      await loadProfileResources(session, profile)
      notice(response.approval.approvedCount > 0
        ? `已批准 ${response.approval.approvedCount} 条证据，链接页面分析和 Query 结论现已可用。`
        : '所选证据的状态已变化，已刷新当前 Query。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '批准当前 Query 的证据失败。') } finally { setBusy(false) }
  }
  const analyzeSelectedLink = async () => {
    if (!session || !profile || !selectedCandidate || !selectedProviderId || !selectedQueryGroupId) return
    try {
      setBusy(true); setError(''); setRunKind('page'); setRunStartedAt(Date.now())
      const response = await createCompetitorLinkPageAnalysis(session, profile.id, { candidateId: selectedCandidate.id, providerConfigurationId: selectedProviderId, queryGroupId: selectedQueryGroupId, observationId: scopeMode === 'observation' ? selectedObservationId : undefined })
      setAnalyses((current) => [response.analysis, ...current.filter((item) => item.id !== response.analysis.id)])
      notice('已在当前 Query 范围内完成所选链接的页面结构分析。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '页面链接分析失败。') } finally { setRunKind(null); setRunStartedAt(null); setBusy(false) }
  }
  const runQuerySummary = async () => {
    if (!session || !profile || !selectedProviderId || !selectedQueryGroupId) return
    try {
      setBusy(true); setError(''); setRunKind('query'); setRunStartedAt(Date.now())
      const response = await createCompetitorEvidenceAnalysis(session, profile.id, {
        scopeType: 'query-cohort', queryGroupId: selectedQueryGroupId,
        observationId: scopeMode === 'observation' ? selectedObservationId : undefined,
        providerConfigurationId: selectedProviderId, agentType: 'insight-synthesis',
      })
      setAnalyses((current) => [response.analysis, ...current.filter((item) => item.id !== response.analysis.id)])
      notice(scopeMode === 'observation' ? '已生成该模型回答的竞品结论。' : '已生成同一 Query 的跨模型竞品结论。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Query 竞品结论生成失败。') } finally { setRunKind(null); setRunStartedAt(null); setBusy(false) }
  }
  const runBaselineSummary = async () => {
    if (!session || !profile || !selectedProviderId || !selectedTestRunId) return
    try {
      setBusy(true); setError(''); setRunKind('baseline'); setRunStartedAt(Date.now())
      const response = await createCompetitorEvidenceAnalysis(session, profile.id, { scopeType: 'baseline-cohort', testRunId: selectedTestRunId, providerConfigurationId: selectedProviderId, agentType: 'insight-synthesis' })
      setAnalyses((current) => [response.analysis, ...current.filter((item) => item.id !== response.analysis.id)])
      notice('跨 Query 的首轮基线汇总已完成。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '跨模型首轮基线汇总失败。') } finally { setBusy(false) }
  }

  if (loading) return <section className="ci-loading"><LoaderCircle size={20}/> 正在加载真实平台回答、引用与研究记录…</section>

  const steps: Array<{ id: typeof tab; number: string; label: string; description: string }> = [
    { id: 'scope', number: '01', label: '研究范围', description: '确定要解释的 Query 与证据边界' },
    { id: 'evidence', number: '02', label: '证据与信源', description: '复核真实回答并选择来源页面' },
    { id: 'insights', number: '03', label: '竞品结论与机会', description: '用已批准证据生成可回溯判断' },
    { id: 'actions', number: '04', label: 'GEO 行动与交付', description: '创建 Brief、写作与复测计划' },
  ]

  return <div className="competitor-intelligence ci-research-workflow">
    <div className="ci-section-title">
      <span className="ci-eyebrow">04 行业与竞品研究</span>
      <h2>竞品与信源研究</h2>
    </div>

    <nav className="ci-flow-steps" aria-label="竞品与信源研究步骤">
      {steps.map((step) => {
        const done = (step.id === 'scope' && Boolean(selectedQueryGroup))
          || (step.id === 'evidence' && hasApprovedEvidence)
          || (step.id === 'insights' && Boolean(latestQueryAnalysis))
          || (step.id === 'actions' && gapActions.some((action) => action.analysisId === latestQueryAnalysis?.id))
        const recommended = researchStep === step.id
        return <button
          key={step.id}
          type="button"
          className={`${tab === step.id ? 'active' : ''} ${done ? 'done' : ''} ${recommended ? 'recommended' : ''}`}
          aria-current={tab === step.id ? 'step' : undefined}
          onClick={() => setTab(step.id)}
        >
          <span className="ci-step-number">{done ? <ShieldCheck size={14}/> : step.number}</span>
          <span><b>{step.label}</b><small>{step.description}</small></span>
        </button>
      })}
      <span className="ci-flow-divider" aria-hidden="true" />
      <button type="button" className={tab === 'settings' ? 'ci-settings-entry active' : 'ci-settings-entry'} onClick={() => setTab('settings')}>
        <Settings2 size={15}/><span>高级设置</span>
      </button>
    </nav>

    {error && <div className="ci-alert error" role="alert"><AlertTriangle size={16}/><span>{error}</span><button type="button" onClick={() => setError('')}>关闭</button></div>}
    {runKind && <AnalysisProgress kind={runKind} elapsedSeconds={elapsedSeconds}/>} 

    {tab === 'scope' && <section className="ci-card ci-scope-stage">
      <header className="ci-section-heading ci-stage-heading">
        <div><b className="chip blue">步骤 01</b><h3>先确定研究范围</h3><p>研究范围决定接下来哪些真实回答、链接和行动卡会被归入同一条证据链；不会重新运行 AI 平台测试。</p></div>
        <button className="secondary" type="button" onClick={() => go('baseline')}>查看真实平台测试 <ChevronRight size={14}/></button>
      </header>

      {!queryGroups.length ? <div className="ci-empty compact"><FileSearch size={18}/><b>还没有可研究的真实平台回答</b><p>请先在「真实平台测试」完成至少一个 Query 的采集并同步回答与引用链接。</p><button className="primary" type="button" onClick={() => go('baseline')}>前往真实平台测试</button></div> : <>
        <div className="ci-scope-metrics" aria-label="当前研究范围统计">
          <div><span>Query</span><b>{selectedQueryGroup ? 1 : 0}</b><small>当前问题</small></div>
          <div><span>真实回答</span><b>{scopedObservations.length}</b><small>{scopeMode === 'query' ? '跨平台范围' : '单条回答'}</small></div>
          <div><span>已复核证据</span><b>{reviewedCount}</b><small>{pendingScopedCount ? `另有 ${pendingScopedCount} 条待复核` : '可进入正式分析'}</small></div>
          <div><span>可见来源</span><b>{selectedQueryGroup?.linkCount ?? 0}</b><small>当前 Query 去重后</small></div>
        </div>

        <div className={`ci-scope-grid ${scopeMode === 'query' ? 'query-only' : ''}`}>
          <label className="ci-control-field">
            <span>研究 Query <em>决定分析对象</em></span>
            <select value={selectedQueryGroupId} onChange={(event) => selectQueryGroup(event.target.value)}>
              {queryGroups.map((group) => <option key={group.id} value={group.id}>{group.question}</option>)}
            </select>
            <small>系统只汇总这个问题下已采集的模型回答，不会混入其他 Query。</small>
          </label>
          <fieldset className="ci-scope-toggle">
            <legend>证据范围 <em>决定哪些回答被传给分析模型</em></legend>
            <button type="button" className={scopeMode === 'query' ? 'selected' : ''} aria-pressed={scopeMode === 'query'} onClick={() => setScopeMode('query')}>
              <b>同一 Query · 跨模型</b><span>比较不同平台的提及、来源与差异</span>
            </button>
            <button type="button" className={scopeMode === 'observation' ? 'selected' : ''} aria-pressed={scopeMode === 'observation'} onClick={() => setScopeMode('observation')}>
              <b>单个平台回答</b><span>只分析一个平台的一次真实回答</span>
            </button>
          </fieldset>
          {scopeMode === 'observation' && <label className="ci-control-field">
            <span>模型回答 <em>选择一条真实记录</em></span>
            <select value={selectedObservationId} onChange={(event) => setSelectedObservationId(event.target.value)}>
              {selectedQueryGroup?.observations.map((observation) => <option key={observation.observationId} value={observation.observationId}>{observation.platformLabel} · {prettyDate(observation.observedAt)} · {observation.linkCount} 条链接</option>)}
            </select>
            <small>用于定位某个平台的推荐逻辑或来源差异。</small>
          </label>}
        </div>

        <footer className="ci-stage-footer">
          <div><b>本次范围</b><span>{selectedQueryGroup?.platforms.join(' / ') || '—'} · 最近采集于 {prettyDate(selectedQueryGroup?.lastObservedAt)}</span></div>
          <button className="primary" type="button" onClick={() => setTab('evidence')} disabled={!selectedQueryGroup}>下一步：复核回答与来源 <ChevronRight size={15}/></button>
        </footer>
      </>}
    </section>}

    {tab === 'evidence' && <div className="ci-stage-stack">
      <section className="ci-card ci-evidence-stage">
        <header className="ci-section-heading ci-stage-heading">
          <div><b className="chip blue">步骤 02</b><h3>复核真实回答，选择值得研究的来源</h3><p>这里的回答和链接来自首轮测试，无需重新填写。只有批准后的原始回答与链接可进入 AI 分析，避免把未核验内容当作事实。</p></div>
          {approvalEligibleCount > 0
            ? <button className="primary" type="button" disabled={busy} onClick={() => void approveCurrentQueryEvidence()}><ShieldCheck size={15}/>复核并批准 {approvalEligibleCount} 条证据</button>
            : <span className="ci-stage-state success"><ShieldCheck size={15}/>当前范围已无待复核回答</span>}
        </header>

        {!selectedQueryGroup ? <div className="ci-empty compact"><FileSearch size={18}/><b>请先选择一个研究 Query</b><button className="secondary" type="button" onClick={() => setTab('scope')}>返回研究范围</button></div> : <div className="ci-evidence-workspace">
          <section className="ci-evidence-column">
            <header><div><b>AI 原始回答</b><span>事实证据 · {scopedObservations.length} 条</span></div><small>点击查看同步摘要与状态</small></header>
            {!scopedObservations.length ? <p className="ci-source-empty">这个范围没有已同步的模型回答。</p> : <div className="ci-observation-list">
              {scopedObservations.map((observation) => <details key={observation.observationId} open={scopeMode === 'observation' && observation.observationId === selectedObservationId}>
                <summary>
                  <span><b>{observation.platformLabel}</b><small>{prettyDate(observation.observedAt)} · {observation.rawAnswerLength} 字 · {observation.linkCount} 条链接</small></span>
                  <em className={observation.evidenceState === 'approved' ? 'approved' : 'captured'}>{evidenceStateLabel(observation.evidenceState)}</em>
                </summary>
                <p>{observation.answerPreview || '该回答未采集到可展示的正文摘要。'}</p>
                <footer>{observation.evidenceState === 'approved' ? '已批准：可用于页面深读和竞品结论。' : '待批准：可查看，但不会传给外部分析模型。'}</footer>
              </details>)}
            </div>}
          </section>

          <section className="ci-source-column">
            <header><div><b>引用与搜索来源</b><span>页面线索 · {candidates.length} 个</span></div><small>选择一个公开 URL 进行页面深读</small></header>
            {!candidates.length ? <p className="ci-source-empty">当前范围暂无可研究的来源链接。请确认真实平台测试已回传引用或搜索资料。</p> : <div className="ci-source-list">
              {candidates.map((candidate) => {
                const priority = linkPriority(candidate)
                return <button key={candidate.id} type="button" className={selectedCandidateId === candidate.id ? 'selected' : ''} onClick={() => setSelectedCandidateId(candidate.id)}>
                  <span className={`ci-source-priority ${priority.tone}`}>{priority.label}</span>
                  <strong>{candidate.title || candidate.domain}</strong>
                  <small>{candidate.domain} · {candidate.approvedOccurrenceCount} 次已批准出现 · {candidate.platforms.join(' / ') || '未标记平台'}</small>
                </button>
              })}
            </div>}
          </section>
        </div>}
      </section>

      <section className="ci-card ci-page-analysis-stage">
        <header className="ci-section-heading">
          <div><b className="chip mint">可选深读</b><h3>把一个高价值来源转成页面层证据</h3><p>页面深读仅请求你选中的公开链接；它补充页面结构与内容信号，不会将链接中的任何说法自动认定为我方产品事实。</p></div>
          <span className="ci-mini-count">已完成 {completedPageAnalysisCount} 份页面深读</span>
        </header>
        <div className="ci-page-analysis-controls">
          <div className="ci-selected-source">
            <span>已选来源</span>
            {selectedCandidate ? <><b>{selectedCandidate.title || selectedCandidate.domain}</b><small>{linkPriority(selectedCandidate).detail}</small>{selectedCandidate.directlyOpenable && <a href={selectedCandidate.url} target="_blank" rel="noreferrer">在新窗口检查 <ExternalLink size={13}/></a>}</> : <b>尚未选择来源链接</b>}
          </div>
          <label className="ci-control-field"><span>分析模型 <em>只做内部研究</em></span><select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)}><option value="">请选择已验证模型连接</option>{verifiedProviders.map((item) => <option key={item.id} value={item.id}>{item.providerId} · {item.execution?.modelName ?? '已验证连接'}</option>)}</select></label>
          <button className="secondary" type="button" onClick={() => go('connections')}>管理模型连接</button>
          <button className="primary" type="button" disabled={busy || !selectedCandidate || !selectedCandidateApproved || !selectedProviderId} onClick={() => void analyzeSelectedLink()}><FileSearch size={15}/>{runKind === 'page' ? '正在页面深读…' : '分析所选页面'}</button>
        </div>
        {!selectedProvider && <p className="ci-inline-warning"><AlertTriangle size={14}/>尚未选择已验证模型连接。请在「模型连接」完成测试后，再运行页面深读或竞品结论。</p>}
        {selectedCandidate && !selectedCandidateApproved && <p className="ci-inline-warning"><AlertTriangle size={14}/>所选链接关联的回答尚未批准。复核真实回答后，才可提交该页面给分析模型。</p>}
      </section>

      <footer className="ci-stage-footer ci-card">
        <div><b>下一步会做什么？</b><span>分析模型会只读取当前范围的已批准回答、已选来源页面深读与 Prompt 版本，输出可回溯的竞品结论。</span></div>
        <button className="primary" type="button" disabled={!hasApprovedEvidence} onClick={() => setTab('insights')}>下一步：生成竞品结论 <ChevronRight size={15}/></button>
      </footer>
    </div>}

    {tab === 'insights' && <div className="ci-stage-stack">
      <section className="ci-card ci-insights-stage">
        <header className="ci-section-heading ci-stage-heading">
          <div><b className="chip purple">步骤 03</b><h3>生成「事实 + AI 推断 + 待验证项」的竞品结论</h3><p>结论只基于当前范围已批准的真实回答与已完成的页面深读。模型输出是分析推断，不会覆盖原始回答，也不会成为未经审核的产品事实。</p></div>
          <span className={hasApprovedEvidence ? 'ci-stage-state success' : 'ci-stage-state'}>{hasApprovedEvidence ? <><ShieldCheck size={15}/>证据已就绪</> : <><AlertTriangle size={15}/>需先复核证据</>}</span>
        </header>
        <div className="ci-insight-launcher">
          <div>
            <span>分析对象</span>
            <b>{selectedQueryGroup?.question || '请先选择 Query'}</b>
            <small>{scopeMode === 'query' ? `跨模型范围 · ${reviewedCount} 条已批准回答` : `${selectedObservation?.platformLabel ?? '单条回答'} · 已批准证据`}{completedPageAnalysisCount ? ` · ${completedPageAnalysisCount} 份页面深读` : ' · 暂无页面深读（可直接生成）'}</small>
          </div>
          <label className="ci-control-field"><span>分析模型</span><select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)}><option value="">请选择已验证模型连接</option>{verifiedProviders.map((item) => <option key={item.id} value={item.id}>{item.providerId} · {item.execution?.modelName ?? '已验证连接'}</option>)}</select></label>
          <button className="primary" type="button" disabled={busy || !hasApprovedEvidence || !selectedProviderId || !selectedQueryGroupId} onClick={() => void runQuerySummary()}><Sparkles size={15}/>{runKind === 'query' ? '正在生成结论…' : '生成 Query 竞品结论'}</button>
        </div>
        <div className="ci-analysis-legend" aria-label="结论阅读说明"><span><b>事实证据</b> 原始回答、引用链接与页面深读均可回看</span><span><b>AI 推断</b> 由已验证模型基于当前范围生成</span><span><b>行动建议</b> 需人工确认后才进入内容工作流</span></div>
      </section>

      <AnalysisHistory analyses={analyses} queryGroupId={selectedQueryGroupId}/>

      <footer className="ci-stage-footer ci-card">
        <div><b>{latestQueryAnalysis ? '当前 Query 已有可追溯结论' : '生成结论后才能创建行动卡'}</b><span>{latestQueryAnalysis ? `最后完成：${prettyDate(latestQueryAnalysis.completedAt ?? latestQueryAnalysis.startedAt)} · ${latestQueryAnalysis.modelName ?? '模型信息待同步'}` : '行动卡会将每个已识别的差距拆成单独、可确认的后续工作。'}</span></div>
        <button className="primary" type="button" disabled={!latestQueryAnalysis} onClick={() => setTab('actions')}>下一步：创建 GEO 行动 <ChevronRight size={15}/></button>
      </footer>
    </div>}

    {tab === 'actions' && <div className="ci-stage-stack">
      <section className="ci-card ci-action-explainer">
        <header className="ci-section-heading ci-stage-heading"><div><b className="chip mint">步骤 04</b><h3>把经过确认的缺口接到内容与复测</h3><p>行动卡不是自动发布：每个卡片都先由人工确认，再生成 Content Brief、进入智能写作，并在实际发布后用同范围 Query 复测。</p></div></header>
        <div className="ci-action-route" aria-label="行动交付流程"><span>竞品结论</span><ChevronRight size={15}/><span>人工确认</span><ChevronRight size={15}/><span>Content Brief</span><ChevronRight size={15}/><span>智能写作 / 人工发布</span><ChevronRight size={15}/><span>同范围复测</span></div>
      </section>
      <GapActionPanel actions={gapActions} analysis={latestQueryAnalysis} busy={busy} actionBusyId={actionBusyId} publicationObservations={publicationObservations} onGenerate={() => void generateCurrentGapActions()} onStart={(actionId) => void updateGapAction(actionId, 'in-progress')} onCreateBrief={(actionId) => void createGapBrief(actionId)} onCreateRetest={(actionId) => void createGapRetest(actionId)} onContinueWriting={(action) => void continueGapActionInWriting(action)}/>
      <details className="ci-card ci-baseline-details">
        <summary><span><b>跨 Query 基线洞察（可选）</b><small>用于管理层汇总，不替代当前 Query 的竞品结论</small></span><ChevronRight size={16}/></summary>
        <div className="ci-baseline-run-panel">
          <label><span>真实平台测试批次</span><select value={selectedTestRunId} onChange={(event) => setSelectedTestRunId(event.target.value)}><option value="">请选择有已批准证据的首轮测试</option>{(overview?.testRuns ?? []).filter((item) => item.approvedCount > 0).map((item) => <option key={item.testRunId} value={item.testRunId}>{item.testRunName} · {item.approvedCount} 条已批准证据 · {item.platforms.join(' / ')}</option>)}</select></label>
          <label><span>分析模型</span><select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)}><option value="">请选择已验证模型连接</option>{verifiedProviders.map((item) => <option key={item.id} value={item.id}>{item.providerId} · {item.execution?.modelName ?? '已验证连接'}</option>)}</select></label>
          <button className="secondary" type="button" disabled={busy || !selectedTestRunId || !selectedProviderId} onClick={() => void runBaselineSummary()}><Sparkles size={15}/>{runKind === 'baseline' ? '正在汇总…' : '生成跨 Query 洞察'}</button>
        </div>
        <section className="ci-analysis-history">{!analyses.filter((analysis) => analysis.scopeType === 'baseline-cohort').length ? <p className="ci-source-empty">尚未生成跨 Query 洞察。</p> : <div className="ci-analysis-list">{analyses.filter((analysis) => analysis.scopeType === 'baseline-cohort').map((analysis) => <article key={analysis.id}><header><div><strong>跨 Query 基线洞察</strong><span>Prompt v{analysis.promptVersion ?? '—'} · {analysis.modelName ?? '未完成'}</span></div><span>{analysis.state === 'succeeded' ? '已完成' : analysis.state === 'failed' ? '失败' : '运行中'}</span></header><p className="ci-analysis-meta">{prettyDate(analysis.completedAt ?? analysis.startedAt)} · {analysis.observationIds.length} 条来源观察记录 · {analysis.evidenceSummary.platforms?.join(' / ') || '—'}</p>{analysis.state === 'succeeded' ? <PromptResult result={analysis.result}/> : <p className="ci-error-text">{analysis.errorMessage || '正在处理…'}</p>}</article>)}</div>}</section>
      </details>
    </div>}

    {tab === 'settings' && profile && <div className="ci-stage-stack">
      <section className="ci-card ci-settings-overview">
        <header className="ci-section-heading ci-stage-heading"><div><b className="chip">高级设置</b><h3>研究档案与 Prompt 版本</h3><p>研究档案用于约束分析语境，Prompt 决定模型如何整理证据。两者均不会改变真实平台测试的原始回答或运行范围。</p></div><button className="secondary" type="button" onClick={() => go('connections')}>管理模型连接</button></header>
        <div className="ci-profile-context">
          <div><span>我方品牌</span><b>{profile.selfBrandName || '未设置'}</b></div><div><span>行业 / 品类</span><b>{[profile.industry, profile.productCategory].filter(Boolean).join(' · ') || '未设置'}</b></div><div><span>目标市场</span><b>{profile.market || '未设置'}</b></div><div><span>目标受众</span><b>{profile.audiences.join(' / ') || '未设置'}</b></div><div><span>已知竞品</span><b>{profile.competitors.join(' / ') || '暂无'}</b></div><div><span>分析维度</span><b>{profile.dimensions.join(' / ') || '默认维度'}</b></div>
        </div>
      </section>

      <section className="ci-card ci-prompt-workbench">
        <header className="ci-section-heading"><div><b className="chip purple">版本管理</b><h3>分析 Prompt</h3><p>默认使用「页面结构分析」与「洞察汇总」。其他 Agent 可作为高级治理配置保留，不要求每次研究时手动维护。</p></div></header>
        <div className="ci-prompt-layout">
          <aside className="ci-prompt-sidebar">{agentTypes.map((type) => { const active = prompts.find((item) => item.agentType === type && item.status === 'active'); return <button key={type} type="button" className={selectedAgentType === type ? 'selected' : ''} onClick={() => selectAgent(type)}><div><strong>{agentLabels[type].label}</strong><span>{active ? `当前 v${active.version}` : '未发布'}</span></div><ChevronRight size={15}/></button> })}</aside>
          <section className="ci-prompt-editor"><header><b>{agentLabels[selectedAgentType].label}</b><span>{agentLabels[selectedAgentType].description}</span></header><label><span>版本名称</span><input value={promptName} onChange={(event) => setPromptName(event.target.value)} /></label><label><span>Prompt 模板</span><textarea className="ci-prompt-textarea" value={promptTemplate} onChange={(event) => setPromptTemplate(event.target.value)} /></label><div className="ci-variable-hint"><Link2 size={15}/><span>必须保留：<code>{'{{research_profile}}'}</code> <code>{'{{evidence}}'}</code> <code>{'{{output_schema}}'}</code></span></div><footer className="ci-card-footer">{selectedPrompt?.status === 'archived' ? <button className="secondary" type="button" disabled={busy} onClick={() => void restorePrompt()}><History size={15}/>从 v{selectedPrompt.version} 恢复为新版本</button> : <span>发布新版本会归档当前版本，并保留可追溯历史。</span>}<button className="primary" type="button" disabled={busy || !promptName.trim() || !promptTemplate.trim()} onClick={() => void savePrompt()}>{busy ? <LoaderCircle size={15}/> : <Save size={15}/>}发布新版本</button></footer></section>
        </div>
      </section>
    </div>}
  </div>
}
