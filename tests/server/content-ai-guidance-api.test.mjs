import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApplication } from '../../server/application.mjs'

let application
let origin
let workspaceId
let adminId
let marketPack
let diagnosis
let modelOrigin
let modelServer
const modelRequests = []

const json = async (path, options = {}) => {
  const response = await fetch(`${origin}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  })
  return { response, body: await response.json() }
}
const auth = () => ({ 'x-user-id': adminId, 'x-workspace-id': workspaceId })

before(async () => {
  modelServer = createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const request = JSON.parse(raw || '{}')
    modelRequests.push(request)
    const system = request.messages?.[0]?.content ?? ''
    const content = system.includes('企业级 GEO 内容策略助手')
      ? '## 内容方案\n\n- 围绕已选 Query 回答产品选型问题。\n- 仅使用提供的事实和来源。\n- 不承诺曝光、引用或排名。'
      : system.includes('企业级 GEO 内容写作助手')
        ? '# 可追溯 AI 知识库选型指南\n\n本文基于已批准的证据范围说明：团队应核验来源链路、适用场景与知识图谱上下文。\n\n## 下一步\n\n请在发布前由内容负责人核对所有产品事实与链接。'
        : 'GEO connection is ready.'
    res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': 'content-studio-fixture' })
    res.end(JSON.stringify({ model: 'content-fixture-v1', choices: [{ message: { content } }] }))
  })
  await new Promise((resolve) => modelServer.listen(0, '127.0.0.1', resolve))
  modelOrigin = `http://127.0.0.1:${modelServer.address().port}`

  const dataDir = mkdtempSync(join(tmpdir(), 'geo-content-ai-'))
  application = createApplication({ config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0 } })
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${application.server.address().port}`
  const seed = await json('/api/development/sample-workspace', { method: 'POST' })
  workspaceId = seed.body.sample.workspace.id
  adminId = seed.body.sample.administrator.id
  const packs = await json(`/api/workspaces/${workspaceId}/market-packs`, { headers: auth() })
  marketPack = packs.body.marketPacks.find((item) => item.locale === 'zh-CN')
  const dashboard = await json(`/api/workspaces/${workspaceId}/market-packs/${marketPack.id}/dashboard`, { headers: auth() })
  diagnosis = dashboard.body.dashboard.diagnoses[0]
})

after(async () => {
  await new Promise((resolve) => application.server.close(resolve))
  await new Promise((resolve) => modelServer.close(resolve))
  const dataDir = application.config.dataDir
  application.database.close()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('AI-guided content studio API', () => {
  it('fails closed without an executable connection, then persists profile and prompt metadata for the AI plan and draft', async () => {
    const profiles = await json(`/api/workspaces/${workspaceId}/content-prompt-profiles`, { headers: auth() })
    assert.equal(profiles.response.status, 200)
    const profile = profiles.body.profiles.find((item) => item.id === 'b2b-explainer-zh-v1')
    assert.ok(profile)
    assert.equal(profile.version, 'v2')

    const planInput = {
      logicalKey: 'ai-guided-content-plan',
      marketPackId: marketPack.id,
      targetQueryIds: diagnosis.queryIds,
      channel: marketPack.channels[0],
      contentType: 'faq',
      title: '如何评估 AI 知识库的来源可追溯能力？',
      writingProfileId: profile.id,
      modelProviderConfigurationId: 'unverified-connection',
    }
    const blocked = await json(`/api/workspaces/${workspaceId}/content-opportunities/${diagnosis.id}/ai-plan`, {
      method: 'POST', headers: auth(), body: JSON.stringify(planInput),
    })
    assert.equal(blocked.response.status, 409)
    assert.match(blocked.body.error, /已验证、可执行的模型连接/)

    const configured = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        providerId: '内容生成测试网关', market: 'CN', locale: 'zh-CN', collectionMode: 'enterprise-gateway',
        baseUrl: `${modelOrigin}/v1`, modelName: 'content-fixture-v1', useForQueryGeneration: false,
      }),
    })
    assert.equal(configured.response.status, 201)
    const providerId = configured.body.provider.id
    const credential = await json(`/api/workspaces/${workspaceId}/model-providers/${providerId}/credential`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ apiKey: 'sk-content-studio-fixture-1234' }),
    })
    assert.equal(credential.response.status, 201)
    const verified = await json(`/api/workspaces/${workspaceId}/model-providers/${providerId}/test`, { method: 'POST', headers: auth() })
    assert.equal(verified.response.status, 200)
    assert.equal(verified.body.test.status, 'verified')

    const planned = await json(`/api/workspaces/${workspaceId}/content-opportunities/${diagnosis.id}/ai-plan`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ ...planInput, modelProviderConfigurationId: providerId }),
    })
    assert.equal(planned.response.status, 201, JSON.stringify(planned.body))
    assert.equal(planned.body.brief.status, 'needs-review')
    assert.equal(planned.body.brief.brief.writingProfile.id, profile.id)
    assert.equal(planned.body.brief.brief.writingProfile.version, profile.version)
    assert.equal(planned.body.aiInvocation.capability, 'content-brief')
    assert.equal(planned.body.aiInvocation.modelIdentity, 'content-fixture-v1')
    assert.match(planned.body.executionBoundary, /已通过选定的已验证模型/)

    const storedPlanPrompt = await json(`/api/workspaces/${workspaceId}/artifacts/${planned.body.promptArtifact.id}`, { headers: auth() })
    assert.equal(storedPlanPrompt.response.status, 200)
    assert.equal(storedPlanPrompt.body.payload.profile.id, profile.id)
    assert.equal(storedPlanPrompt.body.payload.profile.version, profile.version)

    const approvedBrief = await json(`/api/workspaces/${workspaceId}/content-briefs/${planned.body.brief.id}/review`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ status: 'approved', reviewComment: '已核对事实范围、渠道规则和写作策略。' }),
    })
    assert.equal(approvedBrief.response.status, 200)

    const draft = await json(`/api/workspaces/${workspaceId}/content-briefs/${planned.body.brief.id}/drafts`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        logicalKey: 'ai-guided-content-draft', title: planInput.title, modelProviderConfigurationId: providerId,
        contentPromptProfileId: profile.id,
      }),
    })
    assert.equal(draft.response.status, 201)
    assert.equal(draft.body.aiInvocation.capability, 'content-draft')
    assert.equal(draft.body.aiInvocation.modelIdentity, 'content-fixture-v1')
    assert.equal(draft.body.draft.draft.writingProfile.id, profile.id)
    assert.equal(draft.body.draft.draft.writingProfile.version, profile.version)
    assert.match(draft.body.executionBoundary, /verified configured LLM/i)
    assert.ok(modelRequests.some((request) => request.messages?.[0]?.content?.includes('企业级 GEO 内容策略助手')))
    assert.ok(modelRequests.some((request) => request.messages?.[0]?.content?.includes('企业级 GEO 内容写作助手')))
    assert.equal(JSON.stringify(draft.body).includes('sk-content-studio-fixture-1234'), false)
  })

  it('persists custom Prompt Profile versions and keeps approved Brief/Draft history pinned to the saved snapshot', async () => {
    const providers = await json(`/api/workspaces/${workspaceId}/model-providers`, { headers: auth() })
    const provider = providers.body.providers.find((item) => item.execution?.modelName === 'content-fixture-v1' && item.test?.status === 'verified')
    assert.ok(provider, 'requires the verified model connection from the content generation setup')

    const customInput = {
      name: '官网 Blog · 问题解答型',
      description: '把买方的疑问写成可核验的官网文章，并保留明确的适用边界。',
      tone: '专业、克制、面向决策者',
      channelGuidance: '开头先回答问题；正文使用小标题；结尾只给出人工可执行的下一步。',
      systemInstruction: 'CUSTOM_PROFILE_V1：面向 B2B SaaS 买方，不写未经证据支持的能力、排名或效果承诺。',
      outputContract: 'Markdown 格式；包含摘要、问题拆解、已证实事实、限制和证据引用。',
      channelTags: ['官网 Blog', '知乎'],
      contentTypeTags: ['行业观点 / Blog', 'FAQ / Help Center'],
    }
    const created = await json(`/api/workspaces/${workspaceId}/content-prompt-profiles`, {
      method: 'POST', headers: auth(), body: JSON.stringify(customInput),
    })
    assert.equal(created.response.status, 201, JSON.stringify(created.body))
    const profile = created.body.profile
    assert.equal(profile.source, 'workspace')
    assert.equal(profile.version, 1)
    assert.equal(profile.status, 'active')

    const listed = await json(`/api/workspaces/${workspaceId}/content-prompt-profiles`, { headers: auth() })
    assert.equal(listed.response.status, 200)
    assert.ok(listed.body.profiles.some((item) => item.id === profile.id && item.source === 'workspace' && item.editable === true))

    const beforePlanCalls = modelRequests.length
    const plan = await json(`/api/workspaces/${workspaceId}/content-opportunities/${diagnosis.id}/ai-plan`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        logicalKey: 'custom-profile-snapshot-plan', marketPackId: marketPack.id, targetQueryIds: diagnosis.queryIds,
        channel: marketPack.channels[0], contentType: 'editorial', title: '如何审慎评估企业知识库的可追溯性？',
        writingProfileId: profile.id, modelProviderConfigurationId: provider.id,
      }),
    })
    assert.equal(plan.response.status, 201, JSON.stringify(plan.body))
    assert.equal(plan.body.brief.brief.writingProfile.snapshot.systemInstruction, customInput.systemInstruction)
    assert.equal(plan.body.brief.brief.writingProfile.snapshot.version, 1)
    assert.ok(modelRequests.slice(beforePlanCalls).some((request) => request.messages?.[0]?.content?.includes('CUSTOM_PROFILE_V1')))

    const changedInput = { ...customInput, description: '已更新的文案说明。', systemInstruction: 'CUSTOM_PROFILE_V2：这是后续新内容才可使用的新版指令。' }
    const updated = await json(`/api/workspaces/${workspaceId}/content-prompt-profiles/${profile.id}`, {
      method: 'PUT', headers: auth(), body: JSON.stringify(changedInput),
    })
    assert.equal(updated.response.status, 200, JSON.stringify(updated.body))
    assert.equal(updated.body.profile.version, 2)
    assert.equal(updated.body.profile.systemInstruction, changedInput.systemInstruction)

    const reviewed = await json(`/api/workspaces/${workspaceId}/content-briefs/${plan.body.brief.id}/review`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ status: 'approved', reviewComment: '事实边界与写作任务均已核对。' }),
    })
    assert.equal(reviewed.response.status, 200)

    const beforeDraftCalls = modelRequests.length
    const draft = await json(`/api/workspaces/${workspaceId}/content-briefs/${plan.body.brief.id}/drafts`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        logicalKey: 'custom-profile-snapshot-draft', title: '如何审慎评估企业知识库的可追溯性？', modelProviderConfigurationId: provider.id,
      }),
    })
    assert.equal(draft.response.status, 201, JSON.stringify(draft.body))
    assert.equal(draft.body.draft.draft.writingProfile.snapshot.systemInstruction, customInput.systemInstruction)
    assert.equal(draft.body.draft.draft.writingProfile.snapshot.version, 1)
    const draftSystems = modelRequests.slice(beforeDraftCalls).map((request) => request.messages?.[0]?.content ?? '')
    assert.ok(draftSystems.some((system) => system.includes('CUSTOM_PROFILE_V1')))
    assert.equal(draftSystems.some((system) => system.includes('CUSTOM_PROFILE_V2')), false)

    const editedMarkdown = '# 人工审核后的草稿\n\n仅保留已核验事实，等待内容负责人继续审核。'
    const saved = await json(`/api/workspaces/${workspaceId}/content-drafts/${draft.body.draft.id}`, {
      method: 'PUT', headers: auth(), body: JSON.stringify({ contentMarkdown: editedMarkdown }),
    })
    assert.equal(saved.response.status, 200, JSON.stringify(saved.body))
    const reloadedDraft = await json(`/api/workspaces/${workspaceId}/content-drafts/${draft.body.draft.id}`, { headers: auth() })
    assert.equal(reloadedDraft.response.status, 200)
    assert.equal(reloadedDraft.body.draft.draft.contentMarkdown, editedMarkdown)

    const invalidProfile = await json(`/api/workspaces/${workspaceId}/content-prompt-profiles`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ ...customInput, name: '0', description: '2', systemInstruction: '1' }),
    })
    assert.equal(invalidProfile.response.status, 400)
    assert.match(invalidProfile.body.error, /模板名称无效/)

    const builtinDelete = await json(`/api/workspaces/${workspaceId}/content-prompt-profiles/b2b-explainer-zh-v1`, {
      method: 'DELETE', headers: auth(), body: JSON.stringify({}),
    })
    assert.equal(builtinDelete.response.status, 409)

    const deleted = await json(`/api/workspaces/${workspaceId}/content-prompt-profiles/${profile.id}`, {
      method: 'DELETE', headers: auth(), body: JSON.stringify({}),
    })
    assert.equal(deleted.response.status, 200, JSON.stringify(deleted.body))
    assert.equal(deleted.body.deletedProfileId, profile.id)
    const postDelete = await json(`/api/workspaces/${workspaceId}/content-prompt-profiles`, { headers: auth() })
    assert.equal(postDelete.body.profiles.some((item) => item.id === profile.id), false)

    const historicalBrief = await json(`/api/workspaces/${workspaceId}/content-briefs/${plan.body.brief.id}`, { headers: auth() })
    assert.equal(historicalBrief.response.status, 200)
    assert.equal(historicalBrief.body.brief.brief.writingProfile.snapshot.systemInstruction, customInput.systemInstruction)
    const historicalDraft = await json(`/api/workspaces/${workspaceId}/content-drafts/${draft.body.draft.id}`, { headers: auth() })
    assert.equal(historicalDraft.response.status, 200)
    assert.equal(historicalDraft.body.draft.draft.writingProfile.snapshot.systemInstruction, customInput.systemInstruction)

    const blockedPlan = await json(`/api/workspaces/${workspaceId}/content-opportunities/${diagnosis.id}/ai-plan`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        logicalKey: 'deleted-profile-plan', marketPackId: marketPack.id, targetQueryIds: diagnosis.queryIds,
        channel: marketPack.channels[0], contentType: 'editorial', title: '已删除模板不可用于新生成',
        writingProfileId: profile.id, modelProviderConfigurationId: provider.id,
      }),
    })
    assert.equal(blockedPlan.response.status, 400)
    assert.match(blockedPlan.body.error, /Profile 不存在/)
  })

})






