# Tasks

## 1. API safety and model connection state

- [x] 1.1 Remove non-ASCII display-name header handling from the browser API client and add a regression test for a Chinese user name.
- [x] 1.2 Allow validated custom provider labels and preserve editable preset-derived endpoint/model/market/locale values; verify API tests cover preset and custom setup.
- [x] 1.3 Persist non-sensitive test state, timestamp, model, latency, and redacted failure metadata for provider configurations; verify existing configurations migrate as unverified.
- [x] 1.4 Update the connection test endpoint to record recoverable outcomes and return safe status data; verify success and authentication/endpoint failure test cases.

## 2. Prompt governance APIs

- [x] 2.1 Enforce all required Query prompt variables during prompt version save and add API tests for valid and invalid templates.
- [x] 2.2 Add a preview-only prompt optimization API using only verified executable connections and verify it preserves required variables without creating a version.
- [x] 2.3 Record non-secret optimization provenance for auditability and verify no credential is returned by settings or preview responses.

## 3. Enterprise settings user experience

- [x] 3.1 Rebuild the model connection form around presets plus custom-provider input, field guidance, inline validation, and a save-and-test primary action; verify via component tests.
- [x] 3.2 Render connection readiness/test-result cards with verified, unverified, incomplete, and failed states plus direct recovery actions; verify no horizontal overflow at narrow desktop widths.
- [x] 3.3 Replace the passive Prompt section with variable chips, missing-variable feedback, versioned save, and a reviewable AI optimization drawer; verify the suggestion cannot silently overwrite the draft.
- [x] 3.4 Separate internal AI connections from controlled-manual real-platform collection in the page copy and verify the boundary is visible.

## 4. Integration verification

- [x] 4.1 Run server and frontend test suites, TypeScript checking, OpenSpec strict validation, and Vite production build; fix failures and record results.
- [x] 4.2 Restart the local API and web servers using Node 24, then visually inspect the settings flow including the Chinese user case and prompt layout.
