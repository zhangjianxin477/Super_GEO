CREATE TABLE IF NOT EXISTS brand_diagnostic_briefs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL UNIQUE REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  goal TEXT NOT NULL,
  category TEXT NOT NULL,
  market_packs_json TEXT NOT NULL,
  intents_json TEXT NOT NULL,
  evidence_urls_json TEXT NOT NULL,
  competitors_json TEXT NOT NULL,
  execution_preference TEXT NOT NULL CHECK(execution_preference IN ('ai-assisted','controlled-manual')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS brand_diagnostic_launch_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  brief_version INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('ready','manual-ready','configuration-required','superseded')),
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(case_id, brief_version)
);
CREATE INDEX IF NOT EXISTS brand_diagnostic_launch_plans_case_created ON brand_diagnostic_launch_plans(case_id, created_at DESC);
