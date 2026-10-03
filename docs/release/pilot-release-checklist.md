# Pilot Release Checklist

**Scope:** Enterprise GEO Growth Harness controlled-manual pilot path  
**Release state:** Engineering preflight is required before enabling a tenant. A tenant is **not** baseline-ready until its evidence, query cohort, controlled-manual model captures, and human review are complete.

## Automated gate

Run from the repository root:

```powershell
npm run verify
```

This includes `npm run test:release`, which starts an isolated temporary application and checks:

- viewer and cross-tenant writes are rejected;
- one tenant cannot retrieve another tenant's retained raw artifact;
- a controlled-manual observation can time out, exhaust retries, and be safely resumed without completing a failed run;
- guaranteed or causal GEO report language is rejected;
- denial and recovery events remain in the workspace audit trail; and
- a 100-query cohort can be persisted and scheduled for controlled collection within the local five-second smoke threshold.

The preflight uses synthetic test records only. It must never be treated as customer evidence, an assessment result, a report, or proof of model visibility.

## Human release gate

The release owner must record each result below for the target tenant and retain linked evidence. Do not substitute sample data, screenshots from another tenant, or an unreviewed draft.

| Area | Required evidence | Pass condition | Severity if failed |
| --- | --- | --- | --- |
| Security and isolation | Automated preflight output; role matrix review | All denial and artifact-isolation checks pass | High |
| Evidence governance | Approved Evidence Pack ID/version; reviewer audit event | Every content or analysis artifact references its approved Evidence Pack version | High |
| Controlled manual collection | Per-provider collection worksheet; retained capture proofs | Each imported answer has the exact query, provider/model identity, timestamp, source reference, and proof artifact | High |
| Recovery | Timeout/retry/resume audit trail | Interrupted collection remains visible and can be resumed without data loss | High |
| Auditability | Workspace audit export | Evidence approvals, imports, AI invocations, review decisions, actions, and report generation are traceable | High |
| AI boundaries | Extension configuration review | No unattended provider execution, credential storage, fabricated citation, auto-publication, or outcome guarantee is enabled | High |
| Accessibility | Keyboard smoke test in supported browser | Primary navigation, market switcher, evidence drawer close action, visible focus, headings, and live notices are usable without a pointer | Medium |
| Performance | `test:release` output plus pilot-size import observation | 100-query setup passes locally; collection/import load does not lose observations | Medium |
| Client report | Reviewer-approved report preview | Scope, cohort, providers, dates, completeness, retained evidence, limitations, and no-guarantee language are visible | High |

## Finding handling

- **High:** resolve before enabling the pilot, or record an explicit acceptance with owner, reason, compensating control, expiry date, and customer impact.
- **Medium:** record owner and remediation target date before pilot activation.
- **Low:** track in the release log; do not conceal the issue from the release owner.

## Pilot readiness boundary

The following outcomes require real controlled-manual evidence and remain separate from this engineering checklist:

1. CoreNote's domestic and global baseline assessment and signed baseline report.
2. Any approved content/evidence/distribution action.
3. A compatible follow-up assessment and before/after report.

Do not mark those outcomes complete, infer model performance, or claim content caused a visibility change until the underlying evidence is imported and human-reviewed.
