CREATE TABLE IF NOT EXISTS assessment_baselines (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  assessment_run_id TEXT NOT NULL REFERENCES assessment_runs(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, logical_key),
  UNIQUE(assessment_run_id)
);
CREATE INDEX IF NOT EXISTS assessment_baselines_workspace_created ON assessment_baselines(workspace_id, created_at DESC);
