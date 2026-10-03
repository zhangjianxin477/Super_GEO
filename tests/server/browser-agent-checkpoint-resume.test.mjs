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

test('Browser Agent platform resume requeues only failed and stale tasks', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-browser-checkpoint-resume-'))
  const config = loadConfig({ projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite') })
  const db = openDatabase(config)
  try {
    migrate(db, join(config.projectRoot, 'server', 'migrations'))
    const repository = new HarnessRepository(db)
    const actorId = 'admin-checkpoint-resume'
    const workspace = repository.createWorkspace({ name: 'Checkpoint tenant', brand: 'Example', products: ['Knowledge platform'], administrator: { id: actorId, name: 'Admin' } })
    const diagnostic = repository.createBrandDiagnosticCase({ workspaceId: workspace.id, actorId, input: {
      name: 'Checkpoint baseline', brandName: 'Example', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['AI 产品负责人'], objective: 'Verify checkpoint resume.', ownerId: actorId,
    } })
    const querySet = repository.createBaselineQuerySetFromItems({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, marketPack: 'CN', items: makePublishableDatasetItems([
      { question: '有哪些支持来源可追溯的 AI 知识库工具？', intent: '品类发现', rationale: '验证失败任务恢复', priority: 'high' },
      { question: '企业知识库如何提供可核验的来源引用？', intent: '能力评估', rationale: '验证已完成任务保留', priority: 'high' },
      { question: '如何比较适合 B2B 团队的 AI 知识库方案？', intent: '方案比较', rationale: '验证过期租约恢复', priority: 'medium' },
    ]) })
    db.prepare("UPDATE baseline_seed_queries SET status='approved' WHERE query_set_id=?").run(querySet.id)
    db.prepare("UPDATE baseline_query_sets SET status='approved', lifecycle_status='ready_for_test' WHERE id=?").run(querySet.id)

    const oldEnrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Old Checkpoint Agent', platforms: ['豆包', 'Kimi'] })
    const oldPaired = repository.enrollBrowserAgent({ enrollmentCode: oldEnrollment.enrollmentCode, label: 'Old Checkpoint Agent', platforms: supportedPlatforms, adapters: supportedAdapters })
    const currentEnrollment = repository.createBrowserAgentEnrollment({ workspaceId: workspace.id, actorId, label: 'Current Checkpoint Agent', platforms: ['豆包', 'Kimi'] })
    const currentPaired = repository.enrollBrowserAgent({ enrollmentCode: currentEnrollment.enrollmentCode, label: 'Current Checkpoint Agent', platforms: supportedPlatforms, adapters: supportedAdapters })
    const run = repository.createRealSurfaceTestRun({ workspaceId: workspace.id, caseId: diagnostic.project.id, actorId, input: {
      querySetId: querySet.id, marketPack: 'CN', platforms: ['豆包', 'Kimi'], browserAgentId: oldPaired.agent.id,
    } })
    const doubao = run.tasks.filter((task) => task.platform === '豆包')
    const kimi = run.tasks.filter((task) => task.platform === 'Kimi')
    assert.equal(doubao.length, 5)
    assert.equal(kimi.length, 5)

    const staleAt = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    db.prepare("UPDATE real_surface_collection_tasks SET state='unassigned',execution_mode='controlled-manual',browser_agent_id=NULL,agent_state='failed',agent_state_reason='页面结构变化',failure_reason='页面结构变化' WHERE id=?").run(doubao[0].id)
    db.prepare("UPDATE real_surface_collection_tasks SET state='submitted',execution_mode='browser-agent',browser_agent_id=?,agent_state='captured',submitted_at=?,updated_at=? WHERE id=?").run(oldPaired.agent.id, new Date().toISOString(), new Date().toISOString(), doubao[1].id)
    db.prepare("UPDATE real_surface_collection_tasks SET state='claimed',execution_mode='browser-agent',browser_agent_id=?,agent_state='running',operator_id='browser-agent:'||?,claimed_at=?,updated_at=? WHERE id=?").run(oldPaired.agent.id, oldPaired.agent.id, staleAt, staleAt, doubao[2].id)
    db.prepare("UPDATE real_surface_collection_tasks SET state='unassigned',execution_mode='controlled-manual',browser_agent_id=NULL,agent_state='needs-human',agent_state_reason='只恢复豆包',failure_reason='只恢复豆包' WHERE id=?").run(kimi[0].id)

    const resumed = repository.resumeRealSurfacePlatformWithBrowserAgent({ workspaceId: workspace.id, testRunId: run.id, platform: '豆包', actorId, browserAgentId: currentPaired.agent.id })
    assert.equal(resumed.resumedCount, 2)
    assert.equal(resumed.staleCount, 1)
    assert.equal(resumed.reboundQueuedCount, 2)
    assert.equal(resumed.preservedCount, 1)
    assert.deepEqual(new Set(resumed.resumedTaskIds), new Set([doubao[0].id, doubao[2].id]))

    const refreshed = repository.getRealSurfaceTestRun(workspace.id, run.id)
    const failed = refreshed.tasks.find((task) => task.id === doubao[0].id)
    const captured = refreshed.tasks.find((task) => task.id === doubao[1].id)
    const stale = refreshed.tasks.find((task) => task.id === doubao[2].id)
    const otherPlatform = refreshed.tasks.find((task) => task.id === kimi[0].id)
    assert.equal(failed.executionMode, 'browser-agent')
    assert.equal(failed.agentState, 'queued')
    assert.equal(failed.state, 'unassigned')
    assert.equal(failed.attemptNumber, 1)
    assert.equal(captured.state, 'submitted')
    assert.equal(captured.agentState, 'captured')
    assert.equal(stale.agentState, 'queued')
    assert.equal(stale.state, 'unassigned')
    assert.equal(stale.browserAgentId, currentPaired.agent.id)
    assert.equal(otherPlatform.agentState, 'needs-human')
    assert.equal(otherPlatform.browserAgentId, null)

    const repeated = repository.resumeRealSurfacePlatformWithBrowserAgent({ workspaceId: workspace.id, testRunId: run.id, platform: '豆包', actorId, browserAgentId: currentPaired.agent.id })
    assert.equal(repeated.resumedCount, 0)
    const afterRepeat = repository.getRealSurfaceTestRun(workspace.id, run.id)
    assert.equal(afterRepeat.tasks.find((task) => task.id === doubao[0].id).attemptNumber, 1)
    assert.equal(afterRepeat.tasks.find((task) => task.id === kimi[0].id).agentState, 'needs-human')
  } finally {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})
