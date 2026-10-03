import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApplication } from '../../server/application.mjs'

let application
let origin
const json = async (path, options = {}) => {
  const response = await fetch(origin + path, { headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }, ...options })
  return { response, body: await response.json() }
}
const input = (markets) => ({
  workspaceName: 'Onboarding tenant', administrator: { id: 'admin-1', name: 'Admin' }, brandName: 'Acme Knowledge', website: 'https://acme.example/',
  industry: 'AI knowledge base', audience: '企业知识库负责人', objective: '建立可靠的首轮 GEO 基线', competitors: ['Notion'], queryTarget: 20, markets,
})
const auth = (workspaceId, userId = 'admin-1') => ({ 'x-workspace-id': workspaceId, 'x-user-id': userId })

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-onboarding-api-'))
  application = createApplication({ config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0, environment: 'test' } })
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  origin = 'http://127.0.0.1:' + application.server.address().port

})
after(async () => { await new Promise((resolve) => application.server.close(resolve)); application.database.close(); rmSync(application.config.dataDir, { recursive: true, force: true }) })

describe('GEO diagnostic onboarding', () => {
  it('rejects incomplete onboarding without persisting a workspace', async () => {
    const response = await json('/api/workspaces/onboard', { method: 'POST', body: JSON.stringify({ brandName: 'Broken' }) })
    assert.equal(response.response.status, 400)
    assert.match(response.body.error, /brandName|品牌诊断/i)
    assert.equal(application.database.prepare('SELECT COUNT(*) AS count FROM workspaces').get().count, 0)
  })

  it('creates separated CN draft plans without fabricated runs or results', async () => {
    const created = await json('/api/workspaces/onboard', { method: 'POST', body: JSON.stringify(input([{ market: 'CN', locale: 'zh-CN', providers: ['DeepSeek', 'Kimi'], channels: ['官网内容中心', '知乎'] }])) })
    assert.equal(created.response.status, 201)
    assert.equal(created.body.setup.project.status, 'ready-for-review')
    assert.equal(created.body.setup.datasets[0].status, 'draft')
    assert.equal(created.body.setup.datasets[0].queries.length, 20)
    assert.deepEqual(created.body.setup.collectionPlans.map((plan) => plan.providerId), ['DeepSeek', 'Kimi'])
    assert.ok(created.body.setup.collectionPlans.every((plan) => plan.status === 'planned' && plan.assessmentRunId === null && plan.coverage.expected === 0))
    assert.equal(application.database.prepare('SELECT COUNT(*) AS count FROM assessment_runs WHERE workspace_id = ?').get(created.body.workspace.id).count, 0)
  })

  it('keeps global providers and dual-market assets distinct, then activates controlled manual queues', async () => {
    const created = await json('/api/workspaces/onboard', { method: 'POST', body: JSON.stringify(input([
      { market: 'CN', locale: 'zh-CN', providers: ['DeepSeek'], channels: ['官网内容中心'] },
      { market: 'GLOBAL', locale: 'en-US', providers: ['ChatGPT', 'Perplexity'], channels: ['Blog', 'Help Center'] },
    ])) })
    assert.equal(created.response.status, 201)
    const setup = created.body.setup
    assert.equal(setup.marketPacks.length, 2)
    assert.ok(setup.datasets.every((dataset) => dataset.status === 'draft'))
    assert.equal(setup.collectionPlans.filter((plan) => plan.providerId === 'ChatGPT').length, 1)
    assert.equal(setup.collectionPlans.filter((plan) => plan.providerId === 'DeepSeek').length, 1)
    const activate = await json(`/api/workspaces/${created.body.workspace.id}/diagnostic-projects/${setup.project.id}/activate`, { method: 'POST', headers: auth(created.body.workspace.id), body: JSON.stringify({ reviewComment: 'Administrator reviewed scope, claims, markets and controlled-manual boundary.' }) })
    assert.equal(activate.response.status, 200)
    assert.equal(activate.body.setup.project.status, 'collecting')
    assert.ok(activate.body.setup.collectionPlans.every((plan) => plan.assessmentRunId && plan.status === 'collecting'))
    const runs = application.repository.listAssessmentRuns(created.body.workspace.id)
    assert.equal(runs.length, 2)
    assert.deepEqual(runs.map((run) => run.providers.length).sort(), [1, 2])
    assert.equal(runs.reduce((count, run) => count + run.plannedObservationCount, 0), 20 * 3)
  })

  it('requires administrator rights to recover an existing empty workspace', async () => {
    const workspace = application.repository.createWorkspace({ name: 'Legacy empty tenant', brand: 'Legacy', administrator: { id: 'legacy-admin', name: 'Legacy admin' } })
    application.repository.addMember({ workspaceId: workspace.id, actorId: 'legacy-admin', userId: 'viewer-1', name: 'Viewer', role: 'viewer' })
    const denied = await json(`/api/workspaces/${workspace.id}/onboard`, { method: 'POST', headers: auth(workspace.id, 'viewer-1'), body: JSON.stringify(input([{ market: 'GLOBAL', locale: 'en-US', providers: ['Claude'], channels: ['Blog'] }])) })
    assert.equal(denied.response.status, 403)
    const recovered = await json(`/api/workspaces/${workspace.id}/onboard`, { method: 'POST', headers: auth(workspace.id, 'legacy-admin'), body: JSON.stringify(input([{ market: 'GLOBAL', locale: 'en-US', providers: ['Claude'], channels: ['Blog'] }])) })
    assert.equal(recovered.response.status, 201)
    assert.equal(recovered.body.workspace.id, workspace.id)
  })
  it('creates governed problem monitoring plans and queues only manual rechecks', async () => {
    const created = await json('/api/workspaces/onboard', { method: 'POST', body: JSON.stringify(input([{ market: 'CN', locale: 'zh-CN', providers: ['DeepSeek', 'Kimi'], channels: ['官网内容中心', '知乎'] }])) })
    const workspaceId = created.body.workspace.id
    const setup = created.body.setup
    await json(`/api/workspaces/${workspaceId}/diagnostic-projects/${setup.project.id}/activate`, { method: 'POST', headers: auth(workspaceId), body: JSON.stringify({ reviewComment: 'Approved monitored query scope and controlled-manual evidence boundary.' }) })
    const marketPack = application.repository.listMarketPacks(workspaceId)[0]
    const dataset = application.repository.getDataset(application.repository.listAssessmentRuns(workspaceId)[0].datasetId)
    const queryId = dataset.queries[0].id

    const plan = await json(`/api/workspaces/${workspaceId}/monitoring-plans`, { method: 'POST', headers: auth(workspaceId), body: JSON.stringify({ marketPackId: marketPack.id, queryId, providerIds: ['DeepSeek'], cadence: 'daily' }) })
    assert.equal(plan.response.status, 201)
    assert.equal(plan.body.plan.status, 'active')
    assert.equal(plan.body.plan.lastAssessmentRunId, null)
    assert.equal(plan.body.plan.query.id, queryId)

    const recheck = await json(`/api/workspaces/${workspaceId}/monitoring-plans/${plan.body.plan.id}/queue-recheck`, { method: 'POST', headers: auth(workspaceId) })
    assert.equal(recheck.response.status, 201)
    assert.match(recheck.body.collectionBoundary, /No AI provider was automatically executed/i)
    assert.equal(recheck.body.run.providers[0], 'DeepSeek')
    assert.equal(recheck.body.run.cohortQueryIds.length, 1)
    assert.equal(recheck.body.run.completion.imported, 0)
    assert.equal(recheck.body.run.completion.queued, 1)

    const paused = await json(`/api/workspaces/${workspaceId}/monitoring-plans/${plan.body.plan.id}`, { method: 'PATCH', headers: auth(workspaceId), body: JSON.stringify({ status: 'paused' }) })
    assert.equal(paused.response.status, 200)
    assert.equal(paused.body.plan.status, 'paused')
    const blocked = await json(`/api/workspaces/${workspaceId}/monitoring-plans/${plan.body.plan.id}/queue-recheck`, { method: 'POST', headers: auth(workspaceId) })
    assert.equal(blocked.response.status, 400)
  })

})