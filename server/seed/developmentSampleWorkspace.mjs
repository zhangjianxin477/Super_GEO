import { randomUUID } from 'node:crypto'

function artifact(repository, artifacts, workspaceId, actorId, kind, payload) {
  const stored = artifacts.putJson(workspaceId, kind, randomUUID(), payload)
  return repository.createArtifactRecord({ workspaceId, actorId, kind, storageKey: stored.key, checksum: stored.checksum })
}

export function createDevelopmentSampleWorkspace({ repository, artifacts }) {
  const administrator = { id: 'sample-admin', name: '开发示例管理员' }
  const workspace = repository.createWorkspace({
    name: '示例：GEO 增长工作台',
    brand: 'Northstar KB',
    products: ['企业 AI 知识库'],
    administrator,
    configuration: {
      brandNames: ['Northstar KB'], products: ['企业 AI 知识库'],
      customerSegments: ['出海 SaaS 团队', '企业知识库负责人', 'AI 产品负责人'],
      operatingMarkets: ['CN', 'GLOBAL'], locales: ['zh-CN', 'en-US'],
      approvedWebsites: ['https://example.com'], competitors: ['Notion', 'Guru'],
      approvedClaims: ['支持知识图谱上下文与来源可追溯回答。'], prohibitedClaims: ['保证 AI 平台引用或排名。'],
    },
  })
  const actorId = administrator.id
  const projectDetail = repository.createBrandDiagnosticCase({
    workspaceId: workspace.id,
    actorId,
    input: {
      name: 'Northstar KB GEO 内容工作台示例',
      brandName: 'Northstar KB',
      website: 'https://example.com',
      markets: ['CN', 'GLOBAL'],
      locales: ['zh-CN', 'en-US'],
      audiences: ['出海 SaaS 团队', '企业知识库负责人', 'AI 产品负责人'],
      objective: '验证企业 AI 知识库在真实 AI 平台的可见度与来源引用覆盖。',
      ownerId: actorId,
    },
  })
  const projectId = projectDetail.project.id
  const evidencePack = repository.createEvidencePack({ workspaceId: workspace.id, actorId, status: 'approved', items: [
    { title: '产品能力事实', excerpt: '支持知识图谱上下文与来源可追溯回答，供企业团队审核。', taxonomy: 'product-capability', sourceType: 'manual', sourceRef: 'sample://facts/capability', status: 'approved' },
    { title: '适用人群事实', excerpt: '面向 B2B 团队的企业知识库管理与问答。', taxonomy: 'customer-segment', sourceType: 'manual', sourceRef: 'sample://facts/audience', status: 'approved' },
  ] })
  for (const providerId of ['DeepSeek', '通义千问']) repository.upsertModelProviderConfiguration({ workspaceId: workspace.id, actorId, providerId, market: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual', status: 'configured' })
  for (const providerId of ['ChatGPT', 'Perplexity']) repository.upsertModelProviderConfiguration({ workspaceId: workspace.id, actorId, providerId, market: 'GLOBAL', locale: 'en-US', collectionMode: 'controlled-manual', status: 'configured' })
  const cnDataset = repository.createDataset({ workspaceId: workspace.id, actorId, logicalKey: 'sample-cn-query-cohort', label: '中国市场：知识库工具类查询', status: 'approved', queries: [
    { text: '有哪些支持知识图谱、来源可追溯的 AI 知识库工具？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'knowledge-lead', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: '企业 AI 知识库', expectedFacts: ['知识图谱上下文', '来源可追溯回答'] },
    { text: '适合 B2B 团队的 AI 知识库需要具备哪些可追溯能力？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'ai-product-lead', businessStage: 'evaluate', intent: 'scenario', priority: 'P1', targetProduct: '企业 AI 知识库', expectedFacts: ['引用来源', '审核治理'] },
  ] })
  const globalDataset = repository.createDataset({ workspaceId: workspace.id, actorId, logicalKey: 'sample-global-query-cohort', label: '海外市场：B2B 知识库工具类查询', status: 'approved', queries: [
    { text: 'What AI knowledge base tools provide knowledge-graph context and source-cited answers for B2B teams?', market: 'GLOBAL', locale: 'en-US', language: 'en', userRole: 'knowledge-lead', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'B2B AI knowledge base', expectedFacts: ['knowledge graph context', 'source-cited answers'] },
  ] })
  const cnMarket = repository.createMarketPack({ workspaceId: workspace.id, actorId, logicalKey: 'sample-cn-market', label: '中国市场 / 中文', status: 'approved', market: 'CN', locale: 'zh-CN', audience: '出海 SaaS 团队、企业知识库负责人、AI 产品负责人', competitors: ['Notion', 'Guru'], providers: ['DeepSeek', '通义千问'], channels: ['官网内容中心', '知乎', '微信公众号', '掘金'], evidencePackId: evidencePack.id })
  const globalMarket = repository.createMarketPack({ workspaceId: workspace.id, actorId, logicalKey: 'sample-global-market', label: '海外市场 / en-US', status: 'approved', market: 'GLOBAL', locale: 'en-US', audience: 'Cross-border SaaS and B2B AI teams', competitors: ['Notion', 'Guru'], providers: ['ChatGPT', 'Perplexity'], channels: ['Blog', 'Help Center', 'Comparison Page', 'Medium', 'LinkedIn'], evidencePackId: evidencePack.id })
  const cnRun = repository.createAssessmentRun({ workspaceId: workspace.id, actorId, label: '示例基线：2026-09 受控人工导入', datasetId: cnDataset.id, marketPackId: cnMarket.id, locale: 'zh-CN', providers: cnMarket.providers, queryIds: cnDataset.queries.map((query) => query.id) })
  const globalRun = repository.createAssessmentRun({ workspaceId: workspace.id, actorId, label: '示例全球基线：2026-09 受控人工导入', datasetId: globalDataset.id, marketPackId: globalMarket.id, locale: 'en-US', providers: globalMarket.providers, queryIds: globalDataset.queries.map((query) => query.id) })
  const importEvidence = (run, query, providerId, modelIdentity, answer, analysis, citations) => {
    const raw = artifact(repository, artifacts, workspace.id, actorId, 'raw-model-answer', { rawAnswer: answer, citations, retainedAt: new Date().toISOString(), collectionMode: 'controlled-manual' })
    const support = artifact(repository, artifacts, workspace.id, actorId, 'manual-import-provenance', { sourceRef: 'sample://controlled-manual/' + providerId, operator: administrator.name, providerId, modelIdentity, query: query.text, collectionMode: 'controlled-manual' })
    const observation = repository.importObservation({ workspaceId: workspace.id, actorId, assessmentRunId: run.id, queryId: query.id, providerId, modelIdentity, collectedAt: new Date().toISOString(), sourceRef: 'sample://controlled-manual/' + providerId, rawArtifactId: raw.id, supportingArtifactId: support.id, citations, analysis })
    repository.createObservationAnalysis({ workspaceId: workspace.id, actorId, observationId: observation.id, evidencePackId: evidencePack.id, evidencePackVersion: evidencePack.version, analyzerVersion: 'sample-governed-analysis-v1', result: analysis })
  }
  const answers = [
    ['DeepSeek', 'DeepSeek 示例人工导出', 'Northstar KB 可作为具备知识图谱上下文和来源可追溯回答的候选之一。', { brandMentioned: true, recommended: true, competitorsMentioned: ['Notion'], competitorsRecommended: ['Notion'], claims: [{ statement: '支持来源可追溯回答', assessment: 'supported' }] }, [{ url: 'https://example.com/help/source-citations', kind: 'owned' }]],
    ['通义千问', 'Qwen 示例人工导出', '可关注知识库工具的引用来源、权限治理与图谱上下文能力。', { brandMentioned: false, recommended: false, competitorsMentioned: ['Guru'], competitorsRecommended: ['Guru'], claims: [{ statement: '示例回答没有明确品牌结论', assessment: 'insufficient-evidence' }] }, [{ url: 'https://www.example.org/review', kind: 'third-party' }]],
  ]
  for (const query of cnDataset.queries) for (const [providerId, modelIdentity, answer, analysis, citations] of answers) importEvidence(cnRun, query, providerId, modelIdentity, answer, analysis, citations)
  importEvidence(globalRun, globalDataset.queries[0], 'ChatGPT', 'ChatGPT 示例人工导出', 'Northstar KB is a candidate for teams looking for source-cited knowledge answers.', { brandMentioned: true, recommended: true, competitorsMentioned: ['Notion'], competitorsRecommended: ['Notion'], claims: [{ statement: 'source-cited answers', assessment: 'supported' }] }, [{ url: 'https://example.com/help/source-citations', kind: 'owned' }])
  importEvidence(globalRun, globalDataset.queries[0], 'Perplexity', 'Perplexity 示例人工导出', 'Compare knowledge-base tools by source traceability and governance.', { brandMentioned: false, recommended: false, competitorsMentioned: ['Guru'], competitorsRecommended: ['Guru'], claims: [{ statement: 'brand mention absent', assessment: 'insufficient-evidence' }] }, [{ url: 'https://medium.com/example/review', kind: 'third-party' }])
  const cnObservations = repository.listAssessmentObservations(workspace.id, cnRun.id)
  const diagnosis = repository.createDiagnosis({ workspaceId: workspace.id, actorId, assessmentRunId: cnRun.id, evidencePackId: evidencePack.id, evidencePackVersion: evidencePack.version, title: '中文类目查询的品牌提及覆盖不足', priority: 'P0', category: 'coverage', confidence: 'medium', detail: '在受控人工导入的保留回答中，部分提供方未提及品牌或仅泛化描述能力。', recommendation: '围绕“知识图谱 + 来源可追溯”制作带可核验来源的 FAQ 与比较页面，并在后续同范围查询中复测。', uncertainty: '样本仅代表当前定义的查询和人工导入证据，不能推断平台机制或未来表现。', queryIds: cnDataset.queries.map((query) => query.id), observationIds: cnObservations.map((item) => item.id) })
  const briefInvocation = repository.createAiInvocation({ workspaceId: workspace.id, projectId, actorId, capability: 'content-brief', modelIdentity: 'internal-evidence-safe-template', promptTemplateVersion: 'sample-brief-v1', inputRefs: [{ name: 'diagnosis', ref: 'diagnosis://' + diagnosis.id }, { name: 'evidence-pack', ref: 'evidence-pack://' + evidencePack.id + '/v' + evidencePack.version }], status: 'prepared', humanReviewRequired: true })
  const brief = repository.createContentBrief({ workspaceId: workspace.id, projectId, actorId, logicalKey: 'sample-cn-knowledge-graph-faq', diagnosisId: diagnosis.id, marketPackId: cnMarket.id, evidencePackId: evidencePack.id, evidencePackVersion: evidencePack.version, locale: 'zh-CN', channel: '官网内容中心', contentType: 'faq', title: '知识图谱与来源可追溯 AI 知识库 FAQ', brief: { objective: '覆盖中文类目查询中的可核验能力说明。', targetQueryIds: cnDataset.queries.map((query) => query.id), evidenceRequirements: ['引用已批准事实包', '说明适用范围与限制'], distributionBoundary: '仅创建人工分发任务，不自动发布。' }, aiInvocationId: briefInvocation.id, status: 'needs-review' })
  repository.reviewContentBrief({ workspaceId: workspace.id, projectId, briefId: brief.id, actorId, status: 'approved', reviewComment: '示例 brief 已核对受控人工导入证据与表述边界。' })
  const draftInvocation = repository.createAiInvocation({ workspaceId: workspace.id, projectId, actorId, capability: 'content-draft', modelIdentity: 'internal-evidence-safe-template', promptTemplateVersion: 'sample-draft-v1', inputRefs: [{ name: 'brief', ref: 'content-brief://' + brief.id + '/v' + brief.version }, { name: 'evidence-pack', ref: 'evidence-pack://' + evidencePack.id + '/v' + evidencePack.version }], status: 'prepared', humanReviewRequired: true })
  const draft = repository.createContentDraft({ workspaceId: workspace.id, projectId, actorId, logicalKey: 'sample-cn-knowledge-graph-faq-draft', sourceBriefId: brief.id, locale: 'zh-CN', channel: '官网内容中心', contentType: 'faq', evidencePackId: evidencePack.id, evidencePackVersion: evidencePack.version, title: '知识图谱与来源可追溯 AI 知识库 FAQ（待发布）', draft: { body: '本示例内容说明企业 AI 知识库可提供知识图谱上下文与来源可追溯回答；具体适配性需由客户结合自身事实与权限治理要求审核。', citations: ['sample://facts/capability'] }, aiInvocationId: draftInvocation.id, status: 'needs-review' })
  repository.createDraftClaimValidation({ workspaceId: workspace.id, projectId, actorId, contentDraftId: draft.id, statement: '本示例不保证 AI 平台引用、排名、流量、线索或收入。', claimType: 'guarantee', evidenceRefs: ['workspace-policy://prohibited-claims'], status: 'supported', detectorVersion: 'sample-claim-validation-v1' })
  repository.reviewContentDraft({ workspaceId: workspace.id, projectId, draftId: draft.id, actorId, status: 'approved', reviewComment: '示例草稿仅使用批准事实；不包含结果保证。' })
  const approvedSnapshot = repository.getApprovedContentSnapshot(workspace.id, draft.id, projectId)
  const distributionTask = repository.createDistributionTask({ workspaceId: workspace.id, projectId, actorId, contentDraftId: draft.id, approvedSnapshotId: approvedSnapshot.id, ownerId: actorId, channel: '官网内容中心', editorialConstraints: { humanApprovalRequired: true, autoPublish: false, prohibitedClaims: workspace.configuration.prohibitedClaims }, targetQueryIds: cnDataset.queries.map((query) => query.id), scheduledFor: new Date().toISOString(), notes: '本地示例：供人工审核后发布；不会自动发布。' })
  const report = repository.createReport({ workspaceId: workspace.id, actorId, logicalKey: 'sample-cn-baseline-report', title: '中文市场 GEO 基线观测报告（示例）', baselineRunId: cnRun.id, datasetId: cnDataset.id, evidencePackId: evidencePack.id, actionIds: [distributionTask.id], report: { scope: { market: 'CN', locale: 'zh-CN', providers: cnMarket.providers, queryCount: cnDataset.queries.length }, conclusion: '仅呈现已保留受控人工导入证据中的基线观测，不构成因果或未来结果承诺。' }, limitations: ['样本仅代表当前定义查询与人工导入回答。', '不保证 AI 提及、引用、排名、流量、线索或收入。'], status: 'generated' })
  repository.createCompetitorResearch({ workspaceId: workspace.id, actorId, marketPackId: cnMarket.id, sourceRef: 'https://www.notion.so/help', sourceType: 'website', adapterId: 'manual-research-importer', collectionMethod: 'manual-import', collectedAt: new Date().toISOString(), extractionStatus: 'captured', provenance: { mode: 'sample-controlled-manual' }, findings: { themes: ['模板', '团队协作'], note: '示例竞品研究记录，仅用于本地开发演示。' } })
  return { workspace: repository.getWorkspace(workspace.id), administrator, project: projectDetail.project, projectId, marketPacks: [cnMarket, globalMarket], runs: [repository.getAssessmentRun(cnRun.id), repository.getAssessmentRun(globalRun.id)], diagnosis, brief, draft, distributionTask, report }
}
