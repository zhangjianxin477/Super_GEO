# AI Intervention and Human Control Model

GEO Growth Harness is an AI-assisted enterprise workflow product, not an autonomous publishing system. AI may assist at controlled, traceable points:

1. **Query research and clustering** — propose query variants, intent labels, and coverage gaps; analysts approve the versioned dataset.
2. **Answer analysis** — classify brand/competitor visibility and possible claim risks against an immutable evidence-pack version; outputs retain model/rule version and require review for nuanced claims.
3. **Content brief and draft assistance** — produce structured briefs and channel-specific draft candidates from approved evidence; no public distribution occurs without reviewer approval.
4. **Report narrative assistance** — summarize observed, comparable measurement changes with limitations; it must never claim ranking guarantees or causal attribution.

Every model invocation must retain: capability, provider extension, model identity, prompt-template version, input/output references, execution state, failure detail, and human-review requirement. Generated content is additionally checked for unsupported measurable-performance, guarantee, ranking, and citation claims. A reviewer cannot approve a draft while a flagged claim remains unresolved; an approval creates an immutable content snapshot. Public distribution is represented only by a reviewer-created human-work task that retains owner, channel, target queries, constraints, schedule, status, and a workspace-scoped proof artifact before completion; the Harness never auto-publishes the content. Secrets are never stored in prompt artifacts or descriptors.

The Harness centrally blocks and audits requests for fabricated reviews, fabricated citations, deceptive link schemes, and unreviewed mass publication. A read-only guardrail inventory is exposed to workspace members so teams can understand why a request was rejected and choose a compliant alternative.

The current local pilot creates **AI-ready prompt packages** for content briefs and runs an internal evidence-safe template composer for channel-specific draft scaffolds. The composer is explicitly recorded as non-LLM and its output remains provisional. The system does not call an external model until an authorized model-provider extension and credentials are configured. This is deliberate: an unconfigured provider fails closed rather than silently fabricating an AI result.





## Product-neutral validation boundary

CoreNote is a validation tenant and optional evidence adapter, not a product dependency. The same governed AI workflow supports any approved B2B enterprise evidence source, market, provider cohort, content channel, and reviewer policy.

