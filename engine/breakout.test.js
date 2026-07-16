const test = require("node:test");
const assert = require("node:assert/strict");
const breakout = require("./breakout.js");

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

const boardWidth = 480;
const boardHeight = 480;

function state(overrides = {}) {
  return {
    score: 0, lives: 2, segmentSize: 24, gap: 2,
    paddle: { x: 200, y: 440, length: 3, input: 0 },
    balls: [{ x: 240, y: 300, radius: 6, vx: 0, vy: 200 }],
    bricks: [{ x: 100, y: 50, width: 40, height: 16, color: "#000" }],
    powerups: [], seedBoosts: [], heartsCollected: 0,
    ...overrides
  };
}

function ctx(overrides = {}) {
  return { deltaMs: 16, boardWidth, boardHeight, elapsedMs: 0, rng: seededRng(1), ...overrides };
}

test("paddleWidth accounts for segments and gaps", () => {
  const s = state();
  assert.equal(breakout.paddleWidth(s), 3 * 24 + 2 * 2);
});

test("the ball moves under gravity of its velocity each tick", () => {
  const s = state();
  const y0 = s.balls[0].y;
  breakout.step(s, ctx());
  assert.ok(s.balls[0].y > y0, "ball advanced downward");
});

test("the ball bounces off the paddle back upward", () => {
  const s = state({ balls: [{ x: 212, y: 432, radius: 6, vx: 0, vy: 200 }] });
  breakout.step(s, ctx());
  assert.ok(s.balls[0].vy < 0, "ball is now heading up after paddle bounce");
});

test("clearing the last brick wins", () => {
  // Put the ball right on the brick so it collides this tick.
  const s = state({ balls: [{ x: 120, y: 60, radius: 6, vx: 0, vy: 40 }] });
  const r = breakout.step(s, ctx());
  assert.equal(r.alive, false);
  assert.equal(r.events.some((e) => e.type === "win"), true);
  assert.equal(s.score, 10);
});

test("losing the last ball with lives remaining emits ballLost", () => {
  const s = state({ lives: 2, balls: [{ x: 240, y: 490, radius: 6, vx: 0, vy: 400 }] });
  const r = breakout.step(s, ctx());
  assert.equal(r.alive, true);
  assert.equal(s.lives, 1);
  assert.equal(r.events.some((e) => e.type === "ballLost"), true);
  assert.equal(s.balls.length, 1, "a fresh ball was served");
});

test("losing the last ball with no lives left ends the game", () => {
  const s = state({ lives: 1, balls: [{ x: 240, y: 490, radius: 6, vx: 0, vy: 400 }] });
  const r = breakout.step(s, ctx());
  assert.equal(r.alive, false);
  assert.equal(r.events.some((e) => e.type === "gameOver"), true);
});

test("a caught seed powerup grows the paddle", () => {
  const s = state({ powerups: [{ type: "seed", x: 212, y: 438, radius: 5 }], balls: [{ x: 10, y: 10, radius: 6, vx: 0, vy: -10 }] });
  const before = s.paddle.length;
  breakout.step(s, ctx());
  assert.equal(s.paddle.length, before + 1, "paddle grew from the seed");
});

test("runs headless with no DOM", () => {
  assert.equal(typeof document, "undefined");
  assert.doesNotThrow(() => breakout.step(state(), ctx()));
});
