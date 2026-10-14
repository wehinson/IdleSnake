# Minigame PR2 integration and review record

Updated2026-10-11. All six independently passed tips are merged ONLY into this integration branch. Combined exacte30f7c9 check passes475 tests; final combined R1 ACCEPT exactcee27b7 with12 bounded groups. Docs-only handoff successor preserves runtime/tests. One separate Minigame PR to working is review-ready; William approval remains required.

## Current state

- 2026-10-13: William requested13 revisions on PR3. Active round source: MINIGAME_REVISION_20261013.md, including his later corrected Sokoban occupied-straight-body rule. All five original worker branches fast-forward only to common accepted a83251ad; scoped work in progress, no new round acceptance yet. One final combined review replaces repeated per-worker layers. Required Claude/GPT Nibbler design task IDs recorded in the new brief. No current heavy lease; source/small only until named allocator lease.

- PR3 https://github.com/wehinson/IdleSnake/pull/3 targets working separately from ColonyPR2. Original head7977875 CI failed two stale browser presentation assertions (89 total/87PASS); narrow test-only repair retains and strengthens full Strike/Broodline scenarios. Three direct VM groups/syntax/diff PASS; approved runtime/Node475 unchanged. New-head CI, owned by Operations watch, still required; no local browser or acceptance waiver.

- Integration: `task/minigame-batch-20261011`, coordinator `mcp:618042fc-9354-4fc9-906a-1b3ca5c689e4`; base `31e773efee60c85d6781078803e4eae208911e4e`. Six gameplay merge commits: `9b58aee`, `f31336d`, `fb2224d`, `410c429`, `6fac4c0`, `ca4e08e`; review checkpoint before merges `81f0ea6`.
- All six individually ACCEPTED: Snake53bd059, Brick0f6aafc, Bird715ac20, Sokc664c56, Arcade087fea5(R2 fixes R1HUD finding), Rewards707e51f(docsonlyaftereaef). Six explicit merges ONLY integration:9b58aee/f31336d/fb2224d/410c429/6fac4c0/ca4e08e. Combined code/test tipe30f7c9 passes475 tests; no working/main/Colony/release import, final combined R1 ACCEPT recorded; PR creation follows this docs-only handoff.
- Heavy lock released after combined three-pass fix-loop lease: final exacte30f7c9 npm475/syntax139/authority11canonical/diff PASS; two earlier passes retained failed fixture expectations. No repeated full suite needed for docs-only successors. OIKOS nextREADY priority; its server4318/PID17032 styledassets proofPASS/manualvisualhydration pending; sharedSnake4173/PID14548 preserved. Current owner in own Git MINIGAME_HEAVY_LOCK.json.
- Colony PR1 remains a separate scope under its coordinator; none of its implementation/integration commits enter this branch.
- Shared preview: PID14548/4173 and route table unchanged. Home retired test1 because T3 storage cleanup removes its merged tongue checkout; its404 is expected and no restoration/route edit is authorized. Healthy set is root+test2–test12. Final audit79 exact asset matches/no-store (81requests includes2retired404), owncombined test12 references allmatched; root27hashes unchanged. Approvedtongue remains in working/root/shipped1.0.4.
- Reboot reconciliation: no Minigame coordinator heavy command was interrupted or rerun; all six handoffs and commits remain preserved. Snake coordinator R1 completed REQUEST_CHANGES before the crash; it was never reclassified as PASS.
- Process decision from home advisory: reuse exact-code full evidence, including docs-only final tips; subsequent rounds retain full original brief/history but focus checks on unresolved findings, fixes and adjacent risks. After three unsuccessful substantive rounds escalate design to home; never accept by exhaustion. Current promised individual and final combined gates remain mandatory. Report acceptance/rejection/blocker/PR milestones, rather than repeating grants/starts.
- Routine coordination/READY/results/finalcompletion now goes to Agent Operations `mcp:bb549ea6-daa7-494c-9049-62a5453eef80`, which forwards user-ready milestones/decisions to Home. No routine Home echoes. Minigame remains sole finite allocator until explicit transfer. Existing user-created/reopened threads remain open.

## Exact tips, ownership and completion gates

| Requests | Owner / final branch | Exact frozen tip | Exact-code evidence | Coordinator gate |
|---|---|---|---|---|
|1,2,12,13|Snake UI / task/minigame-snake-ui-20261011|53bd0593a3ab2dae37b0eec0c65275d902692413|Parent exact full354/syntax122/authority11 once8.1sec, cleanHEAD unchanged; independent R2 47 checks.|ACCEPT; merged via9b58aee. R1 REQUEST_CHANGES retained oldtip.|
|3,4|Brick/Crossing / task/minigame-brick-crossing-20261011|0f6aafc43caf3125d21f26d02df1f65c8b2a23f1|Parent exact full356; independent19 tests +6 actual input/renderer probes.|ACCEPT; merged viaf31336d.|
|5|Snakebird / task/minigame-snakebird-levels-20261011|715ac205c0dc00e9fdf4e351723d0aea2ee1f840|Parent exact full359/all15 actual BFS witnesses; independent9 selected tests +mechanics/migration probes.|ACCEPT; merged viafb2224d.|
|6|Sokoban / task/minigame-sokoban-levels-20261011|c664c56f63a55ace76b8ff6e17f036c1bcac0e83|Parent exact full363; independent15witnesses/363moves/39wall+lengthcontrols/sixplateprobes/nineselectedtests.|ACCEPT; merged via410c429; searchproofsourceaudited/reused.|
|8,9,10|Arcade / task/minigame-brood-strike-centipede-20261011|087fea5174137dfef42ce71b1358a96daaa5454e|One scoped liveHUD fix after rejectedcca751ca; parent exact357/syntax123/authority11 canonical/diff PASS; actual frame/HUD VM1 PASS. Prior356 remains pre-delta evidence.|ACCEPT R2:1selected+40assertions/9actualframes, exact357full reused; merged6fac4c0. R1 staysfailed.|
|11|Rewards / task/minigame-rewards-20261011|707e51f475aa47ed434f4ab0c112014cc78f60a8|Final two docs only after codeeaef9a5; exact code full356/worker R5 PASS; parent full355f802 +2eaef pipeline VMs; math/engines unchanged since21-trace sim.|ACCEPT: complete scope/payout-path review, six selected checks +one actual-session probe; mapped full evidence reused, mergedca4e08e.|

There are twelve request groups:1–6 and8–13;7 was skipped. Catalog9 plus hidden Runner means ten payout-capable minigames; engine authority includes Classic as the eleventh mode. Runner connectors are now covered by Snake53bd; no silent mode omission.

Full original requirements are in [MINIGAME_BRIEF.md](MINIGAME_BRIEF.md). Full six handoffs, file inventories, calibrations, migrations, worker task IDs and limitations are in [MINIGAME_WORKER_REPORTS.md](MINIGAME_WORKER_REPORTS.md). Complete coordinator published verdicts are in [MINIGAME_COORDINATOR_REVIEWS.md](MINIGAME_COORDINATOR_REVIEWS.md); task history/classifications are in [MINIGAME_TASK_LEDGER.md](MINIGAME_TASK_LEDGER.md). Historical checkpoints, grants and other-project results remain in Git/T3 history; this file is the current state.

## Boundaries and durable workflow

- Exactly ONE Minigame PR targets `working`, separately from Colony PR1. Never combine batches, import Colony/release commits, merge working/main, deploy, auto-merge either PR or bump a release merely to create it. Working remains base31e773e/version1.0.3. Separately approved main618abc8/version1.0.4 differs only in release metadata and is not imported.
- Local Jimothy/GPT6.1Sol; effort chosen only at task creation. Use existing worker threads for fixes, not duplicate top-level conversations. New independent review rounds always use a NEW T3 delegate_task with original requirements, prior findings/responses/unresolved objections and exact tip.
- No browser/computer/Playwright automation authorized. Direct engine, actual drawing/input/save VMs and bounded HTTP are permitted. Existing CI browser tests remain preserved; no unrelated CI changes.
- Only independently passed exact tips enter our integration branch. Tests alone are insufficient: inspect semantics, real outcomes, puzzle mechanics/witnesses, save migration and old/new input variants. Freeze reviewed code; docs-only successors must have explicit byte-identical code mapping.
- One sole heavy owner across projects. A fix-loop lease permits up to five minutes or three attempts, whichever ends first; rebuild, rerun and restart only owned servers within scope without another grant. Run all independent checks per pass, skipping only failed-dependent checks; stop hung work, stress or lease expiry. One release to the owning allocator, no START echoes or unrelated-thread copies. OIKOS ready work has priority; no overlapping leases or bulk/stress/browser work.
- Cleanup correction: William withdrew the worker-open-until-acceptance rule. Agent-created ordinary workers settle at recorded handoff again and resume through messages when fixes are needed. Review/child threads settle immediately after durable result, preserving verdicts. User-created or explicitly kept-open/reopened threads are never auto-settled; active required work remains active. No branch, checkout, route, binding or data cleanup.
- Claims belong in this worktree's Git directory, not root or sibling Git directories. Commit/push only integration task branch. Preserve all root27 unrelated dirty balance files, saves, original tests and their recorded hashes.

## Original workers

|Owner|Existing thread|Stable route|
|---|---|---|
|Snake UI|mcp:30aa62db-38dd-45af-a2d2-05b177b3a30f|/test6/|
|Brick/Crossing|mcp:792ca7d4-1068-4df9-89af-466c4b36398d|/test7/|
|Snakebird|mcp:56e9050b-4db2-47a7-b547-11d09cb0ad4a|/test8/|
|Sokoban|mcp:33616d55-5674-4e78-9652-e3953e91dcea|/test9/|
|Arcade|mcp:45560e22-c632-4a49-83e5-4d71d479a2cd|/test10/|
|Rewards|mcp:f8d8c6c9-6d22-4054-af48-c6768be37465|/test11/|

Snake's narrow Runner handoff after coordinator R1 changed only drawRunner, its actual VM regression and scoped BRANCHES. R2 independently bounded all jump-age center gaps below1.001-cell adjacency, checked two canvas geometries, unchanged tiles/eyes/shadows and connector order. No reward/input/helper changes. Required changed-tip full check now passed354 once (START08:08:10UTC,8.1seconds); no further repeat absent a regression.

Completed coordinator verdicts/task IDs/full findings/proofs are in MINIGAME_COORDINATOR_REVIEWS.md. All recorded agent-created terminal review children are settled immediately, preserving classifications. Remaining new reviews use full original brief/history and source/small checks; no repeated full-suite/search evidence absent a concrete new concern.

Current Arcade task: `node:delegated-task:command%3Amcp%3Aab0d5ba8-7bee-42d0-aa6d-445234728aef%3Adelegate-task%3Aminigame-batch-arcade-independent-r1-cca751c-20261011`; backing `thread:delegated-task:command%3Amcp%3Aab0d5ba8-7bee-42d0-aa6d-445234728aef%3Adelegate-task%3Aminigame-batch-arcade-independent-r1-cca751c-20261011`. Full originalbrief/finalhandoff/research/cancelledR1+completedR2code-docmapping/fixes/adjacentrisks supplied; parentfull356reused, source-smallserial only.

## Semantic integration contracts

- Connector UMD `IdleSnakeConnectors.draw(ctx, cellPoints, {cellSize,x,y,color,columns,rows,wrap,tailBaseDistance,width})` is supplied by Snake; game wrapper maps ThemeKit/player palette and board defaults with overrides. Draw links BEFORE tiles, join only adjacent points, wrapped seam pieces clipped/duplicated without cross-board lines. Preserve default width/tail endpoint and fractional1.18 shield neck.
- Snake owns default/Duel both/Nibbler/Bird/Sokoban/Runner calls. Brick owns normalized pixel-space Breakout and cell-space Crossing calls. Arcade owns Broodline camera offsets, revealed fleet only and Centipede chains split at heads. Verify all ten modes after combination, including theme/reduced-motion/geometry.
- Arcade's added Brood HUD references obsolete `duelGridSelect`, removed by Snake. Remove the obsolete reference during integration and exercise actual combined HUD, not only syntax.
- Preserve Brick's Start/pause-center pointer guards: press eligibility/epoch/pointer identity/cancel/captured phase; held inputs across death/win lock cannot become next-stage Start, fresh post-lock pause resumes clearing. Preserve Snake one-click selector/lifecycle guards without restoring unguarded listeners.
- Preserve Crossing1000ms lock, clear queues on win/death, awaitingStart and explicit fresh next start. Preserve length HUD updates and terminal unconsumedMs subtraction from the session clock.
- Reward controlledMove hook MUST live immediately after actual paddle clamp INSIDE Breakout stepSlice, before pickups/physics; outer step aggregates slice events even on early terminal. Centipede hook immediately after actual movePlayer, before bullet/respawn, preserving independent clocks/fresh-shot traversal.
- Maze Ready may immediately set heading and replace input queue. Reward lastAppliedHeading is a SEPARATE baseline initialized to default mode heading (up for Maze), never mutated by dispatch; compare applied movement then advance baseline. Cancelled right/up before tick must not engage or pay.
- Central reward terminal receipt is the sole wallet/history credit. Remove Maze/Cross intermediate currency and ignore old puzzle static award return while retaining score/outcome/records/first-clear/campaign metadata. Mode switches, event replay, reload and offline handling must not duplicate credit.
- UI terminal serializer/flush must persist wallet/history/RNG/receipt synchronously before interpreter returns; ordinary save debounce remains. Preserve terminal reward hints through Brood/Sok HUD refresh.
- Merge puzzle arrays independently: exactly15 Bird and15 Sok stages. Bird campaign2 retains first-clear credits/archive metadata/reset incomparable bests only at shipped selection/restart; load alone/custom definitions remain unchanged. Sok retained-tail occupancy fix and pre-move gate departure rules remain; no unnecessary save version bump.
- Crossing colored logs are the existing lethal road `cars`, not newly invented water/support gameplay. Brick height16→32 at unchanged65.6 width/gap4 is the reported interpretation. Centipede tuning and all exact values are in the handoff/PR evidence.
- Reward formula/public passive income query is compatible with eventual Colony x10 output, WITHOUT importing Colony code. Preserve all mode calibrations, genuine win mapping, historical earnings diversity, independent seeded±3% RNG and eligibility gates.
- Balance caveat: short minimal-progress losses can pay more Seeds/min than long arcade attempts; diversity has25% floor, calibration is initial rather than measured player percentiles. Independent reward review and human assessment must address this honestly; no claim that unit monotonicity establishes real-player balance.

## Validation, preservation and final PR gates

Existing exact-code full evidence is reused as mapped above; do not rerun unchanged implementations or docs-only tips. Parent Bird proof replayed all15 actual BFS shortest witnesses; Sok proof covers15 legal engine/session wins plus every required growth/wall/gate counterexample. Cancelled late-stage Sok design is NOT a PASS, and Arcade's cancelled R1 is NOT a PASS.

Final combined check window, after all individual gates and source merge:
1. `npm run check` and relevant deterministic actual session/UI/input/save/connector checks, sequential with explicit bounded allocation.
2. Replay all15 Bird and15 Sok witnesses through combined real engine/session; do not repeat exhaustive search absent a concrete regression.
3. Exercise mode picker/fullscreen one-click, actual controls/locks, every natural win/loss and rewards (including idle/cancelled controls), switching/event replay/reload/offline exactly once, campaign migration and state resets.
4. Preserve approved tongue compatibility; no Colony commits. Verify expected module load order and no old payout path remains.
5. Direct HTTP exact index/runtime assets for /test12, plus preservation of root/test1-test11/config/active server and root27 hashes. /test12 currently serves baseline gameplay until integration; never claim combined gameplay before merge.
6. Record manual UI gap: physical phone/fullscreen fit, perceived animation/focus/input, accessibility announcements and human puzzle difficulty remain unverified.

Shared server implementation `C:/Code/IdleSnake/.git/shared-test-server.cjs` reads `.git/local-test-routes.json` per request; keys testN map absolute checkout paths. Preserve root/test1-test5 assignments and test6-test12. No route rebinding/restart. Current home evidence PID14548 supersedes historical PID29492/10940; ignored integration Git directory retains original route/hash manifests, initial78 comparisons and parent check logs.

Create exactly one Minigame PR targeting working, body with real newlines: all twelve requests, independent exact-tip verdicts/task IDs, formula/units/calibration/examples/balance caveat, puzzle legal proof/attribution/migration, tuning, combined check evidence and actual /test12 preview/limits. No version bump or auto merge. Immediately link PR to this coordinator and home `915f73b5-2a00-44c0-ad8b-61e81d820388`, audit linked-PR lists; report failures candidly. Send final completion via original key `minigame-batch-review-pr-20261011` to Agent Operations `mcp:bb549ea6-daa7-494c-9049-62a5453eef80` instead of routine Home delivery; AgentOps forwards user-ready results. Home retains downstream CI notification responsibility; no coordinator watcher.
