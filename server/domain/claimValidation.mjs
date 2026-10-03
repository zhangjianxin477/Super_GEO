const claimRules = [
  { type: 'measurable-performance', patterns: [/\b\d+(?:[.,]\d+)?\s?%/i, /\b\d+(?:[.,]\d+)?x\b/i, /(?:提升|增长|降低|节省|改善)\s*\d+/] },
  { type: 'guarantee', patterns: [/\b(?:guarantee|guaranteed|always|never)\b/i, /(?:保证|必然|一定会|永远)/] },
  { type: 'ranking-or-citation', patterns: [/\b(?:number\s*1|top[- ]?ranked|rank\s*#?1|AI citations?)\b/i, /(?:第一|排名|被\s*AI\s*引用|保证引用)/i] },
]

const candidateLines = (markdown) => markdown
  .split(/\r?\n+/)
  .map((line) => line.replace(/^[-#*\s]+/, '').trim())
  .filter((line) => line.length >= 8 && !line.startsWith('Evidence links'))

export function detectDraftClaims(draft) {
  const candidates = []
  for (const statement of candidateLines(draft.contentMarkdown ?? '')) {
    if (/^(?:avoid|do not|don't|no\s+guarantee|不要|不得|避免|禁止)/i.test(statement)) continue
    for (const rule of claimRules) {
      if (rule.patterns.some((pattern) => pattern.test(statement))) {
        candidates.push({
          statement,
          claimType: rule.type,
          evidenceRefs: /\[Evidence:\s*[^\]]+\]/i.test(statement) ? draft.evidenceRefs ?? [] : [],
          status: /\[Evidence:\s*[^\]]+\]/i.test(statement) ? 'supported' : 'unresolved',
          detectorVersion: 'claim-coverage-v1',
        })
        break
      }
    }
  }
  return candidates
}

