CREATE TABLE IF NOT EXISTS competitor_research_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  market_pack_id TEXT REFERENCES market_packs(id) ON DELETE SET NULL,
  source_ref TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('website','editorial','comparison-page','directory','manual')),
  adapter_id TEXT NOT NULL,
  collection_method TEXT NOT NULL CHECK(collection_method IN ('manual-import','approved-adapter')),
  access_policy TEXT NOT NULL CHECK(access_policy = 'permitted'),
  collected_at TEXT NOT NULL,
  collected_by TEXT NOT NULL,
  extraction_status TEXT NOT NULL CHECK(extraction_status IN ('captured','extracted','failed')),
  provenance_json TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS competitor_research_workspace_market_created ON competitor_research_records(workspace_id, market_pack_id, created_at DESC);
