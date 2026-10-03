CREATE TABLE IF NOT EXISTS geo_reports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  title TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','generated','delivered','superseded')),
  baseline_run_id TEXT REFERENCES assessment_runs(id),
  follow_up_run_id TEXT REFERENCES assessment_runs(id),
  dataset_id TEXT REFERENCES query_datasets(id),
  dataset_version INTEGER,
  evidence_pack_id TEXT REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER,
  action_ids_json TEXT NOT NULL DEFAULT '[]',
  report_json TEXT NOT NULL DEFAULT '{}',
  limitations_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  generated_at TEXT,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, logical_key, version)
);
CREATE INDEX IF NOT EXISTS geo_reports_workspace_created ON geo_reports(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS geo_reports_baseline_follow_up ON geo_reports(baseline_run_id, follow_up_run_id);
