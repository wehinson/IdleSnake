const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const { createStateReader } = require("./state-reader.js");
const queries = require("./queries.js");

test("Duel fixes old and current save sizes to20x25 without losing progress/settings", () => {
  for (const size of [10, 15, 20, 30, 40, "30", null, {}]) {
    const old = { saveVersion: 2, currencies: { seeds: 345 }, records: { mazeBest: 77 }, board: { selectedDuelGridSize: size }, accessibility: { reducedMotion: true }, settings: { snakeColors: { body: "#123456", head: "#abcdef" } } };
    const game = createGameSession({ save: old, now: 0, rng: () => 0.3 });
    const before = game.snapshot();
    const currentSave = game.serialize(); currentSave.session.selectedDuelGridSize = size;
    const restored = createGameSession({ save: currentSave, now: 0, rng: () => 0.3 });
    for (const session of [game, restored]) {
      const selected = session.dispatch({ type: "selectMode", mode: "duel", setup: { grid: { columns: 40, rows: 40 } } }).snapshot;
      assert.deepEqual(selected.active.grid, { columns: 20, rows: 25 });
      assert.equal(selected.selectedDuelGridSize, 20);
      assert.equal(selected.seeds, before.seeds);
      assert.equal(selected.records.mazeBest, 77);
      assert.deepEqual(selected.cosmetics, { body: "#123456", head: "#abcdef" });
      assert.equal(selected.reducedMotion, true);
      assert.deepEqual(createStateReader(() => selected).duelGrid, { columns: 20, rows: 25 });
    }
  }
});

test("Nibbler all four Ready directions start with requested heading; running reversals still reject", () => {
  for (const direction of ["up", "down", "left", "right"]) {
    const game = createGameSession({ now: 0, rng: () => 0.3 });
    const before = game.dispatch({ type: "selectMode", mode: "maze" }).snapshot;
    assert.deepEqual(before.active.grid, { columns: 21, rows: 21 });
    const started = game.dispatch({ type: "playDirection", direction });
    assert.equal(started.snapshot.phase, "running", direction);
    assert.equal(started.snapshot.active.direction, direction);
    assert.deepEqual(started.snapshot.active.directionQueue, [direction]);
    assert.equal(started.events.filter((e) => e.type === "runStarted").length, 1);
    const reverse = { up: "down", down: "up", left: "right", right: "left" }[direction];
    assert.ok(game.dispatch({ type: "direction", direction: reverse }).events.some((e) => e.reason === "invalidDirection"));
    assert.equal(queries.minigameOptions(game.snapshot())[1].name, "Nibbler");
  }
});

test("Nibbler Up/Down start movement uses requested direction on the first tick and walls do not wrap", () => {
  for (const direction of ["up", "down"]) {
    const game = createGameSession({ now: 0, rng: () => 0.3 });
    game.dispatch({ type: "selectMode", mode: "maze", setup: {
      grid: { columns: 5, rows: 5 }, path: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
      open: ["2,1", "2,2", "2,3", "1,2", "0,2", "4,4"], food: { x: 4, y: 4 }
    } });
    game.dispatch({ type: "playDirection", direction }); game.tick(100);
    const result = game.tick(5);
    assert.equal(result.snapshot.phase, "running");
    assert.deepEqual(result.snapshot.active.path[0], { x: 2, y: direction === "up" ? 1 : 3 });
    game.tick(100); assert.equal(game.tick(5).snapshot.phase, "gameover", "a closed cell remains lethal");
  }
});

test("one minigame selection switches immediately from every lifecycle phase without payout or replay", () => {
  for (const phase of ["ready", "running", "paused", "gameover"]) {
    for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const game = createGameSession({ save: { saveVersion: 2, upgrades: { minigamesLevel: 9 } }, now: 0, rng: () => 0.3 });
      game.dispatch({ type: "selectMode", mode: "snake", setup: { grid: { columns: 5, rows: 8 }, snake: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }], direction: "up" } });
      if (phase !== "ready") game.dispatch({ type: "begin" });
      if (phase === "paused") game.dispatch({ type: "pause" });
      if (phase === "gameover") game.tick(10000);
      assert.equal(game.snapshot().phase, phase);
      const before = game.snapshot();
      const selected = game.dispatch({ type: "openMinigame", number });
      assert.equal(selected.snapshot.mode, queries.minigameOptions(before)[number - 1].mode);
      assert.equal(selected.snapshot.phase, "ready");
      assert.equal(selected.snapshot.seeds, before.seeds);
      assert.equal(selected.events.filter((e) => e.type === "runReady").length, 1);
      assert.equal(selected.events.some((e) => ["runEnded", "resumed", "eat"].includes(e.type)), false);
    }
  }
});

test("locked selection preserves paused state, and switching discards old queued turns", () => {
  const game = createGameSession({ now: 0, rng: () => 0.3 });
  game.dispatch({ type: "begin" }); game.dispatch({ type: "pause" });
  const before = game.snapshot();
  assert.equal(game.dispatch({ type: "openMinigame", number: 2 }).events[0].reason, "minigameLocked");
  assert.deepEqual(game.snapshot(), before);
  game.dispatch({ type: "grantMinigameFunds" }); game.dispatch({ type: "buyUpgrade", upgrade: "minigames" }); game.dispatch({ type: "buyUpgrade", upgrade: "minigames" });
  game.dispatch({ type: "openMinigame", number: 1 }); game.dispatch({ type: "direction", direction: "left" }); game.dispatch({ type: "pause" });
  const selected = game.dispatch({ type: "openMinigame", number: 2 }).snapshot;
  assert.deepEqual(selected.active.directionQueue, []);
});
