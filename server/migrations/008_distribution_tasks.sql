CREATE TABLE IF NOT EXISTS distribution_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_draft_id TEXT NOT NULL REFERENCES content_drafts(id),
  approved_snapshot_id TEXT NOT NULL REFERENCES approved_content_snapshots(id),
  owner_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  editorial_constraints_json TEXT NOT NULL,
  target_query_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('planned','in-progress','submitted','completed','blocked','cancelled')),
  scheduled_for TEXT NOT NULL,
  completed_at TEXT,
  proof_artifact_id TEXT REFERENCES artifact_records(id),
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, approved_snapshot_id, channel)
);
CREATE INDEX IF NOT EXISTS distribution_tasks_workspace_updated ON distribution_tasks(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS distribution_tasks_snapshot ON distribution_tasks(approved_snapshot_id);
