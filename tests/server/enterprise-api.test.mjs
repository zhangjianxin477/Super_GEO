import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApplication } from '../../server/application.mjs'
import { detectDraftClaims } from '../../server/domain/claimValidation.mjs'

let application
let origin
let workspaceId

const json = async (path, options = {}) => {
  const response = await fetch(`${origin}${path}`, { headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }, ...options })
  return { response, body: await response.json() }
}
const auth = (userId, id = workspaceId) => ({ 'x-user-id': userId, 'x-workspace-id': id })
const datasetApproval = (reviewNotes = 'Dataset reviewed for safe claims and cohort coverage.') => ({
  status: 'approved',
  checklist: {
    version: 'query-review-v1', reference: 'docs/workflows/query-design-rules.md#dataset-approval-checklist',
    checks: { intentMapped: true, localeAndLanguage: true, roleAndStage: true, claimsSafe: true, noOutcomeGuarantees: true },
  },
  reviewNotes,
})
const validDescriptor = (overrides = {}) => ({
  id: 'test-provider',
  type: 'model-provider',
  label: 'Test Provider',
  inputs: ['approved query', 'locale'],
  outputs: ['raw answer', 'citation list'],
  requiredConfig: ['credential reference', 'market configuration'],
  requiredRole: 'analyst',
  locales: ['zh-CN'],
  configured: true,
  configurationRef: 'secret://test-provider/config-v1',
  failureBehavior: 'record failed observation and preserve completed observations',
  ...overrides,
})
const executionPayload = () => ({
  inputRefs: [{ name: 'approved query', ref: 'query://approved-q1' }, { name: 'locale', ref: 'locale://zh-CN' }],
  outputRefs: [{ name: 'raw answer', ref: 'artifact://answer-1' }, { name: 'citation list', ref: 'artifact://citations-1' }],
})

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-harness-test-'))
  application = createApplication({ config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0 } })
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${application.server.address().port}`
  const created = await json('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: 'Tenant A', brand: 'CoreNote', products: ['Knowledge workspace'], administrator: { id: 'admin-1', name: 'Admin' } }) })
  assert.equal(created.response.status, 201)
  workspaceId = created.body.workspace.id
  application.repository.addMember({ workspaceId, userId: 'viewer-1', name: 'Viewer', role: 'viewer' })
  application.repository.addMember({ workspaceId, userId: 'analyst-1', name: 'Analyst', role: 'analyst' })
  application.repository.addMember({ workspaceId, userId: 'reviewer-1', name: 'Reviewer', role: 'reviewer' })
})

after(async () => {
  await new Promise((resolve) => application.server.close(resolve))
  const dataDir = application.config.dataDir
  application.database.close()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('enterprise API foundation', () => {
  it('enforces tenant isolation before reading workspace data', async () => {
    const result = await json(`/api/workspaces/${workspaceId}`, { headers: auth('admin-1', 'another-workspace') })
    assert.equal(result.response.status, 403)
    assert.match(result.body.error, /Cross-workspace/)
  })


  it('lets an administrator configure a China-plus-global workspace while blocking viewer edits', async () => {
    const configuration = {
      brandNames: ['CoreNote', 'CoreNote Cloud'],
      products: ['AI Knowledge Workspace', 'Knowledge Graph'],
      customerSegments: ['Cross-border SaaS teams', 'Enterprise knowledge-base owners', 'AI product leaders'],
      operatingMarkets: ['CN', 'GLOBAL'], locales: ['zh-CN', 'en-US'],
      approvedWebsites: ['https://corenote.cloud'], competitors: ['Notion', 'Obsidian'],
      approvedClaims: [{ statement: 'Supports source-linked answers when backed by approved evidence.', evidenceRefs: ['manual://claim/source-linked-answers'] }],
      prohibitedClaims: ['Guarantees AI citations, recommendations, rankings, leads, or revenue.'],
    }
    const viewerEdit = await json(`/api/workspaces/${workspaceId}/configuration`, { method: 'PUT', headers: auth('viewer-1'), body: JSON.stringify(configuration) })
    assert.equal(viewerEdit.response.status, 403)

    const saved = await json(`/api/workspaces/${workspaceId}/configuration`, { method: 'PUT', headers: auth('admin-1'), body: JSON.stringify(configuration) })
    assert.equal(saved.response.status, 200)
    assert.equal(saved.body.configuration.version, 2)
    assert.deepEqual(saved.body.configuration.operatingMarkets, ['CN', 'GLOBAL'])
    assert.deepEqual(saved.body.configuration.locales, ['zh-CN', 'en-US'])
    assert.equal(saved.body.workspace.brand, 'CoreNote')

    const viewerRead = await json(`/api/workspaces/${workspaceId}/configuration`, { headers: auth('viewer-1') })
    assert.equal(viewerRead.response.status, 200)
    assert.equal(viewerRead.body.configuration.approvedClaims[0].evidenceRefs[0], 'manual://claim/source-linked-answers')

    const createdMember = await json(`/api/workspaces/${workspaceId}/members`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ userId: 'analyst-2', name: 'Analyst Two', role: 'analyst' }) })
    assert.equal(createdMember.response.status, 201)
    const members = await json(`/api/workspaces/${workspaceId}/members`, { headers: auth('viewer-1') })
    assert.equal(members.response.status, 200)
    assert.ok(members.body.members.some((member) => member.id === 'analyst-2' && member.role === 'analyst'))
  })

  it('denies a viewer attempting to create evidence', async () => {
    const result = await json(`/api/workspaces/${workspaceId}/evidence`, { method: 'POST', headers: auth('viewer-1'), body: JSON.stringify({ items: [{ title: 'Positioning', excerpt: 'Source-linked knowledge workspace.', taxonomy: 'brand-identity', sourceType: 'manual', sourceRef: 'manual://test' }] }) })
    assert.equal(result.response.status, 403)
    const audit = await json(`/api/workspaces/${workspaceId}/audit`, { headers: auth('admin-1') })
    assert.ok(audit.body.events.some((event) => event.action === 'authorization.denied' && event.outcome === 'denied'))
  })

  it('versions approved evidence and preserves historical packs', async () => {
    const first = await json(`/api/workspaces/${workspaceId}/evidence`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ status: 'approved', items: [{ title: 'Positioning', excerpt: 'Evidence-grounded knowledge workspace.', taxonomy: 'brand-identity', sourceType: 'manual', sourceRef: 'manual://positioning' }] }) })
    const second = await json(`/api/workspaces/${workspaceId}/evidence`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ status: 'approved', items: [{ title: 'Capability revision', excerpt: 'Knowledge graph and source-linked answers.', taxonomy: 'product-capability', sourceType: 'website', sourceRef: 'https://example.test/product' }] }) })
    assert.equal(first.response.status, 201); assert.equal(second.response.status, 201)
    assert.equal(first.body.evidencePack.version, 1); assert.equal(second.body.evidencePack.version, 2)
    const preservedFirst = application.repository.getEvidencePack(workspaceId, first.body.evidencePack.id)
    assert.equal(preservedFirst.items[0].title, 'Positioning')
    assert.equal(preservedFirst.items[0].sourceRef, 'manual://positioning')
  })


  it('requires evidence review and preserves the last approved version after a failed synchronization', async () => {
    const analystCannotApprove = await json(`/api/workspaces/${workspaceId}/evidence`, {
      method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({
        status: 'approved',
        items: [{ title: 'Unreviewed capability', excerpt: 'A source-backed capability.', taxonomy: 'product-capability', sourceType: 'manual', sourceRef: 'manual://unreviewed-capability' }],
      }),
    })
    assert.equal(analystCannotApprove.response.status, 403)

    const draft = await json(`/api/workspaces/${workspaceId}/evidence`, {
      method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({
        status: 'draft',
        items: [{ title: 'Reviewed capability', excerpt: 'Knowledge-graph context with source-linked answers.', taxonomy: 'product-capability', sourceType: 'corenote', sourceRef: 'corenote://controlled-export/capability' }],
      }),
    })
    assert.equal(draft.response.status, 201)
    assert.equal(draft.body.evidencePack.status, 'draft')
    assert.equal(draft.body.evidencePack.reviewedAt, null)

    const reviewed = await json(`/api/workspaces/${workspaceId}/evidence/${draft.body.evidencePack.id}/review`, {
      method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ decision: 'approved', reviewComment: 'Source and taxonomy verified for approved use.' }),
    })
    assert.equal(reviewed.response.status, 200)
    assert.equal(reviewed.body.evidencePack.status, 'approved')
    assert.equal(reviewed.body.evidencePack.reviewedBy, 'reviewer-1')
    assert.equal(reviewed.body.evidencePack.reviewOutcome, 'approved')

    const failed = await json(`/api/workspaces/${workspaceId}/evidence/sync-events`, {
      method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({
        sourceType: 'corenote', sourceSystem: 'CoreNote controlled export', collectionMode: 'controlled-manual',
        status: 'failed', occurredAt: '2026-09-27T09:45:00.000Z',
        detail: 'The authorized export was unavailable; no evidence changes were applied.',
      }),
    })
    assert.equal(failed.response.status, 201)
    assert.equal(failed.body.syncEvent.lastApprovedEvidencePackId, reviewed.body.evidencePack.id)

    const current = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('reviewer-1') })
    assert.equal(current.response.status, 200)
    assert.equal(current.body.evidencePack.id, reviewed.body.evidencePack.id)

    const status = await json(`/api/workspaces/${workspaceId}/evidence/sync-status`, { headers: auth('reviewer-1') })
    assert.equal(status.response.status, 200)
    const coreNoteStatus = status.body.syncStatus.find((entry) => entry.sourceSystem === 'CoreNote controlled export')
    assert.equal(coreNoteStatus.status, 'failed')
    assert.equal(coreNoteStatus.lastApprovedEvidencePack.id, reviewed.body.evidencePack.id)
    assert.equal(coreNoteStatus.warning.code, 'evidence-sync-failed')
    assert.match(coreNoteStatus.warning.message, /last approved evidence version remains available/i)
  })


  it('creates independent China and global market packs from one approved evidence version', async () => {
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    assert.equal(evidence.response.status, 200)
    assert.equal(evidence.body.evidencePack.status, 'approved')

    const china = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      logicalKey: 'shared-evidence-cn', label: 'China GEO pack', status: 'approved', market: 'CN', locale: 'zh-CN',
      audience: '出海 SaaS 团队、企业知识库负责人、AI 产品负责人', competitors: ['Notion', '语雀'],
      providers: ['DeepSeek', '通义千问', '豆包', 'Kimi', '元宝', 'GLM', '文心一言'],
      channels: ['官网内容中心', '知乎', '微信公众号', '掘金'], evidencePackId: evidence.body.evidencePack.id,
    }) })
    const global = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      logicalKey: 'shared-evidence-global', label: 'United States GEO pack', status: 'approved', market: 'GLOBAL', locale: 'en-US',
      audience: 'Cross-border SaaS and B2B knowledge teams', competitors: ['Notion', 'Obsidian'],
      providers: ['ChatGPT', 'Gemini', 'Claude', 'Perplexity'],
      channels: ['Website Blog', 'Help Center', 'Comparison Page', 'Medium', 'LinkedIn'], evidencePackId: evidence.body.evidencePack.id,
    }) })
    assert.equal(china.response.status, 201)
    assert.equal(global.response.status, 201)
    assert.equal(china.body.marketPack.evidencePackId, evidence.body.evidencePack.id)
    assert.equal(global.body.marketPack.evidencePackId, evidence.body.evidencePack.id)
    assert.equal(china.body.marketPack.evidencePackVersion, global.body.marketPack.evidencePackVersion)
    assert.equal(china.body.marketPack.locale, 'zh-CN')
    assert.equal(global.body.marketPack.locale, 'en-US')
    assert.notDeepEqual(china.body.marketPack.providers, global.body.marketPack.providers)
    assert.notDeepEqual(china.body.marketPack.channels, global.body.marketPack.channels)
  })


  it('configures controlled-manual and custom model providers without persisting raw secrets', async () => {
    const custom = await json(`/api/workspaces/${workspaceId}/model-providers`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ providerId: 'Enterprise Gateway', market: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual' }) })
    assert.equal(custom.response.status, 201)
    assert.equal(custom.body.provider.providerId, 'Enterprise Gateway')
    assert.equal(custom.body.provider.test.status, 'unverified')
    const rawSecret = await json(`/api/workspaces/${workspaceId}/model-providers`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ providerId: 'DeepSeek', market: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual', apiKey: 'do-not-store-me' }) })
    assert.equal(rawSecret.response.status, 400)
    const configured = await json(`/api/workspaces/${workspaceId}/model-providers`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ providerId: 'DeepSeek', market: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual', credentialReference: 'secret://geo-harness/deepseek-manual-export-policy' }) })
    assert.equal(configured.response.status, 201)
    assert.equal(configured.body.provider.collectionMode, 'controlled-manual')
    assert.equal(configured.body.provider.credentialReference, 'secret://geo-harness/deepseek-manual-export-policy')

    const listed = await json(`/api/workspaces/${workspaceId}/model-providers`, { headers: auth('viewer-1') })
    assert.equal(listed.response.status, 200)
    assert.match(listed.body.collectionBoundary, /authorised APIs, enterprise gateways, or MCP connectors/i)
  })

  it('lets analysts create and filter a multilingual query dataset', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/datasets`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({
      logicalKey: 'multilingual-query-lab', label: 'B2B knowledge-base discovery', status: 'draft', queries: [
        { text: '有哪些支持知识图谱、来源可追溯的 AI 知识库工具？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'knowledge-lead', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'General B2B knowledge platform', expectedFacts: ['knowledge graph', 'source-cited answers'], riskMetadata: { factualRisk: 'high' } },
        { text: 'What AI knowledge base tools provide knowledge-graph context and source-cited answers for B2B teams?', market: 'GLOBAL', locale: 'en-US', language: 'en', userRole: 'ai-product-lead', businessStage: 'evaluate', intent: 'category-discovery', priority: 'P0', targetProduct: 'General B2B knowledge platform', expectedFacts: ['knowledge-graph context', 'source-cited answers'], riskMetadata: { factualRisk: 'high' } },
      ],
    }) })
    assert.equal(created.response.status, 201)
    assert.equal(created.body.dataset.queries.length, 2)

    const chinese = await json(`/api/workspaces/${workspaceId}/datasets?market=CN&language=zh&priority=P0`, { headers: auth('analyst-1') })
    assert.equal(chinese.response.status, 200)
    const matched = chinese.body.datasets.find((dataset) => dataset.logicalKey === 'multilingual-query-lab')
    assert.equal(matched.queries.length, 1)
    assert.equal(matched.queries[0].locale, 'zh-CN')
    assert.equal(matched.queries[0].userRole, 'knowledge-lead')
    assert.equal(matched.queries[0].riskMetadata.factualRisk, 'high')

    const english = await json(`/api/workspaces/${workspaceId}/datasets?locale=en-US&businessStage=evaluate&targetProduct=General%20B2B%20knowledge%20platform`, { headers: auth('analyst-1') })
    assert.equal(english.response.status, 200)
    const englishMatch = english.body.datasets.find((dataset) => dataset.logicalKey === 'multilingual-query-lab')
    assert.equal(englishMatch.queries.length, 1)
    assert.equal(englishMatch.queries[0].language, 'en')
  })

  it('snapshots an approved dataset when an assessment run is created', async () => {
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'core-cohort', label: 'Core cohort', status: 'approved', queries: [{ text: '有哪些支持知识图谱的 AI 知识库工具？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'buyer', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'CoreNote', expectedFacts: ['Graph and source-linked Q&A'] }] }) })
    assert.equal(dataset.response.status, 201)
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'market-cn', label: 'China market', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'Knowledge-workspace buyers', competitors: ['Notion'], providers: ['DeepSeek'], channels: ['Website'], evidencePackId: evidence.body.evidencePack.id }) })
    assert.equal(marketPack.response.status, 201)
    const run = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ label: 'China baseline', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['DeepSeek'], queryIds: [dataset.body.dataset.queries[0].id] }) })
    assert.equal(run.response.status, 201)
    assert.equal(run.body.run.datasetVersion, 1)
    assert.deepEqual(run.body.run.providers, ['DeepSeek'])
    assert.equal(run.body.run.providerConfigurations.length, 1)
    assert.equal(run.body.run.providerConfigurations[0].collectionMode, 'controlled-manual')
    assert.equal(run.body.run.cohortQueryIds.length, 1)
  })

  it('creates an immutable approved-dataset revision without changing a baseline run', async () => {
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      logicalKey: 'revision-controlled-cohort', label: 'Revision controlled cohort', status: 'approved', queries: [
        { text: '有哪些支持知识图谱、来源可追溯的 AI 知识库工具？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'knowledge-lead', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'General B2B knowledge platform', expectedFacts: ['knowledge graph', 'source-cited answers'] },
      ],
    }) })
    assert.equal(dataset.response.status, 201)
    assert.equal(dataset.body.dataset.version, 1)

    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      logicalKey: 'revision-control-cn', label: 'Revision control China', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'Enterprise knowledge-base owners', competitors: ['Notion'], providers: ['DeepSeek'], channels: ['Website Blog'], evidencePackId: evidence.body.evidencePack.id,
    }) })
    assert.equal(marketPack.response.status, 201)
    const baseline = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      label: 'Revision-control baseline', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['DeepSeek'], queryIds: [dataset.body.dataset.queries[0].id],
    }) })
    assert.equal(baseline.response.status, 201)
    assert.equal(baseline.body.run.datasetVersion, 1)

    const revision = await json(`/api/workspaces/${workspaceId}/datasets/${dataset.body.dataset.id}/revisions`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({
      label: 'Revision controlled cohort — v2', queries: [
        ...dataset.body.dataset.queries.map(({ text, market, locale, language, userRole, businessStage, intent, priority, targetProduct, expectedFacts, riskMetadata }) => ({ text, market, locale, language, userRole, businessStage, intent, priority, targetProduct, expectedFacts, riskMetadata })),
        { text: '哪些 AI 知识库工具适合需要可追溯来源的 B2B 团队？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'ai-product-lead', businessStage: 'evaluate', intent: 'scenario', priority: 'P0', targetProduct: 'General B2B knowledge platform', expectedFacts: ['source traceability'], riskMetadata: { factualRisk: 'high' } },
      ],
    }) })
    assert.equal(revision.response.status, 201)
    assert.equal(revision.body.dataset.status, 'draft')
    assert.equal(revision.body.dataset.version, 2)
    assert.equal(revision.body.dataset.supersedesDatasetId, dataset.body.dataset.id)

    const denied = await json(`/api/workspaces/${workspaceId}/datasets/${revision.body.dataset.id}/review`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ status: 'approved' }) })
    assert.equal(denied.response.status, 403)
    const approved = await json(`/api/workspaces/${workspaceId}/datasets/${revision.body.dataset.id}/review`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify(datasetApproval('Revision changes reviewed against the immutable baseline cohort.')) })
    assert.equal(approved.response.status, 200)
    assert.equal(approved.body.dataset.status, 'approved')

    const original = await json(`/api/workspaces/${workspaceId}/datasets/${dataset.body.dataset.id}`, { headers: auth('admin-1') })
    assert.equal(original.response.status, 200)
    assert.equal(original.body.dataset.status, 'superseded')
    assert.equal(original.body.dataset.supersededByDatasetId, revision.body.dataset.id)

    const preservedBaseline = await json(`/api/workspaces/${workspaceId}/assessment-runs/${baseline.body.run.id}`, { headers: auth('admin-1') })
    assert.equal(preservedBaseline.response.status, 200)
    assert.equal(preservedBaseline.body.run.datasetId, dataset.body.dataset.id)
    assert.equal(preservedBaseline.body.run.datasetVersion, 1)
  })

  it('seeds and reviews the 100-query CoreNote pilot cohort with complete intent mapping', async () => {
    const seeded = await json(`/api/workspaces/${workspaceId}/datasets/seed-corenote-pilot`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(seeded.response.status, 201)
    assert.equal(seeded.body.dataset.status, 'draft')
    assert.equal(seeded.body.dataset.queries.length, 100)
    assert.deepEqual(seeded.body.corpus.intentCounts, { alternative: 20, 'brand-discovery': 20, 'category-discovery': 20, comparison: 20, scenario: 20 })
    assert.ok(seeded.body.dataset.queries.some((query) => query.text === '有哪些支持知识图谱、来源可追溯的 AI 知识库工具？'))
    assert.ok(seeded.body.dataset.queries.some((query) => query.text === 'What AI knowledge base tools provide knowledge-graph context and source-cited answers for B2B teams?'))
    assert.ok(seeded.body.dataset.queries.every((query) => query.intent))

    const missingChecklist = await json(`/api/workspaces/${workspaceId}/datasets/${seeded.body.dataset.id}/review`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ status: 'approved' }) })
    assert.equal(missingChecklist.response.status, 400)
    const approved = await json(`/api/workspaces/${workspaceId}/datasets/${seeded.body.dataset.id}/review`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify(datasetApproval('All 100 pilot queries map to an intent and use safe, evidence-sensitive wording.')) })
    assert.equal(approved.response.status, 200)
    assert.equal(approved.body.dataset.status, 'approved')
    assert.equal(approved.body.reviews[0].checklist.reference, 'docs/workflows/query-design-rules.md#dataset-approval-checklist')

    const reviewRecord = await json(`/api/workspaces/${workspaceId}/datasets/${seeded.body.dataset.id}/reviews`, { headers: auth('viewer-1') })
    assert.equal(reviewRecord.response.status, 200)
    assert.equal(reviewRecord.body.reviews.length, 1)
    assert.equal(reviewRecord.body.reviews[0].checklist.checks.claimsSafe, true)
  })

  it('marks a follow-up cohort non-comparable when it omits a baseline query', async () => {
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      logicalKey: 'cohort-compatibility', label: 'Cohort compatibility', status: 'approved', queries: [
        { text: '有哪些支持知识图谱、来源可追溯的 AI 知识库工具？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'knowledge-lead', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'General B2B knowledge platform', expectedFacts: ['knowledge graph'] },
        { text: 'B2B SaaS 团队如何为销售、客服和产品共用一套可追溯的 AI 知识库？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'ai-product-lead', businessStage: 'evaluate', intent: 'scenario', priority: 'P0', targetProduct: 'General B2B knowledge platform', expectedFacts: ['source-cited answers'] },
      ],
    }) })
    assert.equal(dataset.response.status, 201)
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      logicalKey: 'cohort-compatibility-cn', label: 'Cohort compatibility China', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'Enterprise knowledge-base owners', competitors: ['Notion'], providers: ['DeepSeek'], channels: ['Website Blog'], evidencePackId: evidence.body.evidencePack.id,
    }) })
    assert.equal(marketPack.response.status, 201)
    const baseline = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      label: 'Cohort compatibility baseline', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['DeepSeek'], queryIds: dataset.body.dataset.queries.map((query) => query.id),
    }) })
    const followUp = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      label: 'Cohort compatibility follow-up', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['DeepSeek'], queryIds: [dataset.body.dataset.queries[0].id],
    }) })
    assert.equal(baseline.response.status, 201)
    assert.equal(followUp.response.status, 201)

    const compatibility = await json(`/api/workspaces/${workspaceId}/assessment-runs/${followUp.body.run.id}/compatibility?baselineRunId=${baseline.body.run.id}`, { headers: auth('viewer-1') })
    assert.equal(compatibility.response.status, 200)
    assert.equal(compatibility.body.compatibility.comparable, false)
    assert.deepEqual(compatibility.body.compatibility.excludedQueryIds, [dataset.body.dataset.queries[1].id])
    assert.match(compatibility.body.compatibility.reasons.join(' '), /omits 1 baseline query/i)
  })

  it('rejects an incomplete extension contract and keeps it out of persistence', async () => {
    const result = await json(`/api/workspaces/${workspaceId}/extensions`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ descriptor: { id: 'bad-provider', type: 'model-provider', label: 'Bad provider', inputs: [], outputs: [], requiredRole: 'analyst', locales: [], configured: false, failureBehavior: '' } }) })
    assert.equal(result.response.status, 400)
    assert.match(result.body.error, /inputs/)
    const list = await json(`/api/workspaces/${workspaceId}/extensions`, { headers: auth('admin-1') })
    assert.ok(!list.body.extensions.some((extension) => extension.id === 'bad-provider'))
  })

  it('fails closed for unconfigured extensions without changing approved evidence', async () => {
    const registered = await json(`/api/workspaces/${workspaceId}/extensions`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ descriptor: validDescriptor({ id: 'unconfigured-provider', configured: false, configurationRef: undefined }) }) })
    assert.equal(registered.response.status, 201)
    const before = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    const execution = await json(`/api/workspaces/${workspaceId}/extensions/unconfigured-provider/executions`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify(executionPayload()) })
    const after = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    assert.equal(execution.response.status, 409)
    assert.match(execution.body.error, /not configured/)
    assert.equal(after.body.evidencePack.id, before.body.evidencePack.id)
    const history = await json(`/api/workspaces/${workspaceId}/extensions/unconfigured-provider/executions`, { headers: auth('admin-1') })
    assert.equal(history.body.executions[0].status, 'rejected')
  })

  it('rejects unauthorized or out-of-scope extension execution and preserves completed evidence', async () => {
    const registered = await json(`/api/workspaces/${workspaceId}/extensions`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ descriptor: validDescriptor({ id: 'scoped-provider' }) }) })
    assert.equal(registered.response.status, 201)
    const before = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    const unauthorized = await json(`/api/workspaces/${workspaceId}/extensions/scoped-provider/executions`, { method: 'POST', headers: auth('viewer-1'), body: JSON.stringify(executionPayload()) })
    assert.equal(unauthorized.response.status, 403)
    const outOfScope = await json(`/api/workspaces/${workspaceId}/extensions/scoped-provider/executions`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ ...executionPayload(), outputRefs: [{ name: 'published content', ref: 'content://published' }, { name: 'citation list', ref: 'artifact://citations-1' }] }) })
    assert.equal(outOfScope.response.status, 400)
    const after = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    assert.equal(after.body.evidencePack.id, before.body.evidencePack.id)
    const audit = await json(`/api/workspaces/${workspaceId}/audit`, { headers: auth('admin-1') })
    assert.ok(audit.body.events.some((event) => event.action === 'extension.execution.rejected'))
  })

  it('records successful extension execution with declared input and output references only', async () => {
    const execution = await json(`/api/workspaces/${workspaceId}/extensions/scoped-provider/executions`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify(executionPayload()) })
    assert.equal(execution.response.status, 201)
    assert.equal(execution.body.execution.status, 'completed')
    assert.equal(execution.body.execution.inputRefs.length, 2)
    assert.equal(execution.body.execution.outputRefs.length, 2)
  })

  it('stores artifacts under tenant-scoped metadata and denies cross-tenant reads', async () => {
    const stored = await json(`/api/workspaces/${workspaceId}/artifacts`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ kind: 'answer-evidence', payload: { answer: 'CoreNote is a knowledge workspace.', citations: [] } }) })
    assert.equal(stored.response.status, 201)
    const read = await json(`/api/workspaces/${workspaceId}/artifacts/${stored.body.artifact.id}`, { headers: auth('admin-1') })
    assert.equal(read.response.status, 200)
    assert.equal(read.body.payload.answer, 'CoreNote is a knowledge workspace.')

    const other = await json('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: 'Tenant B', brand: 'Other', administrator: { id: 'admin-2', name: 'Other admin' } }) })
    assert.equal(other.response.status, 201)
    const isolated = await json(`/api/workspaces/${other.body.workspace.id}/artifacts/${stored.body.artifact.id}`, { headers: auth('admin-2', other.body.workspace.id) })
    assert.equal(isolated.response.status, 404)
  })

  it('stores authorised provider credentials without exposing plaintext API keys', async () => {
    const apiKey = 'sk-live-rotate-1234'
    const configured = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ providerId: 'DeepSeek', market: 'CN', locale: 'zh-CN', collectionMode: 'official-api', baseUrl: 'https://api.deepseek.example/v1', modelName: 'deepseek-chat' }),
    })
    assert.equal(configured.response.status, 201)
    assert.equal(configured.body.provider.collectionMode, 'official-api')

    const viewerSave = await json(`/api/workspaces/${workspaceId}/model-providers/${configured.body.provider.id}/credential`, {
      method: 'POST', headers: auth('viewer-1'), body: JSON.stringify({ apiKey }),
    })
    assert.equal(viewerSave.response.status, 403)

    const manual = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ providerId: 'ChatGPT', market: 'GLOBAL', locale: 'en-US', collectionMode: 'controlled-manual' }),
    })
    const manualSecret = await json(`/api/workspaces/${workspaceId}/model-providers/${manual.body.provider.id}/credential`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ apiKey }),
    })
    assert.equal(manualSecret.response.status, 409)
    assert.match(manualSecret.body.error, /Controlled-manual providers do not accept API keys/i)

    const saved = await json(`/api/workspaces/${workspaceId}/model-providers/${configured.body.provider.id}/credential`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ apiKey }),
    })
    assert.equal(saved.response.status, 201)
    assert.equal(saved.body.provider.credential.configured, true)
    assert.equal(saved.body.provider.credential.lastFour, '1234')
    assert.equal(JSON.stringify(saved.body).includes(apiKey), false)

    const listed = await json(`/api/workspaces/${workspaceId}/model-providers`, { headers: auth('viewer-1') })
    const provider = listed.body.providers.find((entry) => entry.id === configured.body.provider.id)
    assert.equal(provider.credential.configured, true)
    assert.equal(provider.credential.lastFour, '1234')
    assert.equal(JSON.stringify(listed.body).includes(apiKey), false)

    const other = await json('/api/workspaces', {
      method: 'POST', body: JSON.stringify({ name: 'Credential isolation tenant', brand: 'Other', administrator: { id: 'credential-admin', name: 'Credential Admin' } }),
    })
    const isolated = await json(`/api/workspaces/${other.body.workspace.id}/model-providers/${configured.body.provider.id}/credential`, {
      method: 'POST', headers: auth('credential-admin', other.body.workspace.id), body: JSON.stringify({ apiKey }),
    })
    assert.equal(isolated.response.status, 404)
  })

  it('retains imported answer evidence and keeps imported results transparent in metrics', async () => {
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'manual-import-cohort', label: 'Manual import cohort', status: 'approved', queries: [{ text: '适合小团队的知识图谱知识库有哪些？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'buyer', businessStage: 'evaluate', intent: 'category-discovery', priority: 'P0', targetProduct: 'CoreNote', expectedFacts: ['Evidence-grounded answers'] }] }) })
    assert.equal(dataset.response.status, 201)
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'manual-import-cn', label: 'China manual import market', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'Knowledge-workspace buyers', competitors: ['Notion', 'Obsidian'], providers: ['Kimi'], channels: ['Website'], evidencePackId: evidence.body.evidencePack.id }) })
    assert.equal(marketPack.response.status, 201)
    const unconfigured = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ label: 'Manual-import baseline (blocked)', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['Kimi'] }) })
    assert.equal(unconfigured.response.status, 400)
    assert.match(unconfigured.body.error, /requires an active controlled-manual configuration/i)
    const kimiConfiguration = await json(`/api/workspaces/${workspaceId}/model-providers`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ providerId: 'Kimi', market: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual' }) })
    assert.equal(kimiConfiguration.response.status, 201)
    const run = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ label: 'Manual-import baseline', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['Kimi'] }) })
    assert.equal(run.response.status, 201)
    assert.equal(run.body.run.plannedObservationCount, 1)
    assert.equal(run.body.run.isComplete, false)

    const supporting = await json(`/api/workspaces/${workspaceId}/artifacts`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ kind: 'capture-proof', payload: { capturedBy: 'admin-1', captureMethod: 'manual screenshot reference' } }) })
    assert.equal(supporting.response.status, 201)
    const queryId = dataset.body.dataset.queries[0].id
    const imported = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/import`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ queryId, providerId: 'Kimi', modelIdentity: 'Kimi manual capture', collectedAt: '2026-09-27T09:00:00.000Z', sourceRef: 'manual://kimi/capture-001', supportingArtifactId: supporting.body.artifact.id, rawAnswer: 'CoreNote 可作为资料关联和基于来源问答的知识工作台；也可以比较 Notion。', citations: [{ url: 'https://corenote.cloud/', kind: 'owned' }, { url: 'https://example.test/review', kind: 'third-party' }], analysis: { brandMentioned: true, recommended: true, competitorsRecommended: ['Notion'], claims: [{ statement: 'CoreNote supports source-linked answers.', assessment: 'supported' }, { statement: 'CoreNote guarantees every answer.', assessment: 'unsupported' }] } }) })
    assert.equal(imported.response.status, 201)
    assert.equal(imported.body.observation.status, 'imported')
    assert.equal(imported.body.observation.providerKind, 'imported')
    assert.equal(imported.body.observation.citations.length, 2)
    assert.equal(imported.body.observation.collectorId, 'admin-1')
    assert.equal(imported.body.observation.sourceRef, 'manual://kimi/capture-001')
    assert.ok(imported.body.observation.rawArtifactId)
    assert.equal(imported.body.observation.rawResultReference.artifactId, imported.body.observation.rawArtifactId)
    const rawResult = await json(`/api/workspaces/${workspaceId}/artifacts/${imported.body.observation.rawArtifactId}`, { headers: auth('admin-1') })
    assert.equal(rawResult.response.status, 200)
    assert.equal(rawResult.body.payload.schemaVersion, 'raw-answer-evidence-v1')
    assert.equal(rawResult.body.payload.locale, 'zh-CN')
    assert.deepEqual(rawResult.body.payload.citations.map((citation) => citation.url), ['https://corenote.cloud/', 'https://example.test/review'])

    const defaultMetrics = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/metrics`, { headers: auth('admin-1') })
    assert.equal(defaultMetrics.response.status, 200)
    assert.equal(defaultMetrics.body.measurement.eligibleObservationCount, 0)
    assert.equal(defaultMetrics.body.measurement.exclusions.imported, 1)
    const importedMetrics = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/metrics?includeImported=true`, { headers: auth('admin-1') })
    assert.equal(importedMetrics.body.measurement.eligibleObservationCount, 1)
    assert.equal(importedMetrics.body.measurement.metrics.mentionRate.rate, 1)
    assert.equal(importedMetrics.body.measurement.metrics.ownedSourceCitationRate.rate, 1)
    assert.equal(importedMetrics.body.measurement.metrics.factualAccuracyRate.rate, 0.5)

    const details = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}`, { headers: auth('admin-1') })
    assert.equal(details.body.run.status, 'completed')
    assert.equal(details.body.run.isComplete, true)
  })

  it('keeps a durable manual collection queue, retries timeouts, and never completes a failed run', async () => {
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ status: 'approved', items: [
        { title: 'Queue test product fact', excerpt: 'The product provides source-linked answers for B2B teams.', taxonomy: 'product-capability', sourceType: 'manual', sourceRef: 'manual://queue/product-fact' },
      ] }),
    })
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'queue-timeout-cohort', label: 'Queue timeout cohort', status: 'approved', queries: [
        { text: '支持来源追溯的 AI 知识库工具有哪些？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'buyer', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'Generic product', expectedFacts: ['Source-linked answers'] },
      ] }),
    })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'queue-timeout-cn', label: 'Queue timeout China', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'B2B teams', competitors: ['Notion'], providers: ['DeepSeek'], channels: ['官网内容中心'], evidencePackId: evidence.body.evidencePack.id }),
    })
    const provider = await json(`/api/workspaces/${workspaceId}/model-providers`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ providerId: 'DeepSeek', market: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual' }) })
    assert.equal(provider.response.status, 201)
    const run = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ label: 'Timeout recovery baseline', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['DeepSeek'], maxAttempts: 2 }) })
    assert.equal(run.response.status, 201)
    assert.deepEqual(run.body.run.completion, { planned: 1, queued: 1, collecting: 0, completed: 0, imported: 0, failed: 0, resolved: 0, isComplete: false, incompleteReason: 'Collection is still pending for one or more observations.' })

    const claimed = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/claim-next`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ providerId: 'DeepSeek' }) })
    assert.equal(claimed.response.status, 200)
    assert.equal(claimed.body.observation.collectionState, 'collecting')
    assert.equal(claimed.body.observation.attemptCount, 1)

    const reclaimed = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/claim-next`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ providerId: 'DeepSeek' }) })
    assert.equal(reclaimed.response.status, 200)
    assert.equal(reclaimed.body.observation.id, claimed.body.observation.id)
    assert.equal(reclaimed.body.observation.attemptCount, 1)
    assert.equal(reclaimed.body.run.completion.queued, 0)
    assert.equal(reclaimed.body.run.completion.collecting, 1)

    const noForeignResume = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/claim-next`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ resumeOnly: true }) })
    assert.equal(noForeignResume.response.status, 200)
    assert.equal(noForeignResume.body.observation, null)
    assert.equal(noForeignResume.body.run.completion.queued, 0)
    assert.equal(noForeignResume.body.run.completion.collecting, 1)

    const retry = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/${claimed.body.observation.id}/timeout`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ message: 'Injected provider timeout for integration test.', retryAfterSeconds: 0 }) })
    assert.equal(retry.response.status, 200)
    assert.equal(retry.body.observation.status, 'queued')
    assert.equal(retry.body.observation.collectionState, 'retry-scheduled')
    assert.equal(retry.body.observation.errorDetails.code, 'collection-timeout')
    assert.equal(retry.body.run.isComplete, false)

    const retryClaim = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/claim-next`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({}) })
    assert.equal(retryClaim.response.status, 200)
    assert.equal(retryClaim.body.observation.attemptCount, 2)
    const failed = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/${retryClaim.body.observation.id}/timeout`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ message: 'Injected provider timeout on final attempt.' }) })
    assert.equal(failed.response.status, 200)
    assert.equal(failed.body.observation.status, 'failed')
    assert.equal(failed.body.observation.collectionState, 'failed')
    assert.equal(failed.body.run.status, 'partial')
    assert.equal(failed.body.run.isComplete, false)
    assert.match(failed.body.run.completion.incompleteReason, /failed/i)

    const detail = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}`, { headers: auth('admin-1') })
    assert.equal(detail.body.run.completion.failed, 1)
    assert.equal(detail.body.run.completion.isComplete, false)

    const resumed = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/${retryClaim.body.observation.id}/resume`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ additionalAttempts: 1 }) })
    assert.equal(resumed.response.status, 200)
    assert.equal(resumed.body.observation.status, 'queued')
    assert.equal(resumed.body.observation.maxAttempts, 3)
    assert.ok(resumed.body.observation.resumedAt)
  })

  it('analyzes answer evidence and generates a non-guaranteed category-discovery diagnosis', async () => {
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'diagnosis-cohort', label: 'Diagnosis cohort', status: 'approved', queries: [{ text: '知识图谱 AI 知识库工具推荐', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'buyer', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'CoreNote', expectedFacts: ['Source-linked answers'] }] }) })
    assert.equal(dataset.response.status, 201)
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'diagnosis-cn', label: 'China diagnosis market', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'Knowledge-workspace buyers', competitors: ['Notion', 'Obsidian'], providers: ['DeepSeek'], channels: ['Website'], evidencePackId: evidence.body.evidencePack.id }) })
    const run = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ label: 'Diagnosis baseline', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['DeepSeek'] }) })
    assert.equal(run.response.status, 201)
    const supporting = await json(`/api/workspaces/${workspaceId}/artifacts`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ kind: 'capture-proof', payload: { capturedBy: 'admin-1', captureMethod: 'manual screenshot reference' } }) })
    const imported = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/import`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ queryId: dataset.body.dataset.queries[0].id, providerId: 'DeepSeek', modelIdentity: 'DeepSeek manual capture', collectedAt: '2026-09-27T10:00:00.000Z', sourceRef: 'manual://deepseek/capture-coverage-gap', supportingArtifactId: supporting.body.artifact.id, rawAnswer: '推荐 Notion 和 Obsidian 作为知识图谱知识库工具，它们适合个人与团队整理资料。', citations: [{ url: 'https://example.test/notion-review', kind: 'third-party' }], analysis: {} }) })
    assert.equal(imported.response.status, 201)

    const analysis = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/analysis`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(analysis.response.status, 201)
    assert.equal(analysis.body.analysis.analyzed.length, 1)
    assert.equal(analysis.body.analysis.analyzed[0].analysis.brandMentioned, false)
    assert.deepEqual(analysis.body.analysis.analyzed[0].analysis.competitorsRecommended.sort(), ['Notion', 'Obsidian'])

    const diagnosis = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/diagnoses/generate`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(diagnosis.response.status, 201)
    assert.equal(diagnosis.body.diagnoses.length, 1)
    assert.equal(diagnosis.body.diagnoses[0].category, 'coverage')
    assert.match(diagnosis.body.diagnoses[0].recommendation, /do not claim a guaranteed/i)
    assert.match(diagnosis.body.diagnoses[0].uncertainty, /not proof/i)

    const listed = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/diagnoses`, { headers: auth('admin-1') })
    assert.equal(listed.body.diagnoses.length, 1)
  })
  it('grounds factual analysis, metrics, dashboard drill-down, and permitted competitor research in retained evidence', async () => {
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ status: 'approved', items: [
      { title: 'Knowledge graph context', excerpt: 'CoreNote provides knowledge graph context and source-cited answers for B2B teams.', taxonomy: 'product-capability', sourceType: 'website', sourceRef: 'https://corenote.cloud/features/knowledge-graph' },
      { title: 'No ranking guarantee', excerpt: 'Do not guarantee model rankings, citations, or recommendations.', taxonomy: 'prohibited-claim', sourceType: 'manual', sourceRef: 'manual://policy/no-guarantees' },
    ] }) })
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'intelligence-evidence-cohort', label: 'Intelligence evidence cohort', status: 'approved', queries: [{ text: 'What AI knowledge base tools provide graph context?', market: 'CN', locale: 'zh-CN', language: 'en', userRole: 'buyer', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'CoreNote', expectedFacts: ['knowledge graph'] }] }) })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'intelligence-evidence-cn', label: 'Intelligence evidence market', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'B2B teams', competitors: ['Notion', 'Obsidian'], providers: ['DeepSeek'], channels: ['Website'], evidencePackId: evidence.body.evidencePack.id }) })
    const run = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ label: 'Intelligence evidence run', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['DeepSeek'] }) })
    const supporting = await json(`/api/workspaces/${workspaceId}/artifacts`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ kind: 'capture-proof', payload: { captureMethod: 'manual controlled export' } }) })
    const imported = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/import`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ queryId: dataset.body.dataset.queries[0].id, providerId: 'DeepSeek', modelIdentity: 'manual fixture', collectedAt: '2026-09-27T12:00:00.000Z', sourceRef: 'manual://fixture/intelligence', supportingArtifactId: supporting.body.artifact.id, rawAnswer: 'Recommended tools include Notion and Obsidian. CoreNote provides knowledge graph context and source-cited answers for B2B teams. CoreNote includes a native CRM.', citations: [{ url: 'https://corenote.cloud/features/knowledge-graph', kind: 'owned' }, { url: 'https://example.test/review', kind: 'third-party' }] }) })
    assert.equal(imported.response.status, 201)
    const analyzed = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/analysis`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(analyzed.response.status, 201)
    const claims = analyzed.body.analysis.analyzed[0].analysis.claims
    assert.ok(claims.some((claim) => claim.assessment === 'supported'))
    assert.ok(claims.some((claim) => claim.assessment === 'unsupported' && /native CRM/i.test(claim.statement)))
    assert.equal(analyzed.body.analysis.evidencePack.version, evidence.body.evidencePack.version)
    const metrics = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/metrics?includeImported=true`, { headers: auth('admin-1') })
    assert.equal(metrics.response.status, 200)
    assert.equal(metrics.body.measurement.metrics.mentionRate.numerator, 1)
    assert.equal(metrics.body.measurement.metrics.mentionRate.denominator, 1)
    assert.equal(metrics.body.measurement.exclusions.imported, 0)
    const dashboard = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/intelligence-dashboard?includeImported=true`, { headers: auth('admin-1') })
    assert.equal(dashboard.response.status, 200)
    assert.ok(dashboard.body.drillDown.provider.DeepSeek.includes(imported.body.observation.id))
    assert.ok(dashboard.body.drillDown.citation.owned.includes(imported.body.observation.id))
    assert.ok(dashboard.body.drillDown.factualAccuracy.unsupported.includes(imported.body.observation.id))
    assert.match(dashboard.body.evidenceRoute, /observations$/)
    const blockedResearch = await json(`/api/workspaces/${workspaceId}/competitor-research`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ sourceRef: 'https://example.test/notion', sourceType: 'website', adapterId: 'manual-research-importer', collectionMethod: 'manual-import', extractionStatus: 'captured', collectedAt: '2026-09-27T12:01:00.000Z', accessPolicy: 'bypassed' }) })
    assert.equal(blockedResearch.response.status, 422)
    const research = await json(`/api/workspaces/${workspaceId}/competitor-research`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ marketPackId: marketPack.body.marketPack.id, sourceRef: 'https://example.test/notion', sourceType: 'comparison-page', adapterId: 'manual-research-importer', collectionMethod: 'manual-import', extractionStatus: 'extracted', collectedAt: '2026-09-27T12:01:00.000Z', accessPolicy: 'permitted', provenance: { capturedBy: 'admin-1', licenseCheck: 'manual review' }, findings: { competitors: ['Notion'], summary: 'Mentions target buyer use cases.' } }) })
    assert.equal(research.response.status, 201)
    assert.equal(research.body.research.accessPolicy, 'permitted')
    assert.equal(research.body.research.extractionStatus, 'extracted')
    const listedResearch = await json(`/api/workspaces/${workspaceId}/competitor-research?marketPackId=${marketPack.body.marketPack.id}`, { headers: auth('admin-1') })
    assert.equal(listedResearch.response.status, 200)
    assert.ok(listedResearch.body.research.some((record) => record.id === research.body.research.id))
  })

  it('designates immutable baselines, labels non-causal comparisons, and generates limited client reports', async () => {
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ status: 'approved', items: [{ title: 'Reporting fact', excerpt: 'CoreNote provides source-cited answers.', taxonomy: 'product-capability', sourceType: 'manual', sourceRef: 'manual://reporting-fact' }] }) })
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'reporting-cohort', label: 'Reporting cohort', status: 'approved', queries: [{ text: 'AI knowledge base tools', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'buyer', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'CoreNote', expectedFacts: ['source citations'] }] }) })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'reporting-cn', label: 'Reporting CN', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'B2B teams', competitors: ['Notion'], providers: ['DeepSeek'], channels: ['Website'], evidencePackId: evidence.body.evidencePack.id }) })
    const runPayload = { datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['DeepSeek'] }
    const baselineRun = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ ...runPayload, label: 'Reporting baseline' }) })
    const followUpRun = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ ...runPayload, label: 'Reporting follow-up' }) })
    const baseline = await json(`/api/workspaces/${workspaceId}/assessment-baselines`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'cn-reporting-baseline', assessmentRunId: baselineRun.body.run.id }) })
    assert.equal(baseline.response.status, 201)
    const comparison = await json(`/api/workspaces/${workspaceId}/assessment-runs/${followUpRun.body.run.id}/comparison?baselineRunId=${baselineRun.body.run.id}`, { headers: auth('admin-1') })
    assert.equal(comparison.response.status, 200)
    assert.equal(comparison.body.compatibility.comparable, true)
    assert.match(comparison.body.interpretation, /non-causal/i)
    const timeline = await json(`/api/workspaces/${workspaceId}/assessment-runs/${followUpRun.body.run.id}/action-timeline`, { headers: auth('admin-1') })
    assert.equal(timeline.response.status, 200)
    assert.match(timeline.body.label, /without asserting causality/i)
    const blocked = await json(`/api/workspaces/${workspaceId}/reports/generate`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'bad-report', title: 'Guaranteed AI ranking report', baselineRunId: baselineRun.body.run.id }) })
    assert.equal(blocked.response.status, 400)
    const report = await json(`/api/workspaces/${workspaceId}/reports/generate`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ logicalKey: 'cn-incomplete-report', title: 'CoreNote observed baseline report', baselineRunId: baselineRun.body.run.id }) })
    assert.equal(report.response.status, 201, report.body.error)
    assert.equal(report.body.report.status, 'generated')
    assert.ok(report.body.report.limitations.some((limitation) => /incomplete/i.test(limitation)))
    assert.match(report.body.report.report.noGuaranteeStatement, /does not assert causation/i)
  })

  it('creates an AI-ready evidence-grounded brief with human review gates', async () => {
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
        status: 'approved',
        items: [
          { title: 'CoreNote positioning', excerpt: 'CoreNote is a source-linked knowledge workspace for B2B teams.', taxonomy: 'brand-identity', sourceType: 'website', sourceRef: 'https://corenote.cloud/' },
          { title: 'Traceable answers', excerpt: 'CoreNote links answers back to verified knowledge sources.', taxonomy: 'product-capability', sourceType: 'website', sourceRef: 'https://corenote.cloud/features' },
          { title: 'No ranking promise', excerpt: 'Do not promise AI-platform rankings or citations.', taxonomy: 'prohibited-claim', sourceType: 'manual', sourceRef: 'manual://policy/no-ranking-guarantee' },
        ],
      }),
    })
    assert.equal(evidence.response.status, 201)

    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
        logicalKey: 'brief-cohort', label: 'Brief cohort', status: 'approved',
        queries: [{ text: '知识图谱 AI 知识库工具推荐', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'buyer', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'CoreNote', expectedFacts: ['Source-linked answers'] }],
      }),
    })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
        logicalKey: 'brief-cn', label: 'Brief China market', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'Knowledge-workspace buyers', competitors: ['Notion', 'Obsidian'], providers: ['DeepSeek'], channels: ['官网 FAQ'], evidencePackId: evidence.body.evidencePack.id,
      }),
    })
    const run = await json(`/api/workspaces/${workspaceId}/assessment-runs`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ label: 'Brief baseline', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['DeepSeek'] }),
    })
    const supporting = await json(`/api/workspaces/${workspaceId}/artifacts`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ kind: 'capture-proof', payload: { capturedBy: 'admin-1', captureMethod: 'manual screenshot reference' } }),
    })
    const imported = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/import`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
        queryId: dataset.body.dataset.queries[0].id, providerId: 'DeepSeek', modelIdentity: 'DeepSeek manual capture', collectedAt: '2026-09-27T11:00:00.000Z', sourceRef: 'manual://deepseek/brief-gap', supportingArtifactId: supporting.body.artifact.id,
        rawAnswer: '推荐 Notion 和 Obsidian 作为知识图谱知识库工具。', citations: [{ url: 'https://example.test/notion-review', kind: 'third-party' }], analysis: {},
      }),
    })
    assert.equal(imported.response.status, 201)
    const analyzed = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/analysis`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(analyzed.response.status, 201)
    const diagnoses = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/diagnoses/generate`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(diagnoses.response.status, 201)
    assert.equal(diagnoses.body.diagnoses.length, 1)

    const briefPayload = {
      logicalKey: 'cn-category-discovery-faq', diagnosisId: diagnoses.body.diagnoses[0].id, marketPackId: marketPack.body.marketPack.id,
      targetQueryIds: [dataset.body.dataset.queries[0].id], channel: '官网 FAQ', contentType: 'faq', title: '知识图谱 AI 知识库选型 FAQ',
    }
    const denied = await json(`/api/workspaces/${workspaceId}/content-briefs`, { method: 'POST', headers: auth('viewer-1'), body: JSON.stringify(briefPayload) })
    assert.equal(denied.response.status, 403)

    const created = await json(`/api/workspaces/${workspaceId}/content-briefs`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify(briefPayload) })
    assert.equal(created.response.status, 201)
    assert.equal(created.body.brief.status, 'needs-review')
    assert.equal(created.body.brief.diagnosisId, diagnoses.body.diagnoses[0].id)
    assert.equal(created.body.brief.marketPackId, marketPack.body.marketPack.id)
    assert.equal(created.body.brief.evidencePackId, evidence.body.evidencePack.id)
    assert.equal(created.body.brief.evidencePackVersion, evidence.body.evidencePack.version)
    assert.equal(created.body.brief.brief.targetQueries.length, 1)
    assert.ok(created.body.brief.brief.mandatoryFacts.length >= 2)
    assert.ok(created.body.brief.brief.sourceLinks.includes('https://corenote.cloud/'))
    assert.ok(created.body.brief.brief.prohibitedClaims.some((claim) => /rankings or citations/i.test(claim)))
    assert.ok(created.body.brief.brief.outline.length > 0)
    assert.ok(created.body.brief.brief.reviewCriteria.length > 0)
    assert.ok(created.body.brief.brief.successMeasures.length > 0)
    assert.equal(created.body.aiInvocation.capability, 'content-brief')
    assert.equal(created.body.aiInvocation.status, 'prepared')
    assert.equal(created.body.aiInvocation.humanReviewRequired, true)
    assert.equal(created.body.aiInvocation.promptTemplateVersion, 'content-brief-v2-task-evidence')
    assert.equal(created.body.aiInvocation.modelIdentity, null)
    assert.match(created.body.executionBoundary, /No external model executed/i)

    const prompt = await json(`/api/workspaces/${workspaceId}/artifacts/${created.body.promptArtifact.id}`, { headers: auth('admin-1') })
    assert.equal(prompt.response.status, 200)
    assert.equal(prompt.body.payload.templateVersion, 'content-brief-v2-task-evidence')
    assert.equal(prompt.body.payload.input.evidencePack.id, evidence.body.evidencePack.id)

    const analystApproval = await json(`/api/workspaces/${workspaceId}/content-briefs/${created.body.brief.id}/review`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ status: 'approved', reviewComment: 'Attempting approval.' }) })
    assert.equal(analystApproval.response.status, 403)
    const approved = await json(`/api/workspaces/${workspaceId}/content-briefs/${created.body.brief.id}/review`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ status: 'approved', reviewComment: 'Evidence references and guardrails verified.' }) })
    assert.equal(approved.response.status, 200)
    assert.equal(approved.body.brief.status, 'approved')
    assert.equal(approved.body.brief.reviewedBy, 'reviewer-1')

    const readBack = await json(`/api/workspaces/${workspaceId}/content-briefs/${created.body.brief.id}`, { headers: auth('admin-1') })
    assert.equal(readBack.response.status, 200)
    assert.equal(readBack.body.brief.status, 'approved')
    const publishAttempt = await json(`/api/workspaces/${workspaceId}/content-briefs/${created.body.brief.id}/publish`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(publishAttempt.response.status, 404)
  })
  it('creates a channel-specific provisional draft from an approved brief', async () => {
    const briefs = await json(`/api/workspaces/${workspaceId}/content-briefs`, { headers: auth('admin-1') })
    assert.equal(briefs.response.status, 200)
    const sourceBrief = briefs.body.briefs.find((brief) => brief.status === 'approved' && brief.contentType === 'faq')
    assert.ok(sourceBrief)

    const created = await json(`/api/workspaces/${workspaceId}/content-briefs/${sourceBrief.id}/drafts`, {
      method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ logicalKey: 'cn-category-discovery-faq-draft', title: '知识图谱 AI 知识库选型 FAQ（草稿）', templateOnly: true }),
    })
    assert.equal(created.response.status, 201)
    assert.equal(created.body.draft.status, 'needs-review')
    assert.equal(created.body.draft.sourceBriefId, sourceBrief.id)
    assert.equal(created.body.draft.locale, sourceBrief.locale)
    assert.equal(created.body.draft.channel, sourceBrief.channel)
    assert.equal(created.body.draft.contentType, 'faq')
    assert.equal(created.body.draft.evidencePackId, sourceBrief.evidencePackId)
    assert.equal(created.body.draft.evidencePackVersion, sourceBrief.evidencePackVersion)
    assert.equal(created.body.draft.draft.sourceBrief.id, sourceBrief.id)
    assert.ok(created.body.draft.draft.evidenceRefs.length >= 2)
    assert.match(created.body.draft.draft.contentMarkdown, /Evidence links/)
    assert.match(created.body.draft.draft.generationBoundary, /Template fallback only/i)
    assert.equal(created.body.aiInvocation.capability, 'content-draft')
    assert.equal(created.body.aiInvocation.status, 'completed')
    assert.equal(created.body.aiInvocation.humanReviewRequired, true)
    assert.equal(created.body.aiInvocation.promptTemplateVersion, 'content-draft-template-v1')
    assert.match(created.body.aiInvocation.modelIdentity, /non-LLM/i)
    assert.match(created.body.executionBoundary, /provisional/i)

    const prompt = await json(`/api/workspaces/${workspaceId}/artifacts/${created.body.promptArtifact.id}`, { headers: auth('admin-1') })
    assert.equal(prompt.response.status, 200)
    assert.equal(prompt.body.payload.templateVersion, 'content-draft-template-v1')
    assert.equal(prompt.body.payload.input.sourceBrief.contentType, 'faq')

    const readBack = await json(`/api/workspaces/${workspaceId}/content-drafts/${created.body.draft.id}`, { headers: auth('admin-1') })
    assert.equal(readBack.response.status, 200)
    assert.equal(readBack.body.draft.sourceBriefId, sourceBrief.id)
    const publishingAttempt = await json(`/api/workspaces/${workspaceId}/content-drafts/${created.body.draft.id}/publish`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(publishingAttempt.response.status, 404)
  })
  it('blocks unreferenced measurable claims and snapshots reviewer-approved drafts', async () => {
    const drafts = await json(`/api/workspaces/${workspaceId}/content-drafts`, { headers: auth('admin-1') })
    assert.equal(drafts.response.status, 200)
    const safeDraft = drafts.body.drafts.find((draft) => draft.status === 'needs-review')
    assert.ok(safeDraft)

    const analystApproval = await json(`/api/workspaces/${workspaceId}/content-drafts/${safeDraft.id}/review`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ status: 'approved', reviewComment: 'Attempting approval.' }) })
    assert.equal(analystApproval.response.status, 403)
    const approved = await json(`/api/workspaces/${workspaceId}/content-drafts/${safeDraft.id}/review`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ status: 'approved', reviewComment: 'Evidence-safe FAQ draft approved for the next reviewed workflow stage.' }) })
    assert.equal(approved.response.status, 200)
    assert.equal(approved.body.draft.status, 'approved')
    assert.ok(approved.body.approvedSnapshot)
    assert.equal(approved.body.approvedSnapshot.contentDraftId, safeDraft.id)

    const duplicateApproval = await json(`/api/workspaces/${workspaceId}/content-drafts/${safeDraft.id}/review`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ status: 'approved', reviewComment: 'Retry approval.' }) })
    assert.equal(duplicateApproval.response.status, 409)

    const unsafePayload = {
      ...safeDraft.draft,
      title: 'Unsupported performance claim draft',
      contentMarkdown: `${safeDraft.draft.contentMarkdown}\n\nCoreNote 提升 40% 的团队效率。`,
    }
    const detected = detectDraftClaims(unsafePayload)
    assert.equal(detected.length, 1)
    assert.equal(detected[0].claimType, 'measurable-performance')
    assert.equal(detected[0].status, 'unresolved')

    const invocation = application.repository.createAiInvocation({
      workspaceId, actorId: 'analyst-1', capability: 'content-draft', modelIdentity: 'test-content-generator', promptTemplateVersion: 'content-draft-template-v1', status: 'completed', inputRefs: [{ name: 'test', ref: 'test://unsafe-claim' }],
    })
    const unsafeDraft = application.repository.createContentDraft({
      workspaceId, actorId: 'analyst-1', logicalKey: 'unsupported-performance-draft', sourceBriefId: safeDraft.sourceBriefId,
      locale: safeDraft.locale, channel: safeDraft.channel, contentType: safeDraft.contentType, evidencePackId: safeDraft.evidencePackId, evidencePackVersion: safeDraft.evidencePackVersion,
      title: unsafePayload.title, draft: unsafePayload, aiInvocationId: invocation.id, status: 'needs-review',
    })
    const claim = application.repository.createDraftClaimValidation({ workspaceId, actorId: 'analyst-1', contentDraftId: unsafeDraft.id, ...detected[0] })

    const blocked = await json(`/api/workspaces/${workspaceId}/content-drafts/${unsafeDraft.id}/review`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ status: 'approved', reviewComment: 'Try approval before resolving claim.' }) })
    assert.equal(blocked.response.status, 409)
    assert.match(blocked.body.error, /blocked/i)

    const deniedResolution = await json(`/api/workspaces/${workspaceId}/content-drafts/${unsafeDraft.id}/claims/${claim.id}/resolve`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ status: 'supported', evidenceRefs: ['https://corenote.cloud/case-study'], resolutionComment: 'Attempting reviewer resolution.' }) })
    assert.equal(deniedResolution.response.status, 403)
    const resolved = await json(`/api/workspaces/${workspaceId}/content-drafts/${unsafeDraft.id}/claims/${claim.id}/resolve`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ status: 'supported', evidenceRefs: ['https://corenote.cloud/case-study'], resolutionComment: 'Verified against the approved case-study evidence.' }) })
    assert.equal(resolved.response.status, 200)
    assert.equal(resolved.body.claim.status, 'supported')
    assert.equal(resolved.body.claim.evidenceRefs.length, 1)

    const approvedUnsafe = await json(`/api/workspaces/${workspaceId}/content-drafts/${unsafeDraft.id}/review`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ status: 'approved', reviewComment: 'Performance statement is now supported by cited evidence.' }) })
    assert.equal(approvedUnsafe.response.status, 200)
    const readBack = await json(`/api/workspaces/${workspaceId}/content-drafts/${unsafeDraft.id}`, { headers: auth('admin-1') })
    assert.equal(readBack.response.status, 200)
    assert.equal(readBack.body.claimValidations[0].status, 'supported')
    assert.equal(readBack.body.approvedSnapshot.draftVersion, unsafeDraft.version)
  })
  it('creates reviewed human distribution tasks from immutable approved snapshots', async () => {
    const drafts = await json(`/api/workspaces/${workspaceId}/content-drafts`, { headers: auth('admin-1') })
    const approvedDraft = drafts.body.drafts.find((draft) => draft.status === 'approved')
    assert.ok(approvedDraft)
    const draftDetail = await json(`/api/workspaces/${workspaceId}/content-drafts/${approvedDraft.id}`, { headers: auth('admin-1') })
    assert.equal(draftDetail.response.status, 200)
    const snapshot = draftDetail.body.approvedSnapshot
    assert.ok(snapshot)
    const sourceBrief = await json(`/api/workspaces/${workspaceId}/content-briefs/${draftDetail.body.draft.sourceBriefId}`, { headers: auth('admin-1') })
    assert.equal(sourceBrief.response.status, 200)
    const targetQueryIds = sourceBrief.body.brief.brief.targetQueries.map((query) => query.id)
    const payload = {
      approvedSnapshotId: snapshot.id,
      ownerId: 'analyst-1',
      channel: snapshot.content.channel,
      editorialConstraints: ['Keep every material product claim source-linked.', 'Do not imply guaranteed AI visibility or ranking outcomes.'],
      targetQueryIds,
      scheduledFor: '2026-10-06T09:00:00.000Z',
      notes: 'Coordinate a human-reviewed channel submission and retain proof after completion.',
    }

    const analystCreate = await json(`/api/workspaces/${workspaceId}/distribution-tasks`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify(payload) })
    assert.equal(analystCreate.response.status, 403)

    const invocation = application.repository.createAiInvocation({
      workspaceId, actorId: 'analyst-1', capability: 'content-draft', modelIdentity: 'test-content-generator', promptTemplateVersion: 'content-draft-template-v1', status: 'completed', inputRefs: [{ name: 'test', ref: 'test://unreviewed-draft' }],
    })
    const unreviewedDraft = application.repository.createContentDraft({
      workspaceId, actorId: 'analyst-1', logicalKey: 'unreviewed-distribution-attempt', sourceBriefId: draftDetail.body.draft.sourceBriefId,
      locale: draftDetail.body.draft.locale, channel: draftDetail.body.draft.channel, contentType: draftDetail.body.draft.contentType,
      evidencePackId: draftDetail.body.draft.evidencePackId, evidencePackVersion: draftDetail.body.draft.evidencePackVersion,
      title: 'Unreviewed distribution attempt', draft: draftDetail.body.draft.draft, aiInvocationId: invocation.id, status: 'needs-review',
    })
    const unreviewedAttempt = await json(`/api/workspaces/${workspaceId}/distribution-tasks`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ ...payload, approvedSnapshotId: unreviewedDraft.id, contentDraftId: unreviewedDraft.id }) })
    assert.equal(unreviewedAttempt.response.status, 404)

    const created = await json(`/api/workspaces/${workspaceId}/distribution-tasks`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify(payload) })
    assert.equal(created.response.status, 201)
    assert.equal(created.body.distributionTask.status, 'planned')
    assert.equal(created.body.distributionTask.approvedSnapshotId, snapshot.id)
    assert.equal(created.body.distributionTask.proofArtifactId, null)
    assert.match(created.body.executionBoundary, /No public content was posted/i)

    const taskId = created.body.distributionTask.id
    const started = await json(`/api/workspaces/${workspaceId}/distribution-tasks/${taskId}/status`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ status: 'in-progress' }) })
    assert.equal(started.response.status, 200)
    const submitted = await json(`/api/workspaces/${workspaceId}/distribution-tasks/${taskId}/status`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ status: 'submitted' }) })
    assert.equal(submitted.response.status, 200)
    const noProofCompletion = await json(`/api/workspaces/${workspaceId}/distribution-tasks/${taskId}/status`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ status: 'completed' }) })
    assert.equal(noProofCompletion.response.status, 409)

    const proof = await json(`/api/workspaces/${workspaceId}/artifacts`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ kind: 'distribution-proof', payload: { channel: snapshot.content.channel, submittedUrl: 'https://example.test/editorial-proof', capturedAt: '2026-10-06T10:00:00.000Z' } }) })
    assert.equal(proof.response.status, 201)
    const completed = await json(`/api/workspaces/${workspaceId}/distribution-tasks/${taskId}/status`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ status: 'completed', proofArtifactId: proof.body.artifact.id }) })
    assert.equal(completed.response.status, 200)
    assert.equal(completed.body.distributionTask.status, 'completed')
    assert.equal(completed.body.distributionTask.proofArtifactId, proof.body.artifact.id)
    assert.ok(completed.body.distributionTask.completedAt)

    const autoPublishAttempt = await json(`/api/workspaces/${workspaceId}/distribution-tasks/${taskId}/publish`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(autoPublishAttempt.response.status, 404)

    const otherWorkspace = await json('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: 'Tenant B', brand: 'Other', products: [], administrator: { id: 'other-admin', name: 'Other Admin' } }) })
    assert.equal(otherWorkspace.response.status, 201)
    const crossWorkspaceSnapshot = await json(`/api/workspaces/${otherWorkspace.body.workspace.id}/distribution-tasks`, { method: 'POST', headers: auth('other-admin', otherWorkspace.body.workspace.id), body: JSON.stringify({ ...payload, approvedSnapshotId: snapshot.id, ownerId: 'other-admin' }) })
    assert.equal(crossWorkspaceSnapshot.response.status, 404)

    const audit = await json(`/api/workspaces/${workspaceId}/audit`, { headers: auth('admin-1') })
    assert.ok(audit.body.events.some((event) => event.action === 'distribution-task.created'))
    assert.ok(audit.body.events.some((event) => event.action === 'distribution-task.status.completed'))
  })

  it('imports controlled manual CoreNote and website evidence with a retained provenance artifact', async () => {
    const collectedAt = '2026-09-27T08:30:00.000Z'
    const coreNote = await json(`/api/workspaces/${workspaceId}/evidence/controlled-manual-import`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ collectionMode: 'controlled-manual', sourceType: 'corenote', sourceSystem: 'CoreNote controlled export', collector: 'analyst-1', collectedAt, status: 'draft', items: [{ title: 'CoreNote capability', excerpt: 'Approved source-linked product fact.', taxonomy: 'product-capability', sourceRef: 'corenote://export/2026-09-27/capability' }] }) })
    assert.equal(coreNote.response.status, 201)
    assert.equal(coreNote.body.evidencePack.items[0].sourceType, 'corenote')
    assert.equal(coreNote.body.collectionMode, 'controlled-manual')
    const artifact = await json(`/api/workspaces/${workspaceId}/artifacts/${coreNote.body.importArtifact.id}`, { headers: auth('admin-1') })
    assert.equal(artifact.response.status, 200)
    assert.equal(artifact.body.payload.collector, 'analyst-1')
    assert.equal(artifact.body.payload.collectedAt, collectedAt)
    assert.equal(artifact.body.payload.items[0].sourceRef, 'corenote://export/2026-09-27/capability')

    const website = await json(`/api/workspaces/${workspaceId}/evidence/controlled-manual-import`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ collectionMode: 'controlled-manual', sourceType: 'website', sourceSystem: 'Official website', collector: 'analyst-1', collectedAt, status: 'draft', items: [{ title: 'Official website fact', excerpt: 'Website fallback evidence.', taxonomy: 'brand-identity', sourceRef: 'https://example.test/official' }] }) })
    assert.equal(website.response.status, 201)
    assert.equal(website.body.evidencePack.items[0].sourceType, 'website')

    const rejected = await json(`/api/workspaces/${workspaceId}/evidence/controlled-manual-import`, { method: 'POST', headers: auth('analyst-1'), body: JSON.stringify({ collectionMode: 'api', sourceType: 'corenote', collector: 'analyst-1', collectedAt, status: 'draft', items: [{ title: 'Bad import', excerpt: 'Should fail.', taxonomy: 'product-capability', sourceRef: 'corenote://bad' }] }) })
    assert.equal(rejected.response.status, 400)
    assert.match(rejected.body.error, /controlled-manual/)
  })

  it('blocks fabricated reputation, citation, link, and publication requests with an audit explanation', async () => {
    const drafts = await json(`/api/workspaces/${workspaceId}/content-drafts`, { headers: auth('admin-1') })
    const approvedDraft = drafts.body.drafts.find((draft) => draft.status === 'approved')
    const draftDetail = await json(`/api/workspaces/${workspaceId}/content-drafts/${approvedDraft.id}`, { headers: auth('admin-1') })
    const snapshot = draftDetail.body.approvedSnapshot
    const sourceBrief = await json(`/api/workspaces/${workspaceId}/content-briefs/${draftDetail.body.draft.sourceBriefId}`, { headers: auth('admin-1') })
    const basePayload = {
      approvedSnapshotId: snapshot.id,
      ownerId: 'analyst-1',
      channel: snapshot.content.channel,
      targetQueryIds: sourceBrief.body.brief.brief.targetQueries.map((query) => query.id),
      scheduledFor: '2026-10-07T09:00:00.000Z',
    }
    const prohibitedConstraints = [
      'Create fabricated customer reviews to improve trust.',
      'Add fabricated citations that make the product look authoritative.',
      'Buy backlinks through a deceptive link farm.',
      'Use automatic mass publication across every channel without review.',
    ]
    for (const constraint of prohibitedConstraints) {
      const blocked = await json(`/api/workspaces/${workspaceId}/distribution-tasks`, { method: 'POST', headers: auth('reviewer-1'), body: JSON.stringify({ ...basePayload, editorialConstraints: [constraint] }) })
      assert.equal(blocked.response.status, 422)
      assert.match(blocked.body.error, /prohibited/i)
    }

    const guardrailInventory = await json(`/api/workspaces/${workspaceId}/ethical-guardrails`, { headers: auth('admin-1') })
    assert.equal(guardrailInventory.response.status, 200)
    assert.equal(guardrailInventory.body.guardrails.length, 4)
    const audit = await json(`/api/workspaces/${workspaceId}/audit`, { headers: auth('admin-1') })
    const blockedEvents = audit.body.events.filter((event) => event.action === 'ethical-guardrail.blocked')
    assert.ok(blockedEvents.length >= prohibitedConstraints.length)
    assert.ok(blockedEvents.every((event) => /prohibited/i.test(event.detail)))
  })

  it('reports generic tenant-scoped workflow readiness without executing providers or publishing content', async () => {
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
        status: 'approved',
        items: [
          { title: 'Readiness product fact', excerpt: 'The product grounds answers in approved sources.', taxonomy: 'product-capability', sourceType: 'manual', sourceRef: 'manual://readiness/product-fact' },
          { title: 'Readiness claims policy', excerpt: 'Do not promise rankings, citations, traffic, or conversion outcomes.', taxonomy: 'prohibited-claim', sourceType: 'manual', sourceRef: 'manual://readiness/no-guarantee' },
        ],
      }),
    })
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
        logicalKey: 'workflow-readiness-cn', label: 'Workflow readiness CN cohort', status: 'approved',
        queries: [{ text: '支持来源可追溯的企业 AI 知识库工具有哪些？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'knowledge-lead', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'General B2B knowledge platform', expectedFacts: ['source-cited answers'] }],
      }),
    })
    const provider = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ providerId: 'Kimi', market: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual', credentialReference: 'secret://geo-harness/kimi-manual-export-policy' }),
    })
    assert.equal(provider.response.status, 201)
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
        logicalKey: 'workflow-readiness-cn', label: 'Workflow readiness China', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'Enterprise knowledge-base leaders', competitors: ['Notion'], providers: ['Kimi'], channels: ['官网内容中心', '知乎'], evidencePackId: evidence.body.evidencePack.id,
      }),
    })
    assert.equal(marketPack.response.status, 201)

    const assessmentReady = await json(`/api/workspaces/${workspaceId}/market-packs/${marketPack.body.marketPack.id}/workflow-readiness`, { headers: auth('viewer-1') })
    assert.equal(assessmentReady.response.status, 200)
    assert.equal(assessmentReady.body.readiness.stage, 'assessment-ready')
    assert.equal(assessmentReady.body.readiness.readiness.readyForNewAssessment, true)
    assert.equal(assessmentReady.body.readiness.nextAllowedOperation, 'create-controlled-manual-assessment')
    assert.deepEqual(assessmentReady.body.readiness.providers.missingProviderIds, [])
    assert.equal(assessmentReady.body.readiness.collectionBoundary.includes('never executes providers'), true)
    assert.equal(assessmentReady.body.readiness.dataset.id, dataset.body.dataset.id)

    const run = await json(`/api/workspaces/${workspaceId}/assessment-runs`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ label: 'Workflow readiness baseline', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['Kimi'] }),
    })
    assert.equal(run.response.status, 201)
    const collecting = await json(`/api/workspaces/${workspaceId}/market-packs/${marketPack.body.marketPack.id}/workflow-readiness?assessmentRunId=${run.body.run.id}`, { headers: auth('viewer-1') })
    assert.equal(collecting.response.status, 200)
    assert.equal(collecting.body.readiness.stage, 'collection-in-progress')
    assert.equal(collecting.body.readiness.readiness.readyForDiagnosis, false)
    assert.equal(collecting.body.readiness.assessmentRun.expectedObservationCount, 1)
    assert.match(collecting.body.readiness.blockingReasons[0], /pending/i)

    const supporting = await json(`/api/workspaces/${workspaceId}/artifacts`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ kind: 'capture-proof', payload: { capturedBy: 'admin-1', captureMethod: 'controlled manual export' } }),
    })
    const imported = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/import`, {
      method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
        queryId: dataset.body.dataset.queries[0].id, providerId: 'Kimi', modelIdentity: 'Kimi controlled-manual capture', collectedAt: '2026-09-27T14:00:00.000Z', sourceRef: 'manual://kimi/workflow-readiness', supportingArtifactId: supporting.body.artifact.id,
        rawAnswer: '推荐 Notion 作为企业知识库工具，也可评估提供来源可追溯答案的企业 AI 知识库。', citations: [{ url: 'https://example.test/knowledge-base', kind: 'third-party' }], analysis: {},
      }),
    })
    assert.equal(imported.response.status, 201)
    const analyzed = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/analysis`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(analyzed.response.status, 201)
    const diagnoses = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/diagnoses/generate`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({}) })
    assert.equal(diagnoses.response.status, 201)
    assert.ok(diagnoses.body.diagnoses.length > 0)

    const briefReady = await json(`/api/workspaces/${workspaceId}/market-packs/${marketPack.body.marketPack.id}/workflow-readiness?assessmentRunId=${run.body.run.id}`, { headers: auth('viewer-1') })
    assert.equal(briefReady.response.status, 200)
    assert.equal(briefReady.body.readiness.stage, 'content-brief-ready')
    assert.equal(briefReady.body.readiness.readiness.readyForContentBrief, true)
    assert.equal(briefReady.body.readiness.diagnoses.generatedCount, diagnoses.body.diagnoses.length)
    assert.deepEqual(briefReady.body.readiness.contentBriefs.allowedChannels, ['官网内容中心', '知乎'])

    const otherWorkspace = await json('/api/workspaces', {
      method: 'POST', body: JSON.stringify({ name: 'Other readiness tenant', brand: 'Other', products: [], administrator: { id: 'other-admin', name: 'Other Admin' } }),
    })
    const isolated = await json(`/api/workspaces/${otherWorkspace.body.workspace.id}/market-packs/${marketPack.body.marketPack.id}/workflow-readiness`, { headers: auth('other-admin', otherWorkspace.body.workspace.id) })
    assert.equal(isolated.response.status, 404)
  })

  it('exports a controlled-manual batch template and imports multiple immutable answer records together', async () => {
    const dataset = await json(`/api/workspaces/${workspaceId}/datasets`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      logicalKey: 'batch-import-cohort', label: 'Batch import cohort', status: 'approved', queries: [
        { text: '支持来源引用的 AI 知识库有哪些？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'buyer', businessStage: 'evaluate', intent: 'category-discovery', priority: 'P0', targetProduct: 'Generic product', expectedFacts: ['source cited answers'] },
        { text: '企业如何评估 AI 知识库的可追溯性？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'owner', businessStage: 'evaluate', intent: 'evaluation', priority: 'P1', targetProduct: 'Generic product', expectedFacts: ['auditability'] },
      ],
    }) })
    assert.equal(dataset.response.status, 201)
    const evidence = await json(`/api/workspaces/${workspaceId}/evidence`, { headers: auth('admin-1') })
    const marketPack = await json(`/api/workspaces/${workspaceId}/market-packs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      logicalKey: 'batch-import-cn', label: 'China batch import market', status: 'approved', market: 'CN', locale: 'zh-CN', audience: 'B2B SaaS teams', competitors: ['Notion'], providers: ['GLM'], channels: ['官网内容中心'], evidencePackId: evidence.body.evidencePack.id,
    }) })
    assert.equal(marketPack.response.status, 201)
    const provider = await json(`/api/workspaces/${workspaceId}/model-providers`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ providerId: 'GLM', market: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual' }) })
    assert.equal(provider.response.status, 201)
    const run = await json(`/api/workspaces/${workspaceId}/assessment-runs`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ label: 'Batch controlled-manual baseline', datasetId: dataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id, locale: 'zh-CN', providers: ['GLM'] }) })
    assert.equal(run.response.status, 201)

    const template = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/batch-import-template`, { headers: auth('viewer-1') })
    assert.equal(template.response.status, 200)
    assert.equal(template.body.template.collectionMode, 'controlled-manual')
    assert.equal(template.body.template.items.length, 2)
    assert.equal(template.body.template.items[0].rawAnswer, '')

    const batch = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/batch-import`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({
      collectionMode: 'controlled-manual', rows: template.body.template.items.map((item, index) => ({
        queryId: item.queryId, providerId: item.providerId, modelIdentity: 'GLM controlled export', sourceRef: `manual://glm/batch-${index + 1}`,
        collectedAt: `2026-09-27T1${index}:00:00.000Z`, rawAnswer: index === 0 ? '可评估支持来源可追溯回答的企业 AI 知识库。' : '企业应记录来源、模型标识与采集时间。',
        citations: index === 0 ? [{ url: 'https://example.test/knowledge-base', kind: 'third-party' }] : [], analysis: {},
      })),
    }) })
    assert.equal(batch.response.status, 201)
    assert.equal(batch.body.collectionMode, 'controlled-manual')
    assert.equal(batch.body.imported.length, 2)
    assert.equal(batch.body.run.isComplete, true)
    assert.equal(batch.body.imported[1].citations.length, 0)

    const exhausted = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/batch-import-template`, { headers: auth('viewer-1') })
    assert.equal(exhausted.response.status, 200)
    assert.equal(exhausted.body.template.items.length, 0)
    const duplicate = await json(`/api/workspaces/${workspaceId}/assessment-runs/${run.body.run.id}/observations/batch-import`, { method: 'POST', headers: auth('admin-1'), body: JSON.stringify({ collectionMode: 'controlled-manual', rows: [{ queryId: dataset.body.dataset.queries[0].id, providerId: 'GLM', modelIdentity: 'GLM controlled export', sourceRef: 'manual://glm/duplicate', rawAnswer: 'Duplicate must fail.', citations: [] }] }) })
    assert.equal(duplicate.response.status, 409)
  })

})









