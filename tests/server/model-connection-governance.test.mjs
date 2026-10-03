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
let modelOrigin
let modelServer
let lastQwenRequest

const json = async (path, options = {}) => {
  const response = await fetch(`${origin}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  })
  return { response, body: await response.json() }
}
const auth = () => ({ 'x-user-id': 'admin-1', 'x-workspace-id': workspaceId })

before(async () => {
  modelServer = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    if (req.url?.includes('/denied/')) {
      res.writeHead(401, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ error: { message: 'invalid key' } }))
    }
    const parsed = JSON.parse(body || '{}')
    const prompt = parsed.messages?.at(-1)?.content || ''
    const optimized = `你是企业级 GEO 研究助手。根据以下产品档案、关键词、意图、市场和语言环境，生成 {{count}} 条自然、可用于真实 AI 平台测试的 B2B 问题。\n产品档案：{{product_profile}}\n关键词：{{keywords}}\n用户意图：{{intents}}\n市场：{{market}}\n语言：{{locale}}`
    if (parsed.model === 'qwen3.7-flash-2026-07-15') {
      lastQwenRequest = parsed
      const content = prompt.includes('仅返回 JSON')
        ? JSON.stringify({ queries: [
          { question: '免费的云端 Markdown 知识库工具有哪些，适合个人长期整理资料？', intent: '品类发现', priority: 'high', rationale: '围绕免费、云端、Markdown 和个人知识管理的核心需求。' },
          { question: '个人知识库如何同时支持 Markdown 编辑、来源追溯和跨设备访问？', intent: '能力评估', priority: 'medium', rationale: '验证目标能力是否能够解决个人用户的实际使用场景。' },
        ] })
        : 'GEO connection is ready.'
      res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': 'qwen-fixture-request' })
      return res.end(JSON.stringify({ model: parsed.model, choices: [{ message: { content } }] }))
    }
    const content = prompt.includes('优化以下核心 Query 生成 Prompt') ? optimized : 'GEO connection is ready.'
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ model: 'fake-model-v1', choices: [{ message: { content } }] }))
  })
  await new Promise((resolve) => modelServer.listen(0, '127.0.0.1', resolve))
  modelOrigin = `http://127.0.0.1:${modelServer.address().port}`

  const dataDir = mkdtempSync(join(tmpdir(), 'geo-model-connection-'))
  application = createApplication({ config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0 } })
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${application.server.address().port}`
  const created = await json('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: 'Connections tenant', brand: 'Example', administrator: { id: 'admin-1', name: '张小明' } }) })
  workspaceId = created.body.workspace.id
})

after(async () => {
  await new Promise((resolve) => application.server.close(resolve))
  await new Promise((resolve) => modelServer.close(resolve))
  const dataDir = application.config.dataDir
  application.database.close()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('model connection governance API', () => {
  it('accepts a Query-generation model, persists safe test state, and gates execution on verification', async () => {
    const incomplete = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ providerId: '企业模型网关', market: 'CN', locale: 'zh-CN', collectionMode: 'enterprise-gateway' }),
    })
    assert.equal(incomplete.response.status, 400)
    assert.match(incomplete.body.error, /Base URL|模型名称/)

    const configured = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ providerId: '企业模型网关', market: 'CN', locale: 'zh-CN', collectionMode: 'enterprise-gateway', baseUrl: `${modelOrigin}/v1`, modelName: 'fake-model-v1', useForQueryGeneration: true }),
    })
    assert.equal(configured.response.status, 201)
    assert.equal(configured.body.provider.providerId, '企业模型网关')
    assert.equal(configured.body.provider.test.status, 'unverified')

    const beforeCredential = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, { headers: auth() })
    assert.equal(beforeCredential.body.providers.length, 1)
    assert.equal(beforeCredential.body.providers[0].id, configured.body.provider.id)
    assert.equal(beforeCredential.body.providers[0].executable, false)
    assert.equal(JSON.stringify(beforeCredential.body).includes('sk-governance-test-1234'), false)

    const credential = await json(`/api/workspaces/${workspaceId}/model-providers/${configured.body.provider.id}/credential`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ apiKey: 'sk-governance-test-1234' }),
    })
    assert.equal(credential.response.status, 201)
    assert.equal(credential.body.provider.credential.lastFour, '1234')
    assert.equal(JSON.stringify(credential.body).includes('sk-governance-test-1234'), false)

    const verified = await json(`/api/workspaces/${workspaceId}/model-providers/${configured.body.provider.id}/test`, { method: 'POST', headers: auth() })
    assert.equal(verified.response.status, 200)
    assert.equal(verified.body.ok, true)
    assert.equal(verified.body.test.status, 'verified')
    assert.equal(verified.body.test.model, 'fake-model-v1')
    assert.equal(typeof verified.body.test.latencyMs, 'number')

    const afterVerification = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, { headers: auth() })
    assert.equal(afterVerification.body.providers.length, 1)
    assert.equal(afterVerification.body.providers[0].id, configured.body.provider.id)
    assert.equal(afterVerification.body.providers[0].executable, true)

    const contentProviders = await json(`/api/workspaces/${workspaceId}/model-providers`, { headers: auth() })
    const contentModel = contentProviders.body.providers.find((provider) => provider.id === configured.body.provider.id)
    assert.equal(contentModel.executable, true)
    assert.equal(contentModel.credential.configured, true)
    assert.equal(JSON.stringify(contentModel).includes('sk-governance-test-1234'), false)
  })

  it('keeps only the newest explicit Query-generation model active while retaining other configurations', async () => {
    const replacement = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ providerId: '替换模型', market: 'GLOBAL', locale: 'en-US', collectionMode: 'official-api', baseUrl: `${modelOrigin}/v1`, modelName: 'replacement-model', useForQueryGeneration: true }),
    })
    assert.equal(replacement.response.status, 201)
    const all = await json(`/api/workspaces/${workspaceId}/model-providers`, { headers: auth() })
    const original = all.body.providers.find((provider) => provider.providerId === '企业模型网关')
    assert.equal(original.status, 'configured')
    assert.equal(replacement.body.provider.status, 'configured')

    const settings = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, { headers: auth() })
    assert.equal(settings.body.providers.length, 1)
    assert.equal(settings.body.providers[0].id, replacement.body.provider.id)
    assert.equal(settings.body.providers[0].executable, false)
  })

  it('uses the generation-specific request policy for a verified Qwen model and persists real keyword-based Queries', async () => {
    const created = await json(`/api/workspaces/${workspaceId}/brand-diagnostics`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        name: 'Qwen Query 生成验收', brandName: 'FreeNote', website: 'https://freenote.example/',
        markets: ['中国'], locales: ['zh-CN'], audiences: ['个人知识工作者'], objective: '验证围绕关键词生成可审核的真实 Query。', ownerId: 'admin-1',
      }),
    })
    assert.equal(created.response.status, 201)
    const caseId = created.body.project.project.id

    const configured = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        providerId: '通义千问', market: 'CN', locale: 'zh-CN', collectionMode: 'official-api',
        baseUrl: `${modelOrigin}/v1`, modelName: 'qwen3.7-flash-2026-07-15', useForQueryGeneration: true,
      }),
    })
    assert.equal(configured.response.status, 201)
    const credential = await json(`/api/workspaces/${workspaceId}/model-providers/${configured.body.provider.id}/credential`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ apiKey: 'sk-qwen-generation-test-1234' }),
    })
    assert.equal(credential.response.status, 201)
    const verified = await json(`/api/workspaces/${workspaceId}/model-providers/${configured.body.provider.id}/test`, { method: 'POST', headers: auth() })
    assert.equal(verified.response.status, 200)
    assert.equal(lastQwenRequest.stream, false)
    assert.equal(lastQwenRequest.enable_thinking, false)
    assert.equal(lastQwenRequest.max_tokens, 64)

    const settings = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, { headers: auth() })
    const generated = await json(`/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/baseline-query-sets/generate`, {
      method: 'POST', headers: auth(), body: JSON.stringify({
        marketPack: 'CN', count: 2, generator: 'llm',
        keywords: ['知识库', '免费', '云端', 'md 编辑器', '个人向'], intents: ['品类发现', '能力评估'],
        providerConfigurationId: configured.body.provider.id, promptId: settings.body.prompt.id,
      }),
    })
    assert.equal(generated.response.status, 201)
    assert.equal(generated.body.querySet.generationMode, 'llm-assisted')
    assert.equal(generated.body.querySet.queries.length, 2)
    assert.match(generated.body.querySet.queries[0].question, /免费.*云端.*Markdown/)
    assert.equal(generated.body.generation.timeoutMs, 120000)
    assert.equal(generated.body.generation.providerRequestId, 'qwen-fixture-request')
    assert.equal(lastQwenRequest.stream, false)
    assert.equal(lastQwenRequest.enable_thinking, false)
    assert.equal(lastQwenRequest.max_tokens, 2048)
    assert.match(lastQwenRequest.messages.at(-1).content, /知识库、免费、云端、md 编辑器、个人向/)
    assert.equal(JSON.stringify(generated.body).includes('sk-qwen-generation-test-1234'), false)
  })

  it('keeps prompt validation and failed connection diagnostics recoverable without leaking keys', async () => {
    const restored = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ providerId: '企业模型网关', market: 'CN', locale: 'zh-CN', collectionMode: 'enterprise-gateway', baseUrl: `${modelOrigin}/v1`, modelName: 'fake-model-v1', useForQueryGeneration: true }),
    })
    assert.equal(restored.response.status, 201)
    const reverified = await json(`/api/workspaces/${workspaceId}/model-providers/${restored.body.provider.id}/test`, { method: 'POST', headers: auth() })
    assert.equal(reverified.response.status, 200)
    const settings = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, { headers: auth() })
    const connection = settings.body.providers[0]
    assert.equal(connection.id, restored.body.provider.id)

    const invalidPrompt = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, {
      method: 'PUT', headers: auth(), body: JSON.stringify({ template: '请根据企业产品资料、行业背景、目标用户、采购场景与产品能力生成一组自然、可用于真实 AI 平台测试的高质量研究问题，覆盖品类发现、方案比较、采购评估、实施风险、可信来源、可追溯性和决策影响等维度，问题数量为 {{count}}。' }),
    })
    assert.equal(invalidPrompt.response.status, 400)
    assert.match(invalidPrompt.body.error, /变量/)

    const versionBeforePreview = settings.body.prompt.version
    const preview = await json(`/api/workspaces/${workspaceId}/query-generation-settings/optimize`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ providerConfigurationId: connection.id, goal: '让问题更加符合企业知识库采购研究语境。', template: settings.body.prompt.template }),
    })
    assert.equal(preview.response.status, 200)
    assert.match(preview.body.suggestion, /{{product_profile}}/)
    assert.match(preview.body.suggestion, /{{count}}/)
    assert.equal(JSON.stringify(preview.body).includes('sk-governance-test-1234'), false)

    const afterPreview = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, { headers: auth() })
    assert.equal(afterPreview.body.prompt.version, versionBeforePreview)

    const savedPrompt = await json(`/api/workspaces/${workspaceId}/query-generation-settings`, {
      method: 'PUT', headers: auth(), body: JSON.stringify({ name: '采购研究 Query Prompt', template: preview.body.suggestion }),
    })
    assert.equal(savedPrompt.response.status, 200)
    assert.equal(savedPrompt.body.prompt.version, versionBeforePreview + 1)
    const history = await json(`/api/workspaces/${workspaceId}/query-generation-settings/prompts`, { headers: auth() })
    assert.equal(history.response.status, 200)
    assert.equal(history.body.prompts[0].id, savedPrompt.body.prompt.id)
    assert.ok(history.body.prompts.some((item) => item.id === afterPreview.body.prompt.id))
    const restoredPrompt = await json(`/api/workspaces/${workspaceId}/query-generation-settings/prompts/${afterPreview.body.prompt.id}/restore`, { method: 'POST', headers: auth() })
    assert.equal(restoredPrompt.response.status, 200)
    assert.equal(restoredPrompt.body.prompt.version, versionBeforePreview + 2)
    assert.equal(restoredPrompt.body.prompt.template, afterPreview.body.prompt.template)

    const failedConfig = await json(`/api/workspaces/${workspaceId}/model-providers`, {
      method: 'POST', headers: auth(), body: JSON.stringify({ providerId: '企业模型网关', market: 'CN', locale: 'zh-CN', collectionMode: 'enterprise-gateway', baseUrl: `${modelOrigin}/denied`, modelName: 'fake-model-v1', useForQueryGeneration: true }),
    })
    assert.equal(failedConfig.response.status, 201)
    assert.equal(failedConfig.body.provider.test.status, 'unverified')
    const failed = await json(`/api/workspaces/${workspaceId}/model-providers/${failedConfig.body.provider.id}/test`, { method: 'POST', headers: auth() })
    assert.equal(failed.response.status, 502)
    assert.equal(failed.body.test.status, 'failed')
    assert.match(failed.body.error, /认证失败（HTTP 401）/)
    assert.match(failed.body.error, /项目权限和模型可用范围/)
    assert.equal(JSON.stringify(failed.body).includes('sk-governance-test-1234'), false)
  })
})

