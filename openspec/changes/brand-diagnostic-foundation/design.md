# Design

## Context

See `proposal.md` for the product motivation. The local product already has a React/Vite UI, a Node HTTP API, a SQLite-backed `HarnessRepository`, controlled-manual collection language, and multiple later-stage workflow prototypes. Existing onboarding tables are insufficient for project-level versions, facts, collection plans, freezes and activity. The implementation must make the brand diagnostic screen a functioning enterprise project center without making claims about unconnected third-party model execution.

## Goals / Non-Goals

**Goals:**
- Add a workspace-isolated persisted diagnostic project lifecycle with facts, scope, plan, baseline snapshot, recommendations and activity.
- Replace the current diagnostic hero with a dense but readable enterprise project center and a flat detail workspace.
- Support a five-step setup UI that saves to the API and exposes real validation blockers.
- Preserve evidence provenance and distinguish pending / manually imported / approved data states.

**Non-Goals:**
- No automated operation of consumer model websites, CAPTCHA bypass, scraping, external publishing or provider-specific credential execution.
- No generic composite GEO score and no invented observation, citation or exposure metrics.
- No expansion of subsequent Query, testing, content or reporting modules beyond handoffs / navigation.

## Decisions

### Persist diagnostic domain separately from onboarding
Use diagnostic-specific SQLite tables linked by `workspace_id` and `brand_id`, rather than reusing onboarding records. This keeps prior onboarding behavior stable and allows immutable baseline snapshots. Alternatives considered: embed JSON in the existing assessment record (rejected because source-level review and versioned freeze require queryable audit fields); modify query dataset tables directly (rejected because project setup often precedes a published dataset).

### Baseline freeze uses server-side snapshot validation
The repository will snapshot approved facts, query scope and collection plan in one transaction only after server validation. The snapshot is immutable; later updates to inputs surface a rebaseline-needed condition. This prevents a later workflow run being falsely comparable with a changed scope. Alternatives considered: front-end-only disabling (rejected because it cannot protect API consumers); copying state client-side (rejected because audit state would drift).

### Single project-center IA
The diagnostics route uses a project table/row-first overview, primary actions at the top, a flat project header and horizontal tabs. Nested workbench sidebars and decorative metric cards are avoided. The setup flow uses top-progress steps and an editable review screen. This follows an enterprise operations pattern where state and next action are clearer than marketing explanation.

### Controlled manual import as an explicit collection provider
`controlled-manual` is the MVP collection mode and appears in the plan, activity and empty state. The API represents it as a valid mode, but it does not enqueue or pretend to run model searches. Later provider gateway / MCP integrations can be added behind the same plan abstraction.

### Role boundary at API edge
A minimal actor header maps the current local development actor to a workspace role. Viewers may read; editors may edit projects, facts, scopes and plans; reviewers may approve facts / freeze baselines. This preserves the current local development setup while making the mutation boundary testable.

## Risks / Trade-offs

- [Existing repository is large and convention-heavy] → add focused repository methods and table migrations, then cover them with server tests.
- [MVP manual intake can be mistaken for automatic execution] → repeat the controlled-manual label where plans and evidence are shown; do not render performance outcomes without observations.
- [A project may grow too much UI density] → show status / next action in the list and use flat detail tabs instead of a second navigation system.
- [Scope modification after freeze can confuse users] → retain baseline snapshot and flag rebaseline required rather than overwrite historical values.

## Migration Plan

1. Add a migration for diagnostic project, fact, source, scope, plan, baseline and activity tables.
2. Backfill a labelled demo project as development seed data only.
3. Release API endpoints first, connect the client, then run server, client and production-build verification.
4. Rollback by reverting UI use of the endpoints; snapshots remain additive and do not alter existing workflow data.
