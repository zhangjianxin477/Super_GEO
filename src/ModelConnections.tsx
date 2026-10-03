import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  FlaskConical,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { getWorkspaceSession } from './BrandDiagnostics'
import {
  ApiClientError,
  configureModelProvider,
  getQueryGenerationSettings,
  storeModelProviderCredential,
  testModelProviderConnection,
  type ModelProviderConfiguration,
  type WorkspaceSession,
} from './api'

type Preset = {
  id: string
  label: string
  market: 'CN' | 'GLOBAL'
  locale: string
  aliases?: string[]
  baseUrl: string
  modelName: string
}

const presets: Preset[] = [
  { id: 'openai', label: 'OpenAI / ChatGPT', market: 'GLOBAL', locale: 'en-US', baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4.1-mini' },
  { id: 'deepseek', label: 'DeepSeek', market: 'CN', locale: 'zh-CN', baseUrl: 'https://api.deepseek.com/v1', modelName: 'deepseek-chat' },
  { id: 'qwen', label: '通义千问（百炼）', aliases: ['通义千问', '千问', 'qwen', 'dashscope'], market: 'CN', locale: 'zh-CN', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelName: 'qwen-plus' },
  { id: 'doubao', label: '豆包 / 火山方舟', market: 'CN', locale: 'zh-CN', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', modelName: 'ep-你的推理接入点 ID' },
  { id: 'zhipu', label: '智谱 GLM', market: 'CN', locale: 'zh-CN', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', modelName: 'glm-4-flash' },
  { id: 'kimi', label: 'Kimi / Moonshot', market: 'CN', locale: 'zh-CN', baseUrl: 'https://api.moonshot.cn/v1', modelName: 'moonshot-v1-8k' },
  { id: 'baidu', label: '百度千帆', market: 'CN', locale: 'zh-CN', baseUrl: 'https://qianfan.baidubce.com/v2', modelName: 'ernie-4.5-turbo-128k' },
  { id: 'perplexity', label: 'Perplexity', market: 'GLOBAL', locale: 'en-US', baseUrl: 'https://api.perplexity.ai', modelName: 'sonar' },
  { id: 'openrouter', label: 'OpenRouter', market: 'GLOBAL', locale: 'en-US', baseUrl: 'https://openrouter.ai/api/v1', modelName: 'openai/gpt-4.1-mini' },
  { id: 'groq', label: 'Groq', market: 'GLOBAL', locale: 'en-US', baseUrl: 'https://api.groq.com/openai/v1', modelName: 'llama-3.3-70b-versatile' },
  { id: 'local', label: 'Ollama / LM Studio / 企业内网模型', market: 'GLOBAL', locale: 'en-US', baseUrl: 'http://127.0.0.1:11434/v1', modelName: '' },
]

function getPreset(provider?: ModelProviderConfiguration | null) {
  if (!provider) return null
  const identity = provider.providerId.trim().toLowerCase()
  return presets.find((preset) => preset.id === identity || preset.label.toLowerCase() === identity || preset.aliases?.some((alias) => identity.includes(alias.toLowerCase()))) ?? null
}

function testSummary(provider?: ModelProviderConfiguration | null) {
  if (!provider) return { tone: 'empty', label: '尚未连接', detail: '配置一个模型后，它可用于 AI 生成核心 Query、内容方案和待审核草稿。' }
  if (!provider.execution?.baseUrl || !provider.execution.modelName) return { tone: 'warning', label: '等待补全配置', detail: '请填写 API Base URL 和模型名称。' }
  if (!provider.credential?.configured) return { tone: 'warning', label: '等待保存密钥', detail: '填写 API Key 后点击“保存并测试连接”。' }
  if (provider.test?.status === 'verified') {
    const time = provider.test.testedAt ? new Date(provider.test.testedAt).toLocaleString('zh-CN', { hour12: false }) : '刚刚'
    return { tone: 'success', label: '已连接', detail: `${provider.test.model || provider.execution.modelName} · 验证于 ${time}${provider.test.latencyMs ? ` · ${provider.test.latencyMs} ms` : ''}` }
  }
  if (provider.test?.status === 'failed') return { tone: 'error', label: '测试未通过', detail: provider.test.message || '连接测试失败，请检查配置后重试。' }
  return { tone: 'pending', label: '尚未验证', detail: '已保存配置。请运行一次连接测试后再生成 Query。' }
}

export function ModelConnections() {
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  const [current, setCurrent] = useState<ModelProviderConfiguration | null>(null)
  const [providerPreset, setProviderPreset] = useState('qwen')
  const [providerName, setProviderName] = useState('通义千问（百炼）')
  const [baseUrl, setBaseUrl] = useState('https://dashscope.aliyuncs.com/compatible-mode/v1')
  const [modelName, setModelName] = useState('qwen-plus')
  const [apiKey, setApiKey] = useState('')
  const [market, setMarket] = useState<'CN' | 'GLOBAL'>('CN')
  const [locale, setLocale] = useState('zh-CN')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isEditing, setIsEditing] = useState(false)

  const status = testSummary(current)
  const usingExistingCredential = Boolean(current?.credential?.configured && current?.providerId === providerName && current?.market === market && current?.locale === locale)
  const requiresApiKey = !usingExistingCredential
  const canSave = Boolean(providerName.trim() && baseUrl.trim() && modelName.trim() && (!requiresApiKey || apiKey.trim().length >= 8))
  const showConnectedOverview = Boolean(current && status.tone === 'success' && !isEditing)

  const hydrate = (provider: ModelProviderConfiguration | null) => {
    setCurrent(provider)
    if (!provider) return
    const preset = getPreset(provider)
    setProviderPreset(preset?.id ?? 'custom')
    setProviderName(provider.providerId)
    setBaseUrl(provider.execution?.baseUrl ?? '')
    setModelName(provider.execution?.modelName ?? '')
    setMarket(provider.market)
    setLocale(provider.locale)
    setApiKey('')
  }

  const load = async (keepNotice = false) => {
    try {
      const active = await getWorkspaceSession()
      setSession(active)
      const result = await getQueryGenerationSettings(active)
      hydrate(result.providers[0] ?? null)
      if (!keepNotice) setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法加载模型设置。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const selectPreset = (id: string) => {
    setProviderPreset(id)
    setFieldErrors({})
    if (id === 'custom') return
    const preset = presets.find((item) => item.id === id)
    if (!preset) return
    setProviderName(preset.label)
    setBaseUrl(preset.baseUrl)
    setModelName(preset.modelName)
    setMarket(preset.market)
    setLocale(preset.locale)
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!providerName.trim()) next.provider = '请填写服务商或企业网关名称。'
    if (!baseUrl.trim()) next.baseUrl = '请填写服务商提供的 API Base URL。'
    else if (!/^https?:\/\//i.test(baseUrl.trim())) next.baseUrl = 'Base URL 必须以 http:// 或 https:// 开头。'
    if (!modelName.trim()) next.modelName = '请填写实际模型 ID 或部署名称。'
    if (requiresApiKey && apiKey.trim().length < 8) next.apiKey = '首次连接请填写至少 8 位的 API Key。'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const saveAndTest = async () => {
    if (!session || !validate()) return
    setBusy(true)
    setMessage(null)
    try {
      const { provider } = await configureModelProvider(session, {
        providerId: providerName.trim(), market, locale, collectionMode: 'official-api', baseUrl: baseUrl.trim().replace(/\/$/, ''), modelName: modelName.trim(), useForQueryGeneration: true,
      })
      if (apiKey.trim()) await storeModelProviderCredential(session, provider.id, apiKey.trim())
      await testModelProviderConnection(session, provider.id)
      setApiKey('')
      setIsEditing(false)
      setMessage('连接验证成功。该模型现在可用于 AI Query 生成、内容方案与待审核草稿。')
      await load(true)
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : '保存或测试连接时出现问题，请检查配置后重试。')
      await load(true)
    } finally {
      setBusy(false)
    }
  }

  const shortInfo = useMemo(() => current?.credential?.configured && current.credential.lastFour ? `已安全保存 · 尾号 ${current.credential.lastFour}` : '不会显示或回传已保存的密钥', [current])

  const retestConnection = async () => {
    if (!session || !current) return
    setBusy(true)
    setMessage(null)
    try {
      await testModelProviderConnection(session, current.id)
      await load(true)
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : '连接测试失败，请检查配置后重试。')
      await load(true)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <section className="query-model-page"><div className="query-model-loading"><LoaderCircle className="spin" size={18} />正在加载 Query 生成模型设置…</div></section>

  return (
    <section className="query-model-page" aria-labelledby="query-model-title">
      <header className="query-model-header">
        <div>
          <span className="eyebrow">AI 配置</span>
          <h2 id="query-model-title">AI 生成连接</h2>
          <p>{showConnectedOverview ? '已验证模型负责内部生成任务；真实平台可见度测试仍通过 Browser Agent 或人工证据完成。' : '填写一次连接信息并完成验证，后续日常使用只保留连接状态与必要操作。'}</p>
        </div>
      </header>

      {showConnectedOverview && current ? <article className="query-model-connected-card">
        <div className="query-model-connected-main">
          <div className="query-model-connected-icon"><CheckCircle2 size={21} /></div>
          <div><small>当前 AI 生成模型</small><h3>{current?.providerId ?? '已验证模型'} · {current?.execution?.modelName || '待补全'}</h3><p>{status.detail}</p></div>
          <span className="query-model-verified">已验证</span>
        </div>
        <div className="query-model-usage" aria-label="模型使用范围">
          <span>用于</span><b>核心 Query 生成</b><b>内容方案</b><b>待审核草稿</b>
        </div>
        <footer className="query-model-connected-actions">
          <p><ShieldCheck size={16} />密钥已安全保存；日常使用无需重复填写或查看连接配置。</p>
          <div><button className="secondary compact" type="button" disabled={busy} onClick={() => void retestConnection()}>{busy ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}{busy ? '正在验证…' : '重新验证'}</button><button className="primary compact" type="button" disabled={busy} onClick={() => setIsEditing(true)}>编辑连接</button></div>
        </footer>
      </article> : <article className="query-model-card">
        <div className="query-model-card-heading">
          <div><h3>{current ? '编辑 AI 生成连接' : '连接一个 AI 生成模型'}</h3><p>{current ? '更换服务商、接口或模型后需要重新验证；历史连接仅保留审计记录。' : '只填写模型调用必需的信息。连接通过后，日常使用不再展示这些配置。'}</p></div>
          <div className="query-model-card-meta">
            <div className={`query-model-card-status ${status.tone}`} aria-live="polite">
              {status.tone === 'success' ? <CheckCircle2 size={16} /> : status.tone === 'error' ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
              <span><b>{status.label}</b><small>{status.detail}</small></span>
            </div>
            {current && <button className="secondary compact" type="button" onClick={() => { hydrate(current); setFieldErrors({}); setIsEditing(false) }} disabled={busy}>取消编辑</button>}
          </div>
        </div>

        <div className="query-model-form">
          <label>
            <span>服务商 <em>*</em></span>
            <select aria-label="服务商" value={providerPreset} onChange={(event) => selectPreset(event.target.value)}>
              {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              <option value="custom">自定义服务商 / 企业网关</option>
            </select>
            <i>选择预设会自动填入接口地址和模型；也可直接改写。</i>
          </label>
          {providerPreset === 'custom' ? <label>
            <span>服务商名称 <em>*</em></span>
            <input value={providerName} onChange={(event) => setProviderName(event.target.value)} onBlur={validate} placeholder="例如：企业 AI 网关" aria-invalid={Boolean(fieldErrors.provider)} />
            {fieldErrors.provider && <i className="field-error" role="alert">{fieldErrors.provider}</i>}
          </label> : <label>
            <span>模型名称 <em>*</em></span>
            <input value={modelName} onChange={(event) => setModelName(event.target.value)} onBlur={validate} placeholder="例如 qwen-plus 或你的部署名" aria-invalid={Boolean(fieldErrors.modelName)} />
            {fieldErrors.modelName ? <i className="field-error" role="alert">{fieldErrors.modelName}</i> : <i>填写服务商控制台显示的模型 ID 或部署名称。</i>}
          </label>}
          {providerPreset === 'custom' && <label className="query-form-span-two">
            <span>模型名称 <em>*</em></span>
            <input value={modelName} onChange={(event) => setModelName(event.target.value)} onBlur={validate} placeholder="例如你的部署名" aria-invalid={Boolean(fieldErrors.modelName)} />
            {fieldErrors.modelName ? <i className="field-error" role="alert">{fieldErrors.modelName}</i> : <i>填写服务商控制台显示的模型 ID 或部署名称。</i>}
          </label>}
          <label className="query-form-span-two">
            <span>API Base URL <em>*</em></span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} onBlur={validate} placeholder="https://api.example.com/v1" aria-invalid={Boolean(fieldErrors.baseUrl)} />
            {fieldErrors.baseUrl ? <i className="field-error" role="alert">{fieldErrors.baseUrl}</i> : <i>填到 API 版本路径；系统会在请求时追加 <code>/chat/completions</code>。</i>}
          </label>
          <label className="query-form-span-two">
            <span>API Key {requiresApiKey && <em>*</em>}</span>
            <div className="query-key-field"><KeyRound size={16} /><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} onBlur={validate} placeholder={requiresApiKey ? '粘贴 API Key（只会加密保存）' : '留空以继续使用已保存密钥'} autoComplete="off" aria-invalid={Boolean(fieldErrors.apiKey)} /></div>
            {fieldErrors.apiKey ? <i className="field-error" role="alert">{fieldErrors.apiKey}</i> : <i>{shortInfo}</i>}
          </label>
        </div>

        <div className="query-model-action-row">
          <div><ShieldCheck size={17} /><span><b>保存后会发送一条最小验证请求</b><small>系统仅验证当前模型 API；不会登录、抓取或操作任何第三方 AI 平台。</small></span></div>
          <button className="primary" type="button" disabled={!canSave || busy} onClick={() => void saveAndTest()}>{busy ? <LoaderCircle className="spin" size={16} /> : <FlaskConical size={16} />}{busy ? '正在保存并验证…' : current ? '保存并重新验证' : '保存并测试连接'}</button>
        </div>
      </article>}
      {(message || status.tone === 'error') && !showConnectedOverview && <section className={`query-model-diagnostics ${status.tone === 'error' ? 'error' : 'notice'}`} role={status.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
        {status.tone === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        <div><b>{status.tone === 'error' ? '为什么测试失败？' : '连接状态'}</b><p>{status.tone === 'error' ? status.detail : message}</p>{status.tone === 'error' && <small>修正配置后，点击“保存并测试连接”即可重新验证。</small>}</div>
      </section>}

      <aside className="query-model-footnote"><CircleHelp size={15} /><span>此连接只用于需要模型生成的内部环节：核心 Query、内容方案与待审核草稿；真实平台的可见度、引用与链接采集仍在「首轮真实测试与证据」模块完成。</span></aside>
    </section>
  )
}


