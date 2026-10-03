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
  const state = snake.createSnakeMode({ columns: 11, rows: 11 }, {
    rng: seededRng(1),
    upgrades: { foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0 }
  });
  assert.equal(state.snake.length, 3);
  assert.equal(state.foods.length, 1); // baseCount 1 + level 0
  assert.equal(state.direction, "up");
  const smallest = snake.createSnakeMode({ columns: 5, rows: 8 }, { rng: seededRng(1) });
  assert.ok(state.tickMs < smallest.tickMs, "11x11 starts faster than the smallest board");
  // Food never overlaps the snake.
  const occupied = new Set(state.snake.map((p) => `${p.x},${p.y}`));
  assert.equal(state.foods.some((f) => occupied.has(`${f.x},${f.y}`)), false);
});

test("additional food is weighted away from existing Seeds", () => {
  const foods = [{ x: 4, y: 4, kind: "seed" }];
  assert.equal(snake.foodPlacementWeight(foods, { x: 3, y: 3 }), 0.1, "diagonal neighbors use the adjacent weight");
  assert.equal(snake.foodPlacementWeight(foods, { x: 4, y: 3 }), 0.1, "orthogonal neighbors use the adjacent weight");
  assert.equal(snake.foodPlacementWeight(foods, { x: 2, y: 4 }), 0.2, "the outer 5x5 ring uses the perimeter weight");
  assert.equal(snake.foodPlacementWeight(foods, { x: 6, y: 6 }), 0.2, "5x5 corners use the perimeter weight");
  assert.equal(snake.foodPlacementWeight(foods, { x: 1, y: 4 }), 1, "distant cells retain full weight");
});

test("the nearest existing Seed determines the strongest food spacing penalty", () => {
  const foods = [
    { x: 2, y: 2, kind: "seed" },
    { x: 5, y: 5, kind: "seed" },
    { x: 3, y: 3, kind: "egg" }
  ];
  assert.equal(snake.foodPlacementWeight(foods, { x: 4, y: 4 }), 0.1);
  assert.equal(snake.foodPlacementWeight([{ x: 3, y: 3, kind: "egg" }], { x: 4, y: 4 }), 1, "eggs do not affect Seed spacing");
});

test("weighted placement uses the configured relative probabilities", () => {
  const state = {
    grid: { columns: 7, rows: 1 },
    snake: [{ x: 0, y: 0 }],
    foods: [{ x: 3, y: 0, kind: "seed" }]
  };
  // Open cells in scan order have weights 0.2, 0.1, 0.1, 0.2, and 1.
  assert.deepEqual(snake.placeFood(state, () => 0), { x: 1, y: 0 });
  assert.deepEqual(snake.placeFood(state, () => 0.21 / 1.6), { x: 2, y: 0 });
  assert.deepEqual(snake.placeFood(state, () => 0.31 / 1.6), { x: 4, y: 0 });
  assert.deepEqual(snake.placeFood(state, () => 0.41 / 1.6), { x: 5, y: 0 });
  assert.deepEqual(snake.placeFood(state, () => 0.61 / 1.6), { x: 6, y: 0 });
});

test("spacing weights never prevent food from spawning on a nearly full board", () => {
  const state = {
    grid: { columns: 3, rows: 3 },
    snake: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 0, y: 1 }, { x: 2, y: 1 },
      { x: 0, y: 2 }, { x: 1, y: 2 }
    ],
    foods: [{ x: 2, y: 2, kind: "seed" }]
  };
  assert.deepEqual(snake.placeFood(state, () => 0.999999), { x: 1, y: 1 });
  assert.equal(snake.spawnSeed(state, () => 0.5), true);
  assert.deepEqual(state.foods.at(-1), { x: 1, y: 1, kind: "seed" });
});

test("board speed increases preserve food acceleration and scale the maximum speed", () => {
  const { upgradeConfig, snakeConfig } = require("./config.js");
  const expected = upgradeConfig.board.levels.map((_, level) =>
    snakeConfig.startTickMs / (1 + level * snakeConfig.boardSpeedIncreasePerLevel));
  upgradeConfig.board.levels.forEach((size, index) => {
    const [columns, rows] = size.split("x").map(Number);
    const state = snake.createSnakeMode({ columns, rows }, { rng: seededRng(42) });
    assert.ok(Math.abs(state.tickMs - expected[index]) < 1e-9);
    const feed = () => {
      const head = state.snake[0];
      state.foods = [{ x: head.x, y: head.y - 1 }];
      return snake.stepSnake(state, { rng: seededRng(42) });
    };
    feed();
    assert.ok(state.tickMs < expected[index]);
    assert.ok(snake.accelerationProgress(state.score, snake.masteryScore(state.grid)) > 0,
      "the first food increases speed on every board");
    state.score = snake.masteryScore(state.grid);
    feed();
    assert.ok(Math.abs(state.tickMs - expected[index] / 3) < 1e-9);
  });
});

test("custom starting speed remains the baseline after eating", () => {
  const state = snake.createSnakeMode({ columns: 9, rows: 9 }, { tickMs: 200, rng: seededRng(42) });
  state.foods = [{ x: state.snake[0].x, y: state.snake[0].y - 1 }];
  snake.stepSnake(state, { rng: seededRng(42) });
  assert.ok(state.tickMs < 200 && state.tickMs > 190);
  assert.equal(state.initialTickMs, 200);
});

test("mastery score fills the complete area on odd and even boards", () => {
  assert.equal(snake.masteryScore({ columns: 4, rows: 6 }), 21);
  assert.equal(snake.masteryScore({ columns: 5, rows: 7 }), 32);
  assert.equal(snake.masteryScore({ columns: 8, rows: 11 }, 5), 83);
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

  assert.equal(state.snake.length, startLen + 1, "the tail extends on the eating move");
  assert.equal(state.score, 1);
  assert.equal(state.seeds, 3, "food value 3 awarded");
  assert.ok(state.tickMs < startingTickMs, "sped up");
  const eat = events.find((e) => e.type === "eat");
  assert.ok(eat && eat.value === 3);
  // A replacement food was spawned to keep foodCount satisfied.
  assert.equal(state.foods.length, 1);

  state.foods = [];
  snake.stepSnake(state, { rng: seededRng(4) });
  assert.equal(state.snake.length, startLen + 1, "the next move does not apply deferred growth");
});

test("rapid apples grow immediately on every eating move", () => {
  const state = snake.createSnakeMode({ columns: 20, rows: 3 }, {
    rng: seededRng(10),
    snake: [{ x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
    direction: "right"
  });
  const startingLength = state.snake.length;
  const tailPositions = [];

  for (let tick = 0; tick < 4; tick += 1) {
    const head = state.snake[0];
    state.foods = [{ x: head.x + 1, y: head.y, kind: "seed" }];
    snake.stepSnake(state, { rng: seededRng(10 + tick) });
    tailPositions.push({ ...state.snake.at(-1) });
  }

  assert.deepEqual(tailPositions, [
    { x: 1, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 1 }
  ]);
  assert.equal(state.score, 4);
  assert.equal(state.snake.length, startingLength + 4);

  const lengths = [];
  for (let tick = 0; tick < 4; tick += 1) {
    state.foods = [];
    snake.stepSnake(state, { rng: seededRng(20 + tick) });
    lengths.push(state.snake.length);
  }
  assert.deepEqual(lengths, Array(4).fill(startingLength + 4));
});

test("a normal move can enter the cell vacated by the tail", () => {
  const state = snake.createSnakeMode({ columns: 4, rows: 4 }, { rng: seededRng(11) });
  state.snake = [
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 0, y: 2 },
    { x: 0, y: 1 }
  ];
  state.direction = "left";
  state.nextDirection = "left";
  state.foods = [];

  const normalMove = snake.stepSnake({ ...state, snake: state.snake.map((part) => ({ ...part })) }, { rng: seededRng(11) });
  assert.equal(normalMove.alive, true, "the vacating tail cell is open on a normal move");
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
  assert.equal(state.snake.length, 8, "food extends the tail on the eating move");
  assert.equal(snake.seedFoodCount(state), 1);
});

test("the run ends when the snake fills the complete board", () => {
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

test("shield impact waits three ticks before redirecting around a fatal wall", () => {
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
  assert.equal(state.direction, "up", "impact begins against the wall");
  assert.deepEqual(state.snake[0], { x: 3, y: 0 }, "impact does not move the body");
  assert.equal(state.shieldImpact.ticksRemaining, 3);
  for (let tick = 2; tick > 0; tick -= 1) {
    const impact = snake.stepSnake(state, { rng: seededRng(5) });
    assert.equal(impact.events[0].type, "shieldImpactTick");
    assert.equal(state.shieldImpact.ticksRemaining, tick);
    assert.deepEqual(state.snake[0], { x: 3, y: 0 });
  }
  const redirected = snake.stepSnake(state, { rng: seededRng(5) });
  assert.equal(redirected.events[0].type, "shieldRedirected");
  assert.equal(state.shieldImpact, null);
  assert.notEqual(state.direction, "up", "turned away from the wall");
  assert.deepEqual(state.snake[0], { x: 2, y: 0 });
});

test("queueDirection rejects reversals and respects the queue cap", () => {
  const state = snake.createSnakeMode({ columns: 9, rows: 9 }, { rng: seededRng(6) });
  // Facing up; reversing to down is rejected.
  assert.equal(snake.queueDirection(state, "down"), false);
  assert.equal(snake.queueDirection(state, "left"), true);
  // Cap at three queued turns without dropping earlier input.
  snake.queueDirection(state, "up");
  const beforeLen = state.directionQueue.length;
  snake.queueDirection(state, "left");
  assert.ok(state.directionQueue.length <= 3, `queue len ${state.directionQueue.length}`);
  assert.ok(beforeLen <= 3);
  const before = [...state.directionQueue];
  assert.equal(snake.queueDirection(state, "down"), false);
  assert.deepEqual(state.directionQueue, before);
});

test("stepSnake runs headless with no DOM present", () => {
  assert.equal(typeof document, "undefined");
  const state = snake.createSnakeMode({ columns: 11, rows: 11 }, { rng: seededRng(7) });
  assert.doesNotThrow(() => {
    for (let i = 0; i < 5; i += 1) snake.stepSnake(state, { rng: seededRng(7) });
  });
});
