# Live GEO Dashboard Read-Model Inventory

The live dashboard is a tenant-authorized aggregate read model. It does not execute providers, crawl sites, publish content, or alter approval state.

| Dashboard section | Retained source records | Notes |
| --- | --- | --- |
| Workspace / brand context | workspaces, workspace_configuration_versions | Tenant-scoped workspace name, brand, market configuration. |
| Market and providers | market_packs, model_provider_configurations | Market, locale, approved providers, channels and competitors. |
| Query cohort | query_datasets and immutable run snapshot | The selected run retains its dataset version and query IDs. |
| Assessment scope and completeness | assessment_runs, assessment_observations | Queued, imported, completed, failed and unavailable evidence remain visible. |
| Metrics | calculateGeoMetrics over retained observations | The dashboard explicitly includes controlled-manual imports and labels that scope. |
| Comparison | Baseline and selected run snapshots | Deltas are returned only for matching market pack, locale, dataset/version, query IDs and providers. |
| Diagnoses and next actions | diagnoses, content_briefs, content_drafts, distribution_tasks | Actions retain diagnosis and workflow references when available. |
| Evidence drill-down | Observation metadata plus artifact_records | The UI retrieves retained raw answer artifacts with workspace authorization. |
| Reports and limitations | geo_reports, report-domain limitations | No route represents an observation as causal proof or a guaranteed outcome. |

The endpoint is intentionally an aggregate read model; individual governed resources remain available through their existing workspace-scoped API routes.
