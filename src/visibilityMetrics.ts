import type { RealSurfaceTask, RealSurfaceTestRun } from './api'
import { platformsForMarket } from './platformCatalog'

export type VisibilityRate = {
  numerator: number
  denominator: number
  rate: number | null
}

export type VisibilityMetric = VisibilityRate & {
  status: 'available' | 'not-applicable' | 'not-captured'
}

export type VisibilityPlatformMetric = {
  platform: string
  /** This platform has Query × platform tasks in the selected actual test run. */
  inCurrentRun: boolean
  expected: number
  /** Real answers returned by the platform before formal review. */
  observed: number
  reviewed: number
  pendingReview: number
  failed: number
  mention: VisibilityRate
  recommendation: VisibilityRate
  ownedCitation: VisibilityRate
  /** Count of owned-domain citation URLs in reviewed evidence; never inferred. */
  ownedCitationLinks: number
  platformSource: VisibilityMetric
}

export type VisibilityQueryMetric = {
  queryId: string
  question: string
  intent: string
  priority: string
  expected: number
  reviewed: number
  pendingReview: number
  failed: number
  mention: VisibilityRate
  ownedCitation: VisibilityRate
  platformSource: VisibilityMetric
  platforms: string[]
}

export type VisibilityBaselineMetrics = {
  expected: number
  reviewed: number
  submitted: number
  needsRevision: number
  failed: number
  completeness: VisibilityRate
  usableEvidence: number
  collectionMethods: { browserAgent: number; controlledManual: number }
  /** Every supported platform in this run's market, including ones not yet scheduled. */
  marketPlatforms: VisibilityPlatformMetric[]
  scopedPlatformCount: number
  observed: number
  mention: VisibilityRate
  recommendation: VisibilityRate
  ownedCitation: VisibilityRate
  platformSource: VisibilityMetric
  platforms: VisibilityPlatformMetric[]
  queries: VisibilityQueryMetric[]
}

type EvidenceTask = RealSurfaceTask & { observation: NonNullable<RealSurfaceTask['observation']> }

type SourceLink = { url?: unknown; sourceType?: unknown }

const unavailableMetric = (status: VisibilityMetric['status']): VisibilityMetric => ({ numerator: 0, denominator: 0, rate: null, status })
const availableRate = (numerator: number, denominator: number): VisibilityRate => ({ numerator, denominator, rate: denominator ? numerator / denominator : null })

function hostFrom(url: string | null | undefined) {
  if (!url) return null
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') || null } catch { return null }
}

function isOwnedUrl(url: string | null | undefined, ownedHost: string | null) {
  const host = hostFrom(url)
  if (!host || !ownedHost) return false
  return host === ownedHost || host.endsWith(`.${ownedHost}`)
}

function compactText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function matchesBrand(answer: string, brandName: string) {
  const normalizedBrand = compactText(brandName).toLocaleLowerCase()
  return Boolean(normalizedBrand && compactText(answer).toLocaleLowerCase().includes(normalizedBrand))
}

function hasRecommendationLanguage(answer: string, brandName: string) {
  const normalizedBrand = compactText(brandName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!normalizedBrand || !matchesBrand(answer, brandName)) return false
  const copy = compactText(answer)
  const brand = normalizedBrand
  const nearby = new RegExp(`(?:推荐|首选|适合|值得考虑|建议选择|建议使用|recommended|recommend|best for|suitable for|consider)\\s*(?:[^。！？.!?]{0,40})${brand}|${brand}(?:[^。！？.!?]{0,40})(?:推荐|首选|适合|值得考虑|建议选择|建议使用|recommended|recommend|best for|suitable for|consider)`, 'i')
  return nearby.test(copy)
}

function platformSourceUrls(task: EvidenceTask) {
  const links = task.observation.captureMetadata?.visibleLinks
  if (!Array.isArray(links)) return null
  return links
    .filter((item): item is SourceLink => Boolean(item) && typeof item === 'object')
    .filter((item) => item.sourceType === 'platform-search-result')
    .map((item) => typeof item.url === 'string' ? item.url : '')
    .filter(Boolean)
}

function platformSourceMetric(tasks: EvidenceTask[], ownedHost: string | null): VisibilityMetric {
  const searched = tasks.filter((task) => task.observation.searchEnabled)
  if (!searched.length) return unavailableMetric('not-applicable')
  const withCapture = searched.filter((task) => platformSourceUrls(task) !== null)
  if (!withCapture.length) return unavailableMetric('not-captured')
  const numerator = withCapture.filter((task) => (platformSourceUrls(task) ?? []).some((url) => isOwnedUrl(url, ownedHost))).length
  return { ...availableRate(numerator, withCapture.length), status: 'available' }
}

function evidenceTasks(tasks: RealSurfaceTask[]): EvidenceTask[] {
  return tasks.filter((task): task is EvidenceTask => task.state === 'reviewed' && task.observation !== null && task.observation !== undefined && Boolean(compactText(task.observation.rawAnswer)))
}

function metricBundle(tasks: RealSurfaceTask[], brandName: string, ownedHost: string | null) {
  const evidence = evidenceTasks(tasks)
  const mention = availableRate(evidence.filter((task) => matchesBrand(task.observation.rawAnswer, brandName)).length, evidence.length)
  const recommendation = availableRate(evidence.filter((task) => hasRecommendationLanguage(task.observation.rawAnswer, brandName)).length, evidence.length)
  const ownedCitation = availableRate(evidence.filter((task) => task.observation.citations.some((url) => isOwnedUrl(url, ownedHost))).length, evidence.length)
  return { evidence, mention, recommendation, ownedCitation, platformSource: platformSourceMetric(evidence, ownedHost) }
}

function observedTasks(tasks: RealSurfaceTask[]) {
  return tasks.filter((task) => Boolean(task.observation && compactText(task.observation.rawAnswer)))
}

function ownedCitationLinkCount(tasks: EvidenceTask[], ownedHost: string | null) {
  if (!ownedHost) return 0
  return tasks.reduce((count, task) => count + task.observation.citations.filter((url) => isOwnedUrl(url, ownedHost)).length, 0)
}

function platformMetric(platform: string, scope: RealSurfaceTask[], brandName: string, ownedHost: string | null): VisibilityPlatformMetric {
  const metric = metricBundle(scope, brandName, ownedHost)
  return {
    platform,
    inCurrentRun: scope.length > 0,
    expected: scope.length,
    observed: observedTasks(scope).length,
    reviewed: metric.evidence.length,
    pendingReview: scope.filter((task) => task.state === 'submitted' || task.state === 'needs_revision').length,
    failed: scope.filter((task) => task.state === 'failed').length,
    mention: metric.mention,
    recommendation: metric.recommendation,
    ownedCitation: metric.ownedCitation,
    ownedCitationLinks: ownedCitationLinkCount(metric.evidence, ownedHost),
    platformSource: metric.platformSource,
  }
}

export function buildVisibilityBaselineMetrics(run: RealSurfaceTestRun, brandName: string, ownWebsite: string): VisibilityBaselineMetrics {
  const tasks = run.tasks ?? []
  const ownHost = hostFrom(ownWebsite)
  const all = metricBundle(tasks, brandName, ownHost)
  const reviewed = all.evidence.length
  const submitted = tasks.filter((task) => task.state === 'submitted').length
  const needsRevision = tasks.filter((task) => task.state === 'needs_revision').length
  const failed = tasks.filter((task) => task.state === 'failed').length
  const collectionMethods = all.evidence.reduce((summary, task) => {
    if (task.observation.collectionMethod === 'browser-agent') summary.browserAgent += 1
    else summary.controlledManual += 1
    return summary
  }, { browserAgent: 0, controlledManual: 0 })

  const platformNames = [...new Set(tasks.map((task) => task.platform))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const platforms = platformNames.map((platform) => platformMetric(platform, tasks.filter((task) => task.platform === platform), brandName, ownHost))
  const catalogPlatforms = platformsForMarket(run.marketPack)
  const marketPlatformNames = [...catalogPlatforms, ...platformNames.filter((platform) => !catalogPlatforms.includes(platform))]
  const marketPlatforms = marketPlatformNames.map((platform) => platformMetric(platform, tasks.filter((task) => task.platform === platform), brandName, ownHost))

  const queryOrder = new Map<string, number>()
  tasks.forEach((task, index) => { if (!queryOrder.has(task.seedQueryId)) queryOrder.set(task.seedQueryId, index) })
  const queryNames = [...new Set(tasks.map((task) => task.seedQueryId))]
  const queries = queryNames.map((queryId) => {
    const scope = tasks.filter((task) => task.seedQueryId === queryId)
    const metric = metricBundle(scope, brandName, ownHost)
    const sample = scope[0]
    return {
      queryId,
      question: sample?.question ?? '未命名 Query',
      intent: sample?.intent ?? '未分类',
      priority: 'core',
      expected: scope.length,
      reviewed: metric.evidence.length,
      pendingReview: scope.filter((task) => task.state === 'submitted' || task.state === 'needs_revision').length,
      failed: scope.filter((task) => task.state === 'failed').length,
      mention: metric.mention,
      ownedCitation: metric.ownedCitation,
      platformSource: metric.platformSource,
      platforms: [...new Set(scope.map((task) => task.platform))],
    }
  }).sort((left, right) => (queryOrder.get(left.queryId) ?? 0) - (queryOrder.get(right.queryId) ?? 0))

  return {
    expected: tasks.length,
    reviewed,
    submitted,
    needsRevision,
    failed,
    completeness: availableRate(reviewed, tasks.length),
    usableEvidence: reviewed,
    collectionMethods,
    marketPlatforms,
    scopedPlatformCount: platforms.length,
    observed: observedTasks(tasks).length,
    mention: all.mention,
    recommendation: all.recommendation,
    ownedCitation: all.ownedCitation,
    platformSource: all.platformSource,
    platforms,
    queries,
  }
}

export function displayVisibilityRate(metric: VisibilityRate | VisibilityMetric) {
  if (metric.rate === null) return '—'
  return `${Math.round(metric.rate * 100)}%`
}

export function platformSourceStatusLabel(metric: VisibilityMetric) {
  if (metric.status === 'not-applicable') return '不适用'
  if (metric.status === 'not-captured') return '待采集'
  return displayVisibilityRate(metric)
}


export type TrendGranularity = 'day' | 'week' | 'month'
export type TrendRangeDays = 30 | 90 | 'all'

export type PlatformMentionTrendPoint = {
  bucket: string
  bucketLabel: string
  bucketFullLabel: string
  platform: string
  numerator: number
  denominator: number
  rate: number
  observedAt: string
}

export type PlatformMentionTrend = {
  granularity: TrendGranularity
  range: TrendRangeDays
  buckets: Array<{ key: string; label: string; fullLabel: string }>
  points: PlatformMentionTrendPoint[]
  /** Every market-supported platform plus any historical platform found in evidence. */
  platforms: string[]
  /** Platforms with Query × platform tasks in the selected current batch. */
  scopedPlatforms: string[]
  comparableRuns: number
  excludedRuns: number
  evidenceCount: number
}

type Bucket = { key: string; label: string; fullLabel: string; start: Date }

function utcDayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function weekStart(value: Date) {
  const start = utcDayStart(value)
  const day = start.getUTCDay() || 7
  start.setUTCDate(start.getUTCDate() - day + 1)
  return start
}

function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function dateKey(value: Date) {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}`
}

function bucketFor(value: Date, granularity: TrendGranularity): Bucket {
  if (granularity === 'month') {
    const start = monthStart(value)
    return { key: monthKey(start), label: `${start.getUTCFullYear()}/${pad(start.getUTCMonth() + 1)}`, fullLabel: `${start.getUTCFullYear()} 年 ${start.getUTCMonth() + 1} 月`, start }
  }
  if (granularity === 'week') {
    const start = weekStart(value)
    const end = new Date(start.getTime())
    end.setUTCDate(end.getUTCDate() + 6)
    return { key: dateKey(start), label: `${start.getUTCMonth() + 1}/${start.getUTCDate()} 周`, fullLabel: `${start.getUTCFullYear()} 年 ${start.getUTCMonth() + 1} 月 ${start.getUTCDate()} 日至 ${end.getUTCMonth() + 1} 月 ${end.getUTCDate()} 日`, start }
  }
  const start = utcDayStart(value)
  return { key: dateKey(start), label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`, fullLabel: `${start.getUTCFullYear()} 年 ${start.getUTCMonth() + 1} 月 ${start.getUTCDate()} 日`, start }
}

function incrementBucket(value: Date, granularity: TrendGranularity) {
  const next = new Date(value.getTime())
  if (granularity === 'month') next.setUTCMonth(next.getUTCMonth() + 1)
  else next.setUTCDate(next.getUTCDate() + (granularity === 'week' ? 7 : 1))
  return next
}

function timelineBuckets(start: Date, end: Date, granularity: TrendGranularity) {
  const buckets: Bucket[] = []
  for (let current = bucketFor(start, granularity).start; current.getTime() <= end.getTime(); current = incrementBucket(current, granularity)) {
    buckets.push(bucketFor(current, granularity))
  }
  return buckets
}

function evidenceTimestamp(task: EvidenceTask, fallback: string) {
  const raw = task.observation.reviewedAt ?? task.observation.observedAt ?? task.submittedAt ?? fallback
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Aggregates only reviewed, evidence-bearing answers from runs that share the
 * selected T0's Query dataset, market and locale. A missing bucket is left
 * absent rather than converted to a 0% rate.
 */
function buildPlatformRateTrend(
  snapshots: RealSurfaceTestRun[],
  baseline: RealSurfaceTestRun,
  options: { granularity: TrendGranularity; range: TrendRangeDays },
  qualifies: (task: EvidenceTask) => boolean,
): PlatformMentionTrend {
  const comparable = snapshots.filter((run) => (
    run.querySetId === baseline.querySetId
    && run.marketPack === baseline.marketPack
    && run.locale === baseline.locale
  ))
  const evidence = comparable.flatMap((run) => evidenceTasks(run.tasks ?? []).flatMap((task) => {
    const observedAt = evidenceTimestamp(task, run.createdAt)
    return observedAt ? [{ task, observedAt }] : []
  }))
  const latestEvidence = evidence.reduce<Date | null>((latest, item) => (!latest || item.observedAt > latest ? item.observedAt : latest), null)
  // "All" is an evidence history, not a calendar forecast: it ends at the most
  // recent reviewed answer so the chart never invents an empty "today" bucket.
  const rangeEnd = options.range === 'all' ? latestEvidence : (latestEvidence && latestEvidence > new Date() ? latestEvidence : new Date())
  const rangeStart = options.range === 'all'
    ? evidence.reduce<Date | null>((earliest, item) => (!earliest || item.observedAt < earliest ? item.observedAt : earliest), null)
    : rangeEnd ? new Date(rangeEnd.getTime() - (options.range - 1) * 24 * 60 * 60 * 1000) : null

  if (!rangeStart || !rangeEnd) {
    return {
      granularity: options.granularity,
      range: options.range,
      buckets: [],
      points: [],
      platforms: platformsForMarket(baseline.marketPack),
      scopedPlatforms: [...new Set(baseline.tasks.map((task) => task.platform))],
      comparableRuns: comparable.length,
      excludedRuns: Math.max(0, snapshots.length - comparable.length),
      evidenceCount: 0,
    }
  }

  const buckets = timelineBuckets(rangeStart, rangeEnd, options.granularity)
  const bucketKeys = new Set(buckets.map((bucket) => bucket.key))
  const totals = new Map<string, { numerator: number; denominator: number; observedAt: string }>()
  for (const item of evidence) {
    if (item.observedAt < rangeStart || item.observedAt > rangeEnd) continue
    const bucket = bucketFor(item.observedAt, options.granularity)
    if (!bucketKeys.has(bucket.key)) continue
    const key = `${item.task.platform}::${bucket.key}`
    const current = totals.get(key) ?? { numerator: 0, denominator: 0, observedAt: item.observedAt.toISOString() }
    current.denominator += 1
    if (qualifies(item.task)) current.numerator += 1
    if (item.observedAt.toISOString() > current.observedAt) current.observedAt = item.observedAt.toISOString()
    totals.set(key, current)
  }

  const platforms = [...new Set([
    ...baseline.tasks.map((task) => task.platform),
    ...evidence.map((item) => item.task.platform),
  ])].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const labelByKey = new Map(buckets.map((bucket) => [bucket.key, bucket.label]))
  const fullLabelByKey = new Map(buckets.map((bucket) => [bucket.key, bucket.fullLabel]))
  const points = [...totals.entries()].map(([key, value]) => {
    const separator = key.lastIndexOf('::')
    const platform = key.slice(0, separator)
    const bucket = key.slice(separator + 2)
    return {
      bucket,
      bucketLabel: labelByKey.get(bucket) ?? bucket,
      bucketFullLabel: fullLabelByKey.get(bucket) ?? bucket,
      platform,
      numerator: value.numerator,
      denominator: value.denominator,
      rate: value.numerator / value.denominator,
      observedAt: value.observedAt,
    }
  }).sort((left, right) => left.bucket.localeCompare(right.bucket) || left.platform.localeCompare(right.platform, 'zh-CN'))

  const catalogPlatforms = platformsForMarket(baseline.marketPack)
  const scopedPlatforms = [...new Set(baseline.tasks.map((task) => task.platform))]
  const allPlatforms = [...catalogPlatforms, ...platforms.filter((platform) => !catalogPlatforms.includes(platform))]

  return {
    granularity: options.granularity,
    range: options.range,
    buckets: buckets.map(({ key, label, fullLabel }) => ({ key, label, fullLabel })),
    points,
    platforms: allPlatforms,
    scopedPlatforms,
    comparableRuns: comparable.length,
    excludedRuns: Math.max(0, snapshots.length - comparable.length),
    evidenceCount: points.reduce((sum, point) => sum + point.denominator, 0),
  }
}

export function buildPlatformMentionTrend(
  snapshots: RealSurfaceTestRun[],
  baseline: RealSurfaceTestRun,
  brandName: string,
  options: { granularity: TrendGranularity; range: TrendRangeDays },
): PlatformMentionTrend {
  return buildPlatformRateTrend(snapshots, baseline, options, (task) => matchesBrand(task.observation.rawAnswer, brandName))
}

export function buildPlatformOwnedCitationTrend(
  snapshots: RealSurfaceTestRun[],
  baseline: RealSurfaceTestRun,
  ownWebsite: string,
  options: { granularity: TrendGranularity; range: TrendRangeDays },
): PlatformMentionTrend {
  const ownHost = hostFrom(ownWebsite)
  return buildPlatformRateTrend(snapshots, baseline, options, (task) => task.observation.citations.some((url) => isOwnedUrl(url, ownHost)))
}

export type QueryPlatformHeatmapCellState = 'owned-citation' | 'mentioned' | 'not-mentioned' | 'pending-review' | 'failed' | 'not-collected' | 'not-applicable'

export type QueryPlatformHeatmapCell = {
  queryId: string
  platform: string
  state: QueryPlatformHeatmapCellState
  expected: number
  reviewed: number
  mention: VisibilityRate
  ownedCitation: VisibilityRate
}

export type QueryPlatformHeatmap = {
  platforms: string[]
  queries: Array<{ queryId: string; question: string; intent: string }>
  cells: QueryPlatformHeatmapCell[]
}

/** Current T0 matrix. This view keeps collection state visible alongside actual performance. */
export function buildQueryPlatformHeatmap(run: RealSurfaceTestRun, brandName: string, ownWebsite: string): QueryPlatformHeatmap {
  const ownHost = hostFrom(ownWebsite)
  const tasks = run.tasks ?? []
  const platforms = [...new Set(tasks.map((task) => task.platform))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const queryIds = [...new Set(tasks.map((task) => task.seedQueryId))]
  const queries = queryIds.map((queryId) => {
    const task = tasks.find((item) => item.seedQueryId === queryId)
    return { queryId, question: task?.question ?? '未命名 Query', intent: task?.intent ?? '未分类' }
  })
  const cells = queryIds.flatMap((queryId) => platforms.map((platform) => {
    const scope = tasks.filter((task) => task.seedQueryId === queryId && task.platform === platform)
    const evidence = evidenceTasks(scope)
    const mention = availableRate(evidence.filter((task) => matchesBrand(task.observation.rawAnswer, brandName)).length, evidence.length)
    const ownedCitation = availableRate(evidence.filter((task) => task.observation.citations.some((url) => isOwnedUrl(url, ownHost))).length, evidence.length)
    let state: QueryPlatformHeatmapCellState
    if (evidence.length) state = ownedCitation.numerator ? 'owned-citation' : mention.numerator ? 'mentioned' : 'not-mentioned'
    else if (scope.some((task) => task.state === 'submitted' || task.state === 'needs_revision')) state = 'pending-review'
    else if (scope.some((task) => task.state === 'failed')) state = 'failed'
    else if (scope.some((task) => task.state === 'skipped')) state = 'not-applicable'
    else state = 'not-collected'
    return { queryId, platform, state, expected: scope.length, reviewed: evidence.length, mention, ownedCitation }
  }))
  return { platforms, queries, cells }
}
