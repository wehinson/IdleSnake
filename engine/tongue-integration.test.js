"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const { snakeConfig } = require("./config.js");
const tongue = require("./tongue.js");

function fixture(speed = "snake") {
  const game = createGameSession({ now: 0, rng: () => 0 });
  game.dispatch({ type: "setSnakeSpeed", snakeSpeed: speed });
  game.dispatch({ type: "selectMode", mode: "snake", setup: {
    grid: { columns: 10, rows: 10 }, tickMs: 180, direction: "up",
    snake: [{ x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }]
  } });
  game.dispatch({ type: "begin" });
  const tracker = tongue.createCatchTracker("gooFork");
  const draw = (now) => {
    const s = game.snapshot();
    return tracker.update({ head: s.active.snake[0],
      direction: s.active.directionQueue[0] || s.active.direction,
      seeds: s.active.foods, stepProgress: s.modeAccumulatorMs / s.active.tickMs,
      tickMs: s.active.tickMs, running: s.phase === "running", now });
  };
  return { game, tracker, draw };
}
const stationary = (frame) => {
  assert.equal(frame.consumed, false);
  assert.deepEqual(frame.seed, { x: 0.5, y: 0.5, scale: 1, stretch: 1 });
};

for (const speed of Object.keys(snakeConfig.speedPresets)) {
  test(`${speed}: last millisecond turn abandons catch without moving or eating Seed`, () => {
    const { game, draw } = fixture(speed);
    const interval = game.snapshot().active.tickMs;
    stationary(draw(0));
    game.tick(interval); stationary(draw(interval));
    game.tick(interval - 1);
    const before = draw(interval * 2 - 1); stationary(before);
    game.dispatch({ type: "direction", direction: "right" });
    const retracted = draw(interval * 2 - 1);
    assert.equal(retracted.phase, "retract");
    assert.deepEqual(retracted.tip, before.tip, "no tip snap on cancellation");
    assert.deepEqual(retracted.mouth, { x: 0.5 + tongue.MOUTH_OFFSET, y: 1.5 });
    assert.deepEqual(retracted.direction, { x: 1, y: 0 });
    const result = game.tick(1);
    assert.deepEqual(result.snapshot.active.snake[0], { x: 1, y: 1 });
    assert.ok(result.snapshot.active.foods.some(f => f.x === 0 && f.y === 0));
    assert.equal(result.events.some(e => e.type === "eat"), false);
    assert.equal(result.snapshot.seeds, 0);
    assert.equal(result.snapshot.active.snake.length, 3);
    const moving = draw(interval * 2 + 20);
    assert.deepEqual(moving.mouth, { x: 1.92, y: 1.5 });
    assert.equal(moving.seedCell, undefined, "retraction owns no live food");
    assert.equal(draw(interval * 2 + 200), null);
    const restored = createGameSession({ now: 0, save: game.serialize() }).snapshot();
    assert.ok(restored.active.foods.some(f => f.x === 0 && f.y === 0));
  });

  test(`${speed}: pull begins only after eat and the late-input window`, () => {
    const { game, tracker, draw } = fixture(speed);
    const interval = game.snapshot().active.tickMs;
    draw(0); game.tick(interval); draw(interval);
    game.tick(interval - 1); stationary(draw(interval * 2 - 1));
    const result = game.tick(1);
    const eat = result.events.find(e => e.type === "eat");
    assert.deepEqual(eat.at, { x: 0, y: 0 });
    assert.equal(result.snapshot.seeds, eat.value);
    assert.equal(result.snapshot.active.snake.length, 4);
    assert.ok(result.snapshot.active.tickMs < interval);
    assert.ok(!result.snapshot.active.foods.some(f => f.x === 0 && f.y === 0));
    tracker.consume(eat.at, interval * 2, result.snapshot.active.tickMs, snakeConfig.inputLateToleranceMs + 1);
    const initial = draw(interval * 2 + snakeConfig.inputLateToleranceMs);
    assert.deepEqual(initial.seed, { x: 0.5, y: 0.5, scale: 1, stretch: 1 });
    const pulling = draw(interval * 2 + snakeConfig.inputLateToleranceMs + 21);
    assert.equal(pulling.consumed, true);
    assert.ok(pulling.seed.y < initial.seed.y);
    assert.deepEqual(pulling.tip, { x: pulling.seed.x, y: pulling.seed.y });
    assert.equal(draw(interval * 2 + 220), null);
    assert.equal(createGameSession({ now: 0, save: game.serialize() }).snapshot().seeds, eat.value);
  });
}

test("timestamped last-second input cancels the provisional consumed display", () => {
  const { game, tracker, draw } = fixture();
  draw(0); game.tick(180); draw(180); game.tick(179); draw(359);
  const result = game.tick(1);
  tracker.consume(result.events.find(e => e.type === "eat").at, 360, 180, 35);
  const initial = draw(360);
  const corrected = game.dispatch({ type: "direction", direction: "right", inputAt: 359 });
  assert.ok(corrected.events.some(e => e.type === "movementCorrected"));
  tracker.cancel(360, 180);
  const cancelled = draw(360);
  assert.deepEqual(cancelled.tip, initial.tip);
  assert.equal(cancelled.consumed, false);
  assert.equal(corrected.snapshot.seeds, 0);
  assert.ok(corrected.snapshot.active.foods.some(f => f.x === 0 && f.y === 0));
});

test("retraction follows successive mouth changes, pauses, and ends without a residual shape", () => {
  const tracker = tongue.createCatchTracker("gooFork");
  const args = { head: { x: 2, y: 2 }, direction: "right", seeds: [{ x: 4, y: 2 }], tickMs: 200 };
  tracker.update({ ...args, now: 0 });
  const before = tracker.update({ ...args, stepProgress: 0.9, now: 90 });
  const turned = tracker.update({ ...args, direction: "up", now: 91 });
  assert.deepEqual(turned.tip, before.tip);
  assert.equal(turned.pull, 0);
  assert.equal(tracker.update({ ...args, running: false, now: 900 }), turned);
  const next = tracker.update({ ...args, head: { x: 2, y: 1 }, direction: "left", now: 151 });
  assert.deepEqual(next.mouth, { x: 2.08, y: 1.5 });
  assert.equal(next.phase, "retract");
  assert.ok(next.tongueScale < 1);
  assert.equal(next.length, Math.hypot(next.tip.x - next.mouth.x, next.tip.y - next.mouth.y));
  assert.equal(tracker.update({ ...args, direction: "up", now: 212 }), null);
});


test('speed change preserves turn boundary and cannot authorize an anticipated pull', () => {
  const { game, draw } = fixture('turtle');
  draw(0); game.tick(240); draw(240); game.tick(120); stationary(draw(360));
  const faster = game.dispatch({ type: 'setSnakeSpeed', snakeSpeed: 'rabbit' }).snapshot;
  assert.ok(Math.abs(faster.active.tickMs - 120) < 1e-9);
  assert.ok(Math.abs(faster.modeAccumulatorMs - 60) < 1e-9);
  stationary(draw(360));
  game.tick(faster.active.tickMs - faster.modeAccumulatorMs - 1); const last = draw(419); stationary(last);
  game.dispatch({ type: 'direction', direction: 'right' });
  assert.deepEqual(draw(419).tip, last.tip);
  const result = game.tick(1);
  assert.deepEqual(result.snapshot.active.snake[0], { x: 1, y: 1 });
  assert.equal(result.events.some(e => e.type === 'eat'), false);
  assert.equal(result.snapshot.seeds, 0);
});

test('confirmed consumed Seed hops beyond each mouth and springs back, with no early motion', () => {
  for (const [direction, vector] of [['right', { x: 1, y: 0 }], ['left', { x: -1, y: 0 }], ['up', { x: 0, y: -1 }], ['down', { x: 0, y: 1 }]]) {
    const tracker = tongue.createCatchTracker('gooFork');
    const args = { head: { x: 2, y: 2 }, direction, seeds: [], tickMs: 200 };
    tracker.consume(args.head, 100, 200, 35);
    for (const now of [100, 120, 134, 135]) {
      const frame = tracker.update({ ...args, now });
      assert.deepEqual(frame.seed, { x: 2.5, y: 2.5, scale: 1, stretch: 1 });
    }
    const peak = tracker.update({ ...args, now: 135 + 170 * 0.4 });
    const forward = frame => (frame.seed.x - frame.mouth.x) * vector.x + (frame.seed.y - frame.mouth.y) * vector.y;
    assert.ok(Math.abs(forward(peak) - 0.35) < 1e-9, direction);
    const returnFrame = tracker.update({ ...args, now: 135 + 170 * 0.8 });
    assert.ok(forward(returnFrame) < 0, 'spring overshoots slightly into the mouth');
    const settled = tracker.update({ ...args, now: 135 + 170 * 0.99 });
    assert.ok(Math.abs(forward(settled)) < Math.abs(forward(returnFrame)));
    assert.equal(tracker.update({ ...args, now: 306 }), null);
  }
});

test('approach keeps extending and rippling while the Seed remains fixed, and pause freezes motion', () => {
  const tracker = tongue.createCatchTracker('gooFork');
  const args = { head: { x: 2, y: 2 }, direction: 'right', seeds: [{ x: 4, y: 2 }], tickMs: 200 };
  tracker.update({ ...args, now: 0 });
  const first = tracker.update({ ...args, now: 60, stepProgress: 0.3 });
  const second = tracker.update({ ...args, now: 90, stepProgress: 0.45 });
  assert.ok(second.length > first.length, 'no emerged-length hold');
  const next = tracker.update({ ...args, now: 110, stepProgress: 0.45 });
  assert.notEqual(next.tongueWave, second.tongueWave);
  assert.notEqual(next.forkWaggle, second.forkWaggle);
  assert.deepEqual(next.seed, { x: 4.5, y: 2.5, scale: 1, stretch: 1 });
  assert.equal(tracker.update({ ...args, now: 1000, running: false }), next);
  const cancelled = tracker.update({ ...args, direction: 'up', now: 110 });
  assert.deepEqual(cancelled.tip, next.tip);
  assert.equal(cancelled.consumed, false);
});
