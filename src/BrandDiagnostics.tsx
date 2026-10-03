import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, ClipboardCheck, Database, FileCheck2, Globe2, LoaderCircle, LockKeyhole, Network, Plus, RefreshCw, ShieldCheck, Sparkles, Target, Trash2, Upload, X } from 'lucide-react'
import { ApiClientError, createBrandDiagnostic, createBrandDiagnosticFact, deleteBrandDiagnostic, developmentBootstrap, freezeBrandDiagnosticBaseline, getBrandDiagnostic, listBrandDiagnostics, reviewBrandDiagnosticFact, saveBrandDiagnosticCollectionPlan, saveBrandDiagnosticScope, updateBrandDiagnostic, type BrandDiagnosticDetail, type BrandDiagnosticInput, type BrandDiagnosticProjectSummary, type BrandDiagnosticFact, type WorkspaceSession } from './api'
import { ActionableDiagnosticLauncher } from './ActionableDiagnosticLauncher'

const sessionKey = 'geo-compass.brand-diagnostic.session.v1'
let bootPromise: Promise<WorkspaceSession> | null = null

const splitValues = (value: string) => value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean)
const shortDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const statusLabel: Record<string, string> = { draft: '可冻结', 'facts-pending': '待事实审核', 'query-pending': '待 Query Scope', 'plan-pending': '待测试计划', 'waiting-collection': '等待采集', collecting: '采集中', 'evidence-pending': '待证据审核', 'baseline-complete': '基线完成', 'actions-ready': '已有行动建议', archived: '已归档' }

export function getWorkspaceSession() {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    const raw = window.localStorage.getItem(sessionKey)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<WorkspaceSession>
        if (parsed.workspaceId && parsed.userId) return parsed as WorkspaceSession
      } catch {
        // Fall through and create a fresh local demo workspace.
      }
      window.localStorage.removeItem(sessionKey)
    }
    const created = await developmentBootstrap()
    const session: WorkspaceSession = { workspaceId: created.sample.workspace.id, userId: created.sample.administrator.id, userName: created.sample.administrator.name }
    window.localStorage.setItem(sessionKey, JSON.stringify(session))
    return session
  })().catch((error) => {
    bootPromise = null
    throw error
  })
  return bootPromise
}

/**
 * Creates the local demo identity used by the landing-page login.
 * This is intentionally not real authentication; the API bootstrap still creates
 * a real workspace/session so the demo can use every workspace module.
 */
export async function createDemoWorkspaceSession(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const raw = window.localStorage.getItem(sessionKey)
  if (raw) {
    try {
      const existing = JSON.parse(raw) as Partial<WorkspaceSession>
      if (existing.workspaceId && existing.userId) {
        const session: WorkspaceSession = { ...existing, userName: normalizedEmail } as WorkspaceSession
        window.localStorage.setItem(sessionKey, JSON.stringify(session))
        bootPromise = Promise.resolve(session)
        return session
      }
    } catch {
      window.localStorage.removeItem(sessionKey)
    }
  }
  const created = await developmentBootstrap()
  const session: WorkspaceSession = { workspaceId: created.sample.workspace.id, userId: created.sample.administrator.id, userName: normalizedEmail }
  window.localStorage.setItem(sessionKey, JSON.stringify(session))
  bootPromise = Promise.resolve(session)
  return session
}

export function clearWorkspaceSession() {
  window.localStorage.removeItem(sessionKey)
  bootPromise = null
}
export function BrandDiagnostics({ goToWorkflow, startCreate = false, onExitCreate, activeProjectId = null, onActiveProjectChange, onProjectsChange }: { goToWorkflow: (target: string) => void; startCreate?: boolean; onExitCreate?: () => void; activeProjectId?: string | null; onActiveProjectChange?: (project: BrandDiagnosticProjectSummary | null) => void; onProjectsChange?: (projects: BrandDiagnosticProjectSummary[]) => void }) {
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  const [projects, setProjects] = useState<BrandDiagnosticProjectSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<BrandDiagnosticDetail | null>(null)
  const [phase, setPhase] = useState<'loading'|'ready'|'error'>('loading')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; brandName: string } | null>(null)
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [feedback, setFeedback] = useState('')
  const initialized = useRef(false)

  const refreshProject = async (active: WorkspaceSession, id: string) => {
    const [list, response] = await Promise.all([listBrandDiagnostics(active), getBrandDiagnostic(active, id)])
    setProjects(list.projects)
    onProjectsChange?.(list.projects)
    const selected = list.projects.find((project) => project.id === id) ?? null
    onActiveProjectChange?.(selected)
    setSelectedId(id)
    setDetail(response.project)
  }

  const load = async (currentSession?: WorkspaceSession, preferredId?: string | null) => {
    const active = currentSession ?? session
    if (!active) return
    const next = (await listBrandDiagnostics(active)).projects
    setProjects(next)
    onProjectsChange?.(next)
    // The global current-project selector sets the data boundary, not a
    // forced detail view. Keep the project center readable and mark the active row.
    if (!selectedId) setDetail(null)
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void (async () => {
      try {
        const active = await getWorkspaceSession()
        setSession(active)
        await load(active, activeProjectId)
        setPhase('ready')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '项目中心加载失败。')
        setPhase('error')
      }
    })()
  }, [])

  useEffect(() => {
    if (startCreate) setCreating(true)
  }, [startCreate])

  useEffect(() => {
    if (!activeProjectId || detail?.project.id === activeProjectId || selectedId === activeProjectId) return
    if (projects.some((project) => project.id === activeProjectId)) setSelectedId(activeProjectId)
  }, [activeProjectId, detail?.project.id, projects, selectedId])

  const openProject = async (id: string) => {
    if (!session) return
    try {
      setError('')
      await refreshProject(session, id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法打开项目。')
    }
  }

  const requestDelete = (project: { id: string; name: string; brandName: string }) => {
    setDeleteTarget(project)
    setDeleteConfirmationName('')
    setDeleteError('')
  }

  const confirmDelete = async () => {
    if (!session || !deleteTarget || deleteConfirmationName !== deleteTarget.name) return
    try {
      setDeleteBusy(true)
      setDeleteError('')
      await deleteBrandDiagnostic(session, deleteTarget.id, deleteConfirmationName)
      const nextProjects = projects.filter((project) => project.id !== deleteTarget.id)
      setProjects(nextProjects)
      onProjectsChange?.(nextProjects)
      const nextActive = nextProjects.find((project) => project.id === activeProjectId) ?? nextProjects[0] ?? null
      onActiveProjectChange?.(nextActive)
      setSelectedId(null)
      setDetail(null)
      setFeedback(`已永久删除「${deleteTarget.name}」。`)
      setDeleteTarget(null)
      setDeleteConfirmationName('')
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : '删除失败，请稍后重试。')
    } finally {
      setDeleteBusy(false)
    }
  }

  const reload = async () => {
    if (!session) return
    try {
      setError('')
      if (selectedId) await refreshProject(session, selectedId)
      else await load(session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '刷新失败。')
    }
  }

  const retry = () => {
    setPhase('loading')
    initialized.current = false
    bootPromise = null
    void getWorkspaceSession().then(async (active) => {
      setSession(active)
      await load(active, activeProjectId)
      setPhase('ready')
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : '刷新失败。')
      setPhase('error')
    })
  }

  if (phase === 'loading') return <section className="diagnostic-loading"><LoaderCircle className="spin" size={22}/><div><b>正在加载项目设置与产品档案</b><span>连接本地 API；不自动登录或抓取第三方模型。</span></div></section>
  if (phase === 'error') return <section className="diagnostic-error" role="alert"><AlertTriangle size={22}/><div><b>无法加载项目设置与产品档案</b><span>{error}</span></div><button className="primary" onClick={retry}><RefreshCw size={15}/>重试</button></section>
  const deleteDialog = <DeleteProjectDialog target={deleteTarget} confirmationName={deleteConfirmationName} busy={deleteBusy} error={deleteError} onChange={setDeleteConfirmationName} onCancel={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteConfirmationName(''); setDeleteError('') } }} onConfirm={() => void confirmDelete()} />
  if (creating) return <ActionableDiagnosticLauncher session={session!} onCancel={() => { setCreating(false); onExitCreate?.() }} onCreated={async (id) => { setCreating(false); await refreshProject(session!, id) }} onHarness={() => goToWorkflow('harness')} />
  if (detail) return <>{deleteDialog}<DiagnosticDetail detail={detail} session={session!} onBack={() => { setSelectedId(null); setDetail(null); onExitCreate?.() }} onRefresh={reload} onDelete={() => requestDelete({ id: detail.project.id, name: detail.project.name, brandName: detail.project.brandName })} goToWorkflow={goToWorkflow} /></>
  return <>{deleteDialog}<DiagnosticCenter projects={projects} activeProjectId={activeProjectId} feedback={feedback} onOpen={(id) => void openProject(id)} onDelete={requestDelete} onNew={() => setCreating(true)} onRefresh={() => void reload()} /></>
}

function DeleteProjectDialog({ target, confirmationName, busy, error, onChange, onCancel, onConfirm }: { target: { id: string; name: string; brandName: string } | null; confirmationName: string; busy: boolean; error: string; onChange: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  if (!target) return null
  const confirmed = confirmationName === target.name
  return <div className="delete-dialog-backdrop" role="presentation"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-project-title"><div className="delete-dialog-icon"><AlertTriangle size={21}/></div><div><small>不可撤销操作</small><h3 id="delete-project-title">永久删除「{target.name}」？</h3><p>将删除此项目关联的品牌事实、Query 数据集、测试批次，以及已保存的回答和引用证据。其他项目与工作区设置不会受影响。</p></div><label className="delete-confirm-field">请输入项目名称确认：<b>{target.name}</b><input autoFocus value={confirmationName} onChange={(event) => onChange(event.target.value)} placeholder="完整输入项目名称" aria-label="输入项目名称确认永久删除" disabled={busy}/></label>{error && <div className="delete-dialog-error" role="alert"><AlertTriangle size={15}/>{error}</div>}<div className="delete-dialog-actions"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>取消</button><button type="button" className="danger-button" onClick={onConfirm} disabled={!confirmed || busy}>{busy ? <LoaderCircle className="spin" size={15}/> : <Trash2 size={15}/>}永久删除项目</button></div></section></div>
}

function DiagnosticCenter({ projects, activeProjectId, feedback, onOpen, onDelete, onNew, onRefresh }: { projects: BrandDiagnosticProjectSummary[]; activeProjectId: string | null; feedback: string; onOpen: (id: string) => void; onDelete: (project: { id: string; name: string; brandName: string }) => void; onNew: () => void; onRefresh: () => void }) {
  return <section className="diagnostic-center">
    {feedback && <div className="project-feedback" role="status"><CheckCircle2 size={16}/>{feedback}</div>}
    <header className="project-list-header project-list-toolbar">
      <div><b>产品项目</b><span>{projects.length} 个项目 · 按最近更新排序</span></div>
      <div className="project-list-heading-actions">
        <button className="secondary" type="button" onClick={onRefresh}><RefreshCw size={15}/>刷新</button>
        <button className="primary" type="button" onClick={onNew}><Plus size={16}/>新建产品档案</button>
      </div>
    </header>
    <div className="project-rows">{projects.length ? projects.map((project) => <article className={project.id === activeProjectId ? 'project-row is-active-project' : 'project-row'} key={project.id}><button type="button" className="project-row-main" onClick={() => onOpen(project.id)} aria-label={`打开项目 ${project.name}`}><div className="project-brand"><span className="brand-monogram">{project.brandName.slice(0, 1)}</span><div><strong>{project.name}</strong>{project.id === activeProjectId && <em className="active-project-badge">当前项目</em>}<small>{project.brandName} · {project.markets.join(' / ')} · {project.locales.join(' / ')}</small></div></div><div className="project-cell"><span>当前阶段</span><b className={'status-pill status-' + project.status}>{statusLabel[project.status] ?? project.status}</b></div><div className="project-cell"><span>Query 数据集</span><b>{project.queryScope ? `${project.queryScope.expectedCount} 条 · ${project.queryScope.datasetVersionLabel}` : '尚未定义'}</b></div><div className="project-cell"><span>测试覆盖</span><b>{project.coverage.status === 'pending-evidence' ? '等待证据导入' : '—'}</b></div><div className="project-next"><span>{project.blockers[0] ? '阻塞原因' : '下一步'}</span><b>{project.nextAction.label}</b></div><ChevronRight size={18}/></button><button type="button" className="project-delete-button" onClick={() => onDelete(project)} aria-label={`删除项目 ${project.name}`} title="永久删除项目"><Trash2 size={16}/><span>删除</span></button></article>) : <div className="project-empty-state"><span><Target size={20}/></span><div><b>还没有产品项目</b><p>先新建一个产品档案，系统才会建立后续 Query、平台测试和可见度基线的归属范围。</p></div><button className="primary" type="button" onClick={onNew}><Plus size={15}/>新建产品档案</button></div>}</div>
  </section>
}
function DiagnosticWizard({ session, onCancel, onCreated }: { session: WorkspaceSession; onCancel: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState(1); const [caseId, setCaseId] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', brandName: '', website: '', markets: '中国, 美国', locales: 'zh-CN, en-US', audiences: '出海 SaaS 团队, 企业知识库负责人, AI 产品负责人', objective: '', deliveryDate: '' })
  const [fact, setFact] = useState({ statement: '', category: '产品能力', sourceLabel: '', sourceUrl: '' })
  const [scope, setScope] = useState({ journeys: '发现与品类筛选, 工具比较, 采购评估', queryTypes: '品类发现, 能力评估, 竞品对比, 问题解决', competitorSeeds: 'Notion, Guru, Glean', expectedCount: '100', datasetVersionLabel: 'v0.1 待审核' })
  const [plan, setPlan] = useState({ providers: 'DeepSeek, 通义千问, 豆包, Kimi, ChatGPT, Gemini, Claude, Perplexity', frequency: '首轮一次；基线后每月复测', failurePolicy: '记录失败原因，保留原始导出，由分析师人工补录。' })
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const next = async () => {
    try {
      setBusy(true); setError('')
      if (step === 1) { const response = await createBrandDiagnostic(session, { name: form.name, brandName: form.brandName, website: form.website, markets: splitValues(form.markets), locales: splitValues(form.locales), audiences: splitValues(form.audiences), objective: form.objective, ownerId: session.userId, deliveryDate: form.deliveryDate || null }); setCaseId(response.project.project.id) }
      if (step === 2 && caseId) await createBrandDiagnosticFact(session, caseId, { statement: fact.statement, category: fact.category, appliesToMarkets: splitValues(form.markets), sourceLabel: fact.sourceLabel, sourceUrl: fact.sourceUrl || null, status: 'candidate', isProhibitedClaim: false })
      if (step === 3 && caseId) await saveBrandDiagnosticScope(session, caseId, { journeys: splitValues(scope.journeys), queryTypes: splitValues(scope.queryTypes), markets: splitValues(form.markets), locales: splitValues(form.locales), competitorSeeds: splitValues(scope.competitorSeeds), expectedCount: Number(scope.expectedCount), datasetVersionLabel: scope.datasetVersionLabel })
      if (step === 4 && caseId) await saveBrandDiagnosticCollectionPlan(session, caseId, { providers: splitValues(plan.providers), collectionMode: 'controlled-manual', frequency: plan.frequency, failurePolicy: plan.failurePolicy })
      if (step < 5) setStep((current) => current + 1)
      else if (caseId) onCreated(caseId)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法保存此步骤，请检查填写内容。') } finally { setBusy(false) }
  }
  return <section className="diagnostic-wizard"><header className="wizard-shell-header"><button className="back" onClick={onCancel}><ArrowLeft size={15}/>返回项目中心</button><div><small>新建产品档案</small><h2>先建立可审核的范围，再开始测试</h2></div><span className="wizard-mode"><LockKeyhole size={14}/>草稿自动保存</span></header><ol className="diagnostic-stepper">{['目标与范围','品牌事实与来源','Query Scope','测试计划','口径确认'].map((label, index) => <li key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}><i>{step > index + 1 ? <Check size={14}/> : index + 1}</i><span>{label}</span></li>)}</ol><div className="wizard-canvas">
    {step === 1 && <><WizardIntro title="诊断目标与项目范围" text="这一步只定义本次诊断的业务问题、市场边界与负责人；不在这里配置模型执行。"/><div className="form-grid two"><Field label="诊断名称" value={form.name} onChange={(value) => update('name', value)} placeholder="例如：知识库工具类目 · 中美首轮基线"/><Field label="品牌 / 产品名称" value={form.brandName} onChange={(value) => update('brandName', value)} placeholder="例如：Acme Knowledge"/><Field label="官网地址" value={form.website} onChange={(value) => update('website', value)} placeholder="https://…"/><Field label="预计交付日期（可选）" value={form.deliveryDate} onChange={(value) => update('deliveryDate', value)} placeholder="2026-10-16"/><Field label="目标市场（逗号分隔）" value={form.markets} onChange={(value) => update('markets', value)} /><Field label="市场语言（逗号分隔）" value={form.locales} onChange={(value) => update('locales', value)} /><Field label="目标客户（逗号分隔）" value={form.audiences} onChange={(value) => update('audiences', value)} /><Field wide label="业务目标" value={form.objective} onChange={(value) => update('objective', value)} placeholder="例如：确定高价值问题的品牌可见度与内容切入点。"/></div></>}
    {step === 2 && <><WizardIntro title="品牌事实与证据包" text="系统先记录候选事实。创建后需要审核通过，才可进入可比较的基线。"/><div className="form-grid two"><Field wide label="事实陈述" value={fact.statement} onChange={(value) => setFact((current) => ({ ...current, statement: value }))} placeholder="只写可被来源核验的产品事实；不要写增长承诺。"/><Field label="事实类别" value={fact.category} onChange={(value) => setFact((current) => ({ ...current, category: value }))}/><Field label="来源名称" value={fact.sourceLabel} onChange={(value) => setFact((current) => ({ ...current, sourceLabel: value }))} placeholder="官网产品说明 / Help Center"/><Field wide label="来源链接（可选）" value={fact.sourceUrl} onChange={(value) => setFact((current) => ({ ...current, sourceUrl: value }))} placeholder="https://…"/></div><div className="wizard-boundary"><ShieldCheck size={17}/><span><b>审核边界</b>候选事实不会自动成为对外交付结论，也不会直接用于内容生成。</span></div></>}
    {step === 3 && <><WizardIntro title="Query Scope" text="定义用户旅程与候选范围；完整 Query 的生成、聚类和审核会在下一层 Query 研究中完成。"/><div className="form-grid two"><Field label="用户旅程（逗号分隔）" value={scope.journeys} onChange={(value) => setScope((current) => ({ ...current, journeys: value }))}/><Field label="Query 类型（逗号分隔）" value={scope.queryTypes} onChange={(value) => setScope((current) => ({ ...current, queryTypes: value }))}/><Field label="竞品种子词（逗号分隔）" value={scope.competitorSeeds} onChange={(value) => setScope((current) => ({ ...current, competitorSeeds: value }))}/><Field label="首轮候选数量（20–200）" value={scope.expectedCount} onChange={(value) => setScope((current) => ({ ...current, expectedCount: value }))}/><Field wide label="Dataset 版本标签" value={scope.datasetVersionLabel} onChange={(value) => setScope((current) => ({ ...current, datasetVersionLabel: value }))}/></div></>}
    {step === 4 && <><WizardIntro title="测试计划与采集方式" text="当前 MVP 的正式路径是“受控人工导出 / 人工录入”；系统不会登录 AI 网站或绕过访问限制。"/><div className="form-grid two"><Field wide label="目标模型 / 平台（逗号分隔）" value={plan.providers} onChange={(value) => setPlan((current) => ({ ...current, providers: value }))}/><Field label="采集方式" value="受控人工导入（MVP）" onChange={() => undefined} readOnly/><Field label="复测频率" value={plan.frequency} onChange={(value) => setPlan((current) => ({ ...current, frequency: value }))}/><Field wide label="失败处理策略" value={plan.failurePolicy} onChange={(value) => setPlan((current) => ({ ...current, failurePolicy: value }))}/></div></>}
    {step === 5 && <><WizardIntro title="口径确认与创建项目" text="创建后请在“品牌事实与来源”审核候选事实；全部条件满足时才可冻结基线。"/><div className="review-grid"><Review icon={<Target size={17}/>} label="范围" text={`${form.brandName || '未命名品牌'} · ${splitValues(form.markets).join(' / ') || '未定义市场'}`}/><Review icon={<FileCheck2 size={17}/>} label="事实" text="首条事实以候选状态保存，待人工审核。"/><Review icon={<Network size={17}/>} label="Query Scope" text={`${scope.expectedCount || '—'} 条候选 · ${scope.datasetVersionLabel || '未标注版本'}`}/><Review icon={<Upload size={17}/>} label="采集" text="受控人工导入 · 不自动操作第三方模型网页"/></div><div className="wizard-boundary warning"><AlertTriangle size={17}/><span><b>尚未生成任何表现指标</b>创建项目不会自动产生曝光、提及、引用率或竞品结论；这些必须依赖后续导入并审核的原始证据。</span></div></>}
  </div><footer className="wizard-footer"><span>{error && <em role="alert">{error}</em>}</span><div>{step > 1 && <button className="secondary" onClick={() => setStep((current) => current - 1)} disabled={busy}>上一步</button>}<button className="primary" onClick={() => void next()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : step === 5 ? <CheckCircle2 size={16}/> : null}{step === 5 ? '创建产品档案' : '保存并继续'}{step < 5 && <ArrowRight size={15}/>}</button></div></footer></section>
}

function DiagnosticDetail({ detail, session, onBack, onRefresh, onDelete, goToWorkflow }: { detail: BrandDiagnosticDetail; session: WorkspaceSession; onBack: () => void; onRefresh: () => void; onDelete: () => void; goToWorkflow: (target: string) => void }) {
  const [tab, setTab] = useState('overview'); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [factText, setFactText] = useState('')
  const active = () => { const blocker = detail.readiness.blockers[0]; if (blocker) setTab(blocker.tab); else setTab('baseline') }
  const approve = async (fact: BrandDiagnosticFact) => { try { setBusy(true); await reviewBrandDiagnosticFact(session, detail.project.id, fact.id, 'approved', '已核验原始来源并准备用于基线证据包。'); await onRefresh() } catch (cause) { setError(cause instanceof Error ? cause.message : '审核失败。') } finally { setBusy(false) } }
  const addCandidate = async () => { try { setBusy(true); await createBrandDiagnosticFact(session, detail.project.id, { statement: factText, category: '产品能力', appliesToMarkets: detail.project.markets, sourceLabel: '待补充来源', sourceUrl: null, status: 'candidate', isProhibitedClaim: false }); setFactText(''); await onRefresh() } catch (cause) { setError(cause instanceof Error ? cause.message : '新建事实失败。') } finally { setBusy(false) } }
  const freeze = async () => { try { setBusy(true); await freezeBrandDiagnosticBaseline(session, detail.project.id); await onRefresh(); setTab('baseline') } catch (cause) { setError(cause instanceof Error ? cause.message : '无法冻结基线。') } finally { setBusy(false) } }
  return <section className="diagnostic-detail"><header className="detail-header"><button className="back" onClick={onBack}><ArrowLeft size={15}/>返回全部产品项目</button><div className="detail-title"><span className="brand-monogram">{detail.project.brandName.slice(0, 1)}</span><div><div className="detail-meta"><small>产品档案 · {detail.project.markets.join(' / ')} · {detail.project.locales.join(' / ')}</small><b className={'status-pill status-' + detail.project.status}>{statusLabel[detail.project.status] ?? detail.project.status}</b></div><h2>{detail.project.name}</h2><p>{detail.project.objective}</p></div></div><div className="detail-actions"><button className="secondary" onClick={onRefresh}><RefreshCw size={15}/>刷新</button><button className="primary" onClick={active}>{detail.readiness.blockers.length ? '处理阻塞项' : '查看基线'}</button><button type="button" className="detail-delete-button" onClick={onDelete}><Trash2 size={15}/>删除项目</button></div></header>{detail.launchPlan && <LaunchPlanSummary detail={detail} onHarness={() => goToWorkflow('harness')} onTesting={() => setTab('testing')} />}{error && <div className="inline-error" role="alert"><AlertTriangle size={16}/>{error}<button onClick={() => setError('')} aria-label="关闭错误"><X size={15}/></button></div>}
    {tab === 'overview' && <Overview detail={detail} onNavigate={setTab} onFreeze={() => void freeze()} busy={busy}/>} {tab === 'scope' && <ScopeView detail={detail} session={session} onRefresh={onRefresh}/>} {tab === 'facts' && <FactsView detail={detail} busy={busy} factText={factText} setFactText={setFactText} onApprove={approve} onAdd={() => void addCandidate()}/>} {tab === 'queries' && <QueryView detail={detail} goToWorkflow={goToWorkflow}/>} {tab === 'testing' && <TestingView detail={detail} goToWorkflow={goToWorkflow}/>} {tab === 'baseline' && <BaselineView detail={detail} onFreeze={() => void freeze()} busy={busy}/>} {tab === 'actions' && <ActionsView detail={detail} goToWorkflow={goToWorkflow}/>} {tab === 'activity' && <ActivityView detail={detail}/>}</section>
}

function LaunchPlanSummary({ detail, onHarness, onTesting }: { detail: BrandDiagnosticDetail; onHarness: () => void; onTesting: () => void }) {
  const plan = detail.launchPlan
  if (!plan) return null
  const blocked = plan.state === 'configuration-required'
  return <section className={blocked ? 'detail-launch-plan is-blocked' : 'detail-launch-plan'}>
    <div><small>当前启动计划 · v{plan.briefVersion ?? detail.brief?.version ?? 1}</small><h3>{plan.readiness.title}</h3><p>{plan.readiness.detail}</p></div>
    <div className="detail-launch-metrics"><span><b>{plan.queryResearch.estimatedCandidateCount}</b>候选 Query</span><span><b>{plan.testing.providers.length}</b>测试平台</span><span><b>{plan.evidence.taskCount}</b>证据任务</span><span><b>{plan.competitors.taskCount}</b>竞品任务</span></div>
    {blocked ? <button className="primary" onClick={onHarness}><ShieldCheck size={15}/>配置模型连接</button> : <button className="secondary" onClick={onTesting}><Upload size={15}/>{plan.readiness.nextAction}</button>}
  </section>
}

function Overview({ detail, onNavigate, onFreeze, busy }: { detail: BrandDiagnosticDetail; onNavigate: (tab: string) => void; onFreeze: () => void; busy: boolean }) {
  const checklist = [
    { label: '已审核品牌事实', complete: detail.readiness.approvedFacts > 0, note: detail.readiness.approvedFacts + ' 条可用；' + detail.readiness.candidateFacts + ' 条待审核', tab: 'facts' },
    { label: 'Query Scope', complete: detail.readiness.hasScope, note: detail.queryScope ? detail.queryScope.expectedCount + ' 条候选 · ' + detail.queryScope.datasetVersionLabel : '尚未定义用户旅程与类型', tab: 'queries' },
    { label: '测试计划', complete: detail.readiness.hasPlan, note: detail.collectionPlan ? detail.collectionPlan.providers.length + ' 个平台 · ' + detail.collectionPlan.collectionMode : '尚未指定采集方式', tab: 'testing' },
  ]
  const scopeCount = detail.queryScope?.expectedCount ?? null
  const providerCount = detail.collectionPlan?.providers.length ?? null
  const primaryBlocker = detail.readiness.blockers[0]
  const nextTab = primaryBlocker?.tab ?? (detail.baseline ? 'actions' : 'testing')
  const nextAction = primaryBlocker?.message ?? (detail.baseline ? '基线已发布，可查看 GEO 行动建议。' : '完成范围冻结与证据归档后生成正式基线。')

  return <div className="detail-grid">
    <section className="flat-panel project-health-panel">
      <div className="project-health-heading">
        <div><small>项目健康概览</small><h3>把诊断状态变成下一步，而不是重复一张数据报表</h3></div>
        <span>仅展示最新摘要</span>
      </div>
      <div className="project-health-metrics">
        <article className={detail.baseline ? 'is-ready' : ''}><small>最新基线</small><b>{detail.baseline ? 'T0 · v' + detail.baseline.version : '尚未发布'}</b><span>{detail.baseline ? '已冻结；正式可见度与引用指标见基线页' : '完成范围冻结与证据归档后生成'}</span></article>
        <article className={detail.coverage.rate === 100 ? 'is-ready' : ''}><small>数据完整度</small><b>{detail.coverage.rate === null ? '待归档' : detail.coverage.rate + '%'}</b><span>{detail.coverage.message}</span></article>
        <article><small>当前范围</small><b>{scopeCount === null ? '待定义' : scopeCount + ' 条 Query'}</b><span>{providerCount === null ? '尚未配置采集平台' : providerCount + ' 个平台 · 已按本轮范围冻结'}</span></article>
        <article className={primaryBlocker ? 'needs-action' : 'is-ready'}><small>下一步行动</small><b>{primaryBlocker ? '待处理' : '可进入行动'}</b><span>{nextAction}</span></article>
      </div>
      <div className="project-health-actions">
        <p><ShieldCheck size={15}/>项目概览只同步最新基线、完整度和缺口；原始回答、引用与采集日志保留在具体诊断中。</p>
        <div><button className="secondary" onClick={() => onNavigate(nextTab)}>{primaryBlocker ? '继续完成诊断' : '查看 GEO 行动'} <ArrowRight size={14}/></button><button className="primary" disabled={!detail.baseline} onClick={() => onNavigate('baseline')}>查看最新基线 <ArrowRight size={14}/></button></div>
      </div>
    </section>
    <section className="flat-panel lifecycle-panel">
      <div className="panel-heading"><div><small>诊断生命周期</small><h3>先冻结范围，再导入可追溯证据</h3></div><span className="manual-label"><Upload size={14}/>受控人工导入</span></div>
      <div className="lifecycle"><span className="complete"><Check size={13}/>项目范围</span><span className={detail.readiness.approvedFacts ? 'complete' : ''}><Check size={13}/>事实审核</span><span className={detail.readiness.hasScope ? 'complete' : ''}><Check size={13}/>Query Scope</span><span className={detail.readiness.hasPlan ? 'complete' : ''}><Check size={13}/>测试计划</span><span className={detail.baseline ? 'complete' : ''}><Check size={13}/>冻结基线</span><span>导入证据</span></div><p className="panel-note">{detail.collectionBoundary}</p>
    </section>
    <section className="flat-panel readiness-panel"><div className="panel-heading"><div><small>基线就绪度</small><h3>{detail.readiness.baselineReady ? '可以冻结本次诊断范围' : detail.readiness.blockers.length + ' 个项目阻塞项待处理'}</h3></div><button className="secondary" onClick={() => onNavigate('facts')}>查看详情</button></div><div className="readiness-list">{checklist.map((item) => <button key={item.label} onClick={() => onNavigate(item.tab)}><i className={item.complete ? 'ok' : ''}>{item.complete ? <Check size={15}/> : <AlertTriangle size={15}/>}</i><span><b>{item.label}</b><small>{item.note}</small></span><ChevronRight size={15}/></button>)}</div><div className="panel-footer">{detail.baseline ? <span><CheckCircle2 size={16}/>已冻结 v{detail.baseline.version}，等待受控人工证据导入。</span> : <button className="primary" disabled={!detail.readiness.baselineReady || busy} onClick={onFreeze}>{busy ? <LoaderCircle className="spin" size={15}/> : <LockKeyhole size={15}/>}冻结基线范围</button>}</div></section>
    <section className="flat-panel evidence-panel"><div className="panel-heading"><div><small>证据状态</small><h3>指标将在原始回答审核后出现</h3></div><Database size={21}/></div><div className="pending-evidence"><Upload size={26}/><b>暂无可计算的模型回答与引用证据</b><p>{detail.coverage.message}</p><button className="text-button" onClick={() => onNavigate('testing')}>查看受控人工导入要求 <ArrowRight size={14}/></button></div></section>
  </div>
}
function ScopeView({ detail, session, onRefresh }: { detail: BrandDiagnosticDetail; session: WorkspaceSession; onRefresh: () => Promise<void> | void }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: detail.project.name, brandName: detail.project.brandName, website: detail.project.website,
    markets: detail.project.markets.join(', '), locales: detail.project.locales.join(', '),
    audiences: detail.project.audiences.join(', '), objective: detail.project.objective,
    deliveryDate: detail.project.deliveryDate || '',
  })
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const save = async () => {
    try {
      setBusy(true); setError('')
      await updateBrandDiagnostic(session, detail.project.id, {
        name: form.name, brandName: form.brandName, website: form.website, markets: splitValues(form.markets),
        locales: splitValues(form.locales), audiences: splitValues(form.audiences), objective: form.objective,
        deliveryDate: form.deliveryDate || null,
      })
      await onRefresh(); setEditing(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法保存诊断范围。') } finally { setBusy(false) }
  }
  if (editing) return <section className="flat-panel scope-editor"><div className="panel-heading"><div><small>编辑范围</small><h3>更新后会保留活动记录</h3></div><button className="secondary" disabled={busy} onClick={() => setEditing(false)}>取消</button></div>{error && <div className="inline-error" role="alert"><AlertTriangle size={16}/>{error}</div>}<div className="form-grid two"><Field label="诊断名称" value={form.name} onChange={(value) => update('name', value)}/><Field label="品牌 / 产品名称" value={form.brandName} onChange={(value) => update('brandName', value)}/><Field label="官网地址" value={form.website} onChange={(value) => update('website', value)}/><Field label="交付日期（可选）" value={form.deliveryDate} onChange={(value) => update('deliveryDate', value)}/><Field label="目标市场（逗号分隔）" value={form.markets} onChange={(value) => update('markets', value)}/><Field label="市场语言（逗号分隔）" value={form.locales} onChange={(value) => update('locales', value)}/><Field wide label="目标客户（逗号分隔）" value={form.audiences} onChange={(value) => update('audiences', value)}/><Field wide label="业务目标" value={form.objective} onChange={(value) => update('objective', value)}/></div><div className="scope-editor-footer"><span>基线冻结后改动输入，应重新冻结以保持口径可比。</span><button className="primary" disabled={busy} onClick={() => void save()}>{busy ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>}保存范围</button></div></section>
  return <section className="flat-panel scope-panel"><div className="panel-heading"><div><small>版本化范围</small><h3>本次诊断的比较口径</h3></div><div className="panel-heading-actions"><span>最后更新 {shortDate(detail.project.updatedAt)}</span><button className="secondary" onClick={() => setEditing(true)}>编辑范围</button></div></div><div className="scope-grid"><Info label="品牌 / 官网" value={`${detail.project.brandName} · ${detail.project.website}`}/><Info label="目标市场与语言" value={`${detail.project.markets.join(' / ')} · ${detail.project.locales.join(' / ')}`}/><Info label="目标用户" value={detail.project.audiences.join('、')}/><Info label="业务目标" value={detail.project.objective}/><Info label="负责人" value={detail.project.ownerId}/><Info label="交付日期" value={detail.project.deliveryDate || '未设定'}/></div></section>
}function FactsView({ detail, busy, factText, setFactText, onApprove, onAdd }: { detail: BrandDiagnosticDetail; busy: boolean; factText: string; setFactText: (value: string) => void; onApprove: (fact: BrandDiagnosticFact) => void; onAdd: () => void }) { return <section className="facts-layout"><div className="flat-panel"><div className="panel-heading"><div><small>事实与来源</small><h3>只让经过审核的证据进入基线</h3></div><span>{detail.facts.length} 条事实</span></div><div className="fact-table-wrap"><table className="fact-table"><thead><tr><th>事实</th><th>来源</th><th>适用范围</th><th>审核</th><th/></tr></thead><tbody>{detail.facts.map((fact) => <tr key={fact.id}><td><b>{fact.statement}</b><small>{fact.category}{fact.isProhibitedClaim ? ' · 禁止主张' : ''}</small></td><td>{fact.sourceUrl ? <a href={fact.sourceUrl} target="_blank" rel="noreferrer">{fact.sourceLabel}</a> : fact.sourceLabel}</td><td>{fact.appliesToMarkets.join(' / ') || '全局'}</td><td><span className={'fact-status ' + fact.status}>{fact.status === 'approved' ? '已审核' : fact.status === 'candidate' ? '待审核' : '已拒绝'}</span></td><td>{fact.status === 'candidate' && <button className="text-button" disabled={busy} onClick={() => onApprove(fact)}><Check size={14}/>审核通过</button>}</td></tr>)}</tbody></table></div></div><div className="flat-panel add-fact"><div><small>AI 可介入，但必须人工审核</small><h3>新增候选事实</h3><p>可从官网、文档或知识库提取候选事实；当前输入会以“待审核”状态保存。</p></div><textarea value={factText} onChange={(event) => setFactText(event.target.value)} placeholder="输入可核验的事实陈述…"/><button className="primary" disabled={!factText.trim() || busy} onClick={onAdd}><Plus size={15}/>保存候选事实</button></div></section> }
function QueryView({ detail, goToWorkflow }: { detail: BrandDiagnosticDetail; goToWorkflow: (target: string) => void }) { const scope = detail.queryScope; return <section className="flat-panel query-panel"><div className="panel-heading"><div><small>Query Dataset</small><h3>{scope ? `${scope.expectedCount} 条候选 Query 的研究范围` : '尚未定义 Query Scope'}</h3></div><button className="primary" onClick={() => goToWorkflow('queryResearch')}>进入 Query 研究 <ArrowRight size={15}/></button></div>{scope ? <div className="scope-chips"><Chip label="用户旅程" values={scope.journeys}/><Chip label="Query 类型" values={scope.queryTypes}/><Chip label="竞品种子词" values={scope.competitorSeeds}/><Info label="Dataset 标签" value={scope.datasetVersionLabel}/></div> : <Empty icon={<Network size={25}/>} title="先定义用户问题的范围" text="Query 研究会在此范围内生成、去重、分类和审核候选问题。"/>}</section> }
function TestingView({ detail, goToWorkflow }: { detail: BrandDiagnosticDetail; goToWorkflow: (target: string) => void }) { const plan = detail.collectionPlan; return <section className="flat-panel testing-panel"><div className="panel-heading"><div><small>测试与证据</small><h3>{plan ? '模型平台与受控采集计划' : '尚未配置测试计划'}</h3></div><button className="primary" onClick={() => goToWorkflow('testing')}>进入多平台测试 <ArrowRight size={15}/></button></div>{plan ? <><div className="plan-metrics"><Info label="目标平台" value={plan.providers.join(' · ')}/><Info label="采集方式" value={plan.collectionMode === 'controlled-manual' ? '受控人工导入（MVP）' : plan.collectionMode}/><Info label="复测频率" value={plan.frequency}/><Info label="失败处理" value={plan.failurePolicy}/></div><div className="import-boundary"><Upload size={19}/><div><b>这里不会自动运行第三方模型</b><span>请在原平台按相同 Query 检索、导出原始回答和引用链接，再通过受控人工导入保存。</span></div></div></> : <Empty icon={<Upload size={25}/>} title="先配置采集方式" text="没有测试计划时，无法判断覆盖率、失败项或基线可比性。"/>}</section> }
function BaselineView({ detail, onFreeze, busy }: { detail: BrandDiagnosticDetail; onFreeze: () => void; busy: boolean }) { return <section className="flat-panel baseline-panel"><div className="panel-heading"><div><small>基线结果</small><h3>{detail.baseline ? `已冻结诊断基线 v${detail.baseline.version}` : '基线尚未冻结'}</h3></div>{!detail.baseline && <button className="primary" disabled={!detail.readiness.baselineReady || busy} onClick={onFreeze}><LockKeyhole size={15}/>冻结基线</button>}</div>{detail.baseline ? <><div className="baseline-summary"><CheckCircle2 size={25}/><div><b>范围快照已留档</b><p>该版本包含已审核事实、Query Scope、模型范围与采集方式；后续更改需要重新冻结，避免把不同口径的观测混在一起。</p></div></div><div className="no-metrics"><LineIcon/><div><b>暂无表现指标</b><span>{detail.coverage.message}</span></div></div></> : <Empty icon={<LockKeyhole size={25}/>} title="完成必要输入后，才能冻结可比较的基线" text={detail.readiness.blockers.map((item) => item.message).join(' ') || '请检查必要输入。'}/>}</section> }
function ActionsView({ detail, goToWorkflow }: { detail: BrandDiagnosticDetail; goToWorkflow: (target: string) => void }) { return <section className="actions-list">{detail.recommendations.length ? detail.recommendations.map((item) => <article className="flat-panel action-card" key={item.id}><span><Sparkles size={18}/></span><div><small>{item.destination} · {item.evidenceState}</small><h3>{item.title}</h3><p>{item.rationale}</p></div><button className="secondary" onClick={() => goToWorkflow(item.destination === '多平台测试' ? 'testing' : item.destination === '知识资产' ? 'assets' : 'content')}>打开模块 <ArrowRight size={14}/></button></article>) : <section className="flat-panel"><Empty icon={<Sparkles size={25}/>} title="冻结基线后生成行动建议" text="行动建议会说明它来自范围冻结、事实审核还是已导入证据，避免没有证据的优化结论。"/></section>}</section> }
function ActivityView({ detail }: { detail: BrandDiagnosticDetail }) { return <section className="flat-panel activity-panel"><div className="panel-heading"><div><small>活动记录</small><h3>谁在什么时候改变了什么</h3></div></div><ol>{detail.activities.map((item) => <li key={item.id}><i/><div><b>{item.detail}</b><span>{shortDate(item.createdAt)} · {item.actorId} · {item.type}</span></div></li>)}</ol></section> }
function Field({ label, value, onChange, placeholder, wide = false, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; wide?: boolean; readOnly?: boolean }) { return <label className={wide ? 'field wide' : 'field'}><span>{label}</span><input value={value} readOnly={readOnly} placeholder={placeholder} onChange={(event) => onChange(event.target.value)}/></label> }
function WizardIntro({ title, text }: { title: string; text: string }) { return <div className="wizard-intro"><h3>{title}</h3><p>{text}</p></div> }
function Review({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) { return <article><i>{icon}</i><div><small>{label}</small><b>{text}</b></div></article> }
function Info({ label, value }: { label: string; value: string }) { return <div className="info"><small>{label}</small><b>{value}</b></div> }
function Chip({ label, values }: { label: string; values: string[] }) { return <div className="chip-group"><small>{label}</small><div>{values.map((value) => <span key={value}>{value}</span>)}</div></div> }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty-state"><i>{icon}</i><b>{title}</b><p>{text}</p></div> }
function LineIcon() { return <svg width="30" height="18" viewBox="0 0 30 18" aria-hidden="true"><path d="M1 14 8 9l5 3 7-9 9 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> }




