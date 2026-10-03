import { useEffect, useMemo, useState } from 'react'
import { Info, LineChart as LineChartIcon } from 'lucide-react'
import type { RealSurfaceTestRun } from './api'
import {
  buildPlatformMentionTrend,
  buildPlatformOwnedCitationTrend,
  type PlatformMentionTrend,
  type PlatformMentionTrendPoint,
  type TrendGranularity,
  type TrendRangeDays,
} from './visibilityMetrics'

type MentionTrendProps = {
  snapshots: RealSurfaceTestRun[]
  baselineRun: RealSurfaceTestRun
  brandName: string
}

type OwnedCitationTrendProps = {
  snapshots: RealSurfaceTestRun[]
  baselineRun: RealSurfaceTestRun
  ownWebsite: string
}

type TrendSubject = {
  kind: 'mention' | 'owned-citation'
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  detailLabel: string
}

function ownDomainLabel(ownWebsite: string) {
  try { return new URL(ownWebsite).hostname.replace(/^www\./, '') || '当前项目自有域名' } catch { return ownWebsite.trim() || '当前项目自有域名' }
}

function mentionSubject(brandName: string): TrendSubject {
  const scopedBrand = brandName.trim() || '当前项目品牌'
  return {
    kind: 'mention',
    title: `各 AI 平台的「${scopedBrand}」提及率`,
    description: `统计已审核真实回答中提及当前项目品牌「${scopedBrand}」的比例。品牌提及不等于推荐，也不等于引用自有链接；空档不等于 0%。`,
    emptyTitle: `尚无可绘制的「${scopedBrand}」提及数据`,
    emptyDescription: '完成并审核一次真实平台回答后，会在对应日期、周或月份出现数据点；未采集的周期不会被填成 0%。',
    detailLabel: `提及「${scopedBrand}」`,
  }
}

function ownedCitationSubject(ownWebsite: string): TrendSubject {
  const domain = ownDomainLabel(ownWebsite)
  return {
    kind: 'owned-citation',
    title: '各 AI 平台的本品牌自有域名引用率',
    description: `统计已审核真实回答正文中引用当前项目自有域名（${domain}）的比例。提及品牌但未引用该域名不计入；空档不等于 0%。`,
    emptyTitle: '尚无可绘制的本品牌自有域名引用数据',
    emptyDescription: '完成并审核一次保留引用链接的真实平台回答后，会在对应时间出现数据点；没有采集到的周期保持为空档。',
    detailLabel: `引用自有域名「${domain}」`,
  }
}

const COLORS = ['#2563eb', '#0f766e', '#9333ea', '#d97706', '#dc2626', '#4f46e5', '#16a34a', '#be185d']
const WIDTH = 920
const HEIGHT = 310
const PAD = { top: 24, right: 22, bottom: 48, left: 48 }

function rateLabel(rate: number) { return `${Math.round(rate * 100)}%` }
function pointKey(point: PlatformMentionTrendPoint) { return `${point.platform}::${point.bucket}` }

function segmentsForPlatform(trend: PlatformMentionTrend, platform: string) {
  const pointByBucket = new Map(trend.points.filter((point) => point.platform === platform).map((point) => [point.bucket, point]))
  const segments: Array<Array<{ point: PlatformMentionTrendPoint; index: number }>> = []
  let active: Array<{ point: PlatformMentionTrendPoint; index: number }> = []
  trend.buckets.forEach((bucket, index) => {
    const point = pointByBucket.get(bucket.key)
    if (point) active.push({ point, index })
    else if (active.length) { segments.push(active); active = [] }
  })
  if (active.length) segments.push(active)
  return segments
}

function xPosition(index: number, count: number) {
  const graphWidth = WIDTH - PAD.left - PAD.right
  return count <= 1 ? PAD.left + graphWidth / 2 : PAD.left + (index / (count - 1)) * graphWidth
}
function yPosition(rate: number) { return PAD.top + (1 - rate) * (HEIGHT - PAD.top - PAD.bottom) }
function tickIndices(length: number) {
  if (length <= 6) return Array.from({ length }, (_, index) => index)
  return [...new Set(Array.from({ length: 6 }, (_, index) => Math.round(index * (length - 1) / 5)))]
}

function TrendChart({ trend, subject }: { trend: PlatformMentionTrend; subject: TrendSubject }) {
  const [hiddenPlatforms, setHiddenPlatforms] = useState<Set<string>>(new Set())
  const [activePoint, setActivePoint] = useState<PlatformMentionTrendPoint | null>(null)
  const visiblePlatforms = trend.platforms.filter((platform) => !hiddenPlatforms.has(platform))
  const colorFor = (platform: string) => COLORS[trend.platforms.indexOf(platform) % COLORS.length]
  const pointsByKey = useMemo(() => new Map(trend.points.map((point) => [pointKey(point), point])), [trend.points])

  useEffect(() => {
    setHiddenPlatforms((current) => new Set([...current].filter((platform) => trend.platforms.includes(platform))))
    setActivePoint((current) => current && pointsByKey.has(pointKey(current)) ? current : trend.points.at(-1) ?? null)
  }, [pointsByKey, trend.platforms, trend.points])

  const visiblePoints = trend.points.filter((point) => !hiddenPlatforms.has(point.platform))
  const lineSegments = visiblePlatforms.flatMap((platform) => segmentsForPlatform(trend, platform).filter((segment) => segment.length > 1).map((segment) => ({ platform, segment })))
  const hasTrendLine = lineSegments.length > 0
  const baselinePoints = visiblePoints.slice(-8)
  const ticks = tickIndices(trend.buckets.length)
  const graphHeight = HEIGHT - PAD.top - PAD.bottom
  const periodLabel = trend.granularity === 'day' ? '每日' : trend.granularity === 'week' ? '每周' : '每月'
  const ariaDescription = `展示 ${periodLabel}、每个平台的${subject.title}。仅计入已审核且保留真实回答的证据。`
  const legend = <div className="mention-trend-legend" aria-label="平台图例，点击可隐藏或显示平台曲线">
    {trend.platforms.map((platform) => {
      const hidden = hiddenPlatforms.has(platform)
      const inScope = trend.scopedPlatforms.includes(platform)
      return <button key={platform} type="button" className={`mention-trend-legend-item ${hidden ? 'is-hidden' : ''} ${inScope ? '' : 'is-not-scoped'}`} aria-pressed={!hidden} aria-label={`${platform}${inScope ? '，已纳入当前测试批次' : '，尚未纳入当前测试批次'}，点击${hidden ? '显示' : '隐藏'}曲线`} onClick={() => setHiddenPlatforms((current) => { const next = new Set(current); if (next.has(platform)) next.delete(platform); else next.add(platform); return next })}><i style={{ backgroundColor: colorFor(platform) }}/><span>{platform}</span>{!inScope && <small>未纳入</small>}</button>
    })}
  </div>

  if (!trend.evidenceCount) return <div className="mention-trend-chart mention-trend-chart--empty" aria-label={ariaDescription}>{legend}<div className="mention-trend-empty"><LineChartIcon size={22}/><div><b>{subject.emptyTitle}</b><span>{subject.emptyDescription}</span><small>上方已列出该市场的全部可测平台；“未纳入”表示当前批次没有创建该平台任务，不代表 0%。</small></div></div></div>

  return <div className="mention-trend-chart" aria-label={ariaDescription}>
    {legend}
    <div className="mention-trend-svg-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={ariaDescription}>
        <title>{subject.title}</title><desc>{ariaDescription}</desc>
        {[0, .25, .5, .75, 1].map((rate) => { const y = yPosition(rate); return <g key={rate}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="mention-trend-grid"/><text x={PAD.left - 10} y={y + 4} textAnchor="end" className="mention-trend-y-label">{Math.round(rate * 100)}%</text></g> })}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + graphHeight} className="mention-trend-axis"/><line x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + graphHeight} y2={PAD.top + graphHeight} className="mention-trend-axis"/>
        {trend.buckets.map((bucket, index) => <g key={`tick-${bucket.key}`}><title>{bucket.fullLabel}</title><line x1={xPosition(index, trend.buckets.length)} x2={xPosition(index, trend.buckets.length)} y1={PAD.top + graphHeight} y2={PAD.top + graphHeight + (trend.granularity === 'day' ? 4 : 5)} className={trend.granularity === 'day' ? 'mention-trend-day-tick' : 'mention-trend-axis'}/></g>)}
        {ticks.map((index) => <text key={`label-${index}`} x={xPosition(index, trend.buckets.length)} y={HEIGHT - 17} textAnchor="middle" className="mention-trend-x-label">{trend.buckets[index]?.label}</text>)}
        {lineSegments.map(({ platform, segment }, segmentIndex) => <polyline key={`${platform}-${segmentIndex}`} className={`mention-trend-line ${subject.kind === 'owned-citation' ? 'owned-citation-line' : ''}`} points={segment.map(({ point, index }) => `${xPosition(index, trend.buckets.length)},${yPosition(point.rate)}`).join(' ')} stroke={colorFor(platform)}/>)}
        {visiblePoints.map((point) => {
          const index = trend.buckets.findIndex((bucket) => bucket.key === point.bucket)
          const active = activePoint && pointKey(activePoint) === pointKey(point)
          const cx = xPosition(index, trend.buckets.length); const cy = yPosition(point.rate)
          return <g key={pointKey(point)} tabIndex={0} role="button" aria-label={`${point.platform}，${point.bucketLabel}，${subject.title} ${rateLabel(point.rate)}，${point.numerator}/${point.denominator} 条有效回答`} onFocus={() => setActivePoint(point)} onMouseEnter={() => setActivePoint(point)} onClick={() => setActivePoint(point)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActivePoint(point) } }}><circle cx={cx} cy={cy} r={active ? 8 : 6} className="mention-trend-focus-ring" fill={colorFor(point.platform)}/><circle cx={cx} cy={cy} r={active ? 4.5 : 3.5} className="mention-trend-dot" fill={colorFor(point.platform)}/></g>
        })}
      </svg>
    </div>
    {activePoint && <div className="mention-trend-detail" aria-live="polite"><div><i style={{ backgroundColor: colorFor(activePoint.platform) }}/><b>{activePoint.platform}</b><span>{activePoint.bucketFullLabel}</span></div><strong>{rateLabel(activePoint.rate)}</strong><small>{activePoint.numerator}/{activePoint.denominator} 条已审核真实回答{subject.detailLabel} · 点击或悬停数据点可查看该日明细</small></div>}
    {!hasTrendLine && <p className="mention-trend-note"><Info size={15}/>当前显示首轮基线数据点；同一平台完成第二次相同 Query、市场、语言的复测后，系统会自动连接为真实折线。</p>}
  </div>
}

function PlatformRateTrend({ snapshots, baselineRun, subject, buildTrend }: { snapshots: RealSurfaceTestRun[]; baselineRun: RealSurfaceTestRun; subject: TrendSubject; buildTrend: (granularity: TrendGranularity, range: TrendRangeDays) => PlatformMentionTrend }) {
  const [granularity, setGranularity] = useState<TrendGranularity>('day')
  const [range, setRange] = useState<TrendRangeDays>(30)
  const trend = useMemo(() => buildTrend(granularity, range), [buildTrend, granularity, range])
  return <section className="panel mention-trend-panel">
    <header className="mention-trend-header"><div><p className="eyebrow"><LineChartIcon size={15}/>平台趋势</p><h3>{subject.title}</h3><p>{subject.description}</p></div><div className="mention-trend-controls"><fieldset><legend>时间粒度</legend><div className="segmented-control">{([['day', '日'], ['week', '周'], ['month', '月']] as Array<[TrendGranularity, string]>).map(([value, label]) => <button key={value} type="button" aria-pressed={granularity === value} className={granularity === value ? 'is-active' : ''} onClick={() => setGranularity(value)}>{label}</button>)}</div></fieldset><fieldset><legend>范围</legend><div className="segmented-control">{([[30, '近 30 天'], [90, '近 90 天'], ['all', '全部']] as Array<[TrendRangeDays, string]>).map(([value, label]) => <button key={String(value)} type="button" aria-pressed={range === value} className={range === value ? 'is-active' : ''} onClick={() => setRange(value)}>{label}</button>)}</div></fieldset></div></header>
    <div className="mention-trend-meta"><span>口径：{baselineRun.marketPack === 'CN' ? '中国市场' : '美国市场'} · {baselineRun.locale} · 当前核心 Query 集</span><span>当前批次纳入 {trend.scopedPlatforms.length}/{trend.platforms.length} 个市场平台</span><span>{trend.comparableRuns} 个同口径批次 · {trend.evidenceCount} 条已审核证据</span>{trend.excludedRuns > 0 && <span>已排除 {trend.excludedRuns} 个不同 Query 集 / 市场 / 语言的批次</span>}</div>
    <TrendChart trend={trend} subject={subject}/>
  </section>
}

export function PlatformMentionTrend({ snapshots, baselineRun, brandName }: MentionTrendProps) {
  const buildTrend = useMemo(() => (granularity: TrendGranularity, range: TrendRangeDays) => buildPlatformMentionTrend(snapshots, baselineRun, brandName, { granularity, range }), [snapshots, baselineRun, brandName])
  const subject = useMemo(() => mentionSubject(brandName), [brandName])
  return <PlatformRateTrend snapshots={snapshots} baselineRun={baselineRun} subject={subject} buildTrend={buildTrend}/>
}

export function PlatformOwnedCitationTrend({ snapshots, baselineRun, ownWebsite }: OwnedCitationTrendProps) {
  const buildTrend = useMemo(() => (granularity: TrendGranularity, range: TrendRangeDays) => buildPlatformOwnedCitationTrend(snapshots, baselineRun, ownWebsite, { granularity, range }), [snapshots, baselineRun, ownWebsite])
  const subject = useMemo(() => ownedCitationSubject(ownWebsite), [ownWebsite])
  return <PlatformRateTrend snapshots={snapshots} baselineRun={baselineRun} subject={subject} buildTrend={buildTrend}/>
}
