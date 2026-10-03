# Enterprise workspace configuration

A GEO workspace is isolated per enterprise tenant. Configure this profile before creating market packs, query cohorts, evidence imports, or client-facing content.

## Governing model

- Only the **administrator** can write workspace configuration or manage members.
- Analysts, reviewers, and viewers may read the configuration according to their workspace role, but cannot change it.
- Each save creates an immutable configuration version, preserving the brand and policy context for later audit and delivery work.
- Configuration does not itself approve a factual claim. Each approved claim needs at least one evidence reference, and public-content use still requires an approved Evidence Pack.

## Configuration API

### Read the current configuration

`GET /api/workspaces/{workspaceId}/configuration`

Requires workspace read access.

### Save a new configuration version

`PUT /api/workspaces/{workspaceId}/configuration`

Requires an administrator. The request must include the following fields:

```json
{
  "brandNames": ["ExampleCo", "ExampleCo Cloud"],
  "products": ["Enterprise AI knowledge base"],
  "customerSegments": ["Cross-border SaaS teams", "Enterprise knowledge-base owners"],
  "operatingMarkets": ["CN", "GLOBAL"],
  "locales": ["zh-CN", "en-US"],
  "approvedWebsites": ["https://example.com"],
  "competitors": ["Competitor A", "Competitor B"],
  "approvedClaims": [
    {
      "statement": "Provides source-cited answers when backed by approved evidence.",
      "evidenceRefs": ["manual://approved-claim/source-cited-answers"]
    }
  ],
  "prohibitedClaims": [
    "Guarantees citations, recommendations, rankings, leads, or revenue."
  ]
}
```

`CN` and `GLOBAL` are independent operating markets. They should be configured with their own locales, sources, channels, query cohorts, and provider selections rather than treated as translations of a single market.

### Manage members

- `GET /api/workspaces/{workspaceId}/members` lists workspace members for an authorized reader.
- `POST /api/workspaces/{workspaceId}/members` adds or updates one member for an administrator.

```json
{ "userId": "analyst-001", "name": "Authorized analyst", "role": "analyst" }
```

Valid roles are `administrator`, `analyst`, `reviewer`, and `viewer`.

## UI behavior

The **Brand evidence** screen presents the administrator setup form used to capture the same fields. In the MVP demo UI it is intentionally non-destructive; production saves must use the governed configuration endpoint and the authenticated workspace headers.