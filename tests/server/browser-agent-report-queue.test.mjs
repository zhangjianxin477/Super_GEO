import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isReportAuthorized,
  isTerminalOwnershipError,
  queueReport,
  reportForRelay,
  splitReportsForCurrentTask,
} from '../../browser-agent/extension/reportQueue.js'

const batch = { active: true, taskId: 'task-current', testRunId: 'run-current', platform: '豆包' }

test('Browser Agent report queue keeps only the current authorized task', () => {
  const current = queueReport({ taskId: 'task-current', testRunId: 'run-current', status: 'completed', evidence: { rawAnswer: 'visible answer' } }, batch)
  const stale = { taskId: 'task-old', status: 'completed', evidence: { rawAnswer: 'old answer' } }
  const result = splitReportsForCurrentTask([stale, current], batch)
  assert.deepEqual(result.accepted, [current])
  assert.deepEqual(result.discarded, [stale])
  assert.equal(isReportAuthorized(current, batch), true)
  assert.equal(isReportAuthorized(stale, batch), false)
  assert.deepEqual(reportForRelay(current), { taskId: 'task-current', status: 'completed', evidence: { rawAnswer: 'visible answer' } })
})

test('Browser Agent ownership conflict is terminal instead of retryable', () => {
  assert.equal(isTerminalOwnershipError('该任务不是当前由本地 Agent 持有的任务。'), true)
  assert.equal(isTerminalOwnershipError('服务器请求超时（15 秒）'), false)
})
