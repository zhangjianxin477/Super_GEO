# Proposal

## Why

The current model connection screen makes a business-critical setup step feel unsafe and opaque: it restricts providers, does not make configuration state or recovery clear, and fails for Chinese user identities because an unsafe HTTP header is constructed in the browser. The Query prompt editor also exposes required variables and AI assistance as passive decoration instead of controlled, auditable actions.

## What Changes

- Replace the fixed provider-only connection setup with provider presets plus a custom-provider path, while retaining a strict server-side execution contract for OpenAI-compatible Chat Completions endpoints.
- Make save-and-test a guided, stateful workflow that identifies missing input, preserves secrets server-side, reports success metadata, and gives actionable non-sensitive failure recovery.
- Add persistent connection test metadata and stable status states so Query generation can select only verified executable connections.
- Turn the Query-generation prompt area into a governed editor: readable required-variable chips, inline validation, versioned save, and a non-destructive AI optimization preview that requires an eligible connection and preserves system variables.
- Keep the separation explicit between API connections for internal Query / Prompt AI operations and controlled-manual collection of real AI-platform visibility observations.
- Remove non-ASCII identity headers from browser requests so Chinese UI users can save and test configurations.

## Capabilities

### New Capabilities
- `model-connection-governance`: Configure, secure, test, and select preset or custom LLM connections for internal GEO AI actions.
- `query-prompt-governance`: Validate, improve, preview, and version the Query-generation prompt without silently overwriting the active prompt.

### Modified Capabilities
- None.

## Impact

- Frontend: `src/ModelConnections.tsx`, `src/api.ts`, `src/styles.css`, and model-connection tests.
- Backend: `server/application.mjs`, `server/repositories/harnessRepository.mjs`, migrations, and API tests.
- APIs: model provider configuration, credential, test, Query-generation settings, and a new prompt optimization preview endpoint.
- No API key is returned to the browser; real-platform testing remains controlled-manual and is not automated through the configured LLM connection.
