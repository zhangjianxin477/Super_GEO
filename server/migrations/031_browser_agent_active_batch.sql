-- A local browser agent executes exactly one user-selected Test Run at a time.
-- Historical queued tasks stay auditable but are never drained into a newly started batch.
ALTER TABLE browser_agents ADD COLUMN active_test_run_id TEXT REFERENCES real_surface_test_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS browser_agents_active_test_run ON browser_agents(active_test_run_id);
