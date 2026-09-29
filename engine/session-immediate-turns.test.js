const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");

function gameAt(setup = {}, save) {
  const game = createGameSession({ now: 0, rng: () => 0, save });
  game.dispatch({ type: "selectMode", mode: "snake", setup: {
    grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "right",
    snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], ...setup
  } });
  return game;
}
function advance(game, ms) {
  while (ms > 0) { const dt = Math.min(100, ms); game.tick(dt); ms -= dt; }
  return game.snapshot();
}

test("the first turn after straight travel is immediate and starts a new interval", () => {
  for (const elapsed of [1, 100, 199]) {
    const game = gameAt();
    game.dispatch({ type: "begin" });
    advance(game, elapsed);
    const turn = game.dispatch({ type: "direction", direction: "up" }).snapshot;
    assert.deepEqual(turn.active.snake[0], { x: 10, y: 9 });
    assert.equal(turn.modeAccumulatorMs, 0);
    assert.deepEqual(advance(game, 199).active.snake[0], { x: 10, y: 9 });
    assert.deepEqual(advance(game, 1).active.snake[0], { x: 10, y: 8 });
  }
});

test("a ready turn is immediate and repeated left turns consume half intervals", () => {
  const game = gameAt();
  game.dispatch({ type: "direction", direction: "up" });
  for (const direction of ["left", "down", "right"]) game.dispatch({ type: "direction", direction });
  const before = game.snapshot();
  assert.deepEqual(before.active.snake[0], { x: 10, y: 9 });
  assert.deepEqual(before.active.directionQueue, ["left", "down", "right"]);
  assert.ok(game.dispatch({ type: "direction", direction: "up" }).events.some(e => e.type === "actionRejected"));
  assert.deepEqual(game.snapshot().active.directionQueue, ["left", "down", "right"]);
  assert.deepEqual(advance(game, 99).active.snake[0], { x: 10, y: 9 });
  assert.deepEqual(advance(game, 1).active.snake[0], { x: 9, y: 9 });
  assert.deepEqual(advance(game, 100).active.snake[0], { x: 9, y: 10 });
  assert.deepEqual(advance(game, 100).active.snake[0], { x: 10, y: 10 });
  assert.deepEqual(game.snapshot().active.directionQueue, []);
});

test("queued reversals reject against the final queued turn and pause preserves the queue", () => {
  const game = gameAt();
  game.dispatch({ type: "direction", direction: "up" });
  game.dispatch({ type: "direction", direction: "left" });
  assert.ok(game.dispatch({ type: "direction", direction: "right" }).events.some(e => e.type === "actionRejected"));
  advance(game, 50);
  game.dispatch({ type: "pause" });
  advance(game, 1000);
  assert.deepEqual(game.snapshot().active.directionQueue, ["left"]);
  game.dispatch({ type: "resume" });
  assert.deepEqual(advance(game, 50).active.snake[0], { x: 9, y: 9 });
  game.dispatch({ type: "direction", direction: "down" });
  assert.deepEqual(game.dispatch({ type: "restart" }).snapshot.active.directionQueue, []);
});

test("duplicates and reversals do not move or reset the interval", () => {
  const game = gameAt();
  game.dispatch({ type: "begin" });
  const before = advance(game, 150);
  for (const direction of ["right", "left", "unknown"]) {
    const result = game.dispatch({ type: "direction", direction });
    assert.deepEqual(result.snapshot.active, before.active);
    assert.equal(result.snapshot.modeAccumulatorMs, 150);
  }
  assert.deepEqual(advance(game, 50).active.snake[0], { x: 11, y: 10 });
});

test("Ready input moves immediately while pause, resume, and restart preserve lifecycle", () => {
  const game = gameAt();
  const started = game.dispatch({ type: "direction", direction: "right" });
  assert.ok(started.events.some(e => e.type === "runStarted"));
  assert.deepEqual(started.snapshot.active.snake[0], { x: 11, y: 10 });
  advance(game, 80);
  const paused = game.dispatch({ type: "pause" }).snapshot;
  assert.ok(game.dispatch({ type: "direction", direction: "up" }).events.some(e => e.type === "actionRejected"));
  assert.deepEqual(advance(game, 500).active, paused.active);
  game.dispatch({ type: "resume" });
  assert.deepEqual(advance(game, 119).active.snake[0], paused.active.snake[0]);
  assert.deepEqual(advance(game, 1).active.snake[0], { x: 12, y: 10 });
  assert.equal(game.dispatch({ type: "restart" }).snapshot.phase, "ready");
});

test("immediate and automatic moves have the same food, growth, and reward effects", () => {
  const body = [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }];
  const immediate = gameAt({ snake: body });
  const automatic = gameAt({ snake: body, direction: "up" });
  const turn = immediate.dispatch({ type: "direction", direction: "up" });
  automatic.dispatch({ type: "begin" });
  advance(automatic, 200);
  assert.deepEqual({ ...turn.snapshot.active, lastTurn: 0 }, automatic.snapshot().active);
  assert.equal(turn.snapshot.seeds, 1);
  assert.equal(turn.snapshot.active.snake.length, 4);
  assert.equal(turn.snapshot.best, automatic.snapshot().best);
  assert.ok(turn.events.some(e => e.type === "eat"));
  assert.ok(turn.events.some(e => e.type === "speedChanged"));
  immediate.dispatch({ type: "direction", direction: "right" });
  advance(immediate, immediate.snapshot().active.tickMs);
  assert.equal(immediate.snapshot().active.snake.length, 5);
});

test("wall and body collisions end once after grace, and shields still redirect", () => {
  const setup = { snake: [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }] };
  const game = gameAt(setup);
  game.dispatch({ type: "direction", direction: "up" });
  game.tick(100);
  const ended = game.tick(20);
  assert.equal(ended.snapshot.phase, "gameover");
  assert.equal(ended.events.filter(e => e.type === "runEnded").length, 1);
  assert.equal(game.tick(100).events.some(e => e.type === "runEnded"), false);
  assert.ok(game.dispatch({ type: "direction", direction: "down" }).events.some(e => e.type === "actionRejected"));
  const shielded = gameAt(setup, { upgrades: { shieldLevel: 1 } });
  const saved = shielded.dispatch({ type: "direction", direction: "up" });
  assert.equal(saved.snapshot.phase, "running");
  assert.ok(saved.events.some(e => e.type === "shield"));
  assert.equal(saved.snapshot.upgrades.shieldLevel, 0);
  assert.deepEqual(saved.snapshot.active.snake[0], { x: 2, y: 0 });
  assert.equal(saved.snapshot.active.shieldImpact.ticksRemaining, 3);
  const queued = shielded.dispatch({ type: "direction", direction: "down" });
  assert.ok(queued.events.some(e => e.type === "directionQueued"));
  assert.deepEqual(queued.snapshot.active.directionQueue, ["down"]);
  shielded.dispatch({ type: "pause" });
  assert.deepEqual(advance(shielded, 500).active.shieldImpact, queued.snapshot.active.shieldImpact);
  shielded.dispatch({ type: "resume" });
  assert.deepEqual(advance(shielded, 599).active.snake[0], { x: 2, y: 0 });
  const redirected = shielded.tick(1);
  assert.deepEqual(redirected.snapshot.active.snake[0], { x: 3, y: 0 });
  assert.equal(redirected.snapshot.active.shieldImpact, null);
  assert.ok(redirected.events.some(e => e.type === "shieldRedirected"));
  const body = gameAt({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }] });
  body.dispatch({ type: "direction", direction: "up" });
  assert.equal(advance(body, 120).phase, "gameover");
});

test("input timing and multiple turns produce deterministic headless results", () => {
  function run() {
    const game = gameAt();
    for (const [ms, direction] of [[0, "up"], [15, "left"], [199, "down"], [201, "right"]]) {
      advance(game, ms);
      game.dispatch({ type: "direction", direction });
    }
    return { snapshot: game.snapshot(), save: game.serialize() };
  }
  assert.deepEqual(run(), run());
});

test("an immediate turn collects an egg through the canonical nursery", () => {
  const game = gameAt({ snake: [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }] }, { eggBoardCountdown: 1 });
  assert.equal(game.snapshot().active.eggBoard, true);
  assert.ok(game.snapshot().active.foods.some(food => food.x === 1 && food.y === 0 && food.kind === "egg"));
  const before = game.snapshot().nursery.hatchlings.length;
  const result = game.dispatch({ type: "direction", direction: "up" });
  assert.ok(result.events.some(e => e.type === "eggCollected"));
  assert.equal(result.snapshot.nursery.hatchlings.length, before + 1);
  assert.equal(result.snapshot.seeds, 0);
  assert.equal(createGameSession({ now: 0, save: game.serialize() }).snapshot().nursery.hatchlings.length, before + 1);
});

test("left then right waits a full interval and does not get the U-turn shortcut", () => {
  const game = gameAt();
  game.dispatch({ type: "direction", direction: "up" }); // left relative to right
  game.dispatch({ type: "direction", direction: "right" }); // right relative to up
  assert.deepEqual(advance(game, 199).active.snake[0], { x: 10, y: 9 });
  assert.deepEqual(advance(game, 1).active.snake[0], { x: 11, y: 9 });
  game.dispatch({ type: "direction", direction: "up" });
  assert.deepEqual(advance(game, 199).active.snake[0], { x: 11, y: 9 });
  assert.deepEqual(advance(game, 1).active.snake[0], { x: 11, y: 8 });
});

test("two right turns also use half a tick", () => {
  const game = gameAt();
  game.dispatch({ type: "direction", direction: "down" });
  game.dispatch({ type: "direction", direction: "left" });
  assert.deepEqual(advance(game, 99).active.snake[0], { x: 10, y: 11 });
  assert.deepEqual(advance(game, 1).active.snake[0], { x: 9, y: 11 });
});
