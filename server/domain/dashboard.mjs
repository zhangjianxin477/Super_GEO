import { calculateGeoMetrics } from './metrics.mjs'
import { metricDeltas } from './reporting.mjs'

const compactObservation = (observation) => ({
  id: observation.id,
  queryId: observation.queryId,
  providerId: observation.providerId,
  modelIdentity: observation.modelIdentity,
  status: observation.status,
  collectedAt: observation.collectedAt,
  sourceRef: observation.sourceRef,
  rawArtifactId: observation.rawArtifactId,
  citations: observation.citations ?? [],
  analysis: observation.analysis ?? {},
  error: observation.error ?? null,
})

function providerCoverage(run, observations) {
  return run.providers.map((providerId) => {
    const items = observations.filter((item) => item.providerId === providerId)
    const byStatus = Object.fromEntries(['queued', 'claimed', 'completed', 'imported', 'failed', 'unavailable', 'timed-out'].map((status) => [status, items.filter((item) => item.status === status).length]))
    return { providerId, expected: run.cohortQueryIds.length, observed: items.length, byStatus }
  })
}

function findLinkedActions({ distributionTasks, contentBriefs, contentDrafts, diagnoses, run }) {
  const queryIds = new Set(run.cohortQueryIds)
  const diagnosisById = new Map(diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]))
  const briefById = new Map(contentBriefs.map((brief) => [brief.id, brief]))
  return distributionTasks
    .filter((task) => task.targetQueryIds.some((queryId) => queryIds.has(queryId)))
    .map((task) => {
      const draft = contentDrafts.find((item) => item.id === task.contentDraftId) ?? null
      const brief = draft ? briefById.get(draft.sourceBriefId) ?? null : null
      const diagnosis = brief ? diagnosisById.get(brief.diagnosisId) ?? null : null
      return {
        ...task,
        draft: draft ? { id: draft.id, title: draft.title, status: draft.status } : null,
        brief: brief ? { id: brief.id, title: brief.title, status: brief.status, channel: brief.channel, targetQueryIds: brief.brief.targetQueryIds ?? task.targetQueryIds } : null,
        diagnosis: diagnosis ? { id: diagnosis.id, title: diagnosis.title, priority: diagnosis.priority, recommendation: diagnosis.recommendation } : null,
      }
    })
}

export function buildDashboardReadModel({ workspace, marketPack, runs, selectedRun, baselineRun, observations, baselineObservations, dataset, diagnoses, distributionTasks, contentBriefs, contentDrafts, reports, competitorResearch, workflowReadiness }) {
  const includeImported = true
  const measurement = selectedRun ? calculateGeoMetrics(observations, { includeImported }) : null
  const baselineMeasurement = baselineRun ? calculateGeoMetrics(baselineObservations, { includeImported }) : null
  const compatibility = baselineRun && selectedRun
    ? {
        comparable: baselineRun.marketPackId === selectedRun.marketPackId
          && baselineRun.locale === selectedRun.locale
          && baselineRun.datasetId === selectedRun.datasetId
          && baselineRun.datasetVersion === selectedRun.datasetVersion
          && JSON.stringify([...baselineRun.cohortQueryIds].sort()) === JSON.stringify([...selectedRun.cohortQueryIds].sort())
          && JSON.stringify([...baselineRun.providers].sort()) === JSON.stringify([...selectedRun.providers].sort()),
        baselineRunId: baselineRun.id,
        followUpRunId: selectedRun.id,
      }
    : null
  if (compatibility && !compatibility.comparable) {
    compatibility.reason = '基线与当前评估的市场、语言、查询队列、队列版本或提供方范围不一致，因此不可作为增量结论。'
  }
  const comparison = compatibility?.comparable
    ? { ...compatibility, deltas: metricDeltas(baselineMeasurement, measurement), interpretation: '仅呈现同一可比范围内的观测差异，不构成因果证明或未来结果承诺。' }
    : compatibility
  const scopedDiagnoses = selectedRun ? diagnoses.filter((item) => item.assessmentRunId === selectedRun.id) : []
  const linkedActions = selectedRun ? findLinkedActions({ distributionTasks, contentBriefs, contentDrafts, diagnoses: scopedDiagnoses, run: selectedRun }) : []
  const observationSummaries = observations.map(compactObservation)
  const limitations = [
    '当前 MVP 仅支持受控人工导入/录入，不会自动调用模型、抓取网站或自动发布内容。',
    ...(selectedRun && !selectedRun.isComplete ? [selectedRun.completion.incompleteReason] : []),
    ...(compatibility && !compatibility.comparable ? [compatibility.reason] : []),
    '指标反映已保留证据在指定查询、市场、语言和提供方范围内的观测结果；不保证 AI 提及、引用、排名、流量、线索或收入。',
  ]
  return {
    schemaVersion: 'live-geo-dashboard-v1',
    collectionBoundary: 'Controlled-manual model-answer imports only. No provider execution, site scraping, or public posting occurs through this dashboard.',
    workspace: { id: workspace.id, name: workspace.name, brand: workspace.brand },
    marketPack,
    context: {
      selectedRun: selectedRun ?? null,
      baselineRun: baselineRun ?? null,
      availableRuns: runs.map((run) => ({ id: run.id, label: run.label, status: run.status, createdAt: run.createdAt, isComplete: run.isComplete, datasetVersion: run.datasetVersion, locale: run.locale })),
      dataset: dataset ?? null,
    },
    measurement,
    completeness: selectedRun ? { ...selectedRun.completion, isComplete: selectedRun.isComplete, providerCoverage: providerCoverage(selectedRun, observations) } : null,
    comparison,
    diagnoses: scopedDiagnoses,
    actions: linkedActions,
    evidence: { observationCount: observationSummaries.length, observations: observationSummaries },
    competitorResearch: competitorResearch.map((item) => ({ id: item.id, sourceRef: item.sourceRef, sourceType: item.sourceType, findings: item.findings, collectedAt: item.collectedAt, extractionStatus: item.extractionStatus })),
    reports: reports.filter((report) => !selectedRun || report.followUpRunId === selectedRun.id || report.baselineRunId === selectedRun.id),
    workflowReadiness,
    limitations,
  }
}
