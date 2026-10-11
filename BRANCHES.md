# Branch status

## task/minigame-batch-20261011 — Minigame PR2 coordination

- Agent: local Jimothy, GPT 6.1 Sol high effort, T3 coordinator `mcp:618042fc-9354-4fc9-906a-1b3ca5c689e4`.
- Status: All six exact tips individually accepted and merged ONLY task integration; combined exacte30f7c9 npm475/syntax139/authority11canonical/diff PASS. Final combined R1 ACCEPT exactcee27b7,12 bounded engine/VM groups, no material/P0-P2 findings. Docs-only successor preserves runtime/tests. One separate Minigame PR targets working; William approval remains required. Separate Colony PR1; no automatic merge/deploy.
- Base: `31e773efee60c85d6781078803e4eae208911e4e`. Approved tongue behavior retained; root uncommitted balance files excluded.
- Scope: requests 1–6 and 8–13 (numbering skips 7): duel/Nibbler/switching/shared connectors; Brick Breaker/Snakeger; 15 Snake Bird and 15 Sokoban puzzles; Broodline/strike/Centipede polish; authoritative calibrated Seed rewards.
- Evidence and resume state: `MINIGAME_REVIEW.md`; full original brief: `MINIGAME_BRIEF.md`. Each final exact worker tip requires coordinator inspection/checks and independent T3 read-only review before integration.
- Baseline verification: `npm run check` passed syntax, authority and all335 Node tests. No browser automation authorized; visual/layout/control feel remains for William to test.
- Previews: shared port4173/current PID14548 (restored by home after second reboot); `/test6/`–`/test11/` reserved for workers and `/test12/` for this integration. Root and `/test2/`–`/test5/` preserved; `/test1/` is retired by Home decision with expected404. Final audit79 exact/no-store asset matches; prior PID29492/10940 evidence is historical. Coordinator performs no restoration or route/server mutation.
- Review gate: complete exact-tip verdicts MINIGAME_COORDINATOR_REVIEWS.md; all worker history/fail/cancel classifications retained. Final combined gate ACCEPTED exactcee27b7 using full475 and12 independent bounded groups with original brief/shared-contract conflict history; no docs-only test repeat. Human phone/layout/control feel and reward Seed/min balance remain acceptance caveats.
- Release coordination: baseline-only1.0.4 release completed on main `618abc8c5968306488096aaca7cdd46819f256eb`, CI/Pages success; `working` remains31e773e. Only release metadata differs from baseline; no pending batch entered main. This batch stays based on31e773e, unapproved, without importing release/batch commits or bumping its version.
- Version impact: no release bump for this PR; save migrations documented by owners and reviewed on integration.
- Last update: 2026-10-11.
- PR3 CI repair: head7977875 browser89/87PASS/2FAIL old Strike copy and Broodline round-only label expectations. Narrow two-browser-test successor aligns exact actor/coordinate/outcome + round/wave, strengthens persistent feedback/reset/pause checks, retains gameplay lifecycle and errors. Three direct VM groups/syntax/diff PASS; runtime/Node475 evidence unchanged. New-head browser CI pending Operations watch; no local browser or workflow change.

## task/minigame-snake-ui-20261011 - Minigames requests 1, 2, 12, 13

- Agent: Codex, GPT 6.1 Sol high effort, local Jimothy, T3 thread `mcp:30aa62db-38dd-45af-a2d2-05b177b3a30f`.
- Status: Ready With Caveat; narrow Runner follow-up implemented, awaiting fresh full-check allocation and coordinator independent R2 before combined integration. Coordinator `mcp:618042fc-9354-4fc9-906a-1b3ca5c689e4` independently reviews before Minigame PR2 integration.
- Base: exact local working `31e773efee60c85d6781078803e4eae208911e4e`; task checkout only. No Colony commits, working/main merge, deployment, version bump, CI changes, or individual PR.
- Changes: fixed Duel 20x25 with wrapped movement/AI/collision checks; connected solid Duel/Nibbler bodies; black pulsing Duel Seeds; Nibbler catalog/Ready/results/accessibility names and four-direction Ready starts; direct one-click minigame switching across pause/gameover; shared default-width connector helper, with short clipped wrap seam pieces, default tail endpoint and theme/palette mapping; Bird/Sokoban calls and dynamic Bird level count.
- Migration: keep legacy selectedDuelGridSize field normalized to20; runtime grid20x25 regardless of old saved size/custom setup. Other progress/settings retained. Nibbler remains21x21 nonwrapping.
- Shared interface: `scripts/snake-connectors.js` exposes `IdleSnakeConnectors.draw(ctx, cellPoints, {cellSize,x,y,color,columns,rows,wrap,tailBaseDistance,width})`; wrapper `drawSnakeConnectors(points,color,options)` applies board/theme defaults then options. Siblings own Brick/Snakeger and Arcade connector call sites.
- Baseline verification at b8806ba (before Runner follow-up): npm run check passes syntax, engine authority and353 Node tests.86 targeted Duel/Nibbler/session/selector/connector tests pass;16 focused approved tongue-return/default connector compatibility tests pass. Direct VM tests call shipped picker/fullscreen handlers, grid/pulse/wrapper/Ready-accessibility functions; no browser automation. Exact HTTP byte matches passed for8 assets on test6. Existing browser tests retained and Nibbler expectations updated; visual/layout/browser behavior still needs user testing.
- Preview: coordinator allocated/HTTP-verified `http://localhost:4173/test6/`; shared server/routes never mutated by this worker.
- Review: read-only local GPT6.1Sol round1 found P2 shield neck at1.18cells plus stale Nibbler lifecycle assertions; both fixed. Round2 verified these fixes and26 targeted tests, found a stale keypad aria-label; corrected to Nibbler and added actual HTML/Ready/accessibility regression evidence. No P0/P1 findings. Round2 inspected checkpoint1f41e16 plus concurrent final uncommitted changes, not a frozen final commit. Coordinator must review exact final pushed tip.
- Review taskIds: `node:delegated-task:command%3Amcp%3Aabe8ed05-7277-4fea-9051-3f26c9838f0e%3Adelegate-task%3Aminigame-snake-ui-readonly-review-r1-20261011`; `node:delegated-task:command%3Amcp%3Aabe8ed05-7277-4fea-9051-3f26c9838f0e%3Adelegate-task%3Aminigame-snake-ui-readonly-review-r2-20261011`. External research unnecessary for these explicitly specified local behavior changes.
- Acceptance: all4 Duel edges on both snakes, toroidal AI, body/vacated-tail/head-swap collisions, old/current save roundtrips, requested Nibbler heading and retained wall rules,36 direct lifecycle/mode switch cases with no payout/replay, lock-preserving actual menu handlers, seam clipping, theme/player palette, default tail endpoint and shield neck. Tongue engine/draw files unchanged; existing approved return/cancellation/pause/consumption tests pass.
- Connector coverage: this branch default/Duel/Nibbler/Bird/Sokoban/Runner; coordinated sibling Brick/Snakeger calls and Arcade Centipede(split heads)/Broodline/revealed Battleship calls remain integration-owned. Same live/paused mode selection keeps existing no-op launch semantics; changing games switches directly. Legacy Nibbler first-tick body/wall collision checks remain.
- Coordinator R1: REQUEST_CHANGES on exact b8806ba for omitted hidden Runner connectors;44 small sequential tests passed, no P0/P1. Durable result is MINIGAME_COORDINATOR_REVIEWS.md in the integration checkout. Task: `node:delegated-task:command%3Amcp%3Acd84c8d0-8920-4013-953f-6e47f3bb766f%3Adelegate-task%3Aminigame-batch-snake-independent-r1-20261011`. This result remains REQUEST_CHANGES, not PASS.
- Runner fix: drawRunner computes its existing six tile poses once, draws five shared default-width connectors through their centers before tiles, then retains original tile order, palette, size, position and delayed jump offset. No engine/reward/binding/shared-helper changes.
- Follow-up verification: `node --test --test-name-pattern='actual Runner renderer' scripts/minigame-ui-integration.test.js` passes one bounded VM test (ground plus five staggered jump poses, both motion preferences), including Duel -> key9 Runner -> Up jump, all five exact-center links before six tiles, default connector width/theme palette, unchanged scale/poses. `git diff --check` passes. Changed-tip full npm check and independent coordinator R2 are pending fresh allocation after OIKOS; not run during its heavy priority window. No simulation/solver/browser/server/route/ref-import/cleanup work performed.
- Version impact: none. Root unrelated balances/saves/tests untouched.
- Last update:2026-10-11.


## task/minigame-snakebird-levels-20261011 — MINIGAME PR2 request5

- Agent: Codex, GPT 6.1 Sol, local Jimothy, T3 isolated checkout; base `31e773efee60c85d6781078803e4eae208911e4e`.
- Status: Ready With Caveat for coordinator review. Exactly15 original boards replace all five old boards, with distinct anchored reaches, growth budgets, tail folds, fruit ordering, return routes, shelves/posts/canopy circuits, and a bottom-row harvest over the abyss. Verified shortest counts: 7,8,9,12,13,14,16,20,25,26,27,27,28,33,35 (300 moves total).
- Constraints: task-branch commits/push only; no working/main merge, individual PR, Colony commits, browser automation, or shared-server mutation. Coordinator `mcp:618042fc-9354-4fc9-906a-1b3ca5c689e4` owns combined review/PR and `/test8/` route allocation.
- Verification: `node scripts/solve-snakebird.js` independently solves/replays all15 via the actual engine; largest search28,110 states. `node --test snakebird-engine.test.js engine/session-puzzles.test.js engine/snakebird-campaign.test.js` passes39 tests, including every real-session win, growth/support/settled exit, required growth/fruit orders, vacating tail, exactly-one terminal event, persistence and direct random access. `npm run check` passes syntax, authority and all359 Node tests. `git diff --check` passes. All Sokoban content equals the exact base. Direct HTTP byte comparisons match `/test8/` index/game/styles/session/puzzle/Snakebird engine files; coordinator allocated that stable route.
- Migration: saveVersion5 retained. First shipped selection marks campaignVersion2, expands to15 and retains old slot clear credits. Old bestMoves/clear/selection records are archived under `legacyRecords["1"]`; incomparable live bestMoves reset to null. Migration is idempotent and archives survive completion/reload. Old fully-cleared5 unlock record slot6. Legacy and v5 saves preserve currencies, Sokoban records, upgrades, nursery, habitats, Notables and settlements. Existing reload behavior discards active puzzle boards; no live saves were opened or modified. Random launch/continue remains unchanged and can choose any of15.
- Research: both read-only GPT6.1Sol medium T3 tasks completed; actual node IDs, sources and results recorded in `SNAKEBIRD_LEVELS.md`. Mechanics supplied levels1–5; layout research supplied6–11/15; similar Tail Bridge rejected; parent authored12–14 and independently validated all15. Original maps/text/assets, with mechanic/search inspiration attributed to Noumenon Games/Felix Eliasson and Sturtevant et al. (AIIDE2020).
- Files: engine/puzzle-levels.js (Snakebird array only), snakebird-engine.js (progress metadata/migration), engine/session.js (Snakebird initialization only), engine/session-puzzles.test.js (dynamic invalid bound), engine/snakebird-campaign.test.js, engine/snakebird-solutions.json, scripts/solve-snakebird.js, SNAKEBIRD_LEVELS.md, BRANCHES.md.
- Integration: Snake UI owner handles Bird connectors and dynamic HUD count; reward owner received all15 verified optimalMoves and owns every payout/history hook. This task does not edit either renderer or payout hook. Existing reward metadata remains for compatibility until central integration.
- Caveat: no browser/computer automation; visual fit, human difficulty and combined connector/reward behavior await coordinator/user review. Human difficulty is inferred from distinct reasoning requirements and shortest paths, not established by playtesting. Task branch only; no working/main merge, release version change or deployment.

## task/minigame-brood-strike-centipede-20261011 — Minigame PR2 requests 8/9/10

- Agent: Codex, GPT 6.1 Sol, local Jimothy, T3 isolated checkout; coordinator `mcp:618042fc-9354-4fc9-906a-1b3ca5c689e4`.
- Status: Coordinator R1 REQUEST_CHANGES at `cca751ca0af7923da0e0582542fba5e1ea0b1438`; its single P2 live-HUD defect is now fixed narrowly, awaiting a NEW coordinator R2 before acceptance/integration. Base `31e773efee60c85d6781078803e4eae208911e4e`; no Colony task/integration commits, working/main merge, release bump, deployment, CI edits, or individual PR.
- Broodline: restored specialist attacks by accepting numeric attack ranges and including the first companion slot; retained existing ranges, cooldowns, damage and statuses. Cave eggs now grant the same armor capacity as cave pickups. Formation reorders identities/timers while retaining cell order, so the chain stays contiguous on real subsequent ticks. Forward input starts Ready without queueing a duplicate; reversals and the two-turn buffer stay bounded. Bounded spawn fallback avoids overlapping the head/chain/enemies, and lethal damage stops later attackers and hatches. These repair intended existing rules; five waves, enemy scaling, drop odds and progression point amounts remain unchanged.
- Broodline feedback: round/wave/enemies/armor/nearest egg timer, goal and restart instructions, static overview map for offscreen enemies/pickups, companion effect descriptions, selected state and disabled boundary reorder controls. Formation instructions survive HUD refresh; next-round HP/armor restoration is explained. The camera resets on replay, settles directly with reduced motion and freezes during pause. `pendingSeeds` remains internal; HUD/formation say Progress/progress points to align with the central reward owner.
- Venom Strike: existing catalog name/rules preserved. Normal phone canvas is 504x1040, with BOTH square 488x488 boards (previously 220x220 inside 504x504); wide fullscreen uses 1040x504 and two 470x470 boards. Generic board metrics are unchanged, and other modes restore the 504x504 canvas. The phone shell grows with the tall field so controls are not clipped; fullscreen constrains both axes to available space with the same backing aspect. Rendering and taps share one layout. Persistent player/AI coordinate/result lines in a polite live status keep both results visible. Filled X hits and hollow-ring misses remain distinguishable without color; cell-clipped 900 ms venom rays/splash rings stop with reduced motion, and the reticle is static. Pause freezes effect age; replay/switch clears feedback.
- Centipede: player input retains 70 ms cadence. Bullet travel is 2.4 versus 2 rows/tick (+20%); the single-projectile default-height auto-fire cycle is 12 versus 14 ticks (840 versus 980 ms, +16.7% firing frequency). Enemy movement is every 87.5 versus 70 ms (-20% speed), with immediate first-tick movement retained. New shots check the initially adjacent cell and every traversed cell. Point units, lives, wave growth and collision cells remain unchanged. Obstacles use dark ink `#182413`, and actual HP 4/3/2/1 gives opacity 100/85/70/55%; zero HP deletes the obstacle. The shooter silhouette is .94 versus .76 cell wide (+23.7%), stays inside its cell at the field bounds, and preserves the one-cell engine hit box.
- Shared interfaces: guarded wrapper calls before Broodline body tiles, revealed Battleship fleets (never hidden ships), and Centipede groups split at `isHead`; generic helper remains owned by the Snake worker. Reward formulas, receipts, history, score normalization and outcome hooks remain owned by the reward worker; this branch preserves payout blocks and existing outcome event fields. Narrow session edits are limited to the Centipede cadence constant, formation position preservation and Broodline ready direction validation. No save migration/version impact; added clocks/shot flags are transient active minigame state.
- Preview: coordinator allocated and directly verified `http://localhost:4173/test10/`; shared server/routes remain coordinator-owned.
- Baseline verification at `cca751ca`: `npm run check` passed all 356 Node tests, syntax for 123 JavaScript files and authority for 11 modes; `git diff --check` passed. Focused command `node --test engine/broodline.test.js engine/broodline-playability.test.js engine/centipede.test.js engine/centipede-tuning.test.js engine/session-broodline.test.js engine/session-arcade-playability.test.js engine/session-battleship.test.js engine/battleship.test.js scripts/minigame-feedback.test.js` passed 52 tests. The 21 new tests cover companion slots/ranges/status/cooldowns, cave capacity, lethal ticks, constant-RNG spawn uniqueness, forward/pause/restart/real post-formation movement, 24 bullet rows and eight enemy cells in ten ticks, refire/adjacent hits/anti-tunnelling, same-cell stationary enemy collision, life-loss/outcome/exactly-once settlement, all 200 Strike cells at four CSS widths in both aspects, gutters/labels/edges, real draw origins and reveal restrictions, reduced motion/static reticle/clock/reset, HP alpha/dark cap/larger bounded shooter, map and camera behavior.
- HTTP evidence: exact byte comparisons at `/test10/` for index.html, game.js, styles.css, scripts/minigame-feedback.js, engine/broodline.js, engine/centipede.js, engine/session.js and the official theme CSS; all returned 200. Root files, saves, pre-existing tests and other routes were not modified by this worker.
- Research/review: read-only GPT 6.1 Sol medium research completed: `node:delegated-task:command%3Amcp%3A93dc784f-daa8-41f9-bb77-f0df835d0be8%3Adelegate-task%3Aminigame-8910-research-20261011`. Read-only high review round 1 was cancelled before completion; its partial finding confirmed the attack/formation/ready fixes, but is not a PASS: `node:delegated-task:command%3Amcp%3A93dc784f-daa8-41f9-bb77-f0df835d0be8%3Adelegate-task%3Aminigame-8910-review-r1-20261011`. Fresh high review round 2 completed PASS with no actionable findings and independently passed `npm run check` (356 tests), including feedback resets/pause, projectile clocks/collision, Broodline fixes and fullscreen CSS sizing/cascade: `node:delegated-task:command%3Amcp%3A0ef9a5ef-b923-4184-b299-5578225b7481%3Adelegate-task%3Aminigame-8910-review-r2-20261011`. Coordinator still independently inspects/reviews the pushed tip before integration.
- Coordinator independent R1: REQUEST_CHANGES, one P2, `node:delegated-task:command%3Amcp%3Aab0d5ba8-7bee-42d0-aa6d-445234728aef%3Adelegate-task%3Aminigame-batch-arcade-independent-r1-cca751c-20261011`. Broodline combat frames did not call `syncHud`, so Progress/Kills/wave/enemies/armor/egg feedback stayed stale without input. This classification is retained despite the earlier worker-owned PASS; coordinator reports no other actionable source defect in requests 8/9/10.
- P2 fix delta: `gameLoop` refreshes HUD during running Broodline combat after engine ticks/events, preserving the existing Classic Snake path. Formation and pause do not enter this new frame refresh. Broodline `syncHud` leaves terminal hints untouched; unchanged goal text is not repeatedly written to the polite live region. No camera/engine/reward/connector changes or copied integration hunks.
- P2 tiny regression: actual extracted `gameLoop`, `syncHud` and event interpreter run in Node VM with scripted engine frame snapshots, without input. Frames update Progress/Kills/wave/enemies/armor/egg/timer across a wave event, retain formation and pause hints, retain the terminal +37 Seeds overlay and the reward owner's terminal hint through later frames/explicit HUD sync, and suppress duplicate live-region writes. `node --test --test-name-pattern="actual gameLoop refreshes Broodline" scripts/minigame-feedback.test.js` passed 1 test; no independent failures in either targeted pass; `git diff --check` passed. Full checks/build/HTTP/browser/server work were NOT rerun for this delta under OIKOS priority; no heavy lease was granted. No new self-review/worker. Coordinator owns NEW independent R2 on the frozen pushed fix tip; this worker thread stays open until William accepts.
- Caveat: no browser automation/computer use authorized or performed; canvas appearance, real phone scrolling/controls/fullscreen fit and live-announcement experience require user visual acceptance. Connector helper and central reward hooks must be combined and tested by their owners/coordinator. Preservation HOLD observed: no route/server/worktree removal, rebinding or restoration work; release thread alone owns the missing approved tongue preview. No cleanup planned.

## task/minigame-rewards-20261011 — MINIGAME PR2 request11

- Agent: Codex, GPT 6.1 Sol, local Jimothy; T3 thread `mcp:f8d8c6c9-6d22-4054-af48-c6768be37465`.
- Status: Ready With Caveat for coordinator integration; reviewr5 PASS and final356-test full check PASS on exacteaef9a593c4c75eb3e7fe91ebfe4436eff1d7033. This final evidence update changes only BRANCHES.md and MINIGAME_REWARDS.md; all runtime and test files remain byte-identical to that reviewed and tested code tip.
- Base: local `working` commit `31e773efee60c85d6781078803e4eae208911e4e`. No Colony task/integration commits, working/main merge, deployment, or individual PR.
- Scope: all nine catalog games plus hidden Runner; one normalized-score/win/passive-income/historical-Seed-earnings formula, saved ±3% reward RNG, once-only run receipts, consolidated terminal payouts and consistent result explanations. Mode rules and raw scores unchanged.
- Migration: additive version1 reward ledger inside save version5; absent old earnings start at zero because high-score records cannot reconstruct actual payouts. Known earnings maps are sanitized and retained. Active minigames remain unsaved; pending contexts are discarded without reward on hydration.
- Verification: 19 reward tests plus3 scoped record/Broodline checks pass (22 targeted); two actual UI save/interpreter/presentation Node VM regressions pass, proving immediate stored currency/history/RNG/receipt, preserved backup policy, and no credit from display-event replay or reload/offline. Exactf802947 passed `npm run check` (122 JavaScript syntax checks, authority,355 tests) and a refreshed bounded21-trace simulation; HEAD was clean/unchanged. The only later behavior changes preserve terminal explanations in Broodline HUD and Sokoban result presentation. Formula/engine/simulation code is unchanged; no repeated large simulation is needed. Final explicit-grant `npm run check` passed on exacteaef9a5:122 JavaScript syntax checks, authority and356 tests, with HEAD unchanged/clean before and after. No simulation was repeated because the math/engines are unchanged; the heavy slot was immediately released. Cancelled Nibbler right/up input reproduces score10 autoplay and now pays0; real applied turns pay with progress. Accepted-but-unapplied terminal commands cannot engage Duel/Nibbler/Snakeger/Broodline. Neutral Breakout direction and set/clear Centipede axes remain zero. Existing lifecycle tests retained with scoped fixed-payout assertions updated. Sequential reward matrix and21 real traces use `scripts/minigame-reward-sim.js`, independent of root balance work. Formula, calibration, examples, migration and review evidence are in `MINIGAME_REWARDS.md`.
- Preview: coordinator owns stable `http://localhost:4173/test11/`; final direct HTTP comparisons returned200/exact local bytes for index.html, game.js, session, reward module, Breakout and Centipede. No server route/process mutation or browser/computer automation performed.
- Integration: coordinator `mcp:618042fc-9354-4fc9-906a-1b3ca5c689e4`, branch `task/minigame-batch-20261011`; sibling score/outcome interfaces coordinated. Preserve their narrow session changes on integration.
- Caveats: calibration is an initial balance choice, not measured player percentiles; visual layout unverified; saved-game rollback/tampering is outside a local engine's exactly-once guarantee.
- Review: completed researchr1 and failed reviewr1/r2/r3 retained; no cancelled review counted PASS. Reviewr4 passed exactf802947 with45 focused tests; its P3 terminal Broodline hint overwrite is fixed, with the same guard applied to Sokoban status presentation and tested through actual result/interpreter/HUD functions. Reviewr5 passed exacteaef9a5 with24 scoped tests and20 Node VM presentation fixtures across all ten payout modes; its result is retained in durable task history and its backing child is settled. All review/research children are settled; R1-R3 remain FAIL evidence, R4/R5 remain PASS only for their exact tips. Tiny `controlledMove` events retain sibling-agreed placement (Breakout stepSlice; Centipede immediately after movePlayer). Separate lastAppliedHeading starts at each autonomous directional mode's initial heading and changes only after actual movement, preserving the Snake owner's direct Ready Nibbler heading. Sibling physics/lifecycle/level changes remain coordinator-owned integration work.
- Preservation hold: keep shared server PID29492/routes and all existing T3 checkouts/bindings. No cleanup or route mutation planned or performed.
- Version impact: none to release version or save envelope; no Colony edits.
- Last update: 2026-10-11.

## task/tongue-seed-return — Shorter tongue and smooth Seed placement experiment

- Agent: Codex, GPT 6.1 Sol, medium effort, local Jimothy, T3-created checkout `C:/Users/wehin/.t3/worktrees/IdleSnake/task-tongue-seed-return`.
- Status: Approved by William and merged into `working` on 2026-10-11. Awaiting a separate ship instruction for `main` and deployment.
- Base: active `working` commit `af0c946`. Fresh implementation; the scrapped `task/tongue-catch` branch and `archive/tongue-catch-2026-10-10` were not revived or merged.
- Changes: opt-in tracker experiment halves Goo Fork emergence/reach/pull phase durations, preserves its easing, shape and two-cell catch range, and keeps the Seed held until the engine consumes it. A cancelled pull places the Seed from its last drawn position back at its copied original cell, restores its size, then retracts the tongue. The flexible tongue connects the current mouth to the Seed through repeated turns. New catches wait for placement to finish. Seed coordinates, movement speed, rewards, consumption and saves remain authoritative and unchanged.
- Timing: return lasts 60% of the cancellation-time movement interval, bounded to 80–240 ms, with placement in the first 75% and retraction afterward. Pause freezes display time. Reduced motion prevents fresh catches; an existing displaced Seed finishes one return instead of jumping home. Removal by the engine cancels presentation immediately, including during pause.
- Preview: `http://localhost:4173/test1/` on Jimothy, using the existing shared server (PID 10940) and `.git/local-test-routes.json`. The previously available route now maps to this exact checkout. Other processes and the primary `/` route are preserved. Keep this mapping while William tests.
- Verification: `npm run check` passed syntax, engine authority, and all 335 Node tests. New deterministic tests cover preserved pull geometry, halved duration, cancellation from pull/hold, repeated turns and re-approach, pause, reduced motion, fast/slow timing boundaries, actual session food/rewards and consumption, and the actual drawing functions drawing exactly one Seed. Direct HTTP byte comparisons passed for the route's HTML, game code, tongue engine/drawing, CSS and official theme assets; primary game code still matches the root checkout. `git diff --check` passed.
- Caveat: no browser automation or computer use was authorized or performed. Canvas appearance, mouth connection through sharp turns, and perceived timing still need William's visual test.
- Files: engine/tongue.js, engine/tongue-return.test.js, scripts/tongue-draw.js, scripts/tongue-integration.test.js, game.js, BRANCHES.md.
- Integration: William requested the merge on 2026-10-11. Merged with a merge commit; unrelated uncommitted balance work in the primary checkout was preserved and excluded from commits (all file hashes match the pre-merge baseline). Combined `npm run check` passed syntax, authority, and all 379 Node tests, including the pre-existing local balance tests. Direct HTTP comparisons confirm the primary route serves the merged tongue code. The stable `/test1/` preview still serves the approved task checkout; the primary `/` route serves `working`.
- Version impact: none. No `main` merge or deployment.
- Last update: 2026-10-11.

## working — Office Charcoal is the official theme

- Category: display (themes) and controls.
- Agent: Claude, in folder `IdleSnake-claude`, because Codex had an active claim on `working` when the work started. Started from `working` commit 4c7a5e1 and includes Codex's commits up to 80db136.
- Status: Ready With Caveat.
- Purpose: William chose Office Charcoal as the official theme and asked to remove the theme picker, with round default direction buttons and a rounder fullscreen button.
- Changes: `ThemeKit.start` accepts `defaultTheme` and `picker`. index.html starts with Office Charcoal and no picker. A choice stored by the old picker is ignored. `?theme=<id>` still shows any theme, including `original`. In Office Charcoal, the default direction keys are circles (the large D-pad is unchanged) and the fullscreen key is a full circle. The retro themes now make the bezel shading 25% weaker in fullscreen, as the base game does.
- Files: themes/theme-kit.js, index.html, themes/_build/build_retro.py, the five retro theme.css files, themes/themes.test.js, themes/README.md, tests/browser/release-integration.spec.js, tests/browser/body-snaps.spec.js, tests/browser/fullscreen-mode.spec.js, tests/browser/responsive.spec.js, BRANCHES.md.
- Tests: `npm run check` passed syntax, authority checks, and all 328 Node tests in this folder. The existing CI browser suite ran on GitHub with Office Charcoal as the default. The first run passed 84 of 87 checks; the three failures were two specs that assumed the Original palette or layout and the missing fullscreen bezel shading. After the corrections, the CI run on commit 7168f1f passed all 89 browser checks.
- Caveat: no browser check by eye was done; browser automation on this computer was not authorized. The shape of the round keys and the look of the official theme are not verified by eye. themes/theme-kit.js is shared with IdleSweep; the two new options are off by default there.
- Notes: merged into `working` by fast-forward on 2026-10-10. The root README.md now names Office Charcoal as the default.
- Version impact: none; no save format change.
- Last update: 2026-10-10.

## working — Notables pending indicator

- Category: display only.
- Agent: Codex, GPT 6.1 Sol, low reasoning effort, on Jimothy in the T3-managed thread.
- Status: Ready With Caveat.
- Changes: the main Colony Notables button shows the actual queue length as `X Pending` when at least one candidate is pending, including `1 Pending`; it hides the indicator only at zero. The retained/capacity label, Over Capacity warning, and internal panel summary are retained. Full session snapshots refresh the summary immediately for generation, decisions, loading, and settlement context changes. At William's follow-up request, the small indicator has a rounded pill outline, black background, and white text in Original and all ten themes, including the five Nokia themes.
- Follow-up verification: CSS diff reviewed and `git diff --check` passed for the rounded black/white indicator. No behavior code changed; prior checks below remain applicable.
- Files: index.html, game.js, styles.css, BRANCHES.md.
- Verification: `npm run check` passed syntax, authority checks, and all 371 Node tests. Direct Node VM checks of the actual summary and snapshot functions passed queue transitions (0, 1, 4, 3, 1, 0, 2, 0), capacity warnings, and a changed settlement count/capacity. `git diff --check` passed. No new persistent tests were added for this small presentation change.
- Caveat: no browser or computer automation was used or authorized. Appearance and layout have not been verified by eye.
- Version impact: none; gameplay, save behavior, and save format are unchanged. No main merge or deployment requested.
- Notes: unrelated uncommitted balance work is preserved and excluded from this task commit, as explicitly instructed. Back up this task to origin/working.
- Last update: 2026-10-10.

## working — Fullscreen button always available

- Category: engine and controls.
- Agent: Claude.
- Status: Ready With Caveat.
- Purpose: William asked: "make it so the button is there the entire time" for Snake Forever fullscreen.
- Changes: fullscreen no longer depends on the Board size upgrade. The engine query `fullscreenAvailable` is always true, and `setFullscreenMode` no longer rejects at board level 0 (the `fullscreenLocked` reason is removed). The Fullscreen button is not hidden in index.html, and the layout has the fullscreen option class from the first paint. Enter and exit behavior, the saved preference, and gameplay are unchanged.
- Files: engine/queries.js, engine/session.js, engine/snake-batch.test.js, index.html, tests/browser/fullscreen-mode.spec.js, README.md, BRANCHES.md.
- Tests: `npm run check` passed syntax, authority checks, and all 371 Node tests. One new engine test enters fullscreen on a new save at board level 0 during a run, checks that the run, upgrades, and Seeds do not change, saves, reloads, exits, and reloads again. The existing fullscreen test no longer expects `fullscreenLocked`.
- Caveat: no browser check was done, because browser automation was not authorized. The button's visibility and the fullscreen layout on the smallest board are not verified by eye in Original or in the ten themes. tests/browser/fullscreen-mode.spec.js now expects the button at board level 0 but was not run locally.
- Notes: with the large D-pad control layout, the button stays in the keypad that opens from the minimized keypad button, as before. On screens 800 px wide or less, a new save now has the phone above the menu, which was the layout after the first board upgrade.
- Version impact: none; no save format change. A save with fullscreen on and board level 0 now opens in fullscreen.
- Last update: 2026-10-10.

## working — Five retro handset themes

- Category: display (themes).
- Agent: Claude.
- Status: Ready With Caveat.
- Purpose: William asked for five new themes from Clear Cover II that are "less shiney and techno more retro nokia".
- Changes: five new selectable themes: Brick Navy, Office Charcoal, Signal Red, Pebble, and Taxi Yellow. Each one has matte plastic, flat rubber keys, a two-tone dot-matrix LCD with no glow, and its own body shape, key shapes, LCD tone, and menu treatment. The five round 3 themes and Original are unchanged. The themes change presentation only; they do not change the engine, saves, or the snake colours that the player selects.
- Files: themes/brick-navy/, themes/office-charcoal/, themes/signal-red/, themes/pebble/, themes/taxi-yellow/, themes/_build/build_retro.py, themes/themes.test.js, themes/README.md, index.html, tests/browser/release-integration.spec.js, BRANCHES.md.
- Tests: `npm run check` passed syntax, authority checks, and all 370 Node tests. Two new theme tests check registration in index.html, contrast of menu, key, and LCD colour pairs (4.5:1 or more), snake colours on each LCD, the absence of gloss and glow, and the fullscreen and keypad focus rules. Each overlay painter ran against a mock canvas.
- Caveat: no browser check was done, because browser automation was not authorized. The appearance, layout from 360 px to 1920 px, fullscreen appearance, and web font loading of the five themes are not verified by eye. The browser test list in tests/browser/release-integration.spec.js includes the five themes but was not run locally.
- Version impact: none; no release requested.
- Last update: 2026-10-10.
- Notes: the balance simulation changes in the checkout (ci.yml, README.md, package.json, balance.yml, BALANCE_TESTING_BRIEF.md, scripts/balance.js, simulation/) are from another session. They have no agent claim and are not in this commit.

## Release 1.0.3 — CI save-boundary correction

- Agent: Codex.
- Purpose: finish the authorized ship with reliable CI verification.
- Changes: the browser/engine parity test disables automatic clock callbacks and flushes a save on both hosts after each action. This includes the same settlement statistics in both snapshots. Gameplay is unchanged from 1.0.2.
- Checks: the complete parity test passes three consecutive runs. The first 1.0.2 CI run passed 81 of 82 browser checks and exposed this save-timing race; local checks had passed. The final CI result is verified before handoff.
- Version: package.json and package-lock.json advance to 1.0.3 under the patch release rule. Save version stays 5.
- Cleanup: the four extra worktrees are removed. A junction at C:/Code/IdleSnake-redesign points to the primary checkout so the running shared Theme Lab can still serve Snake. It contains no separate code or branch. Retire all five working branches after final verification.
- Last update: 2026-10-03.

## Release 1.0.2 — All working branches

- Agent: Codex.
- Status: integrated and tested; William authorized shipping all branches on 2026-10-03.
- Included: working (engine, economy, nursery, saves, controls, fullscreen, egg chance, and Length Bonus); working-codex-controls (uniform body blocks); working-claude (button sounds); working-redesign (five themes); working-tongue (engine-based tongue display). The shipped 1.0.1 tongue and chomp sound are retained.
- Conflict fixes: retain the engine reader, current controls, uniform body blocks, and both sound modules. Themes keep the number-button focus rule, widen their fullscreen menu by 25%, derive connector brightness from their body palette, and reduce screen effects in fullscreen.
- Checks: syntax and engine authority pass; all 324 Node tests pass. All 76 existing browser checks pass. Six new theme integration checks and nine affected display regression checks pass after the fixes. Desktop and phone screenshots were inspected. William approved release browser checks and the existing CI browser tests.
- Version: package.json and package-lock.json are 1.0.2. Save version remains 5.
- Release target: GitHub Pages from main, https://wehinson.github.io/IdleSnake/.
- Cleanup: retire the five integrated working branches and four worktrees after deployment verification. Keep the local preview at port 4175 on the shipped checkout. Theme Lab now reads that checkout.

## Historical work entries

The entries below record prior checks and decisions. All intended work is included in release 1.0.2; later entries for uniform body blocks replace the earlier markings and size variation. Earlier release limits and branch paths no longer apply.

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
# task/minigame-brick-crossing-20261011 — Minigame PR2 requests 3 and 4

- Agent: Codex, GPT 6.1 Sol, local Jimothy.
- Base: `31e773efee60c85d6781078803e4eae208911e4e` (local working).
- Status: Active; final review and exact-code full check pending; isolated task branch, never merged into working/main.
- Scope: Brick Breaker health/layout, motion, pickups and tail expiry; Snakeger obstacle tiers, overtaking, boundary rendering, win lock and length.
- Tests: 13 engine acceptance tests and 8 actual renderer/input VM tests. `npm run check` passed syntax, authority and 355 Node tests at exact `3f77531`; subsequent clear-transition resume fix passes all 8 handler/renderer tests and `node --check game.js`, with the final full check queued for the serial validation slot. Direct HTTP exact-byte checks pass for game.js and breakout/crossing/session engines on `/test7/`.
- Version impact: no release bump; no save-format change intended.
- Last update: 2026-10-11.
- Acceptance: paddle/ball/pickup speeds are 346.5/270.9/96.6 (all previous values ×1.5); fixed 240 Hz physics preserves elapsed time and includes fast-ball and growth/expiry collision tests. Tail warning begins at 5 seconds, cadence increases at 2 seconds, only tail index zero dims; reduced motion is steady and pause/reset/expiry stop the warning. Circular ball/multiball, palette square growth, progressive fractures/chips and no Breakout grid. Forty bricks, top-to-bottom health 3/2/1/1; remaining health changes black→blue→green as fractures accumulate. Seventy hits and score 400 for a complete board (10 per destroyed brick, no damage score).
- Interpretation: doubled brick height 16→32 engine pixels, unchanged width 65.6 and gap 4, all rows uniform and near top (y 28/64/100/136). Snakeger logs are the existing lethal road obstacles; no water or supporting-log mechanic is added. Green is most common; independent blue/black speeds are 1.25/1.5625 of each lane's green speed, allowing overlap/overtake with wrapped collision behavior retained.
- Lifecycle: win immediately flushes turns, locks controls for 1000 ms (death duration), prepares the next stage Ready and requires explicit Start. Death also clears queued turns and requires Start after reset. Engine tests cover rejected queued/held directional starts and idle readiness; actual handler tests cover Start and large D-pad center presses held across win/death, fresh post-lock starts, cross-control presses, multiple pointers, cancellation and Enter repeats; normal pause/reset controls are preserved. Length HUD refreshes immediately at clear/ready. Breakout returns unconsumed frame time at ball loss/win so paused remainder cannot age growth or the run timer.
- Dependencies/risks: sibling-owned generic connector helper/wrapper must be integrated for guarded scoped calls to draw connectors. Reward owner must combine central payouts/history; this branch does not change payout formulas (current win 500, crossing 15/20/... stage payouts remain for sibling consolidation). No save migration or version bump; active minigames are not durable save state. No browser automation or computer use authorized/performed; perceived appearance, timing and integrated connectors need William's visual test at `http://localhost:4173/test7/`. Coordinator owns stable route; no server mutation.
- Notes: no Colony commits, working/main merge, deployment, root balance/save edits or CI edits. Independent read-only research and review run through T3 GPT6.1Sol; review evidence recorded at final handoff.
- Review history: first review returned death-repeat restart, post-loss timer aging and stale length HUD findings; all resolved in `a939fa8`. Round 2 reviewed that exact tip, confirmed those fixes and found the held large D-pad center bypass, fixed in `3f77531` with shared per-control eligibility, lifecycle epoch, pointer identity and cancellation. Round 3 confirmed the held-pointer fix but found Space-paused clearing could not resume by pointer. Fresh post-lock Pause/center now resumes clearing; captured press phase prevents that hold from turning into Ready Start. Round 4 pending. No cancelled review counted as a pass.



## task/minigame-sokoban-levels-20261011 ? MINIGAME PR2 request 6

- Agent: local Codex, GPT 6.1 Sol; isolated T3 task branch from `31e773efee60c85d6781078803e4eae208911e4e`.
- Status: Ready for coordinator review; task branch only, no individual PR or merge.
- Scope: fifteen total Sokoban stages requiring genuine growth and directional tail/wall bracing; narrow retained-tail growth collision correction. Snakebird array and all session/payout/connector implementation preserved.
- Acceptance: all fifteen engine/session witnesses win legally; every heavy shove rejects unchanged without its actual support or with length four. All zero/single-pellet counterexample searches exhaust without solution. Two Keys requires three pellets (length six); Long Lever requires four (length seven). Gate pockets prove no bypass; Rebrace spends its anchor and Anchorworks requires clearing the left goal/tail anchor.
- Tests: 53/53 targeted tests; `npm run check` passed syntax120JS, authority11modes and all363Node tests. Existing tests retained with scoped first-stage witness/final-stage index updates. Browser fixture updated but not run. Direct HTTP200/exact-byte checks for index/game/puzzle-levels/sokoban passed.
- Evidence: `SOKOBAN-LEVELS.md`, `tests/fixtures/sokoban-solutions.json`, scoped engine legality/counterexample/progression tests and bounded search CLI. Completed mechanics/design research identified the growth bug; reboot-cancelled late-stage design is NOT a review PASS, and recovered candidate routes were independently verified.
- Save/version: no migration or release bump; existing Seeds and high records survive. First five static reward fields preserved, central reward replacement owned by sibling.
- Preview: coordinator-owned `http://localhost:4173/test9/`; no server mutation or browser/computer automation.
- Risks/integration: independent exact-tip coordinator review and combined reward tests remain required. No human/UI difficulty review; witnesses do not assert optimality. Snakebird shared-file changes are independent array hunks; tiny shared test/README fixture hunks need normal conflict care.
- Last update: 2026-10-11.
