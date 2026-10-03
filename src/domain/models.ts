export type Role = 'administrator' | 'analyst' | 'reviewer' | 'viewer'
export type MarketCode = 'CN' | 'GLOBAL'
export type EvidenceStatus = 'draft' | 'approved' | 'superseded'
export type DatasetStatus = 'draft' | 'approved' | 'retired' | 'superseded'
export type ObservationStatus = 'completed' | 'failed' | 'imported' | 'queued'
export type ContentStatus = 'draft' | 'needs-review' | 'approved' | 'rejected'
export type Priority = 'P0' | 'P1' | 'P2'

export interface User {
  id: string
  name: string
  role: Role
  workspaceId: string
}

export interface AuditEvent {
  id: string
  at: string
  actor: string
  action: string
  target: string
  outcome: 'allowed' | 'denied' | 'info'
  detail: string
}

export interface EvidenceItem {
  id: string
  title: string
  excerpt: string
  taxonomy: 'brand-identity' | 'product-capability' | 'customer-segment' | 'use-case' | 'case-study' | 'policy' | 'comparison' | 'prohibited-claim'
  sourceType: 'corenote' | 'website' | 'manual'
  sourceRef: string
  status: EvidenceStatus
  version: number
  lastSyncedAt: string
}

export interface Claim {
  id: string
  statement: string
  evidenceIds: string[]
  state: 'approved' | 'prohibited'
}

export interface MarketPack {
  id: string
  label: string
  market: MarketCode
  locale: string
  audience: string
  providers: string[]
  channels: string[]
  competitors: string[]
}

export interface Query {
  id: string
  text: string
  market: MarketCode
  locale: string
  intent: 'category-discovery' | 'scenario' | 'comparison' | 'alternative' | 'brand' | 'procurement'
  stage: 'discover' | 'evaluate' | 'select'
  priority: Priority
  expectedFact: string
}

export interface QueryDataset {
  id: string
  label: string
  version: number
  status: DatasetStatus
  queries: Query[]
  approvedAt?: string
}

export interface Citation {
  url: string
  domain: string
  kind: 'owned' | 'third-party' | 'unknown'
}

export interface Observation {
  id: string
  queryId: string
  provider: string
  providerKind: 'direct' | 'imported'
  model: string
  status: ObservationStatus
  executedAt: string
  answer: string
  citations: Citation[]
  brandMentioned: boolean
  recommended: boolean
  recommendationPosition?: number
  competitorsMentioned: string[]
  claims: Array<{ statement: string; assessment: 'supported' | 'unsupported' | 'conflicting' | 'insufficient-evidence' }>
  risk: 'none' | 'medium' | 'high'
}

export interface AssessmentRun {
  id: string
  label: string
  datasetId: string
  datasetVersion: number
  marketPackId: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'completed' | 'partial'
  observations: Observation[]
}

export interface Diagnosis {
  id: string
  title: string
  priority: Priority
  category: 'coverage' | 'evidence' | 'citation' | 'accuracy' | 'competitive'
  confidence: 'high' | 'medium' | 'low'
  detail: string
  recommendation: string
  linkedQueryIds: string[]
}

export interface ContentBrief {
  id: string
  title: string
  market: MarketCode
  locale: string
  channel: string
  contentType: 'faq' | 'use-case' | 'comparison-page' | 'case-study' | 'editorial'
  status: ContentStatus
  diagnosisId: string
  evidenceIds: string[]
  prohibitedClaims: string[]
  targetQueryIds: string[]
  updatedAt: string
}

export interface DistributionAction {
  id: string
  title: string
  channel: string
  owner: string
  status: 'planned' | 'in-review' | 'completed'
  date: string
  proofRef?: string
  targetQueryIds: string[]
}

export interface Workspace {
  id: string
  name: string
  brand: string
  products: string[]
  markets: MarketPack[]
  evidence: EvidenceItem[]
  claims: Claim[]
  datasets: QueryDataset[]
  runs: AssessmentRun[]
  diagnoses: Diagnosis[]
  briefs: ContentBrief[]
  actions: DistributionAction[]
  audit: AuditEvent[]
}

export interface ExtensionDescriptor {
  id: string
  type: 'evidence-source' | 'model-provider' | 'answer-importer' | 'analysis-skill' | 'content-skill' | 'workflow-action' | 'report-renderer'
  label: string
  inputs: string[]
  outputs: string[]
  requiredRole: Role
  locales: string[]
  configured: boolean
  failureBehavior: string
}
