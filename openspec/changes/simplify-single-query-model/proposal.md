# Proposal

## Why

The current model-connection screen exposes provider governance, prompt editing, and several parallel connection cards even though the immediate operator task is simply to connect one model for AI-assisted Query generation. This makes an already actionable failure state look opaque and discourages users from completing the first configuration step.

## What Changes

- Replace the multi-provider connection management screen with one compact **Query 生成模型** settings page.
- Make the saved Query-generation connection the only active connection for Query generation; retain other configurations for audit history and their authorized workflows, but exclude them from Query-model selection.
- Remove Prompt template editing and Prompt optimization controls from this settings surface; Query research owns those controls.
- Return safe, actionable connection-test diagnostics for authentication, configuration, quota, upstream, and timeout failures.
- Keep secret values encrypted and never expose API keys in API responses or UI state.

## Capabilities

### New Capabilities
- `single-query-model-settings`: Configure, test, and use exactly one active OpenAI-compatible model for AI Query generation.

### Modified Capabilities
- None.

## Impact

- Frontend: `src/ModelConnections.tsx`, `src/styles.css`, and API client/UI tests.
- Backend: model-provider configuration selection, connection testing responses, and repository persistence.
- Tests: Query-model screen states and secure, actionable test diagnostics.


## Follow-up: Query workflow handoff and Prompt governance

- After a successful connection test, provide an explicit, one-click return to **核心 Query 与首轮基线**.
- Keep prompt governance in the baseline workflow, not in model connectivity: operators can inspect, edit, validate, preview, version, restore, and optionally request an LLM optimization suggestion for the Query-generation prompt.
- Make each LLM generation observable: show the active model and Prompt version, a running state, clear success outcome, and actionable failures rather than a silent button click.
