CREATE TABLE IF NOT EXISTS brand_diagnostic_cases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  website TEXT NOT NULL,
  markets_json TEXT NOT NULL,
  locales_json TEXT NOT NULL,
  audiences_json TEXT NOT NULL,
  objective TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  delivery_date TEXT,
  status TEXT NOT NULL CHECK(status IN ('draft','facts-pending','query-pending','plan-pending','waiting-collection','collecting','evidence-pending','baseline-complete','actions-ready','archived')),
  current_baseline_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brand_diagnostic_cases_workspace_updated ON brand_diagnostic_cases(workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS brand_diagnostic_facts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  category TEXT NOT NULL,
  applies_to_markets_json TEXT NOT NULL DEFAULT '[]',
  source_label TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL CHECK(status IN ('candidate','approved','rejected')),
  is_prohibited_claim INTEGER NOT NULL DEFAULT 0,
  review_note TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brand_diagnostic_facts_case_status ON brand_diagnostic_facts(case_id, status);

CREATE TABLE IF NOT EXISTS brand_diagnostic_query_scopes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL UNIQUE REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  journeys_json TEXT NOT NULL,
  query_types_json TEXT NOT NULL,
  markets_json TEXT NOT NULL,
  locales_json TEXT NOT NULL,
  competitor_seeds_json TEXT NOT NULL,
  expected_count INTEGER NOT NULL,
  dataset_version_label TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_diagnostic_collection_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL UNIQUE REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  providers_json TEXT NOT NULL,
  collection_mode TEXT NOT NULL CHECK(collection_mode IN ('controlled-manual','official-api','enterprise-gateway','mcp')),
  frequency TEXT NOT NULL,
  failure_policy TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('planned','collecting','imported','blocked','failed')),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_diagnostic_baselines (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(case_id, version)
);
CREATE INDEX IF NOT EXISTS brand_diagnostic_baselines_case_created ON brand_diagnostic_baselines(case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS brand_diagnostic_activities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  actor_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brand_diagnostic_activities_case_created ON brand_diagnostic_activities(case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS brand_diagnostic_recommendations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  rationale TEXT NOT NULL,
  evidence_state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brand_diagnostic_recommendations_case_created ON brand_diagnostic_recommendations(case_id, created_at DESC);
