# Branch status

## working — Egg chance upgrade

- Category: engine and upgrade display.
- Agent: Codex.
- Status: Ready With Caveat.
- Changes: egg boards use a 0.5% egg chance per Seed spawn. Each Egg chance upgrade adds 0.5 percentage points, up to 100%. The first upgrade costs 500 Seeds; later costs multiply by 2.5. The upgrade applies to new egg spawns in the current run and saves per settlement.
- Tests: `npm run check` passed syntax, authority checks, and all 306 Node tests. Four new tests cover exact spawn thresholds, current-run purchases, saving, per-settlement levels, and the 100% limit. `git diff --check` passed. Browser appearance has not been checked for this change.
- Version impact: optional eggChanceLevel in version 5 saves; no release requested.

## working-claude — Button click sounds

- Category: display (audio).
- Agent: Claude, in folder `IdleSnake-claude`, because Codex had an active claim on `working`. Started from `working` commit 1125057 (not from main, which is 34 commits behind `working`), so the sounds apply to the current phone and menu layout.
- Status: Ready to Ship.
- Changes: every button press on the phone side (`.phone-shell`) plays `assets/audio/phone-double-tap.wav` (generated). Every button press on the main menu side (`.menu-panel`) plays `assets/audio/menu-click-el-boss.mp3` (Freesound 677861 "UI Button Click" by el_boss, CC0). The sound plays on pointer press, in capture phase, so buttons that act on pointerdown or stop propagation also play it. Keyboard activation (click with detail 0) also plays it. Disabled buttons are silent. The local server now sends audio MIME types.
- Files: scripts/ui-sounds.js, scripts/ui-sounds.test.js, assets/audio/, index.html, scripts/serve.js, README.md, BRANCHES.md.
- Tests: `npm run check` passed syntax, authority checks, and all 306 Node tests (4 new). A direct HTTP check returned both sound files with the correct audio types.
- UI verification: William approved an isolated browser check. Headless Chromium at desktop (1400x900) and phone (390x844, touch) sizes recorded each Web Audio playback. D-pad, Pause, Reset, Start, keypad 0, and Back to game played the double tap. The Nursery, Colony, and Upgrades tabs played the el_boss click. Locked keypad keys and the disabled Buy button were silent. Sound start was less than 1 ms after the press. No page errors. Enter on a focused button does not activate it, because the game blocks Enter as a game key; therefore it plays no sound (behavior from before this change). On the first press, the audio system can start a few milliseconds late while the browser unlocks audio. Loudness was not checked by ear.
- Version impact: none.
- Last update: 2026-10-03.

## working — Ready reload, settings controls, and Length Bonus

- Category: engine, controls, and display.
- Agent: Codex.
- Status: Ready to Ship.
- Changes: reload a finished Classic Snake run at Ready; Space closes settings; remove number-button focus outlines; add passive Seed Length Bonus and its upgrade; show passive Seed income per second in the Seed counter area, including any applied bonus.
- Bonus: count all segments at 1% each. Each upgrade adds 5 percentage points per segment. Apply only while Classic Snake runs and passive Seed production is available. Show the applied multiplier below the Seed counter.
- Files: engine/config.js, engine/economy.js, engine/migration.js, engine/save-projection.js, engine/session.js, engine/state-reader.js, engine/length-bonus.test.js, game.js, index.html, styles.css, tests/browser/working-followup.spec.js, tests/browser/smoke.spec.js, tests/browser/puzzle-modes.spec.js, and README.md.
- Tests: `npm run check` passed syntax, authority checks, and all 302 Node tests. Seven new engine tests cover income, upgrades, resources, growth, death, reload, and settlements. Four focused Chromium checks passed. The full 76-check browser run passed 74 checks and found two stale expectations that Reset restarts a paused run. Updated both tests to check the documented resume-first rule; their focused five-check rerun passed. All 76 browser checks have passed across the full run and focused rerun.
- Browser command: `node node_modules/@playwright/test/cli.js test --config .git/task-playwright.config.cjs --workers=2`; the private temporary config uses port 4187 and the repository's complete browser test directory. The shared port 4173 server stopped during an earlier focused run; all reported successful checks used the private server.
- UI verification: William approved isolated browser checks. Desktop and phone screenshots were inspected. The compact trackers fit the Seed counter, and the income tracker changes with the multiplier, upgrade, pause, and death. No known verification gap for this batch.
- Version impact: optional lengthBonusLevel in version 5 saves; no release requested.
- Last update: 2026-10-03.
- Notes: committed and backed up on working. Recommended for shipping when William requests it.

## working-codex-controls — Uniform body blocks

- Category: display.
- Agent: Codex.
- Status: Ready for review; main checkout has another active chat.
- Changes: removed random body size variation. All body blocks use their normal square size in play and during the death effect. Connector and grid settings are retained.
- Tests: `npm run check` passed syntax, authority checks, and all 293 Node tests. Two focused browser checks passed for uniform body sizes, cell centers, colors, stable pixels between steps, and a 224-block snake. Two obsolete size-variation Node tests were removed.
- UI verification: reused the existing permission for the long-snake appearance check; the fullscreen image was inspected.
- Version impact: none.
- Last update: 2026-10-03.
- Notes: separate checkout at C:/Code/IdleSnake-controls; preview at http://127.0.0.1:4175. The main checkout's active changes are preserved. No release requested.

## working — Stable block size variation and aligned grid

- Category: display.
- Agent: Codex.
- Status: Ready to Ship.
- Changes: removed body markings; connectors are 15% brighter than the body color and 25% thinner than the previous width. Each body block has a stable random area from 85% to 115% of normal. Both dimensions change together, with each block centered in its cell. Head and tail size stay unchanged. Live and death body blocks use the same size profile.
- Stability: sizes depend on body section index, do not consume gameplay randomness, and stay the same through movement, growth, pause, and saved-board reloads.
- Board: two-pixel grid lines share integer cell boundaries with the outline. Checker contrast is 15% less than before, reduced from 15% to 12.75%.
- Tests: `npm run check` passed syntax, authority checks, and all 295 Node tests. Four focused browser checks passed for cell placement, stable sizes and colors, a 224-block snake, connector width and color, grid contrast and alignment, pause pixels, and direct/cache parity through resize and fullscreen changes.
- UI verification: reused William's permission for the focused long-snake appearance check. Phone and fullscreen images were inspected. The size profile does not change between movement steps. No broad browser suite was run.
- Version impact: none. No release requested.
- Last update: 2026-10-03.

## working — Subdued moving body markings and board grid

- Category: display.
- Agent: Codex.
- Status: Ready to Ship.
- Changes: one base shade for all Classic Snake body blocks; three small marking shapes spaced 4.5 blocks apart slide along the body at 0.6 blocks per second; repeated block highlight strips removed. Pause freezes the markings; Reduced motion makes them static. The head and tail retain the chosen head color.
- Connectors: 50% wider, with a 10% brightness increase from the chosen body color that preserves its hue. Death connector debris follows the same color and width increase. Entire blocks do not alternate shades.
- Board: checker cells have approximately 15% brightness difference, with a stronger one-pixel grid aligned to canvas pixels. The cached grid includes the opaque background and fullscreen effect strength so cached and direct pixels agree.
- Tests: `npm run check` passed syntax, authority checks, and all 295 Node tests. Four focused browser checks passed for body colors and exact cells in all directions, a 224-block snake with sparse sliding markings and frozen pause pixels, grid contrast and connector width/color, and grid cache parity through resize and fullscreen changes.
- UI verification: William explicitly requested the browser check. Fullscreen, phone, and successive long-snake frame screenshots were inspected. The test confirms that less than 2% of board pixels change between steps while markings slide. No broad browser suite was run.
- Visual follow-up: the remaining repeated pattern comes mainly from screen scanlines. Softer scanlines would be the next display experiment; their strength is unchanged in this batch.
- Version impact: none. Movement speed, direction timing, collision rules, and save format are unchanged.
- Last update: 2026-10-03.
- Notes: changes are on working; no release requested.


## working-tongue — Tongue catch design ideas

- Category: display (design preview).
- Agent: Claude.
- Status: Tongue shipped to main as 1.0.1 (f69ffd7) on 2026-10-03, tongue commits only. This branch is kept as the reference for the next full ship: main's game.js has the tongue ported to its older plain variables (snake, foods, state), while the working branches use gameView. When working is next merged into main, keep the gameView version of updateTongueFrame, drawTongueCatch, and drawSnack from this branch.
- Changes: new engine module `engine/tongue.js` owns the catch timing and geometry. When a Seed is straight ahead within two cells, the tongue reaches out, grabs the Seed, pulls it to the mouth, and the Seed shrinks in the mouth until the head enters the Seed cell. Five styles: Forked Flick, Sticky Lasso, Pixel Ribbon, Curl Hook, Noodle Slurp. `tongue-lab.html` shows all five side by side with play/pause, speed (1x to 0.1x), a timeline slider, and a head color choice.
- Second set (default in the lab, "Set" menu): five Sticky Lasso variations with a forked tip: Fork Lasso, Wide Fork Snap (strong spring), Sticky Goo Fork (drops, web, drip), Whip Fork (wave and rubbery wobble), Double Snap (yank halfway, hold, snap). Engine adds `groups`, `stylesInGroup`, and the easings `outBackStrong`, `outElastic`, `twoSnap`.
- Fork shape (second set): one continuous silhouette. The body narrows slightly, then splits into two curved tines that taper to sharp points; soft shading across the width, a single outline, and a faint center groove. No separate prong shapes. Goo drops hang from the tine middles. Browser-checked in the still frames.
- Emerge phase (second set): each forked tongue slides about half a cell out of the mouth, holds with the prongs open and waggling, then shoots to the Seed. Each card also shows four still close-ups (Emerging, Half out, Full reach, Grab) from `previewMoments`.
- In the game: Sticky Goo Fork is drawn in classic Snake mode. game.js asks the engine tracker each frame (head, next direction, Seeds, step progress), hides the caught Seed from its cell, and draws the tongue and the held Seed under the head. Off for Reduced motion, other modes, and Game Over; frozen while paused. Eggs are not caught. Drawing is shared with the lab in `scripts/tongue-draw.js`.
- Tests: `npm run check` passed syntax, authority checks, and all 301 Node tests, including 9 new tongue tests (all directions, all ten styles, one-step and two-step catches, turn cancel, pause). A headless smoke run of the lab script with a stub canvas drew both sets at several speeds with no errors.
- UI verification: William gave permission for a browser check. In the built-in browser the lab loaded with no console errors; still frames and main-animation captures at the emerge, reach, and pull phases were inspected for all five forked styles. That check found the fork hidden under the Seed during the reach and an almost instant Whip Fork pull; both were fixed and checked again. The first set of five was not re-inspected. Game check: in an isolated frame with timer-driven frames, a scripted run caught two Seeds (moving up and moving left); emerge, reach, pull, and hold frames were inspected.
- Version impact: none. Display only; movement, eating, score, and saves are unchanged.
- Last update: 2026-10-03.

## working-codex-controls — Controls and fullscreen follow-up

- Category: engine controls and display.
- Agent: Codex.
- Status: Ready for review.
- Changes: Settings opens during Game Over; game controls clear button focus without a green mark; all gameplay controls resume a paused run; pause freezes swallowed Seeds, crumbs, and tail motion; fullscreen menu width increases by 25%; a Minigames button between Start and Phone Mode lists game names with engine-owned unlocks; fullscreen controls move up 10 px.
- Tests: `npm run check` passed syntax, authority checks, and all 292 Node tests. New checks cover every gameplay control in every mode, minigame names and unlocks, and display time across repeated pauses.
- UI verification: a focused browser check is prepared. Permission was requested; no reply received yet. Button focus, settings display, paused food effects, and fullscreen layout have not been checked in a browser for this batch.
- Version impact: none.
- Last update: 2026-09-30.
- Notes: this batch uses a separate checkout because another chat was active. No release requested.

## working — Body pattern merged from working-codex

- Category: display.
- Agent: Codex.
- Status: Merged into working; ready for William to test.
- Changes: the head, body, and tail snap to their occupied cells at once. Merged the final body pattern from working-codex while preserving the controls iteration.
- Direction: show forward progress from cell to cell; no sideways movement or waviness.
- Color test: starting behind the head, body segments repeat two dark segments and one 5% lighter segment. The pattern is anchored to the head, so growth extends it at the tail. The head and tail both use the selected head color, including during the death effect.
- Tests: after merging with the controls iteration, `npm run check` passed syntax, authority checks, and all 292 engine tests. The focused isolated browser check passed for two repeated dark/dark/5% lighter bands, exact cell positions in all four directions, unchanged pixels between steps, all eight body colors, all eight head/tail colors, Reduced motion, and the death effect. The earlier controls UI verification gap remains recorded above.
- Version impact: none.
- Last update: 2026-10-02.
- Notes: working-codex is preserved as archive/body-pattern-test-2026-10-02; its branch and worktree are retired after this merge. The test app at http://127.0.0.1:4174 now serves working. No release requested. working-redesign is unchanged.


## working-redesign — Five theme redesigns

- Category: display.
- Agent: Claude, with Codex as a collaborator.
- Base: `c9dca04` on `working`, in the worktree `C:\Code\IdleSnake-redesign`. The active checkouts (`working-body-motion`, `working-codex`) are unchanged.
- Status: Ready for William to test. Experimental; not for release.
- Changes:
  - `themes/theme-kit.js` is a presentation-only runtime. It remaps text, glyphs, canvas colours, and canvas fonts at render time, sets `html[data-theme]`, and adds a theme picker at the bottom left. Reads of `textContent`/`getAttribute` return the original text, so saves and change checks never see themed words.
  - Round 3 (William's feedback: dark, minimal menus with strong contrast, snake colours that work, scanlines instead of a pixel grid). Clear Cover II improves his favourite (Clear Cover); the other four are new: Amber Graphite and Night Green (Claude), and Oxblood and Carbon (Codex). Claude's three come from one template in `themes/_build`. `contrastingEyeColor` now reads the themed palette. The round 2 designs were removed.
  - `game.js` has four small hooks: a theme overlay and scanline option in `drawScanlines`, the theme id in `staticLayerKey`, the themed palette in `lightenColor`, and a redraw on theme change.
  - `styles.css` lifts fonts and two rgb triples into variables. The defaults are the same values as before.
  - `npm run theme-lab` serves both games' redesigns on port 8090.
- Tests: `npm run check` passed syntax, authority checks, and all 293 engine tests, including `themes/themes.test.js`.
- UI verification: William approved in-app browser checks. Every theme loads with no console errors. Round 2 was checked at 900x560 and 375 px, including the Nursery tab and the Personalize screen. No theme overflows at 375 px width. Original looks as before.
- Not run: the Playwright suite (it launches a separate browser). The default theme stays Original, so its expectations are unchanged.
- Version impact: none. No save-format change; the theme choice is stored in `idlesnake.theme.v1`.
- Last update: 2026-10-03.

## working — Nursery and fullscreen follow-up

- Category: display and saved preferences.
- Agent: Codex.
- Status: Ready to Ship.
- Changes: nursery title left, feeding button middle, capacity right; normal menu dimensions in fullscreen; 25% weaker scanlines, tint, and bezel shading; engine-owned fullscreen setting saved across reloads; clean Game Over display after a background death or a death animation interrupted by loss of focus.
- Tests: `npm run check` passed syntax, authority checks, and all 289 engine tests. Fullscreen preference validation, board unlock, unchanged run state, frame snapshots, and save round trips are covered. Direct HTTP check returned 200.
- UI verification: William gave explicit permission for one isolated browser check. That focused check passed for header order, unchanged menu width and height, larger play field, 0.75 screen-effect strength, reduced bezel shading, fullscreen after reload, and a static Game Over display with no death animation or pending overlay timer. The check sends window focus events explicitly because headless tabs can retain focus. Screenshots were inspected. No full browser suite was run.
- Version impact: optional `fullscreenMode` field in the existing version 5 envelope. Old saves use phone mode.
- Last update: 2026-09-30.
- Notes: all four listed changes are addressed. Work stays on working; no release is requested.

## working — Snake and nursery changes

- Category: gameplay, persistence, controls, and nursery UI.
- Agent: Codex.
- Status: Ready to Ship.
- Purpose: address all nine requested changes. The three linear speed segments in item 9 replace item 4's S-curve requirement; maximum speed is 3x.
- Changes: save the active Classic board; use elapsed time in hidden tabs and after reload; recheck the death lock after advancing time; correct timestamped turns through 34 ms late; grow hatchlings for 15 minutes at one Seed per 900 ms; save a feeding pause; unlock fullscreen after the first board upgrade.
- Tests: `npm run check` passed syntax, authority checks, and all 288 engine tests. Browser checks passed for reload, background death, the one-second lock, timestamp input, feeding pause and position, and the first-upgrade fullscreen unlock. The first full browser run passed 66 of 68 tests; duplicate pagehide flushing and an old growth-time fixture caused the two failures. Both were fixed, and all 8 affected browser checks passed. No further full browser run was needed.
- Version impact: optional active Snake board and nursery feeding fields in the existing version 5 envelope; old saves remain supported.
- Last update: 2026-09-30.
- Additional checks: delayed turns restore food rewards and shields; turns before the final pre-deadline frame are covered; each hatchling spends exactly 1,000 Seeds; extra nest eggs get growth time only after hatching; saved feeding pause stops offline growth.
- Request audit: 1 board persistence; 2 elapsed background gameplay; 3 lock recheck after clock advancement; 4 3x maximum with existing starting speed and multipliers; 5 timestamp correction within 34 ms; 6 15-minute feeding with 5/10-minute blocks; 7 saved feeding button between counter and title; 8 fullscreen after the first upgrade; 9 continuous linear thirds with successive 15% increases. All addressed. Item 9 supersedes the S-curve clause in item 4.
- Notes: work stays on working. No release is requested. The local test server remains at http://127.0.0.1:4173.

## working — Frame lag plan

- Category: performance planning.
- Purpose: verify late-game frame costs and reduce missed frames without changing game results.
- Agent: Codex.
- Status: Planned; see `LAG-PLAN.md`.
- Tests: code-path review only; Claude's reported frame measurements need a repeatable fixture.
- Version impact: none for this plan.
- Last update: 2026-09-29.
- Notes: the existing uncommitted Snake timing work was preserved. The plan separates motion and HUD work, economy reuse, and conditional timing changes.

## working — Reduced motion overhaul

- Category: accessibility.
- Purpose: stop the swallowed seed effect and make the game setting and device motion setting cover the same effects.
- Agent: Codex.
- Status: Ready to Ship.
- Tests: `npm run check` passed all 277 Node tests; all 6 focused accessibility browser tests passed.
- Version impact: none; the saved setting format is unchanged.
- Last update: 2026-09-28.
- Notes: reduced motion stops decorative effects while game pieces keep moving. The menu explains its scope and shows when the device setting is active. This work is on `working` and awaits a ship instruction.


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
