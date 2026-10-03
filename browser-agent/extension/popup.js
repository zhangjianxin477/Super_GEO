import { adapterForUrl } from './platformRegistry.js'

const state = document.querySelector('#state')
const start = document.querySelector('#start')
const pause = document.querySelector('#pause')
const refresh = document.querySelector('#refresh')
let currentPlatform = null

function escape(value) { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML }
async function activeAdapter() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  return { tab, adapter: adapterForUrl(tab?.url || '') }
}
async function ask(type, payload = {}) { return await chrome.runtime.sendMessage({ type, ...payload }) }

function render(payload) {
  if (payload?.error) {
    state.innerHTML = `<b>${escape(payload.errorTitle || '无法连接本地 Agent')}</b><p>${escape(payload.error)}</p><p class="hint">请回到 GEO 系统对当前平台重新点击「启动本地自动采集」，或刷新该平台页面后再次尝试。</p>`
    start.disabled = false
    return
  }
  const status = payload?.status === 'online' ? '本地 Agent 已连接' : payload?.status === 'needs_login' ? '需要登录' : payload?.status === 'attention' ? '需要人工处理' : '等待本地 Agent'
  const task = payload?.currentTask ? `当前任务：${escape(payload.currentTask.platform)} · ${escape(payload.currentTask.id.slice(0, 8))}` : '当前没有已领取任务'
  const diagnostics = payload?.reportDiagnostics || {}
  const page = currentPlatform ? `当前页面：${escape(currentPlatform)}（可作为本地兜底启动目标）` : '当前页面不是已支持的平台；请在受控平台标签页打开此扩展。'
  const sync = payload?.pendingReportCount ? `<p class="hint">${payload.pendingReportCount} 条当前任务采集结果正在等待同步；网络恢复后会自动重试。</p>` : (diagnostics.lastDeliveredAt ? `<p class="hint success">最近一次结果已同步：${escape(diagnostics.lastStatus || 'completed')}。</p>` : '')
  const error = diagnostics.lastError || diagnostics.lastDispatchError
  const detail = error ? `<p class="hint error">同步/续跑提示：${escape(error)}</p>` : ''
  const agent = payload?.agent?.id ? `<p class="hint">本机设备：${escape(payload.agent.label || 'Browser Agent')} · ${escape(payload.agent.id.slice(0, 8))}</p>` : ''
  state.innerHTML = `<b>${status}</b><p>${task}</p>${agent}<p class="hint">${escape(page)}</p><p class="hint">${payload?.active && payload?.batchAuthorized ? '批次已授权：本条完成并成功同步后，将自动领取下一条。' : '系统尚未对当前平台授予有效批次；此处不会绕过系统授权。'}</p>${sync}${detail}`
  start.disabled = !payload?.paired || !currentPlatform
}

async function refreshState() {
  const [{ adapter }, payload] = await Promise.all([activeAdapter(), ask('geo-browser-agent/status')])
  currentPlatform = adapter?.platform || null
  render(payload)
}

start.addEventListener('click', async () => {
  start.disabled = true
  const { adapter } = await activeAdapter()
  currentPlatform = adapter?.platform || null
  if (!currentPlatform) {
    render({ error: '当前标签页不是已支持的平台网页。请打开文心、千问、GLM 等受控平台页面后再启动。', errorTitle: '无法启动网页采集' })
    return
  }
  const result = await ask('geo-browser-agent/start', { platform: currentPlatform })
  if (result?.state === 'error') render({ error: result.message, errorTitle: '无法启动网页采集' })
  else await refreshState()
})
pause.addEventListener('click', async () => { await ask('geo-browser-agent/pause', { platform: currentPlatform }); await refreshState() })
refresh.addEventListener('click', () => { void refreshState() })
void refreshState()
