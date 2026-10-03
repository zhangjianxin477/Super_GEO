# Design

## Context

See `proposal.md` for the motivation. The current React screen has one fixed provider selector, separately saves configuration and credentials, and tests only an already executable row. The server rejects provider labels outside a hard-coded catalog, only keeps credential presence, and has no connection-test history. The browser request helper uses headers for session metadata, and the reported ByteString exception indicates a non-ASCII identity header path must be eliminated. Prompt versioning already exists, but the UI exposes variables as inline code without validation and lacks an AI improvement flow.

## Goals / Non-Goals

**Goals:**
- Provide an understandable three-stage setup (identity, connection parameters, save/test) with provider presets and custom labels.
- Enforce endpoint and prompt-variable validity on both sides of the API boundary.
- Persist a non-sensitive readiness/test state used by Query-generation selection.
- Add a non-destructive prompt optimization preview using an eligible verified connection.
- Retain auditability and the controlled-manual boundary for actual AI-platform observation.

**Non-Goals:**
- Automating third-party consumer AI websites, browser logins, or collection of their search/citation results.
- Supporting every proprietary API shape in this change; configured execution stays OpenAI-compatible Chat Completions.
- Returning, showing, or logging raw API credentials.
- Introducing background retries or provider health monitoring.

## Decisions

### Presets are convenience defaults; provider identity remains editable
The form will apply known base URL/model/market/locale defaults for common providers but submit an explicit editable provider label and parameters. The backend will accept a trimmed custom label plus valid market/locale rather than checking only the catalog. This lets enterprise gateways, OpenRouter, Ollama, and new vendors work without a release. We will retain the catalog for onboarding market-platform validation, because that catalog models supported real-platform collection rather than internal generation connectivity.

Alternative: expand the server catalog only. Rejected because it would repeatedly block legitimate compatible gateways and does not meet the custom provider requirement.

### A single save-and-test path has explicit state
The client will configure the provider, optionally write a credential, then invoke the test endpoint. The response and stored configuration will retain test status, timestamp, model, elapsed milliseconds, and a redacted recoverable message. Saved configurations can be re-tested, but an untested connection is not offered as verified execution-ready.

Alternative: make the UI infer verified state from the presence of endpoint, model, and key. Rejected because it cannot distinguish invalid keys/endpoints from working connectivity.

### Secrets stay in the dedicated credential path
Configuration and test records are non-secret fields. The API key is posted only to the existing credential endpoint and the response exposes only `configured` and `lastFour`. The browser will only send ASCII session headers (`x-user-id`, `x-workspace-id`) and will never pass a display name in a header.

Alternative: submit credentials inside a merged configuration body. Rejected to keep existing secret handling and audit separation.

### Prompt optimization is preview-first and variable-safe
A new endpoint accepts a verified connection ID, the current prompt, and a user goal. It renders an optimization instruction, requests a compatible chat-completions response, validates the returned prompt against required placeholder variables, and returns the suggestion only. The editor applies it only after user action, and saving creates the pre-existing versioned prompt record.

Alternative: auto-save LLM output. Rejected because it would change production Query behavior without review.

### UI emphasizes operational recovery over decorative cards
The React screen will use clear section hierarchy, inline required-field guidance, compact status badges, readable variable chips, `aria-live` success/error feedback, and responsive grids that wrap controls rather than clip them. This follows the UI research findings: inline validation, error messages located next to the input, and recovery instructions for failed actions.

## Risks / Trade-offs

- [Provider preset defaults become stale] → Keep all endpoint and model fields editable and label the preset as a starting point.
- [A compliant endpoint still has an incompatible response shape] → Return an explicit compatibility failure and preserve the configuration for adjustment.
- [LLM optimization returns unsafe or malformed text] → Treat output as preview only, enforce variable preservation, and retain the prior draft.
- [Migration is applied to existing local databases] → Add nullable test metadata with safe defaults; previously configured connections become `unverified` until manually retested.
- [Request header migration is incomplete] → Cover the API helper with a non-ASCII user-name test and do not send display names in headers.

## Migration Plan

1. Add nullable test metadata to the provider configuration storage and migrate local SQLite data.
2. Deploy backend validation, test state persistence, and optimization preview API before the client update.
3. Release the redesigned client. Existing stored connections remain visible but require a re-test before they become eligible.
4. Roll back the client safely because unknown persisted metadata is nullable; rollback server handling keeps legacy configurations usable as unverified.
