import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Grid3X3, Info, Link2, MessageSquareText } from 'lucide-react'
import type { RealSurfaceTestRun } from './api'
import {
  buildQueryPlatformHeatmap,
  displayVisibilityRate,
  type QueryPlatformHeatmapCell,
  type QueryPlatformHeatmapCellState,
} from './visibilityMetrics'

type QueryPlatformHeatmapProps = {
  run: RealSurfaceTestRun
  brandName: string
  ownWebsite: string
}

const PAGE_SIZE = 10

type HeatmapStateMeta = { label: string; description: string; icon: 'citation' | 'mention' | 'none' | 'pending' | 'failed' | 'empty' }

function stateMetaFor(brandName: string): Record<QueryPlatformHeatmapCellState, HeatmapStateMeta> {
  const scopedBrand = brandName.trim() || '当前项目品牌'
  return {
    'owned-citation': { label: '提及本品牌 + 自有链接', description: `已审核回答提及「${scopedBrand}」，且正文引用了当前项目自有域名。`, icon: 'citation' },
    mentioned: { label: '提及本品牌', description: `已审核回答中出现「${scopedBrand}」，但未引用当前项目自有域名。`, icon: 'mention' },
    'not-mentioned': { label: '未提及本品牌', description: `已有审核证据，但回答中未出现「${scopedBrand}」。`, icon: 'none' },
    'pending-review': { label: '待审核', description: '已有采集结果，但尚未进入正式指标。', icon: 'pending' },
    failed: { label: '采集失败', description: '本单元尚未获得可用回答证据。', icon: 'failed' },
    'not-collected': { label: '待采集', description: '尚未执行或尚未回传可审核回答。', icon: 'empty' },
    'not-applicable': { label: '不适用', description: '该 Query × 平台单元被明确跳过。', icon: 'empty' },
  }
}

function cellKey(queryId: string, platform: string) { return `${queryId}::${platform}` }

function CellMark({ cell, meta }: { cell: QueryPlatformHeatmapCell; meta: HeatmapStateMeta }) {
  if (meta.icon === 'citation') return <Link2 size={16}/>
  if (meta.icon === 'mention') return <MessageSquareText size={16}/>
  if (meta.icon === 'none') return <span aria-hidden="true">—</span>
  if (meta.icon === 'pending') return <span aria-hidden="true">…</span>
  if (meta.icon === 'failed') return <span aria-hidden="true">!</span>
  return <span aria-hidden="true">·</span>
}

export function QueryPlatformHeatmap({ run, brandName, ownWebsite }: QueryPlatformHeatmapProps) {
  const heatmap = useMemo(() => buildQueryPlatformHeatmap(run, brandName, ownWebsite), [run, brandName, ownWebsite])
  const stateMeta = useMemo(() => stateMetaFor(brandName), [brandName])
  const scopedBrand = brandName.trim() || '当前项目品牌'
  const [page, setPage] = useState(0)
  const [selectedKey, setSelectedKey] = useState('')
  const pageCount = Math.max(1, Math.ceil(heatmap.queries.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visibleQueries = heatmap.queries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const visibleQueryIds = new Set(visibleQueries.map((query) => query.queryId))
  const cells = new Map(heatmap.cells.map((cell) => [cellKey(cell.queryId, cell.platform), cell]))
  const selectedCell = selectedKey ? cells.get(selectedKey) ?? null : null
  const selectedQuery = selectedCell ? heatmap.queries.find((query) => query.queryId === selectedCell.queryId) ?? null : null

  useEffect(() => { setPage((current) => Math.min(current, pageCount - 1)) }, [pageCount])
  useEffect(() => {
    if (selectedCell && !visibleQueryIds.has(selectedCell.queryId)) setSelectedKey('')
  }, [selectedCell, visibleQueryIds])

  if (!heatmap.queries.length || !heatmap.platforms.length) return null

  return <section className="panel query-heatmap-panel">
    <header className="query-heatmap-header"><div><p className="eyebrow"><Grid3X3 size={15}/>核心 Query 诊断</p><h3>Query × 平台可见度矩阵</h3><p>先看具体问题在哪个平台提及「{scopedBrand}」、引用自有链接或存在缺口；采集与审核状态不会被误记成“未提及本品牌”。</p></div><span>当前 T0 批次</span></header>
    <div className="query-heatmap-legend" aria-label="矩阵状态说明">
      {(['owned-citation', 'mentioned', 'not-mentioned', 'pending-review', 'failed', 'not-collected'] as QueryPlatformHeatmapCellState[]).map((state) => <span key={state} className={`heatmap-legend-item ${state}`}><i/><b>{stateMeta[state].label}</b></span>)}
    </div>
    <div className="query-heatmap-scroll"><table className="query-heatmap-table"><thead><tr><th scope="col">核心 Query</th>{heatmap.platforms.map((platform) => <th scope="col" key={platform}>{platform}</th>)}</tr></thead><tbody>{visibleQueries.map((query, queryIndex) => <tr key={query.queryId}><th scope="row"><span className="query-seq">Q{safePage * PAGE_SIZE + queryIndex + 1}</span><span><b>{query.question}</b><small>{query.intent}</small></span></th>{heatmap.platforms.map((platform) => { const cell = cells.get(cellKey(query.queryId, platform))!; const selected = selectedKey === cellKey(query.queryId, platform); const meta = stateMeta[cell.state]; return <td key={platform}><button type="button" aria-pressed={selected} aria-label={`${query.question}，${platform}：${meta.label}。${meta.description}`} className={`heatmap-cell ${cell.state} ${selected ? 'is-selected' : ''}`} onClick={() => setSelectedKey(cellKey(query.queryId, platform))}><CellMark cell={cell} meta={meta}/><span>{meta.label}</span></button></td> })}</tr>)}</tbody></table></div>
    {selectedCell && selectedQuery && <article className={`heatmap-detail ${selectedCell.state}`} aria-live="polite"><div><span className="query-seq">Q{heatmap.queries.findIndex((query) => query.queryId === selectedQuery.queryId) + 1}</span><div><b>{selectedQuery.question}</b><small>{selectedQuery.intent} · {selectedCell.platform}</small></div></div><div><strong>{stateMeta[selectedCell.state].label}</strong><span>{selectedCell.reviewed}/{selectedCell.expected} 已审核 · 本品牌提及 {displayVisibilityRate(selectedCell.mention)} · 自有域名引用 {displayVisibilityRate(selectedCell.ownedCitation)}</span><small>{stateMeta[selectedCell.state].description}</small></div></article>}
    <footer className="query-heatmap-footer"><span><Info size={15}/>已展示 {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, heatmap.queries.length)} / {heatmap.queries.length} 条核心 Query</span>{pageCount > 1 && <div><button type="button" className="secondary" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft size={15}/>上一页</button><span>{safePage + 1}/{pageCount}</span><button type="button" className="secondary" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>下一页<ChevronRight size={15}/></button></div>}</footer>
  </section>
}
