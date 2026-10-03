// @ts-nocheck
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const adapterSource = readFileSync(resolve(process.cwd(), 'browser-agent/extension/content/platform.js'), 'utf8')
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'browser-agent/extension/manifest.json'), 'utf8'))

async function waitFor(predicate, timeoutMs = 9_000) {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for adapter report')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('Domestic Browser Agent platform adapter', () => {
  it('re-activates a preserved extension batch after the local relay restarts', () => {
    const backgroundSource = readFileSync(resolve(process.cwd(), 'browser-agent/extension/background.js'), 'utf8')
    expect(backgroundSource).toContain("lane?.active && lane?.startRequest?.id === startRequest.id")
    expect(backgroundSource).toContain('if (batch) await setAuthorizedBatch(null, key)')
    expect(backgroundSource).toContain('const AUTHORIZED_BATCHES_KEY')
  })
  it('retries the start authorization after the Doubao page reports itself ready', () => {
    const backgroundSource = readFileSync(resolve(process.cwd(), 'browser-agent/extension/background.js'), 'utf8')
    expect(backgroundSource).toContain("message.payload?.status === 'online') scheduleAutoStart(120, message.payload?.platform")
  })
  it('activates and dispatches immediately when the visible Doubao page reports ready', () => {
    const backgroundSource = readFileSync(resolve(process.cwd(), 'browser-agent/extension/background.js'), 'utf8')
    const agentSource = readFileSync(resolve(process.cwd(), 'browser-agent/agent.mjs'), 'utf8')
    expect(agentSource).toContain('shouldDispatch = Boolean(lane.task)')
    expect(agentSource).toContain('const lane = laneFor(reportedPlatform)')
    expect(backgroundSource).toContain('result?.shouldDispatch && result?.startRequest?.id')
    expect(backgroundSource).toContain('await launchAuthorizedBatch(result.startRequest.id, result.startRequest.platform)')
  })
  it('keeps the page adapter telemetry version aligned with the unpacked extension manifest', () => {
    expect(adapterSource).toContain("'www.doubao.com': { id: 'doubao-web', version: '0.3.25'")
    expect(adapterSource).toContain("'www.kimi.com': { id: 'kimi-web', version: '0.3.25'")
    expect(adapterSource).toContain("'www.qianwen.com': { id: 'qwen-web', version: '0.3.25'")
    expect(adapterSource).toContain("'wenxin.baidu.com': { id: 'wenxin-web', version: '0.3.25'")
    expect(adapterSource).toContain("'ernie.baidu.com': { id: 'wenxin-web', version: '0.3.25'")
    expect(manifest.host_permissions).toContain('https://wenxin.baidu.com/*')
    expect(manifest.host_permissions).toContain('https://ernie.baidu.com/*')
    expect(manifest.version).toBe('0.3.25')
  })
  it('does not advertise a GLM page executor as ready before its composer hydrates', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="transcript">正在加载对话</section></main></body></html>', { url: 'https://chatglm.cn/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    let listener = null
    const timing = { pageReadyPollMs: 1, pageReadyTimeoutMs: 2 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: {
      sendMessage: () => Promise.resolve({ accepted: true }),
      onMessage: { addListener: (value) => { listener = value } },
    } } })
    window.eval(adapterSource)
    const probe = await new Promise((resolve) => listener({ type: 'geo-browser-agent/run', task: { platform: '智谱清言（GLM）', __geoProbe: true } }, null, resolve))
    expect(probe.accepted).toBe(true)
    expect(probe.ready).toBe(false)
    expect(probe.reason).toContain('composerCandidates')
    window.close()
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  })

  it('passes the active supported platform to the popup fallback start and renews running task leases', () => {
    const popupSource = readFileSync(resolve(process.cwd(), 'browser-agent/extension/popup.js'), 'utf8')
    const agentSource = readFileSync(resolve(process.cwd(), 'browser-agent/agent.mjs'), 'utf8')
    expect(popupSource).toContain("ask('geo-browser-agent/start', { platform: currentPlatform })")
    expect(popupSource).toContain('adapterForUrl')
    expect(adapterSource).toContain('const TASK_HEARTBEAT_MS')
    expect(adapterSource).toContain("await report(task, { status: 'running' })")
    expect(agentSource).toContain('duplicate running report is an explicit page heartbeat')
  })

  it.each([
    { platform: 'Kimi', url: 'https://www.kimi.com/', composer: '<div class="input-editor" contenteditable="true" data-placeholder="输入 / 唤起插件和技能"></div>', send: '<button type="button" aria-label="发送">发送</button>' },
    { platform: 'DeepSeek', url: 'https://chat.deepseek.com/', composer: '<textarea placeholder="给 DeepSeek 发送消息"></textarea>', send: '<button type="button" aria-label="发送">发送</button>' },
    { platform: '元宝', url: 'https://yuanbao.tencent.com/chat/', composer: '<textarea placeholder="输入问题"></textarea>', send: '<button type="button" aria-label="发送">发送</button>' },
    { platform: '文心一言', url: 'https://yiyan.baidu.com/', composer: '<div class="chat-input" contenteditable="plaintext-only" role="textbox" aria-label="输入你想问的问题"></div>', send: '<button type="button" aria-label="发送">发送</button>' },
    { platform: '通义千问', url: 'https://www.qianwen.com/', composer: '<textarea placeholder="向千问提问"></textarea>', send: '<button type="button" aria-label="发送">发送</button>' },
    { platform: '智谱清言（GLM）', url: 'https://chatglm.cn/', composer: '<div class="input-editor" contenteditable="true" data-placeholder="输入问题"></div>', send: '<button type="button" aria-label="发送">发送</button>' },
  ])('writes, sends, and returns a new visible answer for $platform', async ({ platform, url, composer, send }) => {
    const dom = new JSDOM(`<!doctype html><html><body><main><section class="composer">${composer}${send}</section></main></body></html>`, { url, runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 320, height: 40, top: 640, right: 640, bottom: 680, left: 320 }),
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 420 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: {
      runtime: {
        sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) },
        onMessage: { addListener: (value) => { listener = value } },
      },
    } })
    const input = window.document.querySelector('textarea, [contenteditable]:not([contenteditable="false"])')
    const button = window.document.querySelector('[aria-label="发送"]')
    button.addEventListener('click', () => {
      const question = input.value || input.textContent
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${question}</div>`
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = `<div class="markdown-body">这是 ${platform} 为本轮 Query 新生成的完整回答，用于验证自动写入、点击发送、任务绑定与答案回传均在真实网页适配器中按平台独立执行，不会复用其他平台或上一轮的内容。该回答还明确说明了企业 GEO 测试需要在客户可见、真实登录态的网页中完成，并将原始回答、引用资料和运行状态分别回传至系统，供后续分析和交付使用。${platform === '通义千问' ? '<table><thead><tr><th>产品</th><th>证据</th></tr></thead><tbody><tr><td>工具 A</td><td>来源可追溯</td></tr></tbody></table>' : ''}</div>`
      window.document.querySelector('main').append(user, answer)
    })

    window.eval(adapterSource)
    const question = `${platform} 平台自动采集测试 Query`
    listener({ type: 'geo-browser-agent/run', task: { id: `task-${platform}`, platform, question } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))

    expect(input.value || input.textContent).toContain(question)
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports)).toBeTruthy()
    expect(completed?.payload?.platform).toBe(platform)
    expect(completed?.payload?.evidence?.rawAnswer).toContain(`${platform} 为本轮 Query 新生成的完整回答`)
    if (platform === '通义千问') expect(completed?.payload?.evidence?.rawAnswer).toContain('| 产品 | 证据 |')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('accepts Qwen’s next same-platform Query when the first terminal report immediately triggers serial dispatch', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><textarea placeholder="向千问提问"></textarea><button type="button" aria-label="发送">发送</button></section></main></body></html>', { url: 'https://www.qianwen.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    let secondDispatch = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 320, height: 40, top: 640, right: 640, bottom: 680, left: 320 }),
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 700 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    const input = window.document.querySelector('textarea')
    const button = window.document.querySelector('[aria-label="发送"]')
    button.addEventListener('click', () => {
      const question = input.value
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${question}</div>`
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = `<div class="markdown-body">Qwen 针对「${question}」生成的完整本轮回答，包含可复核的产品建议与来源说明。</div>`
      window.document.querySelector('main').append(user, answer)
    })
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: {
      sendMessage: (message) => {
        reports.push(message)
        if (message.type === 'geo-browser-agent/report' && message.payload?.taskId === 'qwen-first' && message.payload?.status === 'completed') {
          listener({ type: 'geo-browser-agent/run', task: { id: 'qwen-second', platform: '通义千问', question: '第二个 Qwen 串行 Query' } }, null, (response) => { secondDispatch = response })
        }
        return Promise.resolve({ accepted: true })
      },
      onMessage: { addListener: (value) => { listener = value } },
    } } })

    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'qwen-first', platform: '通义千问', question: '第一个 Qwen 串行 Query' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'qwen-second' && item.payload?.status === 'completed'), 4_000)

    expect(secondDispatch).toMatchObject({ accepted: true, started: true })
    const first = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'qwen-first' && item.payload?.status === 'completed')
    const second = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'qwen-second' && item.payload?.status === 'completed')
    expect(first?.payload?.evidence?.rawAnswer).toContain('第一个 Qwen 串行 Query')
    expect(second?.payload?.evidence?.rawAnswer).toContain('第二个 Qwen 串行 Query')
    window.close()
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)
  it('submits 文心一言 through its current icon-only send container', async () => {
    const dom = new JSDOM(`<!doctype html><html><body><main><section class="composer"><textarea placeholder="输入你想问的问题"></textarea><div class="wenxin-send-icon"><svg aria-hidden="true"><path d="M0 0"></path></svg></div></section></main></body></html>`, { url: 'https://ernie.baidu.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: function () {
        if (this.matches('textarea')) return { width: 440, height: 44, top: 620, right: 620, bottom: 664, left: 180 }
        if (this.matches('.wenxin-send-icon')) return { width: 40, height: 40, top: 622, right: 672, bottom: 662, left: 632 }
        return { width: 120, height: 32, top: 40, right: 160, bottom: 72, left: 40 }
      },
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 2, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 420 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    const input = window.document.querySelector('textarea')
    window.document.querySelector('.wenxin-send-icon').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${input.value}</div>`
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = '<div class="markdown-body">这是文心一言通过无文字蓝色上箭头提交后的完整回答，用于验证扩展只在已识别输入框右侧的图标容器中执行发送，并能将本轮回答安全回传至系统。</div>'
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-wenxin-icon-only', platform: '文心一言', question: '文心一言图标发送测试 Query' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports)).toBeTruthy()
    expect(completed.payload.evidence.rawAnswer).toContain('无文字蓝色上箭头')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('submits 文心一言 through its plaintext editor and bare upward-arrow wrapper', async () => {
    const dom = new JSDOM(`<!doctype html><html><body><main><section class="composer"><div class="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="true"></div><div class="up-arrow"><svg aria-hidden="true"><path d="M0 0"></path></svg></div></section></main></body></html>`, { url: 'https://yiyan.baidu.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    const editorEvents = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: function () {
        if (this.matches('.editor')) return { width: 440, height: 44, top: 620, right: 620, bottom: 664, left: 180 }
        if (this.matches('.up-arrow, .up-arrow svg')) return { width: 40, height: 40, top: 622, right: 672, bottom: 662, left: 632 }
        return { width: 120, height: 32, top: 40, right: 160, bottom: 72, left: 40 }
      },
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 2, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 420 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    const editor = window.document.querySelector('.editor')
    editor.addEventListener('change', () => editorEvents.push('change'))
    editor.addEventListener('compositionend', () => editorEvents.push('compositionend'))
    window.document.querySelector('.up-arrow').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${editor.textContent}</div>`
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.setAttribute('data-message-id', 'wenxin-plaintext-answer')
      answer.className = 'assistant-message'
      answer.innerHTML = '<div class="markdown-body">这是文心一言 plaintext 编辑器与裸上箭头容器提交后的完整回答。该回答用于验证真实页面的新输入形态能够被安全识别、正确发送、等待回答稳定后回传系统，而不会混入导航或历史会话文本。</div>'
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-wenxin-plaintext', platform: '文心一言', question: '文心一言 plaintext 编辑器测试 Query' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports)).toBeTruthy()
    expect(editorEvents).toEqual(expect.arrayContaining(['change', 'compositionend']))
    expect(completed.payload.evidence.rawAnswer).toContain('裸上箭头容器')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)


  it('submits 文心一言 from a late-mounted open Shadow DOM composer', async () => {
    const decoys = '<i aria-hidden="true"></i>'.repeat(2_250)
    const dom = new JSDOM(`<!doctype html><html><body><main>${decoys}<section id="wenxin-host"></section></main></body></html>`, { url: 'https://yiyan.baidu.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    let clickCount = 0
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: function () {
        if (this.matches('.wenxin-editor')) return { width: 760, height: 148, top: 360, right: 1_300, bottom: 508, left: 540 }
        if (this.matches('.wenxin-send, .wenxin-send svg, .wenxin-send path')) return { width: 44, height: 44, top: 456, right: 1_288, bottom: 500, left: 1_244 }
        return { width: 120, height: 32, top: 40, right: 160, bottom: 72, left: 40 }
      },
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 2, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 480 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    const host = window.document.querySelector('#wenxin-host')
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = '<section class="composer"><div class="wenxin-editor" contenteditable="plaintext-only" role="textbox" aria-multiline="true"></div><div class="wenxin-send"><svg aria-hidden="true"><path d="M0 0"></path></svg></div></section>'
    const editor = shadow.querySelector('.wenxin-editor')
    shadow.querySelector('.wenxin-send').addEventListener('click', () => {
      clickCount += 1
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${editor.textContent}</div>`
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.setAttribute('data-message-id', 'wenxin-shadow-answer')
      answer.className = 'assistant-message'
      answer.innerHTML = '<div class="markdown-body">这是开放 Shadow DOM 中新版文心输入框提交后的完整当前回答，用于验证页面能够在大量动态节点之后识别真实可写编辑器、写入当前 Query、触发右侧蓝色上箭头并只回传当前轮结果，而不是欢迎语或历史会话。</div>'
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    const question = '文心 Shadow DOM 编辑器测试 Query'
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-wenxin-shadow', platform: '文心一言', question } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-wenxin-shadow' && ['completed', 'needs-human'].includes(item.payload?.status)), 4_000)
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-wenxin-shadow' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports)).toBeTruthy()
    expect(editor.textContent).toContain(question)
    expect(clickCount).toBeGreaterThan(0)
    expect(completed.payload.evidence.rawAnswer).toContain('开放 Shadow DOM')
    const writeStage = reports.find((item) => item.type === 'geo-browser-agent/task-stage' && item.payload?.taskId === 'task-wenxin-shadow' && item.payload?.stage === 'query-written')
    expect(writeStage, JSON.stringify(reports)).toBeTruthy()
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
    window.close()
  }, 12_000)

  it('submits GLM through the current textarea composer and icon-only enter container', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><textarea class="scroll-display-none"></textarea><div class="enter is-main-chat"><div class="enter-icon-container"><img class="enter_icon" /></div></div></section></main></body></html>', { url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: function () {
        if (this.matches('textarea.scroll-display-none')) return { width: 440, height: 44, top: 620, right: 620, bottom: 664, left: 180 }
        if (this.matches('.enter.is-main-chat, .enter-icon-container, .enter_icon')) return { width: 40, height: 40, top: 622, right: 672, bottom: 662, left: 632 }
        return { width: 120, height: 32, top: 40, right: 160, bottom: 72, left: 40 }
      },
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 2, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 480 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    const input = window.document.querySelector('textarea.scroll-display-none')
    window.document.querySelector('.enter.is-main-chat').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.textContent = input.value
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.className = 'assistant-message'
      answer.innerHTML = '<div class="markdown">这是 GLM 无 placeholder textarea 和图标发送容器的本轮完整回答，必须在点击实际发送控件后才允许回传。</div>'
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-glm-real-composer', platform: '智谱清言（GLM）', question: 'GLM 当前页面图标发送测试 Query' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-real-composer' && ['completed', 'needs-human'].includes(item.payload?.status)), 2_000)
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-real-composer' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports)).toBeTruthy()
    expect(completed.payload.evidence.rawAnswer).toContain('无 placeholder textarea')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('does not finalize or dispatch past a GLM answer while the page is still searching', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><div class="input-editor" contenteditable="true" data-placeholder="输入问题"></div><button type="button" aria-label="发送">发送</button></section></main></body></html>', { url: 'https://chatglm.cn/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 360, height: 40, top: 620, right: 680, bottom: 660, left: 320 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 3, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 520 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    const input = window.document.querySelector('[contenteditable="true"]')
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${input.textContent}</div>`
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = '<div class="glm-status">搜索中…</div><div class="markdown-body">这是 GLM 尚未完成的首段回答，不能被系统当成完整证据，也不能在它还在搜索时派发下一条 Query。</div>'
      window.document.querySelector('main').append(user, answer)
      window.setTimeout(() => {
        answer.querySelector('.glm-status').remove()
        answer.querySelector('.markdown-body').textContent = '这是 GLM 搜索完成后的完整回答。它必须在搜索和生成信号消失、文本连续稳定之后才会被采集，从而避免第一条问题被第二条 Query 截断。该回答额外补充企业 GEO 评估、可追溯来源、竞品比较、平台差异、复测安排和审计要求，确保用于完整回答采集的文本足够充分。'
      }, 80)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-glm-searching', platform: '智谱清言（GLM）', question: 'GLM 搜索完成态测试 Query' } }, null, () => {})
    await new Promise((resolve) => setTimeout(resolve, 45))
    expect(reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status))).toBe(false)
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)), 2_000)
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports)).toBeTruthy()
    expect(completed.payload.evidence.rawAnswer).toContain('搜索完成后的完整回答')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('uses the scoped Enter fallback when Kimi exposes no semantic send button', async () => {
    const dom = new JSDOM(`<!doctype html><html><body><main><section class="composer"><div class="input-editor" contenteditable="true" data-placeholder="输入 / 唤起插件和技能"></div><div class="arrow-shell"><svg aria-hidden="true"></svg></div></section></main></body></html>`, { url: 'https://www.kimi.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 320, height: 40, top: 640, right: 640, bottom: 680, left: 320 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 420 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    const input = window.document.querySelector('[contenteditable="true"]')
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${input.textContent}</div>`
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = '<div class="markdown-body">这是 Kimi 通过输入框 Enter 提交后生成的新回答，验证没有语义化发送按钮时仍可以在当前可见编辑器中完成本轮 Query 的安全采集和回传。</div>'
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-kimi-enter', platform: 'Kimi', question: 'Kimi 无按钮提交测试 Query' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports)).toBeTruthy()
    expect(completed.payload.evidence.rawAnswer).toContain('Kimi 通过输入框 Enter')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('captures only the newly rendered assistant answer and preserves title-only search sources', async () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <main>
        <nav aria-label="豆包侧边栏"><button type="button">定时任务</button><button type="button">插件 · 技能 · 伙伴</button><button type="button">云盘</button></nav>
        <article data-message-role="user"><div class="markdown-body">旧问题</div></article>
        <article data-message-role="assistant"><div class="markdown-body">这是上一轮的助手回答，不能被写入下一条基线证据。内容足够长，以确认旧回答会被快照排除。</div></article>
        <section class="composer"><textarea aria-label="提问"></textarea><button type="button" title="发送">发送</button></section>
      </main>
    </body></html>`, { url: 'https://www.doubao.com/chat/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null

    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 220, height: 32, top: 10, right: 220, bottom: 42, left: 0 }),
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 300 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: {
      runtime: {
        sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) },
        onMessage: { addListener: (value) => { listener = value } },
      },
    } })
    const button = window.document.querySelector('[title="发送"]')
    button.addEventListener('click', () => {
      const question = window.document.querySelector('textarea').value
      const user = window.document.createElement('article')
      user.className = 'conversation-bubble'
      user.innerHTML = `<div class="markdown-body">${question}<br>今天 16:33</div>`
      const sources = window.document.createElement('section')
      sources.className = 'source-block'
      sources.innerHTML = '搜索 4 个关键词，参考 2 篇资料 <span>“适合小团队的云端知识管理系统推荐”</span><span>“国内团队 Wiki 云端 Markdown 免费版对比”</span><span>“团队知识库工具推荐 Markdown”</span><span>“飞书知识库和语雀对比评测”</span><a href="https://source.example/one">可打开来源</a><button type="button" class="source-title">页面仅显示标题的来源</button>'
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = '<div class="markdown-body">这是本轮新生成的助手回答，包含足够长的正文，用于验证 Browser Agent 不会错误写入用户问题或上一轮回答。它应该是唯一回传的原始回答。为了达到当前 Query 绑定的最低完整度阈值，这里补充更多可见正文：系统需要比较知识库工具的 PDF 导入、Markdown 编辑、全文检索、权限治理、团队协作和来源追溯能力，并明确区分免费方案与企业付费方案。</div>'
      window.document.querySelector('main').append(user, sources, answer)
    })

    window.eval(adapterSource)
    expect(listener).not.toBeNull()
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-current', platform: '豆包', question: '有哪些免费的 AI 知识库工具可以高效存储 PDF 文档并进行 Markdown 编辑？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))

    expect(reports).toContainEqual(expect.objectContaining({ type: 'geo-browser-agent/report', payload: expect.objectContaining({ status: 'completed' }) }))
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    const evidence = completed.payload?.evidence
    expect(evidence.rawAnswer).toContain('本轮新生成的助手回答')
    expect(evidence.rawAnswer).not.toContain('上一轮的助手回答')
    expect(evidence.rawAnswer).not.toContain('今天 16:33')
    expect(evidence.captureMetadata.platformSearchDeclaredCount).toBe(2)
    expect(evidence.captureMetadata.platformSearchDeclaredKeywordCount).toBe(4)
    expect(evidence.captureMetadata.platformSearchKeywords).toEqual([
      '适合小团队的云端知识管理系统推荐',
      '国内团队 Wiki 云端 Markdown 免费版对比',
      '团队知识库工具推荐 Markdown',
      '飞书知识库和语雀对比评测',
    ])
    expect(evidence.captureMetadata.visibleLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: '可打开来源', url: 'https://source.example/one', sourceType: 'platform-search-result', urlAvailable: true }),
      expect.objectContaining({ title: '页面仅显示标题的来源', url: '', sourceType: 'platform-search-result', urlAvailable: false }),
    ]))
    expect(evidence.captureMetadata.visibleLinks.map((item) => item.title)).not.toEqual(expect.arrayContaining(['定时任务', '云盘']))
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('keeps Doubao visible search keywords and reference links as platform sources', async () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <main><section class="composer"><textarea aria-label="提问"></textarea><button type="button" title="发送">发送</button></section></main>
    </body></html>`, { url: 'https://www.doubao.com/chat/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 220, height: 32, top: 10, right: 220, bottom: 42, left: 0 }),
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 300 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: {
      runtime: {
        sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) },
        onMessage: { addListener: (value) => { listener = value } },
      },
    } })
    window.document.querySelector('[title="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${window.document.querySelector('textarea').value}</div>`
      window.document.querySelector('main').append(user)
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = '<div class="markdown-body"><div class="search-evidence"><span>搜索 3 个关键词，参考 15 篇资料</span><p>“免费AI知识库工具 支持PDF存储 Markdown编辑” “免费本地/在线知识库 导入PDF 可编辑markdown AI问答” “免费AI知识库 PDF导入 Markdown编辑工具推荐”</p><div><a href="https://ima.qq.com/download/">ima 知识库</a><a href="https://shypd.ai/tools/flymd">FlyMD</a><a href="https://www.noteznerd.com/zh">NotezNerd</a></div></div><p>这是当前 Query 的完整回答正文，涵盖产品能力、适用场景、部署方式、检索、协作与来源可追溯限制。该正文用于确认搜索证据与普通正文分开保存，并且不会把平台来源误算为回答内引用。</p></div>'
      window.document.querySelector('main').append(answer)
    })

    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-inline-platform-sources', platform: '豆包', question: '有哪些支持知识图谱、来源可追溯的 AI 知识库工具？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))

    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    const metadata = completed.payload.evidence.captureMetadata
    expect(metadata.platformSearchDeclaredCount).toBe(15)
    expect(metadata.platformSearchDeclaredKeywordCount).toBe(3)
    expect(metadata.platformSearchKeywords).toEqual([
      '免费AI知识库工具 支持PDF存储 Markdown编辑',
      '免费本地/在线知识库 导入PDF 可编辑markdown AI问答',
      '免费AI知识库 PDF导入 Markdown编辑工具推荐',
    ])
    expect(metadata.platformSearchSourceCount).toBe(3)
    expect(metadata.platformSearchSourceUrlCount).toBe(3)
    expect(metadata.answerCitationCount).toBe(0)
    expect(metadata.visibleLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://ima.qq.com/download/', sourceType: 'platform-search-result' }),
      expect.objectContaining({ url: 'https://shypd.ai/tools/flymd', sourceType: 'platform-search-result' }),
      expect.objectContaining({ url: 'https://www.noteznerd.com/zh', sourceType: 'platform-search-result' }),
    ]))
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('safely expands an in-page source control and captures links from the revealed panel', async () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <main><section class="composer"><textarea aria-label="提问"></textarea><button type="button" title="发送">发送</button></section></main>
    </body></html>`, { url: 'https://www.doubao.com/chat/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 220, height: 32, top: 10, right: 220, bottom: 42, left: 0 }),
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 300 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: {
      runtime: {
        sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) },
        onMessage: { addListener: (value) => { listener = value } },
      },
    } })
    window.document.querySelector('button').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${window.document.querySelector('textarea').value}</div>`
      window.document.querySelector('main').append(user)
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = '<button type="button" class="source-expander">参考 2 篇资料</button><div class="markdown-body">搜索 2 个关键词，参考 2 篇资料。这里是当前 Query 新生成的完整回答，用来确认系统仅点击站内“参考资料”展开控件，而不会点击任意外部来源链接。回答还包含产品选择、部署成本、权限、协作、Markdown 与检索能力等信息，确保满足当前回答的完整度阈值。</div>'
      answer.querySelector('.source-expander').addEventListener('click', () => {
        const panel = window.document.createElement('section')
        panel.setAttribute('role', 'dialog')
        panel.className = 'source-popover'
        panel.innerHTML = '<a href="https://source.example/revealed">展开后可打开的来源</a>'
        window.document.body.append(panel)
      })
      window.document.querySelector('main').append(answer)
    })

    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-expand', platform: '豆包', question: '适合中小团队的云端知识管理系统推荐，要求支持 Markdown 格式？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))

    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed.payload.evidence.captureMetadata.platformSearchExpansionAttempted).toBe(true)
    expect(completed.payload.evidence.captureMetadata.platformSearchExpansionSucceeded).toBe(true)
    expect(completed.payload.evidence.captureMetadata.visibleLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: '展开后可打开的来源', url: 'https://source.example/revealed', sourceType: 'platform-search-result', urlAvailable: true }),
    ]))
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('binds an expanded source panel to the current Query instead of reusing the first answer evidence', async () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <main>
        <article data-message-role="assistant" id="first-answer">
          <div class="source-row">搜索 4 个关键词，参考 22 篇资料</div>
          <div class="markdown-body">第一条回答已经完成，并且页面上已经展开了它自己的资料面板。它不能成为下一条 Query 的关键词或来源。</div>
        </article>
        <section class="composer"><textarea aria-label="提问"></textarea><button type="button" title="发送">发送</button></section>
      </main>
      <section role="dialog" class="source-popover previous-source-panel">搜索 4 个关键词，参考 22 篇资料 “第一条关键词 A” “第一条关键词 B” <a href="https://source.example/first-a">第一条来源 A</a><a href="https://source.example/first-b">第一条来源 B</a></section>
    </body></html>`, { url: 'https://www.doubao.com/chat/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 220, height: 32, top: 10, right: 220, bottom: 42, left: 0 }),
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 300 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: {
      runtime: {
        sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) },
        onMessage: { addListener: (value) => { listener = value } },
      },
    } })
    window.document.querySelector('[title="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${window.document.querySelector('textarea').value}</div>`
      window.document.querySelector('main').append(user)
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = '<div class="source-expander">搜索 3 个关键词，参考 18 篇资料 &gt;</div><div class="markdown-body">这是第二条 Query 的完整新回答，正文讨论企业知识库、知识图谱、可追溯来源和团队协作等能力。该回答用于验证资料面板必须从当前回答的折叠入口展开，而不能复用之前回答已打开的资料。</div>'
      answer.querySelector('.source-expander').addEventListener('click', () => {
        const panel = window.document.querySelector('.previous-source-panel')
        panel.innerHTML = '搜索 3 个关键词，参考 18 篇资料 “第二条关键词 A” “第二条关键词 B” “第二条关键词 C” <a href="https://source.example/second-a">第二条来源 A</a><a href="https://source.example/second-b">第二条来源 B</a>'
      })
      window.document.querySelector('main').append(answer)
    })

    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-current-panel-only', platform: '豆包', question: '有哪些支持知识图谱、来源可追溯的 AI 知识库工具？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))

    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    const metadata = completed.payload.evidence.captureMetadata
    expect(metadata.platformSearchExpansionAttempted).toBe(true)
    expect(metadata.platformSearchExpansionSucceeded).toBe(true)
    expect(metadata.platformSearchPanelBeforeCount).toBeGreaterThanOrEqual(1)
    expect(metadata.platformSearchChangedPanelCount).toBe(1)
    expect(metadata.platformSearchKeywords).toEqual(['第二条关键词 A', '第二条关键词 B', '第二条关键词 C'])
    expect(metadata.visibleLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://source.example/second-a', sourceType: 'platform-search-result' }),
      expect.objectContaining({ url: 'https://source.example/second-b', sourceType: 'platform-search-result' }),
    ]))
    expect(metadata.visibleLinks).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://source.example/first-a' }),
      expect.objectContaining({ url: 'https://source.example/first-b' }),
    ]))
    expect(metadata.platformSearchKeywords).not.toEqual(expect.arrayContaining(['第一条关键词 A', '第一条关键词 B']))
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)
  it('does not mislabel unrelated page controls as platform search sources', async () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <main><nav><button type="button">定时任务</button><button type="button">云盘</button><button type="button">更多</button></nav><section class="composer"><textarea aria-label="提问"></textarea><button type="button" title="发送">发送</button></section></main>
    </body></html>`, { url: 'https://www.doubao.com/chat/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 220, height: 32, top: 10, right: 220, bottom: 42, left: 0 }),
    })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 300 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: {
      runtime: {
        sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) },
        onMessage: { addListener: (value) => { listener = value } },
      },
    } })
    window.document.querySelector('[title="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${window.document.querySelector('textarea').value}</div>`
      window.document.querySelector('main').append(user)
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = '<div class="markdown-body">搜索 4 个关键词，参考 23 篇资料。这里是当前 Query 的完整新回答，讨论云端知识管理工具的 Markdown 支持、团队协作、权限、版本控制、全文检索、价格和部署方式，满足自动采集的完整回答阈值。</div>'
      window.document.querySelector('main').append(answer)
    })

    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-no-false-source', platform: '豆包', question: '有没有支持 Markdown 的团队知识库工具？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))

    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed.payload.evidence.captureMetadata.platformSearchDeclaredCount).toBe(23)
    expect(completed.payload.evidence.captureMetadata.visibleLinks).toEqual([])
    expect(completed.payload.evidence.captureMetadata.platformSearchExpansionAttempted).toBe(false)
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)


  it('captures keyword chips and an internal redirect target from the newly expanded source drawer', async () => {
    const dom = new JSDOM(`<!doctype html><html><body><main><section class="composer"><textarea aria-label="提问"></textarea><button type="button" title="发送">发送</button></section></main></body></html>`, { url: 'https://www.doubao.com/chat/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 220, height: 32, top: 10, right: 220, bottom: 42, left: 0 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 400 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[title="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.innerHTML = `<div class="markdown-body">${window.document.querySelector('textarea').value}</div>`
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.innerHTML = '<button type="button" class="source-control">搜索 3 个关键词，参考 2 篇资料</button><div class="markdown-body">这是当前 Query 的新回答，内容足够长，用于验证系统可以在本轮回答对应的来源抽屉中抓取关键词芯片和真实网页链接，不会复用上一条任务的来源或页面全局内容。这里继续补充关于 PDF 处理、Markdown 编辑、团队权限、版本管理、混合检索、引用溯源、部署方案和成本评估的具体说明，确保答案超过完整采集的最低长度阈值。</div>'
      answer.querySelector('.source-control').addEventListener('click', () => {
        const drawer = window.document.createElement('section')
        drawer.className = 'reference-drawer'
        drawer.setAttribute('data-state', 'open')
        drawer.innerHTML = '<div class="keyword-list"><span class="keyword">免费 AI 知识库</span><span class="keyword">Markdown 知识管理</span><span class="keyword">团队协作工具</span></div><a href="/redirect?url=https%3A%2F%2Fsource.example%2Fredirected">来源一</a><a href="https://source.example/direct">来源二</a>'
        window.document.body.append(drawer)
      })
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-keyword-drawer', platform: '豆包', question: '有哪些免费的 AI 知识库工具可以高效存储 PDF 文档并进行 Markdown 编辑？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports, null, 2)).toBeDefined()
    const metadata = completed.payload.evidence.captureMetadata
    expect(metadata.platformSearchKeywords).toEqual(['免费 AI 知识库', 'Markdown 知识管理', '团队协作工具'])
    expect(metadata.visibleLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://source.example/redirected', sourceType: 'platform-search-result' }),
      expect.objectContaining({ url: 'https://source.example/direct', sourceType: 'platform-search-result' }),
    ]))
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)


  it('captures DeepSeek complete assistant text and only the current web-source drawer', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><textarea placeholder="给 DeepSeek 发送消息"></textarea><button type="button" aria-label="发送">发送</button></section></main></body></html>', { url: 'https://chat.deepseek.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 340, height: 40, top: 620, right: 680, bottom: 660, left: 340 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 500 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.textContent = window.document.querySelector('textarea').value
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.className = 'ds-message assistant-message'
      answer.innerHTML = '<div class="ds-markdown"><h3>完整回答开头：适合 B2B 团队的工具需要可追溯来源与知识图谱上下文。</h3><p>中间说明：评估时要检查资料治理、检索质量、协作权限、可验证引用、数据边界和部署策略。</p><ul><li>第一项：来源可追溯。</li><li>第二项：知识图谱关系。</li></ul><p>完整回答结尾：这一段必须和前文一起回传，不能只采集最后一个 markdown 子节点。</p></div><button type="button" class="web-sources">搜索 4 个关键词，12 个网页</button>'
      answer.querySelector('.web-sources').addEventListener('click', () => {
        const drawer = window.document.createElement('aside')
        drawer.setAttribute('role', 'dialog')
        drawer.className = 'search-result-drawer'
        drawer.innerHTML = '<div class="keyword">AI 知识库</div><div class="keyword">知识图谱</div><div class="keyword">来源可追溯</div><div class="keyword">B2B 团队</div><a href="https://deepseek-source.example/one">资料一</a><a href="https://deepseek-source.example/two">资料二</a>'
        window.document.body.append(drawer)
      })
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-deepseek-complete', platform: 'DeepSeek', question: '有哪些支持知识图谱、来源可追溯的 AI 知识库工具？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports, null, 2)).toBeDefined()
    expect(completed.payload.evidence.rawAnswer).toContain('完整回答开头')
    expect(completed.payload.evidence.rawAnswer).toContain('完整回答结尾')
    const metadata = completed.payload.evidence.captureMetadata
    expect(metadata.platformSearchDeclaredCount).toBe(12)
    expect(metadata.platformSearchKeywords).toEqual(['AI 知识库', '知识图谱', '来源可追溯', 'B2B 团队'])
    expect(metadata.visibleLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://deepseek-source.example/one', sourceType: 'platform-search-result' }),
      expect.objectContaining({ url: 'https://deepseek-source.example/two', sourceType: 'platform-search-result' }),
    ]))
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('captures a task-bound Yuanbao answer and its visible source URLs without treating welcome cards as evidence', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="welcome quick-suggestion"><p>欢迎使用元宝</p><button>推荐问题</button></section><section class="composer"><textarea placeholder="问问元宝"></textarea><button type="button" aria-label="发送">发送</button></section></main></body></html>', { url: 'https://yuanbao.tencent.com/chat/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 340, height: 40, top: 620, right: 680, bottom: 660, left: 340 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 500 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.textContent = window.document.querySelector('textarea').value
      const answer = window.document.createElement('section')
      answer.className = 'agent-message conversation-item'
      answer.innerHTML = '<button type="button" class="source-expander">搜索 2 个关键词，参考 2 篇资料</button><div class="markdown-body">元宝当前 Query 的完整回答：企业知识库需要清楚的数据边界、团队权限、可追溯引用和评估记录。此段内容属于这一次提交后的回答，不应被欢迎页的快捷推荐卡替代。</div>'
      answer.querySelector('.source-expander').addEventListener('click', () => {
        const drawer = window.document.createElement('aside')
        drawer.setAttribute('role', 'dialog')
        drawer.setAttribute('aria-label', '参考资料')
        drawer.className = 'reference-drawer'
        drawer.innerHTML = '<span class="keyword">AI 知识库</span><span class="keyword">来源可追溯</span><button class="source-card" data-source-url="https://yuanbao-source.example/one">资料一</button><div class="source-card" data-original-url="https://yuanbao-source.example/two">资料二</div>'
        window.document.body.append(drawer)
      })
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-yuanbao-complete', platform: '元宝', question: '有哪些支持来源可追溯的企业知识库工具？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports, null, 2)).toBeDefined()
    expect(completed.payload.evidence.rawAnswer).toContain('元宝当前 Query 的完整回答')
    expect(completed.payload.evidence.rawAnswer).not.toContain('欢迎使用元宝')
    expect(completed.payload.evidence.captureMetadata.platformSearchKeywords).toEqual(['AI 知识库', '来源可追溯'])
    expect(completed.payload.evidence.captureMetadata.visibleLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://yuanbao-source.example/one', sourceType: 'platform-search-result' }),
      expect.objectContaining({ url: 'https://yuanbao-source.example/two', sourceType: 'platform-search-result' }),
    ]))
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('does not submit Yuanbao shortcut chrome as an answer when no assistant root exists', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><textarea placeholder="问问元宝"></textarea><button type="button" aria-label="发送">发送</button></section></main></body></html>', { url: 'https://yuanbao.tencent.com/chat/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 340, height: 40, top: 620, right: 680, bottom: 660, left: 340 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 140 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      const quick = window.document.createElement('div')
      quick.className = 'quick-suggestion menu-item markdown'
      quick.textContent = '团队情况 直接选 继续提问'
      window.document.querySelector('main').append(quick)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-yuanbao-chrome', platform: '元宝', question: '适合团队协作的 AI 知识库有哪些？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)), 3_000)
    const finalReport = reports.find((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status))
    expect(finalReport.payload.status).toBe('needs-human')
    expect(finalReport.payload.evidence?.rawAnswer).toBeUndefined()
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)


  it('captures visible Qwen answer tables as Markdown evidence', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><textarea placeholder="向千问提问"></textarea><button type="button" aria-label="发送">发送</button></section></main></body></html>', { url: 'https://www.qianwen.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 340, height: 42, top: 620, right: 680, bottom: 662, left: 340 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 360 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      const question = window.document.querySelector('textarea').value
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.className = 'message-item user-message'
      user.textContent = question
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.className = 'message-item assistant-message'
      answer.innerHTML = '<div class="markdown">这是当前 Qwen 回答，下面的对比表必须作为结构化证据回传。它还说明了企业 GEO 评估需要保留来源、可见回答、平台上下文、对比结论和复测状态，不能遗漏页面中渲染的结构化信息。<table><thead><tr><th>工具</th><th>来源可追溯</th></tr></thead><tbody><tr><td>工具 A</td><td>支持</td></tr></tbody></table></div>'
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-qwen-table', platform: '通义千问', question: 'Qwen 表格采集测试 Query' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && ['completed', 'needs-human'].includes(item.payload?.status)))
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports, null, 2)).toBeTruthy()
    expect(completed.payload.evidence.rawAnswer).toContain('### 页面可见表格')
    expect(completed.payload.evidence.rawAnswer).toContain('| 工具 | 来源可追溯 |')
    expect(completed.payload.evidence.rawAnswer).toContain('| 工具 A | 支持 |')
    expect(completed.payload.evidence.captureMetadata).toMatchObject({ answerTableCount: 1, answerTableMarkdownCount: 1 })
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('captures a task-bound Qwen answer card without assistant metadata', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><textarea placeholder="向千问提问"></textarea><button type="button" aria-label="发送">发送</button></section></main></body></html>', { url: 'https://www.qianwen.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 340, height: 42, top: 620, right: 680, bottom: 662, left: 340 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 360 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.className = 'turn-user-a91'
      user.textContent = window.document.querySelector('textarea').value
      const answer = window.document.createElement('section')
      answer.className = 'turn-k8f3'
      answer.innerHTML = '<div class="rich-markdown">本轮 Qwen 专属回答：企业在选择知识库工具时，应先核验来源可追溯、权限边界、检索质量和团队协作流程。以下表格是页面当前轮可见的结构化比较，不应被页面外壳或独立资料面板污染。<table><thead><tr><th>评估项</th><th>结论</th></tr></thead><tbody><tr><td>来源引用</td><td>需要保留</td></tr></tbody></table></div>'
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-qwen-unlabelled-current-turn', platform: '通义千问', question: 'Qwen 无角色标记当前轮回答测试' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-qwen-unlabelled-current-turn' && ['completed', 'needs-human'].includes(item.payload?.status)), 2_000)
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-qwen-unlabelled-current-turn' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports, null, 2)).toBeTruthy()
    expect(completed.payload.evidence.rawAnswer).toContain('本轮 Qwen 专属回答')
    expect(completed.payload.evidence.rawAnswer).toContain('### 页面可见表格')
    expect(completed.payload.evidence.rawAnswer).toContain('| 评估项 | 结论 |')
    expect(completed.payload.evidence.rawAnswer).not.toContain('欢迎使用')
    expect(completed.payload.evidence.rawAnswer).not.toContain('快捷提问')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('returns a later Qwen answer when the client reuses an assistant DOM shell', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><textarea placeholder="向千问提问"></textarea><button type="button" aria-label="发送">发送</button></section><article data-message-role="assistant" class="message-item assistant-message"><div class="markdown">第一题专属答案：这段历史内容不能被第二题复用，它包含用于识别历史回答的额外说明和不可混淆的结论。</div></article></main></body></html>', { url: 'https://www.qianwen.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    let submission = 0
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 340, height: 42, top: 620, right: 680, bottom: 662, left: 340 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 460 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      submission += 1
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.className = 'message-item user-message'
      user.textContent = window.document.querySelector('textarea').value
      window.document.querySelector('main').append(user)
      const answer = window.document.querySelector('[data-message-role="assistant"]')
      answer.querySelector('.markdown').textContent = submission === 1
        ? '第一题运行后更新的完整回答：第一题专属答案保留在当前轮结果中，包含充足的 GEO 解释与证据采集说明。'
        : '第二题专属答案：这是 DOM 复用后新写入的回答，必须只回传这一轮内容，不能带入上一轮内容。该结果包含可追溯性、对比维度和复测建议。'
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-qwen-reused-1', platform: '通义千问', question: '第一题 Qwen DOM 复用测试' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.status === 'completed'))
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-qwen-reused-2', platform: '通义千问', question: '第二题 Qwen DOM 复用测试' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-qwen-reused-2' && ['completed', 'needs-human'].includes(item.payload?.status)), 2_000)
    const second = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-qwen-reused-2' && item.payload?.status === 'completed')
    expect(second, JSON.stringify(reports, null, 2)).toBeTruthy()
    expect(second.payload.evidence.rawAnswer).toContain('第二题专属答案')
    expect(second.payload.evidence.rawAnswer).not.toContain('第一题专属答案')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('retries a terminal GLM report after a transient extension relay failure', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><div class="input-editor" contenteditable="true" data-placeholder="输入问题"></div><button type="button" aria-label="发送">发送</button></section></main></body></html>', { url: 'https://chatglm.cn/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    let completedAttempts = 0
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 340, height: 42, top: 620, right: 680, bottom: 662, left: 340 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 420 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => {
      reports.push(message)
      if (message.type === 'geo-browser-agent/report' && message.payload?.status === 'completed' && completedAttempts++ === 0) return Promise.reject(new Error('temporary service worker wakeup'))
      return Promise.resolve({ ok: true })
    }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.textContent = window.document.querySelector('[contenteditable="true"]').textContent
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.className = 'chat-message assistant-message'
      answer.innerHTML = '<div class="markdown">GLM 当前 Query 的完整回答，已经不再处于搜索或生成状态。回答覆盖来源审计、问题分组、竞品对比、内容策略和复测要求，足以作为稳定回传的可审计基线证据。</div>'
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-glm-relay-retry', platform: '智谱清言（GLM）', question: 'GLM 终态回传重试测试 Query' } }, null, () => {})
    await waitFor(() => reports.filter((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-relay-retry' && item.payload?.status === 'completed').length >= 2, 3_000)
    expect(reports.filter((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-relay-retry' && item.payload?.status === 'completed')).toHaveLength(2)
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)


  it('fails closed when Qwen only exposes page chrome and a source drawer, never saving the welcome page as an answer', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><textarea placeholder="向千问提问"></textarea><button aria-label="发送">发送</button></section></main></body></html>', { url: 'https://www.qianwen.com/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 320, height: 40, top: 640, right: 640, bottom: 680, left: 320 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 90 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.textContent = window.document.querySelector('textarea').value
      const drawer = window.document.createElement('section')
      drawer.setAttribute('data-testid', 'assistant-source-drawer')
      drawer.className = 'source-drawer search-result'
      drawer.innerHTML = '<h2>你好，我是千问</h2><p>搜索 3 个关键词，参考 12 篇资料</p><a href="https://source.example/one">资料一</a>'
      window.document.querySelector('main').append(user, drawer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-qwen-chrome-only', platform: '通义千问', question: 'Qwen 页面外壳不得作为回答' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-qwen-chrome-only' && ['completed', 'needs-human'].includes(item.payload?.status)), 2_000)
    expect(reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-qwen-chrome-only' && item.payload?.status === 'completed')).toBe(false)
    const terminal = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-qwen-chrome-only' && item.payload?.status === 'needs-human')
    expect(terminal).toBeTruthy()
    expect(JSON.stringify(terminal)).not.toContain('你好，我是千问')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('treats GLM source counts in a completed answer as evidence rather than an active generation state', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section class="composer"><div class="input-editor" contenteditable="true" data-placeholder="输入问题"></div><button aria-label="发送">发送</button></section></main></body></html>', { url: 'https://chatglm.cn/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 320, height: 40, top: 640, right: 640, bottom: 680, left: 320 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 200 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('[aria-label="发送"]').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.textContent = window.document.querySelector('[contenteditable]').textContent
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.className = 'assistant-message'
      answer.innerHTML = '<div class="markdown">已完成分析，共参考 12 篇资料。搜索 3 个关键词，参考 12 篇资料。以下为本题的完整 GLM 回答，包含可审计的对比维度、来源判断和内容策略建议，回答已经结束。</div>'
      window.document.querySelector('main').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-glm-source-count-complete', platform: '智谱清言（GLM）', question: 'GLM 来源资料完成态测试' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-source-count-complete' && ['completed', 'needs-human'].includes(item.payload?.status)), 2_000)
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-source-count-complete' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports)).toBeTruthy()
    expect(completed.payload.evidence.rawAnswer).toContain('已完成分析，共参考 12 篇资料')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)


  it('captures the current GLM assistant turn without footer or policy-link pollution', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section id="transcript"><article data-message-role="user">上一题</article><article data-message-role="assistant" class="assistant-message"><div class="markdown">上一题已有回答，不能复用到当前任务。</div></article></section><footer class="composer footer"><textarea class="scroll-display-none"></textarea><div class="enter is-main-chat"><div class="enter-icon-container"><img class="enter_icon"></div></div><span>和我聊聊天吧</span><span>GLM-Flash 极致</span><span>内容由AI生成，请仔细甄别</span><a href="https://chatglm.cn/agreement">用户协议</a><a href="https://chatglm.cn/privacy">隐私政策</a></footer></main></body></html>', { url: 'https://chatglm.cn/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 320, height: 40, top: 640, right: 640, bottom: 680, left: 320 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 260 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('.enter').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.textContent = window.document.querySelector('textarea').value
      const answer = window.document.createElement('article')
      answer.setAttribute('data-message-role', 'assistant')
      answer.className = 'assistant-message'
      answer.innerHTML = '<div class="markdown">第二题的完整 GLM 回答：中小团队应优先比较 Markdown 协作、权限、可追溯来源与迁移成本。<a href="https://evidence.example/glm-source">真实可见来源</a><table><tr><th>维度</th><th>建议</th></tr><tr><td>格式</td><td>Markdown</td></tr></table></div>'
      window.document.querySelector('#transcript').append(user, answer)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-glm-footer-pollution', platform: '智谱清言（GLM）', question: '适合中小团队的云端知识管理系统推荐，要求支持Markdown格式？' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-footer-pollution' && ['completed', 'needs-human'].includes(item.payload?.status)), 2_500)
    const completed = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-footer-pollution' && item.payload?.status === 'completed')
    expect(completed, JSON.stringify(reports)).toBeTruthy()
    const evidence = completed.payload.evidence
    expect(evidence.rawAnswer).toContain('第二题的完整 GLM 回答')
    expect(evidence.rawAnswer).toContain('| 维度 | 建议 |')
    expect(evidence.rawAnswer).not.toContain('和我聊聊天吧')
    expect(evidence.rawAnswer).not.toContain('GLM-Flash 极致')
    expect(evidence.rawAnswer).not.toContain('内容由AI生成')
    expect(JSON.stringify(evidence.captureMetadata.visibleLinks)).not.toContain('chatglm.cn/agreement')
    expect(JSON.stringify(evidence.captureMetadata.visibleLinks)).not.toContain('chatglm.cn/privacy')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)

  it('fails closed when GLM exposes only the composer and legal footer', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main><section id="transcript"></section><footer class="composer footer"><textarea class="scroll-display-none"></textarea><div class="enter is-main-chat"><div class="enter-icon-container"></div></div><span>和我聊聊天吧</span><span>GLM-Flash 极致</span><a href="https://chatglm.cn/agreement">用户协议</a><a href="https://chatglm.cn/privacy">隐私政策</a></footer></main></body></html>', { url: 'https://chatglm.cn/', runScripts: 'dangerously', pretendToBeVisual: true })
    const { window } = dom
    const reports = []
    let listener = null
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 320, height: 40, top: 640, right: 640, bottom: 680, left: 320 }) })
    const timing = { inputSettleMs: 1, pollDelayMs: 1, stablePollsRequired: 1, sourceRetryMs: 1, maxCaptureWaitMs: 120 }
    window.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ = timing
    Object.defineProperty(window, 'chrome', { configurable: true, value: { runtime: { sendMessage: (message) => { reports.push(message); return Promise.resolve({ ok: true }) }, onMessage: { addListener: (value) => { listener = value } } } } })
    window.document.querySelector('.enter').addEventListener('click', () => {
      const user = window.document.createElement('article')
      user.setAttribute('data-message-role', 'user')
      user.textContent = window.document.querySelector('textarea').value
      window.document.querySelector('#transcript').append(user)
    })
    window.eval(adapterSource)
    listener({ type: 'geo-browser-agent/run', task: { id: 'task-glm-footer-only', platform: '智谱清言（GLM）', question: 'GLM 只有底栏时不得伪造回答' } }, null, () => {})
    await waitFor(() => reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-footer-only' && ['completed', 'needs-human'].includes(item.payload?.status)), 2_000)
    expect(reports.some((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-footer-only' && item.payload?.status === 'completed')).toBe(false)
    const terminal = reports.find((item) => item.type === 'geo-browser-agent/report' && item.payload?.taskId === 'task-glm-footer-only' && item.payload?.status === 'needs-human')
    expect(terminal, JSON.stringify(reports)).toBeTruthy()
    expect(JSON.stringify(terminal)).not.toContain('GLM-Flash 极致')
    expect(JSON.stringify(terminal)).not.toContain('用户协议')
    delete globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__
  }, 12_000)
})





