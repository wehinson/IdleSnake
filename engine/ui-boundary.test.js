"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const { createStateReader } = require("./state-reader.js");
const queries = require("./queries.js");
const { runHeadless } = require("./simulate.js");

test("readers use the current immutable snapshot without copying game objects", () => {
  const session = createGameSession({ now: 0, rng: () => 0.3 });
  let full = session.snapshot(); let frame = full;
  const reader = createStateReader(() => full, () => frame);
  for (const mode of full.supportedModes) {
    full = frame = session.dispatch({ type: "selectMode", mode }).snapshot;
    assert.equal(reader.gameMode, mode);
    assert.equal(reader.state, full.phase);
    assert.equal(reader.nursery, full.nursery);
    assert.equal(reader.habitats, full.habitats);
    if (["snakebird", "sokoban", "runner", "breakout", "battleship", "centipede", "broodline", "maze"].includes(mode))
      assert.equal(reader[mode], full.active);
    assert.throws(() => { reader.state = "gameover"; }, TypeError);
    assert.throws(() => { reader.nursery.colonyCount = 999; }, TypeError);
  }
  full = frame = session.dispatch({ type: "selectMode", mode: "snake" }).snapshot;
  frame = session.dispatch({ type: "playDirection", direction: "up" }).snapshot;
  assert.equal(reader.snake, frame.active.snake);
  assert.equal(reader.state, "running");
  frame = session.tick(100, { snapshot: "frame" }).snapshot;
  assert.equal(reader.elapsedMs, frame.elapsedMs);
  assert.equal(reader.nursery, full.nursery);
});

test("engine controls own start, pause, resume, and reset in every mode", () => {
  let seed = 42;
  const session = createGameSession({ now: 0, rng: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) });
  for (const mode of session.snapshot().supportedModes) {
    session.dispatch({ type: "launchGame", mode, force: true });
    if (mode === "battleship") session.dispatch({ type: "battleshipShuffle" });
    assert.equal(session.dispatch({ type: "primaryAction" }).snapshot.phase, "running", mode);
    assert.equal(session.dispatch({ type: "togglePause" }).snapshot.phase, "paused", mode);
    const paused = session.tick(100).snapshot;
    assert.equal(paused.elapsedMs, 0);
    assert.equal(session.dispatch({ type: "togglePause" }).snapshot.phase, "running", mode);
    const reset = session.dispatch({ type: "resetRun" }).snapshot;
    assert.equal(reset.phase, "ready", mode);
    assert.equal(reset.mode, mode);
    assert.equal(reset.elapsedMs, 0);
  }
});

test("every gameplay control resumes a paused run without resetting or applying a turn", () => {
  let seed = 42;
  const session = createGameSession({ now: 0, rng: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) });
  const controls = [
    { type: "primaryAction" }, { type: "togglePause" }, { type: "resetRun" },
    { type: "openMinigame", number: 1 },
    ...["up", "down", "left", "right"].map((direction) => ({ type: "playDirection", direction }))
  ];
  for (const mode of session.snapshot().supportedModes) {
    session.dispatch({ type: "launchGame", mode, force: true });
    if (mode === "battleship") session.dispatch({ type: "battleshipShuffle" });
    session.dispatch({ type: "primaryAction" });
    const before = session.snapshot();
    for (const control of controls) {
      session.dispatch({ type: "pause" });
      session.tick(10_000);
      const result = session.dispatch(control);
      assert.equal(result.snapshot.phase, "running", `${mode}: ${JSON.stringify(control)}`);
      assert.equal(result.snapshot.mode, mode);
      assert.deepEqual(result.snapshot.active, before.active);
      assert.equal(result.snapshot.elapsedMs, before.elapsedMs);
      assert.deepEqual(result.events.map((event) => event.type), ["resumed"]);
    }
  }
});

test("named minigames agree with engine launches and unlocks, including the Runner shortcut", () => {
  const session = createGameSession({ now: 0, rng: () => 0.3 });
  const names = ["Vs Snake", "Snake Forever", "Brick Breakout", "Snakeger", "Snakebird", "Sokoban", "Broodline", "Venom Strike", "Centipede"];
  const options = queries.minigameOptions(session.snapshot());
  assert.deepEqual(options.map((option) => option.name), names);
  assert.equal(options.every((option) => !option.unlocked), true);
  session.dispatch({ type: "addSeeds", amount: 1e9 });
  for (let i = 0; i < 9; i++) session.dispatch({ type: "buyUpgrade", upgrade: "minigames" });
  for (const option of queries.minigameOptions(session.snapshot())) {
    session.dispatch({ type: "launchGame", mode: "snake" });
    assert.equal(option.unlocked, true);
    assert.equal(session.dispatch({ type: "openMinigame", number: option.number }).snapshot.mode, option.mode);
  }
  session.dispatch({ type: "launchGame", mode: "duel" });
  const runner = queries.minigameOptions(session.snapshot())[8];
  assert.equal(runner.name, "Snake Runner");
  assert.equal(session.dispatch({ type: "openMinigame", number: runner.number }).snapshot.mode, runner.mode);
});

test("headless play uses the browser controls to solve and advance Sokoban", () => {
  const session = createGameSession({ now: 0 });
  session.dispatch({ type: "launchGame", mode: "sokoban" });
  const moves = ["right", "right", "right", "up", "up", "up", "up", "right", "right", "right", "right"];
  const result = runHeadless(session, { steps: 50, controller: (_, step) => ({ type: "playDirection", direction: moves[step] }) });
  assert.equal(result.ended, true);
  assert.equal(result.steps, moves.length);
  const reward = result.snapshot.seeds;
  const next = session.dispatch({ type: "primaryAction" }).snapshot;
  assert.equal(next.active.stageIndex, 1);
  assert.equal(next.phase, "running");
  assert.equal(next.seeds, reward);
});

test("board and food-count purchases reset inside the engine, once per action", () => {
  const session = createGameSession({ now: 0, save: { currencies: { seeds: 1e6 }, eggBoardCountdown: 10 } });
  session.dispatch({ type: "selectMode", mode: "runner" });
  const before = session.snapshot().eggBoardCountdown;
  const bought = session.dispatch({ type: "buyUpgrade", upgrade: "board" });
  assert.equal(bought.snapshot.mode, "snake");
  assert.equal(bought.snapshot.phase, "ready");
  assert.equal(bought.snapshot.eggBoardCountdown, before - 1);
  assert.equal(bought.events.filter((event) => event.type === "runReady").length, 1);
  const food = session.dispatch({ type: "buyUpgrade", upgrade: "foodCount" }).snapshot;
  assert.equal(food.active.foods.length, 2);
  session.dispatch({ type: "selectMode", mode: "duel" });
  const duel = session.dispatch({ type: "setSelectedDuelGridSize", selectedDuelGridSize: 15 }).snapshot;
  assert.deepEqual(duel.active.grid, { columns: 15, rows: 15 });
});

test("panel availability agrees with engine purchase and assignment validation", () => {
  const session = createGameSession({ now: 0 });
  const snapshot = session.snapshot(); const original = session.serialize();
  const nursery = queries.nurseryPanel(snapshot);
  assert.equal(nursery.canUpgradeNest, false);
  assert.equal(nursery.canUpgradeNursery, false);
  assert.equal(nursery.remainingMs, null);
  assert.equal(nursery.eggHeld, false);
  assert.equal(queries.habitatPanel(snapshot).habitats[0].canAssign, false);
  for (const [upgrade, panel] of Object.entries(queries.upgradePanel(snapshot))) {
    assert.equal(panel.canBuy, false);
    assert.ok(session.dispatch({ type: "buyUpgrade", upgrade }).events.some((event) => event.type === "actionRejected"));
  }
  assert.deepEqual(session.serialize(), original);
  session.dispatch({ type: "addSeeds", amount: 1e6 });
  for (const [upgrade, panel] of Object.entries(queries.upgradePanel(session.snapshot()))) {
    assert.equal(panel.canBuy, true);
    assert.ok(session.dispatch({ type: "buyUpgrade", upgrade }).events.some((event) => event.type === "upgradePurchased"));
  }
});

test("invalid directions cannot start Breakout and repeat launch preserves a live run", () => {
  const session = createGameSession({ now: 0 });
  session.dispatch({ type: "launchGame", mode: "breakout" });
  assert.equal(session.dispatch({ type: "playDirection", direction: "up" }).snapshot.phase, "ready");
  session.dispatch({ type: "playDirection", direction: "right" });
  const before = session.tick(100).snapshot;
  assert.deepEqual(session.dispatch({ type: "launchGame", mode: "breakout" }).snapshot, before);
});

test("the engine owns keypad unlocks and the Duel-to-Runner shortcut", () => {
  const session = createGameSession({ now: 0 });
  assert.ok(session.dispatch({ type: "openMinigame", number: 1 }).events.some((event) => event.reason === "minigameLocked"));
  session.dispatch({ type: "grantMinigameFunds" });
  session.dispatch({ type: "buyUpgrade", upgrade: "minigames" });
  assert.equal(session.dispatch({ type: "openMinigame", number: 1 }).snapshot.mode, "duel");
  assert.equal(session.dispatch({ type: "openMinigame", number: 9 }).snapshot.mode, "runner");
  assert.deepEqual(queries.capabilities(session.snapshot()).minigames, [0, 1]);
});

test("trade construction preview rejects missing, duplicate, and unfunded pairs", () => {
  const cost = require("./trade-routes.js").constructionCost();
  const a = { id: "a", status: "established", economy: { ...cost } };
  const b = { id: "b", status: "established", economy: { ...cost } };
  const snapshot = { migration: { settlements: [a, b] }, tradeRoutes: [] };
  assert.equal(queries.tradeConstruction(snapshot, "a", "b").canConstruct, true);
  assert.equal(queries.tradeConstruction(snapshot, "a", "a").canConstruct, false);
  assert.equal(queries.tradeConstruction(snapshot, "a", "missing").canConstruct, false);
  b.economy.seeds = 0;
  assert.equal(queries.tradeConstruction(snapshot, "a", "b").canConstruct, false);
  b.economy.seeds = cost.seeds;
  snapshot.tradeRoutes.push({ settlementAId: "b", settlementBId: "a" });
  assert.equal(queries.tradeConstruction(snapshot, "a", "b").exists, true);
  assert.equal(queries.tradeConstruction(snapshot, "a", "b").canConstruct, false);
});
