const test = require("node:test");
const assert = require("node:assert/strict");
const snake = require("./snake.js");

function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test("createSnakeMode builds a centered snake and spawns the right food count", () => {
  const state = snake.createSnakeMode({ columns: 9, rows: 9 }, {
    rng: seededRng(1),
    upgrades: { foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0 }
  });
  assert.equal(state.snake.length, 3);
  assert.equal(state.foods.length, 1); // baseCount 1 + level 0
  assert.equal(state.direction, "up");
  assert.equal(state.tickMs, 317, "starts 40% slower than the prior 190 ms cadence");
  // Food never overlaps the snake.
  const occupied = new Set(state.snake.map((p) => `${p.x},${p.y}`));
  assert.equal(state.foods.some((f) => occupied.has(`${f.x},${f.y}`)), false);
});

test("mastery score fills even boards and leaves one tile on odd boards", () => {
  assert.equal(snake.masteryScore({ columns: 4, rows: 6 }), 21);
  assert.equal(snake.masteryScore({ columns: 5, rows: 7 }), 31);
});

test("moving forward shifts the body and keeps its length", () => {
  const state = snake.createSnakeMode({ columns: 9, rows: 9 }, { rng: seededRng(2) });
  const before = state.snake.map((p) => ({ ...p }));
  const { alive } = snake.stepSnake(state, { rng: seededRng(2) });
  assert.equal(alive, true);
  assert.equal(state.snake.length, before.length);
  assert.deepEqual(state.snake[0], { x: before[0].x, y: before[0].y - 1 }); // moved up
});

test("hitting a wall with no shield ends the game", () => {
  const state = snake.createSnakeMode({ columns: 5, rows: 5 }, { rng: seededRng(3) });
  state.foods = []; // avoid accidental eats interfering
  let result;
  for (let i = 0; i < 10; i += 1) {
    result = snake.stepSnake(state, { rng: seededRng(3) });
    if (!result.alive) break;
  }
  assert.equal(result.alive, false);
  assert.equal(result.events.some((e) => e.type === "gameOver"), true);
  assert.equal(state.phase, "gameover");
});

test("eating food grows the snake, awards seeds, and speeds up", () => {
  const state = snake.createSnakeMode({ columns: 9, rows: 9 }, {
    rng: seededRng(4),
    upgrades: { foodTypeLevel: 2, foodCountLevel: 0, shieldLevel: 0 } // value 3
  });
  // Place a single food directly ahead of the head (one cell up).
  const head = state.snake[0];
  state.foods = [{ x: head.x, y: head.y - 1 }];
  const startLen = state.snake.length;
  const startingTickMs = state.tickMs;
  const { events } = snake.stepSnake(state, { rng: seededRng(4) });

  assert.equal(state.snake.length, startLen + 1, "snake grew");
  assert.equal(state.score, 1);
  assert.equal(state.seeds, 3, "food value 3 awarded");
  assert.ok(state.tickMs < startingTickMs, "sped up");
  const eat = events.find((e) => e.type === "eat");
  assert.ok(eat && eat.value === 3);
  // A replacement food was spawned to keep foodCount satisfied.
  assert.equal(state.foods.length, 1);
});

test("a crowded board reduces seed slots instead of ending the run", () => {
  const state = snake.createSnakeMode({ columns: 3, rows: 3 }, {
    rng: seededRng(8), upgrades: { foodTypeLevel: 0, foodCountLevel: 2, shieldLevel: 0 }
  });
  state.snake = [
    { x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 },
    { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }
  ];
  state.foods = [{ x: 1, y: 0, kind: "seed" }];
  state.direction = "up";

  const result = snake.stepSnake(state, { rng: seededRng(8) });

  assert.equal(result.alive, true);
  assert.equal(state.snake.length, 8);
  assert.equal(snake.seedFoodCount(state), 1);
});

test("the run ends at the parity-aware mastery score", () => {
  const state = snake.createSnakeMode({ columns: 3, rows: 3 }, {
    rng: seededRng(9), upgrades: { foodTypeLevel: 0, foodCountLevel: 2, shieldLevel: 0 }
  });
  state.snake = [
    { x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 },
    { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }
  ];
  state.foods = [{ x: 1, y: 0, kind: "seed" }];
  state.direction = "up";
  state.score = snake.masteryScore(state.grid) - 1;

  const result = snake.stepSnake(state, { rng: seededRng(9) });

  assert.equal(result.alive, false);
  assert.equal(state.score, snake.masteryScore(state.grid));
  assert.equal(result.events.some((event) => event.type === "win"), true);
});

test("egg boards can spawn egg pickups alongside seeds, and egg pickups do not award seeds", () => {
  const state = snake.createSnakeMode({ columns: 9, rows: 9 }, { rng: () => 0, eggBoard: true });
  assert.equal(state.foods.some((food) => food.kind === "egg"), true);

  const head = state.snake[0];
  state.foods = [{ x: head.x, y: head.y - 1, kind: "egg" }, { x: 0, y: 0, kind: "seed" }];
  const seedsBefore = state.seeds;
  const scoreBefore = state.score;
  const { events } = snake.stepSnake(state, { rng: () => 0.99 });
  assert.equal(events.some((item) => item.type === "eggCollected"), true);
  assert.equal(state.seeds, seedsBefore);
  assert.equal(state.score, scoreBefore);
});

test("shield redirects around a fatal wall instead of dying", () => {
  const state = snake.createSnakeMode({ columns: 7, rows: 7 }, { rng: seededRng(5) });
  state.foods = [];
  // Drive the snake to the top wall.
  state.snake = [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }];
  state.direction = "up";
  state.nextDirection = "up";
  state.directionQueue = [];
  state.upgrades.shieldLevel = 1;

  const { alive, events } = snake.stepSnake(state, { rng: seededRng(5) });
  assert.equal(alive, true, "survived via shield");
  assert.equal(events.some((e) => e.type === "shield"), true);
  assert.equal(state.upgrades.shieldLevel, 0, "shield consumed");
  assert.notEqual(state.direction, "up", "turned away from the wall");
});

test("queueDirection rejects reversals and respects the queue cap", () => {
  const state = snake.createSnakeMode({ columns: 9, rows: 9 }, { rng: seededRng(6) });
  // Facing up; reversing to down is rejected.
  assert.equal(snake.queueDirection(state, "down"), false);
  assert.equal(snake.queueDirection(state, "left"), true);
  // Cap at 2 queued (maxQueuedDirections).
  snake.queueDirection(state, "up");
  const beforeLen = state.directionQueue.length;
  snake.queueDirection(state, "left");
  assert.ok(state.directionQueue.length <= 2, `queue len ${state.directionQueue.length}`);
  assert.ok(beforeLen <= 2);
});

test("stepSnake runs headless with no DOM present", () => {
  assert.equal(typeof document, "undefined");
  const state = snake.createSnakeMode({ columns: 11, rows: 11 }, { rng: seededRng(7) });
  assert.doesNotThrow(() => {
    for (let i = 0; i < 5; i += 1) snake.stepSnake(state, { rng: seededRng(7) });
  });
});
