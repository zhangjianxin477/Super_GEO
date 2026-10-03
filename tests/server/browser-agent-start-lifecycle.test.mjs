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
import { preserveForwardStartRequest, startRequestLaunchPlan } from '../../browser-agent/startRequestLifecycle.mjs'

test('Browser Agent start lifecycle never retries a request from an earlier state', () => {
  assert.deepEqual(startRequestLaunchPlan('requested'), { advance: ['acknowledged', 'launching-browser'], launch: true })
  assert.deepEqual(startRequestLaunchPlan('acknowledged'), { advance: ['launching-browser'], launch: true })
  assert.deepEqual(startRequestLaunchPlan('launching-browser'), { advance: [], launch: true })
  assert.deepEqual(startRequestLaunchPlan('launching-browser', { launched: true }), { advance: [], launch: false })
  assert.deepEqual(startRequestLaunchPlan('waiting-login'), { advance: [], launch: true })
  assert.deepEqual(startRequestLaunchPlan('running'), { advance: [], launch: true })
  assert.deepEqual(startRequestLaunchPlan('running', { launched: true }), { advance: [], launch: false })

  const running = { id: 'request-1', status: 'running' }
  assert.equal(preserveForwardStartRequest(running, { id: 'request-1', status: 'acknowledged' }).status, 'running')
  assert.equal(preserveForwardStartRequest(running, { id: 'request-2', status: 'requested' }).status, 'requested')
  assert.equal(preserveForwardStartRequest(running, { id: 'request-1', status: 'waiting-login' }).status, 'waiting-login')
})


test('Browser Agent makes a same-request login loss visible after an active lane was running', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-login-recovery-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-login-recovery'
    const workspace = repository.createWorkspace({ name: 'Login recovery tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: { name: 'Login recovery', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['AI 产品负责人'], objective: 'Verify visible login recovery.', ownerId: actorId } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([{ question: '测试 Query', intent: '品类发现', rationale: '测试登录恢复', priority: 'high' }]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Login recovery relay', platforms: ['Kimi'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Login recovery relay', platforms: supportedPlatforms, adapters: supportedAdapters })
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: { querySetId: querySet.id, marketPack: 'CN', platforms: ['Kimi'], browserAgentId: enrolled.agent.id } })
    const request = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: 'Kimi', actorId })
    repository.updateBrowserAgentStartRequest({ token: enrolled.token, startRequestId: request.id, status: 'running' })
    const recovered = repository.updateBrowserAgentStartRequest({ token: enrolled.token, startRequestId: request.id, status: 'waiting-login', reason: 'Kimi 登录状态已失效，请在受控浏览器窗口重新登录。' })
    assert.equal(recovered.status, 'waiting-login')
    assert.match(recovered.failureReason, /登录状态已失效/)
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test('Browser Agent expires a stale running authorization and does not dispatch it after relay recovery', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-expired-running-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-expired-running'
    const workspace = repository.createWorkspace({ name: 'Expired running tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: { name: 'Expired running recovery', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['AI 产品负责人'], objective: 'Verify stale browser authorization cleanup.', ownerId: actorId } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([{ question: '测试 Query', intent: '品类发现', rationale: '验证过期启动授权', priority: 'high' }]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Expired running relay', platforms: ['DeepSeek'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Expired running relay', platforms: supportedPlatforms, adapters: supportedAdapters })
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: { querySetId: querySet.id, marketPack: 'CN', platforms: ['DeepSeek'], browserAgentId: enrolled.agent.id } })
    const request = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: 'DeepSeek', actorId })
    repository.updateBrowserAgentStartRequest({ token: enrolled.token, startRequestId: request.id, status: 'running' })
    db.prepare("UPDATE browser_agent_start_requests SET expires_at=? WHERE id=?").run(new Date(Date.now() - 60_000).toISOString(), request.id)

    const active = repository.getBrowserAgentStartRequestForToken(enrolled.token, 'DeepSeek')
    assert.equal(active.request, null)
    assert.deepEqual(active.requests, [])
    const expired = repository.listBrowserAgentStartRequests(workspace.id, run.id).find((item) => item.id === request.id)
    assert.equal(expired?.status, 'expired')
    assert.match(expired?.failureReason || '', /已过期/)
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})


test('A fresh explicit Browser Agent start requeues only prior automatic-fallback tasks for that platform', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-start-requeue-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-start-requeue'
    const workspace = repository.createWorkspace({ name: 'Start requeue tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: { name: 'Start requeue baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['AI 产品负责人'], objective: 'Verify explicit retry requeues automatic fallbacks.', ownerId: actorId } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([{ question: '测试 Query 一', intent: '品类发现', rationale: '验证失败后重新启动。', priority: 'high' }, { question: '测试 Query 二', intent: '方案评估', rationale: '验证同平台串行重试。', priority: 'medium' }]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Requeue relay', platforms: ['通义千问'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Requeue relay', platforms: supportedPlatforms, adapters: supportedAdapters })
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: { querySetId: querySet.id, marketPack: 'CN', platforms: ['通义千问'], browserAgentId: enrolled.agent.id } })

    const firstStart = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: '通义千问', actorId })
    const firstTask = repository.listBrowserAgentTasks(enrolled.token, { platform: '通义千问' })[0]
    assert.ok(firstTask)
    repository.updateBrowserAgentTask({ token: enrolled.token, taskId: firstTask.id, status: 'needs-human', reason: '页面尚未就绪。' })

    const fallback = repository.getRealSurfaceTestRun(workspace.id, run.id).tasks.find((task) => task.id === firstTask.id)
    assert.equal(fallback.executionMode, 'controlled-manual')
    assert.equal(fallback.agentState, 'needs-human')
    assert.equal(fallback.browserAgentId, null)
    assert.equal(repository.cancelBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, startRequestId: firstStart.id, actorId }).status, 'cancelled')

    const restarted = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: '通义千问', actorId })
    assert.equal(restarted.status, 'requested')
    const reset = repository.getRealSurfaceTestRun(workspace.id, run.id).tasks.find((task) => task.id === firstTask.id)
    assert.equal(reset.executionMode, 'browser-agent')
    assert.equal(reset.browserAgentId, enrolled.agent.id)
    assert.equal(reset.agentState, 'queued')
    assert.equal(reset.state, 'unassigned')
    assert.equal(reset.attemptNumber, 1)

    const next = repository.listBrowserAgentTasks(enrolled.token, { platform: '通义千问' })[0]
    assert.equal(next.id, firstTask.id)
    const audit = db.prepare("SELECT payload_json FROM real_surface_audit_events WHERE action='browser-agent.start-requested' ORDER BY created_at DESC LIMIT 1").get()
    assert.equal(JSON.parse(audit.payload_json).requeuedTaskCount, 1)
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})


