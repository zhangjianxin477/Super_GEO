import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig } from '../../server/config.mjs'
import { migrate, openDatabase } from '../../server/database.mjs'
import { HarnessRepository } from '../../server/repositories/harnessRepository.mjs'
import { makePublishableDatasetItems } from './query-dataset-test-helper.mjs'

test('expired Browser Agent lease is safely requeued and the current batch can continue', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-lease-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const workspace = repository.createWorkspace({ name: 'Queue tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: 'admin-1', name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId: 'admin-1', input: {
      name: 'Queue baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['知识库负责人'], objective: 'Verify queue recovery.', ownerId: 'admin-1',
    } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId: 'admin-1', marketPack: 'CN', items: makePublishableDatasetItems([{ question: '有哪些支持 Markdown 与可追溯来源的企业知识库工具？', intent: '品类发现', rationale: '验证目标平台中的自然品类发现问题。', priority: 'high' }]) })
    const query = querySet.queries[0]
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)

    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId: 'admin-1', label: 'Test relay', platforms: ['豆包'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Test relay', platforms: ['豆包'], adapters: [{ id: 'doubao-web', version: 'test', platform: '豆包' }] })
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId: 'admin-1', input: { querySetId: querySet.id, marketPack: 'CN', platforms: ['豆包'], browserAgentId: enrolled.agent.id } })
    const task = run.tasks[0]
    repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: '豆包', actorId: 'admin-1' })
    const oldTimestamp = new Date(Date.now() - 6 * 60_000).toISOString()
    db.prepare("UPDATE real_surface_collection_tasks SET state='claimed',agent_state='running',operator_id=?,claimed_at=?,updated_at=? WHERE id=?").run('browser-agent:' + enrolled.agent.id, oldTimestamp, oldTimestamp, task.id)

    const next = repository.listBrowserAgentTasks(enrolled.token)
    assert.equal(next.length, 1)
    assert.equal(next[0].id, task.id)
    assert.equal(next[0].recovered, false)
    const recoveredTask = db.prepare('SELECT state,agent_state,agent_state_reason FROM real_surface_collection_tasks WHERE id=?').get(task.id)
    assert.equal(recoveredTask.state, 'claimed')
    assert.equal(recoveredTask.agent_state, 'queued')
    assert.match(recoveredTask.agent_state_reason, /安全重新排队/)
    const events = db.prepare("SELECT action FROM real_surface_audit_events WHERE entity_id=?").all(task.id).map((row) => row.action)
    assert.ok(events.includes('browser-agent.claimed'))
    assert.ok(events.includes('browser-agent.lease-expired-requeued'))
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test('Browser Agent liveness marks missed heartbeats offline without revoking enrollment', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-liveness-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const workspace = repository.createWorkspace({ name: 'Liveness tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: 'admin-2', name: 'Admin' } })
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId: 'admin-2', label: 'Heartbeat relay', platforms: ['豆包'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Heartbeat relay', platforms: ['豆包'] })
    const oldTimestamp = new Date(Date.now() - 2 * 60_000).toISOString()
    db.prepare("UPDATE browser_agents SET status='online',last_seen_at=? WHERE id=?").run(oldTimestamp, enrolled.agent.id)
    const agents = repository.listBrowserAgents(workspace.id)
    assert.equal(agents[0].status, 'offline')
    assert.match(agents[0].lastError, /90 秒/)
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})


test('Browser Agent executes only its explicitly selected Test Run, not residual queued tasks', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-batch-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const workspace = repository.createWorkspace({ name: 'Scoped tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: 'admin-3', name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId: 'admin-3', input: {
      name: 'Scoped baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['知识库负责人'], objective: 'Verify batch isolation.', ownerId: 'admin-3',
    } })
    const createApprovedSet = (question) => {
      const set = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId: 'admin-3', marketPack: 'CN', items: makePublishableDatasetItems([{ question, intent: '品类发现', rationale: '验证真实平台查询。', priority: 'high' }]) })
      db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(set.id)
      db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(set.id)
      return set
    }
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId: 'admin-3', label: 'Scoped relay', platforms: ['豆包'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Scoped relay', platforms: ['豆包'], adapters: [{ id: 'doubao-web', version: 'test', platform: '豆包' }] })
    const historicalSet = createApprovedSet('旧批次问题：有哪些可追溯知识库工具？')
    const historicalRun = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId: 'admin-3', input: { querySetId: historicalSet.id, marketPack: 'CN', platforms: ['豆包'], browserAgentId: enrolled.agent.id } })
    const currentSet = createApprovedSet('当前批次问题：有哪些支持 Markdown 的团队知识库？')
    const currentRun = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId: 'admin-3', input: { querySetId: currentSet.id, marketPack: 'CN', platforms: ['豆包'], browserAgentId: enrolled.agent.id } })

    repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: currentRun.id, agentId: enrolled.agent.id, platform: '豆包', actorId: 'admin-3' })
    const agents = repository.listBrowserAgents(workspace.id)
    assert.equal(agents[0].activeTestRunId, currentRun.id)
    const next = repository.listBrowserAgentTasks(enrolled.token)
    assert.equal(next.length, 1)
    assert.equal(next[0].testRunId, currentRun.id)
    assert.equal(next[0].question, '当前批次问题：有哪些支持 Markdown 的团队知识库？')
    const historicalTask = db.prepare('SELECT state,agent_state FROM real_surface_collection_tasks WHERE id=?').get(historicalRun.tasks[0].id)
    assert.equal(historicalTask.state, 'unassigned')
    assert.equal(historicalTask.agent_state, 'queued')
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})


test('Browser Agent start authorization is isolated, expires safely, and stops after cancellation', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-start-request-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const workspace = repository.createWorkspace({ name: 'Start authorization tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: 'admin-start', name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId: 'admin-start', input: {
      name: 'Start authorization baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['知识库负责人'], objective: 'Verify local start authorization.', ownerId: 'admin-start',
    } })
    const set = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId: 'admin-start', marketPack: 'CN', items: makePublishableDatasetItems([{ question: '有哪些支持来源可追溯的 AI 知识库工具？', intent: '品类发现', rationale: '验证独立的本地浏览器授权。', priority: 'high' }]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(set.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(set.id)
    const enroll = (label) => {
      const code = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId: 'admin-start', label, platforms: ['豆包'] })
      return repository.enrollBrowserAgent({ enrollmentCode: code.enrollmentCode, label, platforms: ['豆包'], adapters: [{ id: 'doubao-web', version: 'test', platform: '豆包' }] })
    }
    const primary = enroll('Primary relay')
    const other = enroll('Other relay')
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId: 'admin-start', input: { querySetId: set.id, marketPack: 'CN', platforms: ['豆包'], browserAgentId: primary.agent.id } })

    const request = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: primary.agent.id, platform: '豆包', actorId: 'admin-start' })
    assert.equal(request.status, 'requested')
    assert.equal(repository.getBrowserAgentStartRequestForToken(primary.token).request.id, request.id)
    assert.equal(repository.getBrowserAgentStartRequestForToken(other.token).request, null)
    assert.throws(() => repository.updateBrowserAgentStartRequest({ token: other.token, startRequestId: request.id, status: 'acknowledged' }), /不属于此 Agent/)

    assert.equal(repository.updateBrowserAgentStartRequest({ token: primary.token, startRequestId: request.id, status: 'acknowledged' }).status, 'acknowledged')
    assert.equal(repository.updateBrowserAgentStartRequest({ token: primary.token, startRequestId: request.id, status: 'launching-browser' }).status, 'launching-browser')
    assert.equal(repository.updateBrowserAgentStartRequest({ token: primary.token, startRequestId: request.id, status: 'running' }).status, 'running')
    // Extension activation can win the race with the local relay's delayed polling update.
    // A stale lower-state update must be harmless rather than failing the whole batch.
    assert.equal(repository.updateBrowserAgentStartRequest({ token: primary.token, startRequestId: request.id, status: 'acknowledged' }).status, 'running')
    assert.equal(repository.updateBrowserAgentStartRequest({ token: primary.token, startRequestId: request.id, status: 'launching-browser' }).status, 'running')
    assert.equal(repository.cancelBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, startRequestId: request.id, actorId: 'admin-start' }).status, 'cancelled')
    assert.equal(repository.getBrowserAgentStartRequestForToken(primary.token).request, null)

    const expired = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: primary.agent.id, platform: '豆包', actorId: 'admin-start' })
    db.prepare("UPDATE browser_agent_start_requests SET expires_at=? WHERE id=?").run(new Date(Date.now() - 1_000).toISOString(), expired.id)
    assert.equal(repository.getBrowserAgentStartRequestForToken(primary.token).request, null)
    assert.equal(repository.listBrowserAgentStartRequests(workspace.id, run.id).find((item) => item.id === expired.id)?.status, 'expired')
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})


test('new explicit Browser Agent start atomically rebinds the device to the selected Test Run', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-rebind-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-rebind'
    const workspace = repository.createWorkspace({ name: 'Rebind tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: {
      name: 'Rebind baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['知识库负责人'], objective: 'Verify newest browser start owns the queue.', ownerId: actorId,
    } })
    const createApprovedSet = (question) => {
      const set = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([{ question, intent: '品类发现', rationale: '验证明确启动批次绑定。', priority: 'high' }]) })
      db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(set.id)
      db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(set.id)
      return set
    }
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Rebind relay', platforms: ['豆包'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Rebind relay', platforms: ['豆包'], adapters: [{ id: 'doubao-web', version: 'test', platform: '豆包' }] })
    const firstSet = createApprovedSet('旧批次：支持可追溯来源的知识库有哪些？')
    const secondSet = createApprovedSet('新批次：适合团队协作的 Markdown 知识库有哪些？')
    const firstRun = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: { querySetId: firstSet.id, marketPack: 'CN', platforms: ['豆包'], browserAgentId: enrolled.agent.id } })
    const secondRun = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: { querySetId: secondSet.id, marketPack: 'CN', platforms: ['豆包'], browserAgentId: enrolled.agent.id } })

    const firstStart = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: firstRun.id, agentId: enrolled.agent.id, platform: '豆包', actorId })
    assert.equal(repository.getBrowserAgent(workspace.id, enrolled.agent.id).activeTestRunId, firstRun.id)
    const firstTask = repository.listBrowserAgentTasks(enrolled.token)[0]
    assert.equal(firstTask.testRunId, firstRun.id)

    const secondStart = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: secondRun.id, agentId: enrolled.agent.id, platform: '豆包', actorId })
    assert.equal(repository.getBrowserAgent(workspace.id, enrolled.agent.id).activeTestRunId, secondRun.id)
    assert.equal(repository.getBrowserAgentStartRequestForToken(enrolled.token).request.id, secondStart.id)
    assert.equal(repository.listBrowserAgentStartRequests(workspace.id, firstRun.id).find((item) => item.id === firstStart.id)?.status, 'cancelled')

    const releasedFirstTask = db.prepare('SELECT state,agent_state FROM real_surface_collection_tasks WHERE id=?').get(firstTask.id)
    // node:sqlite yields a null-prototype row object; check values rather than object identity.
    assert.equal(releasedFirstTask.state, 'unassigned')
    assert.equal(releasedFirstTask.agent_state, 'queued')
    const stale = repository.updateBrowserAgentTask({ token: enrolled.token, taskId: firstTask.id, status: 'running' })
    assert.equal(stale.accepted, true)
    assert.equal(stale.ignored, true)

    const secondTask = repository.listBrowserAgentTasks(enrolled.token)[0]
    assert.equal(secondTask.testRunId, secondRun.id)
    assert.equal(secondTask.question, '新批次：适合团队协作的 Markdown 知识库有哪些？')
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})


test('terminal Browser Agent reports remain recoverable after the start authorization expires', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-terminal-recovery-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-terminal-recovery'
    const workspace = repository.createWorkspace({ name: 'Terminal recovery tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: {
      name: 'Terminal recovery baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['知识库负责人'], objective: 'Verify late terminal reports are not discarded.', ownerId: actorId,
    } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([{ question: '有哪些支持可追溯来源的企业知识库工具？', intent: '品类发现', rationale: '验证超时后终态回传。', priority: 'high' }]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Terminal relay', platforms: ['豆包'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Terminal relay', platforms: ['豆包'], adapters: [{ id: 'doubao-web', version: 'test', platform: '豆包' }] })
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: { querySetId: querySet.id, marketPack: 'CN', platforms: ['豆包'], browserAgentId: enrolled.agent.id } })
    const request = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: '豆包', actorId })
    const task = repository.listBrowserAgentTasks(enrolled.token)[0]
    assert.equal(task.id, run.tasks[0].id)
    db.prepare("UPDATE browser_agent_start_requests SET expires_at=? WHERE id=?").run(new Date(Date.now() - 1_000).toISOString(), request.id)

    const result = repository.updateBrowserAgentTask({ token: enrolled.token, taskId: task.id, status: 'completed', evidence: { rawAnswer: '这是当前可见回答。', citations: ['https://example.test/source'], observedAt: new Date().toISOString() } })
    assert.equal(result.accepted, true)
    assert.equal(result.recoveredAfterExpiry, true)
    const savedTask = db.prepare('SELECT state,agent_state FROM real_surface_collection_tasks WHERE id=?').get(task.id)
    assert.equal(savedTask.state, 'submitted')
    assert.equal(savedTask.agent_state, 'captured')
    const observation = db.prepare('SELECT raw_answer,citations_json FROM real_surface_observations WHERE task_id=?').get(task.id)
    assert.equal(observation.raw_answer, '这是当前可见回答。')
    assert.deepEqual(JSON.parse(observation.citations_json), ['https://example.test/source'])
    const events = db.prepare("SELECT action FROM real_surface_audit_events WHERE entity_id=?").all(task.id).map((row) => row.action)
    assert.ok(events.includes('browser-agent.terminal-report-recovered'))
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test('expired terminal failure converts only its still-claimed task to controlled manual', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-manual-recovery-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-manual-recovery'
    const workspace = repository.createWorkspace({ name: 'Manual recovery tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: {
      name: 'Manual recovery baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['知识库负责人'], objective: 'Verify expired human fallback.', ownerId: actorId,
    } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([{ question: '有哪些适合团队协作的知识库？', intent: '品类发现', rationale: '验证超时人工兜底。', priority: 'high' }]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Manual recovery relay', platforms: ['豆包'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Manual recovery relay', platforms: ['豆包'], adapters: [{ id: 'doubao-web', version: 'test', platform: '豆包' }] })
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: { querySetId: querySet.id, marketPack: 'CN', platforms: ['豆包'], browserAgentId: enrolled.agent.id } })
    const request = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: '豆包', actorId })
    const task = repository.listBrowserAgentTasks(enrolled.token)[0]
    db.prepare("UPDATE browser_agent_start_requests SET expires_at=? WHERE id=?").run(new Date(Date.now() - 1_000).toISOString(), request.id)

    const result = repository.updateBrowserAgentTask({ token: enrolled.token, taskId: task.id, status: 'needs-human', reason: '页面结构已变更，无法确认当前回答边界。' })
    assert.equal(result.accepted, true)
    assert.equal(result.fallback, 'controlled-manual')
    assert.equal(result.recoveredAfterExpiry, true)
    const savedTask = db.prepare('SELECT execution_mode,browser_agent_id,state,agent_state,agent_state_reason FROM real_surface_collection_tasks WHERE id=?').get(task.id)
    assert.equal(savedTask.execution_mode, 'controlled-manual')
    assert.equal(savedTask.browser_agent_id, null)
    assert.equal(savedTask.state, 'unassigned')
    assert.equal(savedTask.agent_state, 'needs-human')
    assert.match(savedTask.agent_state_reason, /页面结构已变更/)
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test('failed local Browser Agent launch releases claimed work for a clean retry', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-agent-launch-recovery-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-launch-recovery'
    const workspace = repository.createWorkspace({ name: 'Launch recovery tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: {
      name: 'Launch recovery baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['知识库负责人'], objective: 'Verify launch failure recovery.', ownerId: actorId,
    } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([{ question: '哪些工具支持团队知识管理？', intent: '品类发现', rationale: '验证启动失败不锁死任务。', priority: 'high' }]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)
    const enrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Launch recovery relay', platforms: ['豆包'] })
    const enrolled = repository.enrollBrowserAgent({ enrollmentCode: enrollment.enrollmentCode, label: 'Launch recovery relay', platforms: ['豆包'], adapters: [{ id: 'doubao-web', version: 'test', platform: '豆包' }] })
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: { querySetId: querySet.id, marketPack: 'CN', platforms: ['豆包'], browserAgentId: enrolled.agent.id } })
    const request = repository.createBrowserAgentStartRequest({ workspaceId: workspace.id, testRunId: run.id, agentId: enrolled.agent.id, platform: '豆包', actorId })
    const task = repository.listBrowserAgentTasks(enrolled.token)[0]
    repository.updateBrowserAgentStartRequest({ token: enrolled.token, startRequestId: request.id, status: 'failed', reason: '无法打开受控浏览器。' })

    const savedTask = db.prepare('SELECT state,agent_state,agent_state_reason FROM real_surface_collection_tasks WHERE id=?').get(task.id)
    assert.equal(savedTask.state, 'unassigned')
    assert.equal(savedTask.agent_state, 'queued')
    assert.match(savedTask.agent_state_reason, /启动失败/)
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})