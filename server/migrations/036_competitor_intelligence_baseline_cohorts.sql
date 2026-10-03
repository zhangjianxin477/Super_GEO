ALTER TABLE competitor_evidence_analyses ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'single-observation' CHECK(scope_type IN ('single-observation','baseline-cohort'));
ALTER TABLE competitor_evidence_analyses ADD COLUMN test_run_id TEXT REFERENCES real_surface_test_runs(id) ON DELETE SET NULL;
ALTER TABLE competitor_evidence_analyses ADD COLUMN observation_ids_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE competitor_evidence_analyses ADD COLUMN evidence_summary_json TEXT NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS competitor_evidence_analyses_profile_scope ON competitor_evidence_analyses(workspace_id,profile_id,scope_type,test_run_id,started_at DESC);
