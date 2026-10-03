CREATE TABLE IF NOT EXISTS observation_analyses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  observation_id TEXT NOT NULL REFERENCES assessment_observations(id) ON DELETE CASCADE,
  evidence_pack_id TEXT NOT NULL REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER NOT NULL,
  analyzer_version TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(observation_id, evidence_pack_id, evidence_pack_version, analyzer_version)
);
CREATE INDEX IF NOT EXISTS observation_analyses_observation_created ON observation_analyses(observation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS diagnoses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  assessment_run_id TEXT NOT NULL REFERENCES assessment_runs(id) ON DELETE CASCADE,
  evidence_pack_id TEXT NOT NULL REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER NOT NULL,
  title TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('P0','P1','P2')),
  category TEXT NOT NULL CHECK(category IN ('coverage','evidence','citation','accuracy','competitive')),
  confidence TEXT NOT NULL CHECK(confidence IN ('high','medium','low')),
  detail TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  uncertainty TEXT NOT NULL,
  query_ids_json TEXT NOT NULL,
  observation_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS diagnoses_run_created ON diagnoses(assessment_run_id, created_at DESC);