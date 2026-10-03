-- Bind each project’s GEO diagnosis to one explicit current real-platform test batch.
ALTER TABLE brand_diagnostic_cases ADD COLUMN active_real_surface_test_run_id TEXT REFERENCES real_surface_test_runs(id) ON DELETE SET NULL;

-- Existing projects keep their most recently active collection batch rather than
-- falling back to the oldest batch that happens to have reviewed evidence.
UPDATE brand_diagnostic_cases
SET active_real_surface_test_run_id = (
  SELECT r.id
  FROM real_surface_test_runs r
  WHERE r.workspace_id = brand_diagnostic_cases.workspace_id
    AND r.case_id = brand_diagnostic_cases.id
  ORDER BY r.updated_at DESC, r.created_at DESC, r.id DESC
  LIMIT 1
)
WHERE active_real_surface_test_run_id IS NULL;

CREATE INDEX IF NOT EXISTS brand_diagnostic_cases_active_real_surface_run
  ON brand_diagnostic_cases(workspace_id, active_real_surface_test_run_id);
