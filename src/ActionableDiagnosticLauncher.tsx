import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Globe2, LoaderCircle, Play, ShieldCheck, Sparkles } from 'lucide-react'
import { launchActionableBrandDiagnostic, type WorkspaceSession } from './api'

const MARKET_PACKS = {
  CN: { title: '中国市场', locale: 'zh-CN', description: '以中文真实用户问题为起点开展 Query 研究。' },
  US: { title: '美国市场', locale: 'en-US', description: '以英文真实用户问题为起点开展 Query 研究。' },
} as const

const CATEGORY_GROUPS = [
  { label: 'AI 与效率工具', options: ['AI 知识库 / 企业搜索', 'AI Agent / 自动化', 'AI 客服 / 智能客服', 'AI 写作 / 内容工具', '开发者工具 / AI 编程'] },
  { label: '企业软件', options: ['企业协同 / 项目管理', 'CRM / 销售工具', '营销自动化 / 增长工具', '数据分析 / BI', '文档管理 / 电子签约', '财务 / ERP / 报销', 'HR / 招聘 / 组织管理', '安全 / 合规 / IT 管理'] },
  { label: '行业与商业服务', options: ['跨境 SaaS', '电商 / 零售工具', '支付 / 金融科技', '供应链 / 采购 / 物流', '教育科技', '医疗健康科技', '法律科技', '工业 / 制造软件'] },
  { label: '其他', options: ['垂直行业 SaaS', '消费者应用 / App', '平台 / Marketplace', '其他 B2B 软件'] },
] as const

const DEFAULT_CATEGORY: string = CATEGORY_GROUPS[0].options[0]
const DEFAULT_AUDIENCE = '待 Query 研究确认'

const toggle = (values: string[], value: string) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
const splitValues = (value: string) => value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean)

export function ActionableDiagnosticLauncher({ session, onCancel, onCreated, onHarness }: {
  session: WorkspaceSession
  onCancel: () => void
  onCreated: (id: string) => void
  onHarness: () => void
}) {
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof launchActionableBrandDiagnostic>> | null>(null)
  const [form, setForm] = useState({
    brandName: '', website: '', category: DEFAULT_CATEGORY, marketPacks: ['CN'] as string[],
    seedQuestions: '', evidence: '', competitors: '',
  })

  const starterQuestions = splitValues(form.seedQuestions)
  const selectedMarkets = form.marketPacks.map((id) => MARKET_PACKS[id as keyof typeof MARKET_PACKS]).filter(Boolean)
  const competitors = splitValues(form.competitors)

  const canContinue = step === 1
    ? Boolean(form.brandName.trim() && form.website.trim() && form.category)
    : Boolean(form.marketPacks.length && starterQuestions.length >= 1 && starterQuestions.length <= 4)

  const next = () => {
    if (!canContinue) {
      setError(step === 1
        ? '请填写品牌 / 产品名称与官网地址。'
        : starterQuestions.length > 4
          ? '最多填写 4 个真实问题，请合并或删除重复问题。'
          : '请选择至少一个目标市场，并填写 1–4 个希望 AI 回答的真实问题。')
      return
    }
    setError('')
    setStep((current) => Math.min(3, current + 1))
  }

  const create = async () => {
    if (!canContinue) return
    try {
      setBusy(true)
      setError('')
      const response = await launchActionableBrandDiagnostic(session, {
        brandName: form.brandName.trim(),
        website: form.website.trim(),
        category: form.category,
        marketPacks: form.marketPacks as Array<'CN' | 'US'>,
        audiences: [DEFAULT_AUDIENCE],
        intents: starterQuestions,
        evidenceUrls: splitValues(form.evidence),
        competitors,
        executionPreference: 'controlled-manual',
      })
      setResult(response)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建项目失败，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const needsConnection = result.launchPlan.state === 'configuration-required'
    return <section className="actionable-launcher actionable-result" aria-labelledby="diagnostic-result-title">
      <header className="launcher-header launcher-result-header">
        <div className="launcher-eyebrow"><CheckCircle2 size={15}/>产品项目已建立</div>
        <h2 id="diagnostic-result-title">项目范围已保存，可以开始 Query 研究</h2>
        <p>这里没有生成任何模型结论。模型回答、引用链接和竞品分析，只会在后续真实测试或人工导入后进入当前项目。</p>
      </header>

      <section className={needsConnection ? 'launch-status is-blocked' : 'launch-status'} aria-live="polite">
        {needsConnection ? <CircleAlert size={22}/> : <CheckCircle2 size={22}/>}<div>
          <b>{needsConnection ? '还没有可用的模型连接' : '可以开始整理 Query'}</b>
          <span>{needsConnection ? '项目已经保存。连接模型后再进行真实测试；在此之前也可以先审核或补充 Query。' : '先确认或补充真实用户问题；执行测试后，回答和链接才会成为可用证据。'}</span>
        </div>
      </section>

      <div className="launch-next-step">
        <span><b>下一步</b><small>{needsConnection ? '配置模型连接，或先进入 Query 研究准备问题。' : '进入 Query 研究，确认首轮要测试的真实问题。'}</small></span>
        {needsConnection
          ? <button className="primary" onClick={onHarness}><ShieldCheck size={16}/>配置模型连接</button>
          : <button className="primary" onClick={() => onCreated(result.project.project.id)}><Play size={16}/>进入 Query 研究</button>}
      </div>
      {needsConnection && <button className="text-button launcher-back" onClick={() => onCreated(result.project.project.id)}>先进入 Query 研究 <ArrowRight size={15}/></button>}
    </section>
  }

  return <section className="actionable-launcher" aria-labelledby="diagnostic-launcher-title">
    <header className="launcher-header launcher-create-header">
      <button className="launcher-back-link" onClick={onCancel}><ArrowLeft size={16}/><span>返回项目列表</span></button>
      <div className="launcher-eyebrow"><Sparkles size={15}/>新建产品项目</div>
      <h2 id="diagnostic-launcher-title">建立项目范围</h2>
      <p>只填写产品信息与准备研究的真实问题。创建不会运行模型，也不会产生可见度、引用或竞品结论。</p>
    </header>

    <ol className="launcher-steps" aria-label="产品项目创建进度">
      {['产品信息', '研究起点', '确认创建'].map((label, index) => <li key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'complete' : ''} aria-current={step === index + 1 ? 'step' : undefined}><i>{step > index + 1 ? '✓' : index + 1}</i><span>{label}</span></li>)}
    </ol>

    {step === 1 && <div className="launcher-body">
      <section className="launcher-section"><div><small>1 / 3 · 产品信息</small><h3>让系统知道要研究哪个产品</h3><p>用于识别产品与官网资料。产品品类只是一个辅助上下文，后续可以修改。</p></div>
        <div className="launcher-fields two-columns">
          <label className="field"><span>品牌 / 产品名称 <em>用于识别真实回答里提到的产品与别名</em></span><input value={form.brandName} onChange={(event) => setForm({ ...form, brandName: event.target.value })} placeholder="例如：Northstar Knowledge" autoFocus /></label>
          <label className="field"><span>官网地址 <em>作为待审核的品牌资料起点</em></span><input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://example.com" inputMode="url" /></label>
        </div>
        <label className="field"><span>产品品类 <em>辅助系统理解产品；不影响后续手动调整 Query</em></span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{CATEGORY_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.options.map((option) => <option key={option}>{option}</option>)}</optgroup>)}</select></label>
        <label className="field"><span>补充资料链接 <em>可选。产品页、帮助中心或知识库会保存为待审核来源</em></span><input value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} placeholder="可用逗号或换行添加多个链接" /></label>
      </section>
    </div>}

    {step === 2 && <div className="launcher-body">
      <section className="launcher-section"><div><small>2 / 3 · 研究起点</small><h3>从真实用户问题开始</h3><p>写下你希望用户在 AI 里得到回答的实际问题。它们会保存到 Query 研究中，供你审核、补充和后续进行真实测试。</p></div>
        <div className="choice-block"><div className="choice-heading"><b>目标市场</b><span>决定这些问题的语言和后续研究范围；不代表现在会运行任何平台。</span></div><div className="market-choice-grid">{Object.entries(MARKET_PACKS).map(([id, market]) => <button key={id} type="button" className={form.marketPacks.includes(id) ? 'choice-card selected' : 'choice-card'} aria-pressed={form.marketPacks.includes(id)} onClick={() => setForm({ ...form, marketPacks: toggle(form.marketPacks, id) })}><Globe2 size={18}/><b>{market.title} · {market.locale}</b><span>{market.description}</span></button>)}</div></div>
        <label className="field starter-question-field"><span>希望 AI 回答的真实问题 <em>1–4 个，每行一个。请写用户会直接问 AI 的问题，而不是目标人群、KPI 或问题分类。</em></span><textarea aria-label="希望 AI 回答的真实问题" value={form.seedQuestions} onChange={(event) => setForm({ ...form, seedQuestions: event.target.value })} rows={7} placeholder={'例如：\n适合 50 人团队的 AI 知识库有哪些？\nNotion 和 Northstar Knowledge 在企业搜索方面有什么区别？\n如何把分散在飞书和 Confluence 的文档接入 AI 问答？'} /><small className={starterQuestions.length > 4 ? 'question-counter is-limit' : 'question-counter'}>已识别 {starterQuestions.length} / 4 个问题</small></label>
        <label className="field"><span>已知竞品 <em>可选。仅保存为后续对照线索；不会在创建时自动得出竞品结论</em></span><input value={form.competitors} onChange={(event) => setForm({ ...form, competitors: event.target.value })} placeholder="例如：Notion, Guru, Glean" /></label>
      </section>
    </div>}

    {step === 3 && <div className="launcher-body launcher-review">
      <section className="launcher-section"><div><small>3 / 3 · 确认创建</small><h3>确认要保存的研究起点</h3><p>以下均为你刚刚填写的项目范围，不是系统预测，也不是测试结果。</p></div>
        <dl className="creation-summary">
          <div><dt>产品</dt><dd>{form.brandName.trim()}<small>{form.website.trim()}</small></dd></div>
          <div><dt>市场</dt><dd>{selectedMarkets.map((market) => market.title).join('、')}</dd></div>
          <div><dt>初始问题</dt><dd><ul>{starterQuestions.map((question) => <li key={question}>{question}</li>)}</ul></dd></div>
          <div><dt>已知竞品</dt><dd>{competitors.length ? competitors.join('、') : '未填写，可在后续补充'}</dd></div>
        </dl>
        <div className="creation-boundary"><ShieldCheck size={18}/><div><b>创建后会发生什么？</b><span>系统只保存项目范围。下一步在 Query 研究中审核或补充问题；只有完成真实平台测试或人工导入后，模型回答、引用链接和竞品证据才会进入系统。</span></div></div>
      </section>
    </div>}

    {error && <div className="launcher-error" role="alert"><CircleAlert size={17}/>{error}</div>}
    <footer className="launcher-footer"><span>第 {step} 步，共 3 步</span><div>{step > 1 && <button className="secondary" onClick={() => { setError(''); setStep((current) => current - 1) }}>上一步</button>}{step < 3 ? <button className="primary" onClick={next}>继续 <ArrowRight size={16}/></button> : <button className="primary" disabled={busy} onClick={create}>{busy ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>}创建项目并进入 Query 研究</button>}</div></footer>
  </section>
}
