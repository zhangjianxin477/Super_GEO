# Proposal

## Why

B2B SaaS companies are increasingly discovered and evaluated through AI answers rather than only through search-result pages, yet teams cannot reliably measure whether their brand is mentioned, recommended, cited, or described accurately across domestic and international AI platforms. Existing knowledge-workspace capability in CoreNote can supply verified product evidence, but it does not provide a repeatable GEO workflow that turns that evidence into query testing, competitive insight, channel-specific content work, and measurable client delivery.

This change establishes an MVP for a GEO Growth Harness: an enterprise-facing, end-to-end workflow that validates CoreNote as the first customer case while remaining reusable for cross-border SaaS clients operating in both China and overseas markets.

## What Changes

- Introduce a multi-tenant GEO workspace that captures a client’s brand facts, products, markets, competitors, and approved evidence sources.
- Introduce a query-lab workflow for creating, classifying, reviewing, versioning, and reusing Chinese and international GEO query datasets.
- Introduce an AI-answer observatory that executes or imports repeatable multi-model answer tests and preserves prompt, time, locale, raw answer, cited URLs, and run metadata.
- Introduce GEO intelligence that scores brand mention, recommendation, citation, factual accuracy, competitor gaps, and diagnostic causes.
- Introduce a content-strategy studio that turns verified evidence and diagnostics into channel-specific content briefs and draft assets, with mandatory human approval before publication.
- Introduce measurement and reporting that compares baseline and follow-up runs using the same query cohort, links changes to content actions, and produces customer-facing reports.
- Introduce a CoreNote connector contract that reads evidence from CoreNote where available and supports manual/website sources as fallbacks; this avoids rebuilding the knowledge-workspace function.
- Define an adopt-first engineering policy: evaluate stable, actively maintained open-source or GitHub modules for commodity capabilities (connectors, queues, workflow execution, crawling, extraction, observability, evaluation, charts) before custom implementation; use custom code only for proprietary GEO workflow, scoring, and domain rules or where no suitable component meets requirements.
- Exclude automated mass publishing, guaranteed AI ranking outcomes, low-quality link schemes, and unreviewed public brand claims from the MVP.

## Capabilities

### New Capabilities

- `geo-workspace`: Creates isolated enterprise GEO workspaces and captures approved brand, product, market, competitor, and evidence configuration.
- `geo-query-lab`: Builds and governs reusable Chinese and international query datasets with intent, locale, priority, and expected-fact metadata.
- `ai-answer-observatory`: Runs or imports reproducible AI-answer tests and stores normalized answer evidence, citations, and execution metadata.
- `geo-intelligence`: Extracts visibility, recommendation, citation, factual-accuracy, and competitor-gap signals and produces actionable diagnoses.
- `content-strategy-studio`: Produces evidence-grounded, channel-specific content briefs and drafts through reviewable workflows.
- `geo-measurement-reporting`: Compares baseline and follow-up query cohorts, attributes outcomes to tracked actions, and creates client-ready reports.
- `corenote-evidence-connector`: Imports CoreNote knowledge as versioned, source-linked brand evidence with fallbacks for manual and website sources.
- `harness-extension-contract`: Defines the minimal reusable contract for knowledge adapters, model providers, analysis skills, content skills, workflows, audit events, and future plugins.

### Modified Capabilities

- None. This project has no existing OpenSpec capabilities.

## Impact

- Creates a new product specification set and a future application codebase for the GEO Growth Harness.
- Integrates with CoreNote as the first evidence provider and validation case without changing CoreNote’s knowledge-management scope.
- Requires configurable domestic and international model providers, website/content-source ingestion, controlled public-web research, and a durable data store for query runs and evidence.
- Requires role-aware approval, auditability, and retained raw results because public-facing brand output and AI answer claims must be traceable.
- Requires an adoption review for each non-domain technical module before implementation; selected GitHub dependencies must meet license, maintenance, security, compatibility, and operational-fit criteria.
