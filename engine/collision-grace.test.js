const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const { snakeConfig } = require("./config.js");
function create(body = [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]) {
  const game = createGameSession({ now: 0, rng: () => 0.5 });
  game.dispatch({ type: "selectMode", mode: "snake", setup: {
    grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "right", snake: body
  } });
  return game;
}
function advance(game, ms) {
  while (ms > 0) { const dt = Math.min(100, ms); game.tick(dt); ms -= dt; }
  return game.snapshot();
}
test("a late safe turn rescues a wall collision and starts a full interval", () => {
  const game = create();
  const before = game.snapshot().active.snake;
  const pending = game.dispatch({ type: "direction", direction: "up" });
  assert.ok(pending.events.some(e => e.type === "collisionPending"));
  assert.deepEqual(pending.snapshot.active.snake, before);
  advance(game, snakeConfig.collisionGraceMs - 1);
  const rescued = game.dispatch({ type: "direction", direction: "right" });
  assert.ok(rescued.events.some(e => e.type === "collisionAvoided"));
  assert.deepEqual(rescued.snapshot.active.snake[0], { x: 3, y: 0 });
  assert.equal(rescued.snapshot.active.collisionGraceRemainingMs, null);
  game.dispatch({ type: "direction", direction: "down" });
  assert.deepEqual(advance(game, 199).active.snake[0], { x: 3, y: 0 });
  assert.deepEqual(advance(game, 1).active.snake[0], { x: 3, y: 1 });
});
test("unsafe turns cannot extend grace; expiration ends the run once", () => {
  const game = create();
  game.dispatch({ type: "direction", direction: "up" });
  advance(game, 60);
  for (const direction of ["up", "left", "down"]) {
    assert.ok(game.dispatch({ type: "direction", direction }).events.some(e => e.type === "actionRejected"));
    assert.equal(game.snapshot().active.collisionGraceRemainingMs, 60);
  }
  const ended = game.tick(60);
  assert.equal(ended.snapshot.phase, "gameover");
  assert.equal(ended.events.filter(e => e.type === "runEnded").length, 1);
  assert.equal(game.tick(100).events.some(e => e.type === "runEnded"), false);
  assert.equal(game.dispatch({ type: "direction", direction: "right" }).snapshot.phase, "gameover");
});
test("body collisions can be rescued; pause freezes grace and restart clears it", () => {
  const game = create([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }]);
  game.dispatch({ type: "direction", direction: "up" });
  advance(game, 80);
  game.dispatch({ type: "pause" });
  assert.equal(advance(game, 1000).active.collisionGraceRemainingMs, 40);
  game.dispatch({ type: "resume" });
  const saved = game.dispatch({ type: "direction", direction: "right" }).snapshot;
  assert.deepEqual(saved.active.snake[0], { x: 6, y: 5 });
  game.dispatch({ type: "restart" });
  assert.equal(game.snapshot().active.collisionGraceRemainingMs, null);
});
test("a scheduled collision consumes frame remainder from its grace window", () => {
  const game = create();
  game.dispatch({ type: "selectMode", mode: "snake", setup: { grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "up", snake: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }] } });
  game.dispatch({ type: "begin" });
  advance(game, 190);
  const pending = game.tick(50).snapshot;
  assert.equal(pending.active.collisionGraceRemainingMs, 80);
  assert.equal(pending.modeAccumulatorMs, 0);
  assert.equal(advance(game, 79).phase, "running");
  assert.equal(advance(game, 1).phase, "gameover");
});
