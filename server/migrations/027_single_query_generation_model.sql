ALTER TABLE model_provider_configurations ADD COLUMN query_generation_enabled INTEGER NOT NULL DEFAULT 0 CHECK(query_generation_enabled IN (0,1));
CREATE INDEX IF NOT EXISTS model_provider_configurations_query_generation_current ON model_provider_configurations(workspace_id, query_generation_enabled, status, updated_at DESC);
