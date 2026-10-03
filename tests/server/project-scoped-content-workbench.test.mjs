import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApplication } from '../../server/application.mjs'

let application
let dataDir
let workspaceId
let adminId
let projectId

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'geo-project-content-workbench-'))
  application = createApplication({ config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0 } })
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + application.server.address().port
  const response = await fetch(origin + '/api/development/sample-workspace', { method: 'POST', headers: { 'content-type': 'application/json' } })
  const body = await response.json()
  workspaceId = body.sample.workspace.id
  adminId = body.sample.administrator.id
  projectId = application.repository.db.prepare('SELECT id FROM brand_diagnostic_cases WHERE workspace_id = ? ORDER BY created_at LIMIT 1').get(workspaceId).id
})

after(async () => {
  await new Promise((resolve) => application.server.close(resolve))
  application.database.close()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('project-scoped content delivery package', () => {
  it('exports approved Markdown with evidence and immutable follow-up scope', () => {
    const repository = application.repository
    const sourceContext = {
      queryScope: [{ id: 'query-1', question: '哪些知识库工具支持来源可追溯回答？', intent: 'evaluation', priority: 'high' }],
      approvedFacts: [{ id: 'fact-1', statement: '产品支持来源可追溯回答。', sourceUrl: 'https://example.com/fact' }],
      reviewedObservations: [{ platform: 'controlled-platform', taskId: 'task-1', answerUrl: 'https://example.com/answer', citations: ['https://example.com/citation'] }],
      testRun: { id: 'run-1' },
      dataset: { id: 'dataset-1' },
    }
    const strategy = repository.createContentStrategy({ workspaceId, projectId, actorId: adminId, logicalKey: 'package-strategy', queryIds: ['query-1'], channels: ['官网 Blog'], title: 'Evidence-first package strategy', objective: 'Create a traceable answer for the approved query.', sourceContext, strategy: { prohibitedClaims: ['No GEO guarantees'] }, status: 'approved' })
    const briefInvocation = repository.createAiInvocation({ workspaceId, projectId, actorId: adminId, capability: 'content-brief', promptTemplateVersion: 'test-brief-v1' })
    const brief = repository.createContentBrief({ workspaceId, projectId, actorId: adminId, logicalKey: 'package-brief', locale: 'zh-CN', channel: '官网 Blog', contentType: 'editorial', title: 'Approved package brief', sourceContext, brief: { targetQueries: sourceContext.queryScope, mandatoryFacts: sourceContext.approvedFacts, sourceLinks: ['https://example.com/fact'], queryEvidence: { evidenceBoundary: '仅使用已批准证据。' } }, aiInvocationId: briefInvocation.id, contentStrategyId: strategy.id, status: 'approved' })
    const draftInvocation = repository.createAiInvocation({ workspaceId, projectId, actorId: adminId, capability: 'content-draft', promptTemplateVersion: 'test-draft-v1' })
    const draft = repository.createContentDraft({ workspaceId, projectId, actorId: adminId, logicalKey: 'package-draft', sourceBriefId: brief.id, locale: 'zh-CN', channel: '官网 Blog', contentType: 'editorial', sourceContext, title: 'Approved package draft', draft: { contentMarkdown: '# 可追溯知识库工具', sourceLinks: ['https://example.com/content'], generationBoundary: 'AI output requires human review.' }, aiInvocationId: draftInvocation.id, status: 'needs-review' })
    const claim = repository.createDraftClaimValidation({ workspaceId, projectId, actorId: adminId, contentDraftId: draft.id, statement: '产品支持来源可追溯回答。', claimType: 'ranking-or-citation', evidenceRefs: ['https://example.com/fact'], status: 'supported', detectorVersion: 'test-v1' })
    assert.equal(claim.status, 'supported')
    repository.reviewContentDraft({ workspaceId, projectId, draftId: draft.id, actorId: adminId, status: 'approved', reviewComment: 'All claims checked.' })
    const deliveryPackage = repository.getContentDeliveryPackage(workspaceId, draft.id, projectId)
    assert.equal(deliveryPackage.projectId, projectId)
    assert.equal(deliveryPackage.markdown, '# 可追溯知识库工具')
    assert.deepEqual(deliveryPackage.followUpScope.targetQueryIds, ['query-1'])
    assert.ok(deliveryPackage.evidenceMap.sourceLinks.includes('https://example.com/fact'))
    assert.match(deliveryPackage.boundary, /不会自动向外部渠道发布/)
    assert.throws(() => repository.getContentDeliveryPackage(workspaceId, draft.id, 'different-project'), /Content draft was not found/)
  })
})



