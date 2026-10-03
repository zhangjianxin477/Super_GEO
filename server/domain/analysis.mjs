const recommendationPattern = /(?:推荐|建议|适合|首选|值得考虑|recommend(?:ed|ation)?|best|top choice|consider)/i
const riskyClaimPattern = /(?:保证|百分之百|100%|永远|always|guarantee(?:d)?|never)/i
const negativeEvidencePattern = /(?:不支持|不提供|不具备|禁止|不得|不可|does not|doesn't|not available|not supported|prohibited|do not)/i
const sentenceBoundary = /(?<=[。！？.!?])\s+/u
const urlPattern = /https?:\/\/[^\s)\]}>]+/gi
const genericTerms = new Set(['tool', 'tools', 'product', 'products', 'platform', 'solution', 'system', 'knowledge', 'workspace', 'team', 'teams', '企业', '团队', '产品', '工具', '平台', '系统', '方案', '知识库'])

function contains(text, candidate) {
  return Boolean(candidate) && String(text ?? '').toLocaleLowerCase().includes(String(candidate).toLocaleLowerCase())
}

function normalizeTerms(text) {
  return [...new Set((String(text ?? '').toLocaleLowerCase().match(/[a-z][a-z0-9-]{2,}|[\u4e00-\u9fff]{2,}/g) ?? [])
    .map((term) => term.trim()).filter((term) => term.length > 1 && !genericTerms.has(term)))]
}

function relativeListPosition(answer, brand) {
  const lines = String(answer ?? '').split(/\r?\n/)
  for (const line of lines) {
    if (!contains(line, brand)) continue
    const match = line.match(/^\s*(\d{1,2})[.)、]/)
    if (match) return Number(match[1])
  }
  return null
}

function sentenceForCitation(answer, citation) {
  const url = citation?.url ?? ''
  const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } })()
  const directMatch = String(answer ?? '').match(urlPattern)?.find((value) => value.includes(url) || (domain && value.includes(domain)))
  if (!directMatch && !domain) return null
  return String(answer ?? '').split(sentenceBoundary).find((sentence) => sentence.includes(directMatch ?? domain)) ?? null
}

function evidenceIndex(items) {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    taxonomy: item.taxonomy,
    sourceRef: item.sourceRef,
    terms: normalizeTerms(`${item.title ?? ''} ${item.excerpt ?? ''}`),
    negative: item.taxonomy === 'prohibited-claim' || negativeEvidencePattern.test(`${item.title ?? ''} ${item.excerpt ?? ''}`),
  }))
}

function assessClaim(statement, brand, indexedEvidence) {
  const terms = normalizeTerms(statement).filter((term) => !contains(brand, term) && !contains(term, brand))
  const matchingEvidence = indexedEvidence.map((item) => ({ ...item, matchedTerms: item.terms.filter((term) => terms.includes(term)) }))
    .filter((item) => item.matchedTerms.length > 0)
  const evidenceRefs = matchingEvidence.map((item) => ({ id: item.id, title: item.title, sourceRef: item.sourceRef, matchedTerms: item.matchedTerms }))
  const conflict = matchingEvidence.find((item) => item.negative && item.matchedTerms.length > 0)
  if (conflict) return {
    statement, assessment: 'conflicting', evidenceRefs,
    rationale: `The claim conflicts with approved evidence item “${conflict.title}”.`,
  }
  if (riskyClaimPattern.test(statement)) return {
    statement, assessment: 'unsupported', evidenceRefs,
    rationale: 'Contains an absolute or guarantee-style claim that is not supported by the approved evidence policy.',
  }
  const supported = matchingEvidence.find((item) => item.matchedTerms.length >= 2) ?? (matchingEvidence.length >= 2 ? matchingEvidence[0] : null)
  if (supported) return {
    statement, assessment: 'supported', evidenceRefs,
    rationale: `Matched approved evidence item “${supported.title}” on substantive product terms.`,
  }
  if (terms.length >= 2) return {
    statement, assessment: 'unsupported', evidenceRefs,
    rationale: 'The answer makes a product-specific claim without enough support in the selected approved evidence pack.',
  }
  return {
    statement, assessment: 'insufficient-evidence', evidenceRefs,
    rationale: 'The deterministic analyzer could not establish enough approved-evidence context for this general statement.',
  }
}

export function analyzeAnswer({ answer, brand, competitors = [], evidenceItems = [], citations = [] }) {
  const normalized = String(answer ?? '')
  const sentences = normalized.split(sentenceBoundary).filter(Boolean)
  const brandMentioned = contains(normalized, brand)
  const competitorsMentioned = competitors.filter((name) => contains(normalized, name))
  const recommendationContext = recommendationPattern.test(normalized)
  const competitorsRecommended = recommendationContext ? competitorsMentioned : []
  const indexedEvidence = evidenceIndex(evidenceItems)
  const claims = sentences.filter((sentence) => contains(sentence, brand)).map((statement) => assessClaim(statement, brand, indexedEvidence))
  const citationContexts = citations.map((citation) => ({
    url: citation.url,
    kind: citation.kind ?? 'unknown',
    context: sentenceForCitation(normalized, citation),
  }))
  return {
    brandMentioned,
    brandOmitted: !brandMentioned,
    recommended: brandMentioned && recommendationContext,
    recommendationContext,
    relativePosition: brandMentioned ? relativeListPosition(normalized, brand) : null,
    competitorsMentioned,
    competitorsRecommended,
    citationContexts,
    risk: claims.some((claim) => ['unsupported', 'conflicting'].includes(claim.assessment)) ? 'high' : claims.some((claim) => claim.assessment === 'insufficient-evidence') ? 'medium' : 'none',
    claims,
    method: 'deterministic-evidence-baseline-v2',
    limitations: 'Deterministic, evidence-grounded baseline analysis. It cannot infer hidden ranking logic, sentiment, or causality; reviewer validation remains required for nuanced claims and recommendation context.',
  }
}
