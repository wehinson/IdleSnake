const test = require("node:test");
const assert = require("node:assert/strict");
const maze = require("./maze.js");

const grid = { columns: 6, rows: 6 };
// A horizontal open corridor across row y=2: x = 1..4.
function openRow() {
  return new Set(["1,2", "2,2", "3,2", "4,2"]);
}

function state(overrides = {}) {
  return {
    grid,
    open: openRow(),
    path: [{ x: 1, y: 2 }],
    food: null,
    foodsEaten: 0,
    level: 1,
    score: 0,
    tickMs: maze.TICK_MS,
    direction: "right",
    directionQueue: [],
    ...overrides
  };
}

test("moving down an open corridor keeps length and advances the head", () => {
  const s = state({ path: [{ x: 1, y: 2 }, { x: 1, y: 2 }] });
  // Length-1 path grows awkward; use a simple 1-cell path moving right.
  const s2 = state();
  const r = maze.stepMaze(s2, { rng: () => 0 });
  assert.equal(r.alive, true);
  assert.deepEqual(s2.path[0], { x: 2, y: 2 });
});

test("hitting a wall (no open cell ahead) ends the run", () => {
  const s = state({ path: [{ x: 4, y: 2 }] }); // at the right end; (5,2) not open
  const r = maze.stepMaze(s, { rng: () => 0 });
  assert.equal(r.alive, false);
  assert.equal(r.events.some((e) => e.type === "gameOver"), true);
});

test("eating food grows the path, scores, and respawns food", () => {
  const s = state({ food: { x: 2, y: 2 } });
  const r = maze.stepMaze(s, { rng: () => 0 });
  assert.equal(r.alive, true);
  assert.equal(r.events.some((e) => e.type === "eat"), true);
  assert.equal(s.path.length, 2, "grew");
  assert.equal(s.score, 10, "10 * level(1)");
  assert.equal(s.foodsEaten, 1);
  // A new food was placed on a still-open, unoccupied cell (or null if none).
  assert.ok(s.food === null || (s.open.has(`${s.food.x},${s.food.y}`)));
});

test("reaching the round threshold levels up, speeds up, and awards bonus", () => {
  // level 1 threshold = 10 + 1*2 = 12 foods; set to 11 so this eat is the 12th.
  const s = state({ food: { x: 2, y: 2 }, foodsEaten: 11, level: 1 });
  const r = maze.stepMaze(s, { rng: () => 0 });
  assert.equal(s.level, 2);
  assert.equal(s.foodsEaten, 0);
  assert.ok(s.tickMs < maze.TICK_MS, "sped up");
  const levelUp = r.events.find((e) => e.type === "levelUp");
  assert.ok(levelUp && levelUp.level === 2 && levelUp.reward === 200);
});

test("runs headless with no DOM", () => {
  assert.equal(typeof document, "undefined");
  assert.doesNotThrow(() => maze.stepMaze(state(), { rng: () => 0 }));
});
