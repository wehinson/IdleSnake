# Sokoban growth and wall-anchor campaign

MINIGAME PR2, request 6. Fifteen total stages replace the five-stage catalog.
The Snakebird array, session payout rules, connectors and save schema are unchanged
by this branch. Preview: coordinator-owned `http://localhost:4173/test9/`.

## Rules used by the levels

- Arrow/D-pad movement is turn based. A pellet grows the snake immediately by
  retaining its tail. A growing move cannot enter that tail or push a crate onto it.
- Light crates need a free destination. Heavy crates also need length **at least
  five before the move**, and a wall immediately behind the **current tail**,
  opposite the push direction. Bent bodies can brace. A crate or closed gate
  does not provide wall support. Each shove checks support again.
- A body segment, including the tail, activates a plate. Crates do not.
  Gates check plate occupancy **before** the move. A gate can close around a
  snake/crate after the tail leaves its plate; that occupant can depart. New
  entry into a closed gate is blocked. This existing rule is preserved.
- All crates must occupy goals to win. Collecting pellets alone never wins.
  Every stage starts with three segments and an unsolved heavy load, so at least
  two growth pellets and a real wall-backed push are necessary in any solution.

## Escalating design

Early stages teach growth, bent supports and changing push direction. The middle
stages add obstructing loads, plates, interior anchors and shared turning space.
The last stages combine several loads, longer plate spans and goal/anchor ordering.
Move counts below are replay witness lengths, not difficulty scores or optimality
claims. Introducing a new constraint can use a shorter teaching route.

1. **First Push** — 3 moves, length 5. Two growth moves prepare a single wall-backed
   heavy shove. A direct introduction to a rule ordinary Sokoban does not have.
2. **Around the Heel** — 9 moves, length 5. Grow down a shaft and bend around its
   heel; the tail remains beside a vertical wall while the head pushes right.
3. **Harvest Loop** — 16 moves, length 5. Pellets lie on separate sides of a wall
   island. Return to the load with the grown body arranged at a usable support.
4. **Ceiling Press** — 13 moves, length 5. Harvest below the load, then arrange a
   floor-backed tail to push up. Wall support is directional.
5. **Dogleg Delivery** — 27 moves, length 5. Send the load around a wall corner,
   changing from a rightward anchor to an upward anchor.
6. **Light Work First** — 17 moves, length 5. A light crate blocks the starting
   corridor's only exit. Clear it before reaching either growth pellet, park it,
   then solve the heavy delivery with the longer body.
7. **Living Bridge** — 13 moves, length 5. The body must hold a plate while the
   head delivers a heavy crate through a gate into an enclosed goal pocket.
8. **Rebrace** — 28 moves, length 5. An interior wall supports the first shove.
   That shove spends the anchor: the next right push is illegal until the body is
   repositioned. The witness reroutes the load and returns to the interior support.
9. **Crossed Cargo** — 19 moves, length 5. Two heavy loads need perpendicular
   braces through shared body/turning space.
10. **Opposed Loads** — 45 moves, length 5. Deliver heavy loads toward opposite
    walls. The witness uses four push directions to manage the long body and exits.
11. **Gatehouse** — 15 moves, length 5. A light delivery shares the workspace with
    a heavy gate delivery. Arrange the parking and plate hold without losing access.
12. **Two Keys** — 29 moves, length 6. Two enclosed gate goals use separate plates.
    Finish the first load, leave via the escape pocket, collect the third pellet,
    then stretch across the lower plate and second heavy-push position.
13. **Three Bearings** — 52 moves, length 5. Three heavy loads compete for the
    same room. The witness changes direction, temporarily lifts one load out of its
    delivery lane and returns it from another wall anchor.
14. **Long Lever** — 21 moves, length 7. Four scattered pellets, wall islands and
    an enclosed gate goal require a seven-cell plate-to-head span. Length five or
    six cannot finish; every pellet is required despite the heavy threshold of five.
15. **Anchorworks** — 56 moves, length 5. Three heavy loads, restricted pockets
    and a gate combine earlier rules. The left goal is also the only possible tail
    position for the gated load's final right shove. Parking there too soon blocks
    that anchor. The witness parks, clears, then restores the left load.

## Replays and counterexamples

`tests/fixtures/sokoban-solutions.json` stores all fifteen witnesses in campaign
order. `U/R/D/L` means up/right/down/left. `engine/sokoban-levels.test.js` replays
every edge through the actual engine and all routes through the session. It checks
connected, unique bodies; no crate/body/solid overlap; first win at the final move;
and exactly one terminal reward event. Existing lifecycle assertions are retained,
with their first-stage route and final-stage index updated for this catalog.

For **every heavy shove** in every witness, removing its actual supporting wall
rejects the same move without changing state. Truncating the body to four segments
also rejects it unchanged. Each shove occurs after at least two pellets were eaten.
Every stage has an off-goal heavy crate: moving such a crate always invokes these
engine checks, even in a solution different from the recorded witness.

Exhaustive bounded engine searches with **zero pellets**, and with **each possible
single pellet retained**, find no solution on all fifteen stages. Removing pellets
leaves the floor/collision geometry unchanged. These searches exhaust their queues;
no capped search is called proof. Zero-pellet state counts, stages 1–15:
`3, 9, 144, 154, 178, 1234, 123, 216, 216, 148, 2520, 173, 184, 170, 141`.

Extra-growth necessity is stronger on the two long-span stages:

- **Two Keys:** omit each of its three pellets individually; no solution after
  exhausting **20,758 / 21,093 / 21,069** distinct states.
- **Long Lever:** omit each of its four pellets individually; no solution after
  exhausting **3,585 / 3,726 / 2,954 / 3,014** distinct states.

Every gated goal has walls above, below and to its right. The gate on its left is
its only possible crate entrance. Disabling its plate blocks witnessed entry
unchanged, so a permanently closed gate cannot be bypassed. For Anchorworks this
structural proof replaces an inconclusive 100,000-state disabled-plate search.
The capped draft searches were not accepted as impossibility evidence.

Reproduce without a browser:

```sh
node --test engine/sokoban-levels.test.js engine/sokoban.test.js engine/session-puzzles.test.js engine/ui-boundary.test.js
node scripts/sokoban-search.js
npm run check
```

The search CLI is bounded at 200,000 states per stage and uses a weighted queue
to find witnesses, without claiming shortest paths. All final stages find a
witness within **27,057** visited states. Negative tests use an exhaustive queue
with explicit limits of 50,000 and require `exhausted: true`. Run workloads
sequentially; the preserved fixtures do not need regeneration to run tests.

## Legality correction

The previous engine always excluded the old tail from collision checks. That was
wrong when a pellet retained the tail. The minimal fix determines growth before
collision validation and excludes the tail only on a non-growing move.

The reachable regression starts in a bordered 7×6 room with snake
`(1,2),(1,3),(2,3)`, light crate `(2,2)`, pellets `(3,2),(2,1),(4,1)` and a distant
goal `(5,4)`. Before the fix, **`RURRDDLLUR`** put both the crate and retained tail
at `(4,2)`. After the legal prefix **`RURRDDLLU`**, the last right move is rejected
with the full state unchanged. Removing the remaining pellet makes the adjacent
non-growing right push legal, because the tail now vacates `(4,2)`.
`engine/sokoban.test.js` covers both cases, retained-tail head entry, and the existing
pre-move gate/closed-occupant departure behavior.

## Persistence, interfaces and verification limits

- No save migration or version bump. Sokoban saves existing Seeds and best score;
  active boards and level-selection history were already session-only. Older high
  records remain valid and are not reset. Fifteen-stage continuation wraps to zero.
- The first five static rewards remain `20/35/45/60/85`; added fields remain
  compatible with the reward owner's replacement payout formula. This branch does
  not alter payouts/history. Final score remains `100 × goal crates + 10 × eaten
  pellets`; the session retains `score`, `reward`, `stageIndex` and `won` in its
  existing terminal event. The new tests compare credited Seeds with the actual
  terminal event so central reward hooks can replace the formula.
- Snakebird content is byte-for-byte unchanged from the baseline. Connector calls
  for Sokoban belong to the Snake minigames owner. No `game.js`, `index.html`, CI,
  session implementation, server configuration or Colony code is changed here.
- Final targeted check: **53/53 tests pass**. `npm run check`: syntax for **120**
  JavaScript files, authority for **11 modes**, and **363/363 Node tests pass**.
- Direct HTTP reads of `/test9/index.html`, `game.js`, `engine/puzzle-levels.js`
  and `engine/sokoban.js` return 200 and match exact checkout bytes. The coordinator
  owns the server and route. No browser/computer automation was run. The existing
  browser puzzle test's Sokoban witness was updated but its assertions were kept;
  UI layout, hint presentation and human difficulty remain unverified.

## Read-only T3 research

All delegated work used local Codex GPT 6.1 Sol, high effort selected at creation.

- Mechanics/design task **completed**:
  `node:delegated-task:command%3Amcp%3A9ab00bca-b4f9-40a9-87f8-8e067814f7f5%3Adelegate-task%3Asokoban-mechanics-design-1`.
  Confirmed existing length/wall rules, gate semantics and the reachable retained-tail
  bug. Its proposed construction ideas informed the campaign.
- Late-stage design task was **cancelled by reboot interruption**, not a review PASS:
  `node:delegated-task:command%3Amcp%3A9ab00bca-b4f9-40a9-87f8-8e067814f7f5%3Adelegate-task%3Asokoban-late-stage-design-2`.
  Partial timeline command outputs contained candidate three-load and gated layouts.
  Their routes were recovered, then independently replayed and checked in the final
  engine/session tests. Its observation about the earlier Two Keys trap was resolved
  by escape pockets and the proved required third pellet.

The coordinator independently reviews the final frozen pushed branch before combining
MINIGAME PR2. This branch opens no individual PR and merges/deploys nothing.
