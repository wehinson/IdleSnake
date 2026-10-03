const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const snake = require("./snake.js");
const { snakeConfig, upgradeConfig } = require("./config.js");
const { validateSaveCandidate } = require("./save-guard.js");

test("linear thirds preserve starting speed, presets, board scaling, and a 3x maximum", () => {
  for (const size of upgradeConfig.board.levels) {
    const [columns, rows] = size.split("x").map(Number);
    const states = Object.values(snakeConfig.speedPresets).map(speedMultiplier =>
      snake.createSnakeMode({ columns, rows }, { speedMultiplier, rng: () => 0.2 }));
    const initial = states.map(state => 1000 / state.tickMs);
    assert.ok(Math.abs(initial[0] / initial[1] - 0.75) < 1e-9);
    assert.ok(Math.abs(initial[2] / initial[1] - 1.5) < 1e-9);
    const target = snake.masteryScore({ columns, rows });
    const total = 1 + 1.15 + 1.15 ** 2;
    for (const [fraction, expected] of [[0, 0], [1 / 3, 1 / total], [2 / 3, 2.15 / total], [1, 1], [2, 1]]) {
      states.forEach((state, i) => {
        state.score = target * fraction;
        const speed = 1000 / snake.movementInterval(state);
        const curveProgress = (speed - initial[i]) / (initial[i] * snakeConfig.maximumSpeedMultiplier - initial[i]);
        assert.ok(Math.abs(curveProgress - expected) < 1e-9,
          `${size} at ${fraction * 100}% mastery has curve progress ${curveProgress}`);
      });
    }
    states.forEach(state => {
      const startingInterval = 1000 / (1000 / state.initialTickMs * state.speedMultiplier);
      state.score = target;
      const atMastery = snake.movementInterval(state);
      assert.equal(snakeConfig.maximumSpeedMultiplier, 3);
      assert.ok(Math.abs(atMastery - startingInterval / 3) < 1e-9);
    });
  }
});

test("speed gain per food is constant in each third and rises by 15% at each boundary", () => {
  const state = snake.createSnakeMode({ columns: 20, rows: 25 });
  const target = snake.masteryScore(state.grid);
  const speed = n => { state.score = n; return 1000 / snake.movementInterval(state); };
  const gainAt = fraction => speed(target * fraction + 1) - speed(target * fraction);
  assert.ok(Math.abs(gainAt(0.10) - gainAt(0.20)) < 1e-9);
  assert.ok(Math.abs(gainAt(0.50) / gainAt(0.10) - 1.15) < 1e-9);
  assert.ok(Math.abs(gainAt(0.85) / gainAt(0.50) - 1.15) < 1e-9);
  for (const boundary of [1 / 3, 2 / 3]) {
    assert.ok(Math.abs(speed(target * boundary - 1e-7) - speed(target * boundary + 1e-7)) < 1e-7);
  }
  state.score = target * 0.525;
  snake.setSpeedMultiplier(state, 1.5);
  const rabbit = 1000 / state.tickMs;
  snake.setSpeedMultiplier(state, 1);
  assert.ok(Math.abs(rabbit / (1000 / state.tickMs) - 1.5) < 1e-9,
    "the preset scales the full speed curve");
});

test("speed changes keep the active run and phase, apply immediately, and persist", () => {
  const game = createGameSession({ now: 0 });
  assert.equal(game.snapshot().snakeSpeed, "snake");
  game.dispatch({ type: "start" });
  game.dispatch({ type: "begin" });
  game.tick(50);
  game.dispatch({ type: "pause" });
  const before = game.snapshot();
  const turtle = game.dispatch({ type: "setSnakeSpeed", snakeSpeed: "turtle" }).snapshot;
  assert.equal(turtle.active.tickMs, before.active.tickMs / 0.75);
  assert.equal(turtle.phase, "paused");
  assert.deepEqual(turtle.active.snake, before.active.snake);
  assert.equal(turtle.active.score, before.active.score);
  const rabbit = game.dispatch({ type: "setSnakeSpeed", snakeSpeed: "rabbit" }).snapshot;
  assert.ok(Math.abs(rabbit.active.tickMs - before.active.tickMs / 1.5) < 1e-9);
  const save = game.serialize();
  assert.equal(validateSaveCandidate(save).ok, true);
  const restored = createGameSession({ now: 0, save });
  assert.equal(restored.snapshot().snakeSpeed, "rabbit");
  assert.equal(restored.dispatch({ type: "start" }).snapshot.active.speedMultiplier, 1.5);
  const normal = game.dispatch({ type: "setSnakeSpeed", snakeSpeed: "snake" }).snapshot;
  assert.ok(Math.abs(normal.active.tickMs - before.active.tickMs) < 1e-9);
});

test("old saves default to Snake; invalid presets reject; other modes keep their speed", () => {
  const game = createGameSession({ now: 0, save: { saveVersion: 2 } });
  assert.equal(game.snapshot().snakeSpeed, "snake");
  for (const snakeSpeed of ["wolf", "__proto__", ["rabbit"], 1.5, null]) {
    const before = game.snapshot();
    assert.ok(game.dispatch({ type: "setSnakeSpeed", snakeSpeed }).events.some(e => e.type === "actionRejected"));
    assert.deepEqual(game.snapshot(), before);
  }
  game.dispatch({ type: "selectMode", mode: "runner" });
  const before = game.snapshot().active;
  game.dispatch({ type: "setSnakeSpeed", snakeSpeed: "rabbit" });
  assert.deepEqual(game.snapshot().active, before);
  const malformed = game.serialize();
  malformed.session.snakeSpeed = "wolf";
  assert.equal(validateSaveCandidate(malformed).ok, false);
  assert.equal(createGameSession({ now: 0, save: malformed }).snapshot().snakeSpeed, "snake");
});
