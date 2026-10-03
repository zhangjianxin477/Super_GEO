const fabricatedReviewPatterns = [
  /\b(?:fake|fabricated|invented|purchased)\s+(?:customer\s+)?reviews?\b/i,
  /(?:伪造|虚假|刷)\s*(?:用户)?(?:评价|评论|测评|好评)/,
]
const fabricatedCitationPatterns = [
  /\b(?:fake|fabricated|invented)\s+(?:citations?|sources?|references?)\b/i,
  /(?:伪造|虚构|编造)\s*(?:引用|来源|参考资料)/,
]
const deceptiveLinkPatterns = [
  /\b(?:link\s*farm|hidden\s+links?|deceptive\s+link(?:ing)?|buy\s+backlinks?)\b/i,
  /(?:链接农场|隐藏链接|欺骗性链接|购买外链|黑帽外链)/,
]
const unreviewedPublicationPatterns = [
  /\b(?:auto(?:mate|matic)?|bulk|mass)\s+(?:public(?:ation|ly\s+publish)|publish(?:ing)?|distribution)\b/i,
  /(?:自动|批量|大规模)\s*(?:公开)?(?:发布|投放|分发)(?:内容)?/,
]

const guardrails = [
  {
    code: 'fabricated-review',
    explanation: 'Fabricated or purchased reviews are prohibited. Use attributable, authentic customer evidence and a human review process instead.',
    patterns: fabricatedReviewPatterns,
  },
  {
    code: 'fabricated-citation',
    explanation: 'Fabricated citations or sources are prohibited. Use only verifiable, source-linked evidence.',
    patterns: fabricatedCitationPatterns,
  },
  {
    code: 'deceptive-link-scheme',
    explanation: 'Deceptive link schemes are prohibited. Use transparent, editorially appropriate distribution with attributable links only.',
    patterns: deceptiveLinkPatterns,
  },
  {
    code: 'unreviewed-mass-publication',
    explanation: 'Automatic or mass public publication without review is prohibited. Create a reviewer-approved human distribution task instead.',
    patterns: unreviewedPublicationPatterns,
  },
]

const policyOnlyPrefix = /^(?:do\s+not|don't|avoid|never|prohibit(?:ed)?|禁止|不得|不要|避免)/i

export function evaluateEthicalRequest(inputs = []) {
  for (const input of inputs) {
    if (typeof input !== 'string' || !input.trim()) continue
    for (const line of input.split(/\r?\n|[。.!?]+/).map((value) => value.trim()).filter(Boolean)) {
      if (policyOnlyPrefix.test(line)) continue
      const guardrail = guardrails.find((candidate) => candidate.patterns.some((pattern) => pattern.test(line)))
      if (guardrail) return { ...guardrail, input: line }
    }
  }
  return null
}

export const ethicalGuardrails = Object.freeze(guardrails.map(({ code, explanation }) => ({ code, explanation })))
