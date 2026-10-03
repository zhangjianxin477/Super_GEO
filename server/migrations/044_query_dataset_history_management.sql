-- Manage Query Dataset history without losing formal GEO evidence.
ALTER TABLE baseline_query_sets ADD COLUMN archived_at TEXT;
ALTER TABLE baseline_query_sets ADD COLUMN archived_by TEXT;
ALTER TABLE baseline_query_sets ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;

-- Give every existing project one explicit current Dataset, preferring reusable test versions.
UPDATE baseline_query_sets
SET is_active = 1
WHERE id IN (
  SELECT candidate.id
  FROM baseline_query_sets AS candidate
  WHERE candidate.id = (
    SELECT ranked.id
    FROM baseline_query_sets AS ranked
    WHERE ranked.workspace_id = candidate.workspace_id
      AND ranked.case_id = candidate.case_id
    ORDER BY
      CASE ranked.lifecycle_status
        WHEN 'locked_for_baseline' THEN 0
        WHEN 'ready_for_test' THEN 1
        WHEN 'in_review' THEN 2
        WHEN 'draft' THEN 3
        ELSE 4
      END,
      ranked.updated_at DESC
    LIMIT 1
  )
);

CREATE INDEX IF NOT EXISTS baseline_query_sets_history_management
  ON baseline_query_sets(workspace_id, case_id, is_active DESC, archived_at, updated_at DESC);
