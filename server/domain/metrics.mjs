const rate = (observationIds, denominator, extra = {}) => ({ numerator: observationIds.length, denominator, rate: denominator ? observationIds.length / denominator : null, observationIds, ...extra })
const assessmentStates = new Set(['supported', 'unsupported', 'conflicting', 'insufficient-evidence'])

export function calculateGeoMetrics(observations, { includeImported = false } = {}) {
  const statusCounts = { queued: 0, completed: 0, failed: 0, imported: 0 }
  const eligible = []
  let excludedImported = 0

  for (const observation of observations) {
    statusCounts[observation.status] = (statusCounts[observation.status] ?? 0) + 1
    if (observation.status === 'completed' || (includeImported && observation.status === 'imported')) eligible.push(observation)
    if (observation.status === 'imported' && !includeImported) excludedImported += 1
  }

  const denominator = eligible.length
  const ids = (predicate) => eligible.filter(predicate).map((item) => item.id)
  const mentionIds = ids((item) => item.analysis?.brandMentioned)
  const recommendationIds = ids((item) => item.analysis?.recommended)
  const ownedCitationIds = ids((item) => (item.citations ?? []).some((citation) => citation.kind === 'owned'))
  const thirdPartyCitationIds = ids((item) => (item.citations ?? []).some((citation) => citation.kind === 'third-party'))
  const assessedClaims = eligible.flatMap((item) => (item.analysis?.claims ?? []).filter((claim) => assessmentStates.has(claim.assessment)).map((claim) => ({ ...claim, observationId: item.id })))
  const supportedClaimIds = [...new Set(assessedClaims.filter((claim) => claim.assessment === 'supported').map((claim) => claim.observationId))]
  const competitorRecommendedIds = ids((item) => (item.analysis?.competitorsRecommended ?? []).length > 0)
  const competitorGap = competitorRecommendedIds.length - recommendationIds.length

  return {
    eligibleObservationCount: denominator,
    statusCounts,
    exclusions: { queued: statusCounts.queued, failed: statusCounts.failed, imported: excludedImported, importedIncluded: includeImported },
    metrics: {
      mentionRate: rate(mentionIds, denominator),
      recommendationRate: rate(recommendationIds, denominator),
      ownedSourceCitationRate: rate(ownedCitationIds, denominator),
      thirdPartyCitationRate: rate(thirdPartyCitationIds, denominator),
      factualAccuracyRate: { numerator: assessedClaims.filter((claim) => claim.assessment === 'supported').length, denominator: assessedClaims.length, rate: assessedClaims.length ? assessedClaims.filter((claim) => claim.assessment === 'supported').length / assessedClaims.length : null, observationIds: supportedClaimIds },
      competitorVisibilityGap: { numerator: competitorGap, denominator, rate: denominator ? competitorGap / denominator : null, observationIds: competitorRecommendedIds, comparatorObservationIds: recommendationIds },
    },
  }
}
