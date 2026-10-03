#!/usr/bin/env node
/**
 * GEO Browser Agent — customer-side local relay.
 *
 * Every supported platform owns a separate execution lane and isolated browser
 * profile. A lane processes one Query at a time; different platforms can run
 * concurrently without replacing each other's browser page, login, or queue.
 */
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile, chmod, access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { preserveForwardStartRequest, startRequestLaunchPlan } from './startRequestLifecycle.mjs'
import { AGENT_VERSION, adapterForPlatform, supportedAdapters, supportedPlatforms } from './extension/platformRegistry.js'

const DEFAULT_API = 'http://127.0.0.1:8787'
const LOCAL_HOST = '127.0.0.1'
const LOCAL_PORT = Number(process.env.GEO_AGENT_PORT || 23891)
const CONFIG_PATH = process.env.GEO_AGENT_CONFIG || join(homedir(), '.geo-browser-agent', 'config.json')
const POLL_MS = 2_500
const HEARTBEAT_MS = 25_000
const REMOTE_TIMEOUT_MS = 15_000
// Opt-in local-only diagnostics. This is never enabled by the product UI and is used only
// to inspect a customer-visible, GEO-owned browser window while debugging a failed dispatch.
const LOCAL_DIAGNOSTICS_ENABLED = process.env.GEO_BROWSER_DIAGNOSTICS === '1'
const LOCAL_DIAGNOSTICS_PORT_BASE = Number(process.env.GEO_BROWSER_DIAGNOSTICS_PORT_BASE || 23940)
// The page adapter may need up to 140s for a real model answer plus visible-source
// expansion and terminal report persistence. Keep the local watchdog materially beyond
// that budget; bounded page heartbeats renew it while the same task is visibly running.
const TASK_RESULT_TIMEOUT_MS = Math.min(300_000, Math.max(60_000, Number(process.env.GEO_AGENT_TASK_RESULT_TIMEOUT_MS || 210_000)))
// Distinct from answer generation: a missing content-script handoff must not leave a
// Query appearing as "running" for several minutes.
const TASK_DISPATCH_RECEIPT_TIMEOUT_MS = Math.min(60_000, Math.max(15_000, Number(process.env.GEO_AGENT_TASK_DISPATCH_RECEIPT_TIMEOUT_MS || 30_000)))
const LOCAL_BODY_LIMIT_BYTES = 900_000
// A modest default avoids excessive CPU and site risk. It is an upper limit only:
// each platform stays serial and an operator can start fewer platforms.
const MAX_PARALLEL_PLATFORMS = Math.min(
  supportedPlatforms.length,
  Math.max(1, Number(process.env.GEO_AGENT_MAX_PARALLEL_PLATFORMS || supportedPlatforms.length)),
)

let config = null
let localStatus = { status: 'online', lastError: null, extensionConnectedAt: null }
let pollTimer = null
let heartbeatTimer = null
let startRequestPollPromise = null
const taskPollPromises = new Map()
let recentReports = []
/** @type {Map<string, {request:any, task:any, active:boolean, launchedRequestId:string|null, watchdog:any, reportedRunning:Set<string>, stages:any[]}>} */
const lanes = new Map()

function usage() { console.log(`GEO Browser Agent\n\nUsage:\n  node agent.mjs enroll --api ${DEFAULT_API} --code <one-time-code> [--label <device>]\n  node agent.mjs start\n  node agent.mjs status\n\nThe browser runs only after an explicit GEO system start request. Login remains local and visible.`) }
function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined }
async function readConfig() { try { return JSON.parse(await readFile(CONFIG_PATH, 'utf8')) } catch { return null } }
async function saveConfig(value) { await mkdir(dirname(CONFIG_PATH), { recursive: true }); await writeFile(CONFIG_PATH, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 }); try { await chmod(CONFIG_PATH, 0o600) } catch {} }
function safeApiUrl(value) { try { const url = new URL(value || DEFAULT_API); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); return url.origin } catch { throw new Error('API 地址必须是 http:// 或 https:// 地址。') } }
function log(message) { console.log(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`) }
function noStoreError(error) { return error instanceof Error ? error.message.replace(config?.token || '', '[redacted]') : '未知错误' }
function laneFor(platform) { const existing = lanes.get(platform); if (existing) return existing; const lane = { request: null, task: null, active: false, launchedRequestId: null, watchdog: null, dispatchWatchdog: null, reportedRunning: new Set(), stages: [] }; lanes.set(platform, lane); return lane }
function profilePathFor(platform) { const adapter = adapterForPlatform(platform); if (!adapter) throw new Error(`当前本地 Agent 尚未支持自动启动「${platform}」平台。`); return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'GEO Browser Agent', 'edge-profiles', adapter.id) }
function platformHomePage(platform) { const adapter = adapterForPlatform(platform); if (!adapter) throw new Error(`当前本地 Agent 尚未支持自动启动「${platform}」平台。`); return adapter.homepage }
function localDiagnosticsPortFor(platform) {
  const adapter = adapterForPlatform(platform)
  const index = supportedAdapters.findIndex((item) => item.id === adapter?.id)
  return LOCAL_DIAGNOSTICS_PORT_BASE + Math.max(0, index)
}
async function remote(path, { method = 'GET', body } = {}) {
  if (!config?.token) throw new Error('Browser Agent 尚未配对。请先运行 enroll。')
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS)
  try {
    const response = await fetch(config.apiUrl + path, { method, headers: { authorization: `Bearer ${config.token}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `服务器请求失败（${response.status}）`)
    return payload
  } catch (error) { if (error?.name === 'AbortError') throw new Error(`服务器请求超时（${Math.round(REMOTE_TIMEOUT_MS / 1000)} 秒）`); throw error } finally { clearTimeout(timeout) }
}
async function enroll() {
  const code = arg('--code'); if (!code) throw new Error('缺少 --code 一次性配对码。')
  const apiUrl = safeApiUrl(arg('--api') || DEFAULT_API); const label = arg('--label') || `${process.env.COMPUTERNAME || process.env.HOSTNAME || '本地'} Browser Agent`
  const response = await fetch(apiUrl + '/api/browser-agents/enroll', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ enrollmentCode: code, label, platforms: supportedPlatforms, adapters: supportedAdapters }) })
  const payload = await response.json().catch(() => ({})); if (!response.ok || !payload.token) throw new Error(payload.error || `配对失败（${response.status}）`)
  await saveConfig({ apiUrl, token: payload.token, agent: payload.agent, enrolledAt: new Date().toISOString() }); console.log(`配对成功：${payload.agent.label}。令牌已仅保存在本地：${CONFIG_PATH}`)
}
async function executableIfPresent(file) { try { await access(file, fsConstants.X_OK); return file } catch { return null } }
async function findBrowserExecutable() {
  const appData = process.env.LOCALAPPDATA || ''
  const candidates = [process.env.GEO_BROWSER_EXECUTABLE, 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', join(appData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean)
  for (const candidate of candidates) { const found = await executableIfPresent(candidate); if (found) return found }
  throw new Error('未找到可用的 Edge/Chrome。请安装 Edge，或设置 GEO_BROWSER_EXECUTABLE。')
}
async function heartbeat() {
  if (!config) return
  try { await remote('/api/browser-agents/heartbeat', { method: 'POST', body: { status: localStatus.status, platforms: supportedPlatforms, adapters: supportedAdapters, lastError: localStatus.lastError } }) }
  catch (error) { log(`心跳失败：${noStoreError(error)}`) }
}
async function advanceStartRequest(lane, status, reason = null) {
  if (!lane.request?.id) return null
  const payload = await remote(`/api/browser-agents/start-request/${encodeURIComponent(lane.request.id)}/status`, { method: 'POST', body: { status, reason } })
  lane.request = payload.startRequest || { ...lane.request, status, failureReason: reason || null }
  return lane.request
}
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function controlledBrowserProcessCount(profilePath) {
  if (process.platform !== 'win32') return 0
  const escapedProfile = profilePath.replace(/'/g, "''")
  const script = [`$profilePath = '${escapedProfile}'`, "$targets = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @('msedge.exe','chrome.exe') -and $_.CommandLine -and $_.CommandLine.IndexOf($profilePath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 })", 'Write-Output $targets.Count'].join('; ')
  return await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code !== 0
      ? reject(new Error(stderr.trim() || `无法检查受控浏览器（PowerShell exit ${code}）。`))
      : resolve(Number.parseInt(stdout.trim(), 10) || 0))
  })
}
async function closeControlledBrowserProfile(profilePath) {
  if (process.platform !== 'win32') return { closed: 0 }
  const escapedProfile = profilePath.replace(/'/g, "''")
  // Restrict the close request to this product's isolated profile. We never touch the
  // user's normal Edge/Chrome windows, and profile files/cookies are not inspected.
  const script = [
    `$profilePath = '${escapedProfile}'`,
    "$targets = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @('msedge.exe','chrome.exe') -and $_.CommandLine -and $_.CommandLine.IndexOf($profilePath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 })",
    "foreach ($target in $targets) { try { $p = [System.Diagnostics.Process]::GetProcessById($target.ProcessId); if (-not $p.HasExited) { [void]$p.CloseMainWindow() } } catch {} }",
    'Start-Sleep -Milliseconds 1400',
    "foreach ($target in $targets) { try { $p = [System.Diagnostics.Process]::GetProcessById($target.ProcessId); if (-not $p.HasExited) { Stop-Process -Id $target.ProcessId -Force -ErrorAction Stop } } catch {} }",
    'Write-Output $targets.Count',
  ].join('; ')
  return await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code !== 0
      ? reject(new Error(stderr.trim() || `无法关闭 GEO 专用浏览器窗口（PowerShell exit ${code}）。`))
      : resolve({ closed: Number.parseInt(stdout.trim(), 10) || 0 }))
  })
}

async function waitForControlledBrowserExit(profilePath, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs
  let remaining = await controlledBrowserProcessCount(profilePath)
  while (remaining > 0 && Date.now() < deadline) {
    await sleep(300)
    remaining = await controlledBrowserProcessCount(profilePath)
  }
  return remaining
}

async function launchBrowserForStartRequest(lane, { forceExtensionReload = false, ensureCurrentExtension = false } = {}) {
  const request = lane.request
  const executable = await findBrowserExecutable()
  const extensionPath = join(dirname(process.argv[1]), 'extension')
  const profilePath = profilePathFor(request.platform)
  await mkdir(profilePath, { recursive: true })

  // Chromium keeps an unpacked extension's service worker and content scripts in the
  // first process that opens a profile. A prior login/setup window may therefore have the
  // right visible page but no GEO executor at all. For every *new explicit* system start
  // request, relaunch only the matching GEO-owned profile before dispatch so --load-extension
  // is guaranteed to apply. Login/session data stay in that isolated profile; no cookies or
  // credentials are read or uploaded. Normal polling of the same request still reuses it.
  const requiresCleanProfileLaunch = forceExtensionReload || ensureCurrentExtension
  let existingProcessCount = await controlledBrowserProcessCount(profilePath)
  let reloadedProfile = null
  if (requiresCleanProfileLaunch) {
    if (existingProcessCount) reloadedProfile = await closeControlledBrowserProfile(profilePath)
    existingProcessCount = await waitForControlledBrowserExit(profilePath)
    if (existingProcessCount) {
      throw new Error(`GEO 专用浏览器窗口仍在退出（${existingProcessCount} 个进程）。为避免打开未加载 GEO 扩展的页面，本次不派发任务；请等待后重试。`)
    }
  }

  // Pass the unpacked extension flags whenever this agent launches a browser. For a normal
  // reuse Chromium may keep the existing window, but for a version reload the zero-process
  // guard above guarantees this spawn is the browser process that loads the current files.
  const args = [
    `--user-data-dir=${profilePath}`,
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--disable-session-crashed-bubble',
    '--no-first-run',
    '--no-default-browser-check',
    ...(LOCAL_DIAGNOSTICS_ENABLED ? ['--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${localDiagnosticsPortFor(request.platform)}`] : []),
    '--new-window',
    platformHomePage(request.platform),
  ]
  const child = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: false })
  child.unref()
  return {
    executable,
    profilePath,
    platformUrl: platformHomePage(request.platform),
    refresh: reloadedProfile
      ? { mode: forceExtensionReload ? 'extension-version-reload' : 'start-request-extension-bootstrap', existingProcessCount, restarted: true, closedProfileWindows: reloadedProfile.closed }
      : requiresCleanProfileLaunch
        ? { mode: 'start-request-extension-bootstrap', existingProcessCount: 0, restarted: true, closedProfileWindows: 0 }
        : existingProcessCount
        ? { mode: 'reused-profile', existingProcessCount, restarted: false }
        : { mode: 'new-profile-window', existingProcessCount: 0, restarted: false },
  }
}

async function reloadExtensionForLane(lane, receivedVersion) {
  if (!lane.request || lane.extensionReloadPromise) return lane.extensionReloadPromise || null
  const platform = lane.request.platform
  const expectedVersion = AGENT_VERSION
  lane.active = false
  lane.extensionReloadPromise = (async () => {
    const launch = await launchBrowserForStartRequest(lane, { forceExtensionReload: true })
    localStatus = {
      ...localStatus,
      status: 'online',
      lastError: null,
      extensionReload: { platform, expectedVersion, receivedVersion: receivedVersion || null, at: new Date().toISOString(), ...launch.refresh },
    }
    log(`「${platform}」浏览器扩展版本为 ${receivedVersion || '未知'}，已仅重启该 GEO 专用浏览器 Profile 并加载 v${expectedVersion}；等待页面就绪后再派发 Query。`)
    await heartbeat()
    return launch
  })().catch(async (error) => {
    const message = noStoreError(error)
    localStatus = { ...localStatus, status: 'attention', lastError: `无法重新加载 GEO 浏览器扩展：${message}` }
    log(`「${platform}」浏览器扩展版本升级失败：${message}`)
    await heartbeat()
    throw error
  }).finally(() => { lane.extensionReloadPromise = null })
  return lane.extensionReloadPromise
}
function activeLaneCount() { return [...lanes.values()].filter((lane) => lane.request && !['completed', 'failed', 'cancelled', 'expired'].includes(lane.request.status)).length }
async function pollStartRequestOnce() {
  if (!config) return
  try {
    const payload = await remote('/api/browser-agents/start-request'); const requests = Array.isArray(payload.requests) ? payload.requests : payload.request ? [payload.request] : []
    const activeIds = new Set(requests.map((request) => request.id))
    for (const [platform, lane] of lanes) {
      if (lane.request && !activeIds.has(lane.request.id)) {
        const expiredTask = lane.task
        lane.active = false
        if (expiredTask) {
          try {
            await report(expiredTask.id, { status: 'needs-human', reason: `「${platform}」的本地启动授权已结束，当前 Query 已停止自动采集；请重新启动该平台后人工复核或重试。` })
          } catch (error) {
            clearLaneWatchdog(lane)
            lane.reportedRunning.delete(expiredTask.id)
            lane.task = null
            recordReportDiagnostic(expiredTask.id, 'needs-human', { error })
          }
        }
        clearLaneWatchdog(lane)
        lane.reportedRunning.clear()
        lane.task = null
        lane.request = null
        lane.launchedRequestId = null
        log(`「${platform}」启动授权已结束、过期或被取消；已释放本地任务槽位，不会继续领取后续 Query。`)
      }
    }
    // A failed or expired authorization must not keep the whole device unavailable.
    // The next explicit platform start is safe because every lane has its own profile.
    if (!requests.length && localStatus.status === 'attention') {
      localStatus = { ...localStatus, status: 'online', lastError: null }
      await heartbeat()
    }
    for (const request of requests) {
      if (!adapterForPlatform(request.platform)) continue
      const lane = laneFor(request.platform); const isNew = lane.request?.id !== request.id
      lane.request = preserveForwardStartRequest(lane.request, request); if (isNew) lane.launchedRequestId = null
      const plan = startRequestLaunchPlan(lane.request.status, { launched: lane.launchedRequestId === lane.request.id })
      for (const status of plan.advance) await advanceStartRequest(lane, status)
      if (!plan.launch) continue
      // Requests above the local safety limit remain authorized and visible in the SaaS;
      // they launch when another platform lane completes instead of superseding it.
      const launchedCount = [...lanes.values()].filter((value) => value.launchedRequestId && value.request?.id === value.launchedRequestId).length
      if (launchedCount >= MAX_PARALLEL_PLATFORMS) continue
      // A fresh system authorization must start from an extension-bearing GEO profile.
      // This avoids silently opening a logged-in page from an older/manual process that never
      // received --load-extension, which looks ready to the operator but cannot accept tasks.
      const launch = await launchBrowserForStartRequest(lane, { ensureCurrentExtension: isNew }); lane.launchedRequestId = lane.request.id
      localStatus = { ...localStatus, status: 'online', lastError: null, browserLaunch: { platform: lane.request.platform, at: new Date().toISOString(), ...launch } }
      log(`已收到「${lane.request.platform}」平台授权：正使用独立 Profile 打开受控浏览器。其他平台窗口与任务不会被关闭。`)
    }
  } catch (error) { const message = noStoreError(error); localStatus = { ...localStatus, status: 'attention', lastError: message }; log(`启动授权处理失败：${message}`); await heartbeat() }
}
async function pollStartRequest() { if (startRequestPollPromise) return startRequestPollPromise; startRequestPollPromise = pollStartRequestOnce().finally(() => { startRequestPollPromise = null }); return startRequestPollPromise }
async function pollTasks({ force = false, platform = null } = {}) {
  const requestedPlatform = typeof platform === 'string' && platform.trim() ? platform.trim() : null
  const pollKey = requestedPlatform || '__active-lanes__'
  if (taskPollPromises.has(pollKey)) return taskPollPromises.get(pollKey)
  const pending = (async () => {
    try {
      // Do not let a page-ready signal on one platform lease sibling-platform work.
      // A no-platform poll only considers already activated lanes; each targeted poll
      // calls the server with the exact platform it owns.
      const targetPlatforms = requestedPlatform
        ? [requestedPlatform]
        : [...lanes.entries()].filter(([, lane]) => lane.active).map(([key]) => key)
      if (!targetPlatforms.length) return []
      const taskByPlatform = new Map()
      for (const platform of targetPlatforms) {
        // Claim only the exact platform lane. Each lane has its own isolated browser
        // profile and may run concurrently with other platforms, but never receives a
        // sibling platform's Query.
        const payload = await remote(`/api/browser-agents/tasks?platform=${encodeURIComponent(platform)}`)
        const tasks = Array.isArray(payload.tasks) ? payload.tasks : []
        const task = tasks.find((item) => item.platform === platform) || null
        taskByPlatform.set(platform, task)
      }
      for (const platform of targetPlatforms) {
        const lane = laneFor(platform)
        if (!lane.active) continue
        const next = taskByPlatform.get(platform) || null
        if (lane.task && !force) continue
        if (force && lane.task && lane.task.id !== next?.id) {
          lane.reportedRunning.delete(lane.task.id)
          clearLaneWatchdog(lane)
        }
        const taskChanged = lane.task?.id !== next?.id
        if (taskChanged) {
          clearLaneWatchdog(lane)
          lane.stages = []
        }
        lane.task = next
        if (next && taskChanged) armTaskDispatchWatchdog(lane, next.id)
        if (next) log(next.recovered ? `已恢复一项 ${platform} 任务。` : `已取得一项 ${platform} 任务，等待该平台浏览器扩展执行。`)
      }
      return [...taskByPlatform.values()].filter(Boolean)
    } catch (error) {
      localStatus = { ...localStatus, status: 'attention', lastError: noStoreError(error) }
      await heartbeat()
      return []
    }
  })()
  taskPollPromises.set(pollKey, pending)
  try { return await pending } finally { taskPollPromises.delete(pollKey) }
}
function clearTaskDispatchWatchdog(lane) { if (lane.dispatchWatchdog) clearTimeout(lane.dispatchWatchdog); lane.dispatchWatchdog = null }
function clearLaneWatchdog(lane) { if (lane.watchdog) clearTimeout(lane.watchdog); lane.watchdog = null; clearTaskDispatchWatchdog(lane) }
function armTaskDispatchWatchdog(lane, taskId) {
  clearTaskDispatchWatchdog(lane)
  lane.dispatchWatchdog = setTimeout(async () => {
    if (!lane.task || lane.task.id !== taskId || lane.stages.some((entry) => entry.stage === 'dispatch-accepted' || entry.stage === 'received-task')) return
    const seconds = Math.round(TASK_DISPATCH_RECEIPT_TIMEOUT_MS / 1000)
    const reason = `本地浏览器在 ${seconds} 秒内未确认页面执行器收到任务；未向页面写入或发送 Query。为避免任务长时间显示运行中，已转为人工复核。`
    log(`「${lane.request?.platform || '未知平台'}」任务 ${taskId.slice(0, 8)} 未收到页面执行确认，正在转人工复核。`)
    try { await report(taskId, { status: 'needs-human', reason }) } catch (error) { localStatus = { ...localStatus, status: 'attention', lastError: noStoreError(error) }; await heartbeat() }
  }, TASK_DISPATCH_RECEIPT_TIMEOUT_MS)
}
function armTaskWatchdog(lane, taskId) { clearLaneWatchdog(lane); lane.watchdog = setTimeout(async () => { if (!lane.task || lane.task.id !== taskId) return; const seconds = Math.round(TASK_RESULT_TIMEOUT_MS / 1000); const reason = `本地浏览器在 ${seconds} 秒内未确认回传采集结果。为避免阻塞同一平台后续任务，已转为人工复核；其他平台不会受影响。`; log(`「${lane.request?.platform || '未知平台'}」任务 ${taskId.slice(0, 8)} 在 ${seconds} 秒内未回传，正在转人工复核。`); try { await report(taskId, { status: 'needs-human', reason }) } catch (error) { localStatus = { ...localStatus, status: 'attention', lastError: noStoreError(error) }; await heartbeat() } }, TASK_RESULT_TIMEOUT_MS) }
function recordReportDiagnostic(taskId, status, { result = null, error = null } = {}) { recentReports = [{ taskId, status, at: new Date().toISOString(), delivered: !error, error: error ? noStoreError(error) : null, result: result ? { accepted: Boolean(result.accepted), fallback: result.fallback || null } : null }, ...recentReports].slice(0, 12) }
const TASK_STAGES = new Set(['dispatch-accepted', 'received-task', 'found-composer', 'query-written', 'submit-attempted', 'submission-confirmed', 'answer-detected', 'answer-stable', 'report-completed', 'fallback'])
function laneHoldingTask(taskId) { return [...lanes.values()].find((lane) => lane.task?.id === taskId) || null }
async function recordTaskStage(payload) {
  const taskId = typeof payload?.taskId === 'string' ? payload.taskId : ''
  const stage = typeof payload?.stage === 'string' ? payload.stage : ''
  const lane = laneHoldingTask(taskId)
  if (!lane) return { accepted: false, ignored: true, reason: '该阶段不属于当前本地 Agent 持有的任务。' }
  if (!TASK_STAGES.has(stage)) return { accepted: false, ignored: true, reason: '未知页面执行阶段。' }
  if (payload?.platform !== lane.task.platform) return { accepted: false, ignored: true, reason: '页面阶段的平台与当前任务不一致。' }
  const item = { taskId, stage, at: new Date().toISOString(), detail: typeof payload?.detail === 'string' ? payload.detail.slice(0, 500) : null, url: typeof payload?.url === 'string' ? payload.url.slice(0, 800) : null }
  lane.stages = [...lane.stages.filter((entry) => entry.stage !== stage), item].slice(-16)
  if (stage === 'dispatch-accepted' || stage === 'received-task') clearTaskDispatchWatchdog(lane)
  localStatus = { ...localStatus, lastPageStage: item }
  log(`「${lane.task.platform}」任务 ${taskId.slice(0, 8)} 页面阶段：${stage}${item.detail ? `（${item.detail}）` : ''}`)
  return { accepted: true, taskId, stage }
}
async function report(taskId, payload) {
  const lane = laneHoldingTask(taskId); if (!lane) throw new Error('该任务不是当前由本地 Agent 持有的任务。')
  const status = payload?.status; if (!['running', 'completed', 'needs-human', 'failed'].includes(status)) throw new Error('任务状态无效。')
  // A duplicate running report is an explicit page heartbeat, not a no-op: renew the
  // local watchdog without producing another remote state transition.
  if (status === 'running') armTaskWatchdog(lane, taskId)
  if (status === 'running' && lane.reportedRunning.has(taskId)) return { accepted: true, duplicate: true }
  try {
    const result = await remote(`/api/browser-agents/tasks/${encodeURIComponent(taskId)}`, { method: 'POST', body: payload })
    // HTTP 200 is not sufficient for a terminal report: an ignored terminal result
    // means the server did not persist the evidence/fallback. Keep the lane/task so
    // the extension's report queue can retry and surface a real diagnostic.
    if (['completed', 'needs-human', 'failed'].includes(status) && result?.ignored) {
      const ignoredError = new Error(result.reason || '服务器未接收该任务的终态回传。')
      recordReportDiagnostic(taskId, status, { result, error: ignoredError })
      throw ignoredError
    }
    if (status === 'running') lane.reportedRunning.add(taskId)
    recordReportDiagnostic(taskId, status, { result })
    if (['completed', 'needs-human', 'failed'].includes(status)) {
      clearLaneWatchdog(lane)
      lane.reportedRunning.delete(taskId)
      lane.task = null
      // A task-scoped adapter mismatch (for example a changed Kimi editor) must not
      // freeze every later Query in this platform lane. The failed task is preserved as
      // needs-human, while the next Query is safely claimed only for the same platform.
      // Login/CAPTCHA conditions deactivate the lane separately through extension-status.
      if (lane.active) setTimeout(() => { void pollTasks({ platform: lane.request?.platform || null }) }, 250)
    }
    log(`任务 ${taskId.slice(0, 8)} 已同步：${status}。`); return result
  } catch (error) { recordReportDiagnostic(taskId, status, { error }); throw error }
}
function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)) }
async function readBody(req) { let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > LOCAL_BODY_LIMIT_BYTES) throw new Error('本地请求正文过大。') } try { return body ? JSON.parse(body) : {} } catch { throw new Error('本地请求 JSON 无效。') } }
function laneSummary(platform, lane) { return { platform, active: lane.active, startRequest: lane.request ? { id: lane.request.id, testRunId: lane.request.testRunId, platform: lane.request.platform, status: lane.request.status } : null, currentTask: lane.task ? { id: lane.task.id, testRunId: lane.task.testRunId, platform: lane.task.platform } : null, pageStages: lane.stages.slice(-10) } }
async function localRequest(req, res) {
  try {
    const url = new URL(req.url || '/', `http://${LOCAL_HOST}:${LOCAL_PORT}`); const platform = url.searchParams.get('platform') || null
    if (req.method === 'GET' && url.pathname === '/v1/health') return json(res, 200, { version: AGENT_VERSION, paired: Boolean(config?.token), status: localStatus.status, lastError: localStatus.lastError || null, supportedPlatforms, active: [...lanes.values()].some((lane) => lane.active), maxParallelPlatforms: MAX_PARALLEL_PLATFORMS, lanes: [...lanes.entries()].map(([key, lane]) => laneSummary(key, lane)), currentTask: [...lanes.values()].find((lane) => lane.task)?.task || null, startRequest: platform ? laneFor(platform).request : null, recentReports })
    if (req.method === 'GET' && url.pathname === '/v1/start-request') { const lane = platform ? laneFor(platform) : null; return json(res, 200, { startRequest: lane?.request || null, startRequests: [...lanes.entries()].map(([key, value]) => laneSummary(key, value).startRequest).filter(Boolean) }) }
    if (req.method === 'POST' && url.pathname === '/v1/activate') {
      const body = await readBody(req); const requestedPlatform = body.platform; const lane = laneFor(requestedPlatform)
      if (!lane.request?.id || (body.startRequestId && body.startRequestId !== lane.request.id)) throw new Error('扩展启动授权已失效或不属于当前本地 Agent。')
      if (body.platform !== lane.request.platform || !adapterForPlatform(requestedPlatform)) throw new Error('扩展当前页面的平台与启动授权不一致。')
      lane.active = true; localStatus = { ...localStatus, status: 'online', lastError: null, extensionConnectedAt: new Date().toISOString() }
      if (lane.request.status !== 'running') await advanceStartRequest(lane, 'running')
      await heartbeat(); await pollTasks({ force: true, platform: requestedPlatform }); return json(res, 200, { active: true, platform: requestedPlatform, currentTask: lane.task, startRequest: lane.request })
    }
    if (req.method === 'POST' && url.pathname === '/v1/deactivate') { const body = await readBody(req); const lane = laneFor(body.platform); lane.active = false; return json(res, 200, { active: false, platform: body.platform }) }
    if (req.method === 'GET' && url.pathname === '/v1/next-task') { if (!platform) throw new Error('缺少 platform。'); const lane = laneFor(platform); if (!lane.active) return json(res, 200, { active: false, task: null }); if (!lane.task) await pollTasks({ platform }); return json(res, 200, { active: true, task: lane.task }) }
    if (req.method === 'POST' && url.pathname === '/v1/task-status') { const body = await readBody(req); return json(res, 200, await report(body.taskId, body)) }
    if (req.method === 'POST' && url.pathname === '/v1/task-stage') { const body = await readBody(req); return json(res, 200, await recordTaskStage(body)) }
    if (req.method === 'POST' && url.pathname === '/v1/extension-status') {
      const body = await readBody(req); const reportedPlatform = body.platform; const lane = laneFor(reportedPlatform); const extensionState = body.status === 'needs_login' ? 'needs_login' : body.status === 'attention' ? 'attention' : 'online'; const reason = typeof body.reason === 'string' ? body.reason.slice(0, 400) : null
      if (!lane.request) return json(res, 200, { accepted: true, ignored: true, shouldDispatch: false, startRequest: null })
      const expectedAdapter = adapterForPlatform(lane.request.platform)
      if (!expectedAdapter || (body.adapterId && body.adapterId !== expectedAdapter.id)) return json(res, 200, { accepted: false, ignored: true, shouldDispatch: false, startRequest: lane.request })
      // Browser processes keep an unpacked extension's old service worker/content script in
      // memory. Never dispatch a real Query to a mixed-version relay: close only this GEO
      // profile, reload the extension, and wait for a matching page-ready handshake.
      if (body.adapterVersion !== AGENT_VERSION) {
        const receivedVersion = typeof body.adapterVersion === 'string' ? body.adapterVersion : null
        localStatus = { ...localStatus, status: 'attention', lastError: `浏览器扩展版本不一致：本地 Agent 需要 v${AGENT_VERSION}，当前页面为 v${receivedVersion || '未知'}。正在安全重新加载 GEO 专用浏览器窗口。`, extensionAdapterId: body.adapterId || null, extensionAdapterVersion: receivedVersion, extensionConnectedAt: new Date().toISOString() }
        void reloadExtensionForLane(lane, receivedVersion)
        return json(res, 200, { accepted: false, upgradeRequired: true, shouldDispatch: false, requiredVersion: AGENT_VERSION, receivedVersion, startRequest: lane.request ? { id: lane.request.id, testRunId: lane.request.testRunId, platform: lane.request.platform, status: lane.request.status } : null })
      }
      lane.extensionReloadPromise = null
      localStatus = { ...localStatus, status: extensionState, lastError: reason, extensionAdapterId: body.adapterId || localStatus.extensionAdapterId || null, extensionAdapterVersion: body.adapterVersion, extensionConnectedAt: new Date().toISOString(), extensionReload: null }
      let shouldDispatch = false
      if (extensionState === 'needs_login') { lane.active = false; await advanceStartRequest(lane, 'waiting-login', reason || `${lane.request.platform} 登录状态不可用，请在受控浏览器窗口完成登录后重试。`) }
      else if (extensionState === 'attention') { lane.active = false; await advanceStartRequest(lane, 'failed', reason || '浏览器页面需要人工处理；该平台自动采集已停止。') }
      else { lane.active = true; if (lane.request.status !== 'running') await advanceStartRequest(lane, 'running'); await pollTasks({ force: true, platform: reportedPlatform }); shouldDispatch = Boolean(lane.task) }
      await heartbeat(); return json(res, 200, { accepted: true, resume: Boolean(lane.task), shouldDispatch, active: lane.active, startRequest: lane.request ? { id: lane.request.id, testRunId: lane.request.testRunId, platform: lane.request.platform, status: lane.request.status } : null, currentTask: lane.task ? { id: lane.task.id, testRunId: lane.task.testRunId, platform: lane.task.platform } : null })
    }
    return json(res, 404, { error: 'Not found.' })
  } catch (error) { return json(res, 400, { error: noStoreError(error) }) }
}
async function start() {
  config = await readConfig(); if (!config?.token) throw new Error(`未找到本地配对配置。请先运行：node agent.mjs enroll --code <一次性配对码>（配置位置：${CONFIG_PATH}）`)
  config.apiUrl = safeApiUrl(config.apiUrl); const server = createServer(localRequest); await new Promise((resolve) => server.listen(LOCAL_PORT, LOCAL_HOST, resolve))
  log(`Browser Agent 已启动：${LOCAL_HOST}:${LOCAL_PORT}。可最多并行 ${MAX_PARALLEL_PLATFORMS} 个不同平台；同一平台 Query 严格串行。`)
  await heartbeat(); await pollStartRequest(); pollTimer = setInterval(() => {
    // Never pre-claim work just because a browser window was launched. A lane starts
    // leasing only after its matching extension has confirmed the page is ready.
    for (const [platform, lane] of lanes) if (lane.active) void pollTasks({ platform })
    void pollStartRequest()
  }, POLL_MS); heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS)
  const close = () => { clearInterval(pollTimer); clearInterval(heartbeatTimer); for (const lane of lanes.values()) clearLaneWatchdog(lane); server.close(() => process.exit(0)) }; process.once('SIGINT', close); process.once('SIGTERM', close)
}
async function status() { const existing = await readConfig(); if (!existing?.token) { console.log('未配对。'); return }; console.log(JSON.stringify({ paired: true, apiUrl: existing.apiUrl, agent: existing.agent?.label ?? '本地设备', configPath: CONFIG_PATH }, null, 2)) }
try { const command = process.argv[2]; if (command === 'enroll') await enroll(); else if (command === 'start') await start(); else if (command === 'status') await status(); else usage() } catch (error) { console.error(`错误：${noStoreError(error)}`); process.exitCode = 1 }



