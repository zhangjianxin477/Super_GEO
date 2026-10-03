import { useCallback, useEffect, useState } from 'react'
import { ApiClientError, getDashboard, getDiagnosticSetup, getWorkspace, listMarketPacks, listResources, type ContentBrief, type ContentDraft, type Dashboard, type Dataset, type DiagnosticSetup, type DistributionTask, type MarketPack, type Report, type WorkspaceSession } from './api'

export type LiveWorkspaceState = {
  phase: 'idle' | 'loading' | 'ready' | 'setup' | 'empty' | 'error'
  isRefreshing: boolean
  workspace?: { id: string; name: string; brand: string }
  marketPacks: MarketPack[]
  selectedMarketPackId?: string
  selectedRunId?: string
  baselineRunId?: string
  dashboard?: Dashboard
  setup?: DiagnosticSetup
  resources?: { datasets: Dataset[]; briefs: ContentBrief[]; drafts: ContentDraft[]; tasks: DistributionTask[]; reports: Report[] }
  error?: string
}

export function useLiveWorkspace(session: WorkspaceSession | null) {
  const [state, setState] = useState<LiveWorkspaceState>({ phase: 'idle', isRefreshing: false, marketPacks: [] })
  const [selection, setSelection] = useState<{ marketPackId?: string; runId?: string; baselineRunId?: string }>({})
  const load = useCallback(async () => {
    if (!session) { setState({ phase: 'idle', isRefreshing: false, marketPacks: [] }); return }
    setState((current) => current.phase === 'ready'
      ? { ...current, isRefreshing: true, error: undefined }
      : { ...current, phase: 'loading', isRefreshing: false, error: undefined })
    try {
      const [workspaceResponse, setupResponse] = await Promise.all([getWorkspace(session), getDiagnosticSetup(session)])
      if (setupResponse.setup && setupResponse.setup.project.status !== 'collecting') {
        setState({ phase: 'setup', isRefreshing: false, workspace: workspaceResponse.workspace, marketPacks: setupResponse.setup.marketPacks, setup: setupResponse.setup })
        return
      }
      const [marketResponse, resourceResponses] = await Promise.all([listMarketPacks(session), listResources(session)])
      const [datasetsResponse, briefsResponse, draftsResponse, tasksResponse, reportsResponse] = resourceResponses
      const resources = { datasets: datasetsResponse.datasets, briefs: briefsResponse.briefs, drafts: draftsResponse.drafts, tasks: tasksResponse.tasks, reports: reportsResponse.reports }
      const marketPackId = selection.marketPackId && marketResponse.marketPacks.some((item) => item.id === selection.marketPackId) ? selection.marketPackId : marketResponse.marketPacks.find((item) => item.status === 'approved')?.id
      if (!marketPackId) { setState({ phase: 'empty', isRefreshing: false, workspace: workspaceResponse.workspace, marketPacks: [], resources }); return }
      const dashboardResponse = await getDashboard(session, marketPackId, { assessmentRunId: selection.runId, baselineRunId: selection.baselineRunId })
      setState({ phase: 'ready', isRefreshing: false, workspace: workspaceResponse.workspace, marketPacks: marketResponse.marketPacks, selectedMarketPackId: marketPackId, selectedRunId: dashboardResponse.dashboard.context.selectedRun?.id, baselineRunId: dashboardResponse.dashboard.context.baselineRun?.id, dashboard: dashboardResponse.dashboard, resources })
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : '加载工作区失败，请稍后重试。'
      setState((current) => current.phase === 'ready'
        ? { ...current, isRefreshing: false, error: message }
        : { ...current, phase: 'error', isRefreshing: false, error: message })
    }
  }, [session, selection.marketPackId, selection.runId, selection.baselineRunId])
  useEffect(() => { void load() }, [load])
  return { state, reload: load, selectMarketPack: (marketPackId: string) => setSelection({ marketPackId }), selectRun: (runId?: string) => setSelection((current) => ({ ...current, runId })), selectBaseline: (baselineRunId?: string) => setSelection((current) => ({ ...current, baselineRunId })) }
}
