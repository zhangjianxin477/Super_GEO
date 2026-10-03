export function normalizeAuthorizedBatch(value) {
  if (!value?.active || typeof value.taskId !== 'string' || !value.taskId.trim()) return null
  return {
    active: true,
    platform: typeof value.platform === 'string' && value.platform ? value.platform : '豆包',
    taskId: value.taskId.trim(),
    testRunId: typeof value.testRunId === 'string' && value.testRunId.trim() ? value.testRunId.trim() : null,
    startedAt: typeof value.startedAt === 'string' && value.startedAt ? value.startedAt : new Date().toISOString(),
  }
}

export function reportIdentity(payload) {
  return `${String(payload?.taskId || '')}:${String(payload?.status || '')}`
}

export function queueReport(payload, batch) {
  const { testRunId, ...report } = payload || {}
  return {
    ...report,
    batch: {
      taskId: String(report.taskId || '').trim(),
      testRunId: typeof testRunId === 'string' && testRunId.trim()
        ? testRunId.trim()
        : (batch?.testRunId || null),
      queuedAt: new Date().toISOString(),
    },
  }
}

export function isReportAuthorized(report, batch) {
  if (!batch?.taskId || !report?.taskId || report.taskId !== batch.taskId) return false
  const reportRunId = report?.batch?.testRunId || null
  return !batch.testRunId || !reportRunId || reportRunId === batch.testRunId
}

export function reportForRelay(report) {
  if (!report || typeof report !== 'object') return report
  const { batch: _batch, ...payload } = report
  return payload
}

export function splitReportsForCurrentTask(queue, batch) {
  const accepted = []
  const discarded = []
  for (const report of Array.isArray(queue) ? queue : []) {
    if (isReportAuthorized(report, batch)) accepted.push(report)
    else discarded.push(report)
  }
  return { accepted, discarded }
}

export function isTerminalOwnershipError(message) {
  return /该任务不是当前由本地\s*Agent\s*持有的任务|not\s+the\s+current\s+task\s+held\s+by\s+the\s+local\s+agent/i.test(String(message || ''))
}
