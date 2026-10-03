ALTER TABLE model_provider_configurations ADD COLUMN test_status TEXT NOT NULL DEFAULT 'unverified' CHECK(test_status IN ('unverified','verified','failed'));
ALTER TABLE model_provider_configurations ADD COLUMN last_tested_at TEXT;
ALTER TABLE model_provider_configurations ADD COLUMN last_test_model TEXT;
ALTER TABLE model_provider_configurations ADD COLUMN last_test_latency_ms INTEGER;
ALTER TABLE model_provider_configurations ADD COLUMN last_test_message TEXT;
CREATE INDEX IF NOT EXISTS model_provider_configurations_test_state ON model_provider_configurations(workspace_id, test_status, updated_at DESC);
