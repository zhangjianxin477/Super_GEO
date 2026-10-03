CREATE TABLE IF NOT EXISTS browser_agents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','online','needs_login','attention','revoked','offline')),
  platforms_json TEXT NOT NULL,
  adapters_json TEXT NOT NULL,
  token_hash TEXT,
  enrolled_at TEXT,
  last_seen_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS browser_agents_workspace_status ON browser_agents(workspace_id,status,last_seen_at DESC);

CREATE TABLE IF NOT EXISTS browser_agent_enrollments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES browser_agents(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS browser_agent_enrollments_agent ON browser_agent_enrollments(agent_id,expires_at);

ALTER TABLE real_surface_test_runs ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'controlled-manual';
ALTER TABLE real_surface_test_runs ADD COLUMN browser_agent_id TEXT REFERENCES browser_agents(id) ON DELETE SET NULL;
ALTER TABLE real_surface_test_runs ADD COLUMN browser_adapter_snapshot_json TEXT;
ALTER TABLE real_surface_collection_tasks ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'controlled-manual';
ALTER TABLE real_surface_collection_tasks ADD COLUMN browser_agent_id TEXT REFERENCES browser_agents(id) ON DELETE SET NULL;
ALTER TABLE real_surface_collection_tasks ADD COLUMN agent_state TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE real_surface_collection_tasks ADD COLUMN agent_state_reason TEXT;
ALTER TABLE real_surface_collection_tasks ADD COLUMN adapter_id TEXT;
ALTER TABLE real_surface_collection_tasks ADD COLUMN adapter_version TEXT;
ALTER TABLE real_surface_observations ADD COLUMN collection_method TEXT NOT NULL DEFAULT 'controlled-manual';
ALTER TABLE real_surface_observations ADD COLUMN browser_agent_id TEXT REFERENCES browser_agents(id) ON DELETE SET NULL;
ALTER TABLE real_surface_observations ADD COLUMN adapter_id TEXT;
ALTER TABLE real_surface_observations ADD COLUMN adapter_version TEXT;
ALTER TABLE real_surface_observations ADD COLUMN evidence_hash TEXT;
ALTER TABLE real_surface_observations ADD COLUMN capture_metadata_json TEXT;
