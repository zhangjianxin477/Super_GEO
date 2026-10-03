// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  configureModelProvider: vi.fn(),
  getQueryGenerationSettings: vi.fn(),
  storeModelProviderCredential: vi.fn(),
  testModelProviderConnection: vi.fn(),
}))

vi.mock('../src/api', async () => {
  const actual = await vi.importActual<typeof import('../src/api')>('../src/api')
  return { ...actual, ...api }
})
vi.mock('../src/BrandDiagnostics', () => ({ getWorkspaceSession: vi.fn() }))

import { getWorkspaceSession } from '../src/BrandDiagnostics'
import { ModelConnections } from '../src/ModelConnections'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = { workspaceId: 'workspace-1', userId: 'admin-1', userName: '管理员' }
const prompt = { id: 'prompt-1', workspaceId: 'workspace-1', name: '核心 Query 生成 Prompt', template: 'unused', version: 3, status: 'active' as const, createdAt: '2026-09-28T00:00:00.000Z', createdBy: 'admin-1', updatedAt: '2026-09-28T00:00:00.000Z', updatedBy: 'admin-1' }
const verifiedProvider = {
  id: 'provider-verified', providerId: '通义千问（百炼）', market: 'CN' as const, locale: 'zh-CN', collectionMode: 'official-api' as const,
  status: 'configured' as const, version: 2, executable: true,
  execution: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelName: 'qwen-plus', updatedAt: '2026-09-28T00:00:00.000Z', updatedBy: 'admin-1' },
  credential: { configured: true, encryptionVersion: '1', lastFour: '1234', createdAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T00:00:00.000Z' },
  test: { status: 'verified' as const, testedAt: '2026-09-28T00:00:00.000Z', model: 'qwen-plus', latencyMs: 218, message: '连接验证成功。' },
}
const failedProvider = { ...verifiedProvider, test: { status: 'failed' as const, testedAt: '2026-09-28T00:00:00.000Z', model: null, latencyMs: null, message: '认证失败（HTTP 401）：API Key 无效、无权限，或尚未开通该模型。请检查密钥、项目权限和模型可用范围后重试。' } }

async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }) }
function buttonByText(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  return button as HTMLButtonElement
}

describe('single Query model settings experience', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWorkspaceSession).mockResolvedValue(session)
    api.getQueryGenerationSettings.mockResolvedValue({ prompt, providers: [verifiedProvider] })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => { await act(async () => { root.unmount() }); container.remove() })

  it('shows a compact verified connection instead of repeating configuration fields', async () => {
    await act(async () => { root.render(<ModelConnections />) })
    await settle()

    expect(container.textContent).toContain('AI 生成连接')
    expect(container.textContent).toContain('当前 AI 生成模型')
    expect(container.textContent).toContain('通义千问（百炼） · qwen-plus')
    expect(container.textContent).toContain('已验证')
    expect(container.textContent).toContain('核心 Query 生成')
    expect(buttonByText(container, '重新验证')).toBeTruthy()
    expect(buttonByText(container, '编辑连接')).toBeTruthy()
    expect(container.textContent).not.toContain('API Base URL')
    expect(container.textContent).not.toContain('返回核心 Query')
    expect(container.textContent).not.toContain('AI 优化 Prompt')
    expect(container.querySelectorAll('.provider-card')).toHaveLength(0)
    expect(container.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('places a recoverable diagnostic next to the failed connection state', async () => {
    api.getQueryGenerationSettings.mockResolvedValue({ prompt, providers: [failedProvider] })
    await act(async () => { root.render(<ModelConnections />) })
    await settle()

    expect(container.textContent).toContain('测试未通过')
    expect(container.textContent).toContain('为什么测试失败？')
    expect(container.textContent).toContain('HTTP 401')
    expect(container.textContent).toContain('检查密钥、项目权限和模型可用范围')
    expect(container.textContent).toContain('修正配置后，点击“保存并测试连接”即可重新验证。')
  })

  it('retests the existing connection without exposing its configuration', async () => {
    api.testModelProviderConnection.mockResolvedValue({ ok: true, model: 'qwen-plus', elapsedMs: 201, test: verifiedProvider.test })
    await act(async () => { root.render(<ModelConnections />) })
    await settle()

    await act(async () => { buttonByText(container, '重新验证').click(); await Promise.resolve() })
    await settle()

    expect(api.testModelProviderConnection).toHaveBeenCalledWith(session, 'provider-verified')
    expect(container.textContent).toContain('当前 AI 生成模型')
    expect(container.textContent).not.toContain('API Base URL')
  })

  it('opens configuration only when an operator chooses to edit the connection', async () => {
    api.configureModelProvider.mockResolvedValue({ provider: { ...verifiedProvider, test: { status: 'unverified' } } })
    api.testModelProviderConnection.mockResolvedValue({ ok: true, model: 'qwen-plus', elapsedMs: 201, test: verifiedProvider.test })
    await act(async () => { root.render(<ModelConnections />) })
    await settle()

    await act(async () => { buttonByText(container, '编辑连接').click() })
    expect(container.textContent).toContain('API Base URL')
    await act(async () => { buttonByText(container, '保存并重新验证').click() })
    await settle()

    expect(api.configureModelProvider).toHaveBeenCalledWith(session, expect.objectContaining({ providerId: '通义千问（百炼）', modelName: 'qwen-plus' }))
    expect(api.testModelProviderConnection).toHaveBeenCalledWith(session, 'provider-verified')
    expect(container.textContent).toContain('当前 AI 生成模型')
    expect(container.textContent).toContain('已验证')
  })
})
