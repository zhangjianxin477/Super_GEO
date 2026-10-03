CREATE TABLE IF NOT EXISTS content_prompt_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  tone TEXT NOT NULL,
  channel_guidance TEXT NOT NULL,
  system_instruction TEXT NOT NULL,
  output_contract TEXT NOT NULL,
  channel_tags_json TEXT NOT NULL DEFAULT '[]',
  content_type_tags_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS content_prompt_profiles_workspace_active ON content_prompt_profiles(workspace_id, status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS content_prompt_profiles_workspace_name_active ON content_prompt_profiles(workspace_id, lower(name)) WHERE status = 'active';
