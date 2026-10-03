# GEO Intelligence metrics, diagnostics, and research rules

## Purpose and boundary

The GEO Growth Harness measures **observed answer evidence** from an immutable assessment cohort. It does not predict, control, or guarantee model rankings, citations, traffic, leads, revenue, or the effect of any content action. Each aggregate must be traceable to retained raw answer evidence, the selected market pack, and the approved evidence-pack version used for analysis.

Imported answer evidence remains visibly distinct. Controlled-manual imports are excluded from default metric denominators and can only be included deliberately through the `includeImported=true` option.

## Metric glossary

| Metric | Numerator | Denominator | Important exclusions / limitations |
| --- | --- | --- | --- |
| Brand mention rate | Eligible observations naming the configured client brand | Eligible completed answer observations | Queued, failed, and (by default) imported observations are excluded. A mention is not a recommendation. |
| Recommendation rate | Eligible observations where the configured brand appears in observable recommendation context | Eligible completed answer observations | Keyword baseline requires reviewer validation for nuanced language. |
| Owned-source citation rate | Eligible observations containing at least one citation classified as an approved owned source | Eligible completed answer observations | A listed URL is evidence of citation presence, not proof of traffic or influence. |
| Third-party citation rate | Eligible observations containing at least one third-party citation | Eligible completed answer observations | Does not score source quality, endorsement, or domain authority. |
| Factual-accuracy rate | Supported product claims | All claims assessed as supported, unsupported, conflicting, or insufficient evidence | `supported` means the deterministic baseline found support in the selected approved evidence pack; a reviewer remains responsible for final claim judgment. |
| Competitor visibility gap | Competitor-recommended observation count minus client-recommended observation count | Eligible completed answer observations | A positive result is an observed cohort gap, not a claim that competitors are better or that an intervention will close it. |

The API returns every metric’s numerator, denominator, rate, and linked observation IDs. Dashboard filters for market pack, provider, query intent, competitor, citation kind, and factual status only navigate evidence; they do not create independent scores.

## Factual assessment categories

- **Supported:** Product-specific terms align with one or more items in the selected approved evidence pack.
- **Unsupported:** The answer makes a sufficiently specific product claim but the selected evidence pack does not support it.
- **Conflicting:** The claim overlaps evidence marked as prohibited or explicitly negative.
- **Insufficient evidence:** The deterministic baseline cannot establish enough evidence context for a general statement.

Analysis retains the evidence-pack identifier and version. Subsequent evidence changes do not rewrite prior analyses. The baseline uses deterministic lexical matching and cannot infer a model’s hidden reasoning, intent, ranking system, sentiment, or causal mechanism.

## Diagnoses

A diagnosis links a material observed gap to its query IDs, observation IDs, gap category, recommended action, confidence, and uncertainty. Recommendations must say what evidence or content action could be tested, never promise a future mention, citation, ranking, conversion, or revenue outcome. All changes are evaluated observationally with compatible follow-up cohorts.

## Responsible competitor and source-ecosystem research

1. Use only permitted access: an approved adapter or controlled manual import. Do not bypass authentication, paywalls, robots controls, rate limits, or other access restrictions.
2. Store the source reference, source type, adapter identity, collection method, collector, collection time, extraction status, provenance, and findings.
3. Record `accessPolicy: permitted`; the API rejects bypassed-access input.
4. Preserve source attribution. Do not fabricate competitor claims, reviews, citations, placements, rankings, backlinks, or research outcomes.
5. Treat extraction failure as a retained failure state, not as permission to infer missing facts.
6. Obtain legal, contractual, and editorial approval before relying on material competitor claims in external content.

## Pilot dashboard and report glossary placement

The Intelligence dashboard exposes the same metric definitions through its drill-down context and routes every aggregate to answer evidence. Client reports must repeat this glossary, identify any incomplete provider or imported-answer exclusion, and label observed deltas as non-causal.
