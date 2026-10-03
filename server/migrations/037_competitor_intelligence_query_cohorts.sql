ALTER TABLE competitor_evidence_analyses RENAME TO competitor_evidence_analyses_legacy;

CREATE TABLE competitor_evidence_analyses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES competitor_intelligence_profiles(id) ON DELETE CASCADE,
  observation_id TEXT NOT NULL REFERENCES real_surface_observations(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'single-observation' CHECK(scope_type IN ('single-observation','baseline-cohort','query-cohort')),
  test_run_id TEXT REFERENCES real_surface_test_runs(id) ON DELETE SET NULL,
  observation_ids_json TEXT NOT NULL DEFAULT '[]',
  evidence_summary_json TEXT NOT NULL DEFAULT '{}',
  agent_type TEXT NOT NULL CHECK(agent_type IN ('answer-extraction','link-classification','page-structure','insight-synthesis')),
  state TEXT NOT NULL CHECK(state IN ('running','succeeded','failed')),
  prompt_id TEXT REFERENCES competitor_analysis_prompt_versions(id) ON DELETE SET NULL,
  prompt_version INTEGER,
  provider_configuration_id TEXT REFERENCES model_provider_configurations(id) ON DELETE SET NULL,
  model_name TEXT,
  input_hash TEXT NOT NULL,
  result_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_by TEXT NOT NULL
);

INSERT INTO competitor_evidence_analyses (
  id, workspace_id, profile_id, observation_id, scope_type, test_run_id, observation_ids_json, evidence_summary_json,
  agent_type, state, prompt_id, prompt_version, provider_configuration_id, model_name, input_hash, result_json,
  error_message, started_at, completed_at, created_by
)
SELECT
  id, workspace_id, profile_id, observation_id, scope_type, test_run_id, observation_ids_json, evidence_summary_json,
  agent_type, state, prompt_id, prompt_version, provider_configuration_id, model_name, input_hash, result_json,
  error_message, started_at, completed_at, created_by
FROM competitor_evidence_analyses_legacy;

DROP TABLE competitor_evidence_analyses_legacy;

CREATE INDEX IF NOT EXISTS competitor_evidence_analyses_profile_observation ON competitor_evidence_analyses(workspace_id,profile_id,observation_id,started_at DESC);
CREATE INDEX IF NOT EXISTS competitor_evidence_analyses_profile_scope ON competitor_evidence_analyses(workspace_id,profile_id,scope_type,test_run_id,started_at DESC);
