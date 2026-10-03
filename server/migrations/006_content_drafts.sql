CREATE TABLE IF NOT EXISTS content_drafts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','needs-review','approved','rejected')),
  source_brief_id TEXT NOT NULL REFERENCES content_briefs(id),
  locale TEXT NOT NULL,
  channel TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('website-page','faq','use-case','comparison-page','case-study','editorial')),
  evidence_pack_id TEXT NOT NULL REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER NOT NULL,
  title TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  ai_invocation_id TEXT NOT NULL REFERENCES ai_invocations(id),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_comment TEXT,
  UNIQUE(workspace_id, logical_key, version)
);
CREATE INDEX IF NOT EXISTS content_drafts_workspace_created ON content_drafts(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_drafts_source_brief ON content_drafts(source_brief_id, created_at DESC);
