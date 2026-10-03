CREATE TABLE IF NOT EXISTS ai_invocations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  capability TEXT NOT NULL CHECK(capability IN ('answer-analysis','content-brief','content-draft','report-narrative')),
  provider_extension_id TEXT,
  model_identity TEXT,
  prompt_template_version TEXT NOT NULL,
  input_refs_json TEXT NOT NULL,
  output_refs_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK(status IN ('prepared','completed','failed','rejected')),
  human_review_required INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  failure_detail TEXT
);
CREATE INDEX IF NOT EXISTS ai_invocations_workspace_created ON ai_invocations(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_briefs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','needs-review','approved','rejected')),
  diagnosis_id TEXT NOT NULL REFERENCES diagnoses(id),
  market_pack_id TEXT NOT NULL REFERENCES market_packs(id),
  evidence_pack_id TEXT NOT NULL REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER NOT NULL,
  locale TEXT NOT NULL,
  channel TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('website-page','faq','use-case','comparison-page','case-study','editorial')),
  title TEXT NOT NULL,
  brief_json TEXT NOT NULL,
  ai_invocation_id TEXT NOT NULL REFERENCES ai_invocations(id),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_comment TEXT,
  UNIQUE(workspace_id, logical_key, version)
);
CREATE INDEX IF NOT EXISTS content_briefs_workspace_created ON content_briefs(workspace_id, created_at DESC);