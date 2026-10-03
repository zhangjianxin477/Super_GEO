# AI Answer Provider and Manual-Observation Register

**Record date:** September 27, 2026  
**Decision:** The MVP uses authorized **manual answer collection/import** for every listed provider. No provider API call is implied by this record. A provider becomes directly executable only after an administrator registers a configured model-provider extension and the organization approves its credentials, terms, market configuration, and data handling.

## Collection evidence required for every observation

Every imported answer must retain:

1. Immutable assessment-run and query IDs.
2. Provider name and the model/version label visibly available to the collector; use `not-disclosed` if the product UI does not expose a version.
3. Locale, market, user role/context where relevant, collection timestamp, and collector identity.
4. Full raw answer text, extracted citations/links, and a tenant-scoped raw-answer artifact.
5. Collection mode `imported-manual`, not `direct-execution`.
6. Source evidence permitted by the channel policy, such as a captured response record or approved screenshot artifact; do not bypass access controls or platform terms.
7. Completeness status and an explicit limitation when an answer could not be obtained or preserved.

## China provider cohort

| Provider | Market / locale | MVP access mode | Required record | Direct API claim |
| --- | --- | --- | --- | --- |
| DeepSeek | CN / `zh-CN` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |
| 通义千问 | CN / `zh-CN` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |
| 豆包 | CN / `zh-CN` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |
| Kimi | CN / `zh-CN` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |
| 元宝 | CN / `zh-CN` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |
| GLM | CN / `zh-CN` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |
| 文心一言 | CN / `zh-CN` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |

## Global provider cohort

| Provider | Market / locale | MVP access mode | Required record | Direct API claim |
| --- | --- | --- | --- | --- |
| ChatGPT | United States / `en-US` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |
| Gemini | United States / `en-US` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |
| Claude | United States / `en-US` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |
| Perplexity | United States / `en-US` | Authorized manual import | UI/provider label, raw answer, citations, timestamp, collector, source artifact | Not configured |

## Review and failure policy

- Imported answers remain visibly distinct from direct provider executions in all metric and report output.
- A missing answer, unavailable citation list, unclear locale, or unavailable source artifact must create an exclusion/limitation rather than inferred data.
- Provider output is observational evidence. The Harness does not state that a provider will repeat an answer, cite a domain, or recommend a product in the future.
- Any new provider or direct API execution requires a revised provider record, extension configuration review, and Workspace administrator approval.
