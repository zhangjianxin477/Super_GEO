CREATE TABLE IF NOT EXISTS workspace_configuration_versions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  brand_names_json TEXT NOT NULL DEFAULT '[]',
  products_json TEXT NOT NULL DEFAULT '[]',
  customer_segments_json TEXT NOT NULL DEFAULT '[]',
  operating_markets_json TEXT NOT NULL DEFAULT '[]',
  locales_json TEXT NOT NULL DEFAULT '[]',
  approved_websites_json TEXT NOT NULL DEFAULT '[]',
  competitors_json TEXT NOT NULL DEFAULT '[]',
  approved_claims_json TEXT NOT NULL DEFAULT '[]',
  prohibited_claims_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, version)
);
CREATE INDEX IF NOT EXISTS workspace_configuration_versions_workspace_created ON workspace_configuration_versions(workspace_id, created_at DESC);