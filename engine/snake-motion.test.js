const test = require("node:test");
const assert = require("node:assert/strict");
const { bodyPoints } = require("./snake-motion.js");
const { createGameSession } = require("./session.js");

const straight = Array.from({ length: 12 }, (_, index) => Object.freeze({ x: 13 - index, y: 5 }));
Object.freeze(straight);

test("every body block and tail move between ticks with a wave along the body", () => {
  const first = bodyPoints(straight, { elapsedMs: 300, phase: "running" });
  const second = bodyPoints(straight, { elapsedMs: 325, phase: "running" });
  assert.deepEqual(first[0], straight[0]);
  assert.deepEqual(second[0], straight[0]);
  for (let index = 1; index < straight.length; index += 1) {
    assert.notDeepEqual(first[index], second[index], `segment ${index} moves`);
    assert.equal(first[index].x, straight[index].x);
  }
  assert.ok((first[1].y - 5) * (first[4].y - 5) < 0, "the body does not sway as one rigid block");
});

test("motion follows horizontal, vertical, and bent bodies within a small cell offset", () => {
  const shapes = [straight, straight.map(({ x, y }) => ({ x: y, y: x })),
    [{ x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]];
  for (const snake of shapes) {
    for (let elapsedMs = 0; elapsedMs < 1600; elapsedMs += 17) {
      const points = bodyPoints(snake, { elapsedMs, phase: "running" });
      points.forEach((point, index) => {
        assert.ok(Math.hypot(point.x - snake[index].x, point.y - snake[index].y) <= 0.065 + 1e-12);
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      });
    }
  }
  const vertical = shapes[1];
  const moved = bodyPoints(vertical, { elapsedMs: 300, phase: "running" });
  assert.equal(moved[1].y, vertical[1].y);
  assert.notEqual(moved[1].x, vertical[1].x);
});

test("ready, finished, reduced-motion, and startup frames retain exact cells", () => {
  for (const phase of ["ready", "gameover", "won"]) {
    assert.deepEqual(bodyPoints(straight, { elapsedMs: 300, phase }), straight);
  }
  assert.deepEqual(bodyPoints(straight, { elapsedMs: 300, phase: "running", reducedMotion: true }), straight);
  assert.deepEqual(bodyPoints(straight, { elapsedMs: 0, phase: "running" }), straight);
  assert.deepEqual(bodyPoints([], { elapsedMs: 300, phase: "running" }), []);
  assert.deepEqual(bodyPoints([{ x: 1, y: 1 }], { elapsedMs: 300, phase: "running" }), [{ x: 1, y: 1 }]);
});

test("motion reads the session clock, freezes on pause, and leaves game state and saves intact", () => {
  const session = createGameSession({ now: 0, rng: () => 0.5 });
  session.dispatch({ type: "selectMode", mode: "snake" });
  session.dispatch({ type: "playDirection", direction: "up" });
  const running = session.tick(70).snapshot;
  const before = session.serialize();
  const points = bodyPoints(running.active.snake, { elapsedMs: running.elapsedMs, phase: running.phase });
  assert.deepEqual(session.serialize(), before);
  session.dispatch({ type: "togglePause" });
  const paused = session.tick(500).snapshot;
  assert.deepEqual(bodyPoints(paused.active.snake, { elapsedMs: paused.elapsedMs, phase: paused.phase }), points);
  session.dispatch({ type: "togglePause" });
  const resumed = session.tick(25).snapshot;
  assert.notDeepEqual(bodyPoints(resumed.active.snake, { elapsedMs: resumed.elapsedMs, phase: resumed.phase }), points);
});
