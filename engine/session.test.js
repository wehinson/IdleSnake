const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession, SAVE_VERSION } = require("./session.js");

test("a seeded session runs snake headlessly and snapshots are immutable", () => {
  const game = createGameSession({ seed: 42, now: 1000 });
  const started = game.dispatch({ type: "start" });
  assert.equal(started.snapshot.phase, "running");
  assert.equal(Object.isFrozen(started.snapshot), true);
  assert.equal(Object.isFrozen(started.snapshot.active), true);
  const before = started.snapshot.active.snake[0];
  game.tick(100);
  const after = game.tick(100).snapshot.active.snake[0];
  assert.equal(after.y, before.y - 1);
});

test("same seed and actions produce the same canonical save", () => {
  const run = () => {
    const game = createGameSession({ seed: 7, now: 10 });
    game.dispatch({ type: "start" });
    game.dispatch({ type: "direction", direction: "left" });
    game.tick(190); game.tick(190);
    return game.serialize();
  };
  assert.deepEqual(run(), run());
});

test("migrates a legacy consolidated save into version two", () => {
  const game = createGameSession({ save: { savedAt: 5, currencies: { seeds: 12 }, records: { best: 9 }, upgrades: { foodTypeLevel: 2 }, settings: { snakeColors: { head: "#fff" } } }, now: 10 });
  const save = game.serialize();
  assert.equal(save.saveVersion, SAVE_VERSION);
  assert.equal(save.session.seeds, 12);
  assert.equal(save.session.best, 9);
  assert.equal(save.session.upgrades.foodTypeLevel, 2);
});

test("every shipped mode can be launched headlessly through the session", () => {
  for (const mode of ["snake", "duel", "maze", "breakout", "crossing", "snakebird", "sokoban", "broodline"]) {
    const game = createGameSession({ seed: 99 });
    assert.equal(game.dispatch({ type: "selectMode", mode }).snapshot.mode, mode);
    const started = game.dispatch({ type: "start" });
    assert.equal(started.snapshot.phase, "running", mode);
    assert.ok(started.snapshot.active, mode);
    assert.doesNotThrow(() => game.tick(100), mode);
  }
});
