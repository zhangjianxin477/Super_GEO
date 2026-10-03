import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, CheckCircle2, CircleDotDashed, DatabaseZap, ExternalLink, FileSearch, GitCompareArrows, LineChart, RefreshCw, ShieldCheck, TableProperties } from 'lucide-react'
import {
  getContentPublicationObservation,
  listContentPublications,
  getActiveRealSurfaceTestRun,
  listRealSurfaceTestRuns,
  listBrandDiagnostics,
  type BrandDiagnosticProjectSummary,
  type ContentPublication,
  type ContentPublicationObservation,
  type RealSurfaceTestRun,
} from './api'
import { getWorkspaceSession } from './BrandDiagnostics'
import { PlatformMentionTrend, PlatformOwnedCitationTrend } from './PlatformMentionTrend'
import { QueryPlatformHeatmap } from './QueryPlatformHeatmap'
import {
  buildVisibilityBaselineMetrics,
  displayVisibilityRate,
  platformSourceStatusLabel,
  type VisibilityBaselineMetrics,
  type VisibilityMetric,
  type VisibilityPlatformMetric,
  type VisibilityRate,
} from './visibilityMetrics'

type VisibilityBaselineProps = { go: (target: 'diagnostics' | 'baseline' | 'monitoring') => void; projectId?: string | null; onProjectChange?: (projectId: string | null) => void }

type DiagnosticModule = 'overview' | 'matrix' | 'platforms' | 'evidence'

const DIAGNOSTIC_MODULES: Array<{ id: DiagnosticModule; number: string; label: string; description: string }> = [
  { id: 'overview', number: '01', label: '总览与数据质量', description: '批次、样本与指标' },
  { id: 'matrix', number: '02', label: 'Query 可见度矩阵', description: 'Query × 平台表现' },
  { id: 'platforms', number: '03', label: '平台与趋势', description: '平台趋势与引用变化' },
  { id: 'evidence', number: '04', label: '证据与下一步', description: '证据与后续动作' },
]

const formatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })

function dateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : formatter.format(date)
}

function MetricCard({ label, metric, description, subtle }: { label: string; metric: VisibilityRate | VisibilityMetric; description: string; subtle?: string }) {
  const status = 'status' in metric ? metric.status : 'available'
  const value = status === 'available' ? displayVisibilityRate(metric) : status === 'not-applicable' ? '不适用' : '待采集'
  const denominator = metric.denominator ? `${metric.numerator}/${metric.denominator} 条有效证据` : '暂无可计入证据'
  return <article className="visibility-kpi">
    <p>{label}</p>
    <strong className={status !== 'available' ? 'metric-unavailable' : ''}>{value}</strong>
    <small>{status === 'available' ? denominator : description}</small>
    {subtle && <em>{subtle}</em>}
  </article>
}

function HorizontalBar({ label, metric, tone = 'primary', note }: { label: string; metric: VisibilityRate | VisibilityMetric; tone?: 'primary'|'teal'|'amber'; note: string }) {
  const status = 'status' in metric ? metric.status : 'available'
  const numeric = status === 'available' && metric.rate !== null
  const width = numeric && metric.rate !== null ? Math.max(3, Math.round(metric.rate * 100)) : 0
  const labelValue = status === 'available' ? displayVisibilityRate(metric) : status === 'not-applicable' ? '不适用' : '待采集'
  return <div className="visibility-bar-row">
    <div className="visibility-bar-head"><b>{label}</b><strong className={numeric ? '' : 'metric-unavailable'}>{labelValue}</strong></div>
    <div className="visibility-track" aria-label={`${label} ${labelValue}`}><i className={`visibility-fill ${tone}`} style={{ width: `${width}%` }}/></div>
    <small>{note}</small>
  </div>
}

function completenessLabel(reviewed: number, expected: number) {
  if (!expected) return '尚未创建测试任务'
  if (reviewed === expected) return '已完成并复核，可作为 T0 对照起点'
  if (!reviewed) return '尚无已复核证据，暂不能形成可用基线'
  return '基线仍在补齐中，指标仅覆盖已复核的真实回答'
}

function platformCollectionStatus(platform: VisibilityPlatformMetric) {
  if (!platform.inCurrentRun) return { label: '未纳入当前批次', tone: 'muted' }
  if (platform.reviewed === platform.expected && platform.expected > 0) return { label: '已完成复核', tone: 'success' }
  if (platform.observed > 0) return { label: platform.pendingReview ? '已回传，待复核' : '已回传，待补齐', tone: 'warning' }
  if (platform.failed === platform.expected && platform.expected > 0) return { label: '采集失败待补齐', tone: 'danger' }
  return { label: '待真实采集', tone: 'muted' }
}

function coverageMetric(metric: VisibilityRate) {
  return metric.denominator ? `${metric.numerator}/${metric.denominator}` : '—'
}

function PlatformMeasurementCoverage({ metrics, go }: { metrics: VisibilityBaselineMetrics; go: (target: 'baseline') => void }) {
  const ownedCitationLinks = metrics.platforms.reduce((total, platform) => total + platform.ownedCitationLinks, 0)
  const missingPlatforms = metrics.marketPlatforms.filter((platform) => !platform.inCurrentRun).length
  return <section className="panel visibility-coverage-panel">
    <header className="visibility-card-header">
      <div><p className="eyebrow">平台覆盖</p><h3>单平台结果与全部平台汇总</h3><p>未纳入或未回传的平台保持为空，不会被误算为 0%。</p></div>
      {missingPlatforms > 0 && <button type="button" className="secondary" onClick={() => go('baseline')}>补齐 {missingPlatforms} 个市场平台</button>}
    </header>
    <div className="visibility-coverage-summary" aria-label="全部平台真实测试汇总">
      <div><small>市场支持平台</small><b>{metrics.marketPlatforms.length} 个</b><span>中国 / 美国分别按对应市场平台目录展示</span></div>
      <div><small>当前纳入测试</small><b>{metrics.scopedPlatformCount}/{metrics.marketPlatforms.length}</b><span>仅纳入的平台才会产生 Query × 平台任务</span></div>
      <div><small>全部已纳入平台实测回答</small><b>{metrics.observed}/{metrics.expected}</b><span>真实页面已回传 / 已创建任务</span></div>
      <div><small>全部已纳入平台自有链接引用</small><b>{coverageMetric(metrics.ownedCitation)}</b><span>{ownedCitationLinks} 个已审核自有域名 URL</span></div>
    </div>
    <div className="table-scroll visibility-platform-coverage-table">
      <table>
        <thead><tr><th>平台</th><th>是否纳入</th><th>实测回答</th><th>已复核</th><th>本品牌提及</th><th>自有域名引用</th><th>当前状态</th></tr></thead>
        <tbody>{metrics.marketPlatforms.map((platform) => {
          const status = platformCollectionStatus(platform)
          return <tr key={platform.platform}><td><b>{platform.platform}</b></td><td>{platform.inCurrentRun ? '已纳入' : '未纳入'}</td><td>{platform.inCurrentRun ? `${platform.observed}/${platform.expected}` : '—'}</td><td>{platform.inCurrentRun ? `${platform.reviewed}/${platform.expected}` : '—'}</td><td>{coverageMetric(platform.mention)}</td><td>{platform.ownedCitation.denominator ? <>{coverageMetric(platform.ownedCitation)} 回答 · {platform.ownedCitationLinks} 链接</> : '—'}</td><td><span className={`status-badge ${status.tone}`}>{status.label}</span></td></tr>
        })}</tbody>
      </table>
    </div>
  </section>
}

function hasActiveBrowserCollection(runs: RealSurfaceTestRun[]) {
  return runs.some((snapshot) => snapshot.executionMode === 'browser-agent' && snapshot.tasks.some((task) => task.executionMode === 'browser-agent' && (task.agentState === 'queued' || task.agentState === 'running' || task.state === 'claimed')))
}

function sourceMetricNote(metric: VisibilityMetric) {
  if (metric.status === 'not-applicable') return '该平台本次未开启或不提供搜索来源，不能按 0% 计算。'
  if (metric.status === 'not-captured') return '已开启搜索，但采集版本未保留逐项可读的平台来源。'
  return `${metric.numerator}/${metric.denominator} 条可读取平台搜索来源中出现自有域名。`
}

function publicationStatusLabel(status: ContentPublicationObservation['status']) {
  return ({
    'not-scheduled': ['尚未安排复测', 'muted'],
    scheduled: ['复测待执行', 'warning'],
    'awaiting-evidence': ['已回传，待完成复核', 'warning'],
    ready: ['可进行前后观察', 'success'],
    'not-comparable': ['范围不可比较', 'danger'],
  } as const)[status]
}

function formatObservationRate(metric: { rate: number | null }) {
  return metric.rate === null ? '—' : `${Math.round(metric.rate * 1000) / 10}%`
}

function formatObservationDelta(delta: number | null | undefined) {
  if (delta === null || delta === undefined) return '—'
  const points = Math.round(delta * 1000) / 10
  return `${points > 0 ? '+' : ''}${points}pp`
}

function PublicationRetestObservation({ publications, publicationId, observation, loading, onChange }: {
  publications: ContentPublication[]
  publicationId: string
  observation: ContentPublicationObservation | null
  loading: boolean
  onChange: (publicationId: string) => void
}) {
  if (!publications.length) return null
  const label = observation ? publicationStatusLabel(observation.status) : ['正在读取', 'muted'] as const
  const comparison = observation?.observation
  const rows = comparison?.baseline && comparison.followUp && comparison.deltas ? [
    { label: '本品牌提及率', baseline: comparison.baseline.mentionRate, followUp: comparison.followUp.mentionRate, delta: comparison.deltas.mentionRate },
    { label: '推荐表达率', baseline: comparison.baseline.recommendationRate, followUp: comparison.followUp.recommendationRate, delta: comparison.deltas.recommendationRate },
    { label: '自有来源覆盖', baseline: comparison.baseline.ownedCitationRate, followUp: comparison.followUp.ownedCitationRate, delta: comparison.deltas.ownedCitationRate },
  ] : []
  return <section className="panel publication-observation-panel">
    <header className="publication-observation-header">
      <div><p className="eyebrow"><GitCompareArrows size={15}/>发布后同范围观察</p><h3>把内容动作回写到可验证的复测</h3><p>仅在发布登记关联的不可变 Dataset、Query 和平台范围可比较时展示前后差异。</p></div>
      <div className="publication-observation-controls"><label>已登记内容<select value={publicationId} onChange={(event) => onChange(event.target.value)} disabled={loading}>{publications.map((publication) => <option key={publication.id} value={publication.id}>{publication.channel} · {dateTime(publication.publishedAt)}</option>)}</select></label><span className={`status-badge ${label[1]}`}>{label[0]}</span></div>
    </header>
    {loading && <div className="publication-observation-pending"><CircleDotDashed className="spin" size={17}/><span>正在核对发布记录、原始基线与复测范围…</span></div>}
    {!loading && observation && rows.length > 0 && <>
      <div className="publication-observation-scope"><span>同范围：{observation.scope.targetQueryIds.length} 条关联 Query · {observation.scope.providers.length} 个平台</span><span>基线 {observation.baselineRun?.label || '—'} → 复测 {observation.followUpRun?.label || '—'}</span></div>
      <div className="publication-observation-table" role="table" aria-label="发布后同范围观察">
        <div className="publication-observation-row publication-observation-head" role="row"><span role="columnheader">指标</span><span role="columnheader">发布前基线</span><span role="columnheader">发布后复测</span><span role="columnheader">变化</span></div>
        {rows.map((row) => <div className="publication-observation-row" role="row" key={row.label}><b role="cell">{row.label}</b><span role="cell">{formatObservationRate(row.baseline)} <small>{row.baseline.numerator}/{row.baseline.denominator}</small></span><span role="cell">{formatObservationRate(row.followUp)} <small>{row.followUp.numerator}/{row.followUp.denominator}</small></span><strong className={row.delta === null ? 'is-neutral' : row.delta > 0 ? 'is-positive' : row.delta < 0 ? 'is-negative' : 'is-neutral'} role="cell">{formatObservationDelta(row.delta)}</strong></div>)}
      </div>
    </>}
    {!loading && observation && !rows.length && <div className="publication-observation-empty"><AlertTriangle size={17}/><div><b>{label[0]}</b><p>{observation.observation.limitations[0] || '当前尚不能形成可靠的前后观察。'}</p></div></div>}
    {!loading && observation && <footer className="publication-observation-boundary"><ShieldCheck size={16}/><span>{observation.boundary}</span></footer>}
  </section>
}

export function VisibilityBaseline({ go, projectId: activeProjectId = null, onProjectChange }: VisibilityBaselineProps) {
  const [projects, setProjects] = useState<BrandDiagnosticProjectSummary[]>([])
  const [projectId, setProjectId] = useState('')
  const [run, setRun] = useState<RealSurfaceTestRun | null>(null)
  const [snapshots, setSnapshots] = useState<RealSurfaceTestRun[]>([])
  const [publications, setPublications] = useState<ContentPublication[]>([])
  const [publicationId, setPublicationId] = useState('')
  const [publicationObservation, setPublicationObservation] = useState<ContentPublicationObservation | null>(null)
  const [publicationLoading, setPublicationLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [activeModule, setActiveModule] = useState<DiagnosticModule>('overview')

  const selectedProject = projects.find((project) => project.id === projectId) ?? null
  const metrics = useMemo(() => run && selectedProject ? buildVisibilityBaselineMetrics(run, selectedProject.brandName, selectedProject.website) : null, [run, selectedProject])
  const activelyCollecting = useMemo(() => hasActiveBrowserCollection(run ? [run] : []), [run])

  const load = async (requestedProjectId?: string, refresh = false, silent = false) => {
    if (refresh && !silent) setRefreshing(true)
    else if (!silent) setLoading(true)
    if (!silent) setError('')
    try {
      const session = await getWorkspaceSession()
      // Publications do not yet retain a durable project/case key. Never show a
      // workspace-wide publication under the selected product as if it belonged to it.
      setPublications([])
      setPublicationId('')
      setPublicationObservation(null)
      setPublicationLoading(false)

      let nextProjects = projects
      if (!projects.length || !requestedProjectId) {
        const response = await listBrandDiagnostics(session)
        nextProjects = response.projects
        setProjects(nextProjects)
      }
      const nextProjectId = requestedProjectId ?? (activeProjectId || projectId || nextProjects[0]?.id || '')
      setProjectId(nextProjectId)
      if (!nextProjectId) { setRun(null); setSnapshots([]); return }
      // 03 only reads the project’s explicit current batch from 02. History is
      // retained for later trend views, but never decides the diagnostic source.
      const [activeResponse, historyResponse] = await Promise.all([
        getActiveRealSurfaceTestRun(session, nextProjectId),
        listRealSurfaceTestRuns(session, nextProjectId),
      ])
      setSnapshots(historyResponse.testRuns)
      setRun(activeResponse.testRun)
      setUpdatedAt(new Date())
    } catch (issue) {
      if (!silent) {
        setError(issue instanceof Error ? issue.message : '读取首轮基线数据失败，请稍后重试。')
        setRun(null)
      }
    } finally {
      if (!silent) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  useEffect(() => { void load(activeProjectId ?? undefined) // Initial dashboard load uses the current workspace session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Five-second polling is reserved for an active, authorized Browser Agent batch.
    // Completed baselines stay stable and refresh only after a real evidence change or a manual request.
    if (!activelyCollecting) return
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(projectId || undefined, false, true)
    }, 5000)
    return () => window.clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, activelyCollecting])

  useEffect(() => {
    setActiveModule('overview')
  }, [projectId])

  useEffect(() => {
    if (!activeProjectId || activeProjectId === projectId || !projects.some((project) => project.id === activeProjectId)) return
    setProjectId(activeProjectId)
    void load(activeProjectId, true)
  }, [activeProjectId, projectId, projects])

  const selectProject = (nextProjectId: string) => { setProjectId(nextProjectId); onProjectChange?.(nextProjectId || null); void load(nextProjectId, true) }
  const selectPublication = async (nextPublicationId: string) => {
    setPublicationId(nextPublicationId); setPublicationLoading(true)
    try {
      const session = await getWorkspaceSession()
      const response = await getContentPublicationObservation(session, nextPublicationId)
      setPublicationObservation(response.observation)
    } catch { setPublicationObservation(null) } finally { setPublicationLoading(false) }
  }

  return <section className="visibility-baseline-page">
    <section className="visibility-toolbar" aria-label="诊断范围控制">
      <div className="visibility-toolbar-title">
        <p className="eyebrow"><LineChart size={15}/>03 GEO 诊断与基线</p>
        <h2>诊断项目</h2>
      </div>
      <div className="visibility-toolbar-actions">
        <label>选择项目<select value={projectId} onChange={(event) => selectProject(event.target.value)} disabled={loading || !projects.length}>{projects.length ? projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>) : <option>读取项目中…</option>}</select></label>
        <div className={`visibility-live-state ${activelyCollecting ? 'is-live' : 'is-idle'}`}><i/><span>{activelyCollecting ? '采集中 · 静默同步' : '基线数据已稳定'}</span><small>{activelyCollecting ? (updatedAt ? `上次读取 ${formatter.format(updatedAt)}` : '正在连接真实平台采集') : (updatedAt ? `上次读取 ${formatter.format(updatedAt)}` : '等待首轮真实平台证据')}</small></div>
        <button type="button" className="secondary" disabled={loading || refreshing} onClick={() => void load(projectId, true)}>{refreshing ? <CircleDotDashed className="spin" size={16}/> : <RefreshCw size={16}/>}刷新</button>
      </div>
    </section>

    {error && <div className="visibility-alert error"><AlertTriangle size={18}/><span><b>无法读取首轮基线</b>{error}</span><button type="button" onClick={() => void load(projectId, true)}>重试</button></div>}
    {loading && <section className="visibility-loading panel"><CircleDotDashed className="spin" size={20}/><span>正在连接核心 Query 与首轮真实平台数据…</span></section>}

    {!loading && !error && !selectedProject && <section className="visibility-empty panel"><FileSearch size={28}/><h3>还没有可用的品牌诊断项目</h3><p>先完成项目档案和核心 Query 配置，再启动首轮真实平台测试。</p><button type="button" className="primary" onClick={() => go('diagnostics')}>前往项目概览</button></section>}

    {!loading && !error && selectedProject && !run && <section className="visibility-empty panel"><DatabaseZap size={28}/><h3>尚未创建当前真实平台测试</h3><p>请先在 02「真实平台测试」为“{selectedProject.name}”创建并运行当前批次；采集回传与审批后，03 会自动更新，无需手动同步。</p><button type="button" className="primary" onClick={() => go('baseline')}>前往真实平台测试</button></section>}
    {!loading && !error && selectedProject && run && metrics && <>
      <nav className="visibility-module-nav" aria-label="GEO 诊断模块">
        {DIAGNOSTIC_MODULES.map((module) => <button key={module.id} type="button" className={activeModule === module.id ? 'active' : ''} aria-current={activeModule === module.id ? 'page' : undefined} onClick={() => setActiveModule(module.id)}>
          <span className="visibility-module-number">{module.number}</span><span><b>{module.label}</b><small>{activeModule === module.id ? module.description : module.number}</small></span>
        </button>)}
      </nav>

      {activeModule === 'overview' && <>


      <section className="visibility-kpi-grid">
        <MetricCard label="本品牌提及率" metric={metrics.mention} description={`已审核回答中出现当前项目品牌「${selectedProject.brandName}」的比例；不等于推荐或引用自有链接。`} />
        <MetricCard label="推荐表达率" metric={metrics.recommendation} description="仅按回答中品牌邻近的推荐表达做规则初筛，需回看原始证据。" subtle="规则初筛" />
        <MetricCard label="本品牌自有域名引用率" metric={metrics.ownedCitation} description="已审核回答正文引用当前项目已配置自有域名的比例。" />
        <MetricCard label="平台来源收录率" metric={metrics.platformSource} description={sourceMetricNote(metrics.platformSource)} />
      </section>




      <PlatformMeasurementCoverage metrics={metrics} go={go} />
      </>}

      {activeModule === 'evidence' && <>
      <PublicationRetestObservation publications={publications} publicationId={publicationId} observation={publicationObservation} loading={publicationLoading} onChange={(nextPublicationId) => void selectPublication(nextPublicationId)} />
      </>}

      {activeModule === 'platforms' && <>
      <section className="visibility-trend-grid">
        <PlatformMentionTrend snapshots={snapshots} baselineRun={run} brandName={selectedProject.brandName} />
        <PlatformOwnedCitationTrend snapshots={snapshots} baselineRun={run} ownWebsite={selectedProject.website} />
      </section>
      </>}

      {activeModule === 'matrix' && <>
      <QueryPlatformHeatmap run={run} brandName={selectedProject.brandName} ownWebsite={selectedProject.website} />
      </>}

      {activeModule === 'platforms' && <>
      <section className="visibility-analysis-grid">
        <article className="panel visibility-chart-card"><header><div><p className="eyebrow">平台对比</p><h3>各平台的本品牌可见度与自有引用</h3></div><span>仅统计已审核证据</span></header>{metrics.platforms.length ? <div className="visibility-platform-chart">{metrics.platforms.map((platform) => <div className="visibility-platform-row" key={platform.platform}><div className="visibility-platform-label"><b>{platform.platform}</b><small>{platform.reviewed}/{platform.expected} 已复核</small></div><div><HorizontalBar label="本品牌提及" metric={platform.mention} note={`${platform.mention.numerator}/${platform.mention.denominator || 0} 条有效回答`} /><HorizontalBar label="自有域名引用" metric={platform.ownedCitation} tone="teal" note={`${platform.ownedCitation.numerator}/${platform.ownedCitation.denominator || 0} 条正文引用出现自有域名`} /></div></div>)}</div> : <p className="empty-inline">当前批次没有平台任务。</p>}</article>
        <article className="panel visibility-quality-card"><header><div><p className="eyebrow">数据质量</p><h3>先确认样本是否可比较</h3></div><ShieldCheck size={20}/></header><HorizontalBar label="复核完成度" metric={metrics.completeness} note={completenessLabel(metrics.reviewed, metrics.expected)} /><dl><div><dt>待审核 / 待修订</dt><dd>{metrics.submitted + metrics.needsRevision} 条</dd></div><div><dt>采集失败</dt><dd>{metrics.failed} 条</dd></div><div><dt>可用真实证据</dt><dd>{metrics.usableEvidence} 条</dd></div></dl><div className="visibility-boundary"><ShieldCheck size={16}/><span>正式指标只计入已复核真实回答；待审核、失败、未采集不被静默当作“未提及”。</span></div></article>
      </section>
      </>}

      {activeModule === 'evidence' && <>
      <section className="panel visibility-query-card">
        <header className="visibility-card-header"><div><p className="eyebrow"><TableProperties size={15}/>核心 Query × 平台</p><h3>从每个问题追溯到基线证据</h3><p>每一行对应首轮核心 Query 在各平台的实际任务状态。点击证据工作区可查看原始回答、正文引用与平台搜索来源的区分。</p></div><button type="button" className="secondary" onClick={() => go('baseline')}><ExternalLink size={16}/>查看原始证据</button></header>
        <div className="table-scroll visibility-query-table"><table><thead><tr><th>核心 Query</th><th>平台</th><th>复核</th><th>本品牌提及</th><th>自有域名引用</th><th>平台来源</th><th>状态</th></tr></thead><tbody>{metrics.queries.map((query, index) => { const state = query.reviewed === query.expected ? '已复核' : query.reviewed ? '部分完成' : query.pendingReview ? '待复核' : query.failed ? '需处理失败' : '待采集'; return <tr key={query.queryId}><td><span className="query-seq">Q{index + 1}</span><div className="query-cell"><b>{query.question}</b><small>{query.intent}</small></div></td><td>{query.platforms.join('、')}</td><td>{query.reviewed}/{query.expected}</td><td>{displayVisibilityRate(query.mention)}</td><td>{displayVisibilityRate(query.ownedCitation)}</td><td>{platformSourceStatusLabel(query.platformSource)}</td><td><span className={`status-badge ${state === '已复核' ? 'success' : state === '部分完成' ? 'warning' : 'muted'}`}>{state}</span></td></tr> })}</tbody></table></div>
      </section>

      <section className="visibility-next panel"><div><BarChart3 size={22}/><span><b>下一步：完成同口径的复测，才开始看趋势</b><small>首轮基线不是“每天自动跑出的分数”。建议为高价值 Query 建立受控复测批次，并保持核心 Query、市场、平台与采集方法可比较。</small></span></div><div><button type="button" className="secondary" onClick={() => go('monitoring')}>设置持续监控</button><button type="button" className="primary" onClick={() => go('baseline')}>补齐首轮证据</button></div></section>
      </>}
    </>}
  </section>
}







