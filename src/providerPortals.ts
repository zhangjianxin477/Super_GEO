/**
 * Official web entry points for providers supported by the controlled-manual
 * collection workflow. These links only hand the operator off to the provider;
 * this application never signs in, submits a prompt, reads a reply, or publishes.
 */
const providerPortals: Record<string, string> = {
  DeepSeek: 'https://chat.deepseek.com/',
  '通义千问': 'https://www.tongyi.com/',
  豆包: 'https://www.doubao.com/chat/',
  Kimi: 'https://kimi.moonshot.cn/',
  元宝: 'https://yuanbao.tencent.com/',
  GLM: 'https://chatglm.cn/main/alltoolsdetail?lang=zh',
  文心一言: 'https://yiyan.baidu.com/',
  ChatGPT: 'https://chatgpt.com/',
  Gemini: 'https://gemini.google.com/',
  Claude: 'https://claude.ai/',
  Perplexity: 'https://www.perplexity.ai/',
}

export function providerPortalUrl(providerId: string): string | undefined {
  return providerPortals[providerId]
}
