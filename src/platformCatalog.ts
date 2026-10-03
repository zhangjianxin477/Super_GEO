export type GeoMarketPack = 'CN' | 'US'

/**
 * The supported GEO surface catalog. Presence here means the platform is in the
 * market measurement scope; it does not imply that a particular test batch ran
 * successfully or that it produced an answer.
 */
export const REAL_PLATFORM_CATALOG: Record<GeoMarketPack, readonly string[]> = {
  CN: ['DeepSeek', '通义千问', '豆包', 'Kimi', '元宝', '智谱清言（GLM）', '文心一言'],
  US: ['ChatGPT', 'Gemini', 'Claude', 'Perplexity'],
}

export function platformsForMarket(marketPack: GeoMarketPack) {
  return [...REAL_PLATFORM_CATALOG[marketPack]]
}
