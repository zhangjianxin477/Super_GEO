# Component-adoption decision record template

Use this record **before adding or selecting** a commodity capability. One record is required for each capability category and for each exception to the adopt-first policy. A decision record is a governance artifact, not a security approval.

## Record header

| Field | Required value |
|---|---|
| Record ID | Stable identifier (for example, `ADR-GEO-2026-001`). |
| Date / reviewer | ISO date, responsible engineering and security reviewers. |
| Capability | The bounded technical capability being decided. |
| Product boundary | What remains proprietary GEO-domain logic and must not be delegated. |
| Decision | `adopt`, `defer`, `reject`, or `custom`. |
| Decision scope | MVP, pilot, or production, plus tenant / region limits. |

## Candidate assessment

| Field | Required evidence |
|---|---|
| Source | Official repository and official documentation links. |
| License / distribution | SPDX license, commercial terms where applicable, and NOTICE obligations. |
| Maintenance | Last review date, current release/activity check, governance or maintainer signal, and an explicit revalidation date. |
| Security | Supported-version policy, advisory/CVE and SBOM check, dependency scanning, secrets/data handling, network exposure, and security-owner approval. |
| Compatibility | Runtime version, application architecture, database/queue needs, browser/server boundary, deployment, and regional/data-residency compatibility. |
| Operational fit | Required services, observability, backup/recovery, upgrade/rollback, on-call owner, and estimated operating cost. |
| Enterprise controls | Workspace isolation, RBAC/audit compatibility, tenant data boundary, encryption, retention/deletion, and DPA/subprocessor impacts. |
| Proof of evaluation | PoC/test, decision links, known limitations, and failure mode. |

## Required decision rationale

1. Explain why the selected option is safer or more maintainable than a custom build **for this scope**.
2. When the decision is `custom`, explain why no evaluated component meets the current constraints and identify the narrow custom boundary.
3. When the decision is `defer`, state the blocker, the interim safe implementation, and the concrete trigger for re-evaluation.
4. Never treat repository popularity as security approval. Pin exact versions only after the security gate is approved.

## Approval and review cadence

- Platform engineering approves implementation compatibility and operational ownership.
- Security / privacy approves production data handling, third-party processing, and exposure.
- Product approves that a component does not weaken traceability, review gates, or no-guarantee controls.
- Re-review at least every 180 days and before any major version upgrade, new external service, or data-classification change.
