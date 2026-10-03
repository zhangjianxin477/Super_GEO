-- Project-scoped ownership for GEO content operations.
-- Existing workspace-level records intentionally remain NULL and are treated as legacy-unassigned.
ALTER TABLE ai_invocations ADD COLUMN project_id TEXT REFERENCES geo_diagnostic_projects(id);
ALTER TABLE content_strategies ADD COLUMN project_id TEXT REFERENCES geo_diagnostic_projects(id);
ALTER TABLE content_briefs ADD COLUMN project_id TEXT REFERENCES geo_diagnostic_projects(id);
ALTER TABLE content_drafts ADD COLUMN project_id TEXT REFERENCES geo_diagnostic_projects(id);
ALTER TABLE draft_claim_validations ADD COLUMN project_id TEXT REFERENCES geo_diagnostic_projects(id);
ALTER TABLE approved_content_snapshots ADD COLUMN project_id TEXT REFERENCES geo_diagnostic_projects(id);
ALTER TABLE content_publications ADD COLUMN project_id TEXT REFERENCES geo_diagnostic_projects(id);

CREATE INDEX IF NOT EXISTS ai_invocations_workspace_project_created ON ai_invocations(workspace_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_strategies_workspace_project_created ON content_strategies(workspace_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_briefs_workspace_project_created ON content_briefs(workspace_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_drafts_workspace_project_created ON content_drafts(workspace_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS draft_claim_validations_workspace_project_draft ON draft_claim_validations(workspace_id, project_id, content_draft_id, created_at);
CREATE INDEX IF NOT EXISTS approved_content_snapshots_workspace_project_created ON approved_content_snapshots(workspace_id, project_id, approved_at DESC);
CREATE INDEX IF NOT EXISTS content_publications_workspace_project_created ON content_publications(workspace_id, project_id, created_at DESC);
