import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApplication } from '../server/application.mjs'

const dataDir = mkdtempSync(join(tmpdir(), 'geo-harness-release-preflight-'))
const application = createApplication({
  config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0 },
})

const json = async (origin, path, options = {}) => {
  const response = await fetch(`${origin}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  })
  const body = await response.json()
  return { response, body }
}

const auth = (userId, workspaceId) => ({ 'x-user-id': userId, 'x-workspace-id': workspaceId })
const request = (origin, path, method, workspaceId, userId, body) => json(origin, path, {
  method,
  headers: auth(userId, workspaceId),
  body: body === undefined ? undefined : JSON.stringify(body),
})

const query = (index) => ({
  text: `支持知识图谱与来源可追溯回答的 AI 知识库工具有哪些？场景 ${index}`,
  market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'knowledge-lead',
  businessStage: 'discover', intent: 'category-discovery', priority: 'P1',
  targetProduct: 'General B2B knowledge platform', expectedFacts: ['来源可追溯回答'],
  riskMetadata: { factualRisk: 'high' },
})

let origin
try {
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${application.server.address().port}`

  const tenantA = await json(origin, '/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: 'Release preflight tenant A', brand: 'Pilot A', products: ['B2B knowledge platform'], administrator: { id: 'admin-a', name: 'Admin A' } }),
  })
  const tenantB = await json(origin, '/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: 'Release preflight tenant B', brand: 'Pilot B', products: ['B2B knowledge platform'], administrator: { id: 'admin-b', name: 'Admin B' } }),
  })
  assert.equal(tenantA.response.status, 201)
  assert.equal(tenantB.response.status, 201)
  const workspaceA = tenantA.body.workspace.id
  const workspaceB = tenantB.body.workspace.id
  application.repository.addMember({ workspaceId: workspaceA, userId: 'analyst-a', name: 'Analyst A', role: 'analyst' })
  application.repository.addMember({ workspaceId: workspaceA, userId: 'viewer-a', name: 'Viewer A', role: 'viewer' })

  const deniedWrite = await request(origin, `/api/workspaces/${workspaceA}/evidence`, 'POST', workspaceA, 'viewer-a', {
    status: 'draft',
    items: [{ title: 'Blocked write', excerpt: 'Must not be stored.', taxonomy: 'product-capability', sourceType: 'manual', sourceRef: 'manual://blocked' }],
  })
  assert.equal(deniedWrite.response.status, 403)

  const crossTenantWrite = await request(origin, `/api/workspaces/${workspaceA}/evidence`, 'POST', workspaceA, 'admin-b', {
    status: 'draft',
    items: [{ title: 'Cross tenant write', excerpt: 'Must not be stored.', taxonomy: 'product-capability', sourceType: 'manual', sourceRef: 'manual://cross-tenant' }],
  })
  assert.equal(crossTenantWrite.response.status, 403)

  const artifact = await request(origin, `/api/workspaces/${workspaceA}/artifacts`, 'POST', workspaceA, 'admin-a', {
    kind: 'capture-proof', payload: { capturedBy: 'admin-a', captureMethod: 'controlled-manual' },
  })
  assert.equal(artifact.response.status, 201)
  const crossTenantArtifact = await request(origin, `/api/workspaces/${workspaceB}/artifacts/${artifact.body.artifact.id}`, 'GET', workspaceB, 'admin-b')
  assert.equal(crossTenantArtifact.response.status, 404)

  const evidence = await request(origin, `/api/workspaces/${workspaceA}/evidence`, 'POST', workspaceA, 'admin-a', {
    status: 'approved',
    items: [{ title: 'Reviewed product capability', excerpt: 'A reviewed source-linked fact for the release preflight only.', taxonomy: 'product-capability', sourceType: 'manual', sourceRef: 'manual://release-preflight/capability' }],
  })
  assert.equal(evidence.response.status, 201)

  const provider = await request(origin, `/api/workspaces/${workspaceA}/model-providers`, 'POST', workspaceA, 'admin-a', {
    providerId: 'DeepSeek', market: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual',
  })
  assert.equal(provider.response.status, 201)

  const recoveryDataset = await request(origin, `/api/workspaces/${workspaceA}/datasets`, 'POST', workspaceA, 'admin-a', {
    logicalKey: 'release-recovery-cohort', label: 'Release recovery cohort', status: 'approved',
    queries: [{ text: '支持来源可追溯的 AI 知识库工具有哪些？', market: 'CN', locale: 'zh-CN', language: 'zh', userRole: 'knowledge-lead', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'General B2B knowledge platform', expectedFacts: ['source-cited answers'], riskMetadata: { factualRisk: 'high' } }],
  })
  assert.equal(recoveryDataset.response.status, 201)

  const marketPack = await request(origin, `/api/workspaces/${workspaceA}/market-packs`, 'POST', workspaceA, 'admin-a', {
    logicalKey: 'release-recovery-cn', label: 'Release recovery China', status: 'approved', market: 'CN', locale: 'zh-CN',
    audience: 'Enterprise knowledge leaders', competitors: ['Competitor A'], providers: ['DeepSeek'], channels: ['官网内容中心'], evidencePackId: evidence.body.evidencePack.id,
  })
  assert.equal(marketPack.response.status, 201)

  const recoveryRun = await request(origin, `/api/workspaces/${workspaceA}/assessment-runs`, 'POST', workspaceA, 'admin-a', {
    label: 'Release recovery run', datasetId: recoveryDataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id,
    locale: 'zh-CN', providers: ['DeepSeek'], maxAttempts: 2,
  })
  assert.equal(recoveryRun.response.status, 201)
  const claimed = await request(origin, `/api/workspaces/${workspaceA}/assessment-runs/${recoveryRun.body.run.id}/observations/claim-next`, 'POST', workspaceA, 'analyst-a', { providerId: 'DeepSeek' })
  assert.equal(claimed.response.status, 200)
  const retryableTimeout = await request(origin, `/api/workspaces/${workspaceA}/assessment-runs/${recoveryRun.body.run.id}/observations/${claimed.body.observation.id}/timeout`, 'POST', workspaceA, 'analyst-a', { message: 'Controlled collection interrupted', retryAfterSeconds: 0 })
  assert.equal(retryableTimeout.response.status, 200)
  assert.equal(retryableTimeout.body.observation.status, 'queued')
  const retryClaim = await request(origin, `/api/workspaces/${workspaceA}/assessment-runs/${recoveryRun.body.run.id}/observations/claim-next`, 'POST', workspaceA, 'analyst-a', { providerId: 'DeepSeek' })
  assert.equal(retryClaim.response.status, 200)
  const exhaustedTimeout = await request(origin, `/api/workspaces/${workspaceA}/assessment-runs/${recoveryRun.body.run.id}/observations/${retryClaim.body.observation.id}/timeout`, 'POST', workspaceA, 'analyst-a', { message: 'Controlled collection still unavailable', retryAfterSeconds: 0 })
  assert.equal(exhaustedTimeout.response.status, 200)
  assert.equal(exhaustedTimeout.body.observation.status, 'failed')
  const resumed = await request(origin, `/api/workspaces/${workspaceA}/assessment-runs/${recoveryRun.body.run.id}/observations/${retryClaim.body.observation.id}/resume`, 'POST', workspaceA, 'analyst-a', { additionalAttempts: 1 })
  assert.equal(resumed.response.status, 200)
  assert.equal(resumed.body.observation.status, 'queued')

  const performanceQueries = Array.from({ length: 100 }, (_, index) => query(index + 1))
  const performanceStart = performance.now()
  const performanceDataset = await request(origin, `/api/workspaces/${workspaceA}/datasets`, 'POST', workspaceA, 'admin-a', {
    logicalKey: 'release-100-query-cohort', label: 'Release 100-query cohort', status: 'approved', queries: performanceQueries,
  })
  assert.equal(performanceDataset.response.status, 201)
  const performanceRun = await request(origin, `/api/workspaces/${workspaceA}/assessment-runs`, 'POST', workspaceA, 'admin-a', {
    label: 'Release 100-query collection setup', datasetId: performanceDataset.body.dataset.id, marketPackId: marketPack.body.marketPack.id,
    locale: 'zh-CN', providers: ['DeepSeek'],
  })
  const hundredQuerySetupMs = Math.round(performance.now() - performanceStart)
  assert.equal(performanceRun.response.status, 201)
  assert.equal(performanceRun.body.run.completion.queued, 100)
  assert.ok(hundredQuerySetupMs < 5000, `100-query cohort setup exceeded 5 seconds (${hundredQuerySetupMs} ms).`)

  const guaranteedReport = await request(origin, `/api/workspaces/${workspaceA}/reports/generate`, 'POST', workspaceA, 'admin-a', {
    logicalKey: 'guaranteed-outcome-report', title: 'Guaranteed citation uplift report', baselineRunId: recoveryRun.body.run.id,
  })
  assert.equal(guaranteedReport.response.status, 400)
  assert.match(guaranteedReport.body.error, /guarantee|causal|outcome/i)

  const audit = await request(origin, `/api/workspaces/${workspaceA}/audit`, 'GET', workspaceA, 'admin-a')
  assert.equal(audit.response.status, 200)
  assert.ok(audit.body.events.some((event) => event.action === 'observation.collection.resumed'))
  assert.ok(audit.body.events.some((event) => event.outcome === 'denied'))

  console.log(JSON.stringify({
    status: 'passed',
    checks: ['role-write-denial', 'cross-tenant-write-denial', 'artifact-isolation', 'timeout-resume-recovery', 'no-guarantee-reporting', 'audit-retention', '100-query-cohort-setup'],
    timings: { hundredQuerySetupMs },
  }, null, 2))
} finally {
  await new Promise((resolve) => application.server.close(resolve))
  application.database.close()
  rmSync(dataDir, { recursive: true, force: true })
}



