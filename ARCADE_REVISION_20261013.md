# PR3 revisions 11 and 12: fleet geometry and regular fire

This worker resumes the original branch/checkout. Its original accepted tip
`087fea5` was fast-forwarded to same-minigame integration `a83251ad`, then its
owned WIP was merged with the coordinator's resolved `36aae35`. That resolved
tip alone imports William's approved working/Colony base `262eac2`. The only
conflict was the log: the resolved coordinator log was retained with this
worker's new scoped entry. Engine/UI code merged automatically.

## 11. Python replaces one former length-3 snake

The fleet order is Titanoboa (5), Anaconda (4), Python (4-cell L), Viper (3),
Adder (2). Python is the third entry, the first of the former two length-3
pieces. There are five ships and **18 occupied cells**, previously 17.

The default Python cell order is `(0,0), (1,0), (2,0), (2,1)`: three inline
cells, then one perpendicular cell at the end. Its box is 3x2, but the other
two cells are empty water. Four clockwise rotations are available through the
existing Pause/R Rotate action: `h`, `v`, `h2`, `v2`. No mirrored variants are
added. Each rotated box is normalized to a top-left placement anchor; the
first ordered cell remains the rendered head and may be away from that anchor.

The actual engine definition owns the shape. `shipCells` accepts a definition
for shaped ships and retains the numeric-length API for straight custom
fixtures. `shipBounds`, the placement cursor clamp, and AI random placements
all use the rotated occupied cells. Out-of-bounds, overlap, empty and duplicate
cell placements are rejected; the existing rule that different ships may
touch is unchanged. In particular, another ship can occupy an empty box cell.
An impossible board returns no random fleet without a large retry sweep.

Hits, the fourth-hit sink, sunk count, victory and the reward ledger continue
to use actual occupied cells. The host's ghost uses the same definition.
Revealed ships pass their ordered cells to the existing connector wrapper
before body tiles, so the three necks include the end bend. Hidden enemy
ships have no body tiles or connectors; sunk/revealed ships show four cells.
Full-width square boards, tap transforms and persistent accessible shot
feedback are retained.

## 12. Centipede uses a constant projectile clock

**One shot every 210 ms = 4.7619 shots/second**, independent of how many
projectiles are flying or whether an earlier shot hit/missed. The first shot
still starts on the first 70 ms gameplay tick, then at 280, 490, 700 ms, etc.
Previously, one projectile gated the next launch. At the default height in
an empty field its cycle was 12 ticks / 840 ms = 1.1905 shots/second (before
the earlier tuning, 14 ticks / 980 ms). The new typical open-field frequency
is four times the prior accepted rate. The old impact-dependent nearby-target
rate is replaced by this same regular schedule rather than triggering an
immediate shot on every impact.

The engine owns `bullets[]` and `fireAccumulatorMs`. Each projectile carries
its own fractional travel and fresh-shot marker. The host draws every
projectile; it contains no fire clock or frequency calculation. Travel remains
2.4 rows per tick and checks each crossed cell, including the initially
adjacent cell. Player input remains 70 ms; enemies remain 87.5 ms (-20% from
the original enemy rate). Health opacity, the larger bounded player silhouette,
single-cell collisions, segment/mushroom points, wave growth and lives remain.

Actual `controlledMove` is still emitted immediately after player movement,
before projectile effects or respawn; automatic shots do not create player
engagement. Clearing a wave discards shots from its old field while continuing
the regular clock. Life loss discards all shots and resets the opening clock;
the nonfatal run is Ready with no stale shots. A later resume starts fresh.
Fatal repetition cannot produce another game-over event. Pause advances neither
movement, projectile positions nor the fire clock. Restart creates an empty
projectile array and a fresh clock.

This is an endless score mode; this worker does not change its reward policy,
rounding, receipt or persistence hooks. Active minigame boards/projectiles are
still not saved. Durable records, actual earnings and receipts retain their
existing format; no save migration or version bump is needed.

## Evidence and changed expectations

- `engine/arcade-revision-20261013.test.js`: 12 focused tests cover literal four
  rotations, edge/no-fit/overlap/touching/hole semantics, 12 deterministic AI
  seeds and all rotations, 18 hits, last-cell sink/victory/once-only payout and
  unsaved board reload. Projectile tests cover constant cadence for hits and
  misses, two airborne shots before impact, three elapsed-time partitions,
  multi-shot cell traversal and no double segment scoring, wave/nonfatal/fatal
  cleanup, controlled-move event order, pause and restart.
- `scripts/arcade-revision-rendering.test.js`: four actual host-function VM
  tests verify all rotation ghosts/validity, the real shared connector geometry
  before body tiles, hidden/sunk/revealed L behavior and all concurrent shots.
- Existing coverage is retained with deliberate expectation updates: fleet17
  becomes18; row fleet fixtures reserve two rows for the L; projectile object
  fixtures/assertions become arrays; travel fractions move onto each shot;
  the old impact-gated 12-tick cadence becomes the regular 3-tick cadence.
- Full verification requires the coordinator's finite sole heavy lease.
  Browser/computer/Playwright checks are not authorized. Phone fit, rotated
  piece appearance, perceived fire density and balance need William's manual
  test. The coordinator owns the one final combined review; no worker review
  layer, new branch, individual PR, deployment or preview mutation is added.
