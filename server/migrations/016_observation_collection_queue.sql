ALTER TABLE assessment_observations ADD COLUMN collection_state TEXT NOT NULL DEFAULT 'queued' CHECK(collection_state IN ('queued','collecting','retry-scheduled','imported','failed'));
ALTER TABLE assessment_observations ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0);
ALTER TABLE assessment_observations ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts >= 1 AND max_attempts <= 5);
ALTER TABLE assessment_observations ADD COLUMN last_attempt_at TEXT;
ALTER TABLE assessment_observations ADD COLUMN next_attempt_at TEXT;
ALTER TABLE assessment_observations ADD COLUMN last_error_code TEXT;
ALTER TABLE assessment_observations ADD COLUMN resumed_at TEXT;
CREATE INDEX IF NOT EXISTS assessment_observations_queue ON assessment_observations(assessment_run_id, status, collection_state, next_attempt_at, created_at);
