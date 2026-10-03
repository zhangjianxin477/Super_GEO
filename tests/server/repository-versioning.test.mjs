import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig } from '../../server/config.mjs'
import { migrate, openDatabase } from '../../server/database.mjs'
import { HarnessRepository } from '../../server/repositories/harnessRepository.mjs'

test('empty database migrations preserve immutable report input links across versions', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-harness-repository-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const workspace = repository.createWorkspace({ name: 'Versioned tenant', brand: 'ExampleCo', products: ['Knowledge platform'], administrator: { id: 'admin-1', name: 'Admin' } })
    const evidence = repository.createEvidencePack({ workspaceId: workspace.id, actorId: 'admin-1', status: 'approved', items: [{ title: 'Capability', excerpt: 'Source-linked answers.', taxonomy: 'product-capability', sourceType: 'manual', sourceRef: 'manual://capability' }] })
    const dataset = repository.createDataset({ workspaceId: workspace.id, actorId: 'admin-1', logicalKey: 'en-us-category', label: 'US category cohort', status: 'approved', queries: [{ text: 'Which B2B knowledge tools cite sources?', market: 'GLOBAL', locale: 'en-US', language: 'en', userRole: 'buyer', businessStage: 'discover', intent: 'category-discovery', priority: 'P0', targetProduct: 'ExampleCo', expectedFacts: ['source-cited answers'] }] })
    const marketPack = repository.createMarketPack({ workspaceId: workspace.id, actorId: 'admin-1', logicalKey: 'global', label: 'Global market', status: 'approved', market: 'GLOBAL', locale: 'en-US', audience: 'B2B teams', competitors: ['Competitor'], providers: ['ChatGPT'], channels: ['Website Blog'], evidencePackId: evidence.id })
    repository.upsertModelProviderConfiguration({ workspaceId: workspace.id, actorId: 'admin-1', providerId: 'ChatGPT', market: 'GLOBAL', locale: 'en-US', collectionMode: 'controlled-manual', credentialReference: 'secret://test/chatgpt-export-policy' })
    const run = repository.createAssessmentRun({ workspaceId: workspace.id, actorId: 'admin-1', label: 'Baseline', datasetId: dataset.id, marketPackId: marketPack.id, locale: 'en-US', providers: ['ChatGPT'], queryIds: [dataset.queries[0].id] })

    const first = repository.createReport({ workspaceId: workspace.id, actorId: 'admin-1', logicalKey: 'monthly-geo', title: 'September GEO observation', baselineRunId: run.id, datasetId: dataset.id, evidencePackId: evidence.id, report: { scope: 'baseline-only' }, limitations: ['Manual provider import only.'] })
    const second = repository.createReport({ workspaceId: workspace.id, actorId: 'admin-1', logicalKey: 'monthly-geo', title: 'September GEO observation revised', baselineRunId: run.id, datasetId: dataset.id, evidencePackId: evidence.id, report: { scope: 'baseline-only', revision: 2 }, limitations: ['Manual provider import only.'] })

    assert.equal(first.version, 1)
    assert.equal(second.version, 2)
    assert.equal(first.baselineRunId, run.id)
    assert.equal(first.datasetId, dataset.id)
    assert.equal(first.datasetVersion, dataset.version)
    assert.equal(first.evidencePackId, evidence.id)
    assert.equal(first.evidencePackVersion, evidence.version)
    assert.equal(repository.getReport(workspace.id, first.id).report.scope, 'baseline-only')
    assert.equal(repository.listReports(workspace.id).length, 2)
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})
