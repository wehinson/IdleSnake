# Frame lag investigation and fix plan

Status: planned on `working`. No performance fix in this plan has been applied.

## Goal and evidence

Reduce missed frames in a developed save while keeping Snake movement, idle income, random events, save data, and visible effects the same. The Claude chat reports a 33 ms median frame and 50 ms 95th percentile with a large save at 6× CPU slowdown. Those figures are useful leads, but this review has not reproduced them. Keep the save fixture, browser version, CPU setting, sample length, and raw results with the implementation so later measurements can be compared.

Current code confirms these costs:

- `game.js` calls `effectiveReducedMotion()` during several drawing paths. It calls `savedReducedMotion()`, which calls the full `session.snapshot()`. `makeSnapshot()` clones and freezes the nursery, habitats, notables, migration, routes, and missions. The frame snapshot already has `reducedMotion`.
- `engine/session.js` calls `tickEconomy()` for each established settlement on every frame. `engine/economy.js` computes the baseline habitat activation in `tickEconomy()` and both baseline and full activation in `tickHabitats()`. `tryStartEgg()` can compute it again. This is at least three activation calculations per settlement per ordinary economy slice.
- `syncHud()` and `syncPrimaryActionButton()` write stable text and attributes on every running Snake frame. `syncMinigameKeys()` writes key state during the 200 ms panel refresh. The existing `setText()` helper supports conditional text writes.
- `tickIdleWorld()` uses `Date.now()` for the elapsed time passed to the session. The `requestAnimationFrame` timestamp is available, but input also calls `tickIdleWorld()` outside the frame loop. The engine caps live game time at 100 ms and passes the full elapsed time to the idle economy.

The current uncommitted Snake timing work in `game.js`, `index.html`, `scripts/snake-timing.js`, and `tests/browser/snake-timing.spec.js` belongs to another active change. Preserve and review it before running a comparison. Do not put its diagnostic records in a release without checking their cost and whether they contain save data.

## Plan 1: measure and remove needless frame work

1. Build a repeatable browser fixture with a fresh save and a developed save with several established settlements, many habitats, a nursery, and notables. Record the fixture generator rather than a personal save. Measure at normal CPU speed and at one documented slowdown. Capture frame gaps, 50th/95th/99th percentiles, long frames, scripting time, style/layout time, full snapshot count, and economy activation count. Run the same active Snake path before and after each change. Keep profiling off during the final comparison.
2. Read the saved motion setting from `latestFrameSnapshot.reducedMotion` (or the current accepted snapshot) and retain one `matchMedia` query for device preference changes. Keep the existing behavior when the user changes the setting or the device preference while the game is open. Add a focused browser check for both changes and assert that an ordinary Snake frame makes no full snapshot for motion checks.
3. Use `setText()` for stable HUD labels and the action button. Change `hidden`, `value`, `title`, `disabled`, and `aria-disabled` only when their values differ. Cache or compute minigame capability once per panel refresh. Verify the same labels, accessibility state, mode switches, and controls; count actual DOM mutations during an unchanged Snake run.
4. Compare the same fixture after each change. Keep changes as separate commits for motion reads and HUD writes. Accept each change only if behavior checks pass and its measured work decreases on the developed save. Do not claim an FPS gain from script time alone.

## Plan 2: reduce repeated economy calculation

1. Profile the economy after Plan 1. Count activation calls per settlement and locate their exact inputs. A cache must include habitat counts, upgrade levels, assigned notable powers, food value, and the full-activation option. Check whether any of these values can change during an economy slice or from a trade, migration, egg, or player action.
2. Reuse the baseline and full activation only while those inputs stay equal. Keep the cache private to the live session or economy; do not add it to saves. Prefer explicit invalidation at all mutation sites or a small exact input key. Do not cache a result that can be mutated by contribution accounting.
3. Run deterministic old/new sessions from the same fresh and developed saves. Compare snapshots, events and order, RNG calls, and serialized saves after actions, each tick, offline catch-up, egg thresholds, provision-bank exhaustion, trade arrival, and settlement founding. Test several frame-time sequences with the same total elapsed time. Then repeat the browser profile. Commit this separately from Plan 1.

## Plan 3: improve timing only if lag remains

1. Measure frame-gap patterns and input-to-movement delay after Plans 1 and 2. A `requestAnimationFrame` timestamp change needs one clock policy for frame ticks and input ticks. Check hidden-tab return, a system-clock jump, pause/resume, collision grace, and the 100 ms live cap. Preserve the full elapsed time for idle catch-up. Do not change the clock based only on the reported 7/8-frame step pattern: whole-cell movement is quantized to frames by design.
2. Consider batching idle economy only if its measured 95th percentile cost still causes missed frames. Before changing the tick interval, prove equivalence for resource totals, egg start time, provision-bank transitions, trade boundaries, event order, RNG use, and saves. If exact equivalence is not practical, use smaller bounded work inside the existing tick instead.
3. Treat sliding between cells as a separate visual decision. It can make movement look smoother but does not by itself remove frame work and may change the intended whole-cell look. Keep gameplay coordinates and input timing authoritative in the engine.

## Completion checks

- `npm run check` and the relevant Playwright browser tests pass.
- Fresh and developed saves produce the same engine state, events, RNG sequence, and save output for the same action and time sequence.
- The developed-save browser fixture shows fewer long frames or lower 95th percentile frame time across repeated runs; report raw data and the test environment. Fresh-save results do not regress materially.
- No new full snapshot or stable DOM mutation is added to each Snake frame. The work remains on `working` until William gives a ship instruction.

## Model recommendation

- **Claude Sonnet 5.5 High:** Use for the measured fixes and deterministic economy checks. The code paths are identified, but cache correctness needs careful investigation.
- **GPT-6 Sol High:** Use for the same work in Codex. It suits a defined, multi-file performance problem with exact behavior checks.
