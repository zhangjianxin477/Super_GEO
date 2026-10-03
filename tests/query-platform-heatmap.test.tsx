// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { RealSurfaceTestRun } from '../src/api'
import { QueryPlatformHeatmap } from '../src/QueryPlatformHeatmap'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function buildRun(queryCount = 11): RealSurfaceTestRun {
  return {
    id: 'matrix-run', workspaceId: 'workspace-1', caseId: 'case-1', querySetId: 'set-1', name: '中国 · 首轮基线', marketPack: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual', executionMode: 'browser-agent', state: 'ready_for_review', instructions: '', createdAt: '2026-09-29T01:00:00.000Z', createdBy: 'admin-1', updatedAt: '2026-09-29T01:10:00.000Z', updatedBy: 'admin-1', progress: { total: queryCount, byState: {}, state: 'ready_for_review' },
    tasks: Array.from({ length: queryCount }, (_, index) => ({
      id: `task-${index + 1}`, workspaceId: 'workspace-1', testRunId: 'matrix-run', seedQueryId: `query-${index + 1}`, platform: '豆包', providerFamily: 'doubao', state: 'reviewed', executionMode: 'browser-agent', agentState: 'captured', attemptNumber: 1,
      question: `核心 Query ${index + 1}`, intent: '品类发现', rationale: '',
      observation: { id: `obs-${index + 1}`, rawAnswer: `回答提及示例品牌 ${index + 1}`, citations: [], freshSession: true, searchEnabled: true, platformLabel: '豆包', observedAt: '2026-09-29T01:00:00.000Z', submittedBy: 'agent', submittedAt: '2026-09-29T01:00:01.000Z', collectionMethod: 'browser-agent' },
    })),
  } as RealSurfaceTestRun
}

async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }

describe('QueryPlatformHeatmap', () => {
  let container: HTMLDivElement
  let root: Root

  afterEach(async () => {
    if (root) await act(async () => { root.unmount() })
    container?.remove()
  })

  it('shows ten core Queries per page, preserves evidence labels, and exposes a selected-cell explanation', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => { root.render(<QueryPlatformHeatmap run={buildRun()} brandName="示例品牌" ownWebsite="https://example.test" />) })
    await settle()

    expect(container.textContent).toContain('Q10')
    expect(container.textContent).not.toContain('Q11')
    expect(container.textContent).toContain('1/2')
    const firstCell = container.querySelector<HTMLButtonElement>('.heatmap-cell')
    expect(firstCell?.textContent).toContain('提及本品牌')
    await act(async () => { firstCell?.click() })
    expect(container.textContent).toContain('1/1 已审核')

    const next = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('下一页'))
    await act(async () => { next?.click() })
    expect(container.textContent).toContain('Q11')
    expect(container.textContent).toContain('2/2')
  })
})
