const test = require("node:test");
const assert = require("node:assert/strict");
const { bodyBlockScale, scaleBodyBlock, bodyAreaVariance, connectorWidth, connectorMinimumWidth, connectorLightening, connectorColor } = require("./snake-appearance.js");
const { createGameSession } = require("./session.js");
const { createSnakeMode, stepSnake } = require("./snake.js");

test("body blocks have stable random area variation within fifteen percent", () => {
  const scales = Array.from({ length: 1000 }, (_, i) => bodyBlockScale(i + 1));
  assert.equal(bodyAreaVariance, 0.15);
  assert.ok(new Set(scales).size > 990);
  assert.ok(Math.min(...scales.map((scale) => scale ** 2)) < 0.86);
  assert.ok(Math.max(...scales.map((scale) => scale ** 2)) > 1.14);
  scales.forEach((scale, i) => {
    assert.ok(scale ** 2 >= 0.85 && scale ** 2 <= 1.15);
    assert.equal(bodyBlockScale(i + 1), scale);
  });
  const rect = { x: 12, y: 24, size: 20 };
  for (let i = 1; i <= 100; i++) {
    const scaled = scaleBodyBlock(rect, i);
    assert.equal(scaled.x + scaled.size / 2, 22);
    assert.equal(scaled.y + scaled.size / 2, 34);
    assert.ok(scaled.size ** 2 / rect.size ** 2 >= 0.85 && scaled.size ** 2 / rect.size ** 2 <= 1.15);
  }
  assert.deepEqual(rect, { x: 12, y: 24, size: 20 });
});

test("size variation stays the same through movement, growth, pause, and a saved board reload", () => {
  const session = createGameSession({ now: 0, rng: () => 0.3 });
  const snake = Array.from({ length: 12 }, (_, index) => ({ x: 15 - index, y: 10 }));
  session.dispatch({ type: "selectMode", mode: "snake", setup: { grid: { columns: 25, rows: 20 }, snake, direction: "up", tickMs: 200 } });
  const profile = (snapshot) => snapshot.active.snake.slice(1, -1).map((_, i) => bodyBlockScale(i + 1));
  const before = profile(session.snapshot());
  session.dispatch({ type: "begin" });
  session.tick(200);
  assert.deepEqual(profile(session.snapshot()), before);
  session.dispatch({ type: "pause" });
  session.tick(10_000);
  assert.deepEqual(profile(session.snapshot()), before);
  const saved = session.serialize();
  const restored = createGameSession({ now: saved.savedAt, save: saved, rng: () => { throw Error("Appearance must not consume gameplay randomness"); } });
  assert.deepEqual(profile(restored.snapshot()), before);
  const core = createSnakeMode({ columns: 25, rows: 20 }, { snake, direction: "up", rng: () => 0.3 });
  const original = core.snake.slice(1, -1).map((_, i) => bodyBlockScale(i + 1));
  core.foods = [{ x: 15, y: 9, kind: "seed" }];
  const grown = stepSnake(core, { rng: () => 0.3 });
  assert.ok(grown.events.some((event) => event.type === "eat"));
  assert.equal(grown.state.snake.length, snake.length + 1);
  assert.deepEqual(grown.state.snake.slice(1, -1).map((_, i) => bodyBlockScale(i + 1)).slice(0, original.length), original);
});

test("connectors are fifteen percent brighter and twenty-five percent thinner", () => {
  assert.equal(connectorWidth, 0.46 * 1.5 * 0.75);
  assert.equal(connectorMinimumWidth, 3 * 0.75);
  assert.equal(connectorLightening, 0.15);
  assert.equal(connectorColor("#29391f"), "#2f4224");
  assert.equal(connectorColor("#16465a"), "#195168");
  assert.equal(connectorColor("#ffffff"), "#ffffff");
});
