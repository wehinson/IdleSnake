# Minigame Seed rewards — request11

The engine owns one terminal Seed payout for every payout-capable minigame: the nine catalog games and the hidden Snake Runner shortcut. Classic Snake remains unchanged. The implementation is `engine/minigame-rewards.js`; `engine/session.js` alone supplies authoritative progress, outcome, income and run context.

## Formula and units

For an eligible completed run:

```text
I = current active settlement's other/passive Seed income, in Seeds/second
H = lifetime Seeds actually awarded by this mode, across boards and settlements
q = this run's dimensionless normalized performance (see calibration below)
A = sqrt(1 + I / (1 Seed/second))
S = 1 + 3q / (1 + q)
W = 3 for a natural win, otherwise 1
D = 0.25 + 0.75 / sqrt(1 + H / (400 Seeds * A))
J = 1 + 0.03 * (2u - 1), with seeded engine u in [0,1)
reward = round_to_4_decimal_places(40 Seeds * A * S * W * D * J)
```

Ineligible runs award zero. Eligibility requires real gameplay engagement **and** meaningful achieved progress. There is no reward for Start, reset, mode switching, elapsed time, placement, rejected input or idle clicks. Puzzles must actually win after at least one accepted move. Battleship requires a valid shot and a hit/sunk ship (or a win). Duel can earn a win bonus without eating a Seed. Broodline requires earned kill/wave/round progress or a legitimate formation cash-out. Breakout and Centipede engagement comes from an engine `controlledMove` event emitted immediately after actual controlled coordinate movement, before automatic growth, physics or respawn; neutral directions, blocked movement and axes cleared before a simulation step do not qualify. Other directional games require an accepted gameplay direction; Runner's accepted jump is actual gameplay.

At fixed eligibility, outcome, history, income and random draw, increasing score cannot lower the payout. `S` rises from1 toward4, so arbitrarily high raw arcade scores cannot produce unbounded awards. Winning multiplies the same performance payout by3. Income has a stable new-save floor (`A=1` at zero income) and diminishing square-root scaling. At fixed history, income also relaxes the diversity penalty, so total reward remains monotonic in income. Repeat earnings reduce `D` toward a25% floor; the history scale grows with income so equivalent runs produce similar diversity decay at beginner, mid and late incomes. The four-decimal rounding and safety caps can create plateaus, never decreases.

History is **earned Seed currency**, not number of plays, last-selected game, raw scores, high-score records or time. Switching away and back, selecting another puzzle, reloading, changing settlement or spending Seeds never clears `H`. Earning fewer Seeds in another mode makes that mode more attractive; merely switching creates no payout or new diversity entitlement.

## Mode calibration and outcomes

These are interpretable reference achievements, not measured player percentiles. Arcade `q` may exceed1; the shared `S` compresses it smoothly instead of clamping all high scores to the same award.

| Catalog / mode | Authoritative performance and q | Terminal outcome / gate |
| --- | --- | --- |
|1 Vs Snake / `duel`|Player Seeds eaten; `q=score/10`.|Player winner is win; opponent is loss; null is draw. Win or positive score, with accepted gameplay input. Classic Snake best no longer affects rewards.|
|2 Nibbler (formerly Snake Forever) / `maze`|Food gives10×level; advancement adds100×new level. `q=score/320`; first12-food advancement totals320.|Endless; collision is loss. Level advances build score, without intermediate Seed credits. Positive score required.|
|3 Brick Breakout / `breakout`|10 per destroyed brick,0 per damage hit. `q=score/400` for the sibling's40-brick layout.|All bricks destroyed is win; final ball loss is loss. Positive destroyed-brick score and actual controlled paddle movement. Nonfatal ball losses retain one run context.|
|4 Snakeger / `crossing`|Stage s adds100s; `q=score/600` (three clears =100+200+300).|Endless; collision is loss. A cleared stage is meaningful progress, without intermediate Seed credits. No invented final win.|
|5 Snakebird / `snakebird`|On win, `q=min(1, definition.optimalMoves/moves)` when verified optimum exists; otherwise1. More moves never improve reward.|Actual complete exit after gravity, all fruit collected and moves>0 is win. Falling/abort pays0, regardless of cycling or partial fruit. Sibling15-board optima:7,8,9,12,13,14,16,20,25,26,27,27,28,33,35.|
|6 Sokoban / `sokoban`|`q=score/(100×initial crate count+10×initial pellet count)`, capped1; score remains crates on goals×100 plus eaten pellets×10.|All crates on goals with moves>0 is win. There is no natural terminal loss detector; deadlock, reset and incomplete boards pay0.|
|7 Broodline / `broodline`|Existing `pendingSeeds` becomes progression points: kills2, specialist1, hatch2, wave3, round10+round. `q=progress/63`; round1's guaranteed progression is63 before optional pickups/hatches.|Endless. Formation cash-out is `banked`; wall/overwhelmed death is loss. Neither is a fabricated win. Combat/formation continuation retains the same reward context.|
|8 Venom Strike / `battleship`|Sunk enemy ships0–5; `q=score/5`.|All5 sunk is win; own fleet sunk is loss. Partial loss with actual hit can earn the base progress award even before the first ship is sunk. Placement, waiting and miss-only losses pay0. The existing best record still counts wins.|
|9 Centipede / `centipede`|Head100/body10/mushroom1; `q=score/1000`.|Endless; final life loss is loss. Positive score plus actual controlled player movement; Start-only auto-fire pays0. Nonfatal hits retain one context.|
|Hidden Snake Runner / `runner`|`score=floor(distance/12)`; `q=score/1000` (about45 seconds of uninterrupted running).|Endless; obstacle collision is loss. Positive score plus an accepted jump; Start-only distance pays0.|

No minigame movement, physics, level definition, score rule, progression requirement or natural outcome is changed by this reward branch. The two `controlledMove` additions report existing movements only. The coordinator must preserve the Breakout event inside the sibling's new `stepSlice`, and the Centipede event immediately after `movePlayer`, before bullet simulation/respawn.

## Income authority and Colony compatibility

`otherIncomePerSecond` calls the existing public `economy.calculateHabitatActivation` query with habitat counts, food-value upgrades, assigned Notables, habitat upgrades and current provision-funded activation. It uses the same base Seed production inputs as the HUD. Non-established active settlements report zero actual passive income. It reads current production at payout time; raising actual production during play legitimately raises the income factor.

It excludes minigame earnings, the reward itself, currency balances/deltas, Classic Snake length multipliers, other settlements, deliveries, Branches and Provisions production. A Seed stockpile alone has no effect. Production-funded provision availability can affect actual habitat activation through the existing query. Future Colony×10 Seed production automatically changes `I` through this public query; at sufficiently high incomes it raises the income factor by aboutsqrt(10), not10. A targeted test temporarily scales the existing production constant, restores it in `finally`, and proves query and reward compatibility. No Colony commits or changes are included here.

## Worked examples and simulation

Use `node scripts/minigame-reward-sim.js` for the fixed-performance/repeat matrix and `node scripts/minigame-reward-sim.js --traces` for21 reproducible real engine traces (seven realtime modes × seeds1,12,44), repriced at all three incomes. Neither command reads saves, changes files or imports the unrelated root balance harness.

The examples below fix `u=0.5`, so `J=1`, and begin with `H=0`:

| Passive Seeds/sec | q=.25 loss | q=1 loss | q=1 win | q=4 loss |
| --- | ---: | ---: | ---: | ---: |
|0 beginner|64|100|300|136|
|99 mid|640|1,000|3,000|1,360|
|9,999 late|6,400|10,000|30,000|13,600|

A beginner Breakout loss after destroying10 bricks has q=100/400=.25, S=1.6 and earns64 nominal Seeds. A400-point clear has q=1, S=2.5 and W=3, giving300 nominal Seeds. At99 passive Seeds/sec, A=10, giving3,000 for the same fresh clear. If this mode has already earned4,000 Seeds, D=.25+.75/sqrt(2)≈.78033, giving2,340.9903 nominal Seeds. Actual seeded jitter places each result within±3%, with a rounding tolerance of.00005 Seed.

For100 equal q=1 runs, historical earnings update after each payment:

| Scenario | Beginner run1 /10 /100 | Beginner total100 | Mid total100 | Late total100 |
| --- | --- | ---: | ---: | ---: |
|Repeat one winning mode|300 /169.0260 /113.2567|13,549.2073|135,492.0722|1,354,920.7241|
|Rotate five winning modes|300 /245.0840 /147.3659|18,071.0880|180,710.8810|1,807,108.8130|
|Repeat one endless mode|100 /69.5136 /44.7100|5,436.4244|54,364.2452|543,642.4553|

Rotation earns more because each game's actual historical earnings are lower, not because switching resets anything. An untouched winning mode still offers300/3,000/30,000 nominal Seeds after repeating another mode. Its history rises immediately when it pays.

The real engine traces use intentionally weak controllers: one initial legal direction/jump, then Start after nonfatal life loss. They are acceptance probes, not representative human balance data. Seed1 examples at zero passive income: Broodline ends after3.32 seconds with2 progress points (43.3486 actual Seeds), Runner after6.92 seconds with100 score (50.5086), Breakout after14.40 seconds with20 score (45.3547), and Centipede after72.52 seconds with1,152 score (103.4179). Duel, Maze and Crossing controllers make no scoring progress and pay0. The traces show a concrete balance risk: short minimal-progress failures can pay better per minute than long arcade attempts, even though high-score runs and wins pay more per run. The repeat multiplier diminishes this but retains a25% floor. Human completion times and the combined sibling physics/levels still need coordinator balance assessment; this branch does not invent time gates or change mode rules to force parity.

## Persistence, exactly-once and migration

Save envelope version stays5. An additive `session.minigameRewards` version1 ledger stores per-mode earnings, a32-bit reward RNG state, monotonically increasing next-run ID and the latest run receipt. A transient engine-owned `rewardRun` stores mode, ID, engagement and paid status. Hosts cannot dispatch an award or mutate immutable snapshots.

The first minigame launch seeds an independent LCG from the injected engine RNG, before any award, and serializes that seed. Each eligible terminal payout advances it once. Zero-progress/rejected/idle outcomes never advance it. Later gameplay RNG consumption and reloads cannot reroll that reward stream. The one seed draw can change subsequent gameplay RNG sequence relative to the previous release; repeated seeded sessions remain deterministic. The LCG uses32-bit integer arithmetic (`1664525*x+1013904223 mod2^32`); jitter is always within±3%.

Settlement marks the run paid and writes its receipt before returning the immutable `runEnded` event. Repeated terminal calls, cloned old contexts and contexts older than the latest receipt are rejected. Currency and earnings use the existing four-decimal Seed precision. Broodline's `rewardCollected` remains set; every mode's terminal phase prevents repeating the completion action. Intermediate Maze/Crossing credits are removed, so there is no second payout path. UI terminal events persist the canonical session immediately; reinterpreting display events cannot award currency.

Active minigame boards remain unsaved under the existing contract. Serialization writes `rewardRun:null`; hydration discards unfinished runs without a payout and preserves earned totals/RNG/receipt/counter. Offline advancement simulates passive production only for minigames and cannot complete or repay them. A saved completed run retains both currency and history. This is exactly-once within the authoritative current save/session, not a server-side guarantee against restoring an older file, editing localStorage, or unsaved process termination.

Old saves have no reliable per-mode earned-currency totals; high scores, clear credits and old static reward fields cannot reconstruct actual paid history. Absent totals therefore initialize to0, without awarding currency. Existing `minigameRewards.earnings` and legacy `minigameEarnings` maps are retained per known mode after numeric sanitation. The first new save persists the migration, which is idempotent. Puzzle clear/best-move history remains the puzzle owner's concern, including Snakebird's campaignVersion2 archival; `recordCompletion` progress is retained while its obsolete returned currency amount is ignored.

Numeric score, income and history inputs are finite/nonnegative and capped at10^12; reward is capped at500,000,000 Seeds. Invalid inputs become0. Run IDs use safe integers and counter normalization advances beyond an existing receipt. Exhausted IDs fail closed. Caps keep this calculation finite; they do not redesign the game's pre-existing floating-point wallet or guarantee four-decimal wallet resolution at astronomically large balances.

## Verification and review record

Committed reward tests cover all ten payout modes, natural wins/losses available in their rules, significant win factor, monotonic scores/incomes, historical repeat decay and mode switching, zero/new/malformed saves, first-award and later reload RNG continuity, offline/replayed once-only behavior, known-total migration, finite bounds, Colony query compatibility, natural puzzle fall/abort, Start-only autoplay and applied-vs-neutral controls. Existing lifecycle/record/puzzle/Battleship/Broodline tests remain, with obsolete fixed-payout assertions replaced by the new payout contract. No browser/computer automation is authorized; result wording is source/engine checked, while visual layout is unverified.

- Researchr1: `node:delegated-task:command%3Amcp%3A591ecaad-fb5a-40bb-b307-4f084ad02b7d%3Adelegate-task%3Aminigame-rewards-research-r1-20261011`, completed read-only GPT6.1 Sol/high. Confirmed inventory, baseline paths, units, auto-score risks, unsaved boards/RNG and full income inputs. Its proposal to preserve old exact Broodline Seeds was superseded by William's explicit all-mode formula ownership and sibling agreement to progression labels.
- Research finish notification also completed read-only: `node:delegated-task:command%3Amcp%3A591ecaad-fb5a-40bb-b307-4f084ad02b7d%3Athread-send%3Arewards-research-finish-r1-20261011`; no new implementation or independent review was launched there.
- Reviewr1: `node:delegated-task:command%3Amcp%3A591ecaad-fb5a-40bb-b307-4f084ad02b7d%3Adelegate-task%3Aminigame-rewards-review-r1-20261011`, completed read-only GPT6.1 Sol/high against implementation checkpoint and concurrent refinements. **FAIL:** neutral Breakout direction and set/clear Centipede axes incorrectly enabled idle payouts. Fixed with applied-movement events and real default-board regression traces. Receipt counter normalization was already corrected during that review. Reviewr1 is retained as failed evidence, not a PASS.
- A new reviewr2 must inspect the fixed committed code before final handoff; coordinator independently reviews the final frozen tip before integration. No cancelled review is accepted as PASS.
