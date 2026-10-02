const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("./snake-body-motion.js");
const { createGameSession } = require("./session.js");

function fixture(direction = "right", tickMs = 200, foods = [{ x: 18, y: 18 }]) {
  const vectors = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
  const vector = vectors[direction];
  const snake = Array.from({ length: 5 }, (_, index) => ({ x: 10 - vector.x * index, y: 10 - vector.y * index }));
  let game = createGameSession({ now: 0, rng: () => 0.5 });
  game.dispatch({ type: "selectMode", mode: "snake", setup: {
    grid: { columns: 20, rows: 20 }, snake, direction, tickMs
  } });
  const save = game.serialize();
  save.session.active.foods = foods.map((food) => ({ ...food, kind: "seed" }));
  game = createGameSession({ now: 0, rng: () => 0.5, save });
  const ready = game.snapshot();
  const motion = create(ready);
  const accept = (result) => { motion.observe(result.snapshot); return result.snapshot; };
  accept(game.dispatch({ type: "begin" }));
  return { game, motion, accept, vector };
}

test("the head snaps while every moving body segment and tail slide only forward inside their new cells", () => {
  for (const direction of ["right", "left", "up", "down"]) {
    const { game, motion, accept, vector } = fixture(direction);
    const moved = accept(game.tick(200));
    const start = motion.points(moved);
    assert.deepEqual(start[0], moved.active.snake[0]);
    for (let index = 1; index < start.length; index += 1) {
      const cell = moved.active.snake[index];
      const distance = index === start.length - 1 ? 0.06 : 0.1;
      assert.ok(Math.abs(start[index].x - (cell.x - vector.x * distance)) < 1e-10);
      assert.ok(Math.abs(start[index].y - (cell.y - vector.y * distance)) < 1e-10);
      assert.equal(Math.floor(start[index].x + 0.5), cell.x);
      assert.equal(Math.floor(start[index].y + 0.5), cell.y);
      if (index === start.length - 1) {
        assert.ok(0.5 + 0.6 * (1 - 2 * 0.135) + distance < 1, "the tail tip stays inside its cell");
      }
    }
    const half = accept(game.tick(22.5));
    const halfway = motion.points(half);
    for (let index = 1; index < start.length; index += 1) {
      const offset = Math.hypot(halfway[index].x - half.active.snake[index].x, halfway[index].y - half.active.snake[index].y);
      assert.ok(offset > 0 && offset < 0.1);
      assert.deepEqual(halfway[0], half.active.snake[0]);
    }
    const ended = accept(game.tick(22.5));
    assert.deepEqual(motion.points(ended), ended.active.snake);
  }
});

test("segments at turns use their own travel directions, with no lateral motion or long neck", () => {
  const { game, motion, accept } = fixture();
  accept(game.dispatch({ type: "direction", direction: "up" }));
  const first = accept(game.tick(200));
  const p1 = motion.points(first);
  assert.deepEqual(p1[0], { x: 10, y: 9 });
  assert.equal(p1[1].y, 10);
  assert.equal(p1[1].x, 9.9);
  const second = accept(game.tick(200));
  const p2 = motion.points(second);
  assert.deepEqual(p2[0], { x: 10, y: 8 });
  assert.deepEqual(p2[1], { x: 10, y: 9.1 });
  assert.deepEqual(p2[2], { x: 9.9, y: 10 });
  for (let index = 1; index < p2.length; index += 1) {
    const gap = Math.hypot(p2[index].x - p2[index - 1].x, p2[index].y - p2[index - 1].y);
    assert.ok(gap <= 1.1 + 1e-10, "connector stays short");
  }
});

test("growth holds the new tail on its occupied cell instead of creating a false slide", () => {
  const { game, motion, accept } = fixture("right", 200, [{ x: 11, y: 10 }]);
  const before = game.snapshot().active.snake;
  const moved = accept(game.tick(200));
  assert.equal(moved.active.snake.length, before.length + 1);
  const points = motion.points(moved);
  assert.deepEqual(points.at(-1), before.at(-1));
  assert.notDeepEqual(points[1], moved.active.snake[1]);
});

test("pause freezes a partial slide and resume completes it using the session clock", () => {
  const { game, motion, accept } = fixture();
  accept(game.tick(200));
  const halfway = accept(game.tick(15));
  const points = motion.points(halfway);
  accept(game.dispatch({ type: "pause" }));
  const paused = accept(game.tick(500));
  assert.deepEqual(motion.points(paused), points);
  accept(game.dispatch({ type: "resume" }));
  const ended = accept(game.tick(30));
  assert.deepEqual(motion.points(ended), ended.active.snake);
});

test("Reduced motion clears an active slide and does not replay it when switched off", () => {
  for (const deviceSetting of [false, true]) {
    const { game, motion, accept } = fixture();
    const moved = accept(game.tick(200));
    assert.notDeepEqual(motion.points(moved), moved.active.snake);
    const reduced = deviceSetting ? moved : accept(game.dispatch({ type: "setReducedMotion", reducedMotion: true }));
    assert.deepEqual(motion.points(reduced, { reducedMotion: deviceSetting }), reduced.active.snake);
    const restored = deviceSetting ? moved : accept(game.dispatch({ type: "setReducedMotion", reducedMotion: false }));
    assert.deepEqual(motion.points(restored), restored.active.snake);
  }
});

test("high speed shortens the slide; late frames do not replay completed movement", () => {
  const fast = fixture("right", 100);
  const moved = fast.accept(fast.game.tick(100));
  assert.notDeepEqual(fast.motion.points(moved), moved.active.snake);
  const ended = fast.accept(fast.game.tick(25));
  assert.deepEqual(fast.motion.points(ended), ended.active.snake);
  const late = fixture();
  const caughtUp = late.accept(late.game.tick(260));
  assert.deepEqual(late.motion.points(caughtUp), caughtUp.active.snake);
  const multi = fixture();
  const skipped = multi.accept(multi.game.tick(400));
  assert.deepEqual(multi.motion.points(skipped), skipped.active.snake);
});

test("reset, load, mode changes and game over clear the slide without changing saves or occupied cells", () => {
  const { game, motion, accept } = fixture();
  const moved = accept(game.tick(200));
  const before = game.serialize();
  motion.points(moved);
  assert.deepEqual(game.serialize(), before);
  motion.reset(moved);
  assert.deepEqual(motion.points(moved), moved.active.snake);
  const next = accept(game.tick(200));
  assert.notDeepEqual(motion.points(next), next.active.snake);
  const ready = accept(game.dispatch({ type: "restart" }));
  assert.deepEqual(motion.points(ready), ready.active.snake);
  const final = { ...next, phase: "gameover" };
  motion.observe(final);
  assert.deepEqual(motion.points(final), final.active.snake);
  const otherMode = accept(game.dispatch({ type: "selectMode", mode: "runner" }));
  assert.deepEqual(motion.points(otherMode), []);
});
