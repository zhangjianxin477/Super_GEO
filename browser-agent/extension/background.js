import { isReportAuthorized, isTerminalOwnershipError, normalizeAuthorizedBatch, queueReport, reportForRelay, reportIdentity } from './reportQueue.js'
import { adapterForPlatform, adapterForUrl } from './platformRegistry.js'

const LOCAL = 'http://127.0.0.1:23891'
const REPORT_QUEUE_KEY = 'geo-browser-agent.pending-reports.v1'
const REPORT_RETRY_ALARM = 'geo-browser-agent.retry-report-sync'
const AUTO_START_ALARM = 'geo-browser-agent.auto-start-check'
const STARTABLE_REQUEST_STATES = new Set(['requested', 'acknowledged', 'launching-browser', 'waiting-login', 'running'])
const REPORT_DIAGNOSTICS_KEY = 'geo-browser-agent.report-diagnostics.v1'
const AUTHORIZED_BATCHES_KEY = 'geo-browser-agent.authorized-batches.v2'
const LEGACY_AUTHORIZED_BATCH_KEY = 'geo-browser-agent.authorized-batch.v1'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let flushPromise = null
let retryTimer = null
const dispatchPromises = new Map()
const batchLaunchPromises = new Map()
const dispatchedTaskIds = new Map()
const taskReceiptWaiters = new Map()

function platformKey(value) { return String(value || '').trim() }
function taskReceiptKey(task) { return `${platformKey(task?.platform)}:${String(task?.id || '')}` }
function waitForTaskReceipt(task, timeoutMs = 5_000) {
  const key = taskReceiptKey(task); let timeout = null; let settled = false; let resolvePromise = null; let rejectPromise = null
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; timeout = setTimeout(() => { if (settled) return; settled = true; taskReceiptWaiters.delete(key); reject(new Error(`页面执行器未在 ${Math.round(timeoutMs / 1000)} 秒内确认收到任务。`)) }, timeoutMs) })
  taskReceiptWaiters.set(key, (payload) => { if (settled) return; settled = true; clearTimeout(timeout); taskReceiptWaiters.delete(key); resolvePromise(payload) })
  return { promise, cancel: () => { if (settled) return; settled = true; clearTimeout(timeout); taskReceiptWaiters.delete(key); rejectPromise(new Error('页面任务派发已取消。')) } }
}
function acknowledgeTaskStage(payload) { if (payload?.stage !== 'received-task') return; const resolve = taskReceiptWaiters.get(taskReceiptKey(payload)); if (resolve) resolve(payload) }

async function local(path, options = {}) {
  const response = await fetch(LOCAL + path, {
    ...options,
    headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `本地 Agent 请求失败（${response.status}）`)
  return body
}

async function pendingReports() {
  const stored = await chrome.storage.local.get(REPORT_QUEUE_KEY)
  const value = stored[REPORT_QUEUE_KEY]
  return Array.isArray(value) ? value : []
}

async function setPendingReports(queue) {
  await chrome.storage.local.set({ [REPORT_QUEUE_KEY]: queue.slice(0, 24) })
}

async function reportDiagnostics() {
  const stored = await chrome.storage.local.get(REPORT_DIAGNOSTICS_KEY)
  return stored[REPORT_DIAGNOSTICS_KEY] && typeof stored[REPORT_DIAGNOSTICS_KEY] === 'object' ? stored[REPORT_DIAGNOSTICS_KEY] : {}
}

async function setReportDiagnostics(value) {
  const prior = await reportDiagnostics()
  await chrome.storage.local.set({ [REPORT_DIAGNOSTICS_KEY]: { ...prior, ...value, updatedAt: new Date().toISOString() } })
}

function normalizedBatchMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result = {}
  for (const [key, candidate] of Object.entries(value)) {
    const batch = normalizeAuthorizedBatch(candidate)
    const platform = platformKey(batch?.platform || key)
    if (batch && platform) result[platform] = { ...batch, platform }
  }
  return result
}

async function authorizedBatches() {
  const stored = await chrome.storage.local.get([AUTHORIZED_BATCHES_KEY, LEGACY_AUTHORIZED_BATCH_KEY])
  const map = normalizedBatchMap(stored[AUTHORIZED_BATCHES_KEY])
  if (Object.keys(map).length) return map
  // Profiles created before v0.2.2 keep a single old entry. Read it once so the
  // next write migrates it without interrupting an already-visible Query.
  const legacy = normalizeAuthorizedBatch(stored[LEGACY_AUTHORIZED_BATCH_KEY])
  return legacy ? { [legacy.platform]: legacy } : {}
}

async function authorizedBatch(platform = null) {
  const batches = await authorizedBatches()
  const key = platformKey(platform)
  if (key) return batches[key] || null
  return Object.values(batches)[0] || null
}

async function setAuthorizedBatch(value, explicitPlatform = null) {
  const batches = await authorizedBatches()
  const normalized = normalizeAuthorizedBatch(value)
  const key = platformKey(explicitPlatform || normalized?.platform)
  if (!key) {
    if (!normalized) {
      await chrome.storage.local.remove([AUTHORIZED_BATCHES_KEY, LEGACY_AUTHORIZED_BATCH_KEY])
      return null
    }
    throw new Error('缺少 Browser Agent 平台，无法保存本地授权。')
  }
  if (normalized) batches[key] = { ...normalized, platform: key }
  else delete batches[key]
  if (Object.keys(batches).length) await chrome.storage.local.set({ [AUTHORIZED_BATCHES_KEY]: batches })
  else await chrome.storage.local.remove(AUTHORIZED_BATCHES_KEY)
  await chrome.storage.local.remove(LEGACY_AUTHORIZED_BATCH_KEY)
  return normalized ? batches[key] : null
}

function batchForReport(report, batches) {
  const explicit = platformKey(report?.platform)
  if (explicit && batches[explicit] && isReportAuthorized(report, batches[explicit])) return batches[explicit]
  return Object.values(batches).find((batch) => isReportAuthorized(report, batch)) || null
}

function scheduleReportRetry(delay = 2_500) {
  if (retryTimer) return
  retryTimer = setTimeout(() => { retryTimer = null; void flushPendingReports() }, delay)
}

async function recordDiscardedReports(discarded, reason) {
  if (!discarded.length) return
  await setReportDiagnostics({
    discardedReportCount: discarded.length,
    discardedAt: new Date().toISOString(),
    discardedReason: reason,
    discardedTaskIds: discarded.map((item) => item?.taskId).filter(Boolean).slice(0, 12),
  })
}

async function enqueueReport(payload) {
  const queue = await pendingReports()
  const batch = batchForReport(payload, await authorizedBatches())
  const report = queueReport(payload, batch)
  const key = reportIdentity(report)
  const index = queue.findIndex((item) => reportIdentity(item) === key)
  if (index >= 0) queue[index] = report
  else queue.push(report)
  await setPendingReports(queue)
  return queue.length
}

async function flushPendingReports() {
  if (flushPromise) return flushPromise
  flushPromise = (async () => {
    const batches = await authorizedBatches()
    let queue = await pendingReports()
    if (!Object.keys(batches).length) return { delivered: 0, pending: queue.length, discarded: 0, error: queue.length ? '尚未授权当前批次；不会回传历史结果。' : null }
    let delivered = 0
    let discarded = 0
    let firstError = null
    const retained = []
    for (const next of queue) {
      const batch = batchForReport(next, batches)
      if (!batch) {
        // A report for another active platform must never be discarded just because
        // this service-worker execution started from a different platform tab.
        retained.push(next)
        continue
      }
      try {
        await setReportDiagnostics({ lastAttemptAt: new Date().toISOString(), lastTaskId: next.taskId || null, lastStatus: next.status || null, lastError: null })
        await local('/v1/task-status', { method: 'POST', body: JSON.stringify(reportForRelay(next)) })
        delivered += 1
        await setReportDiagnostics({ lastDeliveredAt: new Date().toISOString(), lastTaskId: next.taskId || null, lastStatus: next.status || null, lastError: null })
      } catch (error) {
        const message = String(error?.message || error)
        if (isTerminalOwnershipError(message)) {
          discarded += 1
          await recordDiscardedReports([next], '本地 Agent 已切换任务，已跳过失效的历史回传记录。')
          continue
        }
        retained.push(next)
        firstError ||= message
      }
    }
    queue = retained
    await setPendingReports(queue)
    await setReportDiagnostics({ pendingTaskIds: queue.map((item) => item.taskId).filter(Boolean).slice(0, 12), lastError: firstError })
    if (firstError) scheduleReportRetry()
    return { delivered, pending: queue.length, discarded, error: firstError }
  })()
  try { return await flushPromise } finally { flushPromise = null }
}

async function activePlatformTab(platform) {
  const adapter = adapterForPlatform(platform)
  if (!adapter) throw new Error(`当前 Browser Agent 尚未支持「${platform || '未指定'}」平台。`)
  // Edge/MV3 can intermittently return an empty result for chrome.tabs.query({ url })
  // even while an injected content script is running in the matching tab. Scan the
  // extension-visible tabs and map URLs through the shared registry instead. This
  // keeps dispatch bound to the requested adapter without trusting the active tab.
  const allTabs = await chrome.tabs.query({})
  const tabs = allTabs.filter((item) => adapterForUrl(item.url)?.id === adapter.id)
  await setReportDiagnostics({
    lastPlatformTabScanAt: new Date().toISOString(),
    lastPlatformTabScan: {
      platform,
      adapterId: adapter.id,
      matched: tabs.map((item) => ({ id: item.id || null, host: (() => { try { return new URL(item.url).hostname } catch { return null } })(), active: Boolean(item.active), status: item.status || null })),
    },
  })
  const tab = tabs.find((item) => item.active) || tabs[0]
  if (!tab?.id) throw new Error(`受控浏览器尚未打开「${platform}」网页。系统会继续等待；如首次使用，请在该浏览器窗口完成登录。`)
  return tab
}

function isMissingPageReceiver(error) { return /Receiving end does not exist|Could not establish connection/i.test(String(error?.message || error || '')) }
async function sendToPage(tabId, task) { return await chrome.tabs.sendMessage(tabId, { type: 'geo-browser-agent/run', task }) }

async function injectPageExecutor(tabId, platform) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/platform.js'], injectImmediately: true })
    await sleep(80)
  } catch (error) {
    throw new Error(`无法向当前「${platform}」页面加载采集执行器：${error?.message || error}。请刷新该平台页面后再试。`)
  }
}

async function pageExecutorReady(tabId, platform, attempts = 6) {
  let lastError = null
  const expectedVersion = chrome.runtime.getManifest().version
  const expectedAdapter = adapterForPlatform(platform)
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const probe = await sendToPage(tabId, { platform, __geoProbe: true })
      if (!probe?.accepted || !probe.ready) throw new Error(probe?.reason || '页面执行器已加载，但可见提问输入区尚未就绪。')
      if (probe.platform !== platform || probe.adapterId !== expectedAdapter?.id) throw new Error(`页面执行器平台不匹配（期望 ${platform}/${expectedAdapter?.id || 'unknown'}，实际 ${probe?.platform || 'unknown'}/${probe?.adapterId || 'unknown'}）。`)
      if (probe.adapterVersion !== expectedVersion || probe.executorVersion !== expectedVersion) throw new Error(`页面执行器版本不一致（期望 v${expectedVersion}，实际 v${probe?.adapterVersion || '未知'}）。请等待 GEO 专用浏览器自动重载后重试。`)
      return true
    } catch (error) {
      lastError = error
      if (attempt === 1 && isMissingPageReceiver(error)) await injectPageExecutor(tabId, platform)
      // A responding but stale executor must not be injected over in place: that creates
      // two listeners in the same tab. The local Agent reloads its isolated profile instead.
      if (!isMissingPageReceiver(error) && /版本不一致|平台不匹配/.test(String(error?.message || error))) break
      await sleep(Math.min(1_000, 120 * attempt))
    }
  }
  throw lastError || new Error(`「${platform}」页面执行器未就绪。`)
}

async function sendTaskToTab(task) {
  const adapter = adapterForPlatform(task?.platform)
  if (!adapter) throw new Error(`任务所属平台「${task?.platform || '未指定'}」尚未配置自动采集适配器。`)
  const tab = await activePlatformTab(task.platform)
  if (adapterForUrl(tab.url)?.id !== adapter.id) throw new Error(`当前标签页不是「${task.platform}」页面；为避免跨平台串任务，本次不会派发 Query。`)
  try {
    await pageExecutorReady(tab.id, task.platform)
    const receipt = waitForTaskReceipt(task)
    try {
      const response = await sendToPage(tab.id, task)
      if (!response?.accepted) throw new Error(response?.reason || `「${task.platform}」页面未准备好。请确认已登录、未显示验证码，并刷新页面后重试。`)
      // chrome.tabs.sendMessage() resolving with accepted:true is the actual hand-off
      // acknowledgement: the content-script listener received this exact task. Persist it
      // to the local relay separately from best-effort page telemetry so the relay does
      // not mislabel a real execution as “never dispatched” when an MV3 worker wakes late.
      void local('/v1/task-stage', {
        method: 'POST',
        body: JSON.stringify({ taskId: task.id, platform: task.platform, stage: 'dispatch-accepted', detail: `页面执行器已确认接收任务（标签页 ${tab.id}）。`, url: tab.url || null }),
      }).catch((stageError) => setReportDiagnostics({ lastDispatchStage: 'dispatch-accepted-unreported', lastDispatchError: String(stageError?.message || stageError), lastDispatchPlatform: task.platform, lastDispatchTaskId: task.id }))
      // A message acknowledgement means the page executor accepted the task. Stage
      // telemetry is useful but must not make a real-web task look stuck if the MV3
      // service worker is briefly restarted while the content script begins typing.
      // Keep the receipt as a non-blocking diagnostic rather than turning it into a
      // second dispatch gate.
      void receipt.promise
        .then((received) => setReportDiagnostics({ lastDispatchAt: new Date().toISOString(), lastDispatchPlatform: task.platform, lastDispatchTaskId: task.id, lastDispatchStage: received?.stage || 'received-task', lastDispatchError: null }))
        .catch((receiptError) => setReportDiagnostics({ lastDispatchAt: new Date().toISOString(), lastDispatchPlatform: task.platform, lastDispatchTaskId: task.id, lastDispatchStage: 'unconfirmed', lastDispatchError: String(receiptError?.message || receiptError) }))
      return response
    } catch (dispatchError) {
      receipt.cancel()
      throw dispatchError
    }
  } catch (error) {
    const reason = `「${task.platform}」页面执行器未就绪：${error?.message || error}。已等待页面水合并尝试修复；如仍失败，请刷新该平台受控窗口后重试。`
    await setReportDiagnostics({ lastDispatchError: reason, lastDispatchPlatform: task.platform, lastDispatchTaskId: task?.id || null })
    throw new Error(reason)
  }
}

async function resumeAuthorizedBatch(platform, remaining = 6) {
  const key = platformKey(platform)
  if (!key) return { state: 'idle' }
  if (dispatchPromises.has(key)) return dispatchPromises.get(key)
  const pending = (async () => {
    const authorized = await authorizedBatch(key)
    if (!authorized) return null
    try {
      const response = await local('/v1/next-task?platform=' + encodeURIComponent(key))
      if (!response.active) {
        dispatchedTaskIds.delete(key)
        await setAuthorizedBatch(null, key)
        return { state: 'stopped', platform: key }
      }
      const next = response.task
      if (next) {
        if (next.id === dispatchedTaskIds.get(key)) return { state: 'already-dispatched', task: next }
        await setAuthorizedBatch({ active: true, platform: next.platform, taskId: next.id, testRunId: next.testRunId }, key)
        const dispatched = await sendTaskToTab(next)
        dispatchedTaskIds.set(key, next.id)
        return { state: 'running', task: next, dispatched }
      }
      if (remaining > 0) setTimeout(() => { void resumeAuthorizedBatch(key, remaining - 1) }, 1_250)
      return { state: 'waiting', platform: key }
    } catch (error) {
      await setReportDiagnostics({ lastDispatchError: String(error?.message || error), lastDispatchPlatform: key })
      return { state: 'error', platform: key, error: String(error?.message || error) }
    }
  })()
  dispatchPromises.set(key, pending)
  try { return await pending } finally { dispatchPromises.delete(key) }
}

async function launchBatch(startRequestId = null, requestedPlatform = null) {
  const platformQuery = requestedPlatform ? '?platform=' + encodeURIComponent(requestedPlatform) : ''
  const authorization = await local('/v1/start-request' + platformQuery)
  const startRequest = authorization?.startRequest
  if (!startRequest || (startRequestId && startRequest.id !== startRequestId)) throw new Error('当前系统启动授权已失效；请回到 GEO 系统重新点击“启动本地自动采集”。')
  const key = platformKey(startRequest.platform)
  const adapter = adapterForPlatform(key)
  if (!adapter) throw new Error(`当前 Browser Agent 尚未支持「${key}」平台。`)
  dispatchedTaskIds.delete(key)
  const activation = await local('/v1/activate', { method: 'POST', body: JSON.stringify({ platform: key, startRequestId: startRequest.id }) })
  let task = activation.currentTask || (await local('/v1/next-task?platform=' + encodeURIComponent(key))).task
  if (!task) {
    await setAuthorizedBatch(null, key)
    return { state: 'empty', message: `当前没有排队中的「${key}」任务。请先在 GEO 系统中创建测试批次，或稍后刷新。` }
  }
  if (task.platform !== key) throw new Error(`本地 Agent 返回了「${task.platform}」任务，但当前授权为「${key}」；已拒绝派发以避免跨平台串任务。`)
  await setAuthorizedBatch({ active: true, platform: key, taskId: task.id, testRunId: task.testRunId }, key)
  const pending = await flushPendingReports()
  task = (await local('/v1/next-task?platform=' + encodeURIComponent(key))).task
  if (!task) return { state: 'waiting', message: '当前结果正在同步或等待下一条任务。', pending }
  if (task.platform !== key) throw new Error(`本地 Agent 返回了不匹配的平台任务；已停止派发。`)
  await setAuthorizedBatch({ active: true, platform: key, taskId: task.id, testRunId: task.testRunId }, key)
  const dispatched = await sendTaskToTab(task)
  dispatchedTaskIds.set(key, task.id)
  return { state: 'running', task, dispatched, pending }
}

async function launchAuthorizedBatch(startRequestId = null, platform = null) {
  const key = platformKey(platform)
  if (!key) throw new Error('缺少需启动的平台。')
  if (batchLaunchPromises.has(key)) return batchLaunchPromises.get(key)
  const pending = launchBatch(startRequestId, key)
  batchLaunchPromises.set(key, pending)
  try { return await pending } finally { batchLaunchPromises.delete(key) }
}

async function autoStartAuthorizedBatch(platform = null) {
  const key = platformKey(platform)
  if (!key) return { state: 'idle' }
  const batch = await authorizedBatch(key)
  const authorization = await local('/v1/start-request?platform=' + encodeURIComponent(key)).catch(() => ({ startRequest: null }))
  const startRequest = authorization?.startRequest
  if (!startRequest || !adapterForPlatform(startRequest.platform) || !STARTABLE_REQUEST_STATES.has(startRequest.status)) {
    if (!startRequest) {
      dispatchedTaskIds.delete(key)
      await setAuthorizedBatch(null, key)
    }
    return { state: 'idle', platform: key }
  }
  const health = await local('/v1/health').catch(() => null)
  const lane = Array.isArray(health?.lanes) ? health.lanes.find((item) => item.platform === key) : null
  try {
    // Do not activate the local lane (which leases a task) until the live page has a
    // usable composer. A DOM probe alone can succeed while ChatGLM is still hydrating.
    const tab = await activePlatformTab(key)
    await pageExecutorReady(tab.id, key)
    if (batch?.testRunId === startRequest.testRunId && batch.platform === startRequest.platform && lane?.active && lane?.startRequest?.id === startRequest.id) return resumeAuthorizedBatch(key, 0)
    if (batch) await setAuthorizedBatch(null, key)
    return await launchAuthorizedBatch(startRequest.id, key)
  } catch (error) {
    const reason = String(error?.message || error)
    const status = /登录|验证码|login|sign in/i.test(reason) ? 'needs_login' : 'attention'
    await local('/v1/extension-status', { method: 'POST', body: JSON.stringify({ status, reason, platform: key, adapterId: adapterForPlatform(key)?.id || null, adapterVersion: chrome.runtime.getManifest().version }) }).catch(() => undefined)
    return { state: status, message: reason, startRequest }
  }
}

// A visible GEO-owned platform page is already explicit customer authorization only
// when the SaaS has an active start request. Do not wait exclusively for the page's
// optional readiness message: MV3 background/content startup order is nondeterministic
// after a browser/profile restart. The direct path probes/injects the executor and then
// relies on the same guarded launchBatch flow, so it cannot create work without a current
// server-issued start request or cross-dispatch between platforms.
async function launchVisibleStartRequest(platform) {
  const key = platformKey(platform)
  if (!key) return { state: 'idle' }
  const authorization = await local('/v1/start-request?platform=' + encodeURIComponent(key)).catch(() => ({ startRequest: null }))
  const startRequest = authorization?.startRequest
  if (!startRequest || startRequest.platform !== key || !STARTABLE_REQUEST_STATES.has(startRequest.status)) return { state: 'idle', platform: key }
  if (batchLaunchPromises.has(key)) return batchLaunchPromises.get(key)
  try {
    // A tab can finish loading before its SPA composer exists. Preflight the same
    // page executor readiness used for dispatch before activating/claiming a task.
    const tab = await activePlatformTab(key)
    await pageExecutorReady(tab.id, key)
    return await launchAuthorizedBatch(startRequest.id, key)
  } catch (error) {
    const reason = String(error?.message || error)
    await setReportDiagnostics({ lastDispatchError: reason, lastDispatchPlatform: key, lastAutoStartAt: new Date().toISOString() })
    return { state: 'waiting-page', platform: key, message: reason }
  }
}

async function launchVisibleStartRequests() {
  const tabs = await chrome.tabs.query({})
  const platforms = [...new Set(tabs.map((tab) => adapterForUrl(tab.url)?.platform).filter(Boolean))]
  await Promise.all(platforms.map((platform) => launchVisibleStartRequest(platform)))
}

function scheduleAutoStart(delay = 0, platform = null) {
  const key = platformKey(platform)
  if (key) setTimeout(() => { void autoStartAuthorizedBatch(key) }, delay)
}

async function pauseBatch(platform = null) {
  const key = platformKey(platform)
  if (!key) return { state: 'idle' }
  dispatchedTaskIds.delete(key)
  await setAuthorizedBatch(null, key)
  await local('/v1/deactivate', { method: 'POST', body: JSON.stringify({ platform: key }) })
  return { state: 'paused', platform: key }
}

async function relayReport(payload) {
  // A result can arrive after the service worker has been suspended. Resolve the
  // owning platform from the stored lane map once, rather than relying on whatever
  // tab happened to be active when the worker woke up.
  const batches = await authorizedBatches()
  const matchingBatch = Object.values(batches).find((batch) => batch.taskId === payload?.taskId)
  const platform = platformKey(payload?.platform || matchingBatch?.platform)
  await enqueueReport({ ...payload, platform: platform || payload?.platform || null })
  const result = await flushPendingReports()
  if (['completed', 'needs-human', 'failed'].includes(payload?.status) && result.delivered > 0 && !result.pending && platform) {
    dispatchedTaskIds.delete(platform)
    setTimeout(() => { void resumeAuthorizedBatch(platform) }, 300)
  }
  return { accepted: true, syncPending: result.pending > 0, pendingReportCount: result.pending, discardedReportCount: result.discarded || 0, syncError: result.error || null }
}

async function enrichedStatus() {
  const [health, queue, diagnostics, batches] = await Promise.all([local('/v1/health'), pendingReports(), reportDiagnostics(), authorizedBatches()])
  const authorized = Object.values(batches)
  return {
    ...health,
    pendingReportCount: queue.length,
    pendingReports: queue.map((item) => ({ taskId: item.taskId || null, status: item.status || null, platform: item.platform || null })),
    syncPending: queue.length > 0,
    batchAuthorized: authorized.length > 0,
    authorizedBatch: authorized[0] ? { taskId: authorized[0].taskId, testRunId: authorized[0].testRunId, platform: authorized[0].platform } : null,
    authorizedBatches: authorized.map((batch) => ({ taskId: batch.taskId, testRunId: batch.testRunId, platform: batch.platform })),
    reportDiagnostics: diagnostics,
  }
}

async function resumeAllAuthorizedBatches() {
  const batches = await authorizedBatches()
  await Promise.all(Object.keys(batches).map((platform) => autoStartAuthorizedBatch(platform)))
}

function wakeVisibleStartRequests() {
  void launchVisibleStartRequests()
  // The page may have completed before its SPA composer finished hydrating. A bounded
  // second pass is enough to recover the normal extension/content startup race without
  // repeatedly creating new tasks: launchAuthorizedBatch is per-platform deduplicated.
  setTimeout(() => { void launchVisibleStartRequests() }, 1_500)
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(REPORT_RETRY_ALARM, { periodInMinutes: 1 })
  chrome.alarms.create(AUTO_START_ALARM, { periodInMinutes: 1 })
  void flushPendingReports()
  void resumeAllAuthorizedBatches()
  wakeVisibleStartRequests()
})
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(REPORT_RETRY_ALARM, { periodInMinutes: 1 })
  chrome.alarms.create(AUTO_START_ALARM, { periodInMinutes: 1 })
  void flushPendingReports()
  void resumeAllAuthorizedBatches()
  wakeVisibleStartRequests()
})
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  const platform = adapterForUrl(tab.url)?.platform || null
  if (changeInfo.status === 'complete' && platform) {
    scheduleAutoStart(350, platform)
    setTimeout(() => { void launchVisibleStartRequest(platform) }, 240)
  }
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REPORT_RETRY_ALARM) void flushPendingReports().then(() => resumeAllAuthorizedBatches())
  if (alarm.name === AUTO_START_ALARM) {
    void resumeAllAuthorizedBatches()
    void launchVisibleStartRequests()
  }
})
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type === 'geo-browser-agent/start') { launchAuthorizedBatch(null, message.platform || null).then(respond).catch((error) => respond({ state: 'error', message: error.message })); return true }
  if (message?.type === 'geo-browser-agent/pause') { pauseBatch(message.platform || null).then(respond).catch((error) => respond({ state: 'error', message: error.message })); return true }
  if (message?.type === 'geo-browser-agent/status') { enrichedStatus().then(respond).catch((error) => respond({ error: error.message })); return true }
  if (message?.type === 'geo-browser-agent/report') { relayReport(message.payload).then(respond).catch((error) => respond({ error: error.message })); return true }
  if (message?.type === 'geo-browser-agent/task-stage') {
    acknowledgeTaskStage(message.payload)
    local('/v1/task-stage', { method: 'POST', body: JSON.stringify(message.payload) }).then(respond).catch((error) => respond({ accepted: false, error: String(error?.message || error) }))
    return true
  }
  if (message?.type === 'geo-browser-agent/agent-status') {
    local('/v1/extension-status', { method: 'POST', body: JSON.stringify(message.payload) })
      .then(async (result) => {
        if (message.payload?.status === 'online' && result?.shouldDispatch && result?.startRequest?.id) {
          try {
            const started = await launchAuthorizedBatch(result.startRequest.id, result.startRequest.platform)
            await setReportDiagnostics({ lastAutoStartAt: new Date().toISOString(), lastAutoStartState: started?.state || 'unknown', lastDispatchError: null, lastDispatchPlatform: result.startRequest.platform })
            respond({ ...result, autoStart: started })
          } catch (error) {
            const reason = String(error?.message || error)
            await setReportDiagnostics({ lastAutoStartAt: new Date().toISOString(), lastDispatchError: reason, lastDispatchPlatform: result.startRequest.platform })
            respond({ ...result, autoStart: { state: 'error', message: reason } })
          }
          return
        }
        if (result?.resume || message.payload?.status === 'online') scheduleAutoStart(120, message.payload?.platform || result?.startRequest?.platform || null)
        respond(result)
      })
      .catch(async (error) => {
        await setReportDiagnostics({ lastDispatchError: String(error?.message || error) }).catch(() => undefined)
        respond({ accepted: false })
      })
    return true
  }
  return false
})