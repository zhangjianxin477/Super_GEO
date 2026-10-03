import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig } from '../../server/config.mjs'
import { migrate, openDatabase } from '../../server/database.mjs'
import { HarnessRepository } from '../../server/repositories/harnessRepository.mjs'
import { makePublishableDatasetItems } from './query-dataset-test-helper.mjs'
import { supportedAdapters, supportedPlatforms } from '../../browser-agent/extension/platformRegistry.js'

test('Browser Agent isolates domestic lanes while leasing different platforms concurrently', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-platform-selection-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-platform-selection'
    const workspace = repository.createWorkspace({ name: 'Platform selection tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: {
      name: 'Platform scoped baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['AI 产品负责人'], objective: 'Verify selected browser platform isolation.', ownerId: actorId,
    } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([
      { question: '有哪些支持来源可追溯的 AI 知识库工具？', intent: '品类发现', rationale: '验证按平台隔离的真实网页基线。', priority: 'high' },
      { question: '企业知识库如何提供可核验的来源引用？', intent: '能力评估', rationale: '验证同一平台内按顺序执行下一条 Query。', priority: 'high' },
    ]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)

    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Domestic platform relay', platforms: ['Kimi', 'DeepSeek', '通义千问'] })
    assert.deepEqual(enrollment.agent.adapters.map((adapter) => adapter.platform), ['DeepSeek', '通义千问', 'Kimi'])
    assert.equal(enrollment.agent.adapters.some((adapter) => adapter.platform === '通义千问'), true)

    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Domestic platform relay', platforms: supportedPlatforms, adapters: supportedAdapters })
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: {
      querySetId: querySet.id, marketPack: 'CN', platforms: ['Kimi', 'DeepSeek'], browserAgentId: enrolled.agent.id,
    } })

    const kimiRequest = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: 'Kimi', actorId })
    const deepseekRequest = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: 'DeepSeek', actorId })
    assert.equal(kimiRequest.platform, 'Kimi')
    assert.equal(deepseekRequest.platform, 'DeepSeek')

    const requests = repository.getBrowserAgentStartRequestForToken(enrolled.token).requests
    assert.equal(requests.length, 2)
    assert.deepEqual(new Set(requests.map((item) => item.platform)), new Set(['Kimi', 'DeepSeek']))

    // A page-ready handshake must lease only its own platform. Kimi becoming
    // ready cannot claim or mutate DeepSeek work before the DeepSeek extension is ready.
    const kimiLease = repository.listBrowserAgentTasks(enrolled.token, { platform: 'Kimi' })
    assert.equal(kimiLease.length, 1)
    assert.equal(kimiLease[0].platform, 'Kimi')
    assert.equal(kimiLease[0].startRequestId, kimiRequest.id)

    const deepseekLease = repository.listBrowserAgentTasks(enrolled.token, { platform: 'DeepSeek' })
    assert.equal(deepseekLease.length, 1)
    assert.equal(deepseekLease[0].platform, 'DeepSeek')
    assert.equal(deepseekLease[0].startRequestId, deepseekRequest.id)
    assert.notEqual(kimiLease[0].id, deepseekLease[0].id)

    // An unscoped health/recovery poll still returns the two independent active lanes.
    const leased = repository.listBrowserAgentTasks(enrolled.token)
    assert.equal(leased.length, 2)
    assert.deepEqual(new Set(leased.map((item) => item.platform)), new Set(['Kimi', 'DeepSeek']))

    const kimiRequestAfterDeepSeekStart = repository.getBrowserAgentStartRequestForToken(enrolled.token, 'Kimi').request
    assert.equal(kimiRequestAfterDeepSeekStart?.id, kimiRequest.id)
    assert.notEqual(kimiRequestAfterDeepSeekStart?.status, 'cancelled')

    assert.throws(() => repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: '通义千问', actorId }), /没有待执行|未纳入|未包含|not found/)
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test('Browser Agent appends supported platforms to the same frozen Test Run without changing existing lanes', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-platform-append-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-platform-append'
    const workspace = repository.createWorkspace({ name: 'Append platform tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: {
      name: 'Frozen Query coverage', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['AI 产品负责人'], objective: 'Append a second real-web platform without changing the first lane.', ownerId: actorId,
    } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([
      { question: '哪些 AI 知识库支持来源可追溯？', intent: '品类发现', rationale: '冻结 Query 之一。', priority: 'high' },
      { question: '企业知识库怎样展示来源引用？', intent: '能力评估', rationale: '冻结 Query 之二。', priority: 'high' },
    ]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Append platform relay', platforms: ['Kimi', 'DeepSeek'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Append platform relay', platforms: supportedPlatforms, adapters: supportedAdapters })
    const initial = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: { querySetId: querySet.id, marketPack: 'CN', platforms: ['Kimi'], browserAgentId: enrolled.agent.id } })
    const kimiTaskIds = initial.tasks.filter((task) => task.platform === 'Kimi').map((task) => task.id)

    const appended = repository.appendRealSurfaceTestRunPlatforms({ workspaceId: workspace.id, testRunId: initial.id, actorId, input: { platforms: ['DeepSeek'], browserAgentId: enrolled.agent.id } })
    assert.deepEqual(appended.addedPlatforms, ['DeepSeek'])
    assert.equal(appended.testRun.tasks.filter((task) => task.platform === 'Kimi').length, 5)
    assert.deepEqual(appended.testRun.tasks.filter((task) => task.platform === 'Kimi').map((task) => task.id), kimiTaskIds)
    const deepSeekTasks = appended.testRun.tasks.filter((task) => task.platform === 'DeepSeek')
    assert.equal(deepSeekTasks.length, 5)
    assert.ok(deepSeekTasks.every((task) => task.executionMode === 'browser-agent' && task.browserAgentId === enrolled.agent.id && task.agentState === 'queued'))

    assert.throws(() => repository.appendRealSurfaceTestRunPlatforms({ workspaceId: workspace.id, testRunId: initial.id, actorId, input: { platforms: ['DeepSeek'], browserAgentId: enrolled.agent.id } }), /无需重复追加/)
    const qwenAppended = repository.appendRealSurfaceTestRunPlatforms({ workspaceId: workspace.id, testRunId: initial.id, actorId, input: { platforms: ['通义千问'], browserAgentId: enrolled.agent.id } })
    assert.deepEqual(qwenAppended.addedPlatforms, ['通义千问'])
    const qwenTasks = qwenAppended.testRun.tasks.filter((task) => task.platform === '通义千问')
    assert.equal(qwenTasks.length, 5)
    assert.ok(qwenTasks.every((task) => task.adapterId === 'qwen-web' && task.executionMode === 'browser-agent' && task.agentState === 'queued'))
    assert.throws(() => repository.appendRealSurfaceTestRunPlatforms({ workspaceId: workspace.id, testRunId: initial.id, actorId, input: { platforms: ['通义千问'], browserAgentId: enrolled.agent.id } }), /无需重复追加/)
    const wenxinAppended = repository.appendRealSurfaceTestRunPlatforms({ workspaceId: workspace.id, testRunId: initial.id, actorId, input: { platforms: ['文心一言'], browserAgentId: enrolled.agent.id } })
    assert.deepEqual(wenxinAppended.addedPlatforms, ['文心一言'])
    const wenxinTasks = wenxinAppended.testRun.tasks.filter((task) => task.platform === '文心一言')
    assert.equal(wenxinTasks.length, 5)
    assert.ok(wenxinTasks.every((task) => task.executionMode === 'controlled-manual'
      && task.browserAgentId === null
      && task.agentState === 'manual'
      && task.agentStateReason.includes('仅支持人工导入')))
    assert.throws(() => repository.enableRealSurfacePlatformBrowserAgent({ workspaceId: workspace.id, testRunId: initial.id, actorId, browserAgentId: enrolled.agent.id, platform: '文心一言' }), /仅支持人工导入/)
    assert.throws(() => repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: initial.id, agentId: enrolled.agent.id, platform: '文心一言', actorId }), /仅支持人工导入/)
    assert.throws(() => repository.appendRealSurfaceTestRunPlatforms({ workspaceId: workspace.id, testRunId: initial.id, actorId, input: { platforms: ['文心一言'], browserAgentId: enrolled.agent.id } }), /无需重复追加/)

    const otherWorkspace = repository.createWorkspace({ name: 'Isolated append tenant', brand: 'Other', products: ['Other'], administrator: { id: 'admin-other', name: 'Other admin' } })
    assert.throws(() => repository.appendRealSurfaceTestRunPlatforms({ workspaceId: otherWorkspace.id, testRunId: initial.id, actorId: 'admin-other', input: { platforms: ['DeepSeek'], browserAgentId: enrolled.agent.id } }), /not found/)
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})
