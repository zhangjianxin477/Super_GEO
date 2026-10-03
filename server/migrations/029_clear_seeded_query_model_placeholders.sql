-- Remove accidental Query-model designations from seeded provider placeholders.
-- A real saved Query model always has execution settings or an encrypted key;
-- empty, unverified placeholders should leave the workspace unconfigured.
UPDATE model_provider_configurations AS provider
SET query_generation_enabled = 0
WHERE provider.query_generation_enabled = 1
  AND provider.test_status <> 'verified'
  AND NOT EXISTS (
    SELECT 1
    FROM model_provider_execution_settings AS execution
    WHERE execution.provider_configuration_id = provider.id
      AND execution.workspace_id = provider.workspace_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM model_provider_credentials AS credential
    WHERE credential.provider_configuration_id = provider.id
      AND credential.workspace_id = provider.workspace_id
  );
