ALTER TABLE geo_gap_actions ADD COLUMN content_strategy_id TEXT REFERENCES content_strategies(id);
ALTER TABLE geo_gap_actions ADD COLUMN content_brief_id TEXT REFERENCES content_briefs(id);
ALTER TABLE geo_gap_actions ADD COLUMN content_draft_id TEXT REFERENCES content_drafts(id);
ALTER TABLE geo_gap_actions ADD COLUMN content_publication_id TEXT REFERENCES content_publications(id);
ALTER TABLE geo_gap_actions ADD COLUMN content_workflow_stage TEXT NOT NULL DEFAULT 'action-ready';

CREATE INDEX IF NOT EXISTS geo_gap_actions_content_strategy ON geo_gap_actions(workspace_id, content_strategy_id);
CREATE INDEX IF NOT EXISTS geo_gap_actions_content_brief ON geo_gap_actions(workspace_id, content_brief_id);
CREATE INDEX IF NOT EXISTS geo_gap_actions_content_draft ON geo_gap_actions(workspace_id, content_draft_id);
CREATE INDEX IF NOT EXISTS geo_gap_actions_content_publication ON geo_gap_actions(workspace_id, content_publication_id);
