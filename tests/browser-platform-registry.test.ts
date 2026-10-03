// @ts-nocheck
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGENT_VERSION, PLATFORM_ADAPTERS, adapterForPlatform, adapterForUrl, manifestHostPatterns, supportedAdapters, supportedPlatforms } from '../browser-agent/extension/platformRegistry.js'

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'browser-agent/extension/manifest.json'), 'utf8'))
const background = readFileSync(resolve(process.cwd(), 'browser-agent/extension/background.js'), 'utf8')
const content = readFileSync(resolve(process.cwd(), 'browser-agent/extension/content/platform.js'), 'utf8')
const launcher = readFileSync(resolve(process.cwd(), 'browser-agent/Start-GEO-Agent.ps1'), 'utf8')
const agent = readFileSync(resolve(process.cwd(), 'browser-agent/agent.mjs'), 'utf8')

describe('domestic Browser Agent platform registry', () => {
  it('declares the seven currently supported real-web adapters', () => {
    expect(AGENT_VERSION).toBe(manifest.version)
    expect(launcher).toContain("$expectedAgentVersion = '0.3.25'")
    expect(launcher).toContain("$profileRoot = Join-Path $dataHome 'edge-profiles'")
    expect(launcher).toContain('Stop-ControlledEdge')
    expect(launcher).toContain('[switch]$Restart')
    expect(supportedPlatforms).toEqual(['豆包', '元宝', 'DeepSeek', '通义千问', '智谱清言（GLM）', 'Kimi'])
    expect(supportedAdapters.map((item) => item.id)).toEqual(['doubao-web', 'yuanbao-web', 'deepseek-web', 'qwen-web', 'glm-web', 'kimi-web'])
    expect(adapterForPlatform('通义千问')).toMatchObject({ id: 'qwen-web', platform: '通义千问' })
    expect(adapterForPlatform('文心一言')).toBeNull()
    expect(adapterForUrl('https://wenxin.baidu.com/?enter_type=yiyan_site')).toBeNull()
    expect(adapterForUrl('https://yiyan.baidu.com/')).toBeNull()
    expect(adapterForUrl('https://kimi.com/')).toMatchObject({ id: 'kimi-web', platform: 'Kimi' })
  })

  it('maps every supported homepage host to its matching adapter and manifest permission', () => {
    for (const adapter of PLATFORM_ADAPTERS) {
      expect(adapterForUrl(adapter.homepage)?.id).toBe(adapter.id)
      for (const pattern of adapter.hostPatterns) {
        expect(manifest.host_permissions).toContain(pattern)
        expect(manifest.content_scripts[0].matches).toContain(pattern)
        expect(manifestHostPatterns).toContain(pattern)
      }
    }
  })

  it('defaults to parallel platform lanes while keeping one task per platform', () => {
    expect(agent).toContain('process.env.GEO_AGENT_MAX_PARALLEL_PLATFORMS || supportedPlatforms.length')
    expect(agent).toContain("remote(`/api/browser-agents/tasks?platform=${encodeURIComponent(platform)}`)")
    expect(agent).toContain('const lane = laneFor(reportedPlatform)')
    expect(agent).toContain('已取得一项 ${platform} 任务')
    expect(agent).not.toContain('${key} 任务')
  })
  it('keeps one page executor and uses a bounded readiness probe before dispatch', () => {
    expect(content).toContain('__GEO_BROWSER_AGENT_PAGE_EXECUTOR_V0325__')
    expect(content).toContain("Never call document.execCommand('selectAll')")
    expect(content).toContain('message?.task?.__geoProbe')
    expect(background).toContain('async function pageExecutorReady(tabId, platform, attempts = 6)')
    expect(background).toContain('await pageExecutorReady(tab.id, task.platform)')
    expect(background).toContain('页面执行器版本不一致')
    expect(content).toContain("executorVersion: '0.3.25'")
  })

  it('forces a clean GEO-owned profile bootstrap for every new explicit start request', () => {
    expect(agent).toContain('async function controlledBrowserProcessCount(profilePath)')
    expect(agent).toContain('For every *new explicit* system start')
    expect(agent).toContain('ensureCurrentExtension = false')
    expect(agent).toContain('start-request-extension-bootstrap')
    expect(agent).toContain('launchBrowserForStartRequest(lane, { ensureCurrentExtension: isNew })')
    expect(agent).toContain('async function closeControlledBrowserProfile(profilePath)')
    expect(agent).toContain('async function waitForControlledBrowserExit(profilePath, timeoutMs = 12_000)')
    expect(agent).toContain('为避免打开未加载 GEO 扩展的页面，本次不派发任务')
    expect(agent).toContain('--disable-extensions-except=')
    expect(agent).toContain('--load-extension=')
    expect(agent).toContain("const LOCAL_DIAGNOSTICS_ENABLED = process.env.GEO_BROWSER_DIAGNOSTICS === '1'")
    expect(agent).toContain("'--remote-debugging-address=127.0.0.1'")
    expect(agent).toContain('async function reloadExtensionForLane(lane, receivedVersion)')
    expect(agent).toContain("'--disable-session-crashed-bubble'")
    expect(agent).not.toContain('async function restartControlledBrowser(profilePath)')
    expect(launcher).toContain('[void]$nativeProcess.CloseMainWindow()')
  })
  it('isolates dispatch to the selected platform and reports matching adapter identity', () => {
    expect(background).toContain('async function activePlatformTab(platform)')
    expect(background).toContain('const allTabs = await chrome.tabs.query({})')
    expect(background).toContain('adapterForUrl(item.url)?.id === adapter.id')
    expect(background).not.toContain('chrome.tabs.query({ url: adapter.hostPatterns })')
    expect(content).toContain('single dropped ready message must not leave an otherwise usable page idle.')
    expect(content).toContain('await sleep(PAGE_READY_POLL_MS)')
    expect(background).toContain('const dispatchPromises = new Map()')
    expect(background).toContain('const batchLaunchPromises = new Map()')
    expect(background).toContain('task.platform !== key')
    expect(background).toContain('adapterForUrl(tab.url)?.id !== adapter.id')
    expect(background).not.toContain("body: JSON.stringify({ platform: '豆包'")
    expect(content).toContain('const ADAPTERS_BY_HOST')
    expect(content).toContain('task.platform !== ADAPTER.platform')
    expect(content).toContain('系统已阻止跨平台串任务')
  })
  it('fails closed for Qwen chrome, uses bounded generation controls, and releases expired local lanes', () => {
    expect(content).toContain('qwenPageChrome')
    expect(content).toContain('Only dedicated controls and status elements may prove active generation')
    expect(content).not.toContain('[class*="search"], [class*="think"]')
    expect(agent).toContain('GEO_AGENT_TASK_RESULT_TIMEOUT_MS')
    expect(agent).toContain('duplicate running report is an explicit page heartbeat')
    expect(content).toContain('const TASK_HEARTBEAT_MS')
    expect(content).toContain("const POLL_DELAY_MS = timingValue('pollDelayMs', 1_200)")
    expect(content).toContain("const SOURCE_RETRY_MS = timingValue('sourceRetryMs', 500)")
    expect(content).toContain("[contenteditable=\"plaintext-only\"]")
    expect(agent).toContain('lane.reportedRunning.clear()')
    expect(agent).toContain('lane.task = null')
    expect(agent).toContain('已释放本地任务槽位')
  })

  it('keeps a platform lane progressing after a task-scoped adapter miss', () => {
    expect(agent).toContain("if (lane.active) setTimeout(() => { void pollTasks({ platform: lane.request?.platform || null }) }, 250)")
    expect(content).toContain('task-scoped selector/write/capture miss')
    expect(content).toContain('composerDiagnostic')
  })
})










