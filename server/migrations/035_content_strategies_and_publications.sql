CREATE TABLE IF NOT EXISTS content_strategies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','needs-review','approved','rejected','executing','completed','archived')),
  diagnosis_id TEXT NOT NULL REFERENCES diagnoses(id),
  market_pack_id TEXT NOT NULL REFERENCES market_packs(id),
  evidence_pack_id TEXT NOT NULL REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER NOT NULL,
  query_ids_json TEXT NOT NULL,
  channels_json TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  strategy_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_comment TEXT,
  UNIQUE(workspace_id, logical_key, version)
);
CREATE INDEX IF NOT EXISTS content_strategies_workspace_created ON content_strategies(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_strategies_diagnosis ON content_strategies(workspace_id, diagnosis_id, status);

ALTER TABLE content_briefs ADD COLUMN content_strategy_id TEXT REFERENCES content_strategies(id);
CREATE INDEX IF NOT EXISTS content_briefs_strategy ON content_briefs(content_strategy_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_publications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  approved_snapshot_id TEXT NOT NULL REFERENCES approved_content_snapshots(id),
  content_draft_id TEXT NOT NULL REFERENCES content_drafts(id),
  content_brief_id TEXT NOT NULL REFERENCES content_briefs(id),
  content_strategy_id TEXT REFERENCES content_strategies(id),
  source_assessment_run_id TEXT NOT NULL REFERENCES assessment_runs(id),
  dataset_id TEXT NOT NULL REFERENCES query_datasets(id),
  channel TEXT NOT NULL,
  published_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  proof_artifact_id TEXT NOT NULL REFERENCES artifact_records(id),
  target_query_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('registered','retest-planned','archived')),
  retest_plan_json TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, approved_snapshot_id, published_url)
);
CREATE INDEX IF NOT EXISTS content_publications_workspace_created ON content_publications(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_publications_dataset ON content_publications(workspace_id, dataset_id, status);
