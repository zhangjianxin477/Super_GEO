export const AGENT_VERSION = '0.3.25'

/**
 * Only platforms listed here can be launched or dispatched by the customer-side
 * Browser Agent. API connections are deliberately not used as GEO baselines.
 */
export const PLATFORM_ADAPTERS = Object.freeze([
  Object.freeze({
    platform: '豆包',
    id: 'doubao-web',
    homepage: 'https://www.doubao.com/chat/',
    hostPatterns: Object.freeze(['https://www.doubao.com/*']),
    hostnames: Object.freeze(['www.doubao.com']),
  }),
  Object.freeze({
    platform: '元宝',
    id: 'yuanbao-web',
    homepage: 'https://yuanbao.tencent.com/chat/',
    hostPatterns: Object.freeze(['https://yuanbao.tencent.com/*']),
    hostnames: Object.freeze(['yuanbao.tencent.com']),
  }),
  Object.freeze({
    platform: 'DeepSeek',
    id: 'deepseek-web',
    homepage: 'https://chat.deepseek.com/',
    hostPatterns: Object.freeze(['https://chat.deepseek.com/*']),
    hostnames: Object.freeze(['chat.deepseek.com']),
  }),
  Object.freeze({
    platform: '通义千问',
    id: 'qwen-web',
    // The adapter only runs against the customer's visible, logged-in Qwen web surface.
    // Keep legacy/redirect hosts explicit so a valid customer session is not misidentified.
    homepage: 'https://www.qianwen.com/',
    hostPatterns: Object.freeze(['https://www.qianwen.com/*', 'https://qianwen.com/*', 'https://tongyi.aliyun.com/*']),
    hostnames: Object.freeze(['www.qianwen.com', 'qianwen.com', 'tongyi.aliyun.com']),
  }),
  Object.freeze({
    platform: '智谱清言（GLM）',
    id: 'glm-web',
    homepage: 'https://chatglm.cn/',
    hostPatterns: Object.freeze(['https://chatglm.cn/*', 'https://chat.z.ai/*']),
    hostnames: Object.freeze(['chatglm.cn', 'chat.z.ai']),
  }),
  Object.freeze({
    platform: 'Kimi',
    id: 'kimi-web',
    homepage: 'https://www.kimi.com/',
    hostPatterns: Object.freeze(['https://kimi.com/*', 'https://www.kimi.com/*', 'https://kimi.moonshot.cn/*']),
    hostnames: Object.freeze(['kimi.com', 'www.kimi.com', 'kimi.moonshot.cn']),
  }),
])

export const supportedPlatforms = Object.freeze(PLATFORM_ADAPTERS.map((adapter) => adapter.platform))
export const supportedAdapters = Object.freeze(PLATFORM_ADAPTERS.map(({ id, platform }) => ({ id, platform, version: AGENT_VERSION })))
export const manifestHostPatterns = Object.freeze(PLATFORM_ADAPTERS.flatMap((adapter) => adapter.hostPatterns))

export function adapterForPlatform(platform) {
  return PLATFORM_ADAPTERS.find((adapter) => adapter.platform === platform) || null
}

export function adapterForHostname(hostname) {
  const normalized = String(hostname || '').toLowerCase()
  return PLATFORM_ADAPTERS.find((adapter) => adapter.hostnames.includes(normalized)) || null
}

export function adapterForUrl(value) {
  try { return adapterForHostname(new URL(value).hostname) } catch { return null }
}

export function adapterMatchesUrl(adapter, value) {
  return Boolean(adapter && adapterForUrl(value)?.id === adapter.id)
}





