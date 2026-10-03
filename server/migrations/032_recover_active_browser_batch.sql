-- One-time upgrade recovery for batches created before active_test_run_id existed.
-- The agent resumes only its most recent in-progress run; historical queues remain untouched.
UPDATE browser_agents
SET active_test_run_id = (
  SELECT run.id
  FROM real_surface_test_runs AS run
  WHERE run.browser_agent_id = browser_agents.id
    AND run.execution_mode = 'browser-agent'
    AND run.state IN ('collecting', 'active')
  ORDER BY CASE run.state WHEN 'collecting' THEN 0 ELSE 1 END, run.created_at DESC
  LIMIT 1
)
WHERE active_test_run_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM real_surface_test_runs AS run
    WHERE run.browser_agent_id = browser_agents.id
      AND run.execution_mode = 'browser-agent'
      AND run.state IN ('collecting', 'active')
  );