const test = require("node:test");
const assert = require("node:assert/strict");
const { bodyMarkings, markingSpacing, markingSpeed, connectorWidth, connectorLightening, connectorColor } = require("./snake-appearance.js");
const { createGameSession } = require("./session.js");
const straight = Array.from({ length: 80 }, (_, index) => ({ x: index, y: 0 }));

test("small body markings travel continuously with sparse spacing and three shapes", () => {
  const before = bodyMarkings(straight);
  const after = bodyMarkings(straight, { elapsedMs: 250 });
  assert.ok(before.length < straight.length / 4);
  assert.deepEqual([...new Set(before.map((mark) => mark.variant))].sort(), [0, 1, 2]);
  for (let i = 0; i < before.length; i++) {
    assert.ok(Math.abs(after[i].x - before[i].x - markingSpeed * 0.25) < 1e-12);
    assert.equal(after[i].y, 0);
    assert.equal(after[i].variant, before[i].variant);
    if (i) assert.ok(Math.abs(before[i].position - before[i - 1].position - markingSpacing) < 1e-12);
  }
  for (const time of [0, 2_000, 8_000, 1e8]) {
    for (const mark of bodyMarkings(straight, { elapsedMs: time })) {
      assert.ok(mark.position >= 1.1 && mark.position <= straight.length - 2.1);
      assert.ok(mark.opacity >= 0 && mark.opacity <= 1);
    }
  }
  assert.deepEqual(bodyMarkings(straight.slice(0, 3)), []);
});

test("markings follow bends without an orientation jump or changes to body cells", () => {
  const points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }];
  const saved = structuredClone(points);
  const crossingTime = (2 - 1.6) / markingSpeed * 1000;
  const before = bodyMarkings(points, { elapsedMs: crossingTime - 0.01 })[0];
  const after = bodyMarkings(points, { elapsedMs: crossingTime + 0.01 })[0];
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 0.001);
  assert.ok(Math.abs(after.angle - before.angle) < 0.001);
  assert.deepEqual(points, saved);
  assert.equal(connectorWidth, 0.46 * 1.5);
  assert.equal(connectorLightening, 0.10);
  assert.equal(connectorColor("#29391f"), "#2d3f22");
  assert.equal(connectorColor("#16465a"), "#184d63");
  assert.equal(connectorColor("#ffffff"), "#ffffff");
});

test("pause freezes markings through elapsed time and reduced motion keeps them static", () => {
  const session = createGameSession({ now: 0, rng: () => 0.3 });
  const snake = Array.from({ length: 12 }, (_, index) => ({ x: 15 - index, y: 10 }));
  session.dispatch({ type: "selectMode", mode: "snake", setup: { grid: { columns: 25, rows: 20 }, snake, direction: "up", tickMs: 200 } });
  session.dispatch({ type: "begin" });
  session.tick(100);
  session.dispatch({ type: "pause" });
  const before = session.snapshot();
  const after = session.tick(10_000).snapshot;
  assert.deepEqual(bodyMarkings(after.active.snake, { elapsedMs: after.elapsedMs }), bodyMarkings(before.active.snake, { elapsedMs: before.elapsedMs }));
  assert.deepEqual(bodyMarkings(straight, { elapsedMs: 0, reducedMotion: true }), bodyMarkings(straight, { elapsedMs: 50_000, reducedMotion: true }));
});
