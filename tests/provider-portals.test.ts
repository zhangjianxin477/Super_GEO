import { describe, expect, it } from 'vitest'
import { providerPortalUrl } from '../src/providerPortals'

describe('controlled-manual provider handoff', () => {
  it.each([
    ['DeepSeek', 'https://chat.deepseek.com/'],
    ['通义千问', 'https://www.tongyi.com/'],
    ['豆包', 'https://www.doubao.com/chat/'],
    ['Kimi', 'https://kimi.moonshot.cn/'],
    ['元宝', 'https://yuanbao.tencent.com/'],
    ['GLM', 'https://chatglm.cn/main/alltoolsdetail?lang=zh'],
    ['文心一言', 'https://yiyan.baidu.com/'],
    ['ChatGPT', 'https://chatgpt.com/'],
    ['Gemini', 'https://gemini.google.com/'],
    ['Claude', 'https://claude.ai/'],
    ['Perplexity', 'https://www.perplexity.ai/'],
  ])('returns the official handoff URL for %s', (provider, url) => {
    expect(providerPortalUrl(provider)).toBe(url)
  })

  it('does not invent an external destination for an unknown provider', () => {
    expect(providerPortalUrl('未配置平台')).toBeUndefined()
  })
})
