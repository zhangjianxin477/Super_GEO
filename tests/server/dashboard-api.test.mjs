import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApplication } from '../../server/application.mjs'

let application
let origin
let sample
const json = async (path, options = {}) => {
  const response = await fetch(origin + path, { headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }, ...options })
  return { response, body: await response.json() }
}
const auth = () => ({ 'x-user-id': 'sample-admin', 'x-workspace-id': sample.workspace.id })

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-dashboard-test-'))
  application = createApplication({ config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0, environment: 'development' } })
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  origin = 'http://127.0.0.1:' + application.server.address().port
  const created = await json('/api/development/sample-workspace', { method: 'POST' })
  assert.equal(created.response.status, 201)
  sample = created.body.sample
})
after(async () => { await new Promise((resolve) => application.server.close(resolve)); application.database.close(); rmSync(application.config.dataDir, { recursive: true, force: true }) })

describe('live GEO dashboard read model', () => {
  it('returns a complete controlled-manual dashboard with scoped metrics and limitations', async () => {
    const market = sample.marketPacks[0]
    const run = sample.runs[0]
    const result = await json('/api/workspaces/' + sample.workspace.id + '/market-packs/' + market.id + '/dashboard?assessmentRunId=' + run.id, { headers: auth() })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.dashboard.context.selectedRun.id, run.id)
    assert.equal(result.body.dashboard.completeness.isComplete, true)
    assert.equal(result.body.dashboard.measurement.metrics.mentionRate.denominator, 4)
    assert.equal(result.body.dashboard.measurement.exclusions.importedIncluded, true)
    assert.equal(result.body.dashboard.actions.length, 1)
    assert.equal(result.body.dashboard.actions[0].brief.title, '知识图谱与来源可追溯 AI 知识库 FAQ')
    assert.equal(result.body.dashboard.actions[0].draft.status, 'approved')
    assert.equal(result.body.dashboard.actions[0].diagnosis.id, sample.diagnosis.id)
    assert.equal(result.body.dashboard.reports.length, 1)
    assert.equal(result.body.dashboard.reports[0].status, 'generated')
    assert.ok(result.body.dashboard.reports[0].actionIds.includes(result.body.dashboard.actions[0].id))
    assert.ok(result.body.dashboard.limitations.some((item) => /不保证/.test(item)))
    assert.equal(result.body.dashboard.collectionBoundary.includes('Controlled-manual'), true)
  })

  it('reports comparable and non-comparable baseline states without presenting false uplift', async () => {
    const market = sample.marketPacks[0]
    const run = sample.runs[0]
    const comparable = await json('/api/workspaces/' + sample.workspace.id + '/market-packs/' + market.id + '/dashboard?assessmentRunId=' + run.id + '&baselineRunId=' + run.id, { headers: auth() })
    assert.equal(comparable.response.status, 200)
    assert.equal(comparable.body.dashboard.comparison.comparable, true)
    assert.ok(comparable.body.dashboard.comparison.deltas)
    const global = sample.marketPacks[1]
    const nonComparable = await json('/api/workspaces/' + sample.workspace.id + '/market-packs/' + global.id + '/dashboard?assessmentRunId=' + sample.runs[1].id + '&baselineRunId=' + run.id, { headers: auth() })
    assert.equal(nonComparable.response.status, 404)
    assert.match(nonComparable.body.error, /Baseline assessment run was not found/i)
  })

  it('keeps incomplete collection states visible and blocks cross-tenant access', async () => {
    const market = sample.marketPacks[0]
    const dataset = application.repository.getDataset(sample.runs[0].datasetId)
    const incomplete = application.repository.createAssessmentRun({ workspaceId: sample.workspace.id, actorId: 'sample-admin', label: 'Pending collection', datasetId: dataset.id, marketPackId: market.id, locale: market.locale, providers: ['DeepSeek'], queryIds: [dataset.queries[0].id] })
    const result = await json('/api/workspaces/' + sample.workspace.id + '/market-packs/' + market.id + '/dashboard?assessmentRunId=' + incomplete.id, { headers: auth() })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.dashboard.completeness.isComplete, false)
    assert.equal(result.body.dashboard.completeness.providerCoverage[0].byStatus.queued, 1)
    const denied = await json('/api/workspaces/' + sample.workspace.id + '/market-packs/' + market.id + '/dashboard', { headers: { 'x-user-id': 'sample-admin', 'x-workspace-id': 'other-tenant' } })
    assert.equal(denied.response.status, 403)
  })

  it('rejects manual imports without a model identity and denies raw evidence across tenants', async () => {
    const market = sample.marketPacks[0]
    const run = sample.runs[0]
    const query = application.repository.getDataset(run.datasetId).queries[0]
    const supporting = await json('/api/workspaces/' + sample.workspace.id + '/artifacts', { method: 'POST', headers: auth(), body: JSON.stringify({ kind: 'manual-import-provenance', payload: { collectionMode: 'controlled-manual', sourceRef: 'manual://test' } }) })
    assert.equal(supporting.response.status, 201)
    const invalid = await json('/api/workspaces/' + sample.workspace.id + '/assessment-runs/' + run.id + '/observations/import', { method: 'POST', headers: auth(), body: JSON.stringify({ queryId: query.id, providerId: run.providers[0], collectedAt: new Date().toISOString(), sourceRef: 'manual://test', supportingArtifactId: supporting.body.artifact.id, rawAnswer: 'Retained answer without a model identity.', citations: [], analysis: {} }) })
    assert.equal(invalid.response.status, 400)
    assert.match(invalid.body.error, /modelIdentity/i)
    const denied = await json('/api/workspaces/' + sample.workspace.id + '/artifacts/' + supporting.body.artifact.id, { headers: { 'x-user-id': 'sample-admin', 'x-workspace-id': 'another-tenant' } })
    assert.equal(denied.response.status, 403)
    assert.equal(market.locale, 'zh-CN')
  })

  it('disables development bootstrap in production configuration', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'geo-dashboard-prod-'))
    const production = createApplication({ config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0, environment: 'production' } })
    await new Promise((resolve) => production.server.listen(0, '127.0.0.1', resolve))
    const port = production.server.address().port
    const response = await fetch('http://127.0.0.1:' + port + '/api/development/sample-workspace', { method: 'POST' })
    const emptyWorkspaceResponse = await fetch('http://127.0.0.1:' + port + '/api/development/empty-workspace', { method: 'POST' })
    assert.equal(response.status, 404)
    assert.equal(emptyWorkspaceResponse.status, 404)
    await new Promise((resolve) => production.server.close(resolve)); production.database.close(); rmSync(dataDir, { recursive: true, force: true })
  })
})
