CREATE TABLE IF NOT EXISTS model_provider_configurations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  market TEXT NOT NULL CHECK(market IN ('CN','GLOBAL')),
  locale TEXT NOT NULL,
  collection_mode TEXT NOT NULL CHECK(collection_mode IN ('controlled-manual')),
  credential_reference TEXT,
  status TEXT NOT NULL CHECK(status IN ('configured','disabled')),
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, provider_id, market, locale)
);
CREATE INDEX IF NOT EXISTS model_provider_configurations_workspace ON model_provider_configurations(workspace_id, market, locale, status);
