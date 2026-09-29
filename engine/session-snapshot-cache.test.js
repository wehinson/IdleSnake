const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");

test("cached snapshot fields update after actions without changing older snapshots or saves", () => {
  const game = createGameSession({ now: 0 });
  const before = game.snapshot();
  const repeated = game.tick(16, { snapshot: "frame" }).snapshot;
  assert.equal(before.records, repeated.records);
  assert.equal(before.mobileControls, repeated.mobileControls);
  const savedBefore = JSON.stringify(before);
  const changed = game.dispatch({ type: "setCosmetics", cosmetics: { head: "#fff" } }).snapshot;
  assert.equal(changed.cosmetics.head, "#fff");
  assert.notEqual(changed.cosmetics, before.cosmetics);
  assert.equal(JSON.stringify(before), savedBefore);
  assert.ok(Object.isFrozen(changed.cosmetics));
  assert.equal(Object.hasOwn(game.serialize().session, "snapshotCache"), false);
  const restored = createGameSession({ now: 16, save: game.serialize() });
  assert.deepEqual(restored.snapshot().cosmetics, changed.cosmetics);
});

test("custom puzzle definitions stay isolated and shipped level changes replace cached walls", () => {
  const game = createGameSession({ now: 0 });
  const definition = { firstClearReward: 20, replayReward: 5, map: ["....", "HG..", "####"] };
  const custom = game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition, levelIndex: 0, levelCount: 5 } }).snapshot;
  assert.notEqual(custom.active.definition, definition);
  assert.ok(Object.isFrozen(custom.active.definition.map));
  definition.map[0] = "####";
  assert.equal(custom.active.definition.map[0], "....");
  const first = game.dispatch({ type: "selectPuzzleLevel", mode: "sokoban", levelIndex: 0 }).snapshot;
  const second = game.dispatch({ type: "selectPuzzleLevel", mode: "sokoban", levelIndex: 1 }).snapshot;
  assert.notEqual(first.active.walls, second.active.walls);
  const restarted = game.dispatch({ type: "restart" }).snapshot;
  assert.equal(restarted.active.walls, second.active.walls);
  assert.deepEqual(first.active.definition, require("./puzzle-levels.js").sokoban[0]);
});
