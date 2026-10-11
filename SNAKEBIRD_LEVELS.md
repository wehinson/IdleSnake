# Snakebird campaign2 — MINIGAME PR2 request5

Exactly15 original boards replace the old five. Runtime content remains in
`engine/puzzle-levels.js`; `engine/snakebird-solutions.json` stores compact
replay witnesses, difficulty/lesson/rationale notes, fruit order, gravity drops,
and search evidence. `optimalMoves` in every runtime definition is a verified
minimum accepted-input count for the central reward owner's efficiency query.

The ordered content moves from anchored reaches and controlled landings to
growth budgets, vacating-tail turns, required harvest order, return crossings,
canopy circuits, and a hanging harvest over the abyss. Shortest counts are
7,8,9,12,13,14,16,20,25,26,27,27,28,33,35 (300 total). Both27-move boards have
different problems: Pillar Ladder uses four harvests and a narrow vertical
anchor; Canopy Circuit routes below and above a wide roof before dropping to
the exit. Human difficulty is a design judgment, not proven by path length.

## Engine and schema constraints

- Rectangular maps use only `.`, `#`, `H`, `o`, `F`, `G`. Each has one head and
  one exit. Parsed bodies are orthogonally contiguous in **row-major body order**.
- Every initial body is supported. Parsing does not apply initial gravity.
- A move propagates the body, grows once for an eaten fruit, then settles the
  entire shape. One segment above a solid supports the whole snake.
- Fruit/exit tiles do not support the body. Falling through fruit does not eat
  it. Only the settled head at the exit with no fruit remaining completes.
- Growth retains the tail; other moves can enter its vacating cell. Falling
  below the map is lethal. No spikes, portals, movable blocks or multiple birds
  were invented for this engine.

## Validation and deliberate constraints

Run `node scripts/solve-snakebird.js` to independently solve all15 boards using
bounded BFS and **actual `applyMove` calls**, then replay the results. State keys
include ordered body coordinates and remaining fruit. Every search completed
below the200,000-state limit; the largest successful search discovered28,110
states. A limit/depth limit is explicitly distinguished from exhaustive failure.
The tool is development-only and is not loaded into the browser.

`node --test snakebird-engine.test.js engine/session-puzzles.test.js engine/snakebird-campaign.test.js`
passes39 tests, including all15 shortest solutions and their real-session wins.
Tests also prove:

- All15 witnesses preserve legal contiguous, nonoverlapping bodies, count every
  growth/fruit removal, use tail-only support, avoid falls, and complete only on
  the final settled move. Every board exposes lethal support-loss alternatives.
- Two Fruit Bridge cannot be solved when either growth fruit is removed, even
  though that also reduces the collection requirement.
- Fold and Climb cannot escape its post-descent state without the remaining
  growth fruit. Its witness enters a vacating tail twice; those moves are blocked
  if growth would retain that tail.
- High Shelf's right fruit, Across and Back's right fruit, Bent Descent's high
  right fruit, Pillar Ladder's top fruit, and Hanging Harvest's bottom fruit
  cannot be the first harvest. These negative searches exhaust their graphs.
- Gravity does not collect passed fruit or complete an unsupported exit.
- Real-session completions persist all15 clear/move records, unlock sequential
  record progress, and emit exactly one terminal event. Random launch/continue
  semantics still allow every board and exclude an immediate repeat.

`npm run check` passes syntax, engine authority and all359 Node tests. Existing
tests are preserved; one invalid-index fixture now derives its upper bound from
the actual Snakebird array instead of assuming five levels. No browser or
computer automation was authorized or used. Visual fit, perceived difficulty,
and the sibling connector/HUD changes need human/combined integration review.

## Saves and reset policy

Save version stays5. On the first selection of a **shipped** new board (including
launch/restart), `migrateCampaignProgress` marks campaignVersion2 and expands
records to15. Loading a save alone leaves its old records untouched.

Existing clear credits stay in their original slots so a replacement board
cannot become a new first-clear reward. Old move scores cannot fairly compete
with different boards: they are archived with clears/selection under
`snakebirdProgress.legacyRecords["1"]`, and live bestMoves restart as null. The
archive survives completion, JSON saves/reload and repeated selection. This is
an automatic **board-score reset**, not a currency or player-progress reset.
Fully clearing the old five retains those credits and unlocks record slot6.
Partial saves keep their clears and derive the next sequential record unlock.
Random access stays unchanged and is not gated by that record unlock.

The migration is tested with both v5 session saves and legacy flat saves;
currencies, Sokoban records, upgrades, nursery, habitats, Notables and settlements
are preserved. As before, active puzzle boards are not saved; a reload starts a
ready board, not a partial puzzle. Custom test/simulation definitions retain the
unversioned progress contract. No reset command, save deletion or live save was
used. No local user save was opened or written.

Static reward fields keep the original first-five values; new entries retain
the existing maximum100/25 as compatibility metadata. This task does not edit
the reward formula or session payout hooks. Request11 owns central Seeds and
must keep first/replay bookkeeping separate from its single run receipt.

## Primary-source inspiration and research

Noumenon Games' [Snakebird description](https://store.steampowered.com/app/357300/Snakebird/)
inspired body shape as the central puzzle resource. Felix Eliasson's
[development account](https://www.gamedeveloper.com/production/snakebird-development-images-and-history)
describes the prototype's transition to gravity and fruit. The developer's
[Snakebird Primer description](https://store.steampowered.com/app/1014140/Snakebird_Primer/)
supports a gentler entry before the more involved boards. We adapted these
mechanic ideas to this engine, not their individual level maps.

Sturtevant, Decroocq, Tripodi and Guzdial's
[2020 AIIDE paper](https://ojs.aaai.org/index.php/AIIDE/article/download/7421/7328/10923)
inspired bounded exhaustive search and checking how small geometry changes
affect shortest solutions. Our growth-removal and fruit-order checks add
mechanic evidence beyond solution length. No external level datasets, artwork,
names, or text were copied. All shipped maps and names were authored for this
task; no specific external level was directly adapted.

Two required T3 read-only design tasks ran on local Codex GPT6.1Sol with medium
reasoning effort selected at creation. Both completed; neither edited files,
used a browser, created nested tasks, or changed saves/routes/branches.

- Mechanics/progression: `node:delegated-task:command%3Amcp%3Ad06fc682-c68b-4a36-9dd7-4457cda6bf62%3Adelegate-task%3Asnakebird-mechanics-design-20261011`.
  Proposed15 mechanic lessons, supplied five legal shortest witnesses, and
  demonstrated required growth and vacating-tail behavior. Those five candidates
  became levels1–5.
- Varied challenging layouts: `node:delegated-task:command%3Amcp%3Ad06fc682-c68b-4a36-9dd7-4457cda6bf62%3Adelegate-task%3Asnakebird-layout-design-20261011`.
  Supplied eight legal candidates and restricted-fruit-order evidence. Seven
  became levels6–11 and15; the similar Tail Bridge candidate was rejected to
  avoid repeating the starter. Parent authored Canopy Circuit, Switchback
  Orchard and Summit Return (12–14), and independently solved/replayed all15.

## Integration boundaries

Only the Snakebird array changed in puzzle-levels; Sokoban and the shared wrapper
remain byte-for-byte equivalent to the base. The session hunk only migrates
progress in Snakebird initialization. Snake owner handles the dynamic15-level
HUD and Bird connectors. Central reward owner handles all payouts/history.

Preview: `http://localhost:4173/test8/`, allocated and served by coordinator
`mcp:618042fc-9354-4fc9-906a-1b3ca5c689e4`. Direct HTTP verifies content against
this checkout; no shared route/server mutation. Integration is
`task/minigame-batch-20261011`; no individual PR, working/main merge, Colony
commit, CI change, version bump or deployment belongs to this task.
