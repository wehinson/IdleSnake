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

test("reachable growth push cannot place a crate on the retained tail; non-growing control can", () => {
  const definition = {
    map: ["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#######"],
    snake: [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }],
    crates: [{ x: 2, y: 2, kind: "light" }], goals: [{ x: 5, y: 4 }],
    pellets: [{ x: 3, y: 2 }, { x: 2, y: 1 }, { x: 4, y: 1 }], plates: [], gates: []
  };
  const state = sokoban.parseLevel(definition, { columns: 7, rows: 6 }, 0);
  const directions = { R: "right", U: "up", D: "down", L: "left" };
  // Before the fix RURRDDLLUR was accepted and overlapped crate/tail at (4,2).
  for (const move of "RURRDDLLU") assert.equal(sokoban.applyMove(state, directions[move]).accepted, true);
  assert.deepEqual(state.snake.at(-1), { x: 4, y: 2 });
  const before = structuredClone(state);
  assert.equal(sokoban.applyMove(state, "right").accepted, false);
  assert.deepEqual(state, before, "illegal growth leaves every state field untouched");
  state.pellets = [];
  const control = sokoban.applyMove(state, "right");
  assert.equal(control.accepted, true, "without growth the tail vacates the crate destination");
  assert.deepEqual(state.crates[0], { x: 4, y: 2, kind: "light" });
  assert.equal(sokoban.snakeContains(state, state.crates[0]), false);
});

test("growth cannot move the head onto a retained tail; a moving tail remains legal", () => {
  const definition = level();
  definition.snake = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }];
  definition.pellets = [{ x: 1, y: 2 }];
  definition.crates = [{ x: 3, y: 3, kind: "light" }];
  const state = sokoban.parseLevel(definition, grid, 0);
  const before = structuredClone(state);
  assert.equal(sokoban.applyMove(state, "down").accepted, false);
  assert.deepEqual(state, before);
  state.pellets = [];
  assert.equal(sokoban.applyMove(state, "down").accepted, true);
  assert.equal(new Set(state.snake.map(sokoban.key)).size, state.snake.length);
});

test("gates check plates before movement, permit occupant departure after closure, and block closed entry", () => {
  const definition = {
    map: ["#######", "#.....#", "#.....#", "#.....#", "#######"],
    snake: [{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }],
    crates: [{ x: 5, y: 3, kind: "light" }], goals: [{ x: 4, y: 3 }], pellets: [],
    plates: [{ x: 1, y: 2, id: "a" }], gates: [{ x: 4, y: 2, id: "a" }]
  };
  const state = sokoban.parseLevel(definition, { columns: 7, rows: 5 }, 0);
  assert.equal(sokoban.applyMove(state, "right").accepted, true);
  assert.equal(sokoban.plateActive(state, "a"), false);
  assert.equal(sokoban.isOpen(state, state.snake[0]), false, "gate closed around its occupant");
  assert.equal(sokoban.applyMove(state, "right").accepted, true, "occupant can depart");
  const closed = sokoban.parseLevel({ ...definition, plates: [{ x: 1, y: 1, id: "a" }] }, { columns: 7, rows: 5 }, 0);
  const before = structuredClone(closed);
  assert.equal(sokoban.applyMove(closed, "right").accepted, false);
  assert.deepEqual(closed, before);
});
