-- Immutable artifact metadata makes raw evidence tenant-scoped and auditable.
CREATE TABLE IF NOT EXISTS artifact_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(workspace_id, storage_key)
);
CREATE INDEX IF NOT EXISTS artifact_records_workspace_created ON artifact_records(workspace_id, created_at DESC);

-- Extension identifiers are workspace-local. Retain existing records while removing
-- the accidental global uniqueness created in the initial MVP schema.
ALTER TABLE extensions RENAME TO extensions_legacy;
CREATE TABLE extensions (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  descriptor_json TEXT NOT NULL,
  configured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, id)
);
INSERT INTO extensions (id, workspace_id, descriptor_json, configured, created_at)
SELECT id, workspace_id, descriptor_json, configured, created_at FROM extensions_legacy;
DROP TABLE extensions_legacy;
CREATE INDEX IF NOT EXISTS extensions_workspace_created ON extensions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS extension_executions_workspace_created ON extension_executions(workspace_id, created_at DESC);