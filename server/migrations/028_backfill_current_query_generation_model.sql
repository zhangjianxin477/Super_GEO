-- Backfill one current Query-generation model for workspaces that existed
-- before the explicit single-model flag was introduced. Only verified
-- connections are eligible: seeded platform placeholders are not selections.
WITH ranked_candidates AS (
  SELECT candidate.id,
         ROW_NUMBER() OVER (
           PARTITION BY candidate.workspace_id
           ORDER BY candidate.last_tested_at DESC,
                    candidate.updated_at DESC,
                    candidate.version DESC
         ) AS row_number
  FROM model_provider_configurations AS candidate
  WHERE candidate.status = 'configured'
    AND candidate.test_status = 'verified'
    AND NOT EXISTS (
      SELECT 1
      FROM model_provider_configurations AS designated
      WHERE designated.workspace_id = candidate.workspace_id
        AND designated.query_generation_enabled = 1
    )
)
UPDATE model_provider_configurations
SET query_generation_enabled = 1
WHERE id IN (
  SELECT id
  FROM ranked_candidates
  WHERE row_number = 1
);
