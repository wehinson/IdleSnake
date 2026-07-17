const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const { runHeadless, fastForwardOffline } = require("./simulate.js");

function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

test("runHeadless drives a snake run to game over (bot heads straight into a wall)", () => {
  const game = createGameSession({ now: 0, rng: lcg(42) });
  game.dispatch({ type: "start" });
  // Controller: on the very first step, commit upward; the small default board
  // means the snake reaches the top wall and dies within a handful of steps.
  let sent = false;
  const result = runHeadless(game, {
    stepMs: 200, steps: 200,
    controller: () => (sent ? null : (sent = true, { type: "direction", direction: "up" }))
  });
  assert.equal(result.ended, true);
  assert.ok(result.events.some((e) => e.type === "runEnded"));
  assert.equal(result.snapshot.phase, "gameover");
});

test("runHeadless invokes the controller each step with the latest snapshot", () => {
  const game = createGameSession({ now: 0, rng: lcg(7) });
  game.dispatch({ type: "start" });
  const seen = [];
  runHeadless(game, {
    stepMs: 50, steps: 5, stopOnEnd: false,
    controller: (snapshot, i) => { seen.push({ i, phase: snapshot.phase }); return null; }
  });
  assert.equal(seen.length, 5);
  assert.deepEqual(seen.map((s) => s.i), [0, 1, 2, 3, 4]);
});

test("a bot controller can steer the snake (direction reflected in movement)", () => {
  const game = createGameSession({ now: 0, rng: lcg(3) });
  game.dispatch({ type: "selectMode", mode: "snake" });
  // Steer right on the first step, then coast; head x should increase.
  const startX = game.snapshot().active.snake[0].x;
  let sent = false;
  const result = runHeadless(game, {
    stepMs: 200, steps: 2, stopOnEnd: false,
    controller: () => (sent ? null : (sent = true, { type: "direction", direction: "right" }))
  });
  assert.ok(result.snapshot.active.snake[0].x > startX);
});

test("fastForwardOffline advances idle habitat income over simulated time", () => {
  const game = createGameSession({ save: { currencies: { seeds: 0 }, habitats: { counts: [1] } }, now: 0, rng: lcg(1) });
  const before = game.snapshot().seeds;
  fastForwardOffline(game, 60 * 60 * 1000); // one simulated hour
  assert.ok(game.snapshot().seeds > before, "an hour of habitat income should add seeds");
});

test("runHeadless respects maxSteps when a run never ends", () => {
  const game = createGameSession({ now: 0, rng: lcg(9) });
  game.dispatch({ type: "selectMode", mode: "snake" });
  // No controller and never moved -> stays ready, never ends; must stop at steps.
  const result = runHeadless(game, { stepMs: 100, steps: 12 });
  assert.equal(result.steps, 12);
  assert.equal(result.ended, false);
});
