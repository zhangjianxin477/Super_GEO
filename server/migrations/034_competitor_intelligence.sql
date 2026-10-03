CREATE TABLE IF NOT EXISTS competitor_intelligence_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  self_brand_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  product_category TEXT NOT NULL,
  market TEXT NOT NULL,
  audiences_json TEXT NOT NULL DEFAULT '[]',
  competitors_json TEXT NOT NULL DEFAULT '[]',
  dimensions_json TEXT NOT NULL DEFAULT '[]',
  rules_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK(status IN ('active','archived')) DEFAULT 'active',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS competitor_intelligence_profiles_workspace_status ON competitor_intelligence_profiles(workspace_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS competitor_analysis_prompt_versions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES competitor_intelligence_profiles(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK(agent_type IN ('answer-extraction','link-classification','page-structure','insight-synthesis')),
  name TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','archived')) DEFAULT 'active',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  UNIQUE(profile_id,agent_type,version)
);
CREATE INDEX IF NOT EXISTS competitor_analysis_prompts_active ON competitor_analysis_prompt_versions(workspace_id,profile_id,agent_type,status,version DESC);

CREATE TABLE IF NOT EXISTS competitor_evidence_analyses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES competitor_intelligence_profiles(id) ON DELETE CASCADE,
  observation_id TEXT NOT NULL REFERENCES real_surface_observations(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS competitor_evidence_analyses_profile_observation ON competitor_evidence_analyses(workspace_id,profile_id,observation_id,started_at DESC);