(() => {
  // The manifest script can already be present when the background worker performs
  // its recovery injection. Keep exactly one executor per tab so a retry never
  // creates two listeners that type or submit the same Query twice.
  if (globalThis.__GEO_BROWSER_AGENT_PAGE_EXECUTOR_V0325__) return
  globalThis.__GEO_BROWSER_AGENT_PAGE_EXECUTOR_V0325__ = true

  const ADAPTERS_BY_HOST = Object.freeze({
    'www.doubao.com': { id: 'doubao-web', version: '0.3.25', platform: '豆包' },
    'yuanbao.tencent.com': { id: 'yuanbao-web', version: '0.3.25', platform: '元宝' },
    'chat.deepseek.com': { id: 'deepseek-web', version: '0.3.25', platform: 'DeepSeek' },
    'wenxin.baidu.com': { id: 'wenxin-web', version: '0.3.25', platform: '文心一言' },
    'yiyan.baidu.com': { id: 'wenxin-web', version: '0.3.25', platform: '文心一言' },
    'ernie.baidu.com': { id: 'wenxin-web', version: '0.3.25', platform: '文心一言' },
    'www.qianwen.com': { id: 'qwen-web', version: '0.3.25', platform: '通义千问' },
    'qianwen.com': { id: 'qwen-web', version: '0.3.25', platform: '通义千问' },
    'tongyi.aliyun.com': { id: 'qwen-web', version: '0.3.25', platform: '通义千问' },
    'chatglm.cn': { id: 'glm-web', version: '0.3.25', platform: '智谱清言（GLM）' },
    'chat.z.ai': { id: 'glm-web', version: '0.3.25', platform: '智谱清言（GLM）' },
    'kimi.com': { id: 'kimi-web', version: '0.3.25', platform: 'Kimi' },
    'www.kimi.com': { id: 'kimi-web', version: '0.3.25', platform: 'Kimi' },
    'kimi.moonshot.cn': { id: 'kimi-web', version: '0.3.25', platform: 'Kimi' },
  })
  const ADAPTER = ADAPTERS_BY_HOST[location.hostname] || null
  const responseSelectors = [
    '[data-testid*="message"] .markdown-body', '[data-testid*="message"] [class*="markdown"]',
    '[class*="assistant"] [class*="markdown"]', '[class*="message"] [class*="markdown"]',
    '[class*="message-content"]', '[class*="messageContent"]', '[class*="answer"]', '[class*="reply"]', '[class*="prose"]', 'main [class*="markdown"]',
  ]
  const genericInputSelectors = [
    'textarea', '[data-slate-editor="true"]', '[contenteditable]:not([contenteditable="false"])',
    '[role="textbox"]',
  ]
  // The generic path is a fallback only. These concrete selectors target the
  // visible composers in the currently supported Kimi / DeepSeek web clients.
  // If a page changes, we stop with a readable needs-human reason instead of
  // typing into an unrelated search, login, or hidden control.
  const ADAPTER_PROFILES = Object.freeze({
    'doubao-web': {
      inputs: ['textarea[placeholder*="问"]', 'textarea', '[contenteditable="true"]'],
      sends: ['button[aria-label*="发送"]', 'button[title*="发送"]', 'button[data-testid*="send"]', '[role="button"][aria-label*="发送"]', 'button[type="submit"]'],
      responses: ['[data-message-role="assistant"] .markdown-body', '[data-message-role="assistant"]'],
      composerHints: ['提问', '问豆包', '输入'],
    },
    'deepseek-web': {
      // Current public composer: textarea placeholder “给 DeepSeek 发送消息”.
      // Keep it ahead of the generic contenteditable fallback to avoid the side-bar search.
      inputs: ['textarea[placeholder="给 DeepSeek 发送消息"]', 'textarea[placeholder*="给 DeepSeek"]', 'textarea[placeholder*="发送消息"]', 'textarea[data-testid*="chat"]', '[data-testid*="chat-input"] [contenteditable="true"]', '[data-testid*="input"] [contenteditable="true"]', '[contenteditable="true"][role="textbox"]'],
      sends: ['button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[title*="发送"]', 'button[data-testid*="send"]', '[role="button"][aria-label*="发送"]', '[role="button"][data-testid*="send"]', 'button[type="submit"]'],
      responses: ['[data-message-role="assistant"]', '[data-role="assistant"]', '[data-testid*="assistant"]', '[class*="assistant"]', '[class*="ds-markdown"]', '[class*="markdown"]'],
      composerHints: ['给 deepseek 发送消息', 'deepseek', '发送消息'],
    },
    'kimi-web': {
      // Kimi's visible composer is Lexical-like and currently says
      // “输入 / 唤起插件和技能”; it is usually a contenteditable div, not a textarea.
      inputs: ['[data-lexical-editor="true"][contenteditable="true"]', '[contenteditable="true"][data-placeholder*="输入"]', '[contenteditable="true"][aria-label*="输入"]', '[data-testid*="chat-input"] [contenteditable="true"]', '[data-testid*="input"] [contenteditable="true"]', '[class*="chat-input"] [contenteditable="true"]', '[class*="input"] [contenteditable="true"]', 'textarea[placeholder*="输入"]'],
      sends: ['button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[title*="发送"]', 'button[data-testid*="send"]', '[role="button"][aria-label*="发送"]', '[role="button"][data-testid*="send"]', '[data-testid*="send"]', '[data-test*="send"]', 'button[type="submit"]'],
      responses: ['[data-message-role="assistant"]', '[data-role="assistant"]', '[data-testid*="assistant"]', '[class*="assistant"]', '[class*="markdown"]', '[class*="message-content"]'],
      composerHints: ['唤起插件', '输入 /', '输入“/”', '输入"/"', '快速 进阶'],
    },
    'yuanbao-web': {
      // 元宝的回答卡在不同版本中会标为 assistant / agent / bot；不能只靠 markdown，首页快捷推荐也会使用相同的文本样式。
      inputs: ['textarea[placeholder*="问问元宝"]', 'textarea[placeholder*="元宝"]', 'textarea[placeholder*="输入"]', '[data-testid*="chat-input"] [contenteditable="true"]', '[data-testid*="input"] [contenteditable="true"]', '[class*="chat-input"] [contenteditable="true"]', '[class*="composer"] [contenteditable="true"]', '[contenteditable="true"][role="textbox"]'],
      sends: ['button[aria-label*="发送"]', 'button[title*="发送"]', 'button[data-testid*="send"]', '[role="button"][aria-label*="发送"]', '[role="button"][data-testid*="send"]', '[class*="send"] button', 'button[type="submit"]'],
      responses: ['[data-message-role="assistant"]', '[data-role="assistant"]', '[data-author-role="assistant"]', '[data-message-type="assistant"]', '[data-message-author="assistant"]', '[data-author="assistant"]', '[data-sender="assistant"]', '[data-testid*="assistant"]', '[data-testid*="message"] [class*="markdown"]', '[data-message-id] [class*="markdown"]', '[data-message-id] [class*="content"]', '[data-message-id] [class*="answer"]', '[class*="assistant"]', '[class*="agent-message"]', '[class*="agent-answer"]', '[class*="model-message"]', '[class*="bot"]', '[class*="answer-content"]', '[class*="answer"]', '[class*="reply"]', '[class*="prose"]', '[class*="message-content"]', '[class*="markdown"]'],
      composerHints: ['问问元宝', '元宝', '输入'],
    },
    'wenxin-web': {
      // 文心的新编辑器可能使用 contenteditable="plaintext-only"，也可能只暴露 role=textbox。
      // 这两种形式均限定在可见且可写的真实页面 composer 内，不会回退到导航搜索框。
      inputs: ['textarea[placeholder*="文心"]', 'textarea[placeholder*="问一问"]', 'textarea[placeholder*="问"]', 'textarea[placeholder*="输入"]', '[data-testid*="chat-input"] [contenteditable]:not([contenteditable="false"])', '[data-testid*="input"] [contenteditable]:not([contenteditable="false"])', '[class*="chat-input"] [contenteditable]:not([contenteditable="false"])', '[class*="composer"] [contenteditable]:not([contenteditable="false"])', '[class*="editor"] [contenteditable]:not([contenteditable="false"])', '[contenteditable="plaintext-only"]', '[contenteditable]:not([contenteditable="false"])[role="textbox"]', '[contenteditable="true"][aria-multiline="true"]', '[role="textbox"]'],
      // 文心当前页面会把蓝色上箭头渲染为无文字的图标容器；保留语义选择器，
      // 同时仅允许在已识别输入框右侧的 submit/send 容器中查找该图标。
      sends: ['button[aria-label*="发送"]', 'button[aria-label*="提问"]', 'button[title*="发送"]', 'button[data-testid*="send"]', 'button[data-testid*="submit"]', '[role="button"][aria-label*="发送"]', '[role="button"][aria-label*="提问"]', '[role="button"][data-testid*="send"]', '[data-testid*="chat-send"]', '[data-testid*="send-button"]', '[class*="send"] button', '[class*="submit"] button', '[class*="send"] [role="button"]', '[class*="submit"] [role="button"]', '[class*="send"]', '[class*="submit"]', 'button[type="submit"]'],
      // 文心目前存在 textarea、plaintext-only 以及 role=textbox 三种 Composer，回答区也会在不同灰度版本使用 chat/message/rich-text 容器。
      // 这些回答选择器仍必须通过本次提问后的 user anchor 与发送前快照绑定，绝不扫描页面欢迎语或导航。
      responses: ['[data-message-role="assistant"]', '[data-role="assistant"]', '[data-author-role="assistant"]', '[data-testid*="assistant"]', '[data-testid*="message"] [class*="markdown"]', '[data-testid*="chat"] [class*="markdown"]', '[data-testid*="chat"] [class*="rich"]', '[data-message-id] [class*="markdown"]', '[class*="assistant"]', '[class*="bot"]', '[class*="model-message"]', '[class*="chat-message"]', '[class*="message-item"]', '[class*="messageItem"]', '[class*="answer-content"]', '[class*="answer"]', '[class*="reply"]', '[class*="prose"]', '[class*="message-content"]', '[class*="markdown"]'],
      composerHints: ['文心', '提问', '输入'],
    },
    'qwen-web': {
      inputs: ['textarea[placeholder*="千问"]', 'textarea[placeholder*="输入"]', 'textarea[placeholder*="提问"]', '[data-testid*="chat-input"] [contenteditable]:not([contenteditable="false"])', '[data-testid*="input"] [contenteditable]:not([contenteditable="false"])', '[class*="chat-input"] [contenteditable]:not([contenteditable="false"])', '[class*="composer"] [contenteditable]:not([contenteditable="false"])', '[class*="editor"] [contenteditable]:not([contenteditable="false"])', '[contenteditable]:not([contenteditable="false"])[role="textbox"]'],
      sends: ['button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[title*="发送"]', 'button[data-testid*="send"]', '[role="button"][aria-label*="发送"]', '[role="button"][data-testid*="send"]', '[class*="send"] button', 'button[type="submit"]'],
      // 千问首页欢迎语、快捷入口、搜索关键词和参考资料也会使用 markdown 容器。
      // 先接受显式 assistant 身份；另外仅探测受限的单轮对话卡片，后续仍以本次
      // 提问锚点、发送前快照和结构安全校验绑定，绝不回退到 main 下的宽泛 markdown。
      responses: ['[data-message-role="assistant"]', '[data-role="assistant"]', '[data-author-role="assistant"]', '[data-message-type="assistant"]', '[data-message-author="assistant"]', '[data-testid*="assistant"]', '[class*="assistant-message"]', '[class*="model-message"]', '[class*="bot-message"]', '[data-testid*="message"]', '[data-testid*="conversation"]', '[data-testid*="message"] [class*="markdown"]', '[data-testid*="conversation"] [class*="markdown"]', '[class*="chat-message"]', '[class*="message-item"]', '[class*="conversation-item"]', '[class*="message-bubble"]', '[class*="answer-turn"]', '[class*="response-turn"]', '[class*="reply-turn"]', '[class*="chat-message"] [class*="markdown"]', '[class*="message-item"] [class*="markdown"]', '[class*="conversation-item"] [class*="markdown"]', '[class*="answer"] [class*="markdown"]', '[class*="response"] [class*="markdown"]', '[class*="reply"] [class*="markdown"]'],
      composerHints: ['通义千问', '千问', '输入', '提问'],
    },
    'glm-web': {
      // GLM 的当前聊天页面使用无 placeholder 的 textarea.scroll-display-none，
      // 右侧发送控件是无语义 div.enter.is-main-chat；两者都必须和当前 composer 绑定。
      inputs: ['textarea.scroll-display-none', 'textarea', 'textarea[placeholder*="输入"]', 'textarea[placeholder*="提问"]', '[data-testid*="chat-input"] [contenteditable="true"]', '[data-testid*="input"] [contenteditable="true"]', '[class*="chat-input"] [contenteditable="true"]', '[contenteditable="true"][role="textbox"]'],
      sends: ['.enter.is-main-chat', '.enter-icon-container', '.enter_icon', 'button[aria-label*="发送"]', 'button[title*="发送"]', 'button[data-testid*="send"]', '[role="button"][aria-label*="发送"]', '[role="button"][data-testid*="send"]', 'button[type="submit"]'],
      responses: ['[data-message-role="assistant"]', '[data-role="assistant"]', '[data-author-role="assistant"]', '[data-testid*="assistant"]', '[data-testid*="message"] [class*="markdown"]', '[data-message-id] [class*="markdown"]', '[data-testid*="conversation"] [class*="markdown"]', '[class*="assistant"]', '[class*="bot"]', '[class*="model-message"]', '[class*="answer-content"]', '[class*="answer"]', '[class*="reply"]', '[class*="chat-item"]', '[class*="chatItem"]', '[class*="conversation-item"]', '[class*="conversationItem"]', '[class*="chat-message"]', '[class*="chatMessage"]', '[class*="message-item"]', '[class*="messageItem"]', '[class*="markdown"]'],
      composerHints: ['智谱', '清言', '输入', '提问'],
    },
  })
  const sourceSelectors = 'a[href], [role="link"], [role="button"], button, [data-url], [data-href], [data-target], [data-redirect-url], [data-link], [data-source-url], [data-source-link], [data-original-url], [data-jump-url], [data-open-url], [data-testid*="source"], [data-testid*="result"], [data-qa*="source"], [data-qa*="result"], [class*="source"], [class*="reference"], [class*="citation"], [class*="result"]'
  // Keep this list explicit: source URLs may sit on a card wrapper, a nested title,
  // or a JSON-valued data attribute. We only read attributes already present in the page.
  const sourceUrlSelectors = 'a[href], [data-url], [data-href], [data-target], [data-redirect-url], [data-link], [data-source-url], [data-source-link], [data-original-url], [data-jump-url], [data-open-url], [data-raw-url], [url], [target-url]'
  const sourceHeaderPattern = /(?:搜索\s*\d+\s*个关键词[\s\S]{0,160}?(?:参考|浏览)\s*\d+\s*(?:篇资料|个网页|个来源|篇网页)|(?:参考|浏览)\s*\d+\s*(?:篇资料|个网页|个来源|篇网页)|(?:查看\s*)?\d+\s*(?:个)?(?:网页|web\s*pages?)|搜索结果|参考资料|相关(?:网页|资料)|联网(?:搜索|资料))/i
  const captchaSelectors = ['iframe[src*="captcha"]', '[class*="captcha"]', '[class*="verify"]', '[id*="captcha"]']
  const blockedActionPattern = /语音|录音|voice|audio|更多|more|上传|upload|图片|image|附件|attach|停止|stop|取消|cancel|清空|clear/i
  const sendActionPattern = /发送|send|submit|发送消息|发送问题/i
  const testTiming = globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ || {}
  const timingValue = (name, fallback, minimum = 1) => Number.isFinite(testTiming[name]) ? Math.max(minimum, Math.floor(testTiming[name])) : fallback
  const INPUT_SETTLE_MS = timingValue('inputSettleMs', 320)
  const POLL_DELAY_MS = timingValue('pollDelayMs', 1_200)
  const STABLE_POLLS_REQUIRED = timingValue('stablePollsRequired', 3)
  const SOURCE_RETRY_MS = timingValue('sourceRetryMs', 500)
  const MAX_CAPTURE_WAIT_MS = timingValue('maxCaptureWaitMs', 140_000)
  // Keep the local Agent's task lease alive while a visible page is genuinely producing
  // this task's answer. This renews a local watchdog only; it never changes the remote
  // task state or claims a different Query.
  const TASK_HEARTBEAT_MS = timingValue('taskHeartbeatMs', 20_000)
  // React/lexical composers are often rendered after document_idle. Do not tell the
  // local relay that this platform is ready until the visible, writable composer exists.
  // Otherwise a task can be claimed and fail before Kimi/DeepSeek/etc. finish hydrating.
  const PAGE_READY_POLL_MS = timingValue('pageReadyPollMs', 650)
  const PAGE_READY_TIMEOUT_MS = timingValue('pageReadyTimeoutMs', 45_000)
  const MAX_EVIDENCE_LINKS = 30
  const EVIDENCE_TEXT_LIMIT = 180
  let runningTaskId = null
  // Release only the current task immediately before its terminal report is relayed.
  // The background may dispatch the next same-platform Query as soon as that report is
  // accepted; retaining the old id until the async call stack unwinds rejects that valid
  // serial hand-off as ‘当前已有任务正在执行’.
  function releaseTask(task) { if (task?.id && runningTaskId === task.id) runningTaskId = null }

  const text = (node) => (node?.innerText || node?.textContent || '').trim()
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').replace(/[？?！!。。，、：“”"'（）()\[\]{}]/g, '').trim().toLowerCase()
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const send = (message) => chrome.runtime.sendMessage(message)
  const selectorValues = (node) => [
    node?.getAttribute?.('aria-label'), node?.getAttribute?.('title'), node?.getAttribute?.('data-testid'),
    node?.getAttribute?.('data-test'), node?.getAttribute?.('name'), node?.id, node?.className?.toString?.(), text(node),
  ].filter(Boolean).join(' ')

  function hasCaptcha() { return captchaSelectors.some((selector) => document.querySelector(selector)) }
  function likelyLogin() {
    const page = document.body?.innerText || ''
    return /登录|立即登录|扫码登录|Sign in|Log in/i.test(page) && !genericInputSelectors.some((selector) => document.querySelector(selector))
  }
  function visible(node) {
    const rect = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0' && style.pointerEvents !== 'none' && node.getAttribute('aria-hidden') !== 'true'
  }
  function disabled(node) { return Boolean(node.disabled) || node.getAttribute('aria-disabled') === 'true' }
  function profile() { return ADAPTER ? ADAPTER_PROFILES[ADAPTER.id] || { inputs: [], sends: [], responses: [], composerHints: [] } : { inputs: [], sends: [], responses: [], composerHints: [] } }

  // Modern chat UIs can mount their composer inside an *open* Shadow DOM. A normal
  // document.querySelectorAll() cannot see that editor even though it is visibly on the
  // customer's page, which made the current 文心 page look ready but prevented typing.
  // Traverse only open roots, retain bounded work, and never inspect page text. Closed
  // roots deliberately remain unsupported and fail closed for manual handling.
  let cachedQueryRoots = []
  let cachedQueryRootsUntil = 0
  function queryRoots({ maxRoots = 96, maxNodesPerRoot = 6_000 } = {}) {
    // A single readiness/run pass evaluates multiple selectors. Reuse the short-lived
    // root map so large SPA pages are not walked once per selector, while allowing a
    // just-hydrated composer to appear on the next bounded retry.
    if (Date.now() < cachedQueryRootsUntil && cachedQueryRoots.every((root) => root === document || root.host?.isConnected)) return cachedQueryRoots
    const roots = [document]
    const seen = new Set(roots)
    for (let rootIndex = 0; rootIndex < roots.length && roots.length < maxRoots; rootIndex += 1) {
      const root = roots[rootIndex]
      const ownerDocument = root.nodeType === 9 ? root : root.ownerDocument
      const nodeFilter = ownerDocument?.defaultView?.NodeFilter || NodeFilter
      const walker = ownerDocument.createTreeWalker(root, nodeFilter.SHOW_ELEMENT)
      let inspected = 0
      let node = walker.nextNode()
      while (node && inspected < maxNodesPerRoot && roots.length < maxRoots) {
        if (node.shadowRoot && node.shadowRoot.mode === 'open' && !seen.has(node.shadowRoot)) {
          seen.add(node.shadowRoot)
          roots.push(node.shadowRoot)
        }
        inspected += 1
        node = walker.nextNode()
      }
    }
    cachedQueryRoots = roots
    cachedQueryRootsUntil = Date.now() + 250
    return roots
  }
  function deepQueryAll(selector) {
    const nodes = []
    const seen = new Set()
    for (const root of queryRoots()) {
      for (const node of root.querySelectorAll(selector)) {
        if (!seen.has(node)) { seen.add(node); nodes.push(node) }
      }
    }
    return nodes
  }
  function writableComposer(node) {
    if (!node || disabled(node) || node.getAttribute('aria-readonly') === 'true') return false
    if (node instanceof HTMLInputElement && String(node.type || '').toLowerCase() === 'hidden') return false
    return node.getAttribute('contenteditable') !== 'false'
  }
  function inputCandidates(selectors) { return selectors.flatMap((selector) => deepQueryAll(selector)).filter(visible).filter(writableComposer) }
  function composerLabel(node) {
    return [node?.getAttribute?.('placeholder'), node?.getAttribute?.('data-placeholder'), node?.getAttribute?.('aria-label'), node?.getAttribute?.('title'), selectorValues(node)].filter(Boolean).join(' ').toLowerCase()
  }
  function composerScore(node, preferred) {
    const rect = node.getBoundingClientRect()
    const label = composerLabel(node)
    const hints = profile().composerHints || []
    let score = Math.max(0, rect.bottom) / 8
    if (preferred.has(node)) score += 1_000
    if (hints.some((hint) => label.includes(String(hint).toLowerCase()))) score += 600
    if (/搜索|search|查找|filter/.test(label)) score -= 2_000
    if (node.closest?.('[role="dialog"]') && /搜索|search/.test(text(node.closest('[role="dialog"]')))) score -= 1_000
    return score
  }
  function getInput() {
    const preferred = new Set(inputCandidates(profile().inputs))
    const candidates = [...preferred, ...inputCandidates(genericInputSelectors)]
    const unique = candidates.filter((node, index) => candidates.indexOf(node) === index)
    // Prefer an adapter-specific visible editor. This avoids side-bar search boxes and
    // hidden templates in Kimi / DeepSeek while retaining a generic safe fallback.
    return unique.filter((node) => !disabled(node)).sort((left, right) => composerScore(right, preferred) - composerScore(left, preferred))[0] || null
  }

  // Keep a compact, privacy-safe DOM signature with every adapter failure. It records
  // only selected-control metadata and counts—not page text, Cookies, credentials,
  // or complete HTML—so a customer can tell why one real-web platform needs an update.
  function composerDiagnostic(input = null, writtenValue = '') {
    const candidates = [...new Set([...inputCandidates(profile().inputs), ...inputCandidates(genericInputSelectors)])]
    const sends = [...new Set(inputCandidates(profile().sends).map(actionCandidateNode).filter(Boolean))]
    const describe = (node) => node ? {
      root: node.getRootNode?.() instanceof ShadowRoot ? 'open-shadow' : 'document',
      tag: node.tagName?.toLowerCase() || 'unknown',
      placeholder: String(node.getAttribute?.('placeholder') || node.getAttribute?.('data-placeholder') || '').slice(0, 80),
      ariaLabel: String(node.getAttribute?.('aria-label') || '').slice(0, 80),
      testId: String(node.getAttribute?.('data-testid') || node.getAttribute?.('data-test') || '').slice(0, 80),
      editable: node.getAttribute?.('contenteditable') || null,
      disabled: disabled(node),
    } : null
    return JSON.stringify({
      adapter: ADAPTER?.id || null,
      urlHost: location.hostname,
      composerCandidates: candidates.length,
      sendCandidates: sends.length,
      selectedComposer: describe(input),
      selectedValueLength: readComposerValue(input).length,
      attemptedValueLength: String(writtenValue || '').length,
    })
  }

  async function announcePageReady() {
    if (!ADAPTER) return
    const startedAt = Date.now()
    let lastFailure = null
    const statusPayload = (status, reason = null) => ({ status, reason, platform: ADAPTER.platform, adapterId: ADAPTER.id, adapterVersion: ADAPTER.version })
    while (Date.now() - startedAt < PAGE_READY_TIMEOUT_MS) {
      if (hasCaptcha()) {
        try { await send({ type: 'geo-browser-agent/agent-status', payload: statusPayload('attention', '检测到验证码或人机校验，已停止自动操作。') }) } catch { /* The page must not retry a CAPTCHA automatically. */ }
        return
      }
      if (likelyLogin()) {
        try { await send({ type: 'geo-browser-agent/agent-status', payload: statusPayload('needs_login', `${ADAPTER.platform} 登录状态不可用，请在受控浏览器窗口完成登录后重试。`) }) } catch { /* The next page load will announce readiness again. */ }
        return
      }
      if (getInput()) {
        try {
          const ready = await send({ type: 'geo-browser-agent/agent-status', payload: statusPayload('online') })
          if (ready?.autoStart?.state === 'running' || runningTaskId) return
          lastFailure = ready?.autoStart?.message || ready?.message || '后台尚未完成任务派发。'
        } catch (error) {
          // MV3 service workers can be suspended exactly as the page is hydrated. A
          // single dropped ready message must not leave an otherwise usable page idle.
          lastFailure = String(error?.message || error || '后台就绪消息发送失败。')
        }
        await sleep(PAGE_READY_POLL_MS)
        continue
      }
      await sleep(PAGE_READY_POLL_MS)
    }
    const suffix = lastFailure ? ` 最近一次派发状态：${lastFailure}` : ''
    try { await send({ type: 'geo-browser-agent/agent-status', payload: statusPayload('attention', `等待「${ADAPTER.platform}」可见提问输入区超过 45 秒；页面可能尚未加载、登录未完成或结构已更新。${suffix}`) }) } catch { /* Browser close or worker restart: no unsafe retry. */ }
  }
  function nativeValueSetter(input) {
    let proto = input
    while ((proto = Object.getPrototypeOf(proto))) {
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      if (setter) return setter
    }
    return null
  }
  function readComposerValue(input) {
    return String(input?.value ?? input?.innerText ?? input?.textContent ?? '')
  }
  function dispatchComposerInput(input, value) {
    try { input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, composed: true, cancelable: true, inputType: 'insertText', data: value })) } catch { input.dispatchEvent(new Event('beforeinput', { bubbles: true, composed: true, cancelable: true })) }
    try { input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: value })) } catch { input.dispatchEvent(new Event('input', { bubbles: true, composed: true })) }
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }
  function replaceContentEditable(input, value) {
    const selection = window.getSelection()
    const clearRange = document.createRange()
    clearRange.selectNodeContents(input)
    clearRange.deleteContents()
    clearRange.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(clearRange)
    // Never call document.execCommand('selectAll'): on some SPA pages it selects the
    // entire document and can clear a visible conversation. The range stays inside the
    // identified composer, then uses the normal insertion path used by Lexical/React.
    let inserted = false
    try { inserted = document.execCommand('insertText', false, value) } catch { inserted = false }
    if (!inserted || !readComposerValue(input).includes(value)) input.textContent = value
    const end = document.createRange()
    end.selectNodeContents(input)
    end.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(end)
  }
  function inputValue(input, value) {
    input.focus({ preventScroll: true })
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const setter = nativeValueSetter(input)
      setter?.call(input, value)
      if (!setter) input.value = value
    } else {
      replaceContentEditable(input, value)
    }
    dispatchComposerInput(input, value)
    // Wenxin's current editor variants may enable the blue icon through React change /
    // composition listeners rather than the native input event alone. Emit those normal
    // editor notifications on the already-identified composer; never target document.body.
    if (ADAPTER?.id === 'wenxin-web') {
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true, data: value }))
    }
    // Trigger any lightweight dirty-state listeners without submitting or changing page focus.
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true, key: ' ', code: 'Space' }))
    return readComposerValue(input)
  }

  function actionCandidateNode(node) {
    if (!(node instanceof Element)) return null
    const semantic = node.closest('button, [role="button"], [data-testid*="send"], [data-testid*="submit"], [data-test*="send"], [class*="send"], [class*="submit"]')
    if (semantic) return semantic
    // Wenxin may render the blue upward arrow as an SVG inside a plain div. Promote only
    // its compact, visible ancestor; nearbyActionButton still constrains it to the active
    // composer’s right edge, so a navigation icon can never become a send control.
    if (ADAPTER?.id === 'wenxin-web' && node.matches('svg, path')) {
      for (let parent = node.parentElement, depth = 0; parent && depth < 4; parent = parent.parentElement, depth += 1) {
        const rect = parent.getBoundingClientRect?.()
        if (visible(parent) && rect?.width >= 16 && rect.width <= 160 && rect.height >= 16 && rect.height <= 120) return parent
      }
    }
    return node
  }

  function nearbyActionButton(input) {
    const inputRect = input.getBoundingClientRect()
    // 文心的蓝色上箭头在部分当前页面构建中是裸 SVG，外层既没有 button
    // 也没有 aria-label。SVG 仅作为文心已识别 composer 的最后一个、右侧可点击
    // 候选参与排序，绝不在页面其他位置盲点。
    const selectors = ['button', '[role="button"]', '[data-testid*="send"]', '[data-testid*="submit"]', '[data-test*="send"]', '[class*="send"]', '[class*="submit"]', ...(profile().sends || []), ...(ADAPTER?.id === 'wenxin-web' ? ['svg'] : [])]
    const seen = new Set()
    const candidates = selectors.flatMap((selector) => deepQueryAll(selector))
      .map(actionCandidateNode)
      .filter((node) => node && !seen.has(node) && seen.add(node))
      .filter((node) => visible(node))
      .map((node) => ({ node, label: selectorValues(node), rect: node.getBoundingClientRect() }))
      .filter(({ label }) => !blockedActionPattern.test(label))
    const preferredNodes = new Set(inputCandidates(profile().sends).map(actionCandidateNode).filter(Boolean))
    const explicit = candidates.find(({ node }) => preferredNodes.has(node)) || candidates.find(({ label }) => sendActionPattern.test(label))
    if (explicit && !disabled(explicit.node)) return explicit.node
    // Current platforms can expose an icon-only submit action without semantic text.
    // Only consider controls immediately at the right edge of the detected composer.
    const rightEdge = candidates
      .filter(({ node, rect }) => !disabled(node)
        && rect.right >= inputRect.right - 180
        && rect.left >= inputRect.left - 12
        && rect.right <= inputRect.right + 220
        && rect.top <= inputRect.bottom + 20
        && rect.bottom >= inputRect.top - 20)
      .sort((a, b) => (b.rect.right - a.rect.right) || (a.rect.top - b.rect.top))
    return rightEdge[0]?.node || null
  }

  async function activateSendButton(button) {
    button.scrollIntoView?.({ block: 'center', inline: 'nearest' })
    button.focus?.({ preventScroll: true })
    try {
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true }))
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true }))
      button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
    } catch { /* Older WebViews may not expose PointerEvent. */ }
    button.click()
  }
  function fallbackSubmitFromComposer(input) {
    // Use the platform's normal keyboard path only after the detected composer holds
    // this Query and an explicit send action is absent or did not submit it. This is
    // intentionally scoped to the composer rather than document.body.
    input.focus?.({ preventScroll: true })
    for (const type of ['keydown', 'keypress', 'keyup']) {
      input.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', which: 13, keyCode: 13 }))
    }
  }
  async function waitForSendButton(input) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const button = nearbyActionButton(input)
      if (button) return button
      await sleep(220)
    }
    return null
  }

  function compareDocumentOrder(left, right) {
    if (left === right) return 0
    return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  }

  function responseContainerSignals(node) {
    return /assistant|agent|bot|answer|reply|model|ai[-_ ]?message|aigc|智能回答|元宝回答|message|chat|bubble|turn|content|markdown/i.test(selectorValues(node))
  }

  function containsSourceControl(node) {
    return /(?:搜索\s*\d+\s*个关键词[\s\S]{0,80}?(?:参考\s*\d+\s*篇资料|\d+\s*个网页)|参考\s*\d+\s*篇资料|(?:查看\s*)?\d+\s*(?:个)?(?:网页|web\s*pages?)|搜索结果|参考资料)/i.test(text(node))
  }

  function hasMultipleAssistantCards(node) {
    const cards = [...node.querySelectorAll?.('[data-message-role="assistant"], [data-role="assistant"], [data-author-role="assistant"], [class*="assistant"], [class*="agent-message"], [class*="bot-message"], [class*="chat-item"], [class*="chatItem"], [class*="conversation-item"], [class*="conversationItem"], [class*="message-item"], [class*="messageItem"]') || []]
      .filter((child) => visible(child) && messageRole(child) === 'assistant')
    return cards.length > 1
  }

  function hasMultipleConversationTurns(node) {
    if (!node?.querySelectorAll) return false
    const turns = [...node.querySelectorAll('article, [data-message-id], [data-message-role], [data-role], [data-author-role], [data-testid*="message"], [data-testid*="conversation"], [class*="message"], [class*="chat-item"], [class*="chatItem"], [class*="conversation-item"], [class*="conversationItem"], [class*="bubble"], [class*="turn"]')]
      .filter((item) => item !== node && visible(item))
      .filter((item) => /assistant|agent|bot|model|user|human|message|bubble|chat-item|conversation-item|turn|对话|回答/i.test(selectorValues(item)))
    return turns.length > 2
  }

  function deepseekAnswerRootFor(node) {
    // DeepSeek can split one assistant turn into several Markdown siblings plus a “N 个网页” trigger.
    // Prefer the largest *single-turn* shell. A narrow Markdown fragment frequently contains only the
    // final paragraph, while a conversation wrapper can contain previous answers and must be rejected.
    let fallback = node
    let best = null
    for (let current = node, depth = 0; current && depth < 12; depth += 1, current = current.parentElement) {
      if (['MAIN', 'BODY', 'HTML'].includes(current.tagName)) break
      if (hasMultipleAssistantCards(current) || hasMultipleConversationTurns(current)) break
      const value = text(current)
      if (value.length < 20) continue
      const signals = selectorValues(current)
      const markdownCount = [...current.querySelectorAll?.('[class*="markdown"], [class*="Markdown"], [class*="prose"]') || []].filter(visible).length
      const turnSignal = /assistant|message|chat|answer|reply|bubble|turn|markdown|content/i.test(signals) || markdownCount > 0 || containsSourceControl(current)
      if (turnSignal) {
        const score = Math.min(value.length, 18_000) + (markdownCount * 900) + (containsSourceControl(current) ? 500 : 0) - depth
        if (!best || score > best.score) best = { node: current, score }
      }
      fallback = current
    }
    return best?.node || fallback || node
  }

  function yuanbaoQuickUi(node) {
    // Only inspect structural metadata: normal answers may mention teams or recommendations.
    const signals = [
      node?.getAttribute?.('aria-label'), node?.getAttribute?.('title'),
      node?.getAttribute?.('data-testid'), node?.getAttribute?.('data-role'),
      node?.getAttribute?.('data-message-role'), node?.className?.toString?.(),
    ].filter(Boolean).join(' ')
    return /suggest|quick|shortcut|recommend|welcome|starter|menu|nav|快捷|推荐|猜你|示例/i.test(signals)
  }

  function yuanbaoAnswerRootFor(node) {
    // Some Yuanbao answers omit assistant metadata. Prefer the broadest visible assistant shell
    // bounded to this turn. Homepage recommendation cards are excluded structurally, never by prose.
    let fallback = null
    let best = null
    for (let current = node, depth = 0; current && depth < 12; depth += 1, current = current.parentElement) {
      if (['MAIN', 'BODY', 'HTML'].includes(current.tagName)) break
      if (yuanbaoQuickUi(current)) continue
      if (hasMultipleAssistantCards(current) || hasMultipleConversationTurns(current)) break
      const value = text(current)
      if (value.length < 40) continue
      const signals = selectorValues(current)
      const assistantShell = messageRole(current) === 'assistant' || /assistant|agent|bot|answer|reply|model|ai[-_ ]?message|aigc|智能回答|元宝回答|conversation-item/i.test(signals)
      const messageShape = current.matches?.('article, li, [data-message-id], [data-message-role], [data-role], [data-author-role], [data-testid*="message"], [class*="message"], [class*="chat"], [class*="bubble"], [class*="conversation"]')
      if (assistantShell || messageShape) {
        const score = Math.min(value.length, 18_000) + (assistantShell ? 4_000 : 0) - depth
        if (!best || score > best.score) best = { node: current, score }
        fallback ||= current
      }
    }
    return best?.node || fallback
  }

  function glmComposerOrFooterUi(node) {
    if (!node) return true
    // ChatGLM's composer and legal footer share the page shell with the transcript. A
    // response selector may find a markdown leaf below that shell, so forbid climbing
    // into a container that owns the active composer or a legal/footer surface.
    if (node.matches?.('textarea, input, [contenteditable]:not([contenteditable="false"]), .enter, .enter-icon-container, .enter_icon, footer, [role="contentinfo"]')) return true
    const activeComposer = getInput()
    if (activeComposer && (node === activeComposer || node.contains?.(activeComposer))) return true
    const signals = [
      node.className?.toString?.(), node.id, node.getAttribute?.('data-testid'), node.getAttribute?.('data-test'),
      node.getAttribute?.('role'), node.getAttribute?.('aria-label'), node.getAttribute?.('title'),
    ].filter(Boolean).join(' ').toLowerCase()
    return /(?:^|[\s_-])(composer|chat-input|input-area|input-wrapper|editor|footer|legal|policy|agreement|privacy|model-selector|model-switcher|enter)(?:$|[\s_-])|底部|用户协议|隐私政策/.test(signals)
  }

  function glmAnswerRootFor(node) {
    // GLM reuses an outer chat shell across turns and keeps the composer/footer inside
    // that shell. Only grow a markdown leaf into an actual assistant/message card; never
    // use an untyped ancestor as a fallback, otherwise the footer becomes "the answer".
    if (!node || glmComposerOrFooterUi(node)) return null
    let fallback = null
    let best = null
    for (let current = node, depth = 0; current && depth < 12; depth += 1, current = current.parentElement) {
      if (['MAIN', 'BODY', 'HTML'].includes(current.tagName)) break
      if (glmComposerOrFooterUi(current)) break
      if (hasMultipleAssistantCards(current) || hasMultipleConversationTurns(current)) break
      const value = text(current)
      if (value.length < 20) continue
      const assistant = messageRole(current) === 'assistant' || hasExplicitAssistantIdentity(current)
      const messageShape = current.matches?.('article, li, [data-message-id], [data-message-role], [data-role], [data-author-role], [data-testid*="message"], [data-testid*="conversation"], [class*="assistant"], [class*="bot"], [class*="model-message"], [class*="chat-item"], [class*="chatItem"], [class*="conversation-item"], [class*="conversationItem"], [class*="message-item"], [class*="messageItem"], [class*="bubble"], [class*="turn"], [class*="answer"]')
      const answerLeaf = current.matches?.('[class*="markdown"], [class*="Markdown"], [class*="prose"], [class*="rich-text"], [class*="richText"], [class*="answer-content"], [class*="message-content"]')
      if (assistant || messageShape || answerLeaf) {
        const score = Math.min(value.length, 18_000) + (assistant ? 4_000 : 0) + (messageShape ? 900 : 0) + (answerLeaf ? 300 : 0) - depth
        if (!best || score > best.score) best = { node: current, score }
        fallback ||= current
      }
    }
    return best?.node || fallback || node
  }

  function boundedAssistantAnswerRootFor(node) {
    // Qwen can expose both a Markdown leaf and a reusable conversation shell.
    // Keep the largest assistant-shaped container that still represents one turn; never
    // collapse the whole transcript into a later Query's evidence record.
    let fallback = node
    let best = null
    for (let current = node, depth = 0; current && depth < 12; depth += 1, current = current.parentElement) {
      if (['MAIN', 'BODY', 'HTML'].includes(current.tagName)) break
      if (hasMultipleAssistantCards(current) || hasMultipleConversationTurns(current)) break
      const value = text(current)
      if (value.length < 20) continue
      const assistant = messageRole(current) === 'assistant'
      const messageShape = current.matches?.('article, li, [data-message-id], [data-message-role], [data-role], [data-author-role], [data-testid*="message"], [data-testid*="conversation"], [class*="message"], [class*="chat-item"], [class*="chatItem"], [class*="conversation-item"], [class*="conversationItem"], [class*="bubble"], [class*="turn"], [class*="answer"]')
      if (assistant || messageShape) {
        const score = Math.min(value.length, 18_000) + (assistant ? 4_000 : 0) - depth
        if (!best || score > best.score) best = { node: current, score }
      }
      fallback = current
    }
    return best?.node || fallback || node
  }

  function responseCandidateRoot(node) {
    if (ADAPTER?.id === 'deepseek-web') return deepseekAnswerRootFor(node)
    if (ADAPTER?.id === 'yuanbao-web') return yuanbaoAnswerRootFor(node) || node
    if (ADAPTER?.id === 'glm-web') return glmAnswerRootFor(node) || node
    if (['qwen-web', 'wenxin-web'].includes(ADAPTER?.id)) return boundedAssistantAnswerRootFor(node)
    return node
  }

  function hasExplicitAssistantIdentity(node) {
    // A platform shell often contains “AI” in generic class names. Do not treat that as
    // proof of a task-bound assistant message. Require explicit message metadata or a
    // narrow assistant/bot/model semantic marker instead.
    for (let current = node; current && current.parentElement; current = current.parentElement) {
      const dataRole = [
        current.getAttribute?.('data-message-role'), current.getAttribute?.('data-role'), current.getAttribute?.('data-author-role'),
        current.getAttribute?.('data-message-type'), current.getAttribute?.('data-message-author'), current.getAttribute?.('data-author'), current.getAttribute?.('data-sender'),
      ].filter(Boolean).join(' ').toLowerCase()
      if (/(?:^|[\s_-])(assistant|bot|model)(?:$|[\s_-])|智能回答|模型回答/.test(dataRole)) return true

      const structural = [current.getAttribute?.('data-testid'), current.getAttribute?.('data-test'), current.className?.toString?.(), current.id]
        .filter(Boolean).join(' ').toLowerCase()
      if (/(?:^|[\s_-])(assistant|bot|model)(?:$|[\s_-])|assistant-message|model-message|bot-message/.test(structural)) return true
      if (['MAIN', 'BODY', 'HTML'].includes(current.tagName)) break
    }
    return false
  }

  function qwenPageChrome(node) {
    const structural = [node?.className?.toString?.(), node?.id, node?.getAttribute?.('data-testid'), node?.getAttribute?.('data-test'), node?.getAttribute?.('role')].filter(Boolean).join(' ').toLowerCase()
    return /welcome|quick|shortcut|suggestion|nav|menu|toolbar|source|reference|citation|drawer|popover|search-result|searchresult|首页|快捷|导航|资料|来源|搜索结果/.test(structural)
  }

  function qwenTaskBoundAnswerShape(node) {
    const root = boundedAssistantAnswerRootFor(node)
    if (!root || qwenPageChrome(node) || qwenPageChrome(root)) return false
    // A transcript/list shell can contain the right class tokens while spanning several
    // turns. It is never a valid current-answer card even when it appears after submit.
    if (hasMultipleAssistantCards(root) || hasMultipleConversationTurns(root)) return false
    if (hasExplicitAssistantIdentity(node) || hasExplicitAssistantIdentity(root)) return true
    // Some production Qwen variants omit role metadata on the current answer. Allow only
    // a bounded, answer-shaped turn; never treat the composer, a global page container or
    // a source/search drawer as a fallback answer. readNewAnswer() still enforces the
    // post-submit Query anchor and pre-send snapshot before this candidate can be captured.
    const structural = [root.tagName, root.className?.toString?.(), root.id, root.getAttribute?.('data-testid'), root.getAttribute?.('data-test'), root.getAttribute?.('role')]
      .filter(Boolean).join(' ').toLowerCase()
    if (!/(message|chat|conversation|bubble|turn|answer|response|reply|markdown|rich[-_ ]?text|richtext|prose|content)/.test(structural)) return false
    if (/(composer|editor|input|textarea|textbox)/.test(structural)) return false
    if (root.matches?.('textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [class*="composer"], [class*="editor"], [class*="input"]')) return false
    const composer = root.querySelector?.('textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
    return !composer || !visible(composer)
  }

  function qwenCurrentTurnAnswerCandidates(userAnchor, question) {
    // Some current Qwen releases render the assistant turn as an otherwise unlabelled
    // sibling beside the newly submitted user card. The normal selector path cannot see
    // that card because its class names are build-hashed. This fallback is deliberately
    // task-bound: only inspect a few direct siblings after the current user turn, never a
    // page-wide rich-text scan or a conversation wrapper.
    if (!userAnchor) return []
    const answerNodes = []
    const seen = new Set()
    const asked = normalize(question)
    const anchorShells = []
    for (let current = userAnchor, depth = 0; current && depth < 9; depth += 1, current = current.parentElement) {
      if (['MAIN', 'BODY', 'HTML'].includes(current.tagName)) break
      if (qwenPageChrome(current) || hasMultipleAssistantCards(current) || hasMultipleConversationTurns(current)) continue
      const currentText = text(current)
      if (!currentText || currentText.length > Math.max(asked.length * 5 + 260, 720)) continue
      if (!looksLikeQuestionEcho(currentText, question) && !currentText.includes(asked)) continue
      anchorShells.push(current)
    }
    for (const anchorShell of anchorShells) {
      const parent = anchorShell.parentElement
      if (!parent || ['BODY', 'HTML'].includes(parent.tagName)) continue
      const children = [...parent.children]
      const anchorIndex = children.indexOf(anchorShell)
      if (anchorIndex < 0) continue
      for (let index = anchorIndex + 1; index < Math.min(children.length, anchorIndex + 6); index += 1) {
        const node = children[index]
        if (seen.has(node) || !visible(node) || qwenPageChrome(node) || node.contains(userAnchor)) continue
        if (node.matches?.('textarea, input, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [class*="composer"], [class*="editor"], [class*="input"]')) continue
        const composer = node.querySelector?.('textarea, input, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
        if (composer && visible(composer)) continue
        const value = text(node)
        if (value.length < 20 || looksLikeQuestionEcho(value, question) || messageRole(node) === 'user') continue
        // A source drawer should expose an explicit source/reference/search affordance. We
        // only take the adjacent answer card, not an independently opened source surface.
        if (sourceOnlyUi(node) || /(?:source|reference|citation|drawer|popover|search-result|搜索结果|参考资料)/i.test(selectorValues(node))) continue
        const answerSignals = node.querySelectorAll?.('p, h1, h2, h3, h4, li, table, pre, code, blockquote, [class*="markdown"], [class*="rich"], [class*="prose"], [class*="answer"], [class*="response"], [class*="reply"]').length || 0
        if (!answerSignals && value.length < 120) continue
        seen.add(node)
        answerNodes.push({ node, value, normalized: normalize(value), qwenSiblingFallback: true })
      }
    }
    return answerNodes.sort((left, right) => compareDocumentOrder(left.node, right.node))
  }

  function qwenResponseStructureDiagnostic() {
    if (ADAPTER?.id !== 'qwen-web') return ''
    const shapes = []
    for (const node of document.querySelectorAll('[data-testid*="message"], [data-testid*="conversation"], [class*="message"], [class*="chat"], [class*="conversation"], [class*="answer"], [class*="response"], [class*="reply"]')) {
      if (!visible(node)) continue
      const root = boundedAssistantAnswerRootFor(node)
      const structural = [root?.tagName, root?.className?.toString?.(), root?.id, root?.getAttribute?.('data-testid'), root?.getAttribute?.('role')].filter(Boolean).join(' ').slice(0, 180)
      shapes.push({ tag: root?.tagName || '', structural, explicitAssistant: hasExplicitAssistantIdentity(root), acceptedShape: qwenTaskBoundAnswerShape(root), chrome: qwenPageChrome(root) })
      if (shapes.length >= 8) break
    }
    return '；Qwen 回答结构=' + JSON.stringify(shapes)
  }

  function isUnsafeResponseCandidate(node, value) {
    if (ADAPTER?.id === 'yuanbao-web') {
      const root = yuanbaoAnswerRootFor(node)
      return !root || yuanbaoQuickUi(node) || yuanbaoQuickUi(root) || value.length < 40
    }
    if (ADAPTER?.id === 'qwen-web') {
      const root = boundedAssistantAnswerRootFor(node)
      return !root || !qwenTaskBoundAnswerShape(root)
    }
    if (ADAPTER?.id === 'glm-web') {
      const root = glmAnswerRootFor(node)
      return !root || glmComposerOrFooterUi(node) || glmComposerOrFooterUi(root)
    }
    return false
  }

  function responseNodes() {
    const seen = new Set()
    const values = []
    // 千问绝不回退到宽泛 markdown/message 选择器：它们会匹配欢迎页、快捷问题和资料抽屉。
    const selectors = ADAPTER?.id === 'qwen-web' ? (profile().responses || []) : [...(profile().responses || []), ...responseSelectors]
    for (const selector of selectors) {
      for (const matchedNode of document.querySelectorAll(selector)) {
        const node = responseCandidateRoot(matchedNode)
        if (seen.has(node) || !visible(node)) continue
        const value = text(node)
        if (value.length < 20 || isUnsafeResponseCandidate(node, value)) continue
        seen.add(node)
        values.push({ node, value, normalized: normalize(value) })
      }
    }
    // Keep the outer message root when broad/narrow selectors overlap. A child markdown
    // fragment can contain only the final paragraph and must not replace the full answer.
    const compact = values.filter((candidate) => !values.some((other) => other.node !== candidate.node
      && other.node.contains(candidate.node) && normalize(candidate.value) === normalize(other.value)))
    return compact.sort((left, right) => compareDocumentOrder(left.node, right.node))
  }

  function responseSnapshot() {
    const nodes = responseNodes()
    return { nodes: new Set(nodes.map((item) => item.node)), texts: new Set(nodes.map((item) => item.normalized)) }
  }

  function messageRoots() {
    const roots = []
    const seen = new Set()
    for (const node of document.querySelectorAll('article, [data-message-id], [data-message-role], [data-role], [data-author-role], [data-testid*="message"], [data-testid*="conversation"], [class*="message"], [class*="chat-item"], [class*="chatItem"], [class*="conversation-item"], [class*="conversationItem"], [class*="bubble"], [class*="turn"]')) {
      if (seen.has(node) || !visible(node)) continue
      const role = messageRole(node)
      if (!role) continue
      seen.add(node)
      roots.push({ node, role, normalized: normalize(text(node)) })
    }
    return roots.sort((left, right) => compareDocumentOrder(left.node, right.node))
  }

  function conversationSnapshot() {
    const messages = messageRoots()
    return { nodes: new Set(messages.map((item) => item.node)), texts: new Set(messages.map((item) => `${item.role}|${item.normalized}`)) }
  }

  function questionEchoNodes(question) {
    const asked = normalize(question)
    if (!asked) return []
    const matches = []
    for (const node of document.querySelectorAll('body *')) {
      if (!visible(node)) continue
      const value = normalize(text(node))
      // User cards on Doubao do not consistently expose a semantic user role. Match the
      // submitted Query itself, but keep the candidate deliberately compact so an entire
      // conversation section or a later long answer cannot become the anchor.
      if (!value.includes(asked) || value.length > asked.length * 4 + 180) continue
      matches.push({ node, normalized: value })
    }
    return matches.filter((candidate) => !matches.some((other) => other.node !== candidate.node && candidate.node.contains(other.node)))
      .sort((left, right) => compareDocumentOrder(left.node, right.node))
  }

  function questionEchoSnapshot(question) {
    return new Set(questionEchoNodes(question).map((item) => item.node))
  }

  function submittedUserAnchor(snapshot, questionSnapshot, question) {
    const asked = normalize(question)
    if (!asked) return null
    const labelled = messageRoots().filter((item) => item.role === 'user'
      && item.normalized.includes(asked)
      && (!snapshot.nodes.has(item.node) || !snapshot.texts.has(`user|${item.normalized}`)))
    const visibleQuestionEchoes = questionEchoNodes(question)
      .filter((item) => !questionSnapshot.has(item.node))
    const candidates = [...labelled, ...visibleQuestionEchoes]
      .filter((item, index, all) => all.findIndex((other) => other.node === item.node) === index)
      .sort((left, right) => compareDocumentOrder(left.node, right.node))
    return candidates.at(-1)?.node || null
  }

  function isAfterMessage(candidate, messageNode) {
    if (!candidate?.node || !messageNode) return false
    const answerRoot = messageRootFor(candidate.node)
    return Boolean(messageNode.compareDocumentPosition(answerRoot) & Node.DOCUMENT_POSITION_FOLLOWING)
  }

  function messageRole(node) {
    let current = node
    for (let depth = 0; current && depth < 9; depth += 1, current = current.parentElement) {
      // Do not infer a message role from visible body text: a landing page can say "我是千问"
      // or "文心回答" without being the task-bound assistant turn. Identity comes from
      // message metadata, accessible label or structural class only.
      const hints = [
        current.getAttribute?.('data-message-role'), current.getAttribute?.('data-role'), current.getAttribute?.('data-author-role'),
        current.getAttribute?.('data-message-type'), current.getAttribute?.('data-message-author'), current.getAttribute?.('data-author'), current.getAttribute?.('data-sender'),
        current.getAttribute?.('aria-label'), current.className?.toString?.(), current.getAttribute?.('data-testid'), current.getAttribute?.('data-test'),
      ].filter(Boolean).join(' ').toLowerCase()
      if (/(?:^|[\s_-])(user|human)(?:$|[\s_-])|用户|提问者/.test(hints)) return 'user'
      if (/(?:^|[\s_-])(assistant|bot|model|ai)(?:$|[\s_-])|助手|豆包|元宝|deepseek|深度求索|文心|千问|通义|kimi|月之暗面|智谱|清言|回答/.test(hints)) return 'assistant'
    }
    return ''
  }

  function looksLikeQuestionEcho(value, question) {
    const answer = normalize(value)
    const asked = normalize(question)
    if (!asked || !answer) return true
    if (answer === asked) return true
    if (!answer.startsWith(asked)) return false
    // normalize() deliberately removes punctuation. A timestamp such as “今天 16:33”
    // therefore becomes “今天 1633”; strip both forms before judging the candidate.
    const remainder = answer.slice(asked.length).replace(/^(今天|昨天|\d{1,4}(?::?\d{2})?|\d{4}[/-]\d{1,2}[/-]\d{1,2})+/g, '').trim()
    return remainder.length < Math.max(42, Math.round(asked.length * 0.35))
  }

  function pageContainsQuestion(question) {
    const asked = normalize(question)
    if (!asked) return false
    return normalize(document.body?.innerText || '').includes(asked)
  }

  function inputContainsQuestion(input, question) {
    const asked = normalize(question)
    if (!asked || !input) return false
    return normalize(input.value || input.innerText || input.textContent || '').includes(asked)
  }

  function readNewAnswer(snapshot, question, userAnchor, submissionConfirmed = false) {
    // Prefer the newly rendered user message as the binding anchor. Some current Doubao
    // builds keep user bubbles outside the semantic message tree, however, so a clearly new
    // assistant reply is also accepted after the just-submitted input has visibly cleared or
    // the Query has appeared in the page. The pre-send snapshot still prevents a previous
    // answer/source block from being attributed to this task.
    if (!userAnchor && !submissionConfirmed) return null
    // Real platform answers can be concise; use a lower safety floor while still excluding the short composer/query echo.
    const threshold = Math.max(40, Math.min(120, normalize(question).length + 28))
    const selectorCandidates = responseNodes()
    const qwenSiblingCandidates = ADAPTER?.id === 'qwen-web' ? qwenCurrentTurnAnswerCandidates(userAnchor, question) : []
    const candidates = [...selectorCandidates, ...qwenSiblingCandidates]
      .filter((candidate, index, all) => all.findIndex((other) => other.node === candidate.node) === index)
      .filter((candidate) => {
      const hasNewNode = !snapshot.nodes.has(candidate.node)
      const hasNewText = !snapshot.texts.has(candidate.normalized)
      // Qwen and GLM sometimes reuse an existing assistant DOM shell for the next turn.
      // In that layout document order cannot prove freshness because the shell can remain
      // above the newly rendered user card. A post-submit text change that was absent from
      // the pre-send snapshot is still task-bound, but only for these adapters and only
      // after the current Query is visibly accepted.
      const reusedCurrentTurn = hasNewText
        && submissionConfirmed
        && ['qwen-web', 'glm-web'].includes(ADAPTER?.id)
      const boundToThisSubmission = userAnchor
        ? (isAfterMessage(candidate, userAnchor) || reusedCurrentTurn)
        : submissionConfirmed
      return (hasNewNode || hasNewText)
        && candidate.normalized.length >= threshold
        && messageRole(candidate.node) !== 'user'
        && boundToThisSubmission
        && !looksLikeQuestionEcho(candidate.value, question)
    })
    const assistantCandidates = candidates.filter((candidate) => messageRole(candidate.node) === 'assistant' || hasExplicitAssistantIdentity(candidate.node))
    // Qwen may omit explicit assistant metadata. A structurally bounded current-turn card
    // remains eligible only after the Query anchor / snapshot checks above; chrome and
    // reference drawers continue to fail closed in qwenTaskBoundAnswerShape().
    const eligible = ADAPTER?.id === 'qwen-web'
      ? candidates.filter((candidate) => candidate.qwenSiblingFallback || qwenTaskBoundAnswerShape(candidate.node))
      : (assistantCandidates.length ? assistantCandidates : candidates)
    // Multiple selectors may point into one message. Collapse them by the assistant root,
    // retaining its full text, then choose the newest assistant turn.
    const byMessageRoot = new Map()
    for (const candidate of eligible) {
      const root = candidate.qwenSiblingFallback ? candidate.node : messageRootFor(candidate.node)
      const rootValue = candidate.qwenSiblingFallback ? candidate.value : (answerTextForCapture(root, question, userAnchor) || candidate.value)
      const complete = { ...candidate, node: root, value: rootValue, normalized: normalize(rootValue) }
      const existing = byMessageRoot.get(root)
      if (!existing || complete.value.length > existing.value.length) byMessageRoot.set(root, complete)
    }
    return [...byMessageRoot.values()].sort((left, right) => compareDocumentOrder(left.node, right.node)).at(-1) || null
  }

  function urlCandidate(value) {
    const raw = typeof value === 'string' ? value.trim() : ''
    if (!raw) return ''
    const values = [raw]
    try { values.push(decodeURIComponent(raw)) } catch { /* keep raw only */ }
    // Only inspect DOM attributes. Some source cards use an internal redirect URL or a
    // JSON-valued attribute, so resolve its explicit destination without navigating.
    try {
      const parsedJson = JSON.parse(raw)
      if (parsedJson && typeof parsedJson === 'object') {
        for (const key of ['url', 'href', 'target', 'target_url', 'redirect', 'redirect_url', 'source_url', 'sourceUrl', 'source_link', 'sourceLink', 'original_url', 'originalUrl', 'jump_url', 'jumpUrl', 'open_url', 'openUrl', 'link']) {
          if (typeof parsedJson[key] === 'string') values.push(parsedJson[key])
        }
      }
    } catch { /* not JSON */ }
    for (const item of values) {
      const candidate = String(item || '').trim()
      if (!candidate) continue
      let parsed = null
      try { parsed = new URL(candidate, location.href) } catch { /* continue */ }
      if (parsed && /^https?:$/i.test(parsed.protocol)) {
        for (const key of ['url', 'target', 'target_url', 'redirect', 'redirect_url', 'source_url', 'link']) {
          const rawTarget = parsed.searchParams.get(key)
          if (!rawTarget) continue
          const targetCandidates = [rawTarget]
          try { targetCandidates.push(decodeURIComponent(rawTarget)) } catch { /* keep raw only */ }
          for (const target of targetCandidates) {
            if (/^https?:\/\//i.test(target)) return target
          }
        }
        // Return ordinary external hrefs. Internal navigation alone is never reported as a
        // source link because it does not prove the underlying cited URL.
        if (/^https?:\/\//i.test(candidate) && parsed.origin !== location.origin) return parsed.href
      }
      const embedded = candidate.match(/https?:\/\/[^\s'"<>\\]+/i)?.[0]
      if (embedded) {
        try { return new URL(embedded, location.href).href } catch { /* continue */ }
      }
    }
    return ''
  }

  function sourceRelatedNodes(node) {
    const related = []
    const seen = new Set()
    const add = (candidate) => { if (candidate && !seen.has(candidate)) { seen.add(candidate); related.push(candidate) } }
    add(node)
    // DeepSeek result rows often place the URL on a clickable card *around* the title node.
    // Looking at a few local ancestors is still visible-DOM-only and avoids navigation.
    let current = node?.parentElement
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
      add(current)
      if (current.matches?.('a[href], [role="link"], [role="button"], [data-url], [data-href], [data-source-url], [data-original-url]')) break
    }
    for (const child of node?.querySelectorAll?.(sourceUrlSelectors) || []) add(child)
    return related
  }

  function normalizedHref(node) {
    const values = []
    for (const related of sourceRelatedNodes(node)) {
      values.push(
        related?.getAttribute?.('href'), related?.href, related?.getAttribute?.('data-href'), related?.getAttribute?.('data-url'),
        related?.getAttribute?.('data-target'), related?.getAttribute?.('data-redirect-url'), related?.getAttribute?.('data-link'),
        related?.getAttribute?.('data-source-url'), related?.getAttribute?.('data-source-link'), related?.getAttribute?.('data-original-url'),
        related?.getAttribute?.('data-jump-url'), related?.getAttribute?.('data-open-url'), related?.getAttribute?.('data-raw-url'),
        related?.getAttribute?.('url'), related?.getAttribute?.('target-url'),
      )
      for (const attribute of related?.getAttributeNames?.() || []) values.push(related.getAttribute(attribute))
      for (const datasetValue of Object.values(related?.dataset || {})) values.push(datasetValue)
    }
    for (const value of values) {
      const url = urlCandidate(value)
      if (url) return url
    }
    return ''
  }

  function glmLegalOrChromeLink(node, url, label) {
    if (ADAPTER?.id !== 'glm-web') return false
    const semantic = [label, url, ...sourceRelatedNodes(node).slice(0, 5).map((related) => selectorValues(related))].filter(Boolean).join(' ').toLowerCase()
    // The legal footer is not response evidence. Do not blacklist the ChatGLM origin in
    // general because a genuine answer may contain a platform-hosted resource; exclude
    // only policy/account/navigation surfaces with explicit legal semantics.
    return /用户协议|隐私政策|服务协议|privacy(?:[-_/]?policy)?|user[-_/ ]?agreement|terms(?:[-_/ ]?(?:of[-_/ ]?service|service))?|copyright|京icp|公网安备/.test(semantic)
  }

  function visibleLinks(scope) {
    const seen = new Set()
    const selectors = 'a[href], [data-url], [data-href], [data-target], [data-redirect-url], [data-link], [data-source-url], [data-source-link], [data-original-url], [data-jump-url], [data-open-url]'
    return [...scope.querySelectorAll(selectors)].filter(visible).map((node) => {
      const url = normalizedHref(node)
      const label = text(node) || node.getAttribute?.('aria-label') || node.getAttribute?.('title') || ''
      if (!url || seen.has(url) || glmLegalOrChromeLink(node, url, label)) return null
      seen.add(url)
      return { url, title: label.slice(0, 320), visibleText: label.slice(0, 320) }
    }).filter(Boolean).slice(0, 50)
  }

  function composerGenerationScope() {
    const input = getInput()
    if (!input) return null
    for (let node = input; node && node.parentElement; node = node.parentElement) {
      if (node.matches?.('form, [class*="composer"], [class*="chat-input"], [class*="input-area"], [class*="input-wrapper"], [class*="editor"]')) return node
      if (['MAIN', 'BODY', 'HTML'].includes(node.tagName)) break
    }
    return input.parentElement || input
  }

  function answerStillGenerating(answerNode) {
    const root = messageRootFor(answerNode)
    // A completed answer can legitimately include “搜索 3 个关键词，参考 12 篇资料”.
    // Only dedicated controls and status elements may prove active generation; never
    // inspect the full assistant/source text as a generation signal.
    const composer = ADAPTER?.id === 'glm-web' ? composerGenerationScope() : null
    const scopes = [root, composer].filter(Boolean)
    // GLM puts completed answer/source content inside containers whose class names can
    // include "thinking" or "search". Treat only visible controls or explicitly-labelled
    // status widgets as live generation evidence there; broad class scans caused completed
    // answers to be held until the watchdog fired.
    const generationSelectors = ADAPTER?.id === 'glm-web'
      ? 'button, [role="button"], [aria-label], [title], [data-testid*="stop"], [data-test*="stop"], [class*="stop"]'
      : 'button, [role="button"], [aria-label], [title], [data-testid], [data-test], [class*="status"], [class*="think"], [class*="generat"], [class*="loading"], [class*="stop"]'
    const controls = [...new Set(scopes.flatMap((scope) => [...(
      scope?.querySelectorAll?.(generationSelectors) || []
    )]))]

    return controls.some((node) => {
      if (!visible(node)) return false
      const structural = [
        node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.getAttribute?.('data-testid'),
        node.getAttribute?.('data-test'), node.className?.toString?.(),
      ].filter(Boolean).join(' ')
      const className = node.className?.toString?.() || ''
      const statusText = /status|think|generat|loading|stop/i.test(className) ? text(node) : ''
      return /停止(?:生成|回答|输出)?|停止思考|stop\s*(?:generating|response|answer)?|generating|生成中|回答中|思考中|搜索中|检索中|联网(?:搜索|检索)中|正在(?:搜索|检索|思考)|searching|retrieving|thinking/i
        .test(`${structural} ${statusText}`)
    })
  }

  function messageRootFor(answerNode) {
    if (ADAPTER?.id === 'deepseek-web') return deepseekAnswerRootFor(answerNode)
    if (ADAPTER?.id === 'yuanbao-web') return yuanbaoAnswerRootFor(answerNode) || answerNode
    if (ADAPTER?.id === 'glm-web') return glmAnswerRootFor(answerNode) || answerNode
    if (['qwen-web', 'wenxin-web'].includes(ADAPTER?.id)) return boundedAssistantAnswerRootFor(answerNode)
    let node = answerNode
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      // messageRole() deliberately searches ancestors, so only use it once we are on a
      // message-shaped container. Otherwise an inner markdown node would hide its siblings.
      if (node.matches?.('article, li, [data-message-id], [data-testid*="message"], [data-testid*="conversation"], [data-message-role], [data-role], [data-author-role], [class*="message"], [class*="chat-item"], [class*="chatItem"], [class*="conversation-item"], [class*="conversationItem"], [class*="bubble"], [class*="turn"]') && messageRole(node) === 'assistant') return node
      if (['MAIN', 'BODY', 'HTML'].includes(node.tagName)) break
    }
    return answerNode
  }

  function sourceOnlyUi(node) {
    if (!node || !visible(node)) return false
    // Do not use the answer body itself as a drawer signal: a legitimate GEO answer
    // naturally discusses "来源"、"引用" or "参考资料". Only explicit DOM
    // structure may identify a source-only surface; the short visible header remains a
    // secondary guard for unlabeled panels.
    const structural = [
      node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.getAttribute?.('data-testid'),
      node.getAttribute?.('data-test'), node.getAttribute?.('name'), node.id, node.className?.toString?.(),
    ].filter(Boolean).join(' ')
    const value = text(node)
    return /source|reference|citation|search-result|searchresult|drawer|popover|modal|side(?:bar)?|来源|资料|搜索结果/i.test(structural)
      || (sourceHeaderPattern.test(value) && value.length < 500)
  }

  function uniqueTextSegments(values) {
    const result = []
    const normalized = new Set()
    for (const value of values) {
      const raw = String(value || '').trim()
      const key = normalize(raw)
      if (!raw || key.length < 20 || normalized.has(key)) continue
      if (result.some((existing) => normalize(existing).includes(key))) continue
      for (let index = result.length - 1; index >= 0; index -= 1) {
        if (key.includes(normalize(result[index]))) {
          normalized.delete(normalize(result[index]))
          result.splice(index, 1)
        }
      }
      normalized.add(key)
      result.push(raw)
    }
    return result
  }

  function normalizedTableCellText(cell) {
    return text(cell)
      .replace(/\r?\n+/g, '\n')
      .split('\n')
      .map((segment) => segment.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('<br>')
      .replace(/\|/g, '\\|')
      .trim()
  }

  function tableRowsForCapture(table) {
    const isNativeTable = table.matches?.('table')
    const rowNodes = isNativeTable
      ? [...table.querySelectorAll('tr')]
      : [...table.querySelectorAll('[role="row"]')]
    return rowNodes.map((row) => {
      const cellSelector = isNativeTable ? 'th, td' : '[role="columnheader"], [role="rowheader"], [role="cell"], [role="gridcell"]'
      const cells = [...row.querySelectorAll(cellSelector)]
        .filter((cell) => cell.closest(isNativeTable ? 'tr' : '[role="row"]') === row)
      return {
        cells: cells.map(normalizedTableCellText),
        header: cells.some((cell) => cell.tagName === 'TH' || /columnheader|rowheader/i.test(cell.getAttribute('role') || '')),
      }
    }).filter((row) => row.cells.some(Boolean))
  }

  function markdownTableForCapture(table) {
    const rows = tableRowsForCapture(table)
    if (!rows.length) return ''
    const columnCount = Math.max(...rows.map((row) => row.cells.length))
    if (!columnCount) return ''
    const normalizedRows = rows.map((row) => Array.from({ length: columnCount }, (_value, index) => row.cells[index] || ''))
    const header = normalizedRows[0]
    const separator = Array.from({ length: columnCount }, () => '---')
    const body = normalizedRows.slice(1)
    // A platform occasionally renders a one-row, header-only table. It is still visible
    // tabular evidence and can be represented faithfully without inventing a data row.
    return [header, separator, ...body].map((row) => `| ${row.join(' | ')} |`).join('\n')
  }

  function visibleTableCapture(nodes) {
    const roots = [...new Set(nodes.filter(Boolean))]
    const candidates = []
    for (const root of roots) {
      const found = [
        ...(root.matches?.('table, [role="table"], [role="grid"]') ? [root] : []),
        ...(root.querySelectorAll?.('table, [role="table"], [role="grid"]') || []),
      ]
      for (const table of found) {
        if (!visible(table) || candidates.includes(table)) continue
        // Prefer the outer table/grid if a presentation wrapper nests another matching table.
        if (candidates.some((other) => other.contains(table))) continue
        for (let index = candidates.length - 1; index >= 0; index -= 1) if (table.contains(candidates[index])) candidates.splice(index, 1)
        candidates.push(table)
      }
    }
    const markdownTables = [...new Set(candidates.map(markdownTableForCapture).filter(Boolean))]
    return { tables: candidates, markdownTables }
  }

  function appendVisibleTables(answer, capture) {
    const base = String(answer || '').trim()
    const missing = capture.markdownTables.filter((table) => !base.includes(table))
    if (!missing.length) return base
    return `${base}${base ? '\n\n' : ''}### 页面可见表格\n\n${missing.join('\n\n')}`
  }

  function answerTextForCapture(answerNode, question = '', userAnchor = null) {
    const root = messageRootFor(answerNode)
    const rootValue = text(root).trim()
    if (ADAPTER?.id !== 'deepseek-web') {
      return appendVisibleTables(rootValue || text(answerNode).trim(), visibleTableCapture([root, answerNode]))
    }

    // DeepSeek's client may virtualize one assistant turn into a parent shell plus several
    // Markdown siblings. Build a conservative, task-bound union: it must be after this Query's
    // user card and can never include an opened source drawer or a later user turn.
    const selector = '[data-message-role="assistant"], [data-role="assistant"], [data-testid*="assistant"], [class*="ds-markdown"], [class*="markdown"], [class*="Markdown"], [class*="prose"], [class*="answer-content"], [class*="message-content"]'
    const candidates = [...document.querySelectorAll(selector)]
      .filter((node) => visible(node) && !sourceOnlyUi(node))
      .filter((node) => !userAnchor || Boolean(userAnchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING))
      .filter((node) => messageRole(node) !== 'user' && !looksLikeQuestionEcho(text(node), question))
    const rootBound = candidates.filter((node) => isSameOrContained(node, root))
    // Some DeepSeek builds mount each section of one answer under different sibling wrappers.
    // Include visible answer fragments after the current user turn, stopping before a later user
    // turn when one exists. This is still task-bound (never a whole-page scan) and excludes the
    // source drawer through sourceOnlyUi().
    const laterUserTurn = userAnchor ? messageRoots().find((item) => item.role === 'user'
      && item.node !== userAnchor
      && Boolean(userAnchor.compareDocumentPosition(item.node) & Node.DOCUMENT_POSITION_FOLLOWING))?.node : null
    const taskBoundFragments = candidates.filter((node) => {
      if (!userAnchor || !Boolean(userAnchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) return false
      if (laterUserTurn && Boolean(node.compareDocumentPosition(laterUserTurn) & Node.DOCUMENT_POSITION_FOLLOWING)) return false
      return !sourceOnlyUi(node)
    })
    // If the current answer shell itself is a virtualized fragment, include its directly adjacent
    // Markdown siblings only when they are after this Query. This is intentionally narrower than
    // scanning the whole conversation and prevents a previous answer from being reused.
    const siblingFragments = []
    if (root?.parentElement) {
      const children = [...root.parentElement.children]
      const rootIndex = children.indexOf(root)
      for (let index = Math.max(0, rootIndex - 1); index < Math.min(children.length, rootIndex + 8); index += 1) {
        const node = children[index]
        if (!visible(node) || sourceOnlyUi(node)) continue
        if (userAnchor && !(userAnchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
        if (messageRole(node) === 'user' || looksLikeQuestionEcho(text(node), question)) continue
        if (/[\s\S]*?(?:ds-markdown|markdown|prose|answer|message-content)/i.test(selectorValues(node))) siblingFragments.push(node)
      }
    }
    const scoped = [...new Set([root, answerNode, ...rootBound, ...taskBoundFragments, ...siblingFragments].filter(Boolean))]
    const leaves = scoped.filter((node) => !sourceOnlyUi(node))
      .filter((node) => !scoped.some((other) => other !== node && node.contains(other)))
      .filter((node) => !scoped.some((other) => other !== node && other.contains(node) && normalize(text(other)) === normalize(text(node))))
      .sort(compareDocumentOrder)
    // Keep the largest complete shell first; uniqueTextSegments drops nested duplicates while
    // retaining non-overlapping answer fragments. This fixes captures that previously retained
    // only the final DeepSeek paragraph.
    const answer = uniqueTextSegments([rootValue, ...leaves.map((node) => text(node))]).join('\n\n') || rootValue
    return appendVisibleTables(answer, visibleTableCapture(scoped))
  }

  function isSameOrContained(left, right) {
    return Boolean(left && right && (left === right || left.contains(right) || right.contains(left)))
  }

  function isWithin(node, root) {
    return Boolean(node && root && (node === root || root.contains(node)))
  }

  function sourceHeaderMatch(node) {
    const value = text(node)
    const match = value.match(sourceHeaderPattern)
    if (!match || (match.index ?? 0) > 900 || value.length > 6_000) return null
    const childCarriesHeader = [...node.children].some((child) => sourceHeaderPattern.test(text(child)))
    return childCarriesHeader ? null : { value, match }
  }

  function keywordCandidate(value) {
    const phrase = String(value || '').replace(/\s+/g, ' ').replace(/^[•·\-—–\d.、()（）\[\]【】\s]+/, '').trim()
    if (phrase.length < 2 || phrase.length > 140) return ''
    if (/^(?:搜索|关键词|参考资料|资料来源|搜索结果|展开|收起|共\s*\d+\s*(?:条|篇)|\d+\s*篇资料)/i.test(phrase)) return ''
    if (/(?:https?:\/\/|www\.|\.com\b|\.cn\b)/i.test(phrase) || /^(?:来源|资料|参考)(?:资料|链接|列表)?$/i.test(phrase)) return ''
    return phrase
  }

  function searchKeywordsFromVisibleText(values, keywordCount) {
    if (!keywordCount) return []
    const keywords = []
    const seen = new Set()
    const add = (value) => {
      const phrase = keywordCandidate(value)
      const key = normalize(phrase)
      if (!phrase || !key || seen.has(key)) return false
      seen.add(key)
      keywords.push(phrase)
      return keywords.length >= Math.min(keywordCount, 20)
    }
    for (const value of values || []) {
      const raw = String(value || '')
      if (!raw) continue
      const match = raw.match(sourceHeaderPattern)
      // Quoted phrases after the platform search heading are the highest-confidence form.
      const start = match ? Math.max(0, (match.index ?? 0) + String(match[0] || '').length) : 0
      const tail = raw.slice(start, start + 2_400)
      for (const item of tail.matchAll(/[“"「]([^”"」\n]{2,220})[”"」]/g)) {
        if (add(item[1])) return keywords
      }
    }
    return keywords
  }

  function searchKeywordsFromScopes(scopes, keywordCount, existing = []) {
    if (!keywordCount || existing.length >= keywordCount) return existing.slice(0, Math.min(keywordCount, 20))
    const keywords = [...existing]
    const seen = new Set(keywords.map((item) => normalize(item)))
    const add = (value) => {
      const phrase = keywordCandidate(value)
      const key = normalize(phrase)
      if (!phrase || !key || seen.has(key)) return false
      seen.add(key)
      keywords.push(phrase)
      return keywords.length >= Math.min(keywordCount, 20)
    }
    // Only inspect dedicated keyword/search controls. This deliberately excludes source
    // cards and links, so article titles cannot be misreported as the platform's keywords.
    const selectors = '[data-keyword], [data-search-keyword], [class*="keyword"], [class*="search-term"], [aria-label*="关键词"], [title*="关键词"]'
    for (const scope of scopes || []) {
      if (!scope || !visible(scope)) continue
      const candidates = [...scope.querySelectorAll(selectors)]
      for (const container of candidates) {
        if (!visible(container) || container.querySelector('a[href], [data-url], [data-href], [data-target]')) continue
        const leaves = [...container.querySelectorAll('span, li, button, div')]
          .filter((node) => visible(node) && !node.querySelector('a[href], [data-url], [data-href], [data-target]'))
          .filter((node) => ![...node.children].some((child) => text(child).trim().length > 0))
        for (const node of leaves) if (add(text(node))) return keywords
        if (!leaves.length && add(text(container))) return keywords
      }
      // In some layouts a visible '关键词' label is followed by plain sibling chips.
      for (const label of [...scope.querySelectorAll('*')].filter((node) => visible(node) && /(?:搜索)?关键词/.test(text(node)) && text(node).length < 80)) {
        let sibling = label.nextElementSibling
        for (let index = 0; sibling && index < 12; index += 1, sibling = sibling.nextElementSibling) {
          if (sibling.querySelector('a[href], [data-url], [data-href], [data-target]')) break
          if (add(text(sibling))) return keywords
        }
      }
    }
    return keywords
  }

  // A source heading belongs to the newly captured assistant message only. Do not accept
  // an adjacent message or a conversation-level ancestor: a previously expanded panel can
  // otherwise be mistaken for the current Query's evidence.
  function sourceScopeForHeader(node, messageRoot) {
    if (!isWithin(node, messageRoot)) return node
    let scope = node
    for (let depth = 0; scope && depth < 7; depth += 1, scope = scope.parentElement) {
      if (!isWithin(scope, messageRoot)) break
      const label = selectorValues(scope)
      if (/source|reference|citation|资料|来源|搜索结果/i.test(label) || scope.querySelector(sourceSelectors)) return scope
      if (scope === messageRoot) break
    }
    return node
  }

  function sourceHeaderCandidates(root) {
    if (!root) return []
    const candidates = []
    for (const node of [root, ...root.querySelectorAll('*')]) {
      if (!visible(node)) continue
      const header = sourceHeaderMatch(node)
      if (!header) continue
      const scope = sourceScopeForHeader(node, root)
      if (!isWithin(scope, root)) continue
      candidates.push({ node, scope, ...header })
    }
    return candidates
  }

  function sourceHeaderInfo(answerNode) {
    const messageRoot = messageRootFor(answerNode)
    // Some Doubao builds render the web-search evidence block immediately before the
    // assistant card. Only accept that one direct sibling when the current card itself
    // has no source heading; never walk to older conversation messages or global panels.
    const currentCandidates = sourceHeaderCandidates(messageRoot)
    // DeepSeek and Yuanbao occasionally render the per-answer web-search control as an immediate
    // companion sibling instead of inside the Markdown shell. Keep the scope to those direct siblings;
    // never scan a previous conversation turn or a global result drawer at this stage.
    const companionSiblings = [messageRoot.previousElementSibling, messageRoot.nextElementSibling]
      .filter((sibling) => sibling && messageRole(sibling) !== 'assistant' && sourceHeaderPattern.test(text(sibling)))
    const companionCandidates = companionSiblings.flatMap((sibling) => sourceHeaderCandidates(sibling))
    const candidates = currentCandidates.length ? currentCandidates : companionCandidates
    candidates.sort((left, right) => left.value.length - right.value.length)
    const selected = candidates[0]
    if (!selected) return { node: null, scopes: [], detected: false, declaredCount: 0, declaredKeywordCount: 0, keywords: [], headerText: '' }
    const scopes = [...new Set(candidates.map((candidate) => candidate.scope))]
    const scopeText = [selected.value, ...scopes.map((scope) => text(scope))].join(' ')
    const countMatch = scopeText.match(/(?:参考|浏览)\s*(\d+)\s*(?:篇资料|篇网页)/) || scopeText.match(/(?:查看\s*)?(\d+)\s*(?:个)?(?:网页|web\s*pages?)/i)
    const keywordCountMatch = scopeText.match(/搜索\s*(\d+)\s*个关键词/)
    return {
      node: selected.node,
      scopes,
      detected: true,
      declaredCount: countMatch ? Number(countMatch[1]) : 0,
      declaredKeywordCount: keywordCountMatch ? Number(keywordCountMatch[1]) : 0,
      keywords: searchKeywordsFromVisibleText([
        selected.value,
        ...scopes.map((scope) => text(scope)),
      ], keywordCountMatch ? Number(keywordCountMatch[1]) : 0),
      headerText: selected.match[0].slice(0, 320),
    }
  }

  function looksLikeSourceHeader(value) {
    return sourceHeaderPattern.test(value) && value.length < 180
  }

  function sourceNodeHasSignal(node, scope) {
    const label = selectorValues(node)
    return node.matches?.('a[href]')
      || /source|reference|citation|资料|来源/i.test(label)
      || /source|reference|citation|资料|来源/i.test(selectorValues(scope))
  }

  function isExternalSourceUrl(url) {
    try { return Boolean(url) && new URL(url).origin !== location.origin } catch { return false }
  }

  function sourceItemCandidates(scope) {
    const selector = `${sourceSelectors}, [role="listitem"], li, article, [class*="card"], [class*="item"], [class*="entry"], [class*="row"]`
    const candidates = [...scope.querySelectorAll(selector)]
      .filter((node) => visible(node))
      .filter((node) => {
        const value = text(node)
        return value.length >= 2 && value.length <= 1_400 && !looksLikeSourceHeader(value)
      })
    // Prefer individual rows/cards over their container so a drawer never appears as one giant source.
    return candidates.filter((node) => !candidates.some((other) => other !== node && node.contains(other)
      && text(other).length >= 2 && text(other).length < text(node).length))
  }

  function extractSourcesFromScopes(scopes) {
    const sources = []
    const seen = new Set()
    for (const scope of scopes) {
      if (!scope || !visible(scope)) continue
      const sourceRegion = /source|reference|citation|资料|来源|搜索结果|网页|drawer|panel|result/i.test(`${selectorValues(scope)} ${text(scope).slice(0, 300)}`)
      for (const node of sourceItemCandidates(scope)) {
        const visibleText = text(node).slice(0, 320)
        const url = normalizedHref(node)
        const explicitSource = sourceNodeHasSignal(node, scope)
        // A result card in a just-opened DeepSeek/元宝 drawer can expose its title before the
        // website URL becomes available. Retain that visible title as audited evidence instead
        // of silently dropping the entire source row; never invent a URL.
        if (!url && !explicitSource && !sourceRegion) continue
        if (url && !isExternalSourceUrl(url) && !explicitSource && !sourceRegion) continue
        const key = `${url || normalize(visibleText)}`
        if (!key || seen.has(key)) continue
        seen.add(key)
        sources.push({
          url: isExternalSourceUrl(url) ? url : '',
          title: visibleText,
          visibleText,
          sourceType: 'platform-search-result',
          position: sources.length + 1,
          urlAvailable: isExternalSourceUrl(url),
          ...(!isExternalSourceUrl(url) ? { captureMethod: 'visible-source-title-no-external-url' } : {}),
        })
        if (sources.length >= 50) return sources
      }
    }
    return sources
  }

  function mergeSourceLists(...groups) {
    const seen = new Set()
    const merged = []
    for (const group of groups) {
      for (const item of group || []) {
        const key = `${item?.url || ''}|${normalize(item?.title || item?.visibleText || '')}`
        if (!key || seen.has(key)) continue
        seen.add(key)
        merged.push({ ...item, position: merged.length + 1 })
      }
    }
    return merged
  }

  function sourcePanelScrollContainers(scopes) {
    const containers = []
    const seen = new Set()
    for (const scope of scopes) {
      if (!scope || !visible(scope)) continue
      const nodes = [scope, ...scope.querySelectorAll('[role="dialog"], [role="listbox"], [class*="popover"], [class*="drawer"], [class*="modal"], [class*="side"], [class*="search-result"], [class*="searchResult"], [class*="source"], [class*="reference"], [class*="citation"]')]
      for (const node of nodes) {
        if (seen.has(node) || node === document.body || node === document.documentElement || !visible(node)) continue
        seen.add(node)
        if (node.scrollHeight > node.clientHeight + 16) containers.push(node)
      }
    }
    return containers
  }

  function inlinePlatformSourcesAfterHeader(answerNode, header) {
    if (!header?.detected || !header.node) return []
    const messageRoot = messageRootFor(answerNode)
    const sources = []
    const seen = new Set()
    const isAfterHeader = (node) => {
      if (header.node.contains(node)) return true
      return Boolean(header.node.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
    }
    for (const anchor of messageRoot.querySelectorAll('a[href]')) {
      if (!visible(anchor) || !isAfterHeader(anchor)) continue
      const url = normalizedHref(anchor)
      if (!url || !isExternalSourceUrl(url)) continue
      // Only use the first visible external-link block that follows the platform source
      // heading. This is a conservative recovery path for layouts whose source row has no
      // semantic class/role; it intentionally stops at the declared source count.
      const title = text(anchor).slice(0, 320)
      if (!title || seen.has(url)) continue
      seen.add(url)
      sources.push({
        url,
        title,
        visibleText: title,
        sourceType: 'platform-search-result',
        position: sources.length + 1,
        urlAvailable: true,
        captureMethod: 'inline-after-platform-search-header',
      })
      if (header.declaredCount && sources.length >= Math.min(header.declaredCount, 50)) break
    }
    return sources
  }

  async function captureLazyLoadedSources(scopes, currentSources, expectedCount) {
    let sources = mergeSourceLists(currentSources)
    let scrolled = false
    if (!expectedCount || sources.length >= expectedCount) return { sources, scrolled }
    for (const container of sourcePanelScrollContainers(scopes)) {
      const initialTop = container.scrollTop
      const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
      let lastTop = -1
      for (let step = 0; step < 14 && sources.length < expectedCount; step += 1) {
        const nextTop = Math.min(maxTop, Math.max(container.scrollTop + Math.max(280, Math.floor(container.clientHeight * 0.78)), 1))
        if (nextTop <= lastTop || nextTop === container.scrollTop) break
        lastTop = nextTop
        container.scrollTop = nextTop
        container.dispatchEvent(new Event('scroll', { bubbles: true }))
        scrolled = true
        await sleep(160)
        sources = mergeSourceLists(sources, extractSourcesFromScopes(scopes))
      }
      if (container.scrollTop !== initialTop) {
        container.scrollTop = initialTop
        container.dispatchEvent(new Event('scroll', { bubbles: true }))
      }
    }
    return { sources, scrolled }
  }

  function isExactPlatformSourceLabel(value) {
    return /^(?:搜索\s*\d+\s*个关键词\s*[，,]?\s*参考\s*\d+\s*篇资料|(?:查看\s*)?\d+\s*(?:个)?(?:网页|web\s*pages?))\s*[>›〉⌄⌃∨^]?$/.test(String(value || '').trim())
  }

  function canSafelyExpandSourceNode(node, exactHeader = false) {
    if (!node) return false
    const href = node.getAttribute?.('href') || ''
    if (node.matches?.('a[href]') && !/^(?:#|javascript:\s*;?\s*)$/i.test(href.trim())) return false
    const target = normalizedHref(node)
    if ((/^https?:\/\//i.test(href) && isExternalSourceUrl(urlCandidate(href))) || (target && isExternalSourceUrl(target))) return false
    if (exactHeader) return true
    const style = getComputedStyle(node)
    return node.matches?.('button, [role="button"], [role="link"], [tabindex]')
      || node.hasAttribute?.('aria-expanded')
      || node.hasAttribute?.('onclick')
      || style.cursor === 'pointer'
  }

  function findSafeSourceExpander(answerNode, header) {
    const messageRoot = messageRootFor(answerNode)
    const roots = [...new Set([header.node, messageRoot, ...(header.scopes || [])].filter(Boolean))]
    const candidates = []
    const seen = new Set()
    const push = (node) => { if (node && !seen.has(node)) { seen.add(node); candidates.push(node) } }
    // The visible label is frequently a span inside a React click target. Try its local
    // ancestors first, then other controls within this answer/source scope.
    let ancestor = header.node
    for (let depth = 0; ancestor && depth < 7; depth += 1, ancestor = ancestor.parentElement) {
      push(ancestor)
      if (ancestor === messageRoot || ancestor === document.body) break
    }
    for (const root of roots) {
      push(root)
      for (const node of root.querySelectorAll?.('*') || []) push(node)
    }
    for (const node of candidates) {
      if (!visible(node) || disabled(node)) continue
      const label = text(node).trim()
      const exactHeader = isExactPlatformSourceLabel(label)
      const sourceAction = label.length < 220 && /(搜索\s*\d+\s*个关键词[\s\S]{0,60}参考\s*\d+\s*篇资料|参考\s*\d+\s*篇资料|(?:查看\s*)?\d+\s*(?:个)?(?:网页|web\s*pages?)|查看.{0,12}(资料|来源)|展开.{0,12}(资料|来源)|资料来源|搜索来源)/i.test(label)
      if ((!exactHeader && !sourceAction) || !canSafelyExpandSourceNode(node, exactHeader)) continue
      return node
    }
    return null
  }

  async function activateSourceExpander(node) {
    node.scrollIntoView?.({ block: 'center', inline: 'nearest' })
    try {
      node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true }))
      node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true }))
      node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
    } catch { /* PointerEvent is unavailable in a few test/Chromium contexts. */ }
    node.click()
  }

  function sourcePanelSnapshot(panel) {
    const urls = [...panel.querySelectorAll('a[href], [data-url], [data-href], [data-target], [data-source-url], [data-source-link], [data-original-url], [data-jump-url], [data-open-url]')]
      .map((node) => normalizedHref(node))
      .filter((url) => isExternalSourceUrl(url))
      .sort()
    const value = normalize(text(panel)).slice(0, 8_000)
    return { node: panel, urls, fingerprint: `${value}|${urls.join('|')}` }
  }

  function openedSourcePanels(messageRoot, previousPanels = new Map()) {
    const panels = []
    const snapshots = []
    const selectors = '[role="dialog"], [role="listbox"], [role="complementary"], [data-state="open"], [aria-label*="搜索结果"], [aria-label*="参考资料"], [aria-label*="相关网页"], [aria-label*="联网搜索"], [data-testid*="search"], [data-testid*="result"], [data-qa*="search"], [data-qa*="result"], [class*="popover"], [class*="drawer"], [class*="modal"], [class*="side"], [class*="sidebar"], [class*="panel"], [class*="search-result"], [class*="searchResult"], [class*="searchResultContainer"], [class*="reference-list"], [class*="referenceList"], [class*="web-source"], [class*="source"], [class*="reference"], [class*="citation"], [class*="result"]'
    for (const panel of document.querySelectorAll(selectors)) {
      if (!visible(panel) || isSameOrContained(panel, messageRoot)) continue
      const value = text(panel)
      if (!value || value.length > 12_000) continue
      const hasExternalLink = [...panel.querySelectorAll('a[href], [data-url], [data-href], [data-target], [data-source-url], [data-source-link], [data-original-url], [data-jump-url], [data-open-url]')]
        .some((node) => isExternalSourceUrl(normalizedHref(node)))
      // DeepSeek's right-hand drawer is visibly titled “搜索结果” but may not expose
      // source/reference attributes. It is accepted only because this function compares it
      // with the panel state immediately before clicking the current answer's source entry.
      const hasSourceSignal = /source|reference|citation|search|result|资料|来源|网页/i.test(selectorValues(panel))
        || /搜索结果|(?:\d+\s*个)?网页|参考资料|资料来源|相关(?:网页|资料)|联网搜索/i.test(value.slice(0, 800))
      if (!hasExternalLink && !hasSourceSignal) continue
      const snapshot = sourcePanelSnapshot(panel)
      snapshots.push(snapshot)
      const before = previousPanels.get(panel)
      // Doubao may reuse one portal/drawer node between turns. A changed visible payload
      // is therefore a new source panel for the current task even when the DOM node itself
      // is unchanged.
      if (!before || before.fingerprint !== snapshot.fingerprint) panels.push(panel)
    }
    return { panels, snapshots }
  }

  async function platformSearchSources(answerNode, { allowExpansion = true } = {}) {
    let header = sourceHeaderInfo(answerNode)
    let sourceScopes = [...header.scopes]
    let sources = extractSourcesFromScopes(sourceScopes)
    const messageRoot = messageRootFor(answerNode)
    let expansion = { attempted: false, expanded: false, reason: '' }
    // Only click a clearly labelled, in-page source expander. Never open an external
    // result URL during capture: the visible page is the source of truth.
    if (!sources.some((item) => item.url)) {
      const expander = findSafeSourceExpander(answerNode, header)
      if (expander) {
        // Capture the page's already-visible panels first. After the click, accept only a
        // panel that was newly revealed by this current message's source control.
        const beforePanelState = openedSourcePanels(messageRoot)
        const panelsBeforeClick = new Map(beforePanelState.snapshots.map((snapshot) => [snapshot.node, snapshot]))
        expansion = { attempted: true, expanded: false, reason: '', panelsBefore: beforePanelState.snapshots.length, panelsAfter: 0, changedPanels: 0, selectedPanelFingerprint: '' }
        await activateSourceExpander(expander)
        await sleep(SOURCE_RETRY_MS)
        header = sourceHeaderInfo(answerNode)
        const panelState = openedSourcePanels(messageRoot, panelsBeforeClick)
        const panels = panelState.panels
        expansion.panelsAfter = panelState.snapshots.length
        expansion.changedPanels = panels.length
        expansion.selectedPanelFingerprint = panelState.snapshots.find((snapshot) => panels.includes(snapshot.node))?.fingerprint.slice(0, 240) || ''
        sourceScopes = [...new Set([...header.scopes, ...panels])]
        sources = extractSourcesFromScopes(sourceScopes)
        const lazyCapture = await captureLazyLoadedSources(sourceScopes, sources, header.declaredCount)
        sources = lazyCapture.sources
        expansion.expanded = panels.length > 0 || sources.length > 0
        expansion.scrolled = lazyCapture.scrolled
        if (!expansion.expanded) expansion.reason = '已尝试展开当前回答的页面来源，但未发现可读取的来源面板。'
      } else if (header.detected && allowExpansion) {
        expansion.reason = '当前回答未提供可安全展开的“参考资料”控件。'
      }
    }
    const lazyCapture = await captureLazyLoadedSources(sourceScopes, sources, header.declaredCount)
    sources = lazyCapture.sources
    if (lazyCapture.scrolled) expansion.scrolled = true
    // Some current Doubao sessions render the visible reference links directly after the
    // search header without a role/classed source panel. Preserve those page-visible URLs
    // as platform-search results rather than misclassifying them as answer citations.
    if (header.detected && !sources.some((item) => item.url)) {
      sources = mergeSourceLists(sources, inlinePlatformSourcesAfterHeader(answerNode, header))
    }
    const quotedKeywords = header.declaredKeywordCount
      ? searchKeywordsFromVisibleText([text(header.node), ...sourceScopes.map((scope) => text(scope)), text(messageRoot)], header.declaredKeywordCount)
      : []
    const keywords = header.declaredKeywordCount
      ? searchKeywordsFromScopes(sourceScopes, header.declaredKeywordCount, quotedKeywords)
      : []
    return {
      sources,
      sourceHeaderDetected: header.detected,
      declaredCount: header.declaredCount,
      declaredKeywordCount: header.declaredKeywordCount,
      keywords,
      headerText: header.headerText,
      expansion,
    }
  }

  async function report(task, payload) {
    const message = { type: 'geo-browser-agent/report', payload: { taskId: task.id, testRunId: task.testRunId || null, platform: task.platform || ADAPTER?.platform || null, ...payload } }
    let lastError = null
    // The background worker persists an accepted report before relaying it. A short client-side
    // retry prevents a transient service-worker wakeup from turning a completed GLM/Qwen answer
    // into a local watchdog timeout, while still keeping delivery bounded and diagnosable.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await send(message)
        if (result?.error) throw new Error(result.error)
        return result
      } catch (error) {
        lastError = error
        if (attempt < 2) await sleep(180 * (attempt + 1))
      }
    }
    throw new Error(`无法回传「${ADAPTER?.platform || task.platform || '当前平台'}」任务 ${task.id || '未知'} 的终态结果（${ADAPTER?.id || 'unknown-adapter'}）：${String(lastError?.message || lastError || '未知通信错误')}`)
  }
  async function taskStage(task, stage, detail = null) {
    // A diagnostic stage must never be allowed to block the customer-side page action.
    // MV3 workers can briefly wake/restart while a page is already holding a real task;
    // retain best-effort stage telemetry, but keep typing/sending independent from it.
    const payload = { taskId: task.id, platform: task.platform || ADAPTER?.platform || null, stage, ...(detail ? { detail: String(detail).slice(0, 500) } : {}), url: location.href }
    try {
      return await Promise.race([
        send({ type: 'geo-browser-agent/task-stage', payload }),
        new Promise((resolve) => setTimeout(() => resolve({ accepted: false, timedOut: true }), 1_800)),
      ])
    } catch (error) {
      console.warn('[GEO Browser Agent] task-stage delivery failed', stage, error)
      return { accepted: false, error: String(error?.message || error) }
    }
  }
  async function fallback(task, reason) {
    // A terminal fallback also advances the same-platform queue. Release this page-only
    // ownership before reporting so the next Query cannot race with a stale task id.
    releaseTask(task)
    await report(task, { status: 'needs-human', reason })
    // A page-level blocker needs operator intervention and pauses only this lane. A
    // task-scoped selector/write/capture miss is retained on that task, but the lane
    // stays online so later Query items can still run serially and independently.
    const textReason = String(reason || '')
    const status = /登录|login|sign in/i.test(textReason)
      ? 'needs_login'
      : /验证码|captcha|人机校验/i.test(textReason)
        ? 'attention'
        : 'online'
    await send({ type: 'geo-browser-agent/agent-status', payload: { status, reason: status === 'online' ? null : textReason, platform: ADAPTER?.platform || null, adapterId: ADAPTER?.id || null, adapterVersion: ADAPTER?.version || null } })
  }

  async function run(task) {
    if (!ADAPTER) return { accepted: false, reason: '当前网页未识别为已支持的平台，无法执行自动采集。' }
    if (!task || task.platform !== ADAPTER.platform) return { accepted: false, reason: '当前页面是「' + ADAPTER.platform + '」，不能执行「' + (task?.platform || '未指定') + '」任务；系统已阻止跨平台串任务。' }
    if (runningTaskId) return { accepted: false, reason: '当前已有任务正在执行。' }
    // Claim the page synchronously before emitting optional diagnostics so a duplicate
    // background retry can never start a second copy of the same real-web Query.
    runningTaskId = task.id
    await taskStage(task, 'received-task', '页面执行器已接收任务，开始检查页面状态。')
    if (hasCaptcha()) { await taskStage(task, 'fallback', '检测到验证码或人机校验。'); await fallback(task, '检测到验证码或人机校验，已停止自动操作。'); return { accepted: false, reason: '检测到验证码。' } }
    if (likelyLogin()) { await taskStage(task, 'fallback', '登录状态不可用。'); await fallback(task, ADAPTER.platform + ' 登录状态不可用，需要操作者手动登录。'); return { accepted: false, reason: '需要登录。' } }
    const input = getInput()
    if (!input) { await taskStage(task, 'fallback', '未识别到可见提问输入区。'); await fallback(task, `无法识别「${ADAPTER.platform}」当前页面的可见提问输入区域；页面可能已更新或尚未完成登录。诊断：${composerDiagnostic()}`); return { accepted: false, reason: '无法识别输入区域。' } }
    await taskStage(task, 'found-composer', `${input.tagName.toLowerCase()} 输入区已识别。`)
    try {
      await report(task, { status: 'running' })
      const beforeSend = responseSnapshot()
      const beforeConversation = conversationSnapshot()
      const beforeQuestionEchoes = questionEchoSnapshot(task.question)
      const questionWasVisibleBeforeSend = pageContainsQuestion(task.question)
      const writtenValue = inputValue(input, task.question)
      await sleep(INPUT_SETTLE_MS)
      if (hasCaptcha()) throw new Error('检测到验证码或人机校验，已停止自动操作。')
      await taskStage(task, 'query-written', `已写入 ${writtenValue.length} 个字符。`)
      if (!inputContainsQuestion(input, task.question)) {
        const descriptor = `${input.tagName.toLowerCase()}${input.getAttribute('placeholder') ? ` placeholder=${JSON.stringify(input.getAttribute('placeholder')).slice(0, 140)}` : ''}${input.getAttribute('data-testid') ? ` data-testid=${JSON.stringify(input.getAttribute('data-testid')).slice(0, 100)}` : ''}`
        throw new Error('「' + ADAPTER.platform + '」页面没有接受自动写入的 Query（已识别编辑器：' + descriptor + '；写入后长度：' + writtenValue.length + '）。页面输入区结构或编辑器状态可能已更新。为避免误发，系统没有点击发送按钮。诊断：' + composerDiagnostic(input, task.question))
      }
      const button = await waitForSendButton(input)
      // Some real-web clients (notably Kimi's current icon-only composer) do
      // not expose their submit control as a semantic button. When the Query is
      // confirmed in the currently detected composer, use that composer's normal
      // Enter path once rather than failing or clicking an unrelated page control.
      let fallbackSubmitAttempted = false
      await taskStage(task, 'submit-attempted', button && !disabled(button) ? '已尝试点击发送控件。' : '未识别可用发送控件，已尝试当前输入框的 Enter 发送。')
      if (button && !disabled(button)) {
        await activateSendButton(button)
      } else {
        fallbackSubmitAttempted = true
        fallbackSubmitFromComposer(input)
      }

      let previous = ''
      let stable = 0
      let captured = null
      let userAnchor = null
      let submissionConfirmed = false
      let captureComplete = false
      let lastHeartbeatAt = Date.now()
      for (let elapsed = 0; elapsed < MAX_CAPTURE_WAIT_MS; elapsed += POLL_DELAY_MS) {
        await sleep(POLL_DELAY_MS)
        if (Date.now() - lastHeartbeatAt >= TASK_HEARTBEAT_MS) {
          // The Agent recognizes this as a duplicate running report and only renews the
          // task lease. A terminal result remains bound to this exact task/platform.
          await report(task, { status: 'running' })
          lastHeartbeatAt = Date.now()
        }
        if (hasCaptcha()) throw new Error('检测到验证码或人机校验，已停止自动操作。')
        userAnchor ||= submittedUserAnchor(beforeConversation, beforeQuestionEchoes, task.question)
        const questionAppeared = pageContainsQuestion(task.question)
        const inputCleared = !inputContainsQuestion(input, task.question)
        const wasSubmissionConfirmed = submissionConfirmed
        submissionConfirmed ||= Boolean(userAnchor) || (!questionWasVisibleBeforeSend && questionAppeared) || inputCleared
        if (submissionConfirmed && !wasSubmissionConfirmed) await taskStage(task, 'submission-confirmed', '页面已出现当前问题或输入区已清空。')
        if (!fallbackSubmitAttempted && elapsed >= 1_500 && !submissionConfirmed && inputContainsQuestion(input, task.question)) {
          // Some controlled editors either consume a synthetic click or do not expose
          // the icon-only send control as a semantic button. Send one scoped Enter
          // fallback before declaring the adapter stale; never target document.body.
          fallbackSubmitAttempted = true
          fallbackSubmitFromComposer(input)
        }
        const answer = readNewAnswer(beforeSend, task.question, userAnchor, submissionConfirmed)
        if (!answer) continue
        if (!captured) await taskStage(task, 'answer-detected', `已识别当前回答，长度 ${answer.value.length}。`)
        captured = answer
        if (answer.normalized === previous) stable += 1
        else { previous = answer.normalized; stable = 0 }
        if (answerStillGenerating(answer.node)) {
          previous = answer.normalized
          stable = 0
          continue
        }
        const stablePollsRequired = ADAPTER?.id === 'deepseek-web'
          ? Math.max(8, STABLE_POLLS_REQUIRED)
          : ADAPTER?.id === 'glm-web'
            ? Math.max(9, STABLE_POLLS_REQUIRED)
            : STABLE_POLLS_REQUIRED
        if (stable >= stablePollsRequired) {
          captureComplete = true
          await taskStage(task, 'answer-stable', `当前回答已稳定，连续 ${stable} 次采样一致。`)
          break
        }
      }
      if (!captured?.value || !captureComplete) {
        const reason = !submissionConfirmed
          ? '页面未确认本次 Query 已作为新的用户消息提交。为避免复用上一轮回答或来源，任务已停止；请确认当前平台页面已出现本条提问后重试。'
          : captured?.value
            ? '当前页面仍显示搜索、思考或生成状态，或回答尚未达到稳定完成窗口。为避免截断本条回答并提前派发下一条 Query，任务已停止，需等待页面完成后重试。'
            : '未识别到当前 Query 的完成回答。为避免把用户提问或上一轮回答写入基线，任务已停止，需人工检查后重试。'
        throw new Error(reason + ' 诊断：' + composerDiagnostic(input, task.question) + qwenResponseStructureDiagnostic())
      }

      // Doubao renders web-search sources in a dedicated block before the answer body.
      // These are platform-grounding sources, not answer-body citations. Keep title-only
      // entries if the platform does not expose a navigable URL; never infer a URL.
      let sourceCapture = await platformSearchSources(captured.node)
      for (let attempt = 0; attempt < 4 && !sourceCapture.sources.length; attempt += 1) {
        await sleep(SOURCE_RETRY_MS)
        // Avoid toggling a previously opened source drawer closed on later retries.
        sourceCapture = await platformSearchSources(captured.node, { allowExpansion: false })
      }
      const searchSourceUrls = new Set(sourceCapture.sources.map((item) => item.url).filter(Boolean))
      const answerCitations = visibleLinks(captured.node).filter((item) => !searchSourceUrls.has(item.url))
      // Preserve every table that the customer can see in the current answer as Markdown.
      // Plain innerText keeps cell values but loses the row/column semantics needed for
      // enterprise evidence review, comparison and report export.
      const answerTableCapture = visibleTableCapture([captured.node])
      const capturedAnswer = appendVisibleTables(captured.value, answerTableCapture)
      // Keep actionable source evidence, while ensuring metadata stays under the API cap.
      const compactLink = (item, sourceType, position) => ({
        url: String(item?.url || '').slice(0, 2_000),
        title: String(item?.title || item?.visibleText || '').slice(0, EVIDENCE_TEXT_LIMIT),
        visibleText: String(item?.visibleText || item?.title || '').slice(0, EVIDENCE_TEXT_LIMIT),
        sourceType,
        position,
        urlAvailable: Boolean(item?.url),
        ...(item?.captureMethod ? { captureMethod: item.captureMethod } : {}),
      })
      const compactVisibleLinks = [
        ...answerCitations.slice(0, MAX_EVIDENCE_LINKS).map((item, index) => compactLink(item, 'answer-citation', index + 1)),
        ...sourceCapture.sources.slice(0, MAX_EVIDENCE_LINKS).map((item, index) => compactLink(item, 'platform-search-result', index + 1)),
      ]
      await taskStage(task, 'report-completed', '已整理回答、引用和表格证据，准备回传系统。')
      // report(completed) can cause the background worker to fetch and dispatch the next
      // Query immediately. Release only this task before the terminal relay so Qwen (and
      // every other serial platform) accepts that hand-off instead of rejecting it as busy.
      releaseTask(task)
      await report(task, { status: 'completed', evidence: {
        rawAnswer: capturedAnswer,
        citations: answerCitations.map((item) => item.url),
        answerUrl: location.href,
        observedAt: new Date().toISOString(),
        freshSession: true,
        searchEnabled: sourceCapture.sourceHeaderDetected,
        platformVersion: null,
        captureMetadata: {
          adapterId: ADAPTER.id,
          adapterVersion: ADAPTER.version,
          source: 'visible-dom-text',
          answerSelector: captured.node.className?.toString().slice(0, 180) || captured.node.tagName,
          answerCitationCount: answerCitations.length,
          answerTableCount: answerTableCapture.tables.length,
          answerTableMarkdownCount: answerTableCapture.markdownTables.length,
          platformSearchSourceCount: sourceCapture.sources.length,
          platformSearchSourceUrlCount: sourceCapture.sources.filter((item) => item.url).length,
          platformSearchDeclaredCount: sourceCapture.declaredCount,
          platformSearchDeclaredKeywordCount: sourceCapture.declaredKeywordCount,
          platformSearchKeywords: sourceCapture.keywords,
          platformSearchHeaderDetected: sourceCapture.sourceHeaderDetected,
          platformSearchHeaderText: sourceCapture.headerText,
          platformSearchExpansionAttempted: sourceCapture.expansion.attempted,
          platformSearchExpansionSucceeded: sourceCapture.expansion.expanded,
          platformSearchExpansionReason: sourceCapture.expansion.reason,
          platformSearchSourceListScrolled: sourceCapture.expansion.scrolled === true,
          platformSearchPanelBeforeCount: sourceCapture.expansion.panelsBefore ?? null,
          platformSearchPanelAfterCount: sourceCapture.expansion.panelsAfter ?? null,
          platformSearchChangedPanelCount: sourceCapture.expansion.changedPanels ?? null,
          platformSearchSelectedPanelFingerprint: sourceCapture.expansion.selectedPanelFingerprint || null,
          visibleLinks: compactVisibleLinks,
        },
      } })
      await send({ type: 'geo-browser-agent/agent-status', payload: { status: 'online', platform: ADAPTER.platform, adapterId: ADAPTER.id, adapterVersion: ADAPTER.version } })
      return { accepted: true }
    } catch (error) {
      await fallback(task, error instanceof Error ? error.message : '页面执行失败。')
      return { accepted: false, reason: String(error?.message || error) }
    } finally {
      releaseTask(task)
    }
  }

  // Report readiness only after the live platform renders a visible composer. The relay
  // version alone is not sufficient: Chromium can keep an older unpacked extension alive
  // until its dedicated agent browser is restarted, and document_idle can precede client
  // hydration on Kimi, DeepSeek and other SPA platforms.
  void announcePageReady()

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'geo-browser-agent/run') return false
    if (message?.task?.__geoProbe) {
      // A loaded content script is not enough to lease a real Query. SPA chat pages
      // frequently execute before their composer hydrates; report that state explicitly
      // so the background waits for announcePageReady() instead of claiming a task.
      const input = getInput()
      respond({ accepted: true, ready: Boolean(input), reason: input ? null : composerDiagnostic(), platform: ADAPTER?.platform || null, adapterId: ADAPTER?.id || null, adapterVersion: ADAPTER?.version || null, executorVersion: '0.3.25' })
      return false
    }
    if (runningTaskId) { respond({ accepted: false, reason: '当前已有任务正在执行。' }); return false }
    // Confirm hand-off immediately so the popup remains responsive. Execution progress and
    // failures are reported through the local Agent, not held open in a browser message channel.
    void run(message.task).catch(async (error) => {
      const reason = error instanceof Error ? error.message : '页面执行失败。'
      await send({ type: 'geo-browser-agent/agent-status', payload: { status: 'attention', reason, platform: ADAPTER?.platform || null, adapterId: ADAPTER?.id || null, adapterVersion: ADAPTER?.version || null } })
    })
    respond({ accepted: true, started: true })
    return false
  })
})()









