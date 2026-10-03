# CoreNote Evidence Connector Discovery Record

**Record date:** September 27, 2026  
**Product boundary:** The GEO Growth Harness is product-neutral. CoreNote is the first validation tenant and an optional evidence source; no customer workspace is required to use CoreNote.

## Decision

The approved MVP integration surface is a **controlled manual export / manual entry workflow**. A live CoreNote API, webhook, or unattended synchronization is explicitly out of scope until the CoreNote owner separately authorizes an interface and its terms of use.

## Owner review

| Field | Record |
| --- | --- |
| Decision authority | CoreNote product owner / validation-tenant owner |
| Review state | Confirmed in the product decision record on September 27, 2026 |
| Approved integration mode | Controlled manual export and reviewer-validated manual entry |
| Future change gate | A new connector discovery review, security review, and extension configuration are required before any API or webhook execution |

## Authentication and access controls

- The Harness does not store CoreNote credentials for the MVP manual workflow.
- A designated, authorized operator exports only material they are entitled to access.
- Each import identifies the collector, collection time, source reference, source type, and review state.
- Private product information is imported only into the matching workspace and is never sent to an external model provider unless a later approved workflow explicitly permits it.
- An import must not bypass CoreNote access controls, scrape authenticated pages, or use a shared personal account.

## Required canonical evidence fields

| Harness field | Manual-export requirement |
| --- | --- |
| `title` | Source document/page title or a reviewer-assigned evidence title |
| `excerpt` | Exact or carefully bounded factual excerpt for the claim being supported |
| `taxonomy` | Brand identity, product capability, customer segment, use case, case study, policy, comparison, or prohibited claim |
| `sourceType` | `corenote` for controlled exports; `manual` only when no original CoreNote source can be retained |
| `sourceRef` | Stable internal reference, permitted URL, export reference, or document identifier |
| `status` | Imported/review state; an item cannot imply approval until reviewed under the Evidence Pack policy |
| `artifactKey` | Optional immutable copy/export artifact retained under the workspace storage boundary |
| `collectedAt` | Export or manual-entry timestamp retained in the import artifact/audit record |
| `collector` | Authorized operator identity retained in the audit trail |

## Rate limits and operating limits

There is no programmatic connector rate limit in the MVP because the process is human-operated. The operational controls are:

- batch exports must be small enough for reviewer validation;
- do not import documents that exceed the approved workspace scope;
- pause the batch if source provenance, ownership, or factual meaning is unclear;
- process corrections as a new Evidence Pack version rather than overwriting an approved version.

## Failure behavior

| Failure | Required behavior |
| --- | --- |
| Export is unavailable or incomplete | Record the failure; do not create a replacement claim from memory or inference |
| Source reference cannot be retained | Quarantine the item for review; do not include it in an approved Evidence Pack |
| Import mapping is malformed | Mark the import failed and preserve the last approved Evidence Pack unchanged |
| Review rejects the item | Keep the raw import artifact/audit evidence where permitted, but exclude the item from approved factual grounding |
| Future API/webhook becomes misconfigured | Fail closed, log the configuration failure, and leave approved evidence unchanged |

## Acceptance evidence

This record is reviewed for the manual MVP workflow. A later API or webhook adapter cannot be implemented or enabled until an authorized owner supplies the interface documentation, authentication scheme, rate limits, permitted fields, data-residency requirements, and failure semantics.
