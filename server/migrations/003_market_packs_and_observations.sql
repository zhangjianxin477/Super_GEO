CREATE TABLE IF NOT EXISTS market_packs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  label TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','approved','retired','superseded')),
  market TEXT NOT NULL CHECK(market IN ('CN','GLOBAL')),
  locale TEXT NOT NULL,
  audience TEXT NOT NULL,
  competitor_names_json TEXT NOT NULL DEFAULT '[]',
  provider_ids_json TEXT NOT NULL DEFAULT '[]',
  channel_names_json TEXT NOT NULL DEFAULT '[]',
  evidence_pack_id TEXT NOT NULL REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, logical_key, version)
);
CREATE INDEX IF NOT EXISTS market_packs_workspace_created ON market_packs(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assessment_observations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  assessment_run_id TEXT NOT NULL REFERENCES assessment_runs(id) ON DELETE CASCADE,
  query_id TEXT NOT NULL REFERENCES query_items(id),
  provider_id TEXT NOT NULL,
  provider_kind TEXT NOT NULL CHECK(provider_kind IN ('direct','imported')),
  model_identity TEXT,
  locale TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','completed','failed','imported')),
  executed_at TEXT,
  collected_at TEXT,
  collector_id TEXT,
  source_ref TEXT,
  raw_artifact_id TEXT REFERENCES artifact_records(id),
  supporting_artifact_id TEXT REFERENCES artifact_records(id),
  citations_json TEXT NOT NULL DEFAULT '[]',
  analysis_json TEXT NOT NULL DEFAULT '{}',
  error_details TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(assessment_run_id, query_id, provider_id)
);
CREATE INDEX IF NOT EXISTS assessment_observations_run_status ON assessment_observations(assessment_run_id, status);
CREATE INDEX IF NOT EXISTS assessment_observations_workspace_created ON assessment_observations(workspace_id, created_at DESC);