import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApplication } from '../../server/application.mjs'

let application
let origin
let workspaceId
let otherWorkspaceId

const json = async (path, options = {}) => {
  const response = await fetch(`${origin}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  })
  return { response, body: await response.json() }
}
const auth = (userId = 'admin-a', id = workspaceId) => ({ 'x-user-id': userId, 'x-workspace-id': id })
const diagnosticInput = () => ({
  name: '知识库工具类目 · 首轮基线',
  brandName: 'Example Knowledge',
  website: 'https://example.test/',
  markets: ['中国', '美国'],
  locales: ['zh-CN', 'en-US'],
  audiences: ['出海 SaaS 团队', '企业知识库负责人'],
  objective: '冻结可复测范围，后续以人工导入证据验证 Query Gap。',
  ownerId: 'admin-a',
})

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-brand-diagnostic-'))
  application = createApplication({ config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0 } })
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${application.server.address().port}`

  const created = await json('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: 'Tenant A', brand: 'Example Knowledge', administrator: { id: 'admin-a', name: 'Admin A' } }) })
  assert.equal(created.response.status, 201)
  workspaceId = created.body.workspace.id

  const other = await json('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: 'Tenant B', brand: 'Other', administrator: { id: 'admin-b', name: 'Admin B' } }) })
  assert.equal(other.response.status, 201)
  otherWorkspaceId = other.body.workspace.id
})

after(async () => {
  await new Promise((resolve) => application.server.close(resolve))
  const dataDir = application.config.dataDir
  application.database.close()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('brand diagnostic API', () => {
  it('persists a workspace-scoped diagnostic lifecycle and blocks incomplete baseline freezes', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, {
      method: 'POST', headers: auth(), body: JSON.stringify(diagnosticInput()),
    })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id
    assert.equal(created.body.project.coverage.status, 'pending-evidence')
    assert.equal(created.body.project.readiness.baselineReady, false)

    const denied = await json(`/api/workspaces/${otherWorkspaceId}/brand-diagnostics/${caseId}`, { headers: auth('admin-a', otherWorkspaceId) })
    assert.equal(denied.response.status, 403)

    const incompleteFreeze = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/freeze-baseline`, { method: 'POST', headers: auth() })
    assert.equal(incompleteFreeze.response.status, 409)
    assert.match(incompleteFreeze.body.error, /已审核品牌事实|Query Scope|测试计划/)

    const fact = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/facts`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        statement: '产品支持带来源引用的企业知识回答。', category: '产品能力', appliesToMarkets: ['中国', '美国'],
        sourceLabel: '官网产品页', sourceUrl: 'https://example.test/product', status: 'candidate', isProhibitedClaim: false,
      }),
    })
    assert.equal(fact.response.status, 201)
    assert.equal(fact.body.fact.status, 'candidate')

    const reviewed = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/facts/${fact.body.fact.id}/review`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ status: 'approved', reviewNote: '来源已核验。' }),
    })
    assert.equal(reviewed.response.status, 200)
    assert.equal(reviewed.body.fact.status, 'approved')

    const scope = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/query-scope`, {
      method: 'PUT', headers: auth(), body: JSON.stringify({
        journeys: ['发现与品类筛选', '采购评估'], queryTypes: ['品类发现', '能力评估'],
        markets: ['中国', '美国'], locales: ['zh-CN', 'en-US'], competitorSeeds: ['Notion'],
        expectedCount: 100, datasetVersionLabel: 'v0.1',
      }),
    })
    assert.equal(scope.response.status, 200)
    assert.equal(scope.body.queryScope.expectedCount, 100)

    const plan = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/collection-plan`, {
      method: 'PUT', headers: auth(), body: JSON.stringify({
        providers: ['DeepSeek', 'ChatGPT'], collectionMode: 'controlled-manual',
        frequency: '首轮一次', failurePolicy: '人工记录失败原因，并保留原始导出。',
      }),
    })
    assert.equal(plan.response.status, 200)
    assert.equal(plan.body.collectionPlan.collectionMode, 'controlled-manual')

    const frozen = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/freeze-baseline`, { method: 'POST', headers: auth() })
    assert.equal(frozen.response.status, 200)
    assert.equal(frozen.body.project.baseline.version, 1)
    assert.equal(frozen.body.project.baseline.snapshot.metrics.status, 'pending-evidence')
    assert.equal(frozen.body.project.coverage.status, 'pending-evidence')
    assert.equal(frozen.body.project.coverage.rate, null)
    assert.match(frozen.body.project.collectionBoundary, /不会登录或操作第三方模型网页/i)

    const list = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, { headers: auth() })
    assert.equal(list.response.status, 200)
    assert.equal(list.body.projects.length, 1)
    assert.equal(list.body.projects[0].baseline.version, 1)
  })
})




describe('actionable brand diagnostic launcher API', () => {
  const actionableInput = (overrides = {}) => ({
    brandName: 'Northstar Knowledge',
    website: 'https://northstar.example/',
    category: 'AI 知识库 / 企业搜索',
    marketPacks: ['CN', 'US'],
    audiences: ['企业知识库负责人', 'AI 产品负责人'],
    intents: ['品类发现', '工具比较'],
    evidenceUrls: ['https://northstar.example/product', 'https://northstar.example/help'],
    competitors: ['Notion', 'Guru'],
    executionPreference: 'ai-assisted',
    ...overrides,
  })

  it('creates an auditable plan, keeps unconfigured AI assistance blocked, and returns it on detail reads', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/launch`, {
      method: 'POST', headers: auth(), body: JSON.stringify(actionableInput()),
    })
    assert.equal(created.response.status, 201)
    assert.equal(created.body.launchPlan.state, 'configuration-required')
    assert.equal(created.body.launchPlan.queryResearch.estimatedCandidateCount, 80)
    assert.equal(created.body.launchPlan.testing.providers.length, 11)
    assert.equal(created.body.launchPlan.testing.plannedObservations, 88)
    assert.deepEqual(created.body.launchPlan.testing.channels, ['官网内容中心', '知乎', '微信公众号', '掘金', '官网 Blog', 'Help Center', 'Comparison Page', 'Medium / LinkedIn'])
    assert.equal(created.body.launchPlan.evidence.ownedSourceCount, 3)
    assert.deepEqual(created.body.launchPlan.brief.evidenceUrls, ['https://northstar.example/', 'https://northstar.example/product', 'https://northstar.example/help'])
    assert.match(created.body.launchPlan.readiness.detail, /尚未发起任何模型调用/)

    const caseId = created.body.project.project.id
    const loaded = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}`, { headers: auth() })
    assert.equal(loaded.response.status, 200)
    assert.equal(loaded.body.project.brief.category, 'AI 知识库 / 企业搜索')
    assert.equal(loaded.body.project.brief.version, 1)
    assert.equal(loaded.body.project.launchPlan.state, 'configuration-required')
    assert.equal(loaded.body.project.launchPlan.queryResearch.estimatedCandidateCount, 80)

    const denied = await json(`/api/workspaces/${otherWorkspaceId}/brand-diagnostics/${caseId}`, { headers: auth('admin-a', otherWorkspaceId) })
    assert.equal(denied.response.status, 403)
  })

  it('updates a launch brief server-side and preserves controlled manual as an explicit fallback', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/launch`, {
      method: 'POST', headers: auth(), body: JSON.stringify(actionableInput({ marketPacks: ['CN'], intents: ['采购评估'] })),
    })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id

    const updated = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/brief`, {
      method: 'PUT', headers: auth(), body: JSON.stringify(actionableInput({
        marketPacks: ['US'], intents: ['问题解决', '采购评估'], evidenceUrls: [], competitors: ['Glean'], executionPreference: 'controlled-manual',
      })),
    })
    assert.equal(updated.response.status, 200)
    assert.equal(updated.body.launchPlan.state, 'manual-ready')
    assert.equal(updated.body.launchPlan.briefVersion, 2)
    assert.equal(updated.body.launchPlan.queryResearch.estimatedCandidateCount, 40)
    assert.deepEqual(updated.body.launchPlan.testing.providers, ['ChatGPT', 'Gemini', 'Claude', 'Perplexity'])
    assert.equal(updated.body.project.collectionPlan.collectionMode, 'controlled-manual')
    assert.match(updated.body.launchPlan.readiness.detail, /不会登录或自动操作第三方模型网页/)
  })
})

describe('actionable diagnostic connector readiness', () => {
  it('marks an AI-assisted plan ready only when an approved provider has a stored credential', async () => {
    const configured = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ providerId: 'DeepSeek', market: 'CN', locale: 'zh-CN', collectionMode: 'official-api', baseUrl: 'https://api.deepseek.example/v1', modelName: 'deepseek-chat' }),
    })
    assert.equal(configured.response.status, 201)
    const credential = await json(`/api/workspaces/${workspaceId}/model-providers/${configured.body.provider.id}/credential`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ apiKey: 'test-key-123456' }),
    })
    assert.equal(credential.response.status, 201)
    application.repository.recordModelProviderTestResult({ workspaceId, actorId: 'admin-a', providerConfigurationId: configured.body.provider.id, status: 'verified', model: 'deepseek-chat', latencyMs: 120, message: '连接验证成功。' })

    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/launch`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        brandName: 'Connector Ready', website: 'https://connector-ready.example/', category: '跨境 SaaS', marketPacks: ['CN'],
        audiences: ['出海 SaaS 团队'], intents: ['品类发现'], executionPreference: 'ai-assisted',
      }),
    })
    assert.equal(created.response.status, 201)
    assert.equal(created.body.launchPlan.state, 'ready')
    assert.match(created.body.launchPlan.readiness.detail, /已有 1 个授权模型连接/)
    assert.match(created.body.launchPlan.readiness.detail, /将创建可审计的分析任务/)
  })
})

describe('real-surface baseline testing API', () => {
  it('generates reviewable core queries and derives baseline readiness from reviewed evidence', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, { method: 'POST', headers: auth(), body: JSON.stringify({ ...diagnosticInput(), name: 'T0 Real Surface' }) })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id

    const generated = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/baseline-query-sets/generate`, { method: 'POST', headers: auth(), body: JSON.stringify({ marketPack: 'US', count: 5 }) })
    assert.equal(generated.response.status, 201)
    assert.equal(generated.body.querySet.queries.length, 5)
    assert.equal(generated.body.querySet.queries[0].provenance, 'template:product-profile-v1')
    const querySet = generated.body.querySet

    for (const query of querySet.queries.slice(0, 2)) {
      const approved = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries/${query.id}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ status: 'approved' }) })
      assert.equal(approved.response.status, 200)
    }
    const edited = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries/${querySet.queries[0].id}`, {
      method: 'PATCH', headers: auth(), body: JSON.stringify({
        question: 'Which B2B knowledge base tools provide source-cited AI answers for enterprise teams?',
        intent: '能力评估', priority: 'high', rationale: 'Edited by a reviewer to evaluate source-cited answers before the baseline run.',
      }),
    })
    assert.equal(edited.response.status, 200)
    const editedQuery = edited.body.querySet.queries.find((query) => query.id === querySet.queries[0].id)
    assert.equal(editedQuery.status, 'draft')
    assert.equal(editedQuery.intent, '能力评估')
    assert.equal(editedQuery.priority, 'high')
    const reapproved = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries/${querySet.queries[0].id}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ status: 'approved' }) })
    assert.equal(reapproved.response.status, 200)

    const beforePublishRun = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs`, { method: 'POST', headers: auth(), body: JSON.stringify({ querySetId: querySet.id, marketPack: 'US', platforms: ['ChatGPT'], requestKey: `t0-before-publish-${caseId}` }) })
    assert.equal(beforePublishRun.response.status, 409)
    assert.match(beforePublishRun.body.error, /审核并发布|发布/)

    for (const query of querySet.queries.slice(2)) {
      const approved = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries/${query.id}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ status: 'approved' }) })
      assert.equal(approved.response.status, 200)
    }
    const published = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/publish`, { method: 'POST', headers: auth() })
    assert.equal(published.response.status, 200)
    assert.equal(published.body.querySet.lifecycleStatus, 'ready_for_test')
    assert.equal(published.body.querySet.health.approved, 5)

    const createdRun = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs`, { method: 'POST', headers: auth(), body: JSON.stringify({ querySetId: querySet.id, marketPack: 'US', platforms: ['ChatGPT'], requestKey: `t0-${caseId}` }) })
    assert.equal(createdRun.response.status, 201)
    assert.equal(createdRun.body.testRun.tasks.length, 5)
    const lockedEdit = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries/${querySet.queries[0].id}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ question: 'Which enterprise knowledge base tools provide source-cited answers after a Test Run starts?' }) })
    assert.equal(lockedEdit.response.status, 409)
    assert.match(lockedEdit.body.error, /不可直接修改|immutable|Test Run/)
    const runId = createdRun.body.testRun.id
    const task = createdRun.body.testRun.tasks[0]

    const claimed = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${runId}/tasks/${task.id}/claim`, { method: 'POST', headers: auth() })
    assert.equal(claimed.response.status, 200)
    const doubleClaim = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${runId}/tasks/${task.id}/claim`, { method: 'POST', headers: auth() })
    assert.equal(doubleClaim.response.status, 409)

    for (const candidate of claimed.body.testRun.tasks) {
      if (candidate.state === 'unassigned') {
        const response = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${runId}/tasks/${candidate.id}/claim`, { method: 'POST', headers: auth() })
        assert.equal(response.response.status, 200)
      }
      const submitted = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${runId}/tasks/${candidate.id}/observation`, { method: 'POST', headers: auth(), body: JSON.stringify({ rawAnswer: 'A real platform answer captured verbatim for audit.', citations: [], freshSession: true, searchEnabled: true, observedAt: '2026-09-28T10:00:00.000Z' }) })
      assert.equal(submitted.response.status, 200)
      const reviewed = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${runId}/tasks/${candidate.id}/review`, { method: 'POST', headers: auth(), body: JSON.stringify({ status: 'approved', reviewNote: 'Evidence complete.' }) })
      assert.equal(reviewed.response.status, 200)
    }
    const finalRun = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${runId}`, { headers: auth() })
    assert.equal(finalRun.response.status, 200)
    assert.equal(finalRun.body.testRun.state, 'baseline_ready')
    assert.equal(finalRun.body.testRun.progress.byState.reviewed, 5)
    const history = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs?view=history`, { headers: auth() })
    assert.equal(history.response.status, 200)
    assert.equal(history.body.testRuns.length, 1)
    assert.equal(history.body.testRuns[0].id, runId)  })

  it('uses the newest formal batch as the active diagnostic source and keeps it scoped to its project', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ ...diagnosticInput(), name: 'Active current-source case' }),
    })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id

    const generated = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/baseline-query-sets/generate`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ marketPack: 'US', count: 5 }),
    })
    assert.equal(generated.response.status, 201)
    const querySet = generated.body.querySet
    for (const query of querySet.queries) {
      const approved = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries/${query.id}`, {
        method: 'PATCH', headers: auth(), body: JSON.stringify({ status: 'approved' }),
      })
      assert.equal(approved.response.status, 200)
    }
    const published = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/publish`, { method: 'POST', headers: auth() })
    assert.equal(published.response.status, 200)

    const older = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ querySetId: querySet.id, marketPack: 'US', platforms: ['ChatGPT'], requestKey: `old-reviewed-${caseId}` }),
    })
    assert.equal(older.response.status, 201)
    for (const task of older.body.testRun.tasks) {
      const claimed = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${older.body.testRun.id}/tasks/${task.id}/claim`, { method: 'POST', headers: auth() })
      assert.equal(claimed.response.status, 200)
      const submitted = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${older.body.testRun.id}/tasks/${task.id}/observation`, {
        method: 'POST', headers: auth(), body: JSON.stringify({ rawAnswer: 'Older reviewed response.', citations: [], freshSession: true, searchEnabled: true, observedAt: '2026-09-30T09:00:00.000Z' }),
      })
      assert.equal(submitted.response.status, 200)
      const reviewed = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${older.body.testRun.id}/tasks/${task.id}/review`, {
        method: 'POST', headers: auth(), body: JSON.stringify({ status: 'approved', reviewNote: 'Reviewed old evidence.' }),
      })
      assert.equal(reviewed.response.status, 200)
    }

    const current = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ querySetId: querySet.id, marketPack: 'US', platforms: ['ChatGPT'], requestKey: `current-unreviewed-${caseId}` }),
    })
    assert.equal(current.response.status, 201)
    assert.notEqual(current.body.testRun.id, older.body.testRun.id)
    assert.equal(application.database.prepare('SELECT active_real_surface_test_run_id AS id FROM brand_diagnostic_cases WHERE workspace_id=? AND id=?').get(workspaceId, caseId).id, current.body.testRun.id)

    const active = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs`, { headers: auth() })
    assert.equal(active.response.status, 200)
    assert.equal(active.body.testRun.id, current.body.testRun.id)
    assert.equal(active.body.testRun.state, 'active')

    const enrollment = await json(`/api/workspaces/${workspaceId}/browser-agents/enrollments`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ label: 'Append test device', platforms: ['豆包'] }),
    })
    assert.equal(enrollment.response.status, 201)
    const paired = await json('/api/browser-agents/enroll', {
      method: 'POST', body: JSON.stringify({ enrollmentCode: enrollment.body.enrollmentCode, label: 'Append test device', platforms: ['豆包'], adapters: [{ id: 'doubao-web', version: '0.3.25', platform: '豆包' }] }),
    })
    assert.equal(paired.response.status, 201)

    const appended = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${current.body.testRun.id}/platforms`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ browserAgentId: paired.body.agent.id, platforms: ['Claude'] }),
    })
    assert.equal(appended.response.status, 201)
    assert.deepEqual(appended.body.addedPlatforms, ['Claude'])
    assert.equal(appended.body.testRun.id, current.body.testRun.id)
    const activeAfterAppend = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs`, { headers: auth() })
    assert.equal(activeAfterAppend.body.testRun.id, current.body.testRun.id)

    const history = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs?view=history`, { headers: auth() })
    assert.equal(history.response.status, 200)
    assert.equal(history.body.testRuns.some((item) => item.id === older.body.testRun.id), true)
    assert.equal(history.body.testRuns.some((item) => item.id === current.body.testRun.id), true)

    application.database.prepare('UPDATE brand_diagnostic_cases SET active_real_surface_test_run_id=NULL WHERE workspace_id=? AND id=?').run(workspaceId, caseId)
    const recovered = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs`, { headers: auth() })
    assert.equal(recovered.body.testRun.id, current.body.testRun.id)
    assert.equal(application.database.prepare('SELECT active_real_surface_test_run_id AS id FROM brand_diagnostic_cases WHERE workspace_id=? AND id=?').get(workspaceId, caseId).id, current.body.testRun.id)

    const otherProject = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ ...diagnosticInput(), name: 'No active batch project' }),
    })
    assert.equal(otherProject.response.status, 201)
    const emptyActive = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${otherProject.body.project.project.id}/real-surface-test-runs`, { headers: auth() })
    assert.equal(emptyActive.response.status, 200)
    assert.equal(emptyActive.body.testRun, null)
  })
})

describe('configurable query generation and connection governance', () => {
  it('persists versioned prompt settings, supports custom template counts and manual Query provenance, and fails closed without an executable connection', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ ...diagnosticInput(), name: 'Configurable Query Intake' }),
    })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id

    const settings = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, { headers: auth() })
    assert.equal(settings.response.status, 200)
    assert.equal(settings.body.prompt.status, 'active')
    assert.match(settings.body.prompt.template, /{{product_profile}}/)
    assert.match(settings.body.prompt.template, /{{count}}/)
    assert.ok(Array.isArray(settings.body.providers))

    const templateSet = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/baseline-query-sets/generate`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        marketPack: 'CN', count: 12, generator: 'template',
        keywords: ['AI 知识库', '来源可追溯'], intents: ['品类发现', '能力评估'], promptId: settings.body.prompt.id,
      }),
    })
    assert.equal(templateSet.response.status, 201)
    assert.equal(templateSet.body.querySet.queries.length, 12)
    assert.equal(templateSet.body.generation.mode, 'template')
    assert.match(templateSet.body.generation.label, /未调用模型/)

    const manual = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${templateSet.body.querySet.id}/queries`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        question: '企业知识库如何保证每条回答都能回溯到可信来源？', intent: '问题解决', priority: 'high', rationale: '来自售前访谈中的高频可信度问题。',
        queryType: '问题解决', journeyStage: '比较', targetEntityType: '品牌', targetEntities: ['知识库产品'], sourceType: 'sales-feedback', sourceReference: '售前访谈整理', isBaseline: true,
      }),
    })
    assert.equal(manual.response.status, 201)
    assert.equal(manual.body.querySet.queries.at(-1).provenance, 'manual')
    assert.equal(manual.body.querySet.queries.at(-1).sourceType, 'sales-feedback')
    assert.deepEqual(manual.body.querySet.queries.at(-1).targetEntities, ['知识库产品'])

    const noConnection = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/baseline-query-sets/generate`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ marketPack: 'CN', count: 5, generator: 'llm', keywords: ['AI 知识库'], intents: ['品类发现'], providerConfigurationId: 'missing' }),
    })
    assert.equal(noConnection.response.status, 409)

    const configured = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        providerId: 'OpenAI Compatible', market: 'GLOBAL', locale: 'en-US', collectionMode: 'official-api',
        baseUrl: 'https://api.example.test/v1', modelName: 'query-model', useForQueryGeneration: true,
      }),
    })
    assert.equal(configured.response.status, 201)
    assert.equal(configured.body.provider.execution.baseUrl, 'https://api.example.test/v1')
    assert.equal(configured.body.provider.execution.modelName, 'query-model')

    const settingsAfter = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, { headers: auth() })
    assert.equal(settingsAfter.response.status, 200)
    const newConnection = settingsAfter.body.providers.find((provider) => provider.id === configured.body.provider.id)
    assert.equal(newConnection.credential?.configured ?? false, false)
    assert.equal(newConnection.executable, false)
    assert.equal(JSON.stringify(settingsAfter.body), JSON.stringify(settingsAfter.body).replace(/apiKey/gi, ''))

    const needsCredential = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/baseline-query-sets/generate`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ marketPack: 'US', count: 5, generator: 'llm', keywords: ['B2B knowledge base'], intents: ['方案比较'], providerConfigurationId: configured.body.provider.id, promptId: settings.body.prompt.id }),
    })
    assert.equal(needsCredential.response.status, 409)
    assert.match(needsCredential.body.error, /尚未验证|保存并测试/)
  })
})



  it('enrolls a browser agent, atomically claims only supported web tasks, and preserves browser evidence provenance', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, { method: 'POST', headers: auth(), body: JSON.stringify({ ...diagnosticInput(), name: 'Browser Agent T0' }) })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id
    const generated = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/baseline-query-sets/generate`, { method: 'POST', headers: auth(), body: JSON.stringify({ marketPack: 'CN', count: 5, generator: 'template' }) })
    assert.equal(generated.response.status, 201)
    const querySet = generated.body.querySet
    const queries = querySet.queries
    assert.equal(queries.length, 5)
    for (const query of queries) {
      const approved = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries/${query.id}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ status: 'approved' }) })
      assert.equal(approved.response.status, 200)
    }

    const published = await json(`/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/publish`, { method: 'POST', headers: auth() })
    assert.equal(published.response.status, 200)
    assert.equal(published.body.querySet.lifecycleStatus, 'ready_for_test')

    const nonAdminEnrollment = await json(`/api/workspaces/${workspaceId}/browser-agents/enrollments`, { method: 'POST', headers: auth('viewer-a'), body: JSON.stringify({ label: 'Viewer device', platforms: ['豆包'] }) })
    assert.equal(nonAdminEnrollment.response.status, 403)

    const enrollment = await json(`/api/workspaces/${workspaceId}/browser-agents/enrollments`, { method: 'POST', headers: auth(), body: JSON.stringify({ label: '豆包受控浏览器', platforms: ['豆包'] }) })
    assert.equal(enrollment.response.status, 201)
    assert.match(enrollment.body.enrollmentCode, /^[A-Za-z0-9_-]+$/)
    assert.equal(enrollment.body.agent.status, 'pending')

    const paired = await json('/api/browser-agents/enroll', { method: 'POST', body: JSON.stringify({ enrollmentCode: enrollment.body.enrollmentCode, label: '豆包受控浏览器', platforms: ['豆包'], adapters: [{ id: 'doubao-web', version: '0.1.0', platform: '豆包' }] }) })
    assert.equal(paired.response.status, 201)
    assert.equal(paired.body.agent.status, 'online')
    assert.ok(paired.body.token)
    const secondPairing = await json('/api/browser-agents/enroll', { method: 'POST', body: JSON.stringify({ enrollmentCode: enrollment.body.enrollmentCode }) })
    assert.equal(secondPairing.response.status, 409)

    const createdRun = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/real-surface-test-runs`, { method: 'POST', headers: auth(), body: JSON.stringify({ querySetId: querySet.id, marketPack: 'CN', platforms: ['豆包', 'Kimi'], browserAgentId: paired.body.agent.id, requestKey: `browser-${caseId}` }) })
    assert.equal(createdRun.response.status, 201)
    const browserTasks = createdRun.body.testRun.tasks.filter((item) => item.platform === '豆包')
    const browserTask = browserTasks[0]
    const manualTasks = createdRun.body.testRun.tasks.filter((item) => item.platform === 'Kimi')
    assert.equal(browserTasks.length, 5)
    assert.equal(browserTask.executionMode, 'browser-agent')
    assert.equal(browserTask.agentState, 'queued')
    assert.equal(manualTasks.length, 5)
    assert.ok(manualTasks.every((item) => item.executionMode === 'controlled-manual'))
    assert.ok(manualTasks.every((item) => /不支持|人工兜底/.test(item.agentStateReason ?? '')))

    const agentAuth = { authorization: `Bearer ${paired.body.token}` }
    const started = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${createdRun.body.testRun.id}/browser-agent-start`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ browserAgentId: paired.body.agent.id, platform: '豆包' }),
    })
    assert.equal(started.response.status, 201)
    const firstPoll = await json('/api/browser-agents/tasks', { headers: agentAuth })
    assert.equal(firstPoll.response.status, 200)
    assert.equal(firstPoll.body.tasks.length, 1)
    assert.equal(firstPoll.body.tasks[0].id, browserTask.id)
    // A fresh local Agent process does not retain its in-memory current task. The server
    // must return the existing claim so the same device can recover instead of stalling.
    const secondPoll = await json('/api/browser-agents/tasks', { headers: agentAuth })
    assert.equal(secondPoll.response.status, 200)
    assert.equal(secondPoll.body.tasks.length, 1)
    assert.equal(secondPoll.body.tasks[0].id, browserTask.id)
    assert.equal(secondPoll.body.tasks[0].recovered, true)

    const running = await json(`/api/browser-agents/tasks/${browserTask.id}`, { method: 'POST', headers: agentAuth, body: JSON.stringify({ status: 'running' }) })
    assert.equal(running.response.status, 200)
    const unsafeCompleted = await json(`/api/browser-agents/tasks/${browserTask.id}`, { method: 'POST', headers: agentAuth, body: JSON.stringify({ status: 'completed', evidence: { rawAnswer: '这是豆包网页中实际可见的回答，含有可核验的来源链接。', citations: ['https://example.test/source'], observedAt: '2026-09-28T10:00:00.000Z', freshSession: true, searchEnabled: true, captureMetadata: { adapterId: 'doubao-web', cookie: 'must-not-persist' } } }) })
    assert.equal(unsafeCompleted.response.status, 400)
    assert.match(unsafeCompleted.body.error, /Cookie|密码|令牌/)
    const completed = await json(`/api/browser-agents/tasks/${browserTask.id}`, { method: 'POST', headers: agentAuth, body: JSON.stringify({ status: 'completed', evidence: { rawAnswer: '这是豆包网页中实际可见的回答，含有可核验的来源链接。', citations: ['https://example.test/source'], observedAt: '2026-09-28T10:00:00.000Z', freshSession: true, searchEnabled: true, captureMetadata: { adapterId: 'doubao-web', source: 'visible-dom-text', visibleLinks: [
      { url: 'https://example.test/source', title: '回答内引用', sourceType: 'answer-citation', position: 1 },
      { url: 'https://example.test/search-source', title: '页面搜索结果', sourceType: 'platform-search-result', position: 1, urlAvailable: true },
      { url: '', title: '页面可见但无 URL 的来源标题', sourceType: 'platform-search-result', position: 2, urlAvailable: false },
    ] } } }) })
    assert.equal(completed.response.status, 200)
    assert.match(completed.body.evidenceHash, /^[a-f0-9]{64}$/)

    const run = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${createdRun.body.testRun.id}`, { headers: auth() })
    const captured = run.body.testRun.tasks.find((item) => item.id === browserTask.id)
    assert.equal(captured.observation.collectionMethod, 'browser-agent')
    assert.equal(captured.observation.adapterId, 'doubao-web')
    assert.deepEqual(captured.observation.citations, ['https://example.test/source'])
    assert.equal(captured.observation.captureMetadata.source, 'visible-dom-text')
    assert.deepEqual(captured.observation.captureMetadata.visibleLinks, [
      { url: 'https://example.test/source', title: '回答内引用', sourceType: 'answer-citation', position: 1 },
      { url: 'https://example.test/search-source', title: '页面搜索结果', sourceType: 'platform-search-result', position: 1, urlAvailable: true },
      { url: '', title: '页面可见但无 URL 的来源标题', sourceType: 'platform-search-result', position: 2, urlAvailable: false },
    ])
    assert.equal(Object.hasOwn(captured.observation.captureMetadata, 'cookie'), false)

    const nextPoll = await json('/api/browser-agents/tasks', { headers: agentAuth })
    assert.equal(nextPoll.response.status, 200)
    assert.equal(nextPoll.body.tasks.length, 1)
    assert.notEqual(nextPoll.body.tasks[0].id, browserTask.id)
    const pendingBrowserTaskId = nextPoll.body.tasks[0].id
    const temporaryFallback = await json(`/api/browser-agents/tasks/${pendingBrowserTaskId}`, { method: 'POST', headers: agentAuth, body: JSON.stringify({ status: 'needs-human', reason: '豆包页面结构更新，等待重试。' }) })
    assert.equal(temporaryFallback.response.status, 200)
    assert.equal(temporaryFallback.body.fallback, 'controlled-manual')

    const retried = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${createdRun.body.testRun.id}/tasks/${pendingBrowserTaskId}/retry-browser-agent`, { method: 'POST', headers: auth(), body: JSON.stringify({ browserAgentId: paired.body.agent.id }) })
    assert.equal(retried.response.status, 200)
    const retriedTask = retried.body.testRun.tasks.find((item) => item.id === pendingBrowserTaskId)
    assert.equal(retriedTask.executionMode, 'browser-agent')
    assert.equal(retriedTask.browserAgentId, paired.body.agent.id)
    assert.equal(retriedTask.agentState, 'queued')
    assert.equal(retriedTask.state, 'unassigned')
    assert.equal(retriedTask.attemptNumber, 1)
    const retryPoll = await json('/api/browser-agents/tasks', { headers: agentAuth })
    assert.equal(retryPoll.response.status, 200)
    assert.equal(retryPoll.body.tasks[0].id, pendingBrowserTaskId)

    const revoked = await json(`/api/workspaces/${workspaceId}/browser-agents/${paired.body.agent.id}/revoke`, { method: 'POST', headers: auth() })
    assert.equal(revoked.response.status, 200)
    assert.equal(revoked.body.agent.status, 'revoked')
    const revokedPoll = await json('/api/browser-agents/tasks', { headers: agentAuth })
    assert.equal(revokedPoll.response.status, 401)

    const afterRevocation = await json(`/api/workspaces/${workspaceId}/real-surface-test-runs/${createdRun.body.testRun.id}`, { headers: auth() })
    const fallbackTask = afterRevocation.body.testRun.tasks.find((item) => item.id === pendingBrowserTaskId)
    assert.equal(fallbackTask.executionMode, 'controlled-manual')
    assert.equal(fallbackTask.browserAgentId, null)
    assert.equal(fallbackTask.state, 'unassigned')
    assert.equal(fallbackTask.agentState, 'needs-human')
    assert.match(fallbackTask.agentStateReason, /撤销.*人工兜底/)
  })




describe('brand diagnostic project deletion', () => {
  it('requires an administrator and exact-name confirmation, cascades project records, and preserves workspace isolation', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ ...diagnosticInput(), name: 'Deletion safety case' }),
    })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id

    const fact = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/facts`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        statement: 'Deletion regression fact.', category: 'Product capability', appliesToMarkets: ['US'],
        sourceLabel: 'Test source', sourceUrl: 'https://example.test/delete', status: 'candidate', isProhibitedClaim: false,
      }),
    })
    assert.equal(fact.response.status, 201)

    const mismatch = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}`, {
      method: 'DELETE', headers: auth(), body: JSON.stringify({ confirmationName: 'wrong name' }),
    })
    assert.equal(mismatch.response.status, 409)

    const crossWorkspace = await json(`/api/workspaces/${otherWorkspaceId}/brand-diagnostics/${caseId}`, {
      method: 'DELETE', headers: auth('admin-b', otherWorkspaceId), body: JSON.stringify({ confirmationName: 'Deletion safety case' }),
    })
    assert.equal(crossWorkspace.response.status, 409)

    const removed = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}`, {
      method: 'DELETE', headers: auth(), body: JSON.stringify({ confirmationName: 'Deletion safety case' }),
    })
    assert.equal(removed.response.status, 200)
    assert.deepEqual(removed.body.deleted, { id: caseId, name: 'Deletion safety case' })

    const missing = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}`, { headers: auth() })
    assert.equal(missing.response.status, 404)
    const projects = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, { headers: auth() })
    assert.equal(projects.response.status, 200)
    assert.equal(projects.body.projects.some((item) => item.id === caseId), false)
    const storedFact = application.database.prepare('SELECT id FROM brand_diagnostic_facts WHERE workspace_id=? AND case_id=?').get(workspaceId, caseId)
    assert.equal(storedFact, undefined)
    const audit = await json(`/api/workspaces/${workspaceId}/audit`, { headers: auth() })
    assert.equal(audit.body.events.some((event) => event.action === 'brand-diagnostic.deleted' && event.target === caseId), true)
  })
})
