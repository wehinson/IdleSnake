const test = require("node:test");
const assert = require("node:assert/strict");
const sokoban = require("./sokoban.js");

const grid = { columns: 5, rows: 5 };
// A tiny room: push the crate at (2,2) one cell right onto the goal at (3,2).
function level() {
  return {
    map: ["#####", "#...#", "#...#", "#...#", "#####"],
    snake: [{ x: 1, y: 2 }, { x: 1, y: 1 }],
    crates: [{ x: 2, y: 2 }],
    goals: [{ x: 3, y: 2 }],
    plates: [],
    gates: [],
    pellets: [{ x: 1, y: 3 }],
    reward: 100
  };
}

test("parseLevel builds walls set, snake, crates, goals and totalPellets", () => {
  const state = sokoban.parseLevel(level(), grid, 0);
  assert.equal(state.width, 5);
  assert.equal(state.walls.has("0,0"), true);
  assert.equal(state.walls.has("2,2"), false);
  assert.deepEqual(state.snake, [{ x: 1, y: 2 }, { x: 1, y: 1 }]);
  assert.equal(state.totalPellets, 1);
  assert.equal(state.result, null);
});

test("pushing the crate onto the goal wins the stage", () => {
  const state = sokoban.parseLevel(level(), grid, 0);
  const result = sokoban.applyMove(state, "right");
  assert.equal(result.accepted, true);
  assert.equal(result.won, true);
  assert.deepEqual(state.crates[0], { x: 3, y: 2 });
  assert.deepEqual(state.snake[0], { x: 2, y: 2 });
  assert.equal(result.events.some((e) => e.type === "crate"), true);
  assert.equal(result.events.some((e) => e.type === "win"), true);
  assert.equal(state.score >= 100, true);
});

test("a move into a wall is rejected and leaves state untouched", () => {
  const state = sokoban.parseLevel(level(), grid, 0);
  const snakeBefore = JSON.stringify(state.snake);
  const result = sokoban.applyMove(state, "left"); // (1,2) -> (0,2) is a wall
  assert.equal(result.accepted, false);
  assert.equal(state.moves, 0);
  assert.equal(JSON.stringify(state.snake), snakeBefore);
});

test("eating a pellet grows the snake", () => {
  const state = sokoban.parseLevel(level(), grid, 0);
  const result = sokoban.applyMove(state, "down"); // (1,2) -> (1,3) has a pellet
  assert.equal(result.accepted, true);
  assert.equal(result.events.some((e) => e.type === "pellet"), true);
  assert.equal(state.snake.length, 3, "grew by one");
  assert.equal(state.pellets.length, 0);
});

test("a crate can't be pushed into a wall", () => {
  // Crate directly left of the wall so pushing left is blocked.
  const def = level();
  def.snake = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
  def.crates = [{ x: 1, y: 2 }];
  def.goals = [{ x: 1, y: 2 }];
  def.pellets = [];
  const state = sokoban.parseLevel(def, grid, 0);
  const result = sokoban.applyMove(state, "left"); // would push crate (1,2)->(0,2)=wall
  assert.equal(result.accepted, false);
});

test("heavy crates need a braced snake of length >= 5", () => {
  const def = level();
  // Snake length 2, not braced -> heavy crate won't budge.
  def.snake = [{ x: 1, y: 2 }, { x: 1, y: 1 }];
  def.crates = [{ x: 2, y: 2, kind: "heavy" }];
  def.goals = [{ x: 3, y: 2 }];
  def.pellets = [];
  const state = sokoban.parseLevel(def, grid, 0);
  assert.equal(sokoban.applyMove(state, "right").accepted, false);
});

test("runs headless with no DOM", () => {
  assert.equal(typeof document, "undefined");
  const state = sokoban.parseLevel(level(), grid, 0);
  assert.doesNotThrow(() => sokoban.applyMove(state, "right"));
});
