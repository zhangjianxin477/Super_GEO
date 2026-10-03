const defaultProhibitedClaims = [
  'Do not claim guaranteed AI-platform mentions, citations, recommendations, rankings, traffic, or conversion outcomes.',
  'Do not invent customer reviews, third-party citations, integrations, benchmarks, or performance results.',
  'Do not present unsupported product capabilities as facts.',
]

const defaultOutlines = {
  faq: ['Direct answer to the target Query', 'How to evaluate the answer', 'Evidence-backed explanation', 'Limits and items to verify', 'Related questions and sources'],
  'use-case': ['Who this workflow is for', 'The problem behind the target Query', 'Evidence-backed approach', 'Implementation boundary', 'Next step for the reader'],
  'comparison-page': ['Who should use this comparison', 'Decision criteria from the Query evidence', 'Evidence-backed capability context', 'Where alternatives may fit', 'Transparent recommendation boundary'],
  'case-study': ['Customer context supported by evidence', 'Problem framing', 'Verified implementation facts', 'Observed outcomes with sources', 'Limits and next step'],
  editorial: ['Direct answer and reader context', 'What the Query evidence shows', 'A practical decision framework', 'What to verify before acting', 'Sources and limitations'],
  'website-page': ['Audience and problem statement', 'Direct answer to the target Query', 'Evidence-backed capabilities and workflow', 'FAQ from the captured questions', 'Responsible next step'],
}

const unique = (items) => [...new Set(items.filter(Boolean))]

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function buildWritingTask({ writingTask, marketPack, queries, queryEvidence, channel, contentType }) {
  const primaryQuery = text(queryEvidence?.question, queries[0]?.text ?? 'the selected buyer question')
  return {
    primaryQuery,
    audience: text(writingTask?.audience, marketPack.audience),
    objective: text(writingTask?.objective, 'Address the selected Query with an evidence-grounded, decision-useful answer.'),
    funnelStage: text(writingTask?.funnelStage, 'consideration'),
    cta: text(writingTask?.cta, 'Invite a human-led evaluation without promising visibility or outcomes.'),
    channel: text(writingTask?.channel, channel),
    format: text(writingTask?.format, contentType),
    customInstruction: text(writingTask?.customInstruction),
  }
}

function buildOutline(contentType, task, queryEvidence) {
  const base = defaultOutlines[contentType] ?? defaultOutlines.editorial
  const evidenceLine = queryEvidence?.competitorInsights?.length
    ? 'Competitor evidence gap and response strategy'
    : 'Evidence coverage and source boundary'
  return unique([
    base[0],
    `Answer the Query: ${task.primaryQuery}`,
    ...base.slice(1, -1),
    evidenceLine,
    base.at(-1),
  ])
}

export function buildContentBrief({ diagnosis, evidencePack, marketPack, queries, channel, contentType, title, writingTask = {}, queryEvidence = null }) {
  const relevantFacts = evidencePack.items
    .filter((item) => ['brand-identity', 'product-capability', 'customer-segment', 'use-case', 'case-study', 'comparison', 'policy'].includes(item.taxonomy))
    .map((item) => ({ evidenceId: item.id, title: item.title, statement: item.excerpt, sourceRef: item.sourceRef, taxonomy: item.taxonomy }))
  const prohibitedClaims = unique([
    ...defaultProhibitedClaims,
    ...evidencePack.items.filter((item) => item.taxonomy === 'prohibited-claim').map((item) => item.excerpt),
  ])
  const competitorContext = marketPack.competitors.map((competitor) => ({ name: competitor, treatment: 'Use only factual, attributable comparison language. Do not fabricate weaknesses or reviews.' }))
  const task = buildWritingTask({ writingTask, marketPack, queries, queryEvidence, channel, contentType })
  const queryEvidenceContext = queryEvidence ? {
    queryGroupId: queryEvidence.queryGroupId,
    question: queryEvidence.question,
    approvedAnswerCount: queryEvidence.approvedAnswerCount,
    platforms: queryEvidence.platforms ?? [],
    modelAnswers: queryEvidence.modelAnswers ?? [],
    competitorLinks: queryEvidence.competitorLinks ?? [],
    competitorInsights: queryEvidence.competitorInsights ?? [],
    evidenceBoundary: 'Only reviewed real-model answers and approved link occurrences are included. Captured but unreviewed evidence is excluded from model input.',
  } : null
  const sourceLinks = unique([
    ...relevantFacts.map((fact) => fact.sourceRef),
    ...(queryEvidenceContext?.competitorLinks ?? []).map((link) => link.url),
  ])
  const brief = {
    title,
    marketPack: {
      id: marketPack.id,
      logicalKey: marketPack.logicalKey,
      version: marketPack.version,
      market: marketPack.market,
      locale: marketPack.locale,
      audience: marketPack.audience,
    },
    evidencePack: { id: evidencePack.id, version: evidencePack.version, approvedAt: evidencePack.approvedAt },
    market: marketPack.market,
    locale: marketPack.locale,
    channel,
    contentType,
    diagnosis: { id: diagnosis.id, title: diagnosis.title, category: diagnosis.category, detail: diagnosis.detail, uncertainty: diagnosis.uncertainty },
    contentTask: task,
    targetQueries: queries.map((query) => ({ id: query.id, text: query.text, intent: query.intent, priority: query.priority, expectedFacts: query.expectedFacts })),
    queryEvidence: queryEvidenceContext,
    mandatoryFacts: relevantFacts,
    sourceLinks,
    prohibitedClaims,
    competitorContext,
    outline: buildOutline(contentType, task, queryEvidenceContext),
    reviewCriteria: [
      'The content begins by answering the selected primary Query in language useful to the declared reader.',
      'Every material product claim is traceable to the selected evidence-pack version.',
      'Any competitor interpretation is attributable to the selected reviewed Query evidence or analysed page source.',
      'No prohibited, absolute, deceptive, or unsupported performance claim remains.',
      'The content serves the declared locale, channel, buyer intent, CTA, and funnel stage.',
      'A human reviewer approves before client delivery or distribution-task creation.',
    ],
    successMeasures: [
      'Observed mention, recommendation, and citation movement in a compatible later cohort.',
      'Factual-accuracy rate and evidence coverage for the target query cohort.',
      'No causality or ranking guarantee is asserted.',
    ],
    generationBoundary: 'This is an AI-ready structured brief. Any model-generated draft is provisional and requires human review.',
  }
  const prompt = {
    templateVersion: 'content-brief-v2-task-evidence',
    system: 'You are an enterprise B2B GEO content strategist. Produce evidence-grounded content planning only. Use no facts outside the supplied approved evidence. Start from the selected Query, reader, objective, and content task. Do not promise AI citations, rankings, recommendations, traffic, or business outcomes. Return a reviewable plan with multiple angles, a recommended outline, evidence use, open questions, and measurement limitations.',
    input: brief,
    expectedOutput: 'A localized content task brief that preserves Query evidence, approved source links, prohibited claims, review criteria, and measurement limitations.',
  }
  return { brief, prompt }
}
