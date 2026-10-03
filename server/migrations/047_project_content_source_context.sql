-- migration: foreign_keys_off
-- Normalize content-operation source provenance for product projects.
-- Existing workspace-only records remain project_id = NULL and stay legacy-unassigned.

ALTER TABLE distribution_tasks RENAME TO distribution_tasks_legacy_047;
ALTER TABLE geo_gap_actions RENAME TO geo_gap_actions_legacy_047;
ALTER TABLE content_publications RENAME TO content_publications_legacy_047;
ALTER TABLE approved_content_snapshots RENAME TO approved_content_snapshots_legacy_047;
ALTER TABLE draft_claim_validations RENAME TO draft_claim_validations_legacy_047;
ALTER TABLE content_drafts RENAME TO content_drafts_legacy_047;
ALTER TABLE content_briefs RENAME TO content_briefs_legacy_047;
ALTER TABLE content_strategies RENAME TO content_strategies_legacy_047;
ALTER TABLE ai_invocations RENAME TO ai_invocations_legacy_047;

CREATE TABLE ai_invocations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
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
  failure_detail TEXT,
  source_context_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE content_strategies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','needs-review','approved','rejected','executing','completed','archived')),
  diagnosis_id TEXT REFERENCES diagnoses(id),
  market_pack_id TEXT REFERENCES market_packs(id),
  evidence_pack_id TEXT REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER,
  source_context_json TEXT NOT NULL DEFAULT '{}',
  query_ids_json TEXT NOT NULL,
  channels_json TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  strategy_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_comment TEXT,
  UNIQUE(workspace_id, logical_key, version)
);

CREATE TABLE content_briefs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','needs-review','approved','rejected')),
  diagnosis_id TEXT REFERENCES diagnoses(id),
  market_pack_id TEXT REFERENCES market_packs(id),
  evidence_pack_id TEXT REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER,
  source_context_json TEXT NOT NULL DEFAULT '{}',
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
  content_strategy_id TEXT REFERENCES content_strategies(id),
  UNIQUE(workspace_id, logical_key, version)
);

CREATE TABLE content_drafts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  logical_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','needs-review','approved','rejected')),
  source_brief_id TEXT NOT NULL REFERENCES content_briefs(id),
  locale TEXT NOT NULL,
  channel TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('website-page','faq','use-case','comparison-page','case-study','editorial')),
  evidence_pack_id TEXT REFERENCES evidence_packs(id),
  evidence_pack_version INTEGER,
  source_context_json TEXT NOT NULL DEFAULT '{}',
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

CREATE TABLE draft_claim_validations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
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

CREATE TABLE approved_content_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  content_draft_id TEXT NOT NULL REFERENCES content_drafts(id),
  draft_version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  claim_validations_json TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  review_comment TEXT NOT NULL,
  UNIQUE(content_draft_id, draft_version)
);

CREATE TABLE content_publications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES brand_diagnostic_cases(id) ON DELETE CASCADE,
  approved_snapshot_id TEXT NOT NULL REFERENCES approved_content_snapshots(id),
  content_draft_id TEXT NOT NULL REFERENCES content_drafts(id),
  content_brief_id TEXT NOT NULL REFERENCES content_briefs(id),
  content_strategy_id TEXT REFERENCES content_strategies(id),
  source_assessment_run_id TEXT REFERENCES assessment_runs(id),
  dataset_id TEXT REFERENCES query_datasets(id),
  source_context_json TEXT NOT NULL DEFAULT '{}',
  channel TEXT NOT NULL,
  published_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  proof_artifact_id TEXT REFERENCES artifact_records(id),
  target_query_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('registered','retest-planned','archived')),
  retest_plan_json TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, approved_snapshot_id, published_url)
);

CREATE TABLE distribution_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_draft_id TEXT NOT NULL REFERENCES content_drafts(id),
  approved_snapshot_id TEXT NOT NULL REFERENCES approved_content_snapshots(id),
  owner_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  editorial_constraints_json TEXT NOT NULL,
  target_query_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('planned','in-progress','submitted','completed','blocked','cancelled')),
  scheduled_for TEXT NOT NULL,
  completed_at TEXT,
  proof_artifact_id TEXT REFERENCES artifact_records(id),
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, approved_snapshot_id, channel)
);

CREATE TABLE geo_gap_actions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  query_group_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL REFERENCES competitor_evidence_analyses(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')),
  status TEXT NOT NULL CHECK(status IN ('draft','in-progress','completed','dismissed')),
  action_type TEXT NOT NULL CHECK(action_type IN ('improve-owned-page','create-comparison-page','create-faq','create-case-study','source-research')),
  title TEXT NOT NULL,
  gap_summary TEXT NOT NULL,
  evidence_snapshot_json TEXT NOT NULL DEFAULT '{}',
  recommendation_json TEXT NOT NULL DEFAULT '{}',
  limitations_json TEXT NOT NULL DEFAULT '[]',
  content_brief_json TEXT,
  content_brief_created_at TEXT,
  retest_plan_json TEXT,
  retest_plan_created_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  content_strategy_id TEXT REFERENCES content_strategies(id),
  content_brief_id TEXT REFERENCES content_briefs(id),
  content_draft_id TEXT REFERENCES content_drafts(id),
  content_publication_id TEXT REFERENCES content_publications(id),
  content_workflow_stage TEXT NOT NULL DEFAULT 'action-ready',
  UNIQUE(workspace_id, analysis_id, action_key)
);

INSERT INTO ai_invocations (id, workspace_id, project_id, capability, provider_extension_id, model_identity, prompt_template_version, input_refs_json, output_refs_json, status, human_review_required, created_at, created_by, failure_detail, source_context_json)
SELECT id, workspace_id, project_id, capability, provider_extension_id, model_identity, prompt_template_version, input_refs_json, output_refs_json, status, human_review_required, created_at, created_by, failure_detail, '{"source":"legacy-workspace-record"}'
FROM ai_invocations_legacy_047;

INSERT INTO content_strategies (id, workspace_id, project_id, logical_key, version, status, diagnosis_id, market_pack_id, evidence_pack_id, evidence_pack_version, source_context_json, query_ids_json, channels_json, title, objective, strategy_json, created_at, created_by, reviewed_at, reviewed_by, review_comment)
SELECT id, workspace_id, project_id, logical_key, version, status, diagnosis_id, market_pack_id, evidence_pack_id, evidence_pack_version, '{"source":"legacy-workspace-record"}', query_ids_json, channels_json, title, objective, strategy_json, created_at, created_by, reviewed_at, reviewed_by, review_comment
FROM content_strategies_legacy_047;

INSERT INTO content_briefs (id, workspace_id, project_id, logical_key, version, status, diagnosis_id, market_pack_id, evidence_pack_id, evidence_pack_version, source_context_json, locale, channel, content_type, title, brief_json, ai_invocation_id, created_at, created_by, reviewed_at, reviewed_by, review_comment, content_strategy_id)
SELECT id, workspace_id, project_id, logical_key, version, status, diagnosis_id, market_pack_id, evidence_pack_id, evidence_pack_version, '{"source":"legacy-workspace-record"}', locale, channel, content_type, title, brief_json, ai_invocation_id, created_at, created_by, reviewed_at, reviewed_by, review_comment, content_strategy_id
FROM content_briefs_legacy_047;

INSERT INTO content_drafts (id, workspace_id, project_id, logical_key, version, status, source_brief_id, locale, channel, content_type, evidence_pack_id, evidence_pack_version, source_context_json, title, draft_json, ai_invocation_id, created_at, created_by, reviewed_at, reviewed_by, review_comment)
SELECT id, workspace_id, project_id, logical_key, version, status, source_brief_id, locale, channel, content_type, evidence_pack_id, evidence_pack_version, '{"source":"legacy-workspace-record"}', title, draft_json, ai_invocation_id, created_at, created_by, reviewed_at, reviewed_by, review_comment
FROM content_drafts_legacy_047;

INSERT INTO draft_claim_validations (id, workspace_id, project_id, content_draft_id, statement, claim_type, evidence_refs_json, status, detector_version, created_at, created_by, resolved_at, resolved_by, resolution_comment)
SELECT id, workspace_id, project_id, content_draft_id, statement, claim_type, evidence_refs_json, status, detector_version, created_at, created_by, resolved_at, resolved_by, resolution_comment
FROM draft_claim_validations_legacy_047;

INSERT INTO approved_content_snapshots (id, workspace_id, project_id, content_draft_id, draft_version, content_json, claim_validations_json, approved_at, approved_by, review_comment)
SELECT id, workspace_id, project_id, content_draft_id, draft_version, content_json, claim_validations_json, approved_at, approved_by, review_comment
FROM approved_content_snapshots_legacy_047;

INSERT INTO content_publications (id, workspace_id, project_id, approved_snapshot_id, content_draft_id, content_brief_id, content_strategy_id, source_assessment_run_id, dataset_id, source_context_json, channel, published_url, published_at, proof_artifact_id, target_query_ids_json, status, retest_plan_json, notes, created_at, created_by, updated_at)
SELECT id, workspace_id, project_id, approved_snapshot_id, content_draft_id, content_brief_id, content_strategy_id, source_assessment_run_id, dataset_id, '{"source":"legacy-workspace-record"}', channel, published_url, published_at, proof_artifact_id, target_query_ids_json, status, retest_plan_json, notes, created_at, created_by, updated_at
FROM content_publications_legacy_047;

INSERT INTO distribution_tasks (id, workspace_id, content_draft_id, approved_snapshot_id, owner_id, channel, editorial_constraints_json, target_query_ids_json, status, scheduled_for, completed_at, proof_artifact_id, notes, created_at, created_by, updated_at)
SELECT id, workspace_id, content_draft_id, approved_snapshot_id, owner_id, channel, editorial_constraints_json, target_query_ids_json, status, scheduled_for, completed_at, proof_artifact_id, notes, created_at, created_by, updated_at
FROM distribution_tasks_legacy_047;

INSERT INTO geo_gap_actions (id, workspace_id, query_group_id, analysis_id, action_key, priority, status, action_type, title, gap_summary, evidence_snapshot_json, recommendation_json, limitations_json, content_brief_json, content_brief_created_at, retest_plan_json, retest_plan_created_at, created_at, created_by, updated_at, updated_by, content_strategy_id, content_brief_id, content_draft_id, content_publication_id, content_workflow_stage)
SELECT id, workspace_id, query_group_id, analysis_id, action_key, priority, status, action_type, title, gap_summary, evidence_snapshot_json, recommendation_json, limitations_json, content_brief_json, content_brief_created_at, retest_plan_json, retest_plan_created_at, created_at, created_by, updated_at, updated_by, content_strategy_id, content_brief_id, content_draft_id, content_publication_id, content_workflow_stage
FROM geo_gap_actions_legacy_047;

DROP TABLE distribution_tasks_legacy_047;
DROP TABLE geo_gap_actions_legacy_047;
DROP TABLE content_publications_legacy_047;
DROP TABLE approved_content_snapshots_legacy_047;
DROP TABLE draft_claim_validations_legacy_047;
DROP TABLE content_drafts_legacy_047;
DROP TABLE content_briefs_legacy_047;
DROP TABLE content_strategies_legacy_047;
DROP TABLE ai_invocations_legacy_047;

CREATE INDEX ai_invocations_workspace_created ON ai_invocations(workspace_id, created_at DESC);
CREATE INDEX content_strategies_workspace_created ON content_strategies(workspace_id, created_at DESC);
CREATE INDEX content_strategies_diagnosis ON content_strategies(workspace_id, diagnosis_id, status);
CREATE INDEX content_briefs_workspace_created ON content_briefs(workspace_id, created_at DESC);
CREATE INDEX content_briefs_strategy ON content_briefs(content_strategy_id, created_at DESC);
CREATE INDEX content_drafts_workspace_created ON content_drafts(workspace_id, created_at DESC);
CREATE INDEX content_drafts_source_brief ON content_drafts(source_brief_id, created_at DESC);
CREATE INDEX draft_claim_validations_draft_status ON draft_claim_validations(content_draft_id, status);
CREATE INDEX approved_content_snapshots_workspace_created ON approved_content_snapshots(workspace_id, approved_at DESC);
CREATE INDEX content_publications_workspace_created ON content_publications(workspace_id, created_at DESC);
CREATE INDEX content_publications_dataset ON content_publications(workspace_id, dataset_id, status);
CREATE INDEX distribution_tasks_workspace_updated ON distribution_tasks(workspace_id, updated_at DESC);
CREATE INDEX distribution_tasks_snapshot ON distribution_tasks(approved_snapshot_id);
CREATE INDEX geo_gap_actions_query_group ON geo_gap_actions(workspace_id, query_group_id, created_at DESC);
CREATE INDEX geo_gap_actions_status ON geo_gap_actions(workspace_id, status, updated_at DESC);
CREATE INDEX geo_gap_actions_content_strategy ON geo_gap_actions(workspace_id, content_strategy_id);
CREATE INDEX geo_gap_actions_content_brief ON geo_gap_actions(workspace_id, content_brief_id);
CREATE INDEX geo_gap_actions_content_draft ON geo_gap_actions(workspace_id, content_draft_id);
CREATE INDEX geo_gap_actions_content_publication ON geo_gap_actions(workspace_id, content_publication_id);

CREATE INDEX ai_invocations_workspace_project_created ON ai_invocations(workspace_id, project_id, created_at DESC);
CREATE INDEX content_strategies_workspace_project_created ON content_strategies(workspace_id, project_id, created_at DESC);
CREATE INDEX content_briefs_workspace_project_created ON content_briefs(workspace_id, project_id, created_at DESC);
CREATE INDEX content_drafts_workspace_project_created ON content_drafts(workspace_id, project_id, created_at DESC);
CREATE INDEX draft_claim_validations_workspace_project_draft ON draft_claim_validations(workspace_id, project_id, content_draft_id, created_at);
CREATE INDEX approved_content_snapshots_workspace_project_created ON approved_content_snapshots(workspace_id, project_id, approved_at DESC);
CREATE INDEX content_publications_workspace_project_created ON content_publications(workspace_id, project_id, created_at DESC);
