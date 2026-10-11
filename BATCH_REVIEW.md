# Snake Forever nine-change batch review

Updated: 2026-10-11. Coordinator: GPT 6.1 Sol, high effort, local Jimothy.

- Integration thread: `mcp:4179fc65-6476-4132-ab6c-582e4df713e3`.
- Integration checkout: `C:/Users/wehin/.t3/worktrees/IdleSnake/task-colony-batch-20261011`.
- Branch: `task/colony-batch-20261011`; baseline: `31e773efee60c85d6781078803e4eae208911e4e` (local active working at launch).
- Home: `915f73b5-2a00-44c0-ad8b-61e81d820388`. Final handoff request ID: `colony-batch-review-pr-20261011`.
- Deliver one PR targeting `working`. No merge into working/main, deployment, release bump, unrelated workflow changes, browser automation, or computer use.
- Preserve root checkout balance work (.github workflows, README/package, simulation/, scripts/balance.js); never copy its uncommitted changes into this branch.
- Claims apply per worktree. Remove this coordinator's claim at each turn completion.

## Existing workers (do not duplicate)

| Scope | Branch | Thread | State | Reviewed commit / task IDs |
| --- | --- | --- | --- | --- |
| 1, 6, 7, 9 UI | task/colony-ui-20261011 | mcp:4ee92de7-753a-47f6-84bd-7027e32edf3e | Independent review running | Candidate 082ac59b7c46bb13be9dcd85e49b101af641def8 |
| 3, 4, 5, 8 economy | task/colony-economy-20261011 | mcp:fd026147-88dc-4aae-8b42-576f1e265fa6 | Independent review running | Candidate 3e8d01e58ed641999c9da6f2551fa9c7fcfdc4cc |
| 2 Seed grace | task/seed-turn-grace-20261011 | mcp:57410d23-3950-46db-933b-7d760f1a72ce | Independent review running | Candidate e4032fe0677dd8b3401ac541255449c0c7049979 |

Each checkout is a sibling under `C:/Users/wehin/.t3/worktrees/IdleSnake/`. Workers send completion here with stable request IDs `colony-ui-20261011-complete`, `colony-economy-20261011-complete`, `seed-turn-grace-20261011-complete`.

## Acceptance conditions

1. Length bonus beside income, numeric portion yellow; preserve HUD labels and all themes/small layouts.
2. Classic Snake retains heading at/after 85% of tick before entry into a Seed. Before 85% steering remains normal. Keep latest legal turn for after Seed entry when safe; no duplicate steps/rewards. Restriction excludes empty squares, other targets/modes. Verify 84.9/85/99%, speed variants, legal/illegal inputs, timestamps, late correction, pause, deterministic stepping and approved tongue Seed return compatibility.
3. Hatchlings mature by elapsed time with zero Seeds, no feeding gate or Seed deductions. Preserve eggs, durations, saves and offline/catch-up; adult upkeep stays.
4. All Colony Seed/Branch/Provision production is ten times baseline, once, preserving modifiers/Notables/length order. Costs, consumption, stockpiles, eggs, food rewards and hatch-time effects are not scaled.
5. First habitat accessible; later habitat unlock/display requires five snakes in immediately previous habitat with dependency chain. Authoritative placement/upgrades enforce condition. Show `Next habitat in X Snakes` below last regularly available habitat, X=max(0,5-previous count). Verify 4/5 thresholds, chain, migrations and settlements; preserve legacy populations/save data.
6. Every habitat secondary byline uses current authoritative effect/rate, signed `Effect: +X Resource/Time` or `Effect: -X Effect/Time`; correct units including nonproduction hatch reductions. No invented effects or stale literal rates.
7. Notables: back top left to Colony; plain `(x/y)` top right. Zero candidates hides candidate area; one compact square candidate with Keep/Reject below when pending. Full queue remains engine-owned and is handled sequentially. Preserve accept capacity/rejection/replacement semantics, pending badge, functional labels/accessibility and assignments. No queue controls/redundant instructions. Roster Unassign and red Dismiss side by side; preserve served leaders' Retire versus unserved Dismiss behavior.
8. Eligible assigned Notables accrue real service even when effect output is zero. No render accrual/duplicates. Verify pause/offline/unassign/reassign/settlement behavior. Compact UI refreshes labels appropriately.
9. Remove Colony consumption tracking displays and abandoned controls/gaps; retain adult consumption mechanics.

## Coordination decisions to verify

- Economy owns habitat build/render progression portions in game.js. UI owns Notables/HUD/effect labels, obsolete nursery feeding display removal and service refresh in syncPanels (in-place labels, avoid per-tick roster rebuild).
- Keep activation.perSnakeRates as scaled production; add activation.upkeepPerSnakeRates for unchanged adult costs and habitatProvisionOutputs for producer labels. habitatPanel exposes per-habitat seedRate/branchRate/provisionRate/foragerRate and base/current effect fields; eggHatchReduction is not scaled.
- Proposed save compatibility: occupied legacy higher habitats keep their populations and production, are displayed explicitly as legacy/blocked, and cannot accept placement/upgrades until preceding five-snake chain restored. Empty locked habitats remain hidden. This needs independent review evidence.
- Service accrual continues with passive economy during pause/offline, consistent with existing mechanics; assigned populated habitat eligibility independent of effect totals.
- Economy confirms habitatPanel.seedRate includes length bonus and owns the overview totalIncome one-line update. Preserve it alongside UI byline changes when resolving shared renderHabitats.
- Existing browser scenarios must follow intentional UI changes without losing coverage: UI owns notable-candidates.spec.js sequential Keep/Reject updates; economy owns feeding-control expectation updates in fullscreen-mode.spec.js and snake-batch.spec.js. These run in existing GitHub CI only; no local browser permission.

## Worker evidence received (not yet independently accepted)

- UI reports direct Node VM checks of actual renderer plus engine: pending transitions 7→6→5→4→3→0, exactly one visible card, capacity-rejected Keep preserves candidate, Reject, Dismiss preserves queue, Unassign, served replacement archives leader, badge/count and hidden zero state. Service refresh retains control DOM identity and updates Retire label. Reports 35 targeted engine tests passed and baseline npm run check passed 335 tests. Exact committed tip and independent review remain pending.
- Seed completed/pushed tip `e4032fe0677dd8b3401ac541255449c0c7049979`; coordinator confirmed branch identity and clean task worktree. Worker reports syntax/authority plus 350 Node tests passing, including 15 new Seed acceptance cases; diff whitespace and six `/test2/` HTTP asset comparisons passed. Scope: session.js, snake.js, seed-turn-grace.test.js, timestamp adjustment in retained snake-batch correction test, BRANCHES.md. No browser use. Full acceptance includes 84.9/85/99%, imminent buffered heading, latest legal request surviving invalid follow-ups, full buffer precedence, post-pickup safe release, pause/save/reload/speed changes, timestamp correction and deterministic slices, approved tongue compatibility. These are worker claims until coordinator checks and independent review.
- Seed buffering caveat to review explicitly: existing earlier legal turns retain precedence; unsafe deferred request is discarded at canonical pickup. Grace request is separate from tongue presentation queue. Pre85% delayed input retains 34ms correction; at/after85% replay preserves consumption/rewards and omits movementCorrected tongue-reset event. Branch must not drift without requested review fixes.
- UI completed/pushed `082ac59b7c46bb13be9dcd85e49b101af641def8`; coordinator confirmed identity and clean worktree. Six files: game.js, index.html, styles.css, tests/browser/notable-candidates.spec.js, scripts/check-colony-ui.js, BRANCHES.md. Reproduce VM acceptance with `node scripts/check-colony-ui.js` in UI checkout; worker reports all candidate/service scenarios above plus current Seed/Branch/Provision/Lake effects and tiny nonzero rate precision. Targeted `node --test engine/notables.test.js engine/length-bonus.test.js engine/ui-boundary.test.js` reports 35/35; npm run check reports 335/335 plus syntax/authority; diff whitespace and route HTTP page/game/CSS checks passed. Not independently accepted yet.
- UI effect semantics: provisionRate + (foragerRate default 0), Lake `-X Hatch Sec/Egg`; seedRate expects length included by economy. Preserve economy progression, totalIncome=panel.seedIncomePerSecond and `.habitat-card[hidden]` during integration. Service labels update in place and hold callback reads current hasServed; replacement/Retire semantics remain. Browser specs, focus, narrow geometry and all theme fit remain unverified locally.
- Economy progress (final tip pending): worker reports 346/346 Node tests, syntax 119 JS and authority 11 modes. New 11-case colony-progression suite covers zero-food time-only maturation online/offline/persistence, output/modifier/cost separation, 4/5 chain, legacy populations/reduced-save relock, founding/established settlements, zero-effect service/pause/offline/unassign/reassign/read-no-accrual and migration high-water marks. No live removal action exists, so prerequisite reduction uses canonical saved economy. Feeding browser expectations adapted but require UI removal; not executed locally.
- Economy final completed/pushed tip `3e8d01e58ed641999c9da6f2551fa9c7fcfdc4cc`; commits bf5c544 (engine/tests) and 3e8d01e (progression/spec/log). Worker reports final targeted 138/138, npm run check 346/346, clean worktree and exact remote. Existing 15-minute maturation and 5/10-minute milestones preserved; historical resource/service totals untouched; passive pause/offline service requires assigned working populated habitat in established settlement. Faster output intentionally supports more adult upkeep/eggs.

## Independent coordinator checks and delegated reviews

- All workers returned before checks/reviews began. Coordinator inspected each diff against baseline, including adapted existing tests and cross-branch interfaces.
- Exact-tip individual `npm run check` reruns passed: Seed 350/350, UI 335/335, economy 346/346; all syntax/authority checks passed, no skips/failures. UI `node scripts/check-colony-ui.js` independently passed candidate/service/effect acceptance. Diff whitespace checks passed; all task worktrees clean.
- Refreshed direct HTTP verification: 12 assets each on /test2, /test3, /test4 match frozen checkout tips. All 27 protected unrelated root-file hashes still match baseline.
- Three T3-owned read-only reviews launched with local provider codex/model gpt-6.1-sol/reasoningEffort high selected at creation. Each prompt contains original worker brief verbatim, full batch acceptance reference, worker claims, coordinator evidence and concrete concerns. No nested reviewers/browser execution authorized. Completion wakes coordinator; no polling monitors.
- Coordinator concerns sent for review, not yet accepted findings: mixed-resource Notable contribution totals still labeled Seeds; next-habitat message appended below visible legacy cards rather than immediately after last regularly available habitat.

| Review | Stable clientRequestId | taskId | State |
| --- | --- | --- | --- |
| Seed round 1 | colony-batch-seed-review-r1-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-seed-review-r1-20261011 | Running |
| UI round 1 | colony-batch-ui-review-r1-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-ui-review-r1-20261011 | Running |
| Economy round 1 | colony-batch-economy-review-r1-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-economy-review-r1-20261011 | Running |

## Review and integration sequence

1. Wait for all three worker completions; end turns while waiting (no polling monitors).
2. Independently inspect each complete diff against baseline and run appropriate checks in that worker checkout. Freeze and record exact reviewed tips; detect subsequent drift.
3. Delegate independent read-only reviews using T3 delegate_task, local provider `codex`, model `gpt-6.1-sol`, reasoningEffort `high` selected at task creation. Include original scoped brief, acceptance, worker evidence and unresolved findings. Record every taskId. New rounds use fresh delegate_task and distinct stable clientRequestId. Send fixes to original implementation thread, then re-review changed tips.
4. Only after each passes, merge all three exact reviewed tips here with merge commits. Resolve conflicts preserving the full batch. Re-run npm run check and cross-feature regressions.
5. Push this branch and create one preferably draft PR to working. Preserve existing CI triggers/tests/exceptions; confirm drafts run CI. Body describes all nine conditions, review commits/task evidence, tests, preview, compatibility and visual gaps.
6. Immediately link PR to integration and home using link_pull_request; before finishing list_thread_pull_requests and repair missing links. Report tool failures honestly.
7. Send home the PR, commits, review evidence, CI state, preview and concerns with mode auto/request ID above. Instruct home to use watch_pull_request; home owns babysitting and notifying William when review-ready. Do not create own watcher.

## Preview and verification record

- Existing shared server: PID 10940, port 4173; launcher `C:/Code/IdleSnake/.git/shared-test-server.cjs`, dynamic routes `C:/Code/IdleSnake/.git/local-test-routes.json`. Coordinator is sole route editor; do not restart server.
- Existing `/test1/` remains approved tongue checkout. Reserve `/test2/` Seed, `/test3/` UI, `/test4/` economy, `/test5/` integration; primary `/` remains root working.
- App HTML scripts/styles/images use relative assets, compatible with trailing-slash route base. Verify actual HTTP bytes and checkout identity for each route.
- Baseline `npm run check`: passed syntax, authority and all 335 Node tests (0 skipped). No browser tests run locally.
- Initial direct HTTP verification: 10 assets per route matched exact mapped checkout (HTML, game/CSS, session/queries, approved tongue engine/draw, theme kit/official CSS and image); primary game.js matches root working. Recheck after workers finish and integration merges.
- Root preservation baseline: SHA-256 hashes for 27 unrelated modified/untracked root files saved locally in this worktree's git directory as `batch-root-preservation.json` (not committed).
- All visual smoothness/layout/theme fit/accessibility by eye remain unverified until William tests. Direct engine/VM/HTTP checks cannot prove them.
- PR: not created. Independent reviews: round 1 running for all three. No feature branch integrated yet.
