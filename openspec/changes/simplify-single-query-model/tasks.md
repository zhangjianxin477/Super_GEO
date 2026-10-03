# Tasks

## 1. Single-model backend behavior

- [x] 1.1 Designate a newly saved Query-generation connection as the sole model eligible for Query generation, retain other provider configurations for authorized workflows, and migrate legacy workspaces to their best verified model.
- [x] 1.2 Classify authentication, configuration, quota, upstream, and timeout connection-test failures into safe diagnostic messages, and verify API tests do not reveal API keys.
- [x] 1.3 Preserve verified-connection gating for AI Query generation, and verify the existing generation settings test covers the only current verified model.

## 2. Focused Query-model experience

- [x] 2.1 Replace the multi-connection settings screen with a compact single-model configuration form and status panel, and verify component tests cover unconfigured, verified, testing, and failed states.
- [x] 2.2 Remove connection-page prompt editing and prompt optimization UI, and verify these controls are absent from the model-settings screen.
- [x] 2.3 Add responsive, accessible styles for field labels, inline diagnostics, focus states, and narrow screens, and verify no horizontal overflow at desktop and mobile widths.

## 3. Integration verification

- [x] 3.1 Run server tests, client tests, OpenSpec validation, and production build; verify all targeted checks pass.
- [ ] 3.2 Restart local API and Vite services, inspect the rendered Query-model page, and verify the current successful model appears as connected.



## 4. Query workflow completion and Prompt governance

- [x] 4.1 Add a verified-only return action from the Query model settings screen to the core Query baseline workflow and cover it in component tests.
- [x] 4.2 Implement baseline-owned Prompt management with required-variable validation, rendered-context preview, version history, explicit restore-as-new-version, and review-only LLM optimization suggestions.
- [x] 4.3 Make LLM Query generation visibly execute with input receipt, in-progress feedback, focused review handoff, and inline diagnostic failures; preserve a clearly separate template fallback.
- [x] 4.4 Add frontend and API coverage for Prompt version operations, model-return handoff, and observable generation, then re-run application verification and local browser QA.
