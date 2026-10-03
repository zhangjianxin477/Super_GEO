ALTER TABLE model_provider_configurations RENAME TO model_provider_configurations_legacy;
CREATE TABLE model_provider_configurations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  market TEXT NOT NULL CHECK(market IN ('CN','GLOBAL')),
  locale TEXT NOT NULL,
  collection_mode TEXT NOT NULL CHECK(collection_mode IN ('controlled-manual','official-api','enterprise-gateway','mcp')),
  credential_reference TEXT,
  status TEXT NOT NULL CHECK(status IN ('configured','disabled')),
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, provider_id, market, locale)
);
INSERT INTO model_provider_configurations (id, workspace_id, provider_id, market, locale, collection_mode, credential_reference, status, version, created_at, updated_at, created_by)
SELECT id, workspace_id, provider_id, market, locale, collection_mode, credential_reference, status, version, created_at, updated_at, created_by FROM model_provider_configurations_legacy;
DROP TABLE model_provider_configurations_legacy;
CREATE INDEX IF NOT EXISTS model_provider_configurations_workspace ON model_provider_configurations(workspace_id, market, locale, status);
CREATE TABLE IF NOT EXISTS model_provider_credentials (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_configuration_id TEXT NOT NULL REFERENCES model_provider_configurations(id) ON DELETE CASCADE,
  encryption_version TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  last_four TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, provider_configuration_id)
);
CREATE INDEX IF NOT EXISTS model_provider_credentials_workspace ON model_provider_credentials(workspace_id, provider_configuration_id);