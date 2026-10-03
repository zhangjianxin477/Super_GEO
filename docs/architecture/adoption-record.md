# Component adoption record

**Record family:** `ADR-GEO-2026`  
**Last reviewed:** 2026-09-27  
**Decision scope:** enterprise GEO Growth Harness MVP; Node.js 24, React 19, Vite 7, modular-monolith server, SQLite for local development.  
**Decision rule:** adopt commodity capabilities when they demonstrably improve security, reliability, or delivery speed without weakening tenant isolation, evidence lineage, reviewer gates, or data-residency controls. Keep proprietary GEO scoring, evidence lineage, policy enforcement, and customer-report logic in-house.

## Mandatory production gate

No entry below is a production-security approval. Before a component is pinned or a SaaS service receives customer data, the accountable owner must complete the template in [`component-adoption-decision-template.md`](./component-adoption-decision-template.md): exact version, license/NOTICE confirmation, SBOM and vulnerability scan, supported-version review, privacy/DPA assessment, tenant/isolation design, operational runbook, upgrade/rollback test, and security approval.

## Decision register

| ID | Capability | Candidate(s) reviewed | MVP decision | Responsible owner | Revisit trigger |
|---|---|---|---|---|---|
| ADR-GEO-2026-001 | Background workflow jobs | BullMQ; Temporal | **Custom / defer adoption** | Platform Engineering | Any job needs durable asynchronous retries, scheduled execution, or multi-instance workers. |
| ADR-GEO-2026-002 | AI observability and evaluation | Langfuse; promptfoo | **Custom / defer adoption** | Data Platform | A configured first-party model extension begins serving requests or prompt/evaluation volume requires a dedicated system. |
| ADR-GEO-2026-003 | Permitted web extraction | Playwright; Crawlee | **Custom adapter / defer adoption** | Research Operations + Platform | A source adapter needs browser rendering or a reviewed, permitted extraction workflow. |
| ADR-GEO-2026-004 | Rich-text authoring | TipTap | **Defer adoption** | Product Engineering | The reviewed draft experience needs collaborative, rich-text editing beyond structured draft artifacts. |
| ADR-GEO-2026-005 | Dashboard charting | Recharts; Apache ECharts | **Adopt Recharts for future React dashboards** | Product Engineering | Before first production dashboard release; reconsider ECharts only for advanced map/large-data needs. |
| ADR-GEO-2026-006 | Enterprise identity | Keycloak; Auth.js | **Custom MVP boundary / defer adoption** | Security + IT | First production tenant, SSO/SAML/SCIM request, or external-user launch. |

## Detailed component decisions

### ADR-GEO-2026-001 — Background workflow jobs

| Field | Decision record |
|---|---|
| Product boundary | Run configuration, tenant authorization, evidence/version lineage, audit events, and review-state transitions remain GEO domain logic. |
| Candidates | [BullMQ](https://github.com/taskforcesh/bullmq) and [Temporal](https://github.com/temporalio/temporal). |
| License | BullMQ: MIT. Temporal server: MIT. Confirm the exact package/server version and any associated service terms before adoption. |
| Maintenance evidence | Both have active official repositories and release processes; repository activity and a supported release must be rechecked at the version-pinning gate. |
| Security posture | A future queue must segregate tenants in job payloads, avoid secrets in payloads, support dead-letter/error auditability, and pass SBOM/CVE review. Temporal additionally creates a durable workflow-service and datastore attack/operations surface; BullMQ requires secured Redis networking, ACLs, TLS, persistence, and backup policy. |
| Compatibility | BullMQ fits Node.js workers but adds Redis. Temporal requires worker/service deployment and persistence infrastructure. Both can be adapted behind the existing extension/workflow contract, but neither is required by controlled manual imports. |
| Decision | **Custom / defer.** Keep the MVP’s bounded, synchronous modular-monolith path. No background processing is introduced merely for future scale. |
| Custom-build rationale | No approved deployment topology, Redis, worker, or Temporal service owner is available. The current manual-import MVP has no durable asynchronous workload that justifies those operational dependencies. |
| Exit / re-evaluation | Adopt BullMQ after a reviewed async task requires retries or scheduling and Redis is approved. Evaluate Temporal only after long-running multi-step workflows need crash recovery across services. |

### ADR-GEO-2026-002 — AI observability and evaluation

| Field | Decision record |
|---|---|
| Product boundary | Raw answer provenance, evidence-linked GEO scoring, diagnosis, and client-report lineage remain in the Harness; a tool must not become the system of record for tenant evidence. |
| Candidates | [Langfuse](https://github.com/langfuse/langfuse) and [promptfoo](https://github.com/promptfoo/promptfoo). |
| License | Langfuse: MIT. promptfoo: MIT. Reconfirm exact release license and hosted-service terms, if any, before use. |
| Maintenance evidence | Both maintain official repositories and published documentation; verify current release cadence, support policy, and maintainer health when selecting an exact version. |
| Security posture | Prompt/answer payloads can include confidential enterprise evidence. Default to redaction, allow-listing, tenant-scoped identifiers, no secrets in prompts, and audit logs. A hosted observability service is prohibited until DPA, regional residency, retention, and subprocessor review are approved. |
| Compatibility | Both can integrate with a future Node-based provider-extension layer. promptfoo is useful for controlled offline regression tests; Langfuse may be self-hosted only after infrastructure/security approval. Neither should be called for the current controlled-manual provider observations. |
| Decision | **Custom / defer.** Persist minimal, tenant-scoped AI invocation metadata and manual observation provenance in the product database; do not claim external LLM execution. |
| Custom-build rationale | Manual imports do not need a third-party trace platform, and proprietary metrics require local, evidence-linked records. |
| Exit / re-evaluation | Run a redacted evaluation PoC when a direct model extension is configured; adopt promptfoo for CI evaluation first, and evaluate self-hosted Langfuse for trace volume that exceeds the built-in audit view. |

### ADR-GEO-2026-003 — Permitted extraction and source adapters

| Field | Decision record |
|---|---|
| Product boundary | Source authorization, allowed use, attribution, collection date, extraction state, and no-bypass policy remain Harness records. |
| Candidates | [Playwright](https://github.com/microsoft/playwright) and [Crawlee](https://github.com/apify/crawlee). |
| License | Playwright: Apache-2.0. Crawlee: Apache-2.0. Preserve required notices and recheck exact packages before pinning. |
| Maintenance evidence | Both are official, actively developed projects with maintained documentation; verify browser/runtime support and current releases at adoption time. |
| Security posture | Only access sources permitted by the owner and applicable terms. Never bypass login, robots/access controls, paywalls, CAPTCHAs, rate limits, or channel protections. Browser isolation, URL allow lists, SSRF controls, download limits, malware scanning, retention rules, and attribution are required before enabling extraction. |
| Compatibility | Playwright supports browser rendering but needs managed browser binaries and isolated workers. Crawlee adds crawling/concurrency/storage operations. Both fit behind the existing source-adapter extension contract. |
| Decision | **Custom adapter / defer.** Use controlled manual evidence import and reviewed URL metadata for MVP. |
| Custom-build rationale | The MVP requires attributable, authorized source records, not broad crawling. Manual import already meets the pilot evidence requirement without browser or crawling risk. |
| Exit / re-evaluation | Adopt Playwright for a single approved, render-required source adapter first; add Crawlee only when approved multi-page collection, rate limiting, and worker operations are funded. |

### ADR-GEO-2026-004 — Rich-text authoring

| Field | Decision record |
|---|---|
| Product boundary | Brief-to-draft links, claim evidence, review decisions, and immutable approval snapshots remain server-controlled. |
| Candidate | [TipTap](https://github.com/ueberdosis/tiptap). |
| License | MIT for the open-source core; validate feature-specific licensing and any paid-service terms before selecting extensions. |
| Maintenance evidence | Official repository and documentation show sustained ecosystem use; confirm React 19/Vite 7 compatibility and current maintainership before version pinning. |
| Security posture | Sanitise pasted HTML, constrain uploads, keep external embeds disabled by default, and preserve server-side authorization for every draft/action. Client editor content is untrusted until claim validation/review completes. |
| Compatibility | React integration is available and fits Vite. It does not replace the server’s content snapshot, validation, or audit model. |
| Decision | **Defer.** Current structured markdown/text draft artifacts meet the closed-pilot requirement. |
| Custom-build rationale | A custom rich-text editor is not being built; the existing server-owned draft representation is deliberately narrow until user research proves a rich editor is needed. |
| Exit / re-evaluation | Adopt TipTap after reviewers need inline collaborative editing, structured citations, or review annotations that cannot be safely represented in the current draft data model. |

### ADR-GEO-2026-005 — Dashboard charting

| Field | Decision record |
|---|---|
| Product boundary | Metric denominator/numerator, exclusions, provider completeness, evidence drill-down, and no-guarantee wording are server/domain responsibilities, not chart-library responsibilities. |
| Candidates | [Recharts](https://github.com/recharts/recharts) and [Apache ECharts](https://github.com/apache/echarts). |
| License | Recharts: MIT. Apache ECharts: Apache-2.0. |
| Maintenance evidence | Both maintain official repositories and active documentation. Confirm release activity, supported React/browser matrix, and CVE posture when pinning. |
| Security posture | Client-side charting may render only tenant-authorized API data. Escape labels/tooltips, prohibit raw HTML in chart text, set frontend CSP, and do not put client evidence in public client-side bundles. |
| Compatibility | Recharts is React-native and is the lowest-complexity fit for the existing React 19/Vite 7 client. ECharts remains a later option for advanced chart types or larger client-side data volumes. |
| Decision | **Adopt Recharts (pending exact version pin + security gate).** It is the default visualization component for dashboard implementation. |
| Rationale | The product needs readable, evidence-drillable charts; React-native composition avoids a custom chart layer. Recharts does not own metric calculation or data access. |
| Exit / re-evaluation | Reassess if visual requirements need geographic/graph rendering, high-volume data rendering, or license/support needs better met by ECharts. |

### ADR-GEO-2026-006 — Enterprise identity

| Field | Decision record |
|---|---|
| Product boundary | Workspace membership, application roles, tenant authorization decisions, and immutable audit events stay in the Harness. |
| Candidates | [Keycloak](https://github.com/keycloak/keycloak) and [Auth.js](https://github.com/nextauthjs/next-auth). |
| License | Keycloak: Apache-2.0. Auth.js: ISC. Confirm exact packages/adapters and hosted-provider terms before adoption. |
| Maintenance evidence | Both have official repositories and public maintenance communities. Verify current supported-version policy and enterprise integration support before a production commitment. |
| Security posture | Production requires OIDC/SAML design, MFA enforcement through the chosen IdP, secure session/token handling, secret rotation, SCIM strategy where required, audit retention, tenant claim mapping, and penetration/security review. Never rely on a client-supplied workspace ID as the authorization authority. |
| Compatibility | Keycloak is a dedicated identity platform with Java/database/operations footprint; it is suitable only if the organization owns it. Auth.js targets JavaScript web frameworks and would need a deliberate integration boundary with the standalone Node server. |
| Decision | **Custom MVP boundary / defer.** Retain local development identity middleware only for non-production demo use; it is not an enterprise identity solution. |
| Custom-build rationale | Neither candidate should be inserted without a real production deployment, selected customer IdP, and security ownership. Building a bespoke SSO service is expressly out of scope. |
| Exit / re-evaluation | Select the customer-approved IdP pattern before external access. Prefer OIDC federation with an enterprise IdP; evaluate Keycloak only if self-hosted identity is a confirmed organizational capability. |

## Universal implementation rules

- Pin exact versions and commit the lockfile; do not use a floating version for production release.
- Run license, SBOM, dependency vulnerability, and compatibility checks in CI.
- Record component-origin metadata in release notes and keep attribution/NOTICE files where required.
- Run integration tests proving workspace isolation, review-gate preservation, failure visibility, and no cross-tenant data leaks.
- New SaaS tools or outbound network calls must be disabled by default and require per-tenant configuration plus security/privacy approval.
- If a capability has no adopted component, document the narrow custom boundary and its exit condition rather than silently expanding custom infrastructure.
