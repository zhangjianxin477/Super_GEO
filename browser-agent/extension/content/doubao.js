(() => {
  const ADAPTER = { id: 'doubao-web', version: '0.1.26', platform: '豆包' }
  const responseSelectors = [
    '[data-testid*="message"] .markdown-body', '[data-testid*="message"] [class*="markdown"]',
    '[class*="assistant"] [class*="markdown"]', '[class*="message"] [class*="markdown"]',
    '[class*="message-content"]', '[class*="messageContent"]', '[class*="answer"]', 'main [class*="markdown"]',
  ]
  const inputSelectors = [
    'textarea', '[data-slate-editor="true"]', '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
  ]
  const sourceSelectors = 'a[href], [role="link"], [role="button"], button, [data-url], [data-href], [data-target], [data-redirect-url], [data-link], [class*="source"], [class*="reference"], [class*="citation"]'
  const sourceHeaderPattern = /(?:搜索\s*\d+\s*个关键词[\s\S]{0,120}?参考\s*\d+\s*篇资料|参考\s*\d+\s*篇资料|搜索结果|参考资料)/
  const captchaSelectors = ['iframe[src*="captcha"]', '[class*="captcha"]', '[class*="verify"]', '[id*="captcha"]']
  const blockedActionPattern = /语音|录音|voice|audio|更多|more|上传|upload|图片|image|附件|attach|停止|stop|取消|cancel|清空|clear/i
  const sendActionPattern = /发送|send|submit|发送消息|发送问题/i
  const testTiming = globalThis.__GEO_BROWSER_AGENT_TEST_TIMING__ || {}
  const timingValue = (name, fallback, minimum = 1) => Number.isFinite(testTiming[name]) ? Math.max(minimum, Math.floor(testTiming[name])) : fallback
  const INPUT_SETTLE_MS = timingValue('inputSettleMs', 320)
  const POLL_DELAY_MS = timingValue('pollDelayMs', 1_500)
  const STABLE_POLLS_REQUIRED = timingValue('stablePollsRequired', 4)
  const SOURCE_RETRY_MS = timingValue('sourceRetryMs', 750)
  const MAX_CAPTURE_WAIT_MS = timingValue('maxCaptureWaitMs', 140_000)
  const MAX_EVIDENCE_LINKS = 30
  const EVIDENCE_TEXT_LIMIT = 180
  let runningTaskId = null

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
    return /登录|立即登录|扫码登录|Sign in|Log in/i.test(page) && !inputSelectors.some((selector) => document.querySelector(selector))
  }
  function visible(node) {
    const rect = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none'
  }
  function disabled(node) { return Boolean(node.disabled) || node.getAttribute('aria-disabled') === 'true' }
  function getInput() { return inputSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]).find(visible) || null }

  function inputValue(input, value) {
    input.focus({ preventScroll: true })
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set
      setter?.call(input, value)
    } else {
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(input)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
      input.textContent = value
      input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }))
    }
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }))
  }

  function nearbyActionButton(input) {
    const inputRect = input.getBoundingClientRect()
    const candidates = [...document.querySelectorAll('button, [role="button"]')]
      .filter((node) => visible(node) && !disabled(node))
      .map((node) => ({ node, label: selectorValues(node), rect: node.getBoundingClientRect() }))
      .filter(({ label }) => !blockedActionPattern.test(label))
    const explicit = candidates.find(({ label }) => sendActionPattern.test(label))
    if (explicit) return explicit.node
    // Current Doubao versions use an icon-only submit action. Once text has been entered,
    // it is the actionable control at the right edge of the visible composer.
    const rightEdge = candidates
      .filter(({ rect }) => rect.right >= inputRect.right - 180 && rect.top <= inputRect.bottom + 20 && rect.bottom >= inputRect.top - 20)
      .sort((a, b) => (b.rect.right - a.rect.right) || (a.rect.top - b.rect.top))
    return rightEdge[0]?.node || null
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

  function responseNodes() {
    const seen = new Set()
    const values = []
    for (const selector of responseSelectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (seen.has(node) || !visible(node)) continue
        const value = text(node)
        if (value.length < 20) continue
        seen.add(node)
        values.push({ node, value, normalized: normalize(value) })
      }
    }
    // Prefer the smallest matching text node when broad and narrow selectors overlap.
    const compact = values.filter((candidate) => !values.some((other) => other.node !== candidate.node
      && candidate.node.contains(other.node) && normalize(candidate.value) === normalize(other.value)))
    return compact.sort((left, right) => compareDocumentOrder(left.node, right.node))
  }

  function responseSnapshot() {
    const nodes = responseNodes()
    return { nodes: new Set(nodes.map((item) => item.node)), texts: new Set(nodes.map((item) => item.normalized)) }
  }

  function messageRoots() {
    const roots = []
    const seen = new Set()
    for (const node of document.querySelectorAll('article, [data-message-role], [data-role], [data-author-role], [data-testid*="message"], [class*="message"]')) {
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
      const hints = [
        current.getAttribute?.('data-message-role'), current.getAttribute?.('data-role'), current.getAttribute?.('data-author-role'),
        current.getAttribute?.('aria-label'), current.className?.toString?.(),
      ].filter(Boolean).join(' ').toLowerCase()
      if (/(?:^|[\s_-])(user|human)(?:$|[\s_-])|用户|提问者/.test(hints)) return 'user'
      if (/(?:^|[\s_-])(assistant|bot|model|ai)(?:$|[\s_-])|助手|豆包|回答/.test(hints)) return 'assistant'
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
    const threshold = Math.max(80, normalize(question).length + 42)
    const candidates = responseNodes().filter((candidate) => {
      const hasNewNode = !snapshot.nodes.has(candidate.node)
      const hasNewText = !snapshot.texts.has(candidate.normalized)
      const boundToThisSubmission = userAnchor ? isAfterMessage(candidate, userAnchor) : submissionConfirmed
      return (hasNewNode || hasNewText)
        && candidate.normalized.length >= threshold
        && messageRole(candidate.node) !== 'user'
        && boundToThisSubmission
        && !looksLikeQuestionEcho(candidate.value, question)
    })
    const assistantCandidates = candidates.filter((candidate) => messageRole(candidate.node) === 'assistant')
    return (assistantCandidates.length ? assistantCandidates : candidates).at(-1) || null
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
        for (const key of ['url', 'href', 'target', 'target_url', 'redirect', 'redirect_url', 'source_url', 'link']) {
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

  function normalizedHref(node) {
    const values = [
      node?.getAttribute?.('href'), node?.href, node?.getAttribute?.('data-href'), node?.getAttribute?.('data-url'),
      node?.getAttribute?.('data-target'), node?.getAttribute?.('data-redirect-url'), node?.getAttribute?.('data-link'),
      node?.getAttribute?.('url'), node?.getAttribute?.('target-url'),
    ]
    for (const attribute of node?.getAttributeNames?.() || []) values.push(node.getAttribute(attribute))
    for (const datasetValue of Object.values(node?.dataset || {})) values.push(datasetValue)
    const descendant = node?.querySelector?.('a[href], [data-url], [data-href], [data-target], [data-redirect-url], [data-link]')
    if (descendant && descendant !== node) {
      for (const attribute of descendant.getAttributeNames?.() || []) values.push(descendant.getAttribute(attribute))
    }
    for (const value of values) {
      const url = urlCandidate(value)
      if (url) return url
    }
    return ''
  }

  function visibleLinks(scope) {
    const seen = new Set()
    const selectors = 'a[href], [data-url], [data-href], [data-target], [data-redirect-url], [data-link]'
    return [...scope.querySelectorAll(selectors)].filter(visible).map((node) => {
      const url = normalizedHref(node)
      if (!url || seen.has(url)) return null
      seen.add(url)
      const label = text(node) || node.getAttribute?.('aria-label') || node.getAttribute?.('title') || ''
      return { url, title: label.slice(0, 320), visibleText: label.slice(0, 320) }
    }).filter(Boolean).slice(0, 50)
  }

  function messageRootFor(answerNode) {
    let node = answerNode
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      // messageRole() deliberately searches ancestors, so only use it once we are on a
      // message-shaped container. Otherwise an inner markdown node would hide its siblings.
      if (node.matches?.('article, [data-testid*="message"], [class*="message"]') && messageRole(node) === 'assistant') return node
      if (['MAIN', 'BODY', 'HTML'].includes(node.tagName)) break
    }
    return answerNode
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
    if (/(?:https?:\/\/|www\.|\.com\b|\.cn\b|来源|资料|参考)/i.test(phrase)) return ''
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
      if (/source|reference|citation|资料|来源/i.test(label) || scope.querySelector(sourceSelectors)) return scope
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
    const previousSibling = messageRoot.previousElementSibling
    const siblingCanCarrySources = previousSibling
      && messageRole(previousSibling) !== 'assistant'
      && sourceHeaderPattern.test(text(previousSibling))
    const candidates = currentCandidates.length
      ? currentCandidates
      : siblingCanCarrySources ? sourceHeaderCandidates(previousSibling) : []
    candidates.sort((left, right) => left.value.length - right.value.length)
    const selected = candidates[0]
    if (!selected) return { node: null, scopes: [], detected: false, declaredCount: 0, declaredKeywordCount: 0, keywords: [], headerText: '' }
    const countMatch = selected.value.match(/参考\s*(\d+)\s*篇资料/)
    const keywordCountMatch = selected.value.match(/搜索\s*(\d+)\s*个关键词/)
    const scopes = [...new Set(candidates.map((candidate) => candidate.scope))]
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

  function extractSourcesFromScopes(scopes) {
    const sources = []
    const seen = new Set()
    for (const scope of scopes) {
      if (!scope || !visible(scope)) continue
      for (const node of scope.querySelectorAll(sourceSelectors)) {
        if (!visible(node)) continue
        const visibleText = text(node).slice(0, 320)
        if (visibleText.length < 2 || looksLikeSourceHeader(visibleText) || !sourceNodeHasSignal(node, scope)) continue
        const url = normalizedHref(node)
        // A generic internal page action (for example a sidebar button) is not a source.
        // Preserve title-only items only inside an actual source/reference region.
        if (url && !isExternalSourceUrl(url) && !/source|reference|citation|资料|来源/i.test(selectorValues(node))) continue
        if (!url && !/source|reference|citation|资料|来源/i.test(`${selectorValues(node)} ${selectorValues(scope)}`)) continue
        const key = `${url || normalize(visibleText)}`
        if (!key || seen.has(key)) continue
        seen.add(key)
        sources.push({
          url,
          title: visibleText,
          visibleText,
          sourceType: 'platform-search-result',
          position: sources.length + 1,
          urlAvailable: Boolean(url),
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
      const nodes = [scope, ...scope.querySelectorAll('[role="dialog"], [role="listbox"], [class*="popover"], [class*="drawer"], [class*="modal"], [class*="source"], [class*="reference"], [class*="citation"]')]
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
    return /^搜索\s*\d+\s*个关键词\s*[，,]?\s*参考\s*\d+\s*篇资料\s*[>›〉⌄⌃∨^]?$/.test(String(value || '').trim())
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
      const sourceAction = label.length < 220 && /(搜索\s*\d+\s*个关键词[\s\S]{0,60}参考\s*\d+\s*篇资料|参考\s*\d+\s*篇资料|查看.{0,12}(资料|来源)|展开.{0,12}(资料|来源)|资料来源|搜索来源)/.test(label)
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
    const urls = [...panel.querySelectorAll('a[href], [data-url], [data-href], [data-target]')]
      .map((node) => normalizedHref(node))
      .filter((url) => isExternalSourceUrl(url))
      .sort()
    const value = normalize(text(panel)).slice(0, 8_000)
    return { node: panel, urls, fingerprint: `${value}|${urls.join('|')}` }
  }

  function openedSourcePanels(messageRoot, previousPanels = new Map()) {
    const panels = []
    const snapshots = []
    const selectors = '[role="dialog"], [role="listbox"], [data-state="open"], [class*="popover"], [class*="drawer"], [class*="modal"], [class*="source"], [class*="reference"], [class*="citation"]'
    for (const panel of document.querySelectorAll(selectors)) {
      if (!visible(panel) || isSameOrContained(panel, messageRoot)) continue
      const value = text(panel)
      if (!value || value.length > 12_000) continue
      const hasExternalLink = [...panel.querySelectorAll('a[href], [data-url], [data-href], [data-target]')]
        .some((node) => isExternalSourceUrl(normalizedHref(node)))
      const hasSourceSignal = /source|reference|citation|资料|来源/i.test(selectorValues(panel))
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

  async function report(task, payload) { return send({ type: 'geo-browser-agent/report', payload: { taskId: task.id, testRunId: task.testRunId || null, ...payload } }) }
  async function fallback(task, reason) {
    await report(task, { status: 'needs-human', reason })
    runningTaskId = null
    const status = /登录|login|sign in/i.test(String(reason)) ? 'needs_login' : 'attention'
    await send({ type: 'geo-browser-agent/agent-status', payload: { status, reason } })
  }

  async function run(task) {
    if (!task || task.platform !== '豆包') return { accepted: false, reason: '该扩展仅支持豆包任务。' }
    if (runningTaskId) return { accepted: false, reason: '当前已有任务正在执行。' }
    if (hasCaptcha()) { await fallback(task, '检测到验证码或人机校验，已停止自动操作。'); return { accepted: false, reason: '检测到验证码。' } }
    if (likelyLogin()) { await fallback(task, '豆包登录状态不可用，需要操作者手动登录。'); return { accepted: false, reason: '需要登录。' } }
    const input = getInput()
    if (!input) { await fallback(task, '无法识别可见的提问输入区域；页面可能已更新。'); return { accepted: false, reason: '无法识别输入区域。' } }
    runningTaskId = task.id
    try {
      await report(task, { status: 'running' })
      const beforeSend = responseSnapshot()
      const beforeConversation = conversationSnapshot()
      const beforeQuestionEchoes = questionEchoSnapshot(task.question)
      const questionWasVisibleBeforeSend = pageContainsQuestion(task.question)
      inputValue(input, task.question)
      await sleep(INPUT_SETTLE_MS)
      if (hasCaptcha()) throw new Error('检测到验证码或人机校验，已停止自动操作。')
      const button = await waitForSendButton(input)
      if (!button) throw new Error('已填入 Query，但无法识别可用的发送按钮；页面可能已更新。')
      if (disabled(button)) throw new Error('Query 已填入，但发送按钮仍不可用，请检查页面状态。')
      button.click()

      let previous = ''
      let stable = 0
      let captured = null
      let userAnchor = null
      let submissionConfirmed = false
      for (let elapsed = 0; elapsed < MAX_CAPTURE_WAIT_MS; elapsed += POLL_DELAY_MS) {
        await sleep(POLL_DELAY_MS)
        if (hasCaptcha()) throw new Error('检测到验证码或人机校验，已停止自动操作。')
        userAnchor ||= submittedUserAnchor(beforeConversation, beforeQuestionEchoes, task.question)
        const questionAppeared = pageContainsQuestion(task.question)
        const inputCleared = !inputContainsQuestion(input, task.question)
        submissionConfirmed ||= Boolean(userAnchor) || (!questionWasVisibleBeforeSend && questionAppeared) || inputCleared
        const answer = readNewAnswer(beforeSend, task.question, userAnchor, submissionConfirmed)
        if (!answer) continue
        captured = answer
        if (answer.normalized === previous) stable += 1
        else { previous = answer.normalized; stable = 0 }
        if (stable >= STABLE_POLLS_REQUIRED) break
      }
      if (!captured?.value) {
        const reason = userAnchor
          ? '未识别到当前 Query 的完成回答。为避免把用户提问或上一轮回答写入基线，任务已停止，需人工检查后重试。'
          : '页面未确认本次 Query 已作为新的用户消息提交。为避免复用上一轮回答或来源，任务已停止；请确认豆包页面已出现本条提问后重试。'
        throw new Error(reason)
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
      await report(task, { status: 'completed', evidence: {
        rawAnswer: captured.value,
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
      await send({ type: 'geo-browser-agent/agent-status', payload: { status: 'online' } })
      return { accepted: true }
    } catch (error) {
      await fallback(task, error instanceof Error ? error.message : '页面执行失败。')
      return { accepted: false, reason: String(error?.message || error) }
    } finally {
      runningTaskId = null
    }
  }

  // Report the content-script build that is actually executing. The relay version alone
  // is not sufficient: Chromium can keep an older unpacked extension alive until its
  // dedicated agent browser is restarted.
  void send({ type: 'geo-browser-agent/agent-status', payload: {
    status: 'online',
    adapterId: ADAPTER.id,
    adapterVersion: ADAPTER.version,
  } })

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'geo-browser-agent/run') return false
    if (runningTaskId) { respond({ accepted: false, reason: '当前已有任务正在执行。' }); return false }
    // Confirm hand-off immediately so the popup remains responsive. Execution progress and
    // failures are reported through the local Agent, not held open in a browser message channel.
    void run(message.task).catch(async (error) => {
      const reason = error instanceof Error ? error.message : '页面执行失败。'
      await send({ type: 'geo-browser-agent/agent-status', payload: { status: 'attention', reason } })
    })
    respond({ accepted: true, started: true })
    return false
  })
})()


