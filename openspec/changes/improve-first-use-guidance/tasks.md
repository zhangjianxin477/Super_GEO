# Tasks

## 1. First-use guidance and recovery

- [x] 1.1 Add a Chinese first-use progress card to incomplete live dashboards that states the current stage, why the first answer matters, saved progress, and one primary action; verify the component test renders only the contextual primary action.
- [x] 1.2 Make all prerequisite gates state the missing evidence in operator language and navigate to the correct next step; verify gate tests cover analysis, content, and report routes before an assessment completes.

## 2. Controlled-manual task handoff

- [x] 2.1 Add a centrally maintained official-platform URL mapping for supported Chinese and overseas AI platforms and render an “打开 [平台]” external link for claimed tasks; verify manual task tests cover mapped and unmapped platforms.
- [x] 2.2 Preserve explicit controlled-manual boundary copy next to the external handoff and keep task recovery behavior unchanged; verify the existing refresh/recovery integration test passes.

## 3. Quality verification

- [x] 3.1 Add accessibility-aware frontend tests for first-use actions, provider handoff links, and recovery routes; verify `npm test` passes.
- [x] 3.2 Run `npm run verify`, validate this change with `openspec validate improve-first-use-guidance --strict`, and perform local browser smoke checks for task recovery, provider handoff, and gated-route recovery.
