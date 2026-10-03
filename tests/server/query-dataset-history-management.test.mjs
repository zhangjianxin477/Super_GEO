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

const auth = (userId = 'admin-history', id = workspaceId) => ({
  'x-user-id': userId,
  'x-workspace-id': id,
})

const diagnosticInput = () => ({
  name: 'Query Dataset history governance',
  brandName: 'Example Knowledge',
  website: 'https://example.test/',
  markets: ['中国'],
  locales: ['zh-CN'],
  audiences: ['企业知识库负责人'],
  objective: '验证 Query Dataset 的历史管理、当前版本和删除治理。',
  ownerId: 'admin-history',
})

const querySetCollectionPath = (caseId) =>
  `/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/baseline-query-sets`
const querySetPath = (querySetId) =>
  `/api/workspaces/${workspaceId}/baseline-query-sets/${querySetId}`

async function approveAndPublish(querySet) {
  let latest = querySet
  for (const query of latest.queries) {
    const reviewed = await json(`${querySetPath(latest.id)}/queries/${query.id}`, {
      method: 'PATCH',
      headers: auth(),
      body: JSON.stringify({ status: 'approved' }),
    })
    assert.equal(reviewed.response.status, 200)
    latest = reviewed.body.querySet
  }
  const published = await json(`${querySetPath(latest.id)}/publish`, {
    method: 'POST',
    headers: auth(),
  })
  assert.equal(published.response.status, 200)
  return published.body.querySet
}

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-query-history-'))
  application = createApplication({
    config: {
      projectRoot: process.cwd(),
      dataDir,
      dbPath: join(dataDir, 'harness.sqlite'),
      port: 0,
    },
  })
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${application.server.address().port}`

  const workspace = await json('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({
      name: 'History tenant',
      brand: 'Example Knowledge',
      administrator: { id: 'admin-history', name: 'History Admin' },
    }),
  })
  assert.equal(workspace.response.status, 201)
  workspaceId = workspace.body.workspace.id

  const other = await json('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Other history tenant',
      brand: 'Other',
      administrator: { id: 'admin-other', name: 'Other Admin' },
    }),
  })
  assert.equal(other.response.status, 201)
  otherWorkspaceId = other.body.workspace.id

  const analyst = await json(`/api/workspaces/${workspaceId}/members`, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({ userId: 'analyst-history', name: 'History Analyst', role: 'analyst' }),
  })
  assert.equal(analyst.response.status, 201)
})

after(async () => {
  await new Promise((resolve) => application.server.close(resolve))
  const dataDir = application.config.dataDir
  application.database.close()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('Query Dataset history management API', () => {
  it('archives, restores and switches the only active Dataset without polluting operational history', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify(diagnosticInput()),
    })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id

    const generated = await json(`${querySetCollectionPath(caseId)}/generate`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ marketPack: 'CN', count: 5, generator: 'template' }),
    })
    assert.equal(generated.response.status, 201)
    const first = await approveAndPublish(generated.body.querySet)
    assert.equal(first.isActive, true)
    assert.equal(first.lifecycleStatus, 'ready_for_test')

    const revision = await json(`${querySetPath(first.id)}/revision`, {
      method: 'POST',
      headers: auth(),
    })
    assert.equal(revision.response.status, 201)
    const secondDraft = revision.body.querySet
    assert.equal(secondDraft.isActive, true)
    assert.equal(secondDraft.lifecycleStatus, 'draft')

    const archived = await json(`${querySetPath(secondDraft.id)}/archive`, {
      method: 'POST',
      headers: auth(),
    })
    assert.equal(archived.response.status, 200)
    assert.ok(archived.body.querySet.archivedAt)
    assert.equal(archived.body.querySet.isActive, false)

    let listed = await json(querySetCollectionPath(caseId), { headers: auth() })
    assert.equal(listed.response.status, 200)
    assert.equal(listed.body.querySets.filter((item) => item.isActive).length, 1)
    assert.equal(listed.body.querySets.find((item) => item.id === first.id)?.isActive, true)

    const restored = await json(`${querySetPath(secondDraft.id)}/restore`, {
      method: 'POST',
      headers: auth(),
    })
    assert.equal(restored.response.status, 200)
    assert.equal(restored.body.querySet.archivedAt, null)
    assert.equal(restored.body.querySet.isActive, false)

    const second = await approveAndPublish(restored.body.querySet)
    const activated = await json(`${querySetPath(second.id)}/activate`, {
      method: 'POST',
      headers: auth(),
    })
    assert.equal(activated.response.status, 200)
    assert.equal(activated.body.querySet.isActive, true)

    listed = await json(querySetCollectionPath(caseId), { headers: auth() })
    assert.equal(listed.body.querySets.filter((item) => item.isActive).length, 1)
    assert.equal(listed.body.querySets.find((item) => item.id === first.id)?.isActive, false)
    assert.equal(listed.body.querySets.find((item) => item.id === second.id)?.isActive, true)

    const auditActions = application.database
      .prepare("SELECT action FROM real_surface_audit_events WHERE workspace_id=? AND entity_type='baseline_query_set'")
      .all(workspaceId)
      .map((row) => row.action)
    assert.ok(auditActions.includes('archived'))
    assert.ok(auditActions.includes('restored'))
    assert.ok(auditActions.includes('active_designated'))
  })

  it('allows only administrators to permanently delete an unused draft with exact confirmation', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ ...diagnosticInput(), name: 'Dataset deletion governance' }),
    })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id

    const createdDraft = await json(querySetCollectionPath(caseId), {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        name: '可清理的草稿 Dataset',
        marketPack: 'CN',
        question: '企业知识库如何建立首轮 GEO Query 测试集合？',
        intent: '品类发现',
        rationale: '验证未使用草稿可安全删除。',
        priority: 'medium',
      }),
    })
    assert.equal(createdDraft.response.status, 201)
    const draft = createdDraft.body.querySet

    const denied = await json(querySetPath(draft.id), {
      method: 'DELETE',
      headers: auth('analyst-history'),
      body: JSON.stringify({ confirmation: draft.name }),
    })
    assert.equal(denied.response.status, 403)

    const mismatch = await json(querySetPath(draft.id), {
      method: 'DELETE',
      headers: auth(),
      body: JSON.stringify({ confirmation: '不完整名称' }),
    })
    assert.equal(mismatch.response.status, 409)

    const crossWorkspace = await json(`/api/workspaces/${otherWorkspaceId}/baseline-query-sets/${draft.id}`, {
      method: 'DELETE',
      headers: auth('admin-other', otherWorkspaceId),
      body: JSON.stringify({ confirmation: draft.name }),
    })
    assert.equal(crossWorkspace.response.status, 409)

    const deleted = await json(querySetPath(draft.id), {
      method: 'DELETE',
      headers: auth(),
      body: JSON.stringify({ confirmation: draft.name }),
    })
    assert.equal(deleted.response.status, 200)
    assert.deepEqual(deleted.body.deleted, { id: draft.id, caseId })

    const listed = await json(querySetCollectionPath(caseId), { headers: auth() })
    assert.equal(listed.body.querySets.some((item) => item.id === draft.id), false)

    const audit = application.database
      .prepare("SELECT action FROM real_surface_audit_events WHERE workspace_id=? AND entity_id=?")
      .all(workspaceId, draft.id)
      .map((row) => row.action)
    assert.ok(audit.includes('deleted_unused_draft'))
  })
})
