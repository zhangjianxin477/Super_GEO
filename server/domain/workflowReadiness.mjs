const compactRef = (item, fields = []) => {
  if (!item) return null
  return Object.fromEntries(fields.map((field) => [field, item[field]]))
}

const matchingApprovedDatasets = (datasets, marketPack) => datasets
  .filter((dataset) => dataset.status === 'approved' && dataset.queries.length > 0)
  .filter((dataset) => dataset.queries.every((query) => query.market === marketPack.market && query.locale === marketPack.locale))

const configuredProviderSummary = (provider) => ({
  id: provider.id,
  providerId: provider.providerId,
  collectionMode: provider.collectionMode,
  status: provider.status,
  version: provider.version,
  updatedAt: provider.updatedAt,
})

export function buildWorkflowReadiness({ marketPack, evidencePack, datasets, providerConfigurations, assessmentRun = null, diagnoses = [], contentBriefs = [] }) {
  const approvedDatasets = matchingApprovedDatasets(datasets, marketPack)
  const selectedDataset = assessmentRun
    ? datasets.find((dataset) => dataset.id === assessmentRun.datasetId) ?? null
    : approvedDatasets[0] ?? null
  const configuredByProvider = new Map(providerConfigurations
    .filter((provider) => provider.market === marketPack.market && provider.locale === marketPack.locale)
    .filter((provider) => provider.status === 'configured' && provider.collectionMode === 'controlled-manual')
    .map((provider) => [provider.providerId, provider]))
  const configuredProviders = marketPack.providers
    .map((providerId) => configuredByProvider.get(providerId))
    .filter(Boolean)
    .map(configuredProviderSummary)
  const missingProviderIds = marketPack.providers.filter((providerId) => !configuredByProvider.has(providerId))
  const evidenceReady = Boolean(evidencePack && evidencePack.status === 'approved' && evidencePack.version === marketPack.evidencePackVersion)
  const marketPackReady = marketPack.status === 'approved'
  const datasetReadyForNewRun = Boolean(selectedDataset && selectedDataset.status === 'approved' && selectedDataset.queries.length > 0 && selectedDataset.queries.every((query) => query.market === marketPack.market && query.locale === marketPack.locale))
  const providersReady = missingProviderIds.length === 0
  const readyForNewAssessment = marketPackReady && evidenceReady && datasetReadyForNewRun && providersReady
  const matchingDiagnoses = assessmentRun
    ? diagnoses.filter((diagnosis) => diagnosis.assessmentRunId === assessmentRun.id && diagnosis.evidencePackId === marketPack.evidencePackId && diagnosis.evidencePackVersion === marketPack.evidencePackVersion)
    : []
  const diagnosisIds = new Set(matchingDiagnoses.map((diagnosis) => diagnosis.id))
  const traceableBriefs = contentBriefs.filter((brief) => (
    brief.marketPackId === marketPack.id
    && brief.evidencePackId === marketPack.evidencePackId
    && brief.evidencePackVersion === marketPack.evidencePackVersion
    && diagnosisIds.has(brief.diagnosisId)
  ))
  const runMatchesMarketPack = Boolean(assessmentRun && assessmentRun.marketPackId === marketPack.id && assessmentRun.locale === marketPack.locale)
  const runComplete = Boolean(assessmentRun && runMatchesMarketPack && assessmentRun.isComplete)
  const readyForDiagnosis = Boolean(runComplete && evidenceReady)
  const readyForContentBrief = Boolean(readyForDiagnosis && matchingDiagnoses.length > 0)

  let stage = 'setup-blocked'
  let nextAllowedOperation = 'resolve-setup-blockers'
  let blockingReasons = []
  if (assessmentRun) {
    if (!runMatchesMarketPack) {
      blockingReasons = ['The selected assessment run belongs to another market pack or locale.']
    } else if (!evidenceReady) {
      blockingReasons = ['The market pack must reference its current approved evidence-pack version before diagnosis or brief work can proceed.']
    } else if (!runComplete) {
      stage = 'collection-in-progress'
      nextAllowedOperation = 'complete-or-resume-controlled-manual-observations'
      blockingReasons = [assessmentRun.completion.incompleteReason]
    } else if (!matchingDiagnoses.length) {
      stage = 'diagnosis-ready'
      nextAllowedOperation = 'generate-evidence-grounded-diagnoses'
    } else {
      stage = 'content-brief-ready'
      nextAllowedOperation = 'create-evidence-grounded-content-brief'
    }
  } else if (!readyForNewAssessment) {
    if (!marketPackReady) blockingReasons.push('The selected market pack must be approved before controlled-manual operations can begin.')
    if (!evidenceReady) blockingReasons.push('The market pack must reference its current approved evidence-pack version.')
    if (!datasetReadyForNewRun) blockingReasons.push('An approved query dataset containing only this market and locale is required.')
    if (!providersReady) blockingReasons.push(`Configure controlled-manual collection for: ${missingProviderIds.join(', ')}.`)
  } else {
    stage = 'assessment-ready'
    nextAllowedOperation = 'create-controlled-manual-assessment'
  }

  return {
    schemaVersion: 'market-pack-workflow-readiness-v1',
    collectionBoundary: 'Controlled-manual model-answer imports only. This endpoint reports retained workflow state and never executes providers, scrapes sites, or publishes content.',
    marketPack: compactRef(marketPack, ['id', 'logicalKey', 'label', 'version', 'status', 'market', 'locale', 'audience', 'channels', 'evidencePackId', 'evidencePackVersion']),
    stage,
    ready: stage === 'assessment-ready' || stage === 'diagnosis-ready' || stage === 'content-brief-ready',
    nextAllowedOperation,
    blockingReasons,
    readiness: {
      readyForNewAssessment,
      readyForDiagnosis,
      readyForContentBrief,
    },
    evidencePack: evidencePack ? { ...compactRef(evidencePack, ['id', 'version', 'status', 'approvedAt']), matchesMarketPackVersion: evidenceReady } : null,
    dataset: selectedDataset ? { ...compactRef(selectedDataset, ['id', 'logicalKey', 'label', 'version', 'status', 'approvedAt']), queryCount: selectedDataset.queries.length, matchesMarketAndLocale: selectedDataset.queries.every((query) => query.market === marketPack.market && query.locale === marketPack.locale) } : null,
    eligibleApprovedDatasetIds: approvedDatasets.map((dataset) => dataset.id),
    providers: {
      expectedProviderIds: marketPack.providers,
      configuredProviders,
      missingProviderIds,
      collectionMode: 'controlled-manual',
    },
    assessmentRun: assessmentRun ? {
      ...compactRef(assessmentRun, ['id', 'label', 'datasetId', 'datasetVersion', 'marketPackId', 'locale', 'providers', 'status', 'createdAt']),
      matchesMarketPack: runMatchesMarketPack,
      expectedObservationCount: assessmentRun.plannedObservationCount,
      completion: assessmentRun.completion,
    } : null,
    diagnoses: {
      generatedCount: matchingDiagnoses.length,
      ids: matchingDiagnoses.map((diagnosis) => diagnosis.id),
      evidenceVersionMatchesMarketPack: matchingDiagnoses.every((diagnosis) => diagnosis.evidencePackId === marketPack.evidencePackId && diagnosis.evidencePackVersion === marketPack.evidencePackVersion),
    },
    contentBriefs: {
      traceableCount: traceableBriefs.length,
      ids: traceableBriefs.map((brief) => brief.id),
      allowedChannels: marketPack.channels,
    },
  }
}
