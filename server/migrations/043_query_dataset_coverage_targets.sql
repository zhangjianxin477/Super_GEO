-- Persist reviewer-calibrated coverage objectives on each versioned Query Dataset.
-- JSON keeps this additive SQLite MVP schema aligned with immutable Dataset revisions.
ALTER TABLE baseline_query_sets
  ADD COLUMN coverage_targets_json TEXT NOT NULL DEFAULT '{}';
