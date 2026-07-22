const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession, SAVE_VERSION } = require("./session.js");
const { habitatConfig, nurseryConfig } = require("./config.js");
const broodline = require("./broodline.js");
const maze = require("./maze.js");

// A small deterministic LCG so tests that assert on RNG-driven outcomes are
// stable. The engine itself defaults to Math.random; tests inject this instead.
function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

test("Runner is a session-owned mode with pause, restart, and per-mode record persistence", () => {
  const game = createGameSession({ now: 0, rng: lcg(17), save: { records: { runnerBest: 37 } } });
  const ready = game.dispatch({ type: "selectMode", mode: "runner", setup: { width: 120, height: 180 } });
  assert.equal(ready.snapshot.active.boardWidth, 120);
  assert.equal(ready.snapshot.active.boardHeight, 180);
  assert.equal(ready.snapshot.hud.best, 37);
  assert.ok(ready.snapshot.supportedModes.includes("runner"));
  const started = game.dispatch({ type: "direction", direction: "up" });
  assert.equal(started.snapshot.phase, "running");
  assert.equal(started.snapshot.active.player.grounded, false);
  const running = game.tick(16).snapshot;
  assert.ok(running.active.elapsedMs > 0);
  game.dispatch({ type: "pause" });
  const paused = game.tick(100).snapshot;
  assert.equal(paused.active.elapsedMs, running.active.elapsedMs);
  assert.equal(game.dispatch({ type: "restart", setup: { width: 90, height: 120 } }).snapshot.phase, "ready");
  const restored = createGameSession({ save: game.serialize(), now: 0 });
  assert.equal(restored.snapshot().records.runnerBest, 37);

  const ending = createGameSession({ now: 0, rng: lcg(123) });
  ending.dispatch({ type: "selectMode", mode: "runner", setup: { width: 30, height: 100 } });
  ending.dispatch({ type: "direction", direction: "up" });
  let ended;
  for (let index = 0; index < 20 && !ended; index += 1) {
    const result = ending.tick(100);
    ended = result.events.find((item) => item.type === "runEnded");
  }
  assert.deepEqual(ended, { type: "runEnded", mode: "runner", reward: 7 });
  assert.equal(ending.snapshot().records.runnerBest, 7);
  assert.equal(ending.snapshot().seeds, 7);
});

test("Centipede is a session-owned mode with deterministic input, cadence, pause, and record persistence", () => {
  const game = createGameSession({ now: 0, rng: lcg(23), save: { records: { centipedeBest: 91 } } });
  const ready = game.dispatch({ type: "selectMode", mode: "centipede", setup: { cols: 8, rows: 12, playerRows: 3, startLength: 2, tickMs: 70 } });
  assert.equal(ready.snapshot.active.cols, 8);
  assert.equal(ready.snapshot.active.rows, 12);
  assert.equal(ready.snapshot.hud.best, 91);
  assert.ok(ready.snapshot.supportedModes.includes("centipede"));
  const started = game.dispatch({ type: "direction", direction: "left" });
  assert.equal(started.snapshot.phase, "running");
  assert.equal(started.snapshot.active.player.inputX, -1);
  const moved = game.tick(70).snapshot;
  assert.equal(moved.active.player.x, 3);
  assert.ok(moved.active.bullet);
  game.dispatch({ type: "pause" });
  const held = game.tick(140).snapshot;
  assert.deepEqual(held.active.segments, moved.active.segments);
  const restored = createGameSession({ save: game.serialize(), now: 0 });
  assert.equal(restored.snapshot().records.centipedeBest, 91);

  const ending = createGameSession({ now: 0, rng: lcg(5) });
  ending.dispatch({ type: "selectMode", mode: "centipede", setup: { cols: 1, rows: 2, playerRows: 2, startLength: 1, lives: 1 } });
  ending.dispatch({ type: "direction", direction: "left" });
  const ended = ending.tick(70);
  assert.equal(ended.snapshot.phase, "gameover");
  assert.deepEqual(ended.events.find((item) => item.type === "runEnded"), { type: "runEnded", mode: "centipede", reward: 0 });
});

test("held input axes are lifecycle-neutral, bounded, and can be cleared while paused", () => {
  const breakout = createGameSession({ now: 0, rng: lcg(31) });
  breakout.dispatch({ type: "selectMode", mode: "breakout", setup: { width: 240, height: 160 } });
  const held = breakout.dispatch({ type: "setInputAxis", axis: "x", value: 1 });
  assert.equal(held.snapshot.phase, "ready");
  assert.equal(held.snapshot.active.paddle.input, 1);
  assert.ok(breakout.dispatch({ type: "setInputAxis", axis: "y", value: 0 }).events.some((item) => item.reason === "inputAxisUnavailable"));
  for (const value of [2, -2, 0.5, Infinity, NaN]) {
    assert.ok(breakout.dispatch({ type: "setInputAxis", axis: "x", value }).events.some((item) => item.reason === "invalidInputValue"));
  }
  breakout.dispatch({ type: "begin" });
  breakout.dispatch({ type: "pause" });
  const released = breakout.dispatch({ type: "setInputAxis", axis: "x", value: 0 });
  assert.equal(released.snapshot.phase, "paused");
  assert.equal(released.snapshot.active.paddle.input, 0);

  const centipede = createGameSession({ now: 0, rng: lcg(32) });
  centipede.dispatch({ type: "selectMode", mode: "centipede", setup: { cols: 8, rows: 12, playerRows: 3, startLength: 2 } });
  assert.equal(centipede.dispatch({ type: "setInputAxis", axis: "x", value: 1 }).snapshot.phase, "ready");
  assert.equal(centipede.dispatch({ type: "setInputAxis", axis: "y", value: -1 }).snapshot.active.player.inputY, -1);
  const releasedX = centipede.dispatch({ type: "setInputAxis", axis: "x", value: 0 });
  assert.equal(releasedX.snapshot.active.player.inputX, 0);
  centipede.dispatch({ type: "begin" });
  centipede.dispatch({ type: "pause" });
  const before = centipede.snapshot().active.player;
  const releasedY = centipede.dispatch({ type: "setInputAxis", axis: "y", value: 0 });
  assert.equal(releasedY.snapshot.phase, "paused");
  assert.equal(releasedY.snapshot.active.player.inputY, 0);
  const heldPaused = centipede.tick(140).snapshot;
  assert.deepEqual(heldPaused.active.player, { ...before, inputY: 0 });
});

test("start yields a ready run; the first direction begins running and moves the snake", () => {
  const game = createGameSession({ now: 1000, rng: lcg(42) });
  const ready = game.dispatch({ type: "start" });
  assert.equal(ready.snapshot.phase, "ready");
  assert.equal(Object.isFrozen(ready.snapshot), true);
  assert.equal(Object.isFrozen(ready.snapshot.active), true);
  const before = ready.snapshot.active.snake[0];
  const started = game.dispatch({ type: "direction", direction: "up" });
  assert.equal(started.snapshot.phase, "running");
  assert.ok(started.events.some((e) => e.type === "runStarted"));
  const ticksNeeded = Math.ceil(ready.snapshot.active.tickMs / 100);
  let after;
  for (let index = 0; index < ticksNeeded; index += 1) after = game.tick(100).snapshot.active.snake[0];
  assert.equal(after.y, before.y - 1);
});

test("explicit Snake begin can delay the opening move by half a tick", () => {
  const game = createGameSession({ now: 1000, rng: lcg(42) });
  const ready = game.dispatch({ type: "start" }).snapshot;
  const before = { ...ready.active.snake[0] };
  const halfTick = ready.active.tickMs / 2;

  game.dispatch({ type: "begin", initialDelayMs: halfTick });
  // Live ticks are clamped to 100 ms, so advance the opening window in frames.
  let remaining = ready.active.tickMs + halfTick - 1;
  while (remaining > 0) {
    const frameMs = Math.min(100, remaining);
    game.tick(frameMs);
    remaining -= frameMs;
  }
  assert.deepEqual(game.snapshot().active.snake[0], before);

  game.tick(1);
  assert.notDeepEqual(game.snapshot().active.snake[0], before);
});

test("lightweight frame ticks preserve gameplay without producing full economy snapshots", () => {
  const counts = { full: 0, frame: 0 };
  const frameGame = createGameSession({ now: 0, rng: lcg(12), snapshotObserver: (kind) => { counts[kind] += 1; } });
  const fullGame = createGameSession({ now: 0, rng: lcg(12) });
  for (const game of [frameGame, fullGame]) {
    game.dispatch({ type: "start" });
    game.dispatch({ type: "direction", direction: "up" });
  }
  counts.full = 0; counts.frame = 0;

  let frame;
  let full;
  const frameEvents = [];
  const fullEvents = [];
  for (let index = 0; index < 30; index += 1) {
    frame = frameGame.tick(100, { snapshot: "frame" });
    full = fullGame.tick(100);
    frameEvents.push(frame.events);
    fullEvents.push(full.events);
  }
  assert.equal(counts.frame, 30);
  assert.equal(counts.full, 0);
  assert.equal(Object.isFrozen(frame.snapshot), true);
  assert.equal(Object.isFrozen(frame.snapshot.active), true);
  assert.equal("migration" in frame.snapshot, false);
  assert.equal("completedResupplyMissions" in frame.snapshot, false);
  assert.equal("habitats" in frame.snapshot, false);
  assert.equal("notables" in frame.snapshot, false);
  assert.deepEqual(frameEvents, fullEvents);
  assert.deepEqual(
    { mode: frame.snapshot.mode, phase: frame.snapshot.phase, elapsedMs: frame.snapshot.elapsedMs, score: frame.snapshot.active.score, head: frame.snapshot.active.snake[0] },
    { mode: full.snapshot.mode, phase: full.snapshot.phase, elapsedMs: full.snapshot.elapsedMs, score: full.snapshot.active.score, head: full.snapshot.active.snake[0] }
  );

  const isolated = frameGame.snapshot();
  const head = { ...isolated.active.snake[0] };
  frameGame.tick(100, { snapshot: "frame" });
  assert.deepEqual(isolated.active.snake[0], head, "full snapshots remain isolated from later state changes");
});

test("the same injected rng and actions produce an identical canonical save", () => {
  const run = () => {
    const game = createGameSession({ now: 10, rng: lcg(7) });
    game.dispatch({ type: "start" });
    game.dispatch({ type: "direction", direction: "left" });
    game.tick(190); game.tick(190);
    return game.serialize();
  };
  assert.deepEqual(run(), run());
});

test("serialize never contains the injected rng and round-trips through a new session", () => {
  const game = createGameSession({ now: 0, rng: lcg(3) });
  game.dispatch({ type: "buyUpgrade", upgrade: "board" }); // no-op if unaffordable, still safe
  game.dispatch({ type: "start" });
  const save = game.serialize();
  assert.equal(JSON.stringify(save).includes("rng"), false);
  const restored = createGameSession({ save, now: 0, rng: lcg(3) });
  const a = restored.snapshot();
  assert.equal(a.seeds, game.snapshot().seeds);
  assert.equal(a.best, game.snapshot().best);
  assert.deepEqual(a.upgrades, game.snapshot().upgrades);
});

test("migrates a legacy consolidated save into version two", () => {
  const game = createGameSession({ save: { savedAt: 5, currencies: { seeds: 12 }, records: { best: 9 }, upgrades: { foodTypeLevel: 2 }, settings: { snakeColors: { head: "#fff" } } }, now: 10 });
  const save = game.serialize();
  assert.equal(save.saveVersion, SAVE_VERSION);
  assert.equal(save.session.seeds, 12);
  assert.equal(save.session.best, 9);
  assert.equal(save.session.upgrades.foodTypeLevel, 2);
  assert.equal(game.snapshot().cosmetics.head, "#fff");
});

test("migrates durable UI preferences from legacy V2 fields without changing cosmetics", () => {
  const game = createGameSession({
    save: {
      saveVersion: 2,
      accessibility: { reducedMotion: true },
      settings: { snakeColors: { body: "#123456", head: "#abcdef" } },
      board: { selectedDuelGridSize: 20 }
    },
    now: 10
  });
  const snapshot = game.snapshot();
  assert.equal(snapshot.reducedMotion, true);
  assert.equal(snapshot.selectedDuelGridSize, 20);
  assert.deepEqual(snapshot.cosmetics, { body: "#123456", head: "#abcdef" });
  assert.equal(game.tick(0, { snapshot: "frame" }).snapshot.reducedMotion, true);
  assert.equal(game.tick(0, { snapshot: "frame" }).snapshot.selectedDuelGridSize, 20);

  const settingsFallback = createGameSession({ save: { saveVersion: 2, settings: { reducedMotion: true, duelGridSize: 15 } }, now: 10 }).snapshot();
  assert.equal(settingsFallback.reducedMotion, true);
  assert.equal(settingsFallback.selectedDuelGridSize, 15);
});

test("session preferences dispatch, validate, serialize, and round-trip deterministically", () => {
  const game = createGameSession({ now: 0 });
  const motion = game.dispatch({ type: "setReducedMotion", reducedMotion: true });
  assert.deepEqual(motion.events, [{ type: "reducedMotionChanged", reducedMotion: true }]);
  const grid = game.dispatch({ type: "setSelectedDuelGridSize", selectedDuelGridSize: 40 });
  assert.deepEqual(grid.events, [{ type: "duelGridSizeChanged", selectedDuelGridSize: 40 }]);
  game.dispatch({ type: "setCosmetics", cosmetics: { head: "#fff" } });

  const save = game.serialize();
  assert.equal(save.session.reducedMotion, true);
  assert.equal(save.session.selectedDuelGridSize, 40);
  const restored = createGameSession({ save, now: 0 }).snapshot();
  assert.equal(restored.reducedMotion, true);
  assert.equal(restored.selectedDuelGridSize, 40);
  assert.deepEqual(restored.cosmetics, { body: null, head: "#fff" });
  assert.deepEqual(createGameSession({ save, now: 0 }).serialize(), createGameSession({ save, now: 0 }).serialize());

  for (const invalid of [false, null, undefined, 0, 12, 31, 50, {}, []]) {
    const rejected = game.dispatch({ type: "setSelectedDuelGridSize", selectedDuelGridSize: invalid });
    assert.ok(rejected.events.some((event) => event.type === "actionRejected" && event.reason === "invalidDuelGridSize"));
    assert.equal(rejected.snapshot.selectedDuelGridSize, 40);
  }
  for (const invalid of [null, 1, "true", undefined]) {
    const rejected = game.dispatch({ type: "setReducedMotion", reducedMotion: invalid });
    assert.ok(rejected.events.some((event) => event.type === "actionRejected" && event.reason === "invalidReducedMotion"));
    assert.equal(rejected.snapshot.reducedMotion, true);
  }
});

test("malformed persisted preferences normalize to safe defaults", () => {
  for (const invalid of [null, false, 0, 9, 11, 100, "not-a-size", {}, []]) {
    const snapshot = createGameSession({ save: { saveVersion: 2, board: { selectedDuelGridSize: invalid } }, now: 0 }).snapshot();
    assert.equal(snapshot.selectedDuelGridSize, 30);
  }
  for (const invalid of [null, 0, 1, "true", {}, []]) {
    const snapshot = createGameSession({ save: { saveVersion: 2, accessibility: { reducedMotion: invalid } }, now: 0 }).snapshot();
    assert.equal(snapshot.reducedMotion, false);
  }
});

test("every shipped mode selects into a ready board and runs on first input", () => {
  for (const mode of ["snake", "duel", "maze", "breakout", "crossing", "snakebird", "sokoban", "broodline"]) {
    const game = createGameSession({ now: 0, rng: lcg(99) });
    const selected = game.dispatch({ type: "selectMode", mode });
    assert.equal(selected.snapshot.mode, mode, mode);
    assert.equal(selected.snapshot.phase, "ready", mode);
    assert.ok(selected.snapshot.active, mode);
    assert.ok(selected.events.some((e) => e.type === "runReady"), mode);
    const firstDirections = { duel: "left", maze: "left", crossing: "up", snakebird: "left", broodline: "up" };
    const started = game.dispatch({ type: "direction", direction: firstDirections[mode] || "up" });
    assert.equal(started.snapshot.phase, "running", mode);
    assert.doesNotThrow(() => game.tick(100), mode);
  }
});

test("the elapsed timer only advances while running and freezes at game over", () => {
  const game = createGameSession({ now: 0, rng: lcg(5) });
  game.dispatch({ type: "start" });
  // Ready but not yet moved: ticks must not advance the run timer.
  const readyElapsed = game.tick(100).snapshot.elapsedMs;
  assert.equal(readyElapsed, 0);
  game.dispatch({ type: "direction", direction: "up" });
  let out = game.tick(100);
  assert.ok(out.snapshot.elapsedMs > 0);
  for (let i = 0; i < 300 && out.snapshot.phase !== "gameover"; i += 1) out = game.tick(100);
  assert.equal(out.snapshot.phase, "gameover");
  const frozen = out.snapshot.elapsedMs;
  out = game.tick(100); out = game.tick(100);
  assert.equal(out.snapshot.elapsedMs, frozen);
});

test("host-supplied setup overrides board dimensions and grid without new rules", () => {
  const game = createGameSession({ now: 0, rng: lcg(11) });
  const breakout = game.dispatch({ type: "selectMode", mode: "breakout", setup: { width: 360, height: 480, segmentSize: 22, gap: 3 } }).snapshot;
  assert.deepEqual(breakout.active.board, { width: 360, height: 480 });
  assert.equal(breakout.active.segmentSize, 22);
  const duel = game.dispatch({ type: "selectMode", mode: "duel", setup: { grid: { columns: 15, rows: 15 } } }).snapshot;
  assert.deepEqual(duel.active.grid, { columns: 15, rows: 15 });
});

test("offline catch-up credits idle income from the save's savedAt, not boot time", () => {
  const oneHourLater = 60 * 60 * 1000;
  const game = createGameSession({ save: { savedAt: 0, currencies: { seeds: 0 }, habitats: { counts: [1] } }, now: oneHourLater });
  const before = game.snapshot().seeds;
  game.advanceOffline(oneHourLater);
  assert.ok(game.snapshot().seeds > before, "an hour of offline habitat income should be credited");
});

test("a save/reload round trip does not resurrect a phantom incubating egg", () => {
  const game = createGameSession({ now: 0, rng: lcg(4) });
  assert.equal(game.snapshot().nursery.eggElapsedMs, null); // fresh: nest empty
  const reloaded = createGameSession({ save: game.serialize(), now: 0, rng: lcg(4) });
  assert.equal(reloaded.snapshot().nursery.eggElapsedMs, null, "reload must not start a phantom egg");
});

test("development grants remain canonical and bounded", () => {
  const game = createGameSession({ save: { currencies: { seeds: 100 } }, now: 0 });
  game.dispatch({ type: "addSeeds", amount: -50 });
  assert.equal(game.snapshot().seeds, 50);
  game.dispatch({ type: "addSeeds", amount: -1000 }); // clamps at 0
  assert.equal(game.snapshot().seeds, 0);
  game.dispatch({ type: "addColonySnakes", amount: 5 });
  assert.equal(game.snapshot().nursery.colonyCount, 5);
});

test("the hidden egg-board counter turns the scheduled classic board into an egg board", () => {
  const game = createGameSession({ save: { saveVersion: 2, savedAt: 0, session: { mode: "snake", phase: "ready", eggBoardCountdown: 1 } }, now: 0, rng: lcg(1) });
  const result = game.dispatch({ type: "start" });
  assert.equal(result.snapshot.active.eggBoard, true);
  assert.ok(result.snapshot.eggBoardCountdown >= 100 && result.snapshot.eggBoardCountdown <= 200);
});

test("buying an upgrade deducts seeds and rejects when unaffordable", () => {
  const game = createGameSession({ save: { currencies: { seeds: 1000 } }, now: 0, rng: lcg(1) });
  const before = game.snapshot().seeds;
  const bought = game.dispatch({ type: "buyUpgrade", upgrade: "board" });
  assert.ok(bought.events.some((e) => e.type === "upgradePurchased"));
  assert.ok(game.snapshot().seeds < before);
  assert.equal(game.snapshot().upgrades.boardLevel, 1);
  const broke = createGameSession({ save: { currencies: { seeds: 0 } }, now: 0 });
  const rejected = broke.dispatch({ type: "buyUpgrade", upgrade: "board" });
  assert.ok(rejected.events.some((e) => e.type === "actionRejected" && e.reason === "insufficientSeeds"));
});

test("Crossing owns its timed clear transition, rejects input, pauses, and resets cleanly", () => {
  const game = createGameSession({ now: 0, rng: lcg(1) });
  const setup = { grid: { columns: 10, rows: 3 }, entryColumn: 0, tickMs: 1 };
  game.dispatch({ type: "selectMode", mode: "crossing", setup });

  game.dispatch({ type: "direction", direction: "up" });
  game.tick(1);
  game.dispatch({ type: "direction", direction: "up" });
  const first = game.tick(1);
  assert.equal(first.events.filter((item) => item.type === "stageClear").length, 1);
  assert.equal(first.events.filter((item) => item.type === "reward" && item.amount === 15).length, 1);
  assert.equal(first.snapshot.active.stage, 1);
  assert.equal(first.snapshot.active.score, 100);
  assert.equal(first.snapshot.active.snakeLength, 4);
  assert.equal(first.snapshot.active.subphase, "clearing");
  assert.equal(first.snapshot.active.transitionRemainingMs, 500);
  assert.equal(first.snapshot.records.crossingBest, 100);
  assert.equal(first.snapshot.seeds, 15);

  const rejected = game.dispatch({ type: "direction", direction: "right" });
  assert.ok(rejected.events.some((item) => item.type === "actionRejected" && item.reason === "stageTransition"));
  assert.deepEqual(rejected.snapshot.active.directionQueue, []);
  const partial = game.tick(200).snapshot;
  assert.equal(partial.active.transitionRemainingMs, 300);
  assert.equal(partial.active.stage, 1);
  game.dispatch({ type: "pause" });
  const paused = game.tick(1000).snapshot;
  assert.equal(paused.active.transitionRemainingMs, 300);
  game.dispatch({ type: "resume" });
  assert.equal(game.tick(299).snapshot.active.transitionRemainingMs, 1);
  const stageStarted = game.tick(1);
  const stageTwo = stageStarted.snapshot.active;
  assert.ok(stageStarted.events.some((item) => item.type === "stageStarted" && item.stage === 2));
  assert.equal(stageTwo.stage, 2);
  assert.equal(stageTwo.subphase, "playing");
  assert.equal(stageTwo.transitionRemainingMs, 0);
  assert.deepEqual(stageTwo.snake, [
    { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }
  ]);
  assert.equal(stageTwo.snake.some((part) => part.y === 0), false);
  assert.deepEqual(stageTwo.directionQueue, []);
  assert.equal(stageTwo.direction, "up");
  assert.ok(Math.abs(stageTwo.cars[0].speed - 0.14592) < 1e-10);

  game.dispatch({ type: "direction", direction: "up" });
  const moved = game.tick(1);
  assert.ok(moved.events.some((item) => item.type === "move"));
  assert.equal(moved.events.some((item) => item.type === "wall"), false);
  assert.equal(moved.snapshot.seeds, 15);

  game.dispatch({ type: "direction", direction: "up" });
  const second = game.tick(1);
  assert.equal(second.events.filter((item) => item.type === "stageClear").length, 1);
  assert.equal(second.events.filter((item) => item.type === "reward" && item.amount === 20).length, 1);
  assert.equal(second.snapshot.active.stage, 2);
  assert.equal(second.snapshot.active.subphase, "clearing");
  assert.equal(second.snapshot.active.snakeLength, 5);
  assert.equal(second.snapshot.active.score, 300);
  assert.equal(second.snapshot.seeds, 35);
  assert.equal(second.snapshot.records.crossingBest, 300);

  const reset = game.dispatch({ type: "restart", setup });
  assert.equal(reset.snapshot.phase, "ready");
  assert.equal(reset.snapshot.active.stage, 1);
  assert.equal(reset.snapshot.active.subphase, "playing");
  assert.equal(reset.snapshot.active.transitionRemainingMs, 0);
  assert.equal(reset.snapshot.active.score, 0);
  assert.equal(reset.snapshot.records.crossingBest, 300);
  assert.equal(reset.snapshot.seeds, 35);
});

test("Breakout pauses after a non-final ball loss and resumes without settling the run", () => {
  const game = createGameSession({ now: 0, rng: () => 0.99, save: { currencies: { seeds: 100 }, records: { breakoutBest: 9 } } });
  const setup = { width: 80, height: 80, segmentSize: 1, gap: 1, bricks: [{ x: 0, y: 5, width: 1, height: 1, hp: 1 }] };
  game.dispatch({ type: "selectMode", mode: "breakout", setup });
  game.dispatch({ type: "setInputAxis", axis: "x", value: -1 });
  game.dispatch({ type: "begin" });

  const beforePause = game.tick(100).snapshot;
  game.dispatch({ type: "pause" });
  const paused = game.tick(500).snapshot;
  assert.deepEqual(paused.active.balls, beforePause.active.balls);
  assert.equal(paused.elapsedMs, beforePause.elapsedMs);
  game.dispatch({ type: "resume" });

  let lost;
  for (let index = 0; index < 100 && !lost; index += 1) {
    const result = game.tick(100);
    if (result.events.some((item) => item.type === "ballLost")) lost = result;
  }
  assert.ok(lost, "the first miss deterministically loses one ball");
  assert.equal(lost.snapshot.phase, "ready");
  assert.equal(lost.snapshot.active.lives, 1);
  assert.equal(lost.snapshot.active.balls.length, 1);
  assert.ok(lost.events.some((item) => item.type === "runReady" && item.reason === "ballLost" && item.lives === 1));
  assert.equal(lost.events.some((item) => item.type === "runEnded" || item.type === "reward"), false);
  assert.equal(lost.snapshot.seeds, 100);
  assert.equal(lost.snapshot.records.breakoutBest, 9);

  const resumed = game.dispatch({ type: "begin" });
  assert.equal(resumed.snapshot.phase, "running");
  game.dispatch({ type: "setInputAxis", axis: "x", value: -1 });
  let ended;
  for (let index = 0; index < 100 && !ended; index += 1) {
    const result = game.tick(100);
    if (result.events.some((item) => item.type === "runEnded")) ended = result;
  }
  assert.ok(ended, "the replacement ball can resume and finish the run");
  assert.equal(ended.snapshot.phase, "gameover");
  assert.deepEqual(ended.events.find((item) => item.type === "runEnded"), { type: "runEnded", mode: "breakout", reward: 0 });
  assert.equal(ended.snapshot.seeds, 100);
  assert.equal(ended.snapshot.records.breakoutBest, 9);

  const reset = game.dispatch({ type: "restart", setup });
  assert.equal(reset.snapshot.phase, "ready");
  assert.equal(reset.snapshot.active.lives, 2);
  assert.equal(reset.snapshot.active.score, 0);
  assert.equal(reset.snapshot.records.breakoutBest, 9);
});

test("Snakebird session completion records real level metadata and survives hydration", () => {
  const definition = { firstClearReward: 20, replayReward: 5, map: ["....", "HG..", "####"] };
  const game = createGameSession({ now: 0 });
  game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition, levelIndex: 2, levelCount: 5 } });
  const completion = game.dispatch({ type: "direction", direction: "right" });
  assert.ok(completion.events.some((item) => item.type === "runEnded" && item.won && item.reward === 20));
  assert.deepEqual(completion.snapshot.snakebirdProgress.clearedLevels, [false, false, true, false, false]);
  assert.deepEqual(completion.snapshot.snakebirdProgress.bestMoves, [null, null, 1, null, null]);
  assert.equal(completion.snapshot.snakebirdProgress.unlockedLevel, 4);

  const hydrated = createGameSession({ save: game.serialize(), now: 0 }).snapshot();
  assert.deepEqual(hydrated.snakebirdProgress, completion.snapshot.snakebirdProgress);
});

test("Snakebird session uses first-clear and replay rewards without overwriting better moves", () => {
  const quick = { firstClearReward: 20, replayReward: 5, map: ["....", "HG..", "####"] };
  const slower = { firstClearReward: 20, replayReward: 5, map: ["....", "H.G.", "####"] };
  const game = createGameSession({ now: 0 });
  game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition: quick, levelIndex: 0, levelCount: 5 } });
  game.dispatch({ type: "direction", direction: "right" });
  game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition: slower, levelIndex: 0, levelCount: 5 } });
  game.dispatch({ type: "direction", direction: "right" });
  const replay = game.dispatch({ type: "direction", direction: "right" });
  assert.ok(replay.events.some((item) => item.type === "runEnded" && item.reward === 5));
  assert.equal(replay.snapshot.seeds, 25);
  assert.equal(replay.snapshot.snakebirdProgress.bestMoves[0], 1);
  assert.equal(replay.snapshot.snakebirdProgress.unlockedLevel, 2);
});

test("Snakebird final levels remain bounded and invalid setup metadata normalizes safely", () => {
  const definition = { firstClearReward: 20, replayReward: 5, map: ["....", "HG..", "####"] };
  const game = createGameSession({ now: 0 });
  const invalid = game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition, levelIndex: -1.5, levelCount: 0 } }).snapshot.active;
  assert.equal(invalid.levelIndex, 0);
  assert.equal(invalid.levelCount, 1);
  const expanded = game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition, levelIndex: 2, levelCount: 1 } }).snapshot.active;
  assert.equal(expanded.levelIndex, 2);
  assert.equal(expanded.levelCount, 3);

  game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition, levelIndex: 4, levelCount: 5 } });
  const complete = game.dispatch({ type: "direction", direction: "right" }).snapshot;
  assert.equal(complete.snakebirdProgress.clearedLevels.length, 5);
  assert.equal(complete.snakebirdProgress.bestMoves.length, 5);
  assert.equal(complete.snakebirdProgress.unlockedLevel, 5);
});

test("queued modes validate atomically and use their browser-aligned buffers", () => {
  const cases = [
    { mode: "duel", rejected: "down", accepted: ["left", "down", "right"], queue: "directionQueue", expected: ["down", "right"] },
    { mode: "crossing", rejected: "down", accepted: ["left", "down", "right"], queue: "directionQueue", expected: ["down", "right"] },
    { mode: "maze", rejected: "down", accepted: ["left", "up"], queue: "directionQueue", expected: ["up"] },
    { mode: "broodline", rejected: "left", accepted: ["up", "left", "down"], queue: "queue", expected: ["up", "left"] }
  ];
  for (const scenario of cases) {
    const game = createGameSession({ now: 0, rng: lcg(7) });
    game.dispatch({ type: "selectMode", mode: scenario.mode });
    const rejected = game.dispatch({ type: "direction", direction: scenario.rejected });
    assert.equal(rejected.snapshot.phase, "ready", `${scenario.mode} rejected Ready input stays ready`);
    assert.equal(rejected.snapshot.active[scenario.queue].length, 0);
    assert.equal(rejected.events.some((item) => item.type === "runStarted" || item.type === "directionQueued"), false);
    for (const direction of scenario.accepted) game.dispatch({ type: "direction", direction });
    const snapshot = game.snapshot();
    assert.deepEqual(snapshot.active[scenario.queue], scenario.expected, `${scenario.mode} bounded queue`);
    const duplicate = game.dispatch({ type: "direction", direction: scenario.expected.at(-1) });
    assert.deepEqual(duplicate.snapshot.active[scenario.queue], scenario.expected, `${scenario.mode} duplicate does not grow queue`);
  }
});

test("queued modes consume accepted directions in FIFO order", () => {
  const duel = createGameSession({ now: 0, rng: lcg(3) });
  duel.dispatch({ type: "selectMode", mode: "duel" });
  duel.dispatch({ type: "direction", direction: "left" });
  duel.dispatch({ type: "direction", direction: "down" });
  duel.tick(100); duel.tick(25);
  assert.equal(duel.snapshot().active.player.direction, "left");

  const mazeGame = createGameSession({ now: 0, rng: lcg(3) });
  mazeGame.dispatch({ type: "selectMode", mode: "maze" });
  mazeGame.dispatch({ type: "direction", direction: "left" });
  mazeGame.tick(100); mazeGame.tick(5);
  assert.equal(mazeGame.snapshot().active.direction, "left");

  const crossingGame = createGameSession({ now: 0, rng: lcg(3) });
  crossingGame.dispatch({ type: "selectMode", mode: "crossing" });
  crossingGame.dispatch({ type: "direction", direction: "left" });
  crossingGame.tick(100);
  assert.equal(crossingGame.snapshot().active.direction, "left");

  const broodlineGame = createGameSession({ now: 0, rng: lcg(3) });
  broodlineGame.dispatch({ type: "selectMode", mode: "broodline" });
  broodlineGame.dispatch({ type: "direction", direction: "up" });
  broodlineGame.tick(100); broodlineGame.tick(100); broodlineGame.tick(20);
  assert.equal(broodlineGame.snapshot().active.direction, "up");
});

test("rejected immediate Snakebird input does not start a ready run", () => {
  const definition = { firstClearReward: 20, replayReward: 5, map: ["....", "H#G.", "####"] };
  const game = createGameSession({ now: 0 });
  game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition } });
  const before = game.snapshot();
  const rejected = game.dispatch({ type: "direction", direction: "right" });
  assert.equal(rejected.snapshot.phase, "ready");
  assert.deepEqual(rejected.snapshot.active.body, before.active.body);
  assert.equal(rejected.events.some((item) => item.type === "runStarted" || item.type === "directionQueued"), false);
});

test("puzzle sessions route lifecycle, rewards, records, and isolated snapshots through the authority", () => {
  const snakebirdDefinition = { firstClearReward: 20, replayReward: 5, map: ["....", "HG..", "####"] };
  const snakebird = createGameSession({ now: 0 });
  snakebird.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition: snakebirdDefinition, levelIndex: 0, levelCount: 2 } });
  const blocked = snakebird.dispatch({ type: "direction", direction: "down" });
  assert.equal(blocked.snapshot.phase, "ready");
  const won = snakebird.dispatch({ type: "direction", direction: "right" });
  assert.deepEqual(won.events.filter((item) => item.type === "runEnded"), [{ type: "runEnded", mode: "snakebird", reward: 20, won: true }]);
  const savedProgress = won.snapshot.snakebirdProgress;
  snakebird.dispatch({ type: "restart", setup: { definition: snakebirdDefinition, levelIndex: 0, levelCount: 2 } });
  const replay = snakebird.dispatch({ type: "direction", direction: "right" });
  assert.equal(replay.events.find((item) => item.type === "runEnded").reward, 5);
  assert.equal(replay.snapshot.snakebirdProgress.bestMoves[0], 1);
  assert.deepEqual(savedProgress.bestMoves, [1, null], "prior snapshots remain isolated");

  const sokobanDefinition = { reward: 7, map: ["#####", "#...#", "#####"], snake: [{ x: 1, y: 1 }], crates: [{ x: 2, y: 1, kind: "light" }], goals: [{ x: 3, y: 1 }], pellets: [], plates: [], gates: [] };
  const sokoban = createGameSession({ now: 0 });
  sokoban.dispatch({ type: "selectMode", mode: "sokoban", setup: { definition: sokobanDefinition, grid: { columns: 5, rows: 3 }, levelIndex: 3 } });
  const before = sokoban.snapshot();
  const rejected = sokoban.dispatch({ type: "direction", direction: "up" });
  assert.equal(rejected.snapshot.phase, "ready");
  assert.deepEqual(rejected.snapshot.active.snake, before.active.snake);
  sokoban.dispatch({ type: "pause" }); // ready cannot pause
  const finished = sokoban.dispatch({ type: "direction", direction: "right" });
  const ended = finished.events.find((item) => item.type === "runEnded");
  assert.deepEqual(ended, { type: "runEnded", mode: "sokoban", reward: 7, score: 100, stageIndex: 3, won: true });
  assert.equal(finished.snapshot.seeds, 7);
  assert.equal(finished.snapshot.best, 0, "Sokoban never changes ordinary Snake best");
  const restarted = sokoban.dispatch({ type: "restart", setup: { definition: sokobanDefinition, grid: { columns: 5, rows: 3 }, levelIndex: 3 } });
  assert.equal(restarted.snapshot.seeds, 7, "reset does not repeat a reward");
});

test("puzzle pause rejects movement and resume restores accepted input", () => {
  const cases = [
    { mode: "snakebird", setup: { definition: { firstClearReward: 1, replayReward: 1, map: ["....", "H.G.", "####"] } }, direction: "right" },
    { mode: "sokoban", setup: { definition: { reward: 1, map: ["#####", "#...#", "#####"], snake: [{ x: 1, y: 1 }], crates: [{ x: 3, y: 1, kind: "light" }], goals: [{ x: 2, y: 1 }], pellets: [], plates: [], gates: [] }, grid: { columns: 5, rows: 3 } }, direction: "right" }
  ];
  for (const scenario of cases) {
    const game = createGameSession({ now: 0 });
    game.dispatch({ type: "selectMode", mode: scenario.mode, setup: scenario.setup });
    game.dispatch({ type: "begin" });
    game.dispatch({ type: "pause" });
    const paused = game.dispatch({ type: "direction", direction: scenario.direction });
    assert.ok(paused.events.some((item) => item.type === "actionRejected" && item.reason === "notRunning"));
    game.dispatch({ type: "resume" });
    assert.equal(game.dispatch({ type: "direction", direction: scenario.direction }).events.some((item) => item.type === "actionRejected"), false);
  }
});

test("founding settlements enforce feature restrictions while preserving allowed upgrades", () => {
  const session = createGameSession({ now: 0 }).serialize().session;
  session.seeds = 1e8; session.branches = 1e8; session.best = 1e8;
  const grasslandsEconomy = { seeds: 1e8, branches: 1e8, provisions: session.provisions, best: 1e8, upgrades: session.upgrades, selectedBoardLevel: session.selectedBoardLevel, nursery: session.nursery, habitats: session.habitats, notables: session.notables };
  const wetlandsEconomy = JSON.parse(JSON.stringify(grasslandsEconomy)); wetlandsEconomy.nursery.colonyCount = 20;
  session.migration = { ...session.migration, activeSettlementId: "wetlands", settlements: [
    { id: "grasslands", name: "Grasslands", status: "established", economy: grasslandsEconomy },
    { id: "wetlands", name: "Wetlands", status: "founding", foundingRemainingMs: 600000, economy: wetlandsEconomy }
  ] };
  const save = { saveVersion: SAVE_VERSION, savedAt: 0, session };
  const game = createGameSession({ save, now: 0, rng: lcg(4) });
  for (const upgrade of ["board", "foodType", "foodCount", "shield"]) {
    assert.ok(game.dispatch({ type: "buyUpgrade", upgrade }).events.some((item) => item.type === "upgradePurchased"));
  }
  const before = game.snapshot();
  for (const action of [
    { type: "buyUpgrade", upgrade: "minigames" }, { type: "placeHabitat", index: 0 }, { type: "upgradeHabitat", index: 0 },
    { type: "upgradeNest" }, { type: "upgradeNursery" }, { type: "recruitNotable" }, { type: "generateNotable" },
    { type: "assignNotable", notableId: "missing", habitatId: 0 }, { type: "unassignNotable", notableId: "missing" },
    { type: "dismissNotable", notableId: "missing" }, { type: "resolvePendingNotable", decision: "reject" }
  ]) {
    const rejected = game.dispatch(action);
    assert.ok(rejected.events.some((item) => item.type === "actionRejected" && item.reason === "featureUnavailableWhileFounding"), action.type);
  }
  const after = game.snapshot();
  assert.equal(after.seeds, before.seeds);
  assert.equal(after.branches, before.branches);
  assert.deepEqual(after.nursery, before.nursery);
  assert.deepEqual(after.habitats, before.habitats);

  game.advanceOffline(600001);
  assert.equal(game.snapshot().migration.settlements.find((item) => item.id === "wetlands").status, "established");
  assert.ok(game.dispatch({ type: "buyUpgrade", upgrade: "minigames" }).events.some((item) => item.type === "upgradePurchased"));
});

test("session-created Broodline and Maze use their engine cadences", () => {
  const game = createGameSession({ now: 0, rng: lcg(99) });
  assert.equal(game.dispatch({ type: "selectMode", mode: "broodline" }).snapshot.active.tickMs, broodline.TICK_MS);
  assert.equal(game.dispatch({ type: "selectMode", mode: "maze" }).snapshot.active.tickMs, maze.TICK_MS);
});

test("pausing a Snake run freezes gameplay while the idle economy keeps advancing", () => {
  const game = createGameSession({
    now: 0,
    rng: lcg(5),
    save: { habitats: { counts: [10] } }
  });
  game.dispatch({ type: "start" });
  game.dispatch({ type: "begin" });
  const running = game.tick(100).snapshot;
  const paused = game.dispatch({ type: "pause" });
  assert.equal(paused.snapshot.phase, "paused");
  const headBefore = paused.snapshot.active.snake[0];
  const elapsedBefore = paused.snapshot.elapsedMs;
  const seedsBefore = paused.snapshot.seeds;

  const held = game.tick(1000);
  assert.deepEqual(held.snapshot.active.snake[0], headBefore);
  assert.equal(held.snapshot.elapsedMs, elapsedBefore);
  assert.ok(held.snapshot.seeds > seedsBefore, "idle habitat income continues while gameplay is paused");
  assert.ok(game.dispatch({ type: "direction", direction: "up" }).events.some((event) => event.reason === "notRunning"));

  const resumed = game.dispatch({ type: "resume" });
  assert.equal(resumed.snapshot.phase, "running");
  const afterResume = game.tick(100).snapshot;
  assert.equal(afterResume.elapsedMs, elapsedBefore + 100, "paused wall time is not added after resume");
  const reset = game.dispatch({ type: "selectMode", mode: "snake" }).snapshot;
  assert.equal(reset.phase, "ready");
  assert.equal(reset.elapsedMs, 0);
});

test("Minigame upgrades normalize to nine paid unlocks and reject a tenth purchase", () => {
  const legacy = createGameSession({ save: { upgrades: { minigamesLevel: 10 } }, now: 0 });
  assert.equal(legacy.snapshot().upgrades.minigamesLevel, 9);
  const malformed = createGameSession({ save: { upgrades: { minigamesLevel: -3.5 } }, now: 0 });
  assert.equal(malformed.snapshot().upgrades.minigamesLevel, 0);

  const game = createGameSession({ save: { currencies: { seeds: 1e20 } }, now: 0 });
  for (let level = 1; level <= 9; level += 1) {
    const result = game.dispatch({ type: "buyUpgrade", upgrade: "minigames" });
    assert.equal(result.snapshot.upgrades.minigamesLevel, level);
  }
  assert.ok(game.dispatch({ type: "buyUpgrade", upgrade: "minigames" }).events.some((event) => event.reason === "maxed"));
});

test("host-shaped saves retain valid egg-board countdowns and safely normalize invalid ones", () => {
  const saved = { savedAt: 0, eggBoardCountdown: 77, nursery: { resupplyEggHolding: 4 } };
  const first = createGameSession({ save: saved, now: 0, rng: lcg(1) });
  assert.equal(first.snapshot().eggBoardCountdown, 77);
  assert.equal(first.snapshot().nursery.resupplyEggHolding, 4);
  const restored = createGameSession({ save: first.serialize(), now: 0, rng: lcg(1) });
  assert.equal(restored.snapshot().eggBoardCountdown, 77);
  assert.equal(restored.snapshot().nursery.resupplyEggHolding, 4);
  for (const invalid of [0, -1, 1.5, "nope"]) {
    assert.equal(createGameSession({ save: { eggBoardCountdown: invalid }, now: 0 }).snapshot().eggBoardCountdown, null);
  }
});

test("nursery upgrades reject atomically and exact dual-currency costs succeed", () => {
  const cost = nurseryConfig.upgrades.nursery;
  const branches = Math.ceil(cost.branchBaseCost);
  const seeds = Math.ceil(cost.seedBaseCost);
  const insufficientBranches = createGameSession({ save: { currencies: { branches: 0, seeds } }, now: 0 });
  const beforeBranches = insufficientBranches.snapshot();
  const rejectedBranches = insufficientBranches.dispatch({ type: "upgradeNursery" });
  assert.ok(rejectedBranches.events.some((event) => event.type === "actionRejected" && event.reason === "insufficientBranches"));
  assert.deepEqual(rejectedBranches.snapshot.nursery.nurseryLevel, beforeBranches.nursery.nurseryLevel);
  assert.equal(rejectedBranches.snapshot.branches, 0);
  assert.equal(rejectedBranches.snapshot.seeds, seeds);
  assert.ok(rejectedBranches.snapshot.branches >= 0);
  assert.deepEqual(insufficientBranches.dispatch({ type: "upgradeNursery" }).snapshot.nursery.nurseryLevel, beforeBranches.nursery.nurseryLevel);
  assert.equal(insufficientBranches.snapshot().seeds, seeds);

  const insufficientSeeds = createGameSession({ save: { currencies: { branches, seeds: 0 } }, now: 0 });
  const rejectedSeeds = insufficientSeeds.dispatch({ type: "upgradeNursery" });
  assert.ok(rejectedSeeds.events.some((event) => event.type === "actionRejected" && event.reason === "insufficientSeeds"));
  assert.equal(rejectedSeeds.snapshot.branches, branches);
  assert.equal(rejectedSeeds.snapshot.seeds, 0);
  assert.equal(rejectedSeeds.snapshot.nursery.nurseryLevel, 0);

  const exact = createGameSession({ save: { currencies: { branches, seeds } }, now: 0 });
  const bought = exact.dispatch({ type: "upgradeNursery" });
  assert.ok(bought.events.some((event) => event.type === "nurseryUpgraded"));
  assert.equal(bought.snapshot.branches, 0);
  assert.equal(bought.snapshot.seeds, 0);
  assert.equal(bought.snapshot.nursery.nurseryLevel, 1);
});

test("rejected upgrade actions leave currencies and levels nonnegative and unchanged", () => {
  const ordinary = createGameSession({ save: { currencies: { seeds: 0 } }, now: 0 });
  const ordinaryBefore = ordinary.snapshot();
  assert.ok(ordinary.dispatch({ type: "buyUpgrade", upgrade: "board" }).events.some((event) => event.reason === "insufficientSeeds"));
  assert.equal(ordinary.snapshot().seeds, ordinaryBefore.seeds);
  assert.equal(ordinary.snapshot().upgrades.boardLevel, ordinaryBefore.upgrades.boardLevel);

  const nest = createGameSession({ save: { currencies: { branches: 0 } }, now: 0 });
  const nestBefore = nest.snapshot();
  assert.ok(nest.dispatch({ type: "upgradeNest" }).events.some((event) => event.reason === "insufficientBranches"));
  assert.equal(nest.snapshot().branches, nestBefore.branches);
  assert.equal(nest.snapshot().nursery.nestLevel, nestBefore.nursery.nestLevel);

  const habitat = createGameSession({ save: { currencies: { branches: 0 }, records: { best: habitatConfig.habitats[0].unlockScore } }, now: 0 });
  const habitatBefore = habitat.snapshot();
  assert.ok(habitat.dispatch({ type: "upgradeHabitat", index: 0 }).events.some((event) => event.reason === "insufficientBranches"));
  assert.equal(habitat.snapshot().branches, habitatBefore.branches);
  assert.deepEqual(habitat.snapshot().habitats.upgradeLevels, habitatBefore.habitats.upgradeLevels);
  for (const snapshot of [ordinary.snapshot(), nest.snapshot(), habitat.snapshot()]) {
    assert.ok(snapshot.seeds >= 0 && snapshot.branches >= 0 && snapshot.provisions >= 0);
  }
});

test("settlements keep independent upgrade tracks when selected", () => {
  const game = createGameSession({ save: {
    saveVersion: SAVE_VERSION, savedAt: 0, session: {
      mode: "snake", phase: "ready", seeds: 500, upgrades: { boardLevel: 2, foodTypeLevel: 1 }, selectedBoardLevel: 2,
      migration: { activeSettlementId: "grasslands", settlements: [
        { id: "grasslands", name: "Grasslands", status: "established", economy: { seeds: 500, upgrades: { boardLevel: 2, foodTypeLevel: 1 }, selectedBoardLevel: 2 } },
        { id: "wetlands", name: "Wetlands", status: "established", economy: { seeds: 500, upgrades: { boardLevel: 0, foodTypeLevel: 0 }, selectedBoardLevel: 0 } }
      ] }
    }
  }, now: 0, rng: lcg(1) });

  let snapshot = game.dispatch({ type: "selectSettlement", settlementId: "wetlands" }).snapshot;
  assert.equal(snapshot.upgrades.boardLevel, 0);
  assert.equal(snapshot.upgrades.foodTypeLevel, 0);
  assert.equal(snapshot.selectedBoardLevel, 0);

  game.dispatch({ type: "buyUpgrade", upgrade: "board" });
  game.dispatch({ type: "buyUpgrade", upgrade: "foodType" });
  game.dispatch({ type: "buyUpgrade", upgrade: "foodType" });
  game.dispatch({ type: "buyUpgrade", upgrade: "foodType" });
  snapshot = game.dispatch({ type: "selectSettlement", settlementId: "grasslands" }).snapshot;
  assert.equal(snapshot.upgrades.boardLevel, 2);
  assert.equal(snapshot.upgrades.foodTypeLevel, 1);
  assert.equal(snapshot.selectedBoardLevel, 2);

  snapshot = game.dispatch({ type: "selectSettlement", settlementId: "wetlands" }).snapshot;
  assert.equal(snapshot.upgrades.boardLevel, 1);
  assert.equal(snapshot.upgrades.foodTypeLevel, 3);
});

test("habitat upgrades spend Branches and persist a larger maximum capacity", () => {
  const game = createGameSession({ save: { currencies: { branches: 10 }, records: { best: 0 } }, now: 0, rng: lcg(1) });
  const before = game.snapshot();
  assert.deepEqual(before.habitats.upgradeLevels, habitatConfig.habitats.map(() => 0));
  assert.equal(before.habitatHardCapacities[0], habitatConfig.habitats[0].hardCapacity);

  const bought = game.dispatch({ type: "upgradeHabitat", index: 0 });
  assert.ok(bought.events.some((event) => event.type === "habitatUpgraded"));
  assert.equal(bought.snapshot.branches, 0);
  assert.equal(bought.snapshot.habitats.upgradeLevels[0], 1);
  assert.equal(bought.snapshot.habitatHardCapacities[0], 75);

  const restored = createGameSession({ save: game.serialize(), now: 0, rng: lcg(1) });
  assert.equal(restored.snapshot().habitats.upgradeLevels[0], 1);
  assert.equal(restored.snapshot().habitatHardCapacities[0], 75);
  assert.ok(restored.dispatch({ type: "upgradeHabitat", index: 0 }).events.some((event) =>
    event.type === "actionRejected" && event.reason === "insufficientBranches"));
});

test("retained histories and lifetime totals survive session serialization", () => {
  const count = 65;
  const completedMigrations = Array.from({ length: count }, (_, index) => ({ id: `migration-${index + 1}` }));
  const completedResupplyMissions = Array.from({ length: count }, (_, index) => ({ id: `resupply-${index + 1}`, notableIds: [], adultCount: 1, eggCount: 0, provisionsConsumed: 2 }));
  const game = createGameSession({ save: {
    migration: { completedMigrations, historyTotals: { completed: 90 } },
    completedResupplyMissions,
    resupplyTotals: { completedMissions: 100, adultsDelivered: 200, provisionsConsumed: 300 }
  }, now: 0, rng: lcg(1) });

  const snapshot = game.snapshot();
  assert.equal(snapshot.migration.completedMigrations.length, 50);
  assert.equal(snapshot.migration.historyTotals.completed, 90);
  assert.equal(snapshot.completedResupplyMissions.length, 50);
  assert.deepEqual(snapshot.resupplyTotals, { completedMissions: 100, notablesDelivered: 0, adultsDelivered: 200, eggsDelivered: 0, provisionsConsumed: 300 });

  const restored = createGameSession({ save: game.serialize(), now: 0, rng: lcg(1) }).snapshot();
  assert.deepEqual(restored.migration.historyTotals, snapshot.migration.historyTotals);
  assert.deepEqual(restored.resupplyTotals, snapshot.resupplyTotals);
  assert.equal(restored.migration.completedMigrations[0].id, "migration-16");
  assert.equal(restored.completedResupplyMissions[0].id, "resupply-16");
});
