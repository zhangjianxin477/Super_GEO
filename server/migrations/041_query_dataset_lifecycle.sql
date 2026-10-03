-- Promote Query Datasets from a generated list to a versioned, publishable GEO research asset.
ALTER TABLE baseline_query_sets ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE baseline_query_sets ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE baseline_query_sets ADD COLUMN parent_query_set_id TEXT REFERENCES baseline_query_sets(id) ON DELETE SET NULL;
ALTER TABLE baseline_query_sets ADD COLUMN creation_mode TEXT NOT NULL DEFAULT 'template';
ALTER TABLE baseline_query_sets ADD COLUMN published_at TEXT;
ALTER TABLE baseline_query_sets ADD COLUMN published_by TEXT;
ALTER TABLE baseline_query_sets ADD COLUMN locked_at TEXT;
ALTER TABLE baseline_query_sets ADD COLUMN locked_by TEXT;

ALTER TABLE baseline_seed_queries ADD COLUMN query_type TEXT NOT NULL DEFAULT 'general';
ALTER TABLE baseline_seed_queries ADD COLUMN journey_stage TEXT NOT NULL DEFAULT 'consideration';
ALTER TABLE baseline_seed_queries ADD COLUMN target_entity_type TEXT NOT NULL DEFAULT 'category';
ALTER TABLE baseline_seed_queries ADD COLUMN target_entities_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE baseline_seed_queries ADD COLUMN audience_segment TEXT;
ALTER TABLE baseline_seed_queries ADD COLUMN scenario TEXT;
ALTER TABLE baseline_seed_queries ADD COLUMN source_type TEXT NOT NULL DEFAULT 'generated';
ALTER TABLE baseline_seed_queries ADD COLUMN source_reference TEXT;
ALTER TABLE baseline_seed_queries ADD COLUMN query_group TEXT;
ALTER TABLE baseline_seed_queries ADD COLUMN is_baseline INTEGER NOT NULL DEFAULT 1;

UPDATE baseline_query_sets
SET lifecycle_status = CASE status
  WHEN 'approved' THEN 'ready_for_test'
  WHEN 'superseded' THEN 'superseded'
  ELSE 'draft'
END,
    creation_mode = CASE generation_mode
      WHEN 'llm-assisted' THEN 'llm-assisted'
      ELSE 'template'
    END;

CREATE INDEX IF NOT EXISTS baseline_query_sets_lifecycle
  ON baseline_query_sets(workspace_id, case_id, lifecycle_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS baseline_seed_queries_group
  ON baseline_seed_queries(workspace_id, query_set_id, query_group);
