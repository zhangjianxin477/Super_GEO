CREATE TABLE IF NOT EXISTS browser_agent_start_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES browser_agents(id) ON DELETE CASCADE,
  test_run_id TEXT NOT NULL REFERENCES real_surface_test_runs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  nonce_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('requested','acknowledged','launching-browser','waiting-login','running','completed','failed','cancelled','expired')),
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  acknowledged_at TEXT,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  failure_code TEXT,
  failure_reason TEXT,
  cancelled_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS browser_agent_start_requests_active ON browser_agent_start_requests(agent_id,status,expires_at DESC);
CREATE INDEX IF NOT EXISTS browser_agent_start_requests_run ON browser_agent_start_requests(workspace_id,test_run_id,platform,requested_at DESC);
