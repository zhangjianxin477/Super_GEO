ALTER TABLE query_datasets ADD COLUMN supersedes_dataset_id TEXT REFERENCES query_datasets(id);
CREATE INDEX IF NOT EXISTS query_datasets_workspace_logical_version ON query_datasets(workspace_id, logical_key, version DESC);
CREATE INDEX IF NOT EXISTS query_datasets_supersedes ON query_datasets(supersedes_dataset_id);
