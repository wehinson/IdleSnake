# Minigame PR3 — William's revision round, 2026-10-13

## Current state

2026-10-14 base update: William merged Colony PR2 into working and now explicitly authorizes a merge of origin/working262eac2c1a2d2e976c9ffd2eb4a3f1edd55142e6 into this integration branch, early in the revision round. This supersedes the earlier no-Colony-import boundary for that approved working merge only. Coordinator resolves BRANCHES.md once, preserving both histories; other shared source files merge automatically and still require semantic inspection and full combined checks including Colony. Workers must pick up the resolved integration base safely. Do not directly import other Colony worker/task commits, rewrite history, merge main, or restore retired /test3-/test5 checkouts/routes.

PR3 stays open against `working`: https://github.com/wehinson/IdleSnake/pull/3. Original revision baseline was `a83251ad840e53cbde0bef5e2c105dfd6080b51c`, clean and CI green. The new resolved common base is `36aae35c560e2c2a7a432e0c2e0bfa0e18a6e1f7`, merging only the newly approved working262eac2. Five original workers preserve scoped work and pick up this coordinator-resolved tip. No additional Colony task/release/main imports, reset or rebase are authorized.

Early merged-base validation at exact36aae35: npm run check535/535 PASS,143 JS syntax checks and11-mode authority/canonical persistence PASS; actual Colony UI acceptance (current rates, contribution/service text and candidate lifecycle) PASS; working-relative diff check PASS. One serial pass, lease released, clean head unchanged. Logs are retained in the integration Git directory as minigame-working-36aae35-check-pass1.log and matching UI/diff logs. This proves the early merged baseline; it does not validate the unfinished13 revisions.

Colony compatibility to recheck with final revisions: its public passive-income query now includes approved10× production, which feeds reward income factors automatically; minigame settlement remains excluded from that income. Back-to-Classic must preserve approved Seed turn grace, progression, migration and saves. Minigame changes must retain Colony habitat/candidate/service UI and rate calculations. No baseline failures appeared; final combined source review/tests still must check these boundaries.

Implementation is in progress; none of this round is accepted yet. One final combined review is required after scoped changes and combined checks. All earlier failed/cancelled findings and successful exact-tip evidence remain in the existing review records.

The coordinator is the sole heavy-job allocator. Operations verified no current competing lease or OIKOS READY job. Source and small checks may proceed. Full suites, solver sweeps and simulations require a named fix-loop lease: at most5 minutes or3 attempts, one heavy job at a time, one request/release, no START echoes. Each pass runs all independent checks and reports every failure; skip only failed-dependent checks. OIKOS keeps next-READY priority.

No browser/computer/Playwright automation is authorized. No merge, deployment, release/version or CI-workflow change. Preserve all unrelated root files, saves, checkouts and previews. Settle agent-created workers after recorded handoff; leave running work visible and user-created threads open.

## Required changes and ownership

| Change | Required behavior | Original owner |
|---|---|---|
|1|Every non-zero minigame reward rounds UP to a whole Seed; zero stays0.|Rewards|
|2|Duel Up, Down and Space start. Up/Down use that heading; Space uses the default heading as reported assumption.|Snake UI|
|3|Place Duel's winner panel away from its fatal collision cell, using an easy opposite-half method.|Snake UI|
|4|Animate the losing Duel snake like Classic death; respect reduced motion.|Snake UI|
|5|Modestly reduce unforced opponent self-deaths and modestly reduce opponent Seed collection. Show identical-seed before/after numbers.|Snake UI|
|6|No rewards for losses in modes with natural wins/losses. Draw0; deliberate bank still pays. Keep score-based awards for no-win modes as an explicit reportable assumption.|Rewards|
|7|New timed Nibbler rules and15 designed, replay-verified levels, with both Claude and GPT design children.|Snake UI|
|8|Breakout ball acceleration doubles starting speed at90 seconds and continues linearly to a reported safe cap. Bricks retain their original colors, using cracks/shattering for damage. Slightly increase multiball chance and report old/new rates.|Brick/Crossing|
|9|Make next Snakeger stage Start reliable and obvious. Mix colors within tracks; report how color-related speeds work.|Brick/Crossing|
|10|Sokoban actual straight occupied-body wall brace, and15 redesigned levels needing that rule. See correction below.|Sokoban|
|11|Replace one length3 fleet snake with a four-cell L inside a3×2 box; allow rotations and update player/AI placement, targeting, sinking and totals.|Arcade|
|12|Centipede fires at a constant faster rate, with concurrent projectiles instead of waiting for impact. Report rate.|Arcade|
|13|Top-left Back in every active minigame returns to Classic and abandons the unfinished run without payout; use the existing exit path and report its effects.|Snake UI|

### Nibbler — change7

Movement is30% faster than current: constant starting cadence105/1.3 =80.769230769ms. Wall hits stall rather than kill. The body has a small shake while stalled (static under reduced motion), and the countdown drains3× faster until the player turns away.

Every level starts with exactly15 Seeds already placed and180,000ms on the countdown clock. Collect all15 before time expires to win. Timeout is a loss with no reward. More remaining time gives more reward. Corridors are exactly one movable cell wide; each has a half-cell shoulder on either side that is only visual, never traversable.

Design exactly15 fun, varied levels in rising difficulty. Both Claude and GPT6.1Sol T3 design subagents are required; Claude permission applies ONLY to Nibbler level design. Compare their candidates and preserve selection rationale. Replay every board under the actual engine, proving all15 Seeds reachable and completion within3 minutes with reasonable margin. Keep existing self-body collision and growth unless they prevent solvability; report what is kept.

Proposed engine schema:21×21, no wrap; a dedicated engine/maze-levels.js contains id/name/map/direction/witness/rationale/difficulty. Active state has timeLimitMs=180000, remainingMs, seedsCollected, totalSeeds=15, stalled and result. Current self-body collision is fatal; each Seed grows the snake by1. Terminal metadata includes won/reason/remainingMs/timeLimitMs/seedsCollected/totalSeeds/levelIndex/score.

Required read-only design tasks (source/design only, no heavy solver):
- Claude Opus5.5, medium: node:delegated-task:command%3Amcp%3A3fd7493a-04dc-4025-8f70-e94c49c6b351%3Adelegate-task%3Anibbler-level-design-claude-20261013-v1
- GPT6.1Sol, medium: node:delegated-task:command%3Amcp%3A3fd7493a-04dc-4025-8f70-e94c49c6b351%3Adelegate-task%3Anibbler-level-design-gpt-20261013-v1

### Sokoban — William's correction to change10

William explicitly discarded Home's length-only assumption. The actual body must lie in a straight, continuous line between the box and wall: head adjacent to the box, every cell from head back to the wall occupied by the snake. A sufficiently long but bent snake CANNOT push. Check occupied cells, not a length threshold. Remove the old all-Seeds/hard-length5 gate.

Use this rule for all15 redesigned, increasingly interesting levels. Each must require lining up against a wall at least once and have a legal replay witness. Inspect and report old behavior before changing it. The baseline engine checks only heavy crates for length≥5 and a wall behind the tail, without checking that the entire body is straight; other crate kinds bypass it. The worker must verify this and report the difference.

The earlier length-only worker proposal and coordinator approval are superseded. Preserve existing growing-tail/body collision and gate legality unless a concrete requested change requires otherwise. Include partial-pellet examples where a valid physical brace already permits a push; there is no all-pellets requirement.

### Shared reward and fleet contracts

The reward owner alone changes payout/history/receipt/canonical save hooks. Apply ceiling once after the complete formula/cap, never after an intermediate four-decimal round. Natural-win modes: Duel, Breakout, Snakebird, Sokoban, Venom Strike and the new timed Nibbler. Loss/draw pay0. Score-only exceptions to report: Snakeger, Broodline, Centipede and Runner. Deliberate Broodline bank retains payout and all engagement/progress guards.

For Nibbler, normalized performance is remainingMs/timeLimitMs, clamped0..1, only after a verified15-Seed clear with actual applied gameplay. Snake's engine supplies terminal metadata; it does not duplicate wallet/history settlement. Missing or malformed inputs must not manufacture a win.

Fleet interpretation accepted for implementation: replace Python (the third entry, one of the two length3 pieces) with three cells in a line plus a fourth at a right angle on one end. Counts become5,4,4(L),3,2 =18 occupied cells. Rotations, bounds, no overlap, AI placement, hit/sink totals and rendering use that shape.

## Original workers

| Owner | Thread | Branch |
|---|---|---|
|Rewards|mcp:f8d8c6c9-6d22-4054-af48-c6768be37465|task/minigame-rewards-20261011|
|Snake UI|mcp:30aa62db-38dd-45af-a2d2-05b177b3a30f|task/minigame-snake-ui-20261011|
|Brick/Crossing|mcp:792ca7d4-1068-4df9-89af-466c4b36398d|task/minigame-brick-crossing-20261011|
|Sokoban|mcp:33616d55-5674-4e78-9652-e3953e91dcea|task/minigame-sokoban-levels-20261011|
|Arcade|mcp:45560e22-c632-4a49-83e5-4d71d479a2cd|task/minigame-brood-strike-centipede-20261011|

Coordinator: mcp:618042fc-9354-4fc9-906a-1b3ca5c689e4, task/minigame-batch-20261011. No new ordinary workers or per-worker full review layers. Inspect scoped tips and tests, integrate only accepted changes, run combined checks, then one independent final combined review. Later rounds retain full history but focus unresolved findings/fix deltas; escalate after3 unsuccessful substantive rounds.

## Completion gates

Each change needs an engine test or a stated UI-only reason. Existing tests remain; deliberately changed expectations must be listed. Exactly-once payout/save semantics remain intact.

Final head must be pushed to the SAME PR3, mergeable, with green CI. /test12 serves that integration checkout. Fetch every CSS/script referenced by served HTML and verify200, correct MIME, non-trivial bodies and exact checkout bytes. Do not recreate retired /test1 or alter shared routes/server.

Final report lists each change's done/not-done status, evidence, assumption and manual layout/feel/difficulty gaps. Routine coordination and final result go to Operations mcp:bb549ea6-daa7-494c-9049-62a5453eef80; Home receives only user-ready results, real decisions and blockers.
