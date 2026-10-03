// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RealSurfaceTestRun } from '../src/api'

const api = vi.hoisted(() => ({
  getActiveRealSurfaceTestRun: vi.fn(),
  listBrandDiagnostics: vi.fn(),
  listRealSurfaceTestRuns: vi.fn(),
}))
vi.mock('../src/api', async () => {
  const actual = await vi.importActual<typeof import('../src/api')>('../src/api')
  return { ...actual, ...api }
})
vi.mock('../src/BrandDiagnostics', () => ({ getWorkspaceSession: vi.fn() }))

import { getWorkspaceSession } from '../src/BrandDiagnostics'
import { VisibilityBaseline } from '../src/VisibilityBaseline'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const project = { id: 'case-1', name: '知识库', brandName: '示例品牌', website: 'https://example.test', markets: ['中国'], locales: ['zh-CN'], audiences: ['企业知识库负责人'], objective: '建立基线', ownerId: 'admin-1', status: 'active', updatedAt: '2026-09-29T01:00:00.000Z', factSummary: { approved: 1, candidates: 0 }, blockers: [], queryScope: null, collectionPlan: null, baseline: null, coverage: { expected: 1, imported: 0, rate: 0, status: 'pending' }, nextAction: { label: '继续', tab: 'testing' } }

function run(state: RealSurfaceTestRun['state'], active = false): RealSurfaceTestRun {
  return {
    id: 'run-1', workspaceId: 'workspace-1', caseId: 'case-1', querySetId: 'set-1', name: '中国 T0', marketPack: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual', executionMode: active ? 'browser-agent' : 'controlled-manual', state, instructions: '', createdAt: '2026-09-29T01:00:00.000Z', createdBy: 'admin-1', updatedAt: '2026-09-29T01:00:00.000Z', updatedBy: 'admin-1', progress: { total: 1, byState: {}, state },
    tasks: [{ id: 'task-1', workspaceId: 'workspace-1', testRunId: 'run-1', seedQueryId: 'query-1', platform: '豆包', providerFamily: 'doubao', state: active ? 'claimed' : 'reviewed', executionMode: active ? 'browser-agent' : 'controlled-manual', agentState: active ? 'running' : 'manual', attemptNumber: 1, question: '核心 Query', intent: '品类发现', rationale: '', observation: active ? null : { id: 'obs-1', rawAnswer: '回答提及示例品牌', citations: [], freshSession: true, searchEnabled: true, platformLabel: '豆包', observedAt: '2026-09-29T01:00:00.000Z', submittedBy: 'analyst', submittedAt: '2026-09-29T01:00:01.000Z', collectionMethod: 'controlled-manual' } }],
  }
}

function returnedCurrentRun(): RealSurfaceTestRun {
  const current = run('ready_for_review')
  current.id = 'current-run'
  current.name = '本轮 02 当前测试'
  current.updatedAt = '2026-09-30T13:25:03.729Z'
  current.progress = { total: 1, byState: { submitted: 1 }, state: 'ready_for_review' }
  current.tasks = current.tasks.map((task) => ({
    ...task,
    testRunId: current.id,
    state: 'submitted',
    agentState: 'captured',
    observation: {
      id: 'current-observation', rawAnswer: '页面已回传，但仍等待证据审核。', citations: ['https://example.test/source'], freshSession: true, searchEnabled: true,
      platformLabel: '豆包', observedAt: current.updatedAt, submittedBy: 'agent-1', submittedAt: current.updatedAt, collectionMethod: 'browser-agent',
    },
  }))
  return current
}

async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }) }

describe('VisibilityBaseline current real-platform source', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(getWorkspaceSession).mockResolvedValue({ workspaceId: 'workspace-1', userId: 'admin-1', userName: '管理员' })
    api.listBrandDiagnostics.mockResolvedValue({ projects: [project] })
    api.getActiveRealSurfaceTestRun.mockResolvedValue({ testRun: null })
    api.listRealSurfaceTestRuns.mockResolvedValue({ testRuns: [] })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
    vi.useRealTimers()
  })

  it('keeps a completed baseline stable instead of polling or flashing every five seconds', async () => {
    const completed = run('baseline_ready')
    api.getActiveRealSurfaceTestRun.mockResolvedValue({ testRun: completed })
    api.listRealSurfaceTestRuns.mockResolvedValue({ testRuns: [completed] })
    await act(async () => { root.render(<VisibilityBaseline go={vi.fn()} />) })
    await settle()

    expect(container.textContent).toContain('基线数据已稳定')
    expect(container.textContent).toContain('单平台结果与全部平台汇总')
    expect(container.textContent).toContain('市场支持平台')
    expect(container.textContent).toContain('DeepSeek')
    expect(container.textContent).toContain('未纳入当前批次')
    expect(container.textContent).toContain('当前纳入测试')
    expect(api.getActiveRealSurfaceTestRun).toHaveBeenCalledTimes(1)
    expect(api.listRealSurfaceTestRuns).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    await settle()
    expect(api.getActiveRealSurfaceTestRun).toHaveBeenCalledTimes(1)
    expect(api.listRealSurfaceTestRuns).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain('正在连接核心 Query 与首轮真实平台数据')
  })

  it('silently checks for new evidence every five seconds only during an active Browser Agent batch', async () => {
    const collecting = run('collecting', true)
    api.getActiveRealSurfaceTestRun.mockResolvedValue({ testRun: collecting })
    api.listRealSurfaceTestRuns.mockResolvedValue({ testRuns: [collecting] })
    await act(async () => { root.render(<VisibilityBaseline go={vi.fn()} />) })
    await settle()

    expect(container.textContent).toContain('采集中 · 静默同步')
    expect(api.getActiveRealSurfaceTestRun).toHaveBeenCalledTimes(1)
    expect(api.listRealSurfaceTestRuns).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    await settle()
    expect(api.getActiveRealSurfaceTestRun).toHaveBeenCalledTimes(2)
    expect(api.listRealSurfaceTestRuns).toHaveBeenCalledTimes(2)
    expect(container.textContent).not.toContain('正在连接核心 Query 与首轮真实平台数据')
  })

  it('uses the explicit 02 current batch rather than an older reviewed history record', async () => {
    const olderReviewed = run('baseline_ready')
    olderReviewed.id = 'old-reviewed-run'
    olderReviewed.name = '旧豆包基线（不可作为当前诊断）'
    olderReviewed.tasks = olderReviewed.tasks.map((task) => ({ ...task, testRunId: olderReviewed.id }))
    const current = returnedCurrentRun()
    api.getActiveRealSurfaceTestRun.mockResolvedValue({ testRun: current })
    api.listRealSurfaceTestRuns.mockResolvedValue({ testRuns: [olderReviewed, current] })

    await act(async () => { root.render(<VisibilityBaseline go={vi.fn()} />) })
    await settle()

    expect(container.textContent).toContain('单平台结果与全部平台汇总')
    expect(container.textContent).toContain('当前纳入测试')
    expect(container.textContent).toContain('平台覆盖')
    expect(container.textContent).not.toContain('当前基线批次')
    expect(container.textContent).not.toContain('旧豆包基线（不可作为当前诊断）')
    const formalMetricValues = [...container.querySelectorAll('.visibility-kpi strong')].map((node) => node.textContent)
    expect(formalMetricValues).not.toContain('0%')
    expect(formalMetricValues).toContain('—')
  })
})
