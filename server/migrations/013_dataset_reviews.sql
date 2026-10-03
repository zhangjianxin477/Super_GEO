CREATE TABLE IF NOT EXISTS dataset_reviews (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dataset_id TEXT NOT NULL REFERENCES query_datasets(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK(decision IN ('approved','retired')),
  checklist_version TEXT,
  checklist_reference TEXT,
  checklist_json TEXT NOT NULL DEFAULT '{}',
  review_notes TEXT,
  reviewed_at TEXT NOT NULL,
  reviewed_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS dataset_reviews_workspace_dataset ON dataset_reviews(workspace_id, dataset_id, reviewed_at DESC);
