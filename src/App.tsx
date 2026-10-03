import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity, ArrowLeft, ArrowRight, BellRing, Bot, BookOpenCheck, Check, CheckCircle2,
  ChevronRight, CircleAlert, ClipboardCheck, Clock3, Download, Eye, FileCheck2, FileText,
  FileStack, Filter, Globe2, LayoutDashboard, LineChart, Link2, ListChecks, LockKeyhole,
  Menu, Network, PenLine, Plus, Radar, RefreshCw, Search, SearchCheck, Settings2,
  ShieldCheck, Sparkles, Target, TrendingUp, Upload, Users, X,
} from 'lucide-react'
import './styles.css'
import { ContentStudio } from './ContentStudio'
import { BrandDiagnostics, getWorkspaceSession } from './BrandDiagnostics'
import { BaselineWorkspace } from './BaselineWorkspace'
import { ModelConnections } from './ModelConnections'
import { VisibilityBaseline } from './VisibilityBaseline'
import { CompetitorIntelligence } from './CompetitorIntelligence'
import { AssetsWorkspace } from './AssetsWorkspace'
import { LandingPage } from './LandingPage'
import { StaticDemoWorkspace } from './StaticDemoWorkspace'
import { listBrandDiagnostics, type BrandDiagnosticProjectSummary, type GeoGapAction } from './api'

type Screen = 'home' | 'demo' | 'diagnostics' | 'create' | 'report' | 'baseline' | 'queryResearch' | 'monitoring' | 'research' | 'assets' | 'content' | 'reports' | 'harness' | 'connections'
type Query = { id: string; text: string; intent: string; source: string; rationale: string; priority: '高' | '中'; approved: boolean }

const queriesSeed: Query[] = [
  { id: '1', text: '有哪些支持知识图谱、来源可追溯的 AI 知识库工具？', intent: '工具筛选', source: 'ICP：企业知识库负责人 · 中文市场', rationale: '覆盖知识图谱、可引用回答与团队协作的核心采购场景。', priority: '高', approved: true },
  { id: '2', text: 'What AI knowledge base tools provide knowledge-graph context and source-cited answers for B2B teams?', intent: '方案评估', source: '目标市场：en-US · 海外 SaaS 团队', rationale: '覆盖海外团队比较知识图谱与可追溯回答的高价值问题。', priority: '高', approved: true },
  { id: '3', text: '企业 RAG 知识库如何避免回答幻觉并保留来源？', intent: '问题解决', source: '官网、帮助中心与客户问题', rationale: '验证品牌能否进入可信回答的解释型问题。', priority: '高', approved: true },
  { id: '4', text: '适合出海 SaaS 团队的企业知识库应该怎么选？', intent: '购买决策', source: 'ICP：AI 产品负责人 · 竞品词', rationale: '比较品牌在出海 SaaS 场景中的推荐位置和竞品覆盖。', priority: '中', approved: false },
  { id: '5', text: 'What are alternatives to an AI knowledge base with cited answers?', intent: '竞品替代', source: '竞品研究种子词', rationale: '识别模型主动提到的竞品与引用站点。', priority: '中', approved: false },
]

// GEO 的一次性工作流只包含交付链路；监控、连接与 Harness 属于持续运营和支撑能力。
const coreWorkflow: ReadonlyArray<readonly [Screen, string, LucideIcon]> = [
  ['queryResearch', 'Query 研究', SearchCheck],
  ['baseline', '真实平台测试', ClipboardCheck],
  ['report', 'GEO 诊断与基线', LineChart],
  ['research', '行业与竞品研究', Radar],
  ['content', '内容策略与智能写作', PenLine],
  ['assets', '知识资产与发布准备', Network],
  ['reports', '报告中心', FileText],
]
const ongoingWorkflow: ReadonlyArray<readonly [Screen, string, LucideIcon]> = [['monitoring', '持续监控', BellRing]]

const validScreens = new Set<Screen>([
  'home', 'demo', 'diagnostics', 'report', 'baseline', 'queryResearch', 'monitoring',
  'research', 'assets', 'content', 'reports', 'harness', 'connections',
])

const activeProjectStorageKey = 'geo-compass.active-project.v1'

const legacyScreenAliases: Record<string, Screen> = {
  testing: 'baseline',
  execution: 'baseline',
  evidence: 'report',
  visibility: 'report',
}

function resolveScreen(value: string | null | undefined): Screen {
  const normalized = String(value ?? '').trim().replace(/^#\/?/, '')
  if (Object.prototype.hasOwnProperty.call(legacyScreenAliases, normalized)) return legacyScreenAliases[normalized]
  if (validScreens.has(normalized as Screen)) return normalized as Screen
  return 'home'
}

function screenFromLocation(): Screen {
  if (typeof window === 'undefined') return 'diagnostics'
  const hash = window.location.hash.replace(/^#\/?/, '')
  const query = new URLSearchParams(window.location.search).get('screen')
  return resolveScreen(hash || query)
}

function persistedActiveProjectId() {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(activeProjectStorageKey) } catch { return null }
}

function persistActiveProjectId(projectId: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (projectId) window.localStorage.setItem(activeProjectStorageKey, projectId)
    else window.localStorage.removeItem(activeProjectStorageKey)
  } catch {
    // Private browsing or an embedded host may disable storage. Project scope still works in memory.
  }
}

const isStaticDemoHost = () => typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromLocation())
  const [openNav, setOpenNav] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [contentSeed, setContentSeed] = useState<GeoGapAction | null>(null)
  const [projects, setProjects] = useState<BrandDiagnosticProjectSummary[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId) ?? null, [activeProjectId, projects])

  const syncProjects = (nextProjects: BrandDiagnosticProjectSummary[]) => {
    setProjects(nextProjects)
    setActiveProjectId((current) => {
      const stored = persistedActiveProjectId()
      const nextId = nextProjects.some((project) => project.id === current)
        ? current
        : nextProjects.some((project) => project.id === stored)
          ? stored
          : nextProjects[0]?.id ?? null
      persistActiveProjectId(nextId)
      return nextId
    })
  }

  const selectProject = (nextProjectId: string | null) => {
    // The project center can publish the new project and active ID in the same
    // React turn. Do not reject that valid ID just because this component has
    // not rendered the refreshed project list yet.
    const normalized = nextProjectId?.trim() || null
    setActiveProjectId(normalized)
    persistActiveProjectId(normalized)
  }

  useEffect(() => {
    if (isStaticDemoHost()) return
    let cancelled = false
    void (async () => {
      try {
        const session = await getWorkspaceSession()
        const result = await listBrandDiagnostics(session)
        if (!cancelled) syncProjects(result.projects)
      } catch {
        // Individual screens surface their own API errors. Keep the project switcher non-blocking.
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncScreenFromLocation = () => setScreen(screenFromLocation())
    window.addEventListener('hashchange', syncScreenFromLocation)
    window.addEventListener('popstate', syncScreenFromLocation)
    return () => {
      window.removeEventListener('hashchange', syncScreenFromLocation)
      window.removeEventListener('popstate', syncScreenFromLocation)
    }
  }, [])

  const go = (next: Screen | string) => {
    const destination = resolveScreen(next)
    setScreen(destination)
    setOpenNav(false)
    if (typeof window !== 'undefined') {
      if (window.location.hash !== `#${destination}`) window.history.pushState(null, '', `#${destination}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  const notice = (message: string) => {
    setToast(message)
    if (typeof window !== 'undefined') window.setTimeout(() => setToast(null), 2500)
  }
  const start = () => go('create')

  if (isStaticDemoHost()) {
    if (screen === 'home') return <LandingPage demoMode onEnterWorkspace={() => go('demo')} />
    return <StaticDemoWorkspace onExit={() => go('home')} />
  }

  if (screen === 'home') return <LandingPage onEnterWorkspace={() => go('diagnostics')} />

  return <div className="product-shell">
    <button className={openNav ? 'scrim show' : 'scrim'} onClick={() => setOpenNav(false)} aria-label="关闭菜单" />
    <aside className={openNav ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span><Sparkles size={17}/></span><div><strong>GEO Compass</strong><small>企业 GEO 工作台</small></div><button className="mobile-x" onClick={() => setOpenNav(false)} aria-label="关闭菜单"><X size={17}/></button></div>
      <button className="new-button" onClick={start}><Plus size={16}/>创建品牌诊断</button>
      <p className="nav-label">项目准备</p>
      <nav className="workflow-nav" aria-label="项目准备导航"><button className={screen === 'diagnostics' || screen === 'create' ? 'nav-current' : ''} onClick={() => go('diagnostics')}><BookOpenCheck size={16}/><span>00 项目与产品档案</span></button></nav>
      <p className="nav-label">建立 GEO 基线</p>
      <nav className="workflow-nav" aria-label="GEO 工作流导航">{coreWorkflow.map(([id, label, Icon], index) => <button key={id} className={screen === id ? 'nav-current' : ''} onClick={() => go(id)}><Icon size={16}/><span>{String(index + 1).padStart(2, '0')} {label}</span></button>)}</nav>
      <div className="nav-divider" role="separator" aria-hidden="true" />
      <p className="nav-label support-label">持续运营</p>
      <nav className="workflow-nav" aria-label="持续运营导航">{ongoingWorkflow.map(([id, label, Icon]) => <button key={id} className={screen === id ? 'nav-current' : ''} onClick={() => go(id)}><Icon size={16}/><span>{label}</span></button>)}</nav>
      <div className="nav-divider" role="separator" aria-hidden="true" />
      <p className="nav-label admin-label">平台与治理</p>
      <nav aria-label="执行与治理导航"><button className={screen === 'connections' ? 'nav-current' : ''} onClick={() => go('connections')}><Bot size={16}/>模型与 API 连接</button><button className={screen === 'harness' ? 'nav-current' : ''} onClick={() => go('harness')}><Settings2 size={16}/>Harness 管理</button></nav>
      <div className="rail-status"><ShieldCheck size={15}/><div><strong>受控采集与审计模式</strong><small>真实平台优先 · 留档可追溯</small></div></div>
    </aside>
    <section className="app-area"><header className="topbar"><button className="hamburger" onClick={() => setOpenNav(true)} aria-label="打开菜单"><Menu size={20}/></button><div className="workspace"><i/> <strong>当前项目</strong><label className="project-switcher"><span className="sr-only">切换当前项目</span><select value={activeProjectId ?? ''} onChange={(event) => selectProject(event.target.value || null)} aria-label="切换当前项目"><option value="">{projects.length ? '选择项目' : '暂无产品项目'}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.brandName || project.name} · {project.markets.join(' / ') || '未设置市场'}</option>)}</select></label>{activeProject ? <span>{activeProject.locales.join(' / ') || '未设置语种'} · 所有业务数据均按此项目过滤</span> : <span>请先建立并选择产品项目</span>}</div><div className="user-tools"><button onClick={() => notice('通知偏好已记录。')}><BellRing size={16}/>通知</button><b>LG</b></div></header>
      <main id="main-content" tabIndex={-1} aria-label="GEO 诊断工作台主内容" className="page">
        {screen === 'diagnostics' && <BrandDiagnostics goToWorkflow={go} activeProjectId={activeProjectId} onActiveProjectChange={(project) => selectProject(project?.id ?? null)} onProjectsChange={syncProjects} />} {screen === 'baseline' && <BaselineWorkspace go={go} mode="testing" activeProjectId={activeProjectId} onProjectChange={selectProject} />} {screen === 'queryResearch' && <BaselineWorkspace go={go} mode="research" activeProjectId={activeProjectId} onProjectChange={selectProject} />} {screen === 'create' && <BrandDiagnostics startCreate goToWorkflow={go} onExitCreate={() => go('diagnostics')} activeProjectId={activeProjectId} onActiveProjectChange={(project) => selectProject(project?.id ?? null)} onProjectsChange={syncProjects} />} {screen === 'report' && <Report go={go} projectId={activeProjectId} onProjectChange={selectProject}/>} {screen === 'monitoring' && <Monitoring go={go} notice={notice} project={activeProject}/>} {screen === 'research' && <Research go={go} notice={notice} projectId={activeProjectId} onStartWriting={(action) => { setContentSeed(action); go('content') }}/>} {screen === 'assets' && <AssetsWorkspace go={go} notice={notice} project={activeProject}/>} {screen === 'content' && <ContentStudio go={go} notice={notice} projectId={activeProjectId} geoActionSeed={contentSeed} onGeoActionSeedConsumed={() => setContentSeed(null)}/>} {screen === 'reports' && <Reports go={go} notice={notice} project={activeProject}/>} {screen === 'connections' && <ModelConnections />} {screen === 'harness' && <Harness go={go} notice={notice}/>} 
      </main>
    </section>{toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>
}

function Home({ go, start }: { go: (screen: Screen) => void; start: () => void }) {
  const workflowItems: Array<{ icon: LucideIcon; label: string; text: string; onClick: () => void }> = [
    { icon: ClipboardCheck, label: '品牌诊断', text: '生成、审核 Query，形成可解释的起点。', onClick: start },
    { icon: Radar, label: '竞品与信源研究', text: '解释竞品为何出现在答案与引用中。', onClick: () => go('research') },
    { icon: Network, label: '知识资产', text: '沉淀可被内容和人工审核复用的事实。', onClick: () => go('assets') },
    { icon: PenLine, label: '内容行动与复测', text: '将缺口转为内容、发布证据和前后对比。', onClick: () => go('content') },
  ]

  return <>
    <section className="hero"><div><b className="live-dot"><i/>诊断驱动的 GEO 工作流</b><h2>先获得一份 <strong>AI 可见度基线</strong>，再决定优化动作</h2><p>用可追溯的 Query、真实模型回答和引用证据，识别品牌在哪些用户问题里被忽略、被误解或被竞品取代。</p><div className="buttons"><button className="primary" onClick={start}>创建品牌诊断 <ArrowRight size={16}/></button><button className="secondary" onClick={() => go('report')}>查看示例报告</button></div></div><div className="flow-preview"><header><span>本次诊断</span><strong>示例品牌 · 中文 + en-US</strong><b>基线已完成</b></header>{[['01','品牌事实','产品、市场、竞品'],['02','Query 数据集','32 条已审核问题'],['03','回答与证据','9 个模型 · 受控导入'],['04','诊断报告','5 个可行动缺口']].map(([n,t,d], index) => <div className={index < 3 ? 'flow done' : 'flow active'} key={n}><i>{index < 3 ? <Check size={12}/> : n}</i><div><strong>{t}</strong><span>{d}</span></div></div>)}</div></section>
    <Title eyebrow="进行中的诊断" title="从诊断结果继续推进" action={<button className="text-button" onClick={() => go('reports')}>查看全部报告 <ChevronRight size={15}/></button>}/><section className="diagnostic-cards"><article className="main-card"><div className="card-line"><b className="chip blue">已完成基线</b><small>2026-09-27</small></div><h3>示例品牌 · B2B AI 知识库</h3><p>中文与英文市场 · 32 条已审核 Query · 9 个模型范围</p><div className="numbers"><Metric label="品牌提及率" value="38%" note="+0"/><Metric label="自有来源引用率" value="16%" note="—"/><Metric label="待解决缺口" value="5" note="高价值"/></div><div className="buttons"><button className="mini-primary" onClick={() => go('report')}>打开诊断报告 <ArrowRight size={14}/></button><button className="link-button" onClick={() => go('monitoring')}>建立监控</button></div></article><Card icon={<Target size={18}/>} tag="下一步建议" title="先覆盖“可信来源”类 Query Gap" text="3 个高优先级问题中没有品牌或官网引用；竞品主要被博客、对比页和文档引用。" action="查看原因与切入点" onClick={() => go('research')}/><Card icon={<Activity size={18}/>} tag="监控提醒" teal title="3 条高价值问题等待加入监控" text="诊断完成后才开放持续监控，避免没有基线的数据直接进入长期报表。" action="选择监控问题" onClick={() => go('monitoring')}/></section>
    <section className="workflow"><Title eyebrow="产品工作流" title="从基线到复测，每一步都有证据" action={<span className="fine"><LockKeyhole size={14}/>不自动登录或抓取第三方模型</span>}/><div className="workflow-grid">{workflowItems.map(({ icon: Icon, label, text, onClick }, index) => <button onClick={onClick} key={label}><span>{String(index + 1).padStart(2,'0')}</span><i><Icon size={19}/></i><strong>{label}</strong><p>{text}</p><em>进入模块 <ArrowRight size={14}/></em></button>)}</div></section>
  </>
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div><small>{label}</small><strong>{value}</strong><span>{note}</span></div> }
function Card({ icon, tag, title, text, action, onClick, teal }: { icon: ReactNode; tag: string; title: string; text: string; action: string; onClick: () => void; teal?: boolean }) { return <article className="side-card"><i className={teal ? 'teal' : ''}>{icon}</i><div><b className={teal ? 'chip mint' : 'chip amber'}>{tag}</b><h3>{title}</h3><p>{text}</p><button className="text-button" onClick={onClick}>{action} <ChevronRight size={15}/></button></div></article> }
function Title({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) { return <div className="section-title"><div><p>{eyebrow}</p><h2>{title}</h2></div>{action}</div> }
function Wizard({ step, setStep, queries, approved, toggle, go, notice }: { step: number; setStep: (value: number) => void; queries: Query[]; approved: number; toggle: (id: string) => void; go: (screen: Screen) => void; notice: (value: string) => void }) {
  const names = ['品牌事实','Query 数据集','采集方式','提交诊断']
  const descriptions = ['说明产品、市场与要验证的业务目标。','审核能进入正式测试的用户问题。','选择授权连接或受控人工导入。','冻结口径并创建可复测基线。']
  const next = () => { if (step < 4) setStep(step + 1); else { notice('诊断已创建。请进入首轮真实测试，采集并审核第一批平台证据。'); go('baseline') } }
  return <section className="wizard wizard-flat">
    <header className="wizard-header">
      <div><small>创建诊断 · Dataset 与证据优先</small><h2>{names[step - 1]}</h2><p>{descriptions[step - 1]}</p></div>
      <div className="wizard-context"><b className="chip blue">草稿</b><span>未审核的 Query 不会进入正式诊断</span></div>
    </header>
    <ol className="wizard-steps" aria-label="创建诊断步骤">
      {names.map((name,index) => {
        const position = index + 1
        const completed = position < step
        const current = position === step
        return <li key={name} className={current ? 'active' : completed ? 'done' : ''}>
          <button type="button" onClick={() => position <= step && setStep(position)} aria-current={current ? 'step' : undefined}>
            <i>{completed ? <Check size={14}/> : position}</i><span><b>{name}</b><small>{descriptions[index]}</small></span>
          </button>
        </li>
      })}
    </ol>
    <div className="wizard-body">
      {step === 1 && <BrandFacts/>}{step === 2 && <QueryReview queries={queries} approved={approved} toggle={toggle}/>}{step === 3 && <Collection/>}{step === 4 && <Confirm approved={approved}/>}
      <footer><button className="secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>上一步</button><div><small>第 {step} / 4 步</small><button className="primary" disabled={step === 2 && approved < 3} onClick={next}>{step === 4 ? '创建诊断并查看进度' : '继续'} <ArrowRight size={15}/></button></div></footer>
    </div>
  </section>
}
function BrandFacts() { return <div className="wizard-page"><Intro title="提供品牌事实，而不是营销口号" text="这些信息会成为 AI 生成 Query、诊断解释和后续内容审核的可追溯输入。"/><div className="fields"><Field label="品牌 / 产品名称" value="示例品牌"/><Field label="官网" value="https://your-company.example"/><Field label="所属行业" value="企业知识库 / AI SaaS"/><Field label="优先市场" value="中国大陆（zh-CN）和美国（en-US）"/></div><label className="input-field wide"><b>产品与核心能力</b><textarea defaultValue="面向 B2B 团队的 AI 知识库：支持知识图谱上下文、来源可追溯、可引用回答与团队协作。"/></label><div className="choice-row"><Choice icon={<Users size={17}/>} title="目标用户" text="出海 SaaS 团队、企业知识库负责人、AI 产品负责人" selected/><Choice icon={<Globe2 size={17}/>} title="首批内容渠道" text="官网 Blog、Help Center、知乎、公众号、Medium、LinkedIn"/><Choice icon={<Search size={17}/>} title="竞品与替代品" text="可在下一步 Query 审核中补充。"/></div></div> }
function Field({ label, value }: { label: string; value: string }) { return <label className="input-field"><b>{label}</b><input defaultValue={value}/></label> }
function Choice({ icon, title, text, selected }: { icon: ReactNode; title: string; text: string; selected?: boolean }) { return <button className={selected ? 'choice selected' : 'choice'} type="button"><i>{icon}</i><div><strong>{title}</strong><span>{text}</span></div>{selected && <CheckCircle2 size={16}/>}</button> }
function Intro({ title, text }: { title: string; text: string }) { return <div className="intro"><h2>{title}</h2><p>{text}</p></div> }
function QueryReview({ queries, approved, toggle }: { queries: Query[]; approved: number; toggle: (id: string) => void }) { return <div className="wizard-page"><Intro title="审阅 AI 建议的问题集合" text="正式版本会记录模型版本、提示词版本、输入证据和审核人；你始终可以编辑、拒绝或手写 Query。"/><div className="provenance"><Sparkles size={17}/><div><strong>本次 Query 的生成依据</strong><span>品牌事实包 · ICP 与目标市场 · 官网 / 帮助中心主题 · 人工输入的竞品与种子词</span></div><b>{approved} / {queries.length} 已审核</b></div><div className="filter-row"><div><button className="selected">全部 {queries.length}</button><button>高优先级 3</button><button>待审核 {queries.length - approved}</button></div><button><Sparkles size={14}/>重新生成候选</button></div><div className="query-list">{queries.map((query) => <article className={query.approved ? 'approved' : ''} key={query.id}><header><div><b className={query.priority === '高' ? 'chip hot' : 'chip'}>{query.priority}优先级</b><b className="chip soft">{query.intent}</b></div><button onClick={() => toggle(query.id)} className={query.approved ? 'approved-button' : ''}>{query.approved ? <><Check size={14}/>已审核</> : '纳入数据集'}</button></header><h3>{query.text}</h3><span><ListChecks size={13}/>{query.source}</span><p><b>生成理由：</b>{query.rationale}</p></article>)}</div></div> }
function Collection() { return <div className="wizard-page"><Intro title="选择本次诊断的回答采集方式" text="所有方式都会在报告中标明采集方法与限制。系统不会登录第三方模型页面、绕过访问控制或自动发布内容。"/><div className="collection"><article><i><Bot size={20}/></i><b className="chip blue">推荐 · 已配置后启用</b><h3>授权 API / 企业网关 / MCP</h3><p>适用于已获得平台授权、企业已有网关或内部 MCP 的模型连接。</p><ul><li><Check size={14}/>按模型并发与限流执行</li><li><Check size={14}/>保留模型、时间和响应证据</li><li><Check size={14}/>由管理员在 Harness 配置</li></ul><button className="secondary">当前无可用连接</button></article><article className="selected"><i className="green"><ClipboardCheck size={20}/></i><b className="chip mint">MVP 正式路径</b><h3>受控人工批量导入</h3><p>导出待采集 Query，在合法、授权环境中整理回答和链接，再批量导入形成证据。</p><ul><li><Check size={14}/>不需要逐条复制粘贴</li><li><Check size={14}/>清晰标识人工采集限制</li><li><Check size={14}/>保留原始回答与链接</li></ul><button className="mini-primary">已选择此路径 <Check size={13}/></button></article></div><div className="boundary"><ShieldCheck size={17}/><span><b>执行边界：</b>自动执行仅在真实、已授权的集成存在时启用；没有集成时，保持人工受控路径。</span></div></div> }
function Confirm({ approved }: { approved: number }) { return <div className="wizard-page"><Intro title="确认本次诊断范围" text="提交后将创建一份可重复的基线：同一版已审核 Query 可被后续监控和发布后复测复用。"/><div className="summary"><Summary icon={<ClipboardCheck size={17}/>} label="品牌与市场" text="示例品牌 · 中国大陆（zh-CN）+ 美国（en-US）"/><Summary icon={<SearchCheck size={17}/>} label="Query 数据集" text={`${approved} 条已审核问题 · v1 草案`}/><Summary icon={<Bot size={17}/>} label="采集方式" text="受控人工批量导入（MVP 正式接入方式）"/><Summary icon={<ShieldCheck size={17}/>} label="治理与限制" text="原始回答、引用、时间与采集方法将被留档；报告会显式披露限制。"/></div><div className="ready"><CheckCircle2 size={20}/><div><b>可以创建诊断</b><span>后续可以从报告直接建立监控、竞品研究、知识资产或内容行动。</span></div></div></div> }
function Summary({ icon, label, text }: { icon: ReactNode; label: string; text: string }) { return <div><i>{icon}</i><span><small>{label}</small><b>{text}</b></span></div> }

function Report({ go, projectId, onProjectChange }: { go: (screen: Screen) => void; projectId: string | null; onProjectChange: (id: string | null) => void }) { return <VisibilityBaseline go={go} projectId={projectId} onProjectChange={onProjectChange}/> }
function ReportNumber({ icon, name, value, text, teal, amber, red }: { icon: ReactNode; name: string; value: string; text: string; teal?: boolean; amber?: boolean; red?: boolean }) { return <article className={[teal && 'teal', amber && 'amber', red && 'red'].filter(Boolean).join(' ')}><i>{icon}</i><small>{name}</small><b>{value}</b><p>{text}</p></article> }
function Gap({ priority, query, issue, action }: { priority: string; query: string; issue: string; action: string }) { return <div className="gap"><b className="chip hot">{priority}</b><span><strong>{query}</strong><p>{issue}</p><small><ArrowRight size={12}/>{action}</small></span></div> }
function Bars({ name, number, text }: { name: string; number: number; text: string }) { return <div className="bar"><header><b>{name}</b><strong>{number}%</strong></header><i><span style={{ width: `${number}%` }}/></i><small>{text}</small></div> }
function QueryResearch({ go, notice }: { go: (screen: Screen) => void; notice: (value: string) => void }) {
  const [filter, setFilter] = useState('全部')
  const categories = [['品牌词', '8 条', '品牌 / 产品名 / 替代问法'], ['品类选型', '12 条', '工具比较、采购与替代方案'], ['问题解决', '9 条', '用户任务、方法与风险'], ['竞品与对比', '7 条', '替代品、Comparison 与迁移'], ['渠道与内容', '6 条', '官网、文档、媒体与社区内容']]
  const candidates = [
    ['有哪些支持知识图谱、来源可追溯的 AI 知识库工具？', '工具筛选', '高', 'LLM 生成 · ICP + 官网 FAQ', '已审核'],
    ['企业 RAG 知识库如何避免回答幻觉并保留来源？', '问题解决', '高', '客户问题 · 帮助中心', '已审核'],
    ['适合出海 SaaS 团队的企业知识库应该怎么选？', '购买决策', '中', '竞品词 · en-US 市场包', '待审核'],
    ['What AI knowledge base tools provide source-cited answers?', '方案评估', '高', 'LLM 生成 · Prompt v0.3', '重复簇 A'],
  ].filter((item) => filter === '全部' || item[1] === filter)
  return <><section className="module-hero"><div><b className="chip blue">Dataset v1 · 草稿</b><h2>Query 不是随手凑的关键词，而是可审核的用户问题资产</h2><p>支持人工导入和 LLM 协助生成；每条候选都能追溯到事实包、客户问题、竞品、市场、Prompt 版本和审核人。</p></div><div className="buttons"><button className="secondary" onClick={() => notice('原型中已打开 CSV / 表格导入器。')}><Upload size={15}/>导入 Query</button><button className="primary" onClick={() => notice('原型中已生成 12 条候选，等待人工审核。')}><Sparkles size={15}/>AI 生成候选</button></div></section><section className="harness-cards">{categories.map(([name,count,description], index) => <button className="query-category" key={name} onClick={() => setFilter(index === 0 ? '全部' : index === 1 ? '工具筛选' : index === 2 ? '问题解决' : index === 3 ? '购买决策' : '方案评估')}><b>{count}</b><strong>{name}</strong><small>{description}</small></button>)}</section><section className="table-card"><Title eyebrow="生成依据与审核" title="候选 Query 队列" action={<span className="fine"><ShieldCheck size={14}/>只有审核通过的版本可进入正式测试</span>}/><div className="filter-row"><div>{['全部','工具筛选','问题解决','购买决策','方案评估'].map((item) => <button className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><button className="secondary" onClick={() => notice('原型中已创建 Dataset v2 草稿，不会修改既有基线。')}>创建新版本</button></div><DataTable headers={['Query','意图','优先级','生成 / 来源','审核状态']} rows={candidates.map((item) => [item[0],item[1],item[2],item[3],item[4]])}/></section><section className="evidence-card"><Title eyebrow="质量守门" title="候选进入 Dataset 前的自动检查"/><div><article><b><CheckCircle2 size={15}/>语言与市场</b><strong>zh-CN / en-US</strong><span>发现语言与市场不匹配时，候选无法自动进入批准集。</span></article><article><b><SearchCheck size={15}/>去重与聚类</b><strong>3 个重复簇</strong><span>保留原文、标记相似问题，并让审核人决定合并或保留。</span></article><article><b><CircleAlert size={15}/>事实与风险</b><strong>2 条待处理</strong><span>涉及未证实能力或绝对化表述的候选，会显示事实冲突与风险原因。</span></article></div><p><LockKeyhole size={14}/>演示中的 AI 生成仅为界面状态；真实模型、Prompt 和来源凭据将在后端接入后落审计记录。</p></section><section className="next-actions"><div><span><SearchCheck size={19}/></span><div><b>数据集批准后，下一步是首轮真实测试</b><small>保留 Dataset 版本，首轮测试和后续复测始终使用同一版 Query 才能比较。</small></div></div><button className="primary" onClick={() => go('baseline')}>进入首轮真实测试 <ArrowRight size={15}/></button></section></>
}

function ProjectScopedPending({ project, title, description, actionLabel, go, actionScreen }: { project: BrandDiagnosticProjectSummary | null; title: string; description: string; actionLabel: string; go: (screen: Screen) => void; actionScreen: Screen }) {
  const projectLabel = project ? (project.brandName || project.name) : null
  return <><section className="module-hero"><div><b className="chip blue">{projectLabel ? `当前项目 · ${projectLabel}` : '尚未选择项目'}</b><h2>{projectLabel ? title : '先选择一个产品项目'}</h2><p>{projectLabel ? `${description} 当前页面不会展示工作区级示例数据，也不会混入其他项目的数据。` : '“项目与产品档案”是所有业务数据的边界。选择项目后，Query、真实平台测试、可见度、竞品与内容工作流才会加载该项目的数据。'}</p></div><button className="primary" onClick={() => go(actionScreen)}>{projectLabel ? actionLabel : '打开项目与产品档案'}<ChevronRight size={15}/></button></section><section className="method"><ShieldCheck size={18}/><span><b>项目范围已启用</b><small>{projectLabel ? `此处仅允许写入并读取「${projectLabel}」的数据。待对应的数据实体完成项目归属后，才会显示记录；不会以示例或其他项目的结果替代。` : '请先在“项目与产品档案”创建或选择项目。'}</small></span></section></>
}

function Monitoring({ go, notice, project }: { go: (screen: Screen) => void; notice: (value: string) => void; project: BrandDiagnosticProjectSummary | null }) {
  const [platform, setPlatform] = useState('全部平台')
  const [range, setRange] = useState('近 7 天')
  const [selectedAlert, setSelectedAlert] = useState(0)
  const projectLabel = project ? (project.brandName || project.name) : null
  if (!projectLabel) return <ProjectScopedPending project={project} title="为当前项目建立持续监控" description="监控计划将继承该项目已审核的 Query 与首轮真实基线。" actionLabel="查看真实平台测试" go={go} actionScreen="diagnostics" />

  const alerts = [
    { level: '高优先级', title: '品牌在 3 个 Query 中从推荐列表下降', detail: 'DeepSeek · 购买决策类 · 最近两次运行', tone: 'red', action: '查看回答差异' },
    { level: '中优先级', title: '竞品 A 连续两次超过你的品牌', detail: '豆包 · “企业知识库应该怎么选？”', tone: 'amber', action: '查看竞品证据' },
    { level: '提示', title: '新增 5 条引用来源，其中 2 条来自知乎', detail: 'Kimi · 最近一次采集 · 2026-10-03', tone: 'blue', action: '查看来源变化' },
  ]
  const queryRows = [
    ['有哪些支持知识图谱、来源可追溯的 AI 知识库工具？', '豆包', '80%', '1.8', '+8.2%', '稳定'],
    ['企业 RAG 知识库如何避免回答幻觉并保留来源？', 'DeepSeek', '40%', '3.2', '-12.4%', '需关注'],
    ['适合出海 SaaS 团队的企业知识库应该怎么选？', 'Kimi', '60%', '2.4', '+4.1%', '稳定'],
    ['What are alternatives to an AI knowledge base with cited answers?', '千问', '20%', '—', '-18.0%', '异常'],
  ]
  const platforms = [
    ['豆包', '58%', '42%', '1.9', '正常', 'mint'], ['元宝', '46%', '33%', '2.4', '正常', 'mint'], ['DeepSeek', '36%', '21%', '3.2', '需关注', 'amber'], ['Kimi', '48%', '39%', '2.1', '正常', 'mint'], ['千问', '31%', '18%', '3.8', '采集异常', 'red'],
  ]
  return <div className="monitoring-page">
    <section className="monitoring-hero"><div><span className="monitoring-kicker"><BellRing size={14}/>持续运营 · 项目范围已锁定</span><h2>持续监控 <em>{projectLabel}</em> 的 GEO 变化</h2><p>固定使用已审核的 Query 与首轮真实基线，持续追踪提及、推荐位置、引用来源和竞品变化。</p><div className="monitoring-scope"><span><CheckCircle2 size={14}/>18 个 Query</span><span><Globe2 size={14}/>5 个模型平台</span><span><Clock3 size={14}/>每日 09:00 运行</span></div></div><div className="monitoring-hero-actions"><b className="chip mint"><i/>运行中</b><button className="primary" onClick={() => notice('原型中已发起一次监控运行，后端接入后将开始采集。')}><Activity size={15}/>立即运行一次</button><button className="secondary" onClick={() => notice('原型中已打开监控计划设置。')}><Settings2 size={15}/>编辑监控计划</button><small>上次运行：2026-10-03 09:00 · 下次运行：2026-10-04 09:00</small></div></section>

    <section className="monitoring-kpi-grid" aria-label="核心指标"><article><span><Activity size={15}/>品牌提及率</span><strong>42.8%</strong><small className="positive">↑ 6.2% <i>较上周期</i></small></article><article><span><Globe2 size={15}/>引用率</span><strong>31.4%</strong><small className="positive">↑ 3.8% <i>较上周期</i></small></article><article><span><Target size={15}/>平均推荐位置</span><strong>2.6</strong><small className="positive">↓ 0.4 <i>位置更靠前</i></small></article><article><span><CircleAlert size={15}/>竞品领先次数</span><strong>7</strong><small className="negative">↑ 2 <i>需关注</i></small></article><article><span><BellRing size={15}/>待处理变化</span><strong>3</strong><small className="neutral">最近一次运行发现</small></article></section>

    <section className="monitoring-section-grid"><article className="monitor-card trend-card"><header><div><p className="monitor-eyebrow">Visibility trend</p><h3>可见度趋势</h3><small>固定基线范围 · {range} · 示例前端数据</small></div><div className="monitor-controls"><div>{['近 7 天', '近 30 天', '全部'].map(item => <button className={range === item ? 'selected' : ''} onClick={() => setRange(item)} key={item}>{item}</button>)}</div></div></header><div className="trend-legend"><span><i className="legend-indigo"/>提及率</span><span><i className="legend-teal"/>引用率</span><span><i className="legend-orange"/>平均位置</span></div><div className="trend-chart"><div className="chart-y"><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div><svg viewBox="0 0 760 220" role="img" aria-label="品牌提及率和引用率趋势图"><defs><linearGradient id="monitorArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6672ee" stopOpacity=".2"/><stop offset="1" stopColor="#6672ee" stopOpacity="0"/></linearGradient></defs><path className="chart-grid-line" d="M0 20H760M0 78H760M0 136H760M0 194H760"/><path className="trend-area" d="M0 144 C80 132 105 150 170 112 S270 128 330 91 S430 109 490 76 S610 84 760 38 V194 H0Z"/><path className="trend-line primary-line" d="M0 144 C80 132 105 150 170 112 S270 128 330 91 S430 109 490 76 S610 84 760 38"/><path className="trend-line teal-line" d="M0 166 C75 159 115 168 170 147 S270 151 330 134 S430 143 490 125 S620 129 760 99"/><circle className="trend-point" cx="760" cy="38" r="5"/><circle className="trend-point teal-point" cx="760" cy="99" r="5"/></svg><div className="chart-x"><span>09/27</span><span>09/29</span><span>10/01</span><span>10/03</span></div></div></article><article className="monitor-card alert-card"><header><div><p className="monitor-eyebrow">Changes to review</p><h3>异常与变化提醒</h3><small>按优先级处理变化，不把所有波动都当成异常</small></div><b className="chip amber">3 条待处理</b></header><div className="alert-list">{alerts.map((alert, index) => <button className={selectedAlert === index ? `alert-item selected ${alert.tone}` : `alert-item ${alert.tone}`} onClick={() => setSelectedAlert(index)} key={alert.title}><span className="alert-icon">{alert.tone === 'red' ? <CircleAlert size={16}/> : alert.tone === 'amber' ? <TrendingUp size={16}/> : <BellRing size={16}/>}</span><span><b>{alert.level}</b><strong>{alert.title}</strong><small>{alert.detail}</small></span><ChevronRight size={15}/></button>)}</div><div className="alert-detail"><span><CircleAlert size={14}/><b>{alerts[selectedAlert].action}</b></span><p>进入后可对比原始回答、引用链接和竞品位置，再决定是否加入内容机会或下一轮复测。</p><button className="text-button" onClick={() => notice(`原型中已打开：${alerts[selectedAlert].action}`)}>查看证据 <ArrowRight size={14}/></button></div></article></section>

    <section className="monitor-card query-monitor-card"><header><div><p className="monitor-eyebrow">Query monitoring</p><h3>Query 监控明细</h3><small>同一 Query 在不同运行批次的变化，可继续进入回答详情</small></div><div className="monitor-controls"><div>{['全部平台', '豆包', 'DeepSeek', 'Kimi', '千问'].map(item => <button className={platform === item ? 'selected' : ''} onClick={() => setPlatform(item)} key={item}>{item}</button>)}</div><button className="secondary" onClick={() => notice('原型中已打开 Query 变化筛选器。')}><Search size={14}/>筛选</button></div></header><div className="monitor-table-wrap"><table className="monitor-table"><thead><tr><th>Query</th><th>模型</th><th>提及率</th><th>推荐位置</th><th>较上周期</th><th>状态</th><th></th></tr></thead><tbody>{queryRows.filter(row => platform === '全部平台' || row[1] === platform).map(row => <tr key={row[0]}><td><b>{row[0]}</b><small>购买决策 · Dataset v1</small></td><td><span className="platform-label"><i/>{row[1]}</span></td><td><strong>{row[2]}</strong></td><td>{row[3]}</td><td className={row[4].startsWith('+') ? 'positive' : 'negative'}>{row[4]}</td><td><b className={row[5] === '稳定' ? 'chip mint' : row[5] === '异常' ? 'chip red' : 'chip amber'}>{row[5]}</b></td><td><button className="icon-button" onClick={() => notice(`原型中已打开 Query：${row[0]}`)} aria-label="查看 Query 详情"><ChevronRight size={15}/></button></td></tr>)}</tbody></table></div></section>

    <section className="monitoring-section-grid"><article className="monitor-card platform-card"><header><div><p className="monitor-eyebrow">Platform coverage</p><h3>模型平台分布</h3><small>不同平台的表现与采集状态分开披露</small></div><span className="fine">5 个平台</span></header><div className="platform-table"><div className="platform-row platform-head"><span>平台</span><span>提及率</span><span>引用率</span><span>平均位置</span><span>状态</span></div>{platforms.map(([name, mention, citation, rank, status, tone]) => <div className="platform-row" key={name}><span className="platform-label"><i/>{name}</span><strong>{mention}</strong><span>{citation}</span><span>{rank}</span><b className={`chip ${tone === 'mint' ? 'mint' : tone === 'red' ? 'red' : 'amber'}`}>{status}</b></div>)}</div></article><article className="monitor-card source-card"><header><div><p className="monitor-eyebrow">Source movement</p><h3>引用来源变化</h3><small>新增与消失的真实链接需要回到原始回答复核</small></div><button className="text-button" onClick={() => notice('原型中已打开完整来源变化。')}>查看全部 <ChevronRight size={14}/></button></header><div className="source-block"><b className="source-title added">新增引用 · 5 条</b><a href="https://example.com" target="_blank" rel="noreferrer"><Link2 size={13}/>example.com/guide/ai-knowledge-base <ArrowRight size={13}/></a><a href="https://example.com" target="_blank" rel="noreferrer"><Link2 size={13}/>zhihu.com/question/xxxx <ArrowRight size={13}/></a><a href="https://example.com" target="_blank" rel="noreferrer"><Link2 size={13}/>medium.com/ai-knowledge-base <ArrowRight size={13}/></a></div><div className="source-block"><b className="source-title removed">消失引用 · 2 条</b><a href="https://example.com" target="_blank" rel="noreferrer"><Link2 size={13}/>competitor.com/compare <ArrowRight size={13}/></a><a href="https://example.com" target="_blank" rel="noreferrer"><Link2 size={13}/>old-source.com/article <ArrowRight size={13}/></a></div></article></section>

    <section className="monitoring-footer-note"><ShieldCheck size={16}/><span><b>监控边界</b><small>当前为前端工作台示意。真实运行后将只展示当前项目、已审核 Query 和实际采集到的回答与链接；不会用示例结果替代真实数据。</small></span><button className="secondary" onClick={() => go('baseline')}>查看首轮基线 <ArrowRight size={14}/></button></section>
  </div>
}

function Research({ go, notice, projectId, onStartWriting }: { go: (screen: Screen) => void; notice: (value: string) => void; projectId: string | null; onStartWriting: (action: GeoGapAction) => void }) { return <CompetitorIntelligence go={go} notice={notice} projectId={projectId} onContinueWriting={onStartWriting}/> }
function Opportunity({ title, tags, go }: { title: string; tags: string; go: () => void }) { return <button className="opportunity" onClick={go}><i><Sparkles size={15}/></i><span><b>{title}</b><small>{tags}</small></span><ChevronRight size={16}/></button> }
function Assets({ go, notice: _notice, project }: { go: (screen: Screen) => void; notice: (value: string) => void; project: BrandDiagnosticProjectSummary | null }) { return <ProjectScopedPending project={project} title="整理当前项目的知识资产" description="事实、来源、禁止主张与内容版本必须归属于同一个产品项目。" actionLabel="查看项目档案" go={go} actionScreen="diagnostics"/> }

function Node({ className, icon, title, text }: { className: string; icon: ReactNode; title: string; text: string }) { return <div className={'node ' + className}><i>{icon}</i><b>{title}</b><small>{text}</small></div> }
function Checkline({ text, sub, warn }: { text: string; sub: string; warn?: boolean }) { return <div className={warn ? 'checkline warn' : 'checkline'}>{warn ? <CircleAlert size={17}/> : <CheckCircle2 size={17}/>}<span><b>{text}</b><small>{sub}</small></span></div> }
function Content({ go, notice }: { go: (screen: Screen) => void; notice: (value: string) => void }) { const [ready,setReady] = useState(false); return <><section className="module-hero"><div><b className="chip amber">证据驱动内容</b><h2>先定义要解决的 Query Gap，再生成渠道内容</h2><p>LLM 可以参与归纳、改写和草稿生成，但不能绕过事实、来源、渠道规则和人工审核。</p></div><button className="primary" onClick={() => setReady(true)}><Plus size={15}/>创建 Content Brief</button></section><section className="content-grid"><article><Title eyebrow="01 · 选择问题缺口" title="来源可追溯型知识库的选型问题"/><Brief icon={<SearchCheck size={16}/>} label="目标 Query Cluster" text="工具筛选 · 可信回答 · 知识图谱"/><Brief icon={<Radar size={16}/>} label="诊断结论" text="品牌未出现，竞品被对比页与文档引用"/><Brief icon={<BookOpenCheck size={16}/>} label="可用证据" text="6 条已审核产品事实 · 3 个来源链接"/></article><article><Title eyebrow="02 · 定义内容动作" title="先写 Brief，再生成草稿"/><div className="tabs"><b>官网 Comparison</b><span>知乎</span><span>Help Center</span><span>LinkedIn</span></div><label className="input-field wide"><b>内容目标</b><textarea defaultValue="解释企业如何选择支持知识图谱上下文和来源可追溯回答的 AI 知识库，并清楚说明适用场景与验证方式。"/></label><p className="brief-note">禁止主张：行业第一、未验证 ROI　·　CTA：查看来源可追溯方案</p><button className="mini-primary" onClick={() => {setReady(true);notice('Brief 已就绪：可在人工审核后生成草稿。')}}>{ready ? 'Brief 已就绪' : '保存并准备草稿'} <ArrowRight size={13}/></button></article><article><Title eyebrow="03 · 草稿与审核" title="发布前必须保留人工审核"/><div className={ready ? 'draft ready' : 'draft'}><header><b className="chip purple">{ready ? '待审核草稿' : '需要先完成 Brief'}</b><small>{ready ? '模型 / 提示词 / 证据映射已记录' : '草稿生成尚未启用'}</small></header><h3>{ready ? '如何评估支持知识图谱和来源追溯的企业 AI 知识库' : 'Content Brief 是草稿生成的前置条件'}</h3><p>{ready ? '草稿中的能力主张会标注引用来源；受限或缺少证据的主张会被高亮，不能直接进入发布登记。' : '选择一个已诊断的 Query Gap，绑定证据与渠道规则，才可以生成可审核的草稿。'}</p><button className="secondary" disabled={!ready} onClick={() => notice('原型模式：草稿已标记为待审核，未创建发布动作。')}>生成可审核草稿</button></div></article></section><ChannelPlan notice={notice}/><section className="publish"><ShieldCheck size={19}/><span><b>发布不是自动动作</b><small>审核通过后，系统只登记人工确认的发布 URL、渠道与时间；随后才能用相同 Query 数据集安排复测。</small></span><button className="secondary" onClick={() => go('reports')}>查看复测报告结构</button></section></> }
function Brief({ icon, label, text }: { icon: ReactNode; label: string; text: string }) { return <div className="brief"><i>{icon}</i><span><small>{label}</small><b>{text}</b></span><CheckCircle2 size={16}/></div> }
type ReportCenterFilter = '全部' | '基线诊断' | '竞品与引用' | '持续监控' | '发布后复测'
type ReportCenterStatus = '已审核' | '待复核' | '草稿' | '待采集'
type ReportCenterRecord = { id: string; title: string; type: Exclude<ReportCenterFilter, '全部'>; description: string; scope: string; updatedAt: string; status: ReportCenterStatus; icon: LucideIcon; accent: 'blue' | 'mint' | 'amber' | 'purple'; metrics: Array<[string, string, string]>; sections: string[] }

function reportStatusClass(status: ReportCenterStatus) {
  if (status === '已审核') return 'mint'
  if (status === '待复核') return 'amber'
  if (status === '待采集') return 'red'
  return 'blue'
}

function Reports({ go, notice, project }: { go: (screen: Screen) => void; notice: (value: string) => void; project: BrandDiagnosticProjectSummary | null }) {
  const [filter, setFilter] = useState<ReportCenterFilter>('全部')
  const [selectedId, setSelectedId] = useState('baseline')
  const projectName = project?.brandName || project?.name || '当前项目'
  const coverage = project?.coverage.rate == null ? '待接入' : `${Math.round(project.coverage.rate * 100)}%`
  const records: ReportCenterRecord[] = [
    { id: 'baseline', title: 'GEO 基线诊断报告', type: '基线诊断', description: '汇总首轮真实平台测试、品牌提及、引用来源与可行动缺口。', scope: `${project?.queryScope?.expectedCount || 32} Query · ${project?.collectionPlan?.providers.length || 5} 个模型平台`, updatedAt: '2026-10-03 09:40', status: '已审核', icon: LineChart, accent: 'blue', metrics: [['品牌提及率', '42.8%', '示意'], ['自有引用率', '31.4%', '示意'], ['平均推荐位', '2.6', '示意'], ['高价值缺口', '7', '示意']], sections: ['执行摘要与结论', 'Query 维度可见度', '模型回答与引用证据', '竞品差距与行动建议'] },
    { id: 'competitor', title: 'Query 竞品与引用研究', type: '竞品与引用', description: '按同一 Query 对比不同回答链接，拆解竞品被提及和被引用的原因。', scope: '18 Query · 42 条引用 · 12 个竞品链接', updatedAt: '2026-10-02 16:20', status: '待复核', icon: Radar, accent: 'mint', metrics: [['竞品出现率', '68.2%', '示意'], ['引用来源数', '42', '已归档'], ['优势 Query', '11', '示意'], ['待复核链接', '6', '需要人工']], sections: ['Query 对比结论', '竞品文章结构', '引用来源变化', '内容切入建议'] },
    { id: 'monitoring', title: '持续监控周报 · W40', type: '持续监控', description: '追踪基线后的模型回答变化、异常 Query 与引用来源增减。', scope: '32 Query · 5 平台 · 近 7 天', updatedAt: '2026-10-01 18:00', status: '草稿', icon: BellRing, accent: 'amber', metrics: [['整体可见度', '+4.6%', '较上周期'], ['变化 Query', '9', '需要查看'], ['新增引用', '14', '示意'], ['异常提醒', '3', '待处理']], sections: ['核心指标趋势', '异常与变化提醒', 'Query 监控明细', '模型平台分布'] },
    { id: 'retest', title: '发布后复测交付报告', type: '发布后复测', description: '对已人工发布的内容登记 URL，并使用同一 Query 集进行前后对比。', scope: '8 Query · 3 个发布链接 · 1 个复测批次', updatedAt: '2026-09-30 14:10', status: '待采集', icon: RefreshCw, accent: 'purple', metrics: [['待复测链接', '3', '需要人工确认'], ['复测 Query', '8', '已锁定'], ['基线版本', 'v1', '已固定'], ['可比性', '待采集', '尚未形成']], sections: ['发布链接登记', '复测范围确认', '前后指标对比', '交付结论与限制'] },
  ]
  const visibleRecords = filter === '全部' ? records : records.filter((record) => record.type === filter)
  const selected = records.find((record) => record.id === selectedId) || records[0]
  const projectScope = project ? `${projectName} · ${project.markets.join(' / ') || '未设置市场'}` : '尚未选择项目'

  if (!project) return <ProjectScopedPending project={project} title="查看当前项目的 GEO 基线与交付记录" description="报告必须从当前项目的真实测试、已审核证据和后续复测生成。" actionLabel="查看 GEO 诊断与基线" go={go} actionScreen="diagnostics"/>

  return <div className="reports-center">
    <section className="reports-center-hero">
      <div className="reports-hero-copy"><div className="reports-kicker"><FileStack size={14}/>报告交付与历史记录中心</div><h2>让每一份 GEO 结论都有数据范围和证据出处</h2><p>统一查看当前项目的基线诊断、Query 竞品研究、持续监控和发布后复测。报告只读当前项目的数据，生成后仍需人工审核与交付。</p><div className="reports-hero-meta"><span><i><Globe2 size={13}/></i>{projectScope}</span><span><i><DatabaseIcon size={13}/></i>{project.queryScope?.datasetVersionLabel || 'Dataset v1'} · 数据边界已启用</span></div><div className="reports-hero-actions"><button className="primary" onClick={() => notice('原型中已创建一份报告草稿，未生成外发链接。')}><Plus size={15}/>生成报告草稿</button><button className="secondary" onClick={() => go('report')}><Eye size={15}/>查看当前基线</button></div></div>
      <aside className="reports-hero-status"><div className="reports-status-top"><span>最新交付状态</span><b className="chip mint">可查看</b></div><strong>GEO 基线诊断报告</strong><p>Dataset v1 · 2026-10-03 更新</p><div className="reports-status-line"><span><b>4</b>份报告记录</span><span><b>{coverage}</b>数据覆盖</span></div><button className="text-button" onClick={() => { setSelectedId('baseline'); setFilter('全部') }}>打开最新报告 <ChevronRight size={14}/></button></aside>
    </section>

    <div className="reports-prototype-note"><ShieldCheck size={15}/><span><b>数据边界说明</b>以下数字与记录是前端原型展示，用于确认报告中心的布局和阅读逻辑；后端接入后将替换为当前项目的真实报告实体。</span><b>不自动外发</b></div>

    <section className="reports-kpi-grid" aria-label="报告状态概览"><article><span><FileCheck2 size={16}/></span><small>已生成报告</small><strong>4</strong><em>覆盖 4 类交付场景</em></article><article><span className="amber"><Clock3 size={16}/></span><small>待审核报告</small><strong>2</strong><em>需要人工复核后交付</em></article><article><span className="mint"><CheckCircle2 size={16}/></span><small>已完成基线</small><strong>1</strong><em>可作为复测比较起点</em></article><article><span className="purple"><Link2 size={16}/></span><small>待处理交付项</small><strong>5</strong><em>发布链接与引用需确认</em></article></section>

    <section className="reports-section-heading"><div><span className="section-eyebrow">报告列表</span><h3>报告资料库</h3><p>先按类型找到交付物，再在右侧查看范围、状态和内容结构。</p></div><div className="reports-heading-actions"><span><Filter size={14}/>筛选</span><button className="secondary" onClick={() => notice('原型中已刷新当前项目的报告列表。')}><RefreshCw size={14}/>刷新列表</button></div></section>
    <div className="reports-filter-tabs" role="tablist" aria-label="报告类型筛选">{(['全部', '基线诊断', '竞品与引用', '持续监控', '发布后复测'] as ReportCenterFilter[]).map((item) => <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? 'selected' : ''} onClick={() => { setFilter(item); const next = records.find((record) => item === '全部' || record.type === item); if (next) setSelectedId(next.id) }}>{item}<b>{item === '全部' ? records.length : records.filter((record) => record.type === item).length}</b></button>)}</div>

    <section className="reports-library-layout">
      <div className="reports-records" aria-label="报告列表">{visibleRecords.map((record) => { const Icon = record.icon; return <button type="button" className={selected.id === record.id ? `reports-record selected ${record.accent}` : `reports-record ${record.accent}`} key={record.id} onClick={() => setSelectedId(record.id)}><span className="reports-record-icon"><Icon size={17}/></span><span className="reports-record-main"><b>{record.title}</b><small>{record.description}</small><em><span>{record.type}</span><span>{record.scope}</span></em></span><span className={`chip ${reportStatusClass(record.status)}`}>{record.status}</span><ChevronRight className="reports-record-chevron" size={16}/></button> })}</div>
      <aside className="reports-detail-panel"><div className="reports-detail-heading"><div><span className="section-eyebrow">报告预览</span><h3>{selected.title}</h3><p>{selected.description}</p></div><span className={`chip ${reportStatusClass(selected.status)}`}>{selected.status}</span></div><div className="reports-detail-meta"><span><Clock3 size={13}/>更新时间 <b>{selected.updatedAt}</b></span><span><DatabaseIcon size={13}/>数据范围 <b>{selected.scope}</b></span></div><div className="reports-detail-metrics">{selected.metrics.map(([label, value, note]) => <div key={label}><small>{label}</small><strong>{value}</strong><span>{note}</span></div>)}</div><div className="reports-detail-section"><div><b>报告结构</b><small>打开报告后将按以下模块阅读</small></div><ol>{selected.sections.map((section, index) => <li key={section}><i>{String(index + 1).padStart(2, '0')}</i><span>{section}</span><ChevronRight size={13}/></li>)}</ol></div><div className="reports-detail-actions"><button className="primary" onClick={() => notice(`原型中已打开“${selected.title}”详情预览。`)}><Eye size={14}/>查看报告</button><button className="secondary" onClick={() => notice('原型中已导出报告草稿，未创建下载文件。')}><Download size={14}/>导出草稿</button><button className="icon-button" aria-label="更多报告操作" onClick={() => notice('原型中可继续编辑、复制或归档报告。')}><MoreHorizontalIcon size={16}/></button></div></aside>
    </section>

    <section className="reports-process-card"><div><span className="section-eyebrow">交付流程</span><h3>从数据到交付，四步完成一份可追溯报告</h3><p>报告中心只负责整理和呈现证据；不会自动发布、自动外发，也不会替你替换人工判断。</p></div><div className="reports-process-steps"><div className="done"><i>01</i><span><b>基线采集</b><small>真实回答与引用</small></span></div><div className="done"><i>02</i><span><b>证据审核</b><small>链接与主张确认</small></span></div><div className="active"><i>03</i><span><b>报告生成</b><small>形成可读草稿</small></span></div><div><i>04</i><span><b>人工交付</b><small>审核后对外使用</small></span></div></div></section>
  </div>
}

function DatabaseIcon(props: { size?: number }) { return <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></svg> }
function MoreHorizontalIcon(props: { size?: number }) { return <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg> }

function ReportItem({ title, text, status, date, action, go }: { title: string; text: string; status: string; date: string; action: string; go: () => void }) { return <article><i><FileText size={20}/></i><span><b>{title}</b><small>{text}</small><em><Clock3 size={13}/>{date}</em></span><strong className={status === '已完成' ? 'chip mint' : 'chip amber'}>{status}</strong><button className="secondary" onClick={go}>{action}<ChevronRight size={14}/></button></article> }
function Harness({ go, notice }: { go: (screen: Screen) => void; notice: (value: string) => void }) { const cards = [[Bot,'模型连接与凭据','2 个待配置','管理官方 API、企业网关和 MCP 适配器。凭据只保存为安全引用，前端不读取明文。','管理连接'],[Upload,'受控人工批量导入','MVP 已就绪','导出任务，导入已授权环境中获得的真实回答与引用链接，形成审计证据。','查看导入规范'],[Activity,'执行队列与失败恢复','0 个异常','仅在真实授权连接存在时，显示自动执行单元、限流、重试和失败恢复。','查看执行概览'],[ShieldCheck,'审计、角色与留存','已启用','隔离工作区、记录关键操作，并用角色分离配置、审核和查看权限。','打开治理设置']] as const; return <><section className="harness-hero"><div><b><ShieldCheck size={14}/>管理员区域</b><h2>Harness 负责执行与治理，不抢占业务用户的诊断入口</h2><p>将模型连接、受控人工导入、队列、失败恢复、凭据与审计留在这里；业务用户只需从“品牌诊断”进入流程。</p></div><button className="primary" onClick={() => go('connections')}><Plus size={15}/>添加模型连接</button></section><section className="harness-cards">{cards.map(([Icon,title,status,text,action], index) => <article key={title}><i className={'harness-icon h' + index}><Icon size={19}/></i><b className={index === 1 || index === 3 ? 'chip mint' : index === 0 ? 'chip amber' : 'chip blue'}>{status}</b><h3>{title}</h3><p>{text}</p><button className="text-button" onClick={() => title === '模型连接与凭据' ? go('connections') : notice(`原型中已打开“${title}”。`)}>{action} <ChevronRight size={14}/></button></article>)}</section><section className="admin-boundary"><LockKeyhole size={18}/><span><b>安全执行边界</b><small>系统不会自动登录模型网页、绕过 CAPTCHA、抓取受保护的模型界面或规避平台条款。没有授权连接时，保持人工受控路径。</small></span></section></> }
function ChannelPlan({ notice }: { notice: (value: string) => void }) { const [channel, setChannel] = useState('官网 Blog'); const channelRows = [['官网 Blog','教育型长文','可引用事实 + 内链','待生成'],['Help Center','操作指南','产品事实 + 截图证明','待生成'],['Comparison Page','对比页','竞品证据 + 禁止主张','待审核'],['知乎 / 公众号','中文观点文章','来源链接 + 合规表述','待生成'],['Medium / LinkedIn','英文洞察内容','en-US 术语与 CTA','待生成']]; return <section className="table-card"><Title eyebrow="渠道内容计划" title="一个 Content Brief，生成多个渠道的可审核草稿" action={<span className="fine"><FileCheck2 size={14}/>草稿不等于已发布</span>}/><div className="provider-pills">{channelRows.map(([name]) => <button onClick={() => setChannel(name)} className={channel === name ? 'selected' : ''} key={name}>{name}</button>)}</div><DataTable headers={['渠道','内容形态','生成约束','状态']} rows={channelRows}/><div className="method"><PenLine size={18}/><span><b>当前编辑：{channel}</b><small>生成前必须继承目标 Query 集、证据包、允许 / 禁止主张、渠道格式、CTA、链接策略和人工验收标准。</small></span><button className="secondary" onClick={() => notice('原型中已创建渠道待审核草稿。')}>生成待审核草稿</button></div></section> }
function ReportBuilder({ notice }: { notice: (value: string) => void }) { const [scope, setScope] = useState('基线诊断'); return <section className="report-builder"><Title eyebrow="报告生成器" title="配置交付范围，而不是直接输出漂亮数字" action={<b className="chip blue">草稿</b>}/><div className="provider-pills">{['基线诊断','平台测试明细','竞品与引用','内容发布后复测'].map((item) => <button key={item} className={scope === item ? 'selected' : ''} onClick={() => setScope(item)}>{item}</button>)}</div><div className="report-builder-grid"><article><b>报告包含</b><ul><li><Check size={14}/>Query Dataset 版本、市场、模型和采集时间</li><li><Check size={14}/>提及率、引用率、推荐率的定义和分母披露</li><li><Check size={14}/>原始回答 / 规范化分析 / 人工复核之间的区分</li></ul></article><article><b>当前范围：{scope}</b><ul><li><Check size={14}/>观测与证据：18 条</li><li><Check size={14}/>待采集项：334 条，单独披露</li><li><Check size={14}/>发布后复测：需先登记人工确认的 URL</li></ul></article></div><button className="primary" onClick={() => notice('原型中已生成报告草稿，未创建外发链接。')}><FileText size={15}/>生成报告草稿</button></section> }

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row,index) => <tr key={index}>{row.map((cell,cellIndex) => <td key={cellIndex}>{cellIndex === row.length - 1 ? <b className={cell === '已审核' || cell === '稳定' ? 'chip mint' : cell === '禁止发布' ? 'chip red' : 'chip amber'}>{cell}</b> : cell}</td>)}</tr>)}</tbody></table></div> }









