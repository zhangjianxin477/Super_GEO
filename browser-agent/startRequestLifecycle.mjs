const PROGRESS = Object.freeze({
  requested: 0,
  acknowledged: 1,
  'launching-browser': 2,
  'waiting-login': 3,
  running: 4,
  completed: 5,
  failed: 5,
  cancelled: 5,
  expired: 5,
})

export function startRequestProgress(status) {
  return PROGRESS[status] ?? -1
}

export function preserveForwardStartRequest(previous, incoming) {
  if (!previous || previous.id !== incoming?.id) return incoming
  // A visible page can lose its authenticated session after a local relay/browser
  // restart. This is not a stale lower-progress acknowledgement: it is a real,
  // same-request transition back to operator login. Preserve terminal states, but
  // never hide the recovery state from the operator.
  if (previous.status === 'running' && incoming.status === 'waiting-login') return incoming
  return startRequestProgress(previous.status) > startRequestProgress(incoming.status) ? previous : incoming
}

export function startRequestLaunchPlan(status, { launched = false } = {}) {
  if (status === 'requested') return { advance: ['acknowledged', 'launching-browser'], launch: !launched }
  if (status === 'acknowledged') return { advance: ['launching-browser'], launch: !launched }
  if (status === 'launching-browser') return { advance: [], launch: !launched }
  // The local relay can restart while the SaaS still holds a valid waiting-login or
  // running authorization. Re-open only this platform's isolated profile once so the
  // extension can recover its page-ready handshake; do not silently abandon the lane.
  if (status === 'waiting-login' || status === 'running') return { advance: [], launch: !launched }
  return { advance: [], launch: false }
}
