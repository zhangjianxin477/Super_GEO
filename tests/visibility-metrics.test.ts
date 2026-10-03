import { describe, expect, it } from 'vitest'
import type { RealSurfaceTestRun } from '../src/api'
import { buildPlatformMentionTrend, buildPlatformOwnedCitationTrend, buildQueryPlatformHeatmap, buildVisibilityBaselineMetrics, platformSourceStatusLabel } from '../src/visibilityMetrics'

const run = {
  id: 'run-t0', workspaceId: 'workspace-1', caseId: 'case-1', querySetId: 'set-1', name: '中国 · 首轮基线', marketPack: 'CN', locale: 'zh-CN', collectionMode: 'controlled-manual', executionMode: 'browser-agent', state: 'ready_for_review', instructions: '', createdAt: '2026-09-29T01:00:00.000Z', createdBy: 'admin-1', updatedAt: '2026-09-29T01:10:00.000Z', updatedBy: 'admin-1', progress: { total: 4, byState: {}, state: 'ready_for_review' },
  tasks: [
    { id: 'task-1', workspaceId: 'workspace-1', testRunId: 'run-t0', seedQueryId: 'query-1', platform: '豆包', providerFamily: 'doubao', state: 'reviewed', executionMode: 'browser-agent', agentState: 'captured', attemptNumber: 1, question: '有哪些工具支持可追溯回答？', intent: '品类发现', rationale: '', observation: { id: 'obs-1', rawAnswer: '推荐 CoreNote，适合需要来源可追溯的团队。', citations: ['https://corenote.cloud/knowledge-base.html'], freshSession: true, searchEnabled: true, platformLabel: '豆包', observedAt: '2026-09-29T01:01:00.000Z', submittedBy: 'agent', submittedAt: '2026-09-29T01:01:01.000Z', collectionMethod: 'browser-agent', captureMetadata: { visibleLinks: [{ url: 'https://corenote.cloud/knowledge-base.html', sourceType: 'platform-search-result' }] } } },
    { id: 'task-2', workspaceId: 'workspace-1', testRunId: 'run-t0', seedQueryId: 'query-1', platform: 'Kimi', providerFamily: 'kimi', state: 'reviewed', executionMode: 'controlled-manual', agentState: 'manual', attemptNumber: 1, question: '有哪些工具支持可追溯回答？', intent: '品类发现', rationale: '', observation: { id: 'obs-2', rawAnswer: '可以比较多种企业知识库工具。', citations: [], freshSession: true, searchEnabled: false, platformLabel: 'Kimi', observedAt: '2026-09-29T01:02:00.000Z', submittedBy: 'analyst', submittedAt: '2026-09-29T01:02:01.000Z', collectionMethod: 'controlled-manual' } },
    { id: 'task-3', workspaceId: 'workspace-1', testRunId: 'run-t0', seedQueryId: 'query-2', platform: '豆包', providerFamily: 'doubao', state: 'submitted', executionMode: 'browser-agent', agentState: 'captured', attemptNumber: 1, question: '企业知识库如何保留来源？', intent: '问题解决', rationale: '', observation: { id: 'obs-3', rawAnswer: 'CoreNote 有引用能力。', citations: [], freshSession: true, searchEnabled: true, platformLabel: '豆包', observedAt: '2026-09-29T01:03:00.000Z', submittedBy: 'agent', submittedAt: '2026-09-29T01:03:01.000Z', collectionMethod: 'browser-agent' } },
    { id: 'task-4', workspaceId: 'workspace-1', testRunId: 'run-t0', seedQueryId: 'query-2', platform: 'Kimi', providerFamily: 'kimi', state: 'failed', executionMode: 'controlled-manual', agentState: 'failed', failureReason: '页面超时', attemptNumber: 2, question: '企业知识库如何保留来源？', intent: '问题解决', rationale: '', observation: null },
  ],
} as RealSurfaceTestRun

describe('visibility baseline metrics', () => {
  it('uses only reviewed real-surface evidence for formal T0 rates', () => {
    const metrics = buildVisibilityBaselineMetrics(run, 'CoreNote', 'https://corenote.cloud/')

    expect(metrics.expected).toBe(4)
    expect(metrics.reviewed).toBe(2)
    expect(metrics.completeness.rate).toBe(0.5)
    expect(metrics.mention).toMatchObject({ numerator: 1, denominator: 2, rate: 0.5 })
    expect(metrics.recommendation).toMatchObject({ numerator: 1, denominator: 2, rate: 0.5 })
    expect(metrics.ownedCitation).toMatchObject({ numerator: 1, denominator: 2, rate: 0.5 })
    expect(metrics.platformSource).toMatchObject({ numerator: 1, denominator: 1, rate: 1, status: 'available' })
    expect(metrics.collectionMethods).toEqual({ browserAgent: 1, controlledManual: 1 })
    expect(metrics.observed).toBe(3)
    expect(metrics.scopedPlatformCount).toBe(2)
    expect(metrics.marketPlatforms.map((platform) => platform.platform)).toEqual(['DeepSeek', '通义千问', '豆包', 'Kimi', '元宝', '智谱清言（GLM）', '文心一言'])
    expect(metrics.marketPlatforms.find((platform) => platform.platform === 'DeepSeek')).toMatchObject({ inCurrentRun: false, observed: 0, mention: { rate: null }, ownedCitation: { rate: null } })
    expect(metrics.marketPlatforms.find((platform) => platform.platform === '豆包')).toMatchObject({ inCurrentRun: true, observed: 2, ownedCitationLinks: 1 })
    expect(metrics.platforms.find((platform) => platform.platform === 'Kimi')?.platformSource.status).toBe('not-applicable')
  })

  it('does not convert missing captured search links into a zero citation rate', () => {
    const metrics = buildVisibilityBaselineMetrics(run, 'CoreNote', 'https://corenote.cloud/')
    const q2 = metrics.queries.find((query) => query.queryId === 'query-2')

    expect(q2?.reviewed).toBe(0)
    expect(q2?.platformSource.status).toBe('not-applicable')
    expect(platformSourceStatusLabel({ numerator: 0, denominator: 0, rate: null, status: 'not-captured' })).toBe('待采集')
  })
})


describe('platform mention trend', () => {
  const followUp = {
    ...run,
    id: 'run-follow-up',
    name: '中国 · 同口径复测',
    createdAt: '2026-09-28T04:00:00.000Z',
    tasks: [
      { ...run.tasks[0], id: 'follow-doubao', observation: { ...run.tasks[0].observation!, rawAnswer: '本次回答没有出现目标品牌。', observedAt: '2026-09-28T02:01:00.000Z', reviewedAt: '2026-09-28T02:05:00.000Z' } },
      { ...run.tasks[1], id: 'follow-kimi', observation: { ...run.tasks[1].observation!, rawAnswer: '推荐 CoreNote 用于来源可追溯的团队。', observedAt: '2026-09-28T02:02:00.000Z', reviewedAt: '2026-09-28T02:06:00.000Z' } },
    ],
  } as RealSurfaceTestRun

  it('groups only comparable reviewed evidence by platform and leaves missing periods unscored', () => {
    const differentDataset = { ...followUp, id: 'run-other-dataset', querySetId: 'set-other' }
    const trend = buildPlatformMentionTrend([run, followUp, differentDataset], run, 'CoreNote', { granularity: 'day', range: 'all' })

    expect(trend.comparableRuns).toBe(2)
    expect(trend.excludedRuns).toBe(1)
    expect(trend.points).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: '豆包', bucket: '2026-09-28', numerator: 0, denominator: 1, rate: 0 }),
      expect.objectContaining({ platform: '豆包', bucket: '2026-09-29', numerator: 1, denominator: 1, rate: 1 }),
      expect.objectContaining({ platform: 'Kimi', bucket: '2026-09-28', numerator: 1, denominator: 1, rate: 1 }),
      expect.objectContaining({ platform: 'Kimi', bucket: '2026-09-29', numerator: 0, denominator: 1, rate: 0 }),
    ]))
    expect(trend.buckets.map((bucket) => bucket.key)).toEqual(['2026-09-28', '2026-09-29'])
    expect(trend.buckets.find((bucket) => bucket.key === '2026-09-29')?.fullLabel).toContain('2026')
    expect(trend.points.find((point) => point.platform === '豆包' && point.bucket === '2026-09-29')?.bucketFullLabel).toContain('2026')
    expect(trend.platforms).toEqual(expect.arrayContaining(['DeepSeek', '通义千问', '豆包', 'Kimi', '元宝', '智谱清言（GLM）', '文心一言']))
    expect(trend.scopedPlatforms).toEqual(expect.arrayContaining(['豆包', 'Kimi']))
  })

  it('combines repeated same-week platform evidence into one real rate', () => {
    const trend = buildPlatformMentionTrend([run, followUp], run, 'CoreNote', { granularity: 'week', range: 'all' })
    const doubao = trend.points.find((point) => point.platform === '豆包')
    const kimi = trend.points.find((point) => point.platform === 'Kimi')

    expect(doubao).toMatchObject({ numerator: 1, denominator: 2, rate: 0.5 })
    expect(kimi).toMatchObject({ numerator: 1, denominator: 2, rate: 0.5 })
  })
})

describe('owned citation trend and Query × platform matrix', () => {
  it('calculates self-owned citation rate from reviewed evidence only and preserves comparable scope', () => {
    const followUp = {
      ...run,
      id: 'run-owned-follow-up',
      createdAt: '2026-09-28T04:00:00.000Z',
      tasks: [
        { ...run.tasks[0], id: 'owned-follow-doubao', observation: { ...run.tasks[0].observation!, citations: ['https://example.com/review'], observedAt: '2026-09-28T02:01:00.000Z', reviewedAt: '2026-09-28T02:05:00.000Z' } },
        { ...run.tasks[1], id: 'owned-follow-kimi', observation: { ...run.tasks[1].observation!, citations: ['https://corenote.cloud/pricing'], observedAt: '2026-09-28T02:02:00.000Z', reviewedAt: '2026-09-28T02:06:00.000Z' } },
      ],
    } as RealSurfaceTestRun
    const incompatible = { ...followUp, id: 'run-owned-incompatible', locale: 'en-US' } as RealSurfaceTestRun

    const trend = buildPlatformOwnedCitationTrend([run, followUp, incompatible], run, 'https://corenote.cloud/', { granularity: 'day', range: 'all' })

    expect(trend.comparableRuns).toBe(2)
    expect(trend.excludedRuns).toBe(1)
    expect(trend.points).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: '豆包', bucket: '2026-09-28', numerator: 0, denominator: 1, rate: 0 }),
      expect.objectContaining({ platform: '豆包', bucket: '2026-09-29', numerator: 1, denominator: 1, rate: 1 }),
      expect.objectContaining({ platform: 'Kimi', bucket: '2026-09-28', numerator: 1, denominator: 1, rate: 1 }),
      expect.objectContaining({ platform: 'Kimi', bucket: '2026-09-29', numerator: 0, denominator: 1, rate: 0 }),
    ]))
  })

  it('keeps review and collection states distinct in the Query × platform visibility matrix', () => {
    const partialRun = {
      ...run,
      tasks: [
        ...run.tasks,
        { ...run.tasks[0], id: 'task-5', seedQueryId: 'query-3', platform: '豆包', state: 'queued', agentState: 'idle', question: '如何为知识库选择合适的工具？', intent: '购买决策', observation: null },
      ],
    } as RealSurfaceTestRun

    const matrix = buildQueryPlatformHeatmap(partialRun, 'CoreNote', 'https://corenote.cloud/')
    const byCell = (queryId: string, platform: string) => matrix.cells.find((cell) => cell.queryId === queryId && cell.platform === platform)

    expect(byCell('query-1', '豆包')).toMatchObject({ state: 'owned-citation', reviewed: 1, expected: 1, mention: { rate: 1 }, ownedCitation: { rate: 1 } })
    expect(byCell('query-1', 'Kimi')).toMatchObject({ state: 'not-mentioned', reviewed: 1, expected: 1, mention: { rate: 0 }, ownedCitation: { rate: 0 } })
    expect(byCell('query-2', '豆包')).toMatchObject({ state: 'pending-review', reviewed: 0, expected: 1, mention: { rate: null }, ownedCitation: { rate: null } })
    expect(byCell('query-2', 'Kimi')).toMatchObject({ state: 'failed', reviewed: 0, expected: 1, mention: { rate: null }, ownedCitation: { rate: null } })
    expect(byCell('query-3', 'Kimi')).toMatchObject({ state: 'not-collected', reviewed: 0, expected: 0, mention: { rate: null }, ownedCitation: { rate: null } })
  })
})

