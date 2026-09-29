# Branch status

## working — Reduced motion overhaul

- Category: accessibility.
- Purpose: stop the swallowed seed effect and make the game setting and device motion setting cover the same effects.
- Agent: Codex.
- Status: Ready to Ship.
- Tests: `npm run check` passed all 277 Node tests; all 6 focused accessibility browser tests passed.
- Version impact: none; the saved setting format is unchanged.
- Last update: 2026-09-28.
- Notes: reduced motion stops decorative effects while game pieces keep moving. The setting now explains its scope in the menu. This work is on `working` and awaits a ship instruction.


## local/quick-iterations — puzzle engine separation

- Category: refactor.
- Purpose: move shipped Snakebird and Sokoban content, selection, restart, and progression into the session.
- Agent: Codex.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: existing session and puzzle engines.
- Tests: 27 focused Node tests and both puzzle browser tests passed. Syntax and authority checks passed. All level definitions match the prior committed content.
- Full checks: npm run check passed, including all 229 Node tests. The full browser run passed 31 of 32 tests; the timed-out persistence test and its companion passed in an isolated rerun.
- Version impact: no save schema change or version bump.
- Last update: 2026-09-09.
- Notes: puzzle work is complete and ready for review. Concurrent game changes remain intact. No commit or release was made.

## local/quick-iterations — immediate classic Snake turns

- Category: controls.
- Purpose: move on valid turn input and reset the movement interval; preserve quick U-turns.
- Agent: Codex, side conversation.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready With Caveat.
- Dependencies: current session engine and shared UI changes.
- Tests: all 8 new engine tests and all 3 new browser tests passed against the current UI. Existing session tests passed after updating assertions for immediate movement.
- Full checks: two existing board-speed assertions do not match concurrent speed settings. A full browser run overlapped UI edits and failed; the focused control tests passed afterward.
- Version impact: no save schema change.
- Notes: other workspace changes remain intact. No commit or release was made.

## local/quick-iterations — Snake speed presets

- Category: feature.
- Purpose: add saved Turtle, Snake, and Rabbit movement presets to the 0 settings menu.
- Agent: Codex.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: existing board and growth speed rules.
- Tests: npm run check passed all 240 Node tests; all 37 browser tests passed with two workers. After the animal icons changed to filled clipart, the syntax check and both focused speed-control browser tests passed.
- Version impact: optional save field; existing saves default to Snake.
- Last update: 2026-09-09.
- Notes: presets apply immediately without resetting the run. The controls use colored turtle, snake, and rabbit clipart with accessible names. Existing board tuning is preserved. No commit or release was made.

## local/quick-iterations — shield consumption fix

- Category: fix.
- Purpose: keep active Snake shield charges synchronized with durable settlement upgrades.
- Agent: Codex.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: session-owned Snake simulation and settlement economy state.
- Tests: `npm run check` passed all 250 Node tests, including two shield consumption regressions.
- Version impact: no save schema change.
- Last update: 2026-09-09.
- Notes: each collision consumes exactly one shield, and the new count survives save and reload. No commit or release was made.

## local/quick-iterations — complete engine state boundary

- Category: refactor.
- Purpose: read engine snapshots directly in the UI; move lifecycle and remaining panel rules into the engine; provide a headless command-line host.
- Agent: Codex side task.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: completed puzzle, mastery, dimension, immediate-turn, and speed changes in this checkout.
- Tests: npm run check passed all 248 Node tests and syntax/authority checks. The full browser suite passed all 38 tests. After the final food/trade query extraction, all 3 affected smoke and browser/headless comparison tests passed again. The headless command completed a Snake run.
- Version impact: no save schema change; new session actions and reader/query modules.
- Last update: 2026-09-09.
- Notes: existing work and untracked files are preserved. No commit or release is requested.

## local/quick-iterations — Snake growth queue

- Category: fix.
- Purpose: queue apple growth and apply at most one segment every two movement ticks.
- Agent: Codex, side conversation.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: current Snake engine and session-owned immediate movement.
- Tests: `npm run check` passed all 253 Node tests; all 39 browser tests passed with two workers.
- Version impact: active run state adds `pendingGrowth` and `grewLastTick`; a new run resets both fields.
- Last update: 2026-09-09.
- Notes: apple rewards and respawn remain immediate. Collision checks use the current body and account for a tail that will stay during growth. No commit or release was made.

## local/quick-iterations — explicit Notable candidate decisions

- Category: fix.
- Purpose: keep every new Notable in the candidate queue until the player accepts or rejects it.
- Agent: Codex, side conversation.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: session-owned Notable state and the existing candidate menu.
- Tests: `npm run check` passed all 256 Node tests; both focused candidate browser tests passed.
- Version impact: no save schema change.
- Last update: 2026-09-09.
- Notes: Accept requires roster capacity. Reject removes only the selected candidate. Removing a retained Notable does not promote a queued candidate. No commit or release was made.
## local/quick-iterations — Notable candidate queue

- Category: UI and engine behavior.
- Purpose: separate the candidate queue from the selected candidate decision area and page the queue five candidates at a time.
- Agent: Codex.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: existing Notables roster and pending-candidate state.
- Tests: `npm run check` passed all 254 Node tests. The candidate browser test and isolated engine-boundary rerun passed. The full browser run passed 39 of 40 tests; its one engine-boundary timing mismatch passed on rerun.
- Version impact: no save-format change.
- Last update: 2026-09-09.
- Notes: decisions now target the candidate selected in the UI. No commit or release was made.

## local/quick-iterations — Fullscreen layout

- Category: UI.
- Purpose: unlock the fullscreen mode button at the purchased 15x21 board.
- Agent: Codex.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: engine capability query for board ownership.
- Tests: all 259 Node tests and 44 browser tests passed; keyboard toggle and narrow layout checked again after the final keyboard fix. Desktop screenshot checked.
- Version impact: none; layout only.
- Last update: 2026-09-09.
- Notes: equal desktop panels, hidden minigame controls, reversible without resetting the run. Narrow screens stack the panels. No commit or release made.

## local/quick-iterations — Speed curve and turn queue

- Category: gameplay.
- Purpose: apply presets to starting speed, use the S-shaped food curve, and prevent early movement from rapid turns.
- Agent: Codex.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: existing session clock and speed presets.
- Tests: all 263 Node tests passed. Full browser run passed 44 of 45; the ambiguous save-error selector was fixed, and all 11 relevant browser tests passed on rerun.
- Version impact: no save schema change.
- Last update: 2026-09-09.
- Notes: three queued turns, one consumed per interval; first Ready input remains immediate. Curve halfway count 25, exponent 3; shared maximum interval 82 ms. Fractional intervals retained. No commit or release made.

## local/quick-iterations — Collision grace

- Category: gameplay.
- Purpose: allow a late safe turn during a 120 ms fatal-collision window.
- Agent: Codex.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: session movement clock and turn validation.
- Tests: all 269 Node tests and all 47 browser tests passed.
- Version impact: none; active-run grace is not saved.
- Last update: 2026-09-09.
- Notes: wall and body grace, no unsafe-input timer extension, full interval after rescue, pause and reset handled. No commit or release made.

## local/quick-iterations — Relative turn timing

- Category: gameplay.
- Purpose: immediate first turn, half interval for repeated relative turns, full interval for alternating relative turns.
- Agent: Codex.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: existing turn queue and collision grace.
- Tests: all 271 Node tests passed. Full browser run passed 48 of 49; the engine-boundary test passed on isolated rerun. Relative keyboard timing tests passed.
- Version impact: none; turn timing is active-run state.
- Last update: 2026-09-09.
- Notes: direction keys remain absolute; timing uses the turn relative to the heading. Collision rescue still starts a full interval. No commit or release made.

## local/quick-iterations — Performance review changes

- Category: refactor.
- Purpose: reduce selector rebuilds, hidden panel updates, snapshot allocation, settlement normalization, drawing work, and discarded save serialization.
- Agent: six GPT-5.6 Luna subagents; reviewed and corrected by Codex.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: current engine boundary, menu, drawing, and save changes in this checkout.
- Tests: syntax and authority checks passed; all 277 Node tests passed. Deterministic comparison against the pre-change session matched snapshots, events, RNG use, and saves across all 11 modes with one and ten settlements, offline progress, and the first live tick afterward.
- Browser checks: all 55 tests passed in the final full run. Selector reuse, immediate panel refresh, shared controls, final grid pixels, resize, save validation cache, backup protection, and failed-write retries covered.
- Review corrections: removed repeated selector invalidation; preserved nursery caps and post-offline movement limits; removed the slower screen cache; restricted grid caching to larger boards and safe drawing state; removed frame-timing dependencies from the save cache test.
- Measurement: eight-second local Ready-state menu update mean fell from about 0.67 ms to 0.25 ms. Engine tick measurements varied; no general frame-rate gain is claimed. Large-grid drawing improved in a focused warmed drawing benchmark.
- Version impact: no save schema change or release version bump.
- Last update: 2026-09-09.
- Notes: gameplay timing and visible effects are preserved. Existing workspace changes remain intact. No commit or release made.

## local/quick-iterations — Shield impact animation

- Category: gameplay and UI.
- Purpose: show a small blue shield halo and make a consumed shield play a three-tick hit, bounce, shake, and safe-turn sequence.
- Agent: Codex side conversation.
- Base branch: existing local/quick-iterations checkout.
- Status: Ready for Review.
- Dependencies: session-owned Snake movement and the canvas renderer.
- Tests: all 277 Node tests and all 58 browser tests passed, including shield timing, queued input, pause, headless state, halo pixels, immediate purchase and consumption updates, and delayed redirect checks.
- Version impact: none; the impact state exists only during the active run and is not saved.
- Last update: 2026-09-09.
- Notes: a held shield shows a small blue arc ahead of the head. A collision consumes one shield immediately, freezes the body for three movement intervals, accepts valid queued turns behind the forced redirect, and pauses cleanly. No commit or release was made.
