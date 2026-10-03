const fallbackSections = ({ brief, question, facts, competitors }) => {
  const outline = Array.isArray(brief.outline) && brief.outline.length ? brief.outline : ['Direct answer', 'Evidence-backed explanation', 'Sources and limitations']
  return outline.map((heading, index) => {
    if (index === 0) return [heading, `Answer the selected buyer question directly: ${question}. Keep the answer within the approved evidence boundary.`]
    if (/evidence|capabilit|approach|事实|能力/i.test(heading)) return [heading, facts]
    if (/competitor|alternative|gap|对比|竞品/i.test(heading)) return [heading, competitors]
    if (/source|limit|boundary|验证|限制/i.test(heading)) return [heading, 'State what the selected sources support, what remains uncertain, and what the reader should verify directly.']
    if (/next step|CTA|下一步/i.test(heading)) return [heading, brief.contentTask?.cta || 'Invite a human-led evaluation without promising AI visibility, rankings, or commercial outcomes.']
    return [heading, `Develop this section for ${brief.contentTask?.audience || 'the declared reader'} using only the approved facts, Query evidence, and linked sources.`]
  })
}

export const supportedContentTypes = Object.freeze(['website-page', 'faq', 'use-case', 'comparison-page', 'case-study', 'editorial'])

const toFactBlock = (facts) => facts
  .map((fact) => `${fact.statement} [Evidence: ${fact.sourceRef}]`)
  .join('\n\n')

const renderMarkdown = ({ title, sections, sourceLinks }) => [
  `# ${title}`,
  ...sections.flatMap((section) => [`## ${section.heading}`, section.body]),
  '## Evidence links',
  ...sourceLinks.map((source) => `- ${source}`),
].join('\n\n')

export function buildContentDraft({ sourceBrief, logicalKey, title }) {
  const brief = sourceBrief.brief
  const facts = (brief.mandatoryFacts ?? []).slice(0, 8)
  const factBlock = toFactBlock(facts)
  const question = brief.contentTask?.primaryQuery ?? brief.targetQueries?.[0]?.text ?? 'the selected buyer question'
  const competitors = brief.competitorContext?.length
    ? brief.competitorContext.map((entry) => `${entry.name}: ${entry.treatment}`).join('\n\n')
    : 'No configured competitor context is available for this brief.'
  const sections = fallbackSections({ brief, facts: factBlock, question, competitors })
    .map(([heading, body]) => ({ heading, body, evidenceRefs: facts.map((fact) => fact.evidenceId) }))
  const draft = {
    title,
    logicalKey,
    sourceBrief: { id: sourceBrief.id, version: sourceBrief.version, title: sourceBrief.title },
    locale: sourceBrief.locale,
    channel: sourceBrief.channel,
    contentType: sourceBrief.contentType,
    contentTask: brief.contentTask ?? null,
    queryEvidence: brief.queryEvidence ?? null,
    evidencePack: { id: sourceBrief.evidencePackId, version: sourceBrief.evidencePackVersion },
    evidenceRefs: facts.map((fact) => fact.evidenceId),
    sourceLinks: brief.sourceLinks ?? [],
    prohibitedClaims: brief.prohibitedClaims ?? [],
    sections,
    contentMarkdown: renderMarkdown({ title, sections, sourceLinks: brief.sourceLinks ?? [] }),
    generationBoundary: 'Template fallback only. It is evidence-bound, not published content, and requires human review.',
  }
  const prompt = {
    templateVersion: 'content-draft-template-v2-task-evidence',
    system: 'You are an enterprise B2B content drafting assistant. Use only the source brief and linked evidence. The selected content task, Query evidence, and approved competitor links are part of the source brief. Do not invent metrics, customer stories, product capabilities, citations, competitor claims, or outcome guarantees. Return a localized structured draft with evidence references for every material claim.',
    input: { sourceBrief: brief, requestedTitle: title, logicalKey },
    expectedOutput: 'A channel-specific draft preserving the selected Query, writing task, evidence references, prohibited claims, and human-review boundary.',
  }
  return { draft, prompt }
}
