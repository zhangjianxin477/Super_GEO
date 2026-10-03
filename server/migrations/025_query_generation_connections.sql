CREATE TABLE IF NOT EXISTS model_provider_execution_settings (
  provider_configuration_id TEXT PRIMARY KEY REFERENCES model_provider_configurations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  model_name TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS model_provider_execution_settings_workspace ON model_provider_execution_settings(workspace_id, provider_configuration_id);

CREATE TABLE IF NOT EXISTS query_generation_prompts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  UNIQUE(workspace_id, name, version)
);
CREATE INDEX IF NOT EXISTS query_generation_prompts_active ON query_generation_prompts(workspace_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS baseline_query_generation_invocations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  query_set_id TEXT REFERENCES baseline_query_sets(id) ON DELETE SET NULL,
  prompt_id TEXT REFERENCES query_generation_prompts(id) ON DELETE SET NULL,
  prompt_version INTEGER,
  provider_configuration_id TEXT REFERENCES model_provider_configurations(id) ON DELETE SET NULL,
  generator_mode TEXT NOT NULL CHECK(generator_mode IN ('llm-assisted','template')),
  rendered_prompt TEXT NOT NULL,
  input_json TEXT NOT NULL,
  response_summary_json TEXT,
  status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS baseline_query_generation_invocations_scope ON baseline_query_generation_invocations(workspace_id, case_id, created_at DESC);
