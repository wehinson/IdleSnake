const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession, SAVE_VERSION } = require("./session.js");
const { habitatConfig } = require("./config.js");

// A small deterministic LCG so tests that assert on RNG-driven outcomes are
// stable. The engine itself defaults to Math.random; tests inject this instead.
function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

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

test("every shipped mode selects into a ready board and runs on first input", () => {
  for (const mode of ["snake", "duel", "maze", "breakout", "crossing", "snakebird", "sokoban", "broodline"]) {
    const game = createGameSession({ now: 0, rng: lcg(99) });
    const selected = game.dispatch({ type: "selectMode", mode });
    assert.equal(selected.snapshot.mode, mode, mode);
    assert.equal(selected.snapshot.phase, "ready", mode);
    assert.ok(selected.snapshot.active, mode);
    assert.ok(selected.events.some((e) => e.type === "runReady"), mode);
    const started = game.dispatch({ type: "direction", direction: "up" });
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

test("syncSeeds/addSeeds/addColonySnakes/setUpgrades host-bridge actions reconcile shared state", () => {
  const game = createGameSession({ save: { currencies: { seeds: 100 } }, now: 0 });
  game.dispatch({ type: "syncSeeds", seeds: 250 });
  assert.equal(game.snapshot().seeds, 250);
  game.dispatch({ type: "addSeeds", amount: -50 });
  assert.equal(game.snapshot().seeds, 200);
  game.dispatch({ type: "addSeeds", amount: -1000 }); // clamps at 0
  assert.equal(game.snapshot().seeds, 0);
  game.dispatch({ type: "addColonySnakes", amount: 5 });
  assert.equal(game.snapshot().nursery.colonyCount, 5);
  game.dispatch({ type: "setUpgrades", upgrades: { foodTypeLevel: 3 } });
  assert.equal(game.snapshot().upgrades.foodTypeLevel, 3);
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

  game.dispatch({ type: "setUpgrades", upgrades: { boardLevel: 1, foodTypeLevel: 3 } });
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
