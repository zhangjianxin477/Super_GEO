CREATE TABLE IF NOT EXISTS draft_claim_validations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_draft_id TEXT NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK(claim_type IN ('measurable-performance','guarantee','ranking-or-citation')),
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK(status IN ('unresolved','supported','rejected')),
  detector_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT,
  resolution_comment TEXT
);
CREATE INDEX IF NOT EXISTS draft_claim_validations_draft_status ON draft_claim_validations(content_draft_id, status);

CREATE TABLE IF NOT EXISTS approved_content_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_draft_id TEXT NOT NULL REFERENCES content_drafts(id),
  draft_version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  claim_validations_json TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  review_comment TEXT NOT NULL,
  UNIQUE(content_draft_id, draft_version)
);
CREATE INDEX IF NOT EXISTS approved_content_snapshots_workspace_created ON approved_content_snapshots(workspace_id, approved_at DESC);
