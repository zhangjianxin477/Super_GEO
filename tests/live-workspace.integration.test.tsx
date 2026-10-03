// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLiveWorkspace } from '../src/useLiveWorkspace'
import type { Dashboard, WorkspaceSession } from '../src/api'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const api = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  getDiagnosticSetup: vi.fn(),
  listMarketPacks: vi.fn(),
  getDashboard: vi.fn(),
  listResources: vi.fn(),
}))

vi.mock('../src/api', async () => {
  const actual = await vi.importActual<typeof import('../src/api')>('../src/api')
  return { ...actual, ...api }
})

const session: WorkspaceSession = { workspaceId: 'workspace-1', userId: 'admin-1' }
const resources = [{ datasets: [] }, { briefs: [] }, { drafts: [] }, { tasks: [] }, { reports: [] }]

function fixtureDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    workspace: { id: 'workspace-1', name: '示例工作区', brand: 'Northstar KB' },
    marketPack: { id: 'market-cn', label: '中国市场 / 中文', market: 'CN', locale: 'zh-CN', providers: ['DeepSeek'], channels: ['官网内容中心'], competitors: ['Notion'], audience: '企业团队', status: 'approved' },
    context: { selectedRun: { id: 'run-1', label: '基线运行', status: 'completed', createdAt: '2026-09-27T00:00:00.000Z', isComplete: false, datasetId: 'dataset-1', datasetVersion: 1, marketPackId: 'market-cn', locale: 'zh-CN', providers: ['DeepSeek'], cohortQueryIds: ['query-1'], completion: { planned: 1, queued: 1, collecting: 0, completed: 0, imported: 0, failed: 0, resolved: 0, isComplete: false, incompleteReason: '仍有待导入回答。' } }, baselineRun: null, availableRuns: [], dataset: { id: 'dataset-1', label: '查询队列', logicalKey: 'cn', version: 1, status: 'approved', queries: [] } },
    measurement: null,
    completeness: { isComplete: false, providerCoverage: [{ providerId: 'DeepSeek', expected: 1, observed: 0, byStatus: { queued: 1 } }] },
    comparison: { comparable: false, reason: '基线与当前评估不可比较。' },
    diagnoses: [], actions: [], evidence: { observationCount: 0, observations: [] }, competitorResearch: [], reports: [],
    workflowReadiness: { stage: 'collection', nextAllowedOperation: '导入人工回答', blockingReasons: ['仍有待导入回答。'], ready: false },
    limitations: ['当前 MVP 仅支持受控人工导入。'], collectionBoundary: 'Controlled-manual only.',
    ...overrides,
  } as Dashboard
}

function Probe({ activeSession }: { activeSession: WorkspaceSession | null }) {
  const { state, reload } = useLiveWorkspace(activeSession)
  return <><button type="button" onClick={() => void reload()}>刷新</button><output data-testid="live-workspace-state">{JSON.stringify(state)}</output></>
}

async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

describe('live workspace hook integration', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    api.getDiagnosticSetup.mockResolvedValue({ setup: null })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  it('shows loading first, then retains incomplete and non-comparable dashboard context', async () => {
    let resolveWorkspace: (value: { workspace: { id: string; name: string; brand: string } }) => void = () => undefined
    api.getWorkspace.mockImplementation(() => new Promise((resolve) => { resolveWorkspace = resolve }))
    api.listMarketPacks.mockResolvedValue({ marketPacks: [fixtureDashboard().marketPack] })
    api.listResources.mockResolvedValue(resources)
    api.getDashboard.mockResolvedValue({ dashboard: fixtureDashboard() })

    await act(async () => { root.render(<Probe activeSession={session} />) })
    expect(container.textContent).toContain('"phase":"loading"')

    resolveWorkspace({ workspace: { id: 'workspace-1', name: '示例工作区', brand: 'Northstar KB' } })
    await settle()
    expect(container.textContent).toContain('"phase":"ready"')
    expect(container.textContent).toContain('仍有待导入回答。')
    expect(container.textContent).toContain('基线与当前评估不可比较。')
  })

  it('keeps a ready workspace mounted while refresh data is loading', async () => {
    api.getWorkspace.mockResolvedValue({ workspace: { id: 'workspace-1', name: '示例工作区', brand: 'Northstar KB' } })
    api.listMarketPacks.mockResolvedValue({ marketPacks: [fixtureDashboard().marketPack] })
    api.listResources.mockResolvedValue(resources)
    api.getDashboard.mockResolvedValue({ dashboard: fixtureDashboard() })

    await act(async () => { root.render(<Probe activeSession={session} />) })
    await settle()
    expect(container.textContent).toContain('"phase":"ready"')

    let resolveRefresh: (value: { workspace: { id: string; name: string; brand: string } }) => void = () => undefined
    api.getWorkspace.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve }))
    const refreshButton = container.querySelector('button')
    await act(async () => { refreshButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(container.textContent).toContain('"phase":"ready"')
    expect(container.textContent).toContain('"isRefreshing":true')

    resolveRefresh({ workspace: { id: 'workspace-1', name: '示例工作区', brand: 'Northstar KB' } })
    await settle()
    expect(container.textContent).toContain('"phase":"ready"')
    expect(container.textContent).toContain('"isRefreshing":false')
  })

  it('routes a reviewable diagnostic project to setup rather than a dashboard', async () => {
    api.getWorkspace.mockResolvedValue({ workspace: { id: 'workspace-1', name: '诊断工作区', brand: 'Northstar KB' } })
    api.getDiagnosticSetup.mockResolvedValue({ setup: { workspace: { id: 'workspace-1', name: '诊断工作区', brand: 'Northstar KB' }, project: { id: 'project-1', brandName: 'Northstar KB', status: 'ready-for-review' }, evidencePack: { id: 'evidence-1', status: 'draft', items: [] }, marketPacks: [], datasets: [], collectionPlans: [], nextStep: '审核后创建采集任务。', limitations: ['没有模型回答。'], collectionBoundary: 'Controlled-manual only.' } })

    await act(async () => { root.render(<Probe activeSession={session} />) })
    await settle()
    expect(container.textContent).toContain('"phase":"setup"')
    expect(container.textContent).toContain('审核后创建采集任务。')
    expect(api.getDashboard).not.toHaveBeenCalled()
  })

  it('renders an explicit empty state when the workspace has no market packs', async () => {
    api.getWorkspace.mockResolvedValue({ workspace: { id: 'workspace-1', name: '空工作区', brand: 'Northstar KB' } })
    api.listMarketPacks.mockResolvedValue({ marketPacks: [] })
    api.listResources.mockResolvedValue(resources)

    await act(async () => { root.render(<Probe activeSession={session} />) })
    await settle()
    expect(container.textContent).toContain('"phase":"empty"')
    expect(container.textContent).not.toContain('dashboard')
  })

  it('keeps API failures explicit without fixture dashboard data', async () => {
    api.getWorkspace.mockRejectedValue(new Error('offline'))
    api.listMarketPacks.mockResolvedValue({ marketPacks: [] })
    api.listResources.mockResolvedValue(resources)

    await act(async () => { root.render(<Probe activeSession={session} />) })
    await settle()
    expect(container.textContent).toContain('"phase":"error"')
    expect(container.textContent).toContain('加载工作区失败，请稍后重试。')
    expect(container.textContent).not.toContain('Northstar KB')
  })
})