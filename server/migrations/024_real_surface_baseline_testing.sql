CREATE TABLE IF NOT EXISTS baseline_query_sets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  market_pack TEXT NOT NULL CHECK(market_pack IN ('CN','US')),
  locale TEXT NOT NULL,
  generation_mode TEXT NOT NULL CHECK(generation_mode IN ('template','llm-assisted')),
  status TEXT NOT NULL CHECK(status IN ('draft','approved','superseded')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS baseline_query_sets_workspace_case ON baseline_query_sets(workspace_id, case_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS baseline_seed_queries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  query_set_id TEXT NOT NULL REFERENCES baseline_query_sets(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  question TEXT NOT NULL,
  intent TEXT NOT NULL,
  rationale TEXT NOT NULL,
  market TEXT NOT NULL,
  locale TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')),
  status TEXT NOT NULL CHECK(status IN ('draft','approved','excluded')),
  provenance TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(query_set_id, sequence)
);
CREATE INDEX IF NOT EXISTS baseline_seed_queries_set ON baseline_seed_queries(workspace_id, query_set_id, sequence);

CREATE TABLE IF NOT EXISTS real_surface_test_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  query_set_id TEXT NOT NULL REFERENCES baseline_query_sets(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  market_pack TEXT NOT NULL CHECK(market_pack IN ('CN','US')),
  locale TEXT NOT NULL,
  collection_mode TEXT NOT NULL CHECK(collection_mode = 'controlled-manual'),
  state TEXT NOT NULL CHECK(state IN ('draft','active','collecting','ready_for_review','baseline_ready','closed')),
  request_key TEXT,
  instructions TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  UNIQUE(workspace_id, request_key)
);
CREATE INDEX IF NOT EXISTS real_surface_test_runs_workspace_case ON real_surface_test_runs(workspace_id, case_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS real_surface_collection_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  test_run_id TEXT NOT NULL REFERENCES real_surface_test_runs(id) ON DELETE CASCADE,
  seed_query_id TEXT NOT NULL REFERENCES baseline_seed_queries(id) ON DELETE RESTRICT,
  platform TEXT NOT NULL,
  provider_family TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('unassigned','claimed','submitted','needs_revision','reviewed','failed','skipped')),
  operator_id TEXT,
  claimed_at TEXT,
  submitted_at TEXT,
  failure_reason TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(test_run_id, seed_query_id, platform)
);
CREATE INDEX IF NOT EXISTS real_surface_collection_tasks_run_state ON real_surface_collection_tasks(workspace_id, test_run_id, state);

CREATE TABLE IF NOT EXISTS real_surface_observations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL UNIQUE REFERENCES real_surface_collection_tasks(id) ON DELETE CASCADE,
  raw_answer TEXT NOT NULL,
  citations_json TEXT NOT NULL,
  answer_url TEXT,
  capture_reference TEXT,
  fresh_session INTEGER NOT NULL,
  search_enabled INTEGER NOT NULL,
  platform_label TEXT NOT NULL,
  platform_version TEXT,
  observed_at TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  reviewer_note TEXT
);

CREATE TABLE IF NOT EXISTS real_surface_audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS real_surface_audit_events_entity ON real_surface_audit_events(workspace_id, entity_type, entity_id, created_at DESC);
