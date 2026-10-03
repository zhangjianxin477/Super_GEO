CREATE TABLE IF NOT EXISTS evidence_sync_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK(source_type IN ('corenote','website','manual')),
  source_system TEXT NOT NULL,
  collection_mode TEXT NOT NULL CHECK(collection_mode IN ('controlled-manual')),
  status TEXT NOT NULL CHECK(status IN ('succeeded','failed','not-configured')),
  evidence_pack_id TEXT REFERENCES evidence_packs(id) ON DELETE SET NULL,
  last_approved_evidence_pack_id TEXT REFERENCES evidence_packs(id) ON DELETE SET NULL,
  occurred_at TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS evidence_sync_events_workspace_source_at ON evidence_sync_events(workspace_id, source_type, source_system, occurred_at DESC);

ALTER TABLE evidence_packs ADD COLUMN reviewed_at TEXT;
ALTER TABLE evidence_packs ADD COLUMN reviewed_by TEXT;
ALTER TABLE evidence_packs ADD COLUMN review_comment TEXT;
ALTER TABLE evidence_packs ADD COLUMN review_outcome TEXT CHECK(review_outcome IN ('approved','rejected'));