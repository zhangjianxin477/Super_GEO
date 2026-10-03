CREATE TABLE IF NOT EXISTS geo_gap_actions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  query_group_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL REFERENCES competitor_evidence_analyses(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')),
  status TEXT NOT NULL CHECK(status IN ('draft','in-progress','completed','dismissed')),
  action_type TEXT NOT NULL CHECK(action_type IN ('improve-owned-page','create-comparison-page','create-faq','create-case-study','source-research')),
  title TEXT NOT NULL,
  gap_summary TEXT NOT NULL,
  evidence_snapshot_json TEXT NOT NULL DEFAULT '{}',
  recommendation_json TEXT NOT NULL DEFAULT '{}',
  limitations_json TEXT NOT NULL DEFAULT '[]',
  content_brief_json TEXT,
  content_brief_created_at TEXT,
  retest_plan_json TEXT,
  retest_plan_created_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  UNIQUE(workspace_id, analysis_id, action_key)
);
CREATE INDEX IF NOT EXISTS geo_gap_actions_query_group ON geo_gap_actions(workspace_id, query_group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS geo_gap_actions_status ON geo_gap_actions(workspace_id, status, updated_at DESC);
