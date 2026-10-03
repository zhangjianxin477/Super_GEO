import { calculateGeoMetrics } from './metrics.mjs'

const prohibitedOutcomeLanguage = /(?:guarantee(?:d)?|will cause|ensure(?:s|d)?\s+(?:a\s+)?(?:ranking|citation|mention|traffic|conversion)|guarantee(?:s|d)?\s+(?:a\s+)?(?:ranking|citation|mention)|保证(?:排名|引用|曝光|流量|转化)|确保(?:排名|引用|曝光|流量|转化))/i

export function assertNoGuaranteedOutcome(text) {
  if (prohibitedOutcomeLanguage.test(String(text ?? ''))) throw new Error('Reports and dashboards must not claim or imply guaranteed or causal GEO outcomes.')
}

export function metricDeltas(baselineMeasurement, followUpMeasurement) {
  const deltas = {}
  for (const key of Object.keys(followUpMeasurement.metrics)) {
    const baseline = baselineMeasurement.metrics[key]?.rate ?? null
    const followUp = followUpMeasurement.metrics[key]?.rate ?? null
    deltas[key] = { baseline, followUp, delta: baseline === null || followUp === null ? null : followUp - baseline, interpretation: 'Observed difference for the defined cohorts; not proof of causation or a future outcome.' }
  }
  return deltas
}

export function buildClientReport({ workspace, baselineRun, followUpRun, compatibility, baselineObservations, followUpObservations, marketPack, diagnoses = [], actions = [], includeImported = false }) {
  const baselineMeasurement = baselineRun ? calculateGeoMetrics(baselineObservations, { includeImported }) : null
  const followUpMeasurement = followUpRun ? calculateGeoMetrics(followUpObservations, { includeImported }) : null
  const selectedRun = followUpRun ?? baselineRun
  const selectedObservations = followUpRun ? followUpObservations : baselineObservations
  const incomplete = [baselineRun, followUpRun].filter(Boolean).filter((run) => !run.isComplete)
  const limitations = [
    ...(incomplete.length ? [`${incomplete.map((run) => run.label).join(', ')} is incomplete; queued, failed, or unavailable provider observations are disclosed and excluded according to metric eligibility rules.`] : []),
    ...(includeImported ? ['Controlled-manual imported observations were explicitly included; they remain distinct from direct completed evidence.'] : ['Controlled-manual imported observations are excluded from default metrics.']),
    'Observed differences are not proof that content, evidence, or distribution actions caused changes and do not guarantee future AI visibility, citations, rankings, traffic, leads, revenue, or conversion.',
  ]
  const report = {
    glossaryVersion: 'geo-intelligence-metrics-and-research-v1',
    scope: { workspace: workspace.name, brand: workspace.brand, marketPack: marketPack ? { id: marketPack.id, label: marketPack.label, market: marketPack.market, locale: marketPack.locale } : null, providers: selectedRun?.providers ?? [], queryCohort: selectedRun ? { datasetId: selectedRun.datasetId, datasetVersion: selectedRun.datasetVersion, queryIds: selectedRun.cohortQueryIds } : null },
    assessmentDates: { baselineCreatedAt: baselineRun?.createdAt ?? null, followUpCreatedAt: followUpRun?.createdAt ?? null },
    completeness: { baseline: baselineRun?.completion ?? null, followUp: followUpRun?.completion ?? null },
    compatibility: compatibility ?? null,
    metrics: { baseline: baselineMeasurement, followUp: followUpMeasurement, deltas: baselineMeasurement && followUpMeasurement ? metricDeltas(baselineMeasurement, followUpMeasurement) : null },
    evidenceExamples: selectedObservations.filter((item) => ['completed', 'imported'].includes(item.status)).slice(0, 3).map((item) => ({ observationId: item.id, queryId: item.queryId, providerId: item.providerId, citations: item.citations, analysis: item.analysis })),
    competitors: marketPack?.competitors ?? [],
    actions: actions.map((action) => ({ id: action.id, channel: action.channel, status: action.status, scheduledFor: action.scheduledFor, completedAt: action.completedAt, targetQueryIds: action.targetQueryIds })),
    recommendations: diagnoses.map((diagnosis) => ({ diagnosisId: diagnosis.id, priority: diagnosis.priority, category: diagnosis.category, recommendation: diagnosis.recommendation, uncertainty: diagnosis.uncertainty })),
    limitations,
    noGuaranteeStatement: 'All reported movement is observational for the defined cohort. This report does not assert causation or promise a future platform outcome.',
  }
  return { report, limitations }
}

