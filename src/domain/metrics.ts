import type { AssessmentRun, Citation, Query, Workspace } from './models'

export interface GeoMetrics {
  eligible: number
  completed: number
  mentionRate: number
  recommendationRate: number
  ownedCitationRate: number
  thirdPartyCitationRate: number
  factualAccuracyRate: number
  competitorVisibilityGap: number
  exclusions: number
}

const percentage = (value: number, denominator: number) => denominator === 0 ? 0 : Math.round((value / denominator) * 100)

export function calculateMetrics(run: AssessmentRun, workspace: Workspace): GeoMetrics {
  const eligible = run.observations.filter((item) => item.status === 'completed' || item.status === 'imported')
  const mention = eligible.filter((item) => item.brandMentioned).length
  const recommended = eligible.filter((item) => item.recommended).length
  const owned = eligible.filter((item) => item.citations.some((citation) => citation.kind === 'owned')).length
  const thirdParty = eligible.filter((item) => item.citations.some((citation) => citation.kind === 'third-party')).length
  const supported = eligible.flatMap((item) => item.claims).filter((claim) => claim.assessment === 'supported').length
  const assessed = eligible.flatMap((item) => item.claims).filter((claim) => claim.assessment !== 'insufficient-evidence').length
  const competitorAppears = eligible.filter((item) => item.competitorsMentioned.length > 0).length

  return {
    eligible: eligible.length,
    completed: run.observations.filter((item) => item.status === 'completed').length,
    mentionRate: percentage(mention, eligible.length),
    recommendationRate: percentage(recommended, eligible.length),
    ownedCitationRate: percentage(owned, eligible.length),
    thirdPartyCitationRate: percentage(thirdParty, eligible.length),
    factualAccuracyRate: percentage(supported, assessed),
    competitorVisibilityGap: percentage(competitorAppears, eligible.length) - percentage(mention, eligible.length),
    exclusions: run.observations.length - eligible.length,
  }
}

export function isComparable(baseline: AssessmentRun, followUp: AssessmentRun): boolean {
  return baseline.datasetId === followUp.datasetId &&
    baseline.datasetVersion === followUp.datasetVersion &&
    baseline.marketPackId === followUp.marketPackId
}

export function classifyCitation(url: string, ownedDomains: string[]): Citation['kind'] {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return ownedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`)) ? 'owned' : 'third-party'
  } catch {
    return 'unknown'
  }
}

export function queryById(workspace: Workspace, queryId: string): Query | undefined {
  return workspace.datasets.flatMap((dataset) => dataset.queries).find((query) => query.id === queryId)
}
