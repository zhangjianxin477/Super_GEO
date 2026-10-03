import { useState } from 'react'
import type { FormEvent } from 'react'
import { createDemoWorkspaceSession } from './BrandDiagnostics'
import {
  ArrowRight, ArrowUpRight, BarChart3, BookOpenCheck, Bot, Check, ChevronDown,
  CircleUserRound, FileSearch, FileText, Gauge, Globe2, Layers3, LineChart, Link2,
  Menu, Network, RefreshCw, Search, ShieldCheck, Sparkles, Target, Users, X,
} from 'lucide-react'

type LandingPageProps = { onEnterWorkspace: () => void }
type InfoMode = 'deck' | 'demo' | null

const platforms = [
  ['豆包', '真实回答'], ['元宝', '联网检索'], ['DeepSeek', '深度推理'], ['Kimi', '长文理解'], ['千问', '企业场景'],
]
const faqs = [
  ['GEO 是什么？为什么现在需要关注？', 'GEO 是面向 AI 回答场景的品牌可见度优化。它关心品牌是否被提及、排在什么位置，以及模型引用了哪些来源。随着用户把“怎么选”“哪个更适合”交给模型，品牌是否进入回答就成为决策链上的一环。'],
  ['支持哪些模型平台？', '当前工作台支持对豆包、元宝、DeepSeek、Kimi、千问等平台进行真实回答采集与对比。平台连接与采集范围会按项目记录，后续可以继续扩展更多授权平台。'],
  ['一次 Query 会分析什么？', '系统会保留原始回答、模型提及、品牌与竞品位置、引用链接、来源类型和采集时间，再将这些证据聚合成 Query 维度的可见度与差距判断。'],
  ['可以同时追踪竞品吗？', '可以。竞品、产品事实、Query 和引用链接都在同一个项目内管理，方便在同一问题下横向比较，避免不同页面使用不同口径。'],
  ['多久可以看到第一份结果？', '完成项目配置并接入可用的模型连接后，可以先从小批量 Query 开始验证。页面中的时间与指标为工作台示意，不代表对所有平台或项目的固定承诺。'],
  ['系统会自动发布内容吗？', '不会。系统负责基于真实证据生成内容策略、Markdown 素材与渠道准备，并提供对应平台的发布入口；最终由人确认内容后，手动点击平台完成发布。'],
  ['发布后如何验证效果？', '发布完成后，将已发布 URL 登记回项目，再用同一批 Query 和相同的模型范围做复测，比较提及、排名、引用和竞品变化。'],
  ['产品数据和项目数据会同步吗？', '项目是业务边界，产品档案是项目内的事实来源。Query、竞品、回答证据、内容草稿和发布记录都绑定到同一个项目，减少上下游数据漂移。'],
]

export function LandingPage({ onEnterWorkspace }: LandingPageProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showInfo, setShowInfo] = useState<InfoMode>(null)
  const [faqOpen, setFaqOpen] = useState(0)
  const [loginError, setLoginError] = useState('')
  const [loginPending, setLoginPending] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const openLogin = () => { setMobileOpen(false); setLoginError(''); setLoginSuccess(false); setShowLogin(true) }
  const closeLogin = () => { if (!loginPending) { setShowLogin(false); setLoginError(''); setLoginSuccess(false) } }
  const fillDemoAccount = () => { setLoginError(''); const email = document.querySelector<HTMLInputElement>('.login-card input[name="email"]'); const password = document.querySelector<HTMLInputElement>('.login-card input[name="password"]'); if (email) email.value = 'demo@geo-compass.local'; if (password) password.value = 'demo1234' }
  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loginPending) return
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const password = String(form.get('password') ?? '')
    if (!email || !email.includes('@') || !email.includes('.')) { setLoginError('请输入有效的工作邮箱，例如 demo@geo-compass.local。'); return }
    if (password.length < 4) { setLoginError('访问密码至少需要 4 位字符。'); return }
    setLoginPending(true); setLoginError('')
    try {
      await createDemoWorkspaceSession(email)
      setLoginSuccess(true)
      window.setTimeout(() => { setShowLogin(false); setLoginSuccess(false); onEnterWorkspace() }, 320)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '演示工作区创建失败，请确认本地 API（8787）已启动。')
    } finally { setLoginPending(false) }
  }
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return <div className="ab-landing">
    <header className="ab-nav">
      <a className="ab-logo" href="#top"><span className="ab-logo-mark"><LineChart size={19}/></span><strong>GEO Compass</strong><small>Evidence-led visibility</small></a>
      <nav className={mobileOpen ? 'ab-nav-links open' : 'ab-nav-links'}>
        <a href="#product" onClick={() => setMobileOpen(false)}>产品能力</a><a href="#workflow" onClick={() => setMobileOpen(false)}>工作流程</a><a href="#stories" onClick={() => setMobileOpen(false)}>应用场景</a><a href="#faq" onClick={() => setMobileOpen(false)}>常见问题</a>
      </nav>
      <div className="ab-nav-right"><button className="ab-doc-link" onClick={() => setShowInfo('deck')}><BookOpenCheck size={15}/>产品文档</button><button className="ab-lang">简体中文 <ChevronDown size={13}/></button><button className="ab-login-link" onClick={openLogin}><CircleUserRound size={16}/>登录</button><button className="ab-nav-cta" onClick={openLogin}>立即体验 <ArrowRight size={14}/></button></div>
      <button className="ab-menu" onClick={() => setMobileOpen((value) => !value)} aria-label="打开菜单">{mobileOpen ? <X size={20}/> : <Menu size={20}/>}</button>
    </header>

    <main id="top">
      <section className="ab-hero">
        <div className="ab-hero-bg"><div className="hero-grid"/><div className="hero-glow hero-glow-one"/><div className="hero-glow hero-glow-two"/><div className="hero-scanline"/></div>
        <div className="ab-hero-content"><div className="ab-new-pill"><span>NEW</span> GEO Compass 产品介绍与工作台 <ArrowUpRight size={13}/></div><h1>让每一条品牌信息，<br/><em>成为模型回答里的可信依据。</em></h1><p>五大主流模型真实采集，持续追踪品牌提及、排名与引用来源，让 GEO 增长看得见、说得清、能复测。</p><div className="ab-hero-actions"><button className="ab-main-cta" onClick={openLogin}>立即体验 <ArrowRight size={16}/></button><button className="ab-ghost-cta" onClick={() => setShowInfo('deck')}>查看产品介绍 <ArrowUpRight size={15}/></button></div><div className="ab-hero-note"><ShieldCheck size={14}/>真实平台优先 · 数据留档 · 人工完成发布</div></div>
        <div className="ab-hero-orbit orbit-one"/><div className="ab-hero-orbit orbit-two"/>
        <div className="ab-hero-figure" aria-label="工作台示意图"><div className="mockup-window-bar"><span/><span/><span/><small>GEO Compass / 可见度基线</small></div><div className="mockup-layout"><div className="mockup-side"><b>项目导航</b><i className="active">◈ 总览</i><i>⌁ Query 研究</i><i>⌁ 竞品分析</i><i>⌁ 内容准备</i></div><div className="mockup-main"><div className="figure-title"><span>品牌可见度</span><small>近 7 天 · 示例数据</small></div><div className="mockup-kpis"><strong>38.4<span>%</span></strong><b>+8.2%</b><small>较上周期</small></div><div className="figure-line"><svg viewBox="0 0 440 115" aria-hidden="true"><path d="M4 98 C45 90 61 95 91 71 S149 86 183 58 S245 72 275 44 S329 58 365 25 S401 42 437 9"/><circle cx="365" cy="25" r="5"/><circle cx="437" cy="9" r="5"/></svg></div><div className="figure-foot"><span><Link2 size={12}/>引用来源 <b>16%</b></span><span><Target size={12}/>推荐位置 <b>Top 3</b></span></div><div className="mockup-table"><span><i className="green-dot"/>豆包 <b>已提及</b></span><span><i className="blue-dot"/>DeepSeek <b>引用 4</b></span><span><i className="purple-dot"/>Kimi <b>竞品领先</b></span></div></div></div></div>
      </section>

      <section className="ab-platform-strip"><div className="platform-kicker"><span>天级追踪 · 每日自动采集</span><p>并行覆盖主流模型平台，持续扩展</p></div><div>{platforms.map(([platform, descriptor]) => <span key={platform}><i/ ><strong>{platform}</strong><small>{descriptor}</small></span>)}</div></section>
      <section className="ab-social-proof"><div><strong>10,000<span>+</span></strong><small>可纳入追踪的 Query</small></div><div><strong>5</strong><small>并行采集平台</small></div><div><strong>4</strong><small>证据分析维度</small></div><div><strong>1</strong><small>从追踪到复测的闭环</small></div></section>
      <section className="ab-trust"><div className="ab-section-heading centered"><p className="ab-overline">For evidence-led teams</p><h2>让每个需要做判断的团队，<em>共享同一份事实。</em></h2><p>不虚构客户 Logo，用真实工作角色和产品场景说明 GEO Compass 适合谁。</p></div><div className="trust-logos"><span><i className="trust-symbol indigo">◎</i><b>品牌增长</b></span><span><i className="trust-symbol teal">⌁</i><b>内容策略</b></span><span><i className="trust-symbol violet">◈</i><b>产品市场</b></span><span><i className="trust-symbol orange">✦</i><b>研究分析</b></span><span><i className="trust-symbol blue">▱</i><b>B2B SaaS</b></span><span><i className="trust-symbol green">＋</i><b>企业知识库</b></span></div></section>

      <section className="ab-belief"><div className="belief-orb"/><p className="ab-overline">Why GEO matters</p><h2>品牌不被模型推荐，<br/><em>就等于缺席决策链。</em></h2><p>把 AI 回答从一个无法解释的黑盒，变成可以追踪、分析、行动和复测的增长通道。</p><div className="belief-points"><span><Gauge size={17}/>可量化</span><span><FileSearch size={17}/>有证据</span><span><RefreshCw size={17}/>能复测</span></div></section>

      <section className="ab-section" id="product"><div className="ab-section-heading"><p className="ab-overline">The platform</p><h2>把黑盒回答，<br/><em>变成可行动的增长信号。</em></h2><p>从采集到分析，再到内容准备与发布后复测，将 GEO 工作拆成团队真正能执行的步骤。</p></div><div className="ab-product-grid"><article className="ab-product-card"><div className="ab-card-head"><span className="ab-card-index">01</span><span className="ab-card-label">TRACK</span></div><div className="ab-card-icon blue"><Globe2 size={23}/></div><h3>多平台真实追踪</h3><p>基于授权连接或受控人工流程，记录模型原始回答、采集时间与平台状态。</p><ul><li><Check size={14}/>Query 批量追踪</li><li><Check size={14}/>原始回答留档</li></ul></article><article className="ab-product-card"><div className="ab-card-head"><span className="ab-card-index">02</span><span className="ab-card-label">ANALYZE</span></div><div className="ab-card-icon purple"><BarChart3 size={23}/></div><h3>回答与引用分析</h3><p>识别品牌提及、竞品位置、引用链接与来源类型，按 Query 对比差距。</p><ul><li><Check size={14}/>可见度与排名</li><li><Check size={14}/>引用来源分析</li></ul></article><article className="ab-product-card"><div className="ab-card-head"><span className="ab-card-index">03</span><span className="ab-card-label">OPTIMIZE</span></div><div className="ab-card-icon green"><Search size={23}/></div><h3>内容优化与发布准备</h3><p>基于高引用范文与真实竞品证据，形成内容策略、Markdown 素材与人工投放入口。</p><ul><li><Check size={14}/>内容机会清单</li><li><Check size={14}/>人工发布入口</li></ul></article><article className="ab-product-card"><div className="ab-card-head"><span className="ab-card-index">04</span><span className="ab-card-label">COLLABORATE</span></div><div className="ab-card-icon orange"><Users size={23}/></div><h3>多团队、多产品协作</h3><p>项目隔离产品事实、Query、竞品、证据和内容，保证上下游使用同一份数据。</p><ul><li><Check size={14}/>项目级数据边界</li><li><Check size={14}/>可追溯协作记录</li></ul></article></div></section>

      <section className="ab-workbench-preview"><div className="preview-copy"><p className="ab-overline">Inside the workspace</p><h2>不只是一份报告，<br/><em>而是一套可以继续行动的证据。</em></h2><p>从一个 Query 进入，沿着回答、链接、竞品和内容动作一路追溯。每个判断都能回到原始证据。</p><button className="text-link" onClick={openLogin}>进入工作台预览 <ArrowRight size={15}/></button></div><div className="preview-board"><div className="preview-board-header"><span><span className="status-dot"/> Query 研究 / 竞品对比</span><small>已同步 · 2026-10-02</small></div><div className="preview-query"><Search size={14}/><span>适合企业团队的 AI 知识库应该怎么选？</span><b>高优先级</b></div><div className="preview-columns"><div><small>回答提及</small><strong>豆包 · 4/5</strong><div className="meter"><i style={{width:'78%'}}/></div><span>品牌进入推荐列表</span></div><div><small>引用来源</small><strong>12 条可追溯链接</strong><div className="source-stack"><i>官网</i><i>知乎</i><i>媒体</i><i>+9</i></div><span>按来源类型归档</span></div><div><small>竞品位置</small><strong>第 2 位</strong><div className="rank-list"><span>1 <b>竞品 A</b></span><span className="selected">2 <b>你的品牌</b></span><span>3 <b>竞品 B</b></span></div></div></div><div className="preview-bottom"><span><Bot size={14}/>5 个模型回答已归档</span><span><Link2 size={14}/>引用链接可复核</span><span><FileText size={14}/>进入内容机会</span></div></div></section>

      <section className="ab-loop" id="workflow"><div><p className="ab-overline">A repeatable loop</p><h2>四步形成可复用的<br/><em>GEO 增长闭环。</em></h2><p>每一次采集都会沉淀为下一次判断的依据，避免只做一次性的“看报告”。</p></div><div className="ab-loop-list"><div><b>01</b><span><strong>配置追踪范围</strong><small>创建产品项目，添加竞品与代表性 Query。</small></span><ArrowRight size={16}/></div><div><b>02</b><span><strong>采集多模型回答</strong><small>真实平台并行采集，保存原始回答和可见链接。</small></span><ArrowRight size={16}/></div><div><b>03</b><span><strong>分析可见度差距</strong><small>查看提及率、排名、引用来源和竞品优势。</small></span><ArrowRight size={16}/></div><div><b>04</b><span><strong>优化并验证效果</strong><small>人工发布内容，回到同一批 Query 做复测。</small></span><ArrowRight size={16}/></div></div></section>

      <section className="ab-audience"><div className="ab-section-heading centered"><p className="ab-overline">Built for real teams</p><h2>不同角色，<em>共享同一份证据。</em></h2><p>不再让市场、内容和产品各自维护一套结论。</p></div><div className="audience-grid"><article><Sparkles size={20}/><h3>市场与增长</h3><p>知道品牌在哪些高价值问题里缺席，优先处理真正影响决策的 Query。</p></article><article><PenLineIcon/><h3>内容团队</h3><p>从竞品引用和来源结构中找到选题，直接生成可审核的内容素材。</p></article><article><Network size={20}/><h3>产品与研究</h3><p>将产品事实、竞品差异和模型反馈放到同一个可追溯项目里。</p></article></div></section>

      <section className="ab-stories" id="stories"><div className="ab-section-heading centered"><p className="ab-overline">Use cases</p><h2>让团队从“感觉”<br/><em>走向有依据的动作。</em></h2></div><div className="story-grid"><article className="story-card"><span>01 / 基线</span><h3>先回答：品牌现在被谁看见？</h3><p>以同一批 Query 对比不同模型的提及、排名和引用，建立可复查的起点。</p><a onClick={() => scrollTo('product')}>查看追踪能力 <ArrowUpRight size={14}/></a></article><article className="story-card featured"><span>02 / 研究</span><h3>再回答：竞品为什么排在前面？</h3><p>拆解竞品被引用的页面结构、事实表达与来源组合，形成内容机会。</p><a onClick={() => scrollTo('workflow')}>查看分析闭环 <ArrowUpRight size={14}/></a></article><article className="story-card"><span>03 / 复测</span><h3>最后回答：发布之后有没有变化？</h3><p>登记人工发布的 URL，回到原 Query 做复测，让一次内容动作有前后对照。</p><a onClick={openLogin}>进入工作台 <ArrowUpRight size={14}/></a></article></div></section>

      <section className="ab-flywheel"><div className="flywheel-copy"><p className="ab-overline">Evidence flywheel</p><h2>从一次采集，<br/><em>积累持续增长的依据。</em></h2><p>每次回答、每个引用、每次发布后的复测，都会沉淀到项目中，成为下一次优化的上下文。</p></div><div className="flywheel-stats"><div><strong>Query</strong><span>统一问题集</span></div><div><strong>Answer</strong><span>原始回答留档</span></div><div><strong>Source</strong><span>引用链接可复核</span></div><div><strong>Action</strong><span>内容与发布准备</span></div></div></section>

      <section className="ab-faq ab-section" id="faq"><div className="ab-section-heading centered"><p className="ab-overline">FAQ</p><h2>把关心的问题，<em>一次讲清楚。</em></h2><p>先了解系统如何采集、分析与协作，再进入工作台验证自己的项目。</p></div><div className="ab-faq-list">{faqs.map(([question, answer], index) => <div className={faqOpen === index ? 'ab-faq-item open' : 'ab-faq-item'} key={question}><button onClick={() => setFaqOpen(faqOpen === index ? -1 : index)}><span>{question}</span><ChevronDown size={18}/></button>{faqOpen === index && <p>{answer}</p>}</div>)}</div></section>
      <section className="ab-final"><p className="ab-overline">When answers become decisions</p><h2>从一个重要 Query 开始，<br/><em>让品牌被正确理解。</em></h2><p>建立你的第一个产品项目，先用小批量真实回答验证工作台结构。</p><div className="final-actions"><button className="ab-main-cta light" onClick={openLogin}>立即体验 <ArrowRight size={16}/></button><button className="ab-final-secondary" onClick={() => setShowInfo('demo')}>预约产品演示 <ArrowUpRight size={15}/></button></div></section>
    </main>
    <footer className="ab-footer"><div className="ab-logo"><span className="ab-logo-mark"><LineChart size={17}/></span><strong>GEO Compass</strong></div><span>© 2026 GEO Compass · Evidence-led visibility</span><div><button onClick={() => setShowInfo('deck')}>产品文档</button><a href="#product">产品能力</a><a href="#faq">常见问题</a><button onClick={openLogin}>登录工作台</button></div></footer>

    {showInfo && <div className="info-overlay" role="dialog" aria-modal="true" aria-labelledby="info-title"><button className="login-backdrop" onClick={() => setShowInfo(null)} aria-label="关闭"/><div className="info-card"><button className="login-close" onClick={() => setShowInfo(null)} aria-label="关闭"><X size={18}/></button><span className="login-mark"><BookOpenCheck size={19}/></span><p className="landing-kicker">GEO Compass {showInfo === 'deck' ? 'product guide' : 'demo request'}</p><h2 id="info-title">{showInfo === 'deck' ? '产品介绍与使用说明' : '预约一次产品演示'}</h2><p>{showInfo === 'deck' ? '这里会展示 GEO Compass 的数据口径、真实平台采集、竞品研究、内容准备与人工发布边界。当前为官网原型入口。' : '留下团队信息，我们会按你的产品与 Query 场景演示从基线到复测的完整链路。当前为预约原型。'}</p>{showInfo === 'demo' && <label>联系邮箱<input type="email" placeholder="name@company.com"/></label>}<button className="landing-primary" onClick={() => { setShowInfo(null); showInfo === 'demo' ? openLogin() : scrollTo('product') }}>{showInfo === 'deck' ? '查看产品能力' : '继续进入工作台'} <ArrowRight size={15}/></button></div></div>}
    {showLogin && <div className="login-overlay" role="dialog" aria-modal="true" aria-labelledby="login-title"><button className="login-backdrop" onClick={closeLogin} aria-label="关闭登录"/><form className="login-card" onSubmit={submitLogin}><button type="button" className="login-close" onClick={closeLogin} aria-label="关闭"><X size={18}/></button><span className="login-mark"><LineChart size={19}/></span><p className="landing-kicker">GEO Compass workspace</p><h2 id="login-title">回到你的工作台</h2><p className="login-subtitle">继续查看项目、回答证据和复测结果。</p><label>工作邮箱<input type="text" inputMode="email" name="email" placeholder="name@company.com" autoFocus/></label><label>访问密码<input type="password" name="password" placeholder="请输入访问密码"/></label>{loginError && <div className="login-feedback error" role="alert">{loginError}</div>}{loginSuccess && <div className="login-feedback success" role="status">登录成功，正在进入工作台…</div>}<button className="landing-primary login-submit" type="submit" disabled={loginPending}>{loginPending ? <>正在创建演示工作区…</> : <>登录并继续 <ArrowRight size={15}/></>}</button><button type="button" className="login-demo-link" onClick={fillDemoAccount} disabled={loginPending}>使用演示账号快速进入</button><small>当前为本地演示登录：不会验证真实账号，但会创建可用的工作区会话。演示账号：demo@geo-compass.local / demo1234</small></form></div>}
  </div>
}

function PenLineIcon() { return <span className="audience-icon"><FileText size={20}/></span> }
