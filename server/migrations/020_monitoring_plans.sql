CREATE TABLE IF NOT EXISTS monitoring_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  market_pack_id TEXT NOT NULL REFERENCES market_packs(id) ON DELETE CASCADE,
  dataset_id TEXT NOT NULL REFERENCES query_datasets(id) ON DELETE RESTRICT,
  query_id TEXT NOT NULL REFERENCES query_items(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  provider_ids_json TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK(cadence IN ('daily','weekly')),
  status TEXT NOT NULL CHECK(status IN ('active','paused','archived')),
  last_assessment_run_id TEXT REFERENCES assessment_runs(id) ON DELETE SET NULL,
  last_checked_at TEXT,
  next_check_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, market_pack_id, query_id)
);
CREATE INDEX IF NOT EXISTS monitoring_plans_workspace_market ON monitoring_plans(workspace_id, market_pack_id, status, updated_at DESC);
