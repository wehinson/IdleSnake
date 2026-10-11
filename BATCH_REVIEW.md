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
| 1, 6, 7, 9 UI | task/colony-ui-20261011 | mcp:4ee92de7-753a-47f6-84bd-7027e32edf3e | Implementing | Pending |
| 3, 4, 5, 8 economy | task/colony-economy-20261011 | mcp:fd026147-88dc-4aae-8b42-576f1e265fa6 | Implementing | Pending |
| 2 Seed grace | task/seed-turn-grace-20261011 | mcp:57410d23-3950-46db-933b-7d760f1a72ce | Implementing | Pending |

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
- PR: not created. Independent reviews: not started. No feature branch integrated yet.
