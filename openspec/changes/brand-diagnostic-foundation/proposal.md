# Proposal

## Why

The current diagnostic landing page is a presentation-oriented prototype, while enterprise GEO teams need an auditable project workspace that defines scope, verifies brand facts, freezes a comparable baseline, and hands evidence-backed work to later workflow stages. This change establishes that foundation so a project is genuinely usable before any platform observations or content actions are claimed.

## What Changes

- Replace the marketing-like diagnostics entry view with a real diagnostic project center that exposes state, blocking conditions, coverage and next actions.
- Add a five-step diagnostic setup workflow for project scope, audited brand facts, query scope, collection plan and baseline freeze.
- Add a diagnostic detail workspace with flat project tabs for scope, facts, query dataset, collection evidence, baseline results, recommendations and activity.
- Add workspace-scoped persistence and APIs for diagnostic projects, facts, sources, query scopes, collection plans, baseline freezes, activity events and recommendations.
- Connect the diagnostic UI to the API, with explicit controlled-manual-import labeling and no claim that third-party models were automatically operated.
- Seed a small, clearly marked demo workspace and add API/client coverage for the editable diagnostic lifecycle.

## Capabilities

### New Capabilities
- `brand-diagnostic`: Creates, governs and freezes an enterprise GEO diagnostic project with evidence, reproducible collection scope and downstream actions.

### Modified Capabilities

None.

## Impact

Affected areas include `src/App.tsx`, client data access and styles, the local Node API and SQLite repository/migrations, seed data, and the server/client test suites. No external scraping, browser automation, model-provider API integration, or automatic publishing is introduced.
