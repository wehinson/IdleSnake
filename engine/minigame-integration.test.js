const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const crossing = require("./crossing.js");
const birdProof = require("./snakebird-solutions.json");
const sokobanProof = require("../tests/fixtures/sokoban-solutions.json");
const directions = { U: "up", D: "down", L: "left", R: "right" };

test("both 15-board campaigns replay through central settlement and saved receipts without duplicate credit", () => {
  let game = createGameSession({ now: 0, rng: () => .4 });
  let receiptId = 0;
  let paid = 0;
  for (const [mode, witnesses] of [["snakebird", birdProof.levels.map(level => level.witness)], ["sokoban", sokobanProof]]) {
    assert.equal(witnesses.length, 15);
    for (const [levelIndex, witness] of witnesses.entries()) {
      const before = game.snapshot().seeds;
      game.dispatch({ type: "selectPuzzleLevel", mode, levelIndex });
      const events = [];
      for (const symbol of witness) {
        const result = game.dispatch({ type: "direction", direction: directions[symbol] });
        assert.equal(result.events.some(event => event.type === "actionRejected"), false, `${mode} ${levelIndex + 1}: ${symbol}`);
        events.push(...result.events);
      }
      const ends = events.filter(event => event.type === "runEnded");
      assert.equal(ends.length, 1, `${mode} ${levelIndex + 1}`);
      assert.equal(ends[0].outcome, "win");
      assert.ok(ends[0].reward > 0);
      assert.equal(game.snapshot().phase, "gameover");
      assert.ok(Math.abs(game.snapshot().seeds - before - ends[0].reward) < 1e-7);
      paid += ends[0].reward;
      const ledger = game.snapshot().minigameRewards;
      assert.ok(ledger.lastReceipt.runId > receiptId);
      receiptId = ledger.lastReceipt.runId;
      assert.equal(ledger.lastReceipt.amount, ends[0].reward);
      assert.equal(game.tick(0).events.some(event => event.type === "runEnded"), false);
      const save = JSON.parse(JSON.stringify(game.serialize()));
      assert.equal(save.session.rewardRun, null);
      game = createGameSession({ now: 0, save, rng: () => .4 });
      assert.deepEqual(game.snapshot().minigameRewards, ledger);
      assert.equal(game.advanceOffline(0).events.some(event => event.type === "runEnded"), false);
    }
  }
  const snapshot = game.snapshot();
  assert.equal(snapshot.snakebirdProgress.campaignVersion, 2);
  assert.equal(snapshot.snakebirdProgress.clearedLevels.length, 15);
  assert.ok(snapshot.snakebirdProgress.clearedLevels.every(Boolean));
  assert.ok(Math.abs(snapshot.minigameRewards.earnings.snakebird + snapshot.minigameRewards.earnings.sokoban - paid) < 1e-7);
});

test("Nibbler Ready heading remains immediate while cancelled queues never qualify as applied play", () => {
  const trace = cancelled => {
    const game = createGameSession({ now: 0, rng: () => .4 });
    game.dispatch({ type: "selectMode", mode: "maze", setup: {
      grid: { columns: 5, rows: 5 }, tickMs: 100,
      open: ["2,2", "2,1", "2,0", "3,2", "4,2"],
      path: [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }], food: { x: 2, y: 1 }
    } });
    if (cancelled) {
      const ready = game.dispatch({ type: "direction", direction: "right" });
      assert.equal(ready.snapshot.active.direction, "right");
      assert.deepEqual(ready.snapshot.active.directionQueue, ["right"]);
      game.dispatch({ type: "direction", direction: "up" });
    } else game.dispatch({ type: "begin" });
    const events = [];
    for (let count = 0; count < 4; count++) events.push(...game.tick(100).events);
    const snapshot = game.snapshot();
    assert.equal(snapshot.active.score, 10);
    assert.equal(snapshot.phase, "gameover");
    assert.equal(events.filter(event => event.type === "runEnded").length, 1);
    assert.equal(snapshot.minigameRewards.lastReceipt.amount, 0);
    assert.equal(snapshot.minigameRewards.earnings.maze, 0);
    return { head: snapshot.active.path[0], score: snapshot.active.score, ledger: snapshot.minigameRewards };
  };
  assert.deepEqual(trace(true), trace(false));
});

test("Breakout sliced early wins retain applied-motion events and stop the session clock before settlement", () => {
  for (const controlled of [true, false]) {
    const game = createGameSession({ now: 0, rng: () => .4 });
    game.dispatch({ type: "selectMode", mode: "breakout", setup: {
      bricks: [{ x: 0, y: 0, width: 720, height: 710, hp: 1, maxHp: 1 }]
    } });
    game.dispatch({ type: "direction", direction: controlled ? "right" : "up" });
    const result = game.tick(1000);
    assert.equal(result.snapshot.phase, "gameover");
    assert.equal(result.snapshot.active.score, 10);
    assert.ok(result.snapshot.elapsedMs > 0 && result.snapshot.elapsedMs < 10);
    assert.equal(result.events.some(event => event.type === "controlledMove"), controlled);
    const ends = result.events.filter(event => event.type === "runEnded");
    assert.equal(ends.length, 1);
    assert.equal(ends[0].outcome, "win");
    assert.equal(ends[0].reward > 0, controlled);
    assert.equal(result.snapshot.minigameRewards.earnings.breakout, ends[0].reward);
    const elapsed = result.snapshot.elapsedMs;
    const ledger = result.snapshot.minigameRewards;
    assert.equal(game.tick(1000).snapshot.elapsedMs, elapsed);
    assert.deepEqual(game.snapshot().minigameRewards, ledger);
  }
});

test("Crossing stage lock and explicit Start coexist with terminal-only reward credit", () => {
  const original = crossing.buildCars;
  // Deterministic road fixture: stage1 is clear, stage2 has an actual lethal car at entry.
  crossing.buildCars = (stage, grid) => stage === 1 ? [] : [{ row: grid.rows - 1,
    x: Math.floor(grid.columns / 2), width: 2, speed: 0, direction: "right", tier: "green" }];
  try {
    const game = createGameSession({ now: 0, rng: () => .4 });
    game.dispatch({ type: "selectMode", mode: "crossing", setup: { tickMs: 100 } });
    const before = game.snapshot().seeds;
    const events = [];
    for (let count = 0; count < 12; count++) {
      game.dispatch({ type: "direction", direction: "up" });
      events.push(...game.tick(100).events);
    }
    assert.equal(events.filter(event => event.type === "stageClear").length, 1);
    assert.equal(events.some(event => event.type === "reward" || event.type === "runEnded"), false);
    assert.equal(game.snapshot().seeds, before);
    assert.equal(game.snapshot().active.snakeLength, 4);
    assert.equal(game.snapshot().active.score, 100);
    assert.equal(game.dispatch({ type: "direction", direction: "up" }).events[0].reason, "stageTransition");
    assert.equal(game.tick(999).snapshot.active.subphase, "clearing");
    const ready = game.tick(1).snapshot;
    assert.equal(ready.phase, "ready");
    assert.equal(ready.active.awaitingStart, true);
    assert.deepEqual(ready.active.directionQueue, []);
    assert.equal(game.dispatch({ type: "direction", direction: "up" }).events[0].reason, "explicitStartRequired");
    game.dispatch({ type: "begin" });
    const loss = game.tick(100);
    const ended = loss.events.filter(event => event.type === "runEnded");
    assert.equal(ended.length, 1);
    assert.ok(ended[0].reward > 0);
    assert.equal(loss.snapshot.active.awaitingStart, true);
    assert.deepEqual(loss.snapshot.active.directionQueue, []);
    assert.equal(loss.snapshot.minigameRewards.earnings.crossing, ended[0].reward);
    assert.equal(game.tick(1000).events.some(event => event.type === "runEnded"), false);
  } finally { crossing.buildCars = original; }
});
