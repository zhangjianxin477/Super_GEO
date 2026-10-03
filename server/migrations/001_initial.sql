CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  products_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('administrator','analyst','reviewer','viewer')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('allowed','denied','info')),
  detail TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_events_workspace_at ON audit_events(workspace_id, at DESC);

CREATE TABLE IF NOT EXISTS evidence_packs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','approved','superseded')),
  created_at TEXT NOT NULL,
  approved_at TEXT,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, version)
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY,
  evidence_pack_id TEXT NOT NULL REFERENCES evidence_packs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  taxonomy TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('corenote','website','manual')),
  source_ref TEXT NOT NULL,
  import_status TEXT NOT NULL DEFAULT 'approved',
  artifact_key TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS query_datasets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  label TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','approved','retired','superseded')),
  created_at TEXT NOT NULL,
  approved_at TEXT,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, logical_key, version)
);

CREATE TABLE IF NOT EXISTS query_items (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES query_datasets(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  market TEXT NOT NULL CHECK(market IN ('CN','GLOBAL')),
  locale TEXT NOT NULL,
  language TEXT NOT NULL,
  user_role TEXT NOT NULL,
  business_stage TEXT NOT NULL,
  intent TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('P0','P1','P2')),
  target_product TEXT NOT NULL,
  expected_facts_json TEXT NOT NULL DEFAULT '[]',
  risk_metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS assessment_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  dataset_id TEXT NOT NULL REFERENCES query_datasets(id),
  dataset_version INTEGER NOT NULL,
  market_pack_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  provider_snapshot_json TEXT NOT NULL,
  cohort_query_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','partial','completed')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extensions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  descriptor_json TEXT NOT NULL,
  configured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS extension_executions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  extension_id TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  input_refs_json TEXT NOT NULL,
  output_refs_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('started','completed','rejected','failed')),
  created_at TEXT NOT NULL,
  detail TEXT NOT NULL
);
