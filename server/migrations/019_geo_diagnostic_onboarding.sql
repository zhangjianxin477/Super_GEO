CREATE TABLE IF NOT EXISTS geo_diagnostic_projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  website TEXT NOT NULL,
  industry TEXT NOT NULL,
  audience TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','ready-for-review','collecting','completed','archived')),
  markets_json TEXT NOT NULL,
  competitors_json TEXT NOT NULL DEFAULT '[]',
  primary_evidence_pack_id TEXT NOT NULL REFERENCES evidence_packs(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS geo_diagnostic_projects_workspace_updated ON geo_diagnostic_projects(workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS collection_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES geo_diagnostic_projects(id) ON DELETE CASCADE,
  market_pack_id TEXT NOT NULL REFERENCES market_packs(id) ON DELETE CASCADE,
  dataset_id TEXT NOT NULL REFERENCES query_datasets(id) ON DELETE RESTRICT,
  assessment_run_id TEXT REFERENCES assessment_runs(id) ON DELETE SET NULL,
  provider_id TEXT NOT NULL,
  collection_mode TEXT NOT NULL CHECK(collection_mode IN ('controlled-manual')),
  status TEXT NOT NULL CHECK(status IN ('planned','collecting','imported','blocked','failed')),
  instructions TEXT NOT NULL,
  due_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(project_id, market_pack_id, provider_id)
);
CREATE INDEX IF NOT EXISTS collection_plans_workspace_project ON collection_plans(workspace_id, project_id, status);
CREATE INDEX IF NOT EXISTS collection_plans_run_provider ON collection_plans(assessment_run_id, provider_id);