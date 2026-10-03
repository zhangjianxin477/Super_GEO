# Baseline, follow-up, and client reporting workflow

## Baseline designation

An administrator or analyst with workspace-write permission designates a named immutable assessment run as a baseline. The designation records the workspace, logical key, run ID, actor, and timestamp; it never rewrites the run’s query dataset, provider snapshot, market pack, locale, raw evidence, or evidence version.

## Compatible comparison

A follow-up can produce deltas only when it preserves:

- the same market pack;
- the same locale;
- the same ordered provider set; and
- the same immutable query cohort.

When any condition differs, the API returns `comparable: false`, lists the reason and changed query IDs, and returns no deltas. Even compatible deltas describe **observed differences** only. They do not prove that evidence, content, or distribution actions caused a change.

## Action timeline

Distribution tasks are displayed with their owner, channel, task state, schedule or completion time, target-query IDs, and proof reference. A timeline is a contextual overlay next to the later assessment measurement; it must display the label: **“Observational timeline only — actions are shown alongside later measurements without asserting causality.”**

## Client-report contents

The report-generation endpoint creates a versioned, tenant-scoped report containing:

1. scope: client brand, market pack, locale, providers, and immutable cohort;
2. baseline and follow-up dates and collection completeness;
3. metric numerators, denominators, exclusions, and compatible observed deltas;
4. retained answer-evidence examples, citations, configured competitors, and diagnoses;
5. governed content/evidence/distribution actions;
6. recommended next actions with uncertainties; and
7. the GEO metric and responsible-research glossary.

Incomplete runs are permitted only when their queued, failed, or unavailable provider observations are prominently included as report limitations. Controlled-manual imported evidence is excluded by default and can be included only deliberately.

## No-guarantee rule

Report titles are validated against language that promises or claims causal GEO outcomes. The generated report uses the phrase “observed difference” and includes an explicit non-causality statement. It must never promise future AI visibility, mentions, citations, ranking, traffic, leads, revenue, conversion, or a model/platform result.
