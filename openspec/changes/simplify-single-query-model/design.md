# Design

## Context

See `proposal.md` for motivation. The existing settings API models providers as a history of configurations, while the UI displays provider cards and prompt-governance controls. That structure is useful for a broad platform but conflicts with the immediate operator task: prepare one verified model for Query generation.

## Goals / Non-Goals

**Goals:**
- Make connection setup a short, legible form with a single primary action.
- Preserve configuration history without allowing stale configurations to participate in generation.
- Convert provider test failures into safe, specific recovery guidance.
- Keep API-key handling unchanged in its secrecy guarantees.

**Non-Goals:**
- Support simultaneous model routing or multiple active Query-generation models.
- Move prompt authoring from Query research into this settings page.
- Automate interactions with external consumer AI surfaces.

## Decisions

### Current configuration is selected server-side
The server will explicitly designate the most recently saved Query-generation configuration as the current model. Other provider configurations remain available to their own authorized workflows, but are excluded from Query-model selection. This creates one source of truth for orchestration without breaking existing provider integrations. For legacy workspaces without a designation, migration selects the best verified connection once.

### Use a dedicated compact UI rather than adapting provider cards
The existing screen will be replaced with a single form/status card. Provider presets remain available inside one selector with a custom option. This avoids a false implication that the user needs to configure every provider.

### Map failures into safe categories
The connection-test layer will classify HTTP statuses and timeouts into diagnostic codes/messages, then persist only those messages and limited metadata. Passing upstream response bodies through would be more detailed but risks leaking service/account information and produces inconsistent UI.

### Clear separation of model configuration and Query prompting
The model page owns credentials and connectivity. Query research owns prompt templates, variable controls, and generation actions. This preserves a mental model: configure the engine once, then use it in workflow context.

## Risks / Trade-offs

- [Existing integrations expect multiple configurations] → retain historical records and compatible API payload shapes; enforce only one active/executable record.
- [Upstream providers use nonstandard errors] → show a safe generic diagnosis with HTTP category and retry guidance.
- [A valid test later fails during generation] → retain last verification time and require Query generation errors to point back to the model settings screen.

## Migration Plan

1. Update repository selection so new saves disable prior active model records for the workspace.
2. Add safe diagnostic classification to the connection-test endpoint while retaining existing fields for compatibility.
3. Replace the UI and tests.
4. Run API/client tests, build, and responsive browser checks.
5. Roll back by restoring the prior UI only; historical connection records and secure credentials remain valid.


## Follow-up decisions: workflow handoff and Prompt management

### Successful model verification returns to the job to be done
A verified model is configuration completion, not the end of the workflow. The connection result will expose one clear secondary-to-primary continuation action that returns the operator to **核心 Query 与首轮基线**. It appears only after the current model has verified successfully, avoiding a false ready state.

### Prompt governance belongs in the baseline workspace
The baseline workspace owns the Query prompt because the prompt is meaningful only alongside a selected product profile, market, keywords, intents, and requested count. It will use a focused dialog rather than embedding a second nested form in the page. The dialog supports editable local drafts, required-token validation, rendered-input preview, saved version history, restoring a historic version as a new active version, and an LLM optimization preview which is never auto-saved.

### Generation needs an execution receipt
When the operator calls the model, the UI must enter an explicit running state that names the model, prompt version, market, locale, count, and selected intents. A successful response creates/selects the resulting Query set, communicates the number generated and provenance, and moves focus to the review stage. Failures remain inline with recoverable causes; template generation remains a separately labelled non-LLM fallback.
