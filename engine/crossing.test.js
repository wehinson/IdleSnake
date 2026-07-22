const test = require("node:test");
const assert = require("node:assert/strict");
const crossing = require("./crossing.js");

const grid = { columns: 5, rows: 4 };
function baseState(overrides = {}) {
  return {
    grid,
    snake: [{ x: 2, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 3 }],
    cars: [],
    score: 0,
    stage: 1,
    snakeLength: 3,
    entryColumn: 2,
    direction: "up",
    nextDirection: "up",
    directionQueue: [],
    ...overrides
  };
}

test("updateCars advances and wraps car positions", () => {
  const s = baseState({ cars: [{ row: 1, x: 4, width: 2, speed: 1 }] });
  crossing.updateCars(s);
  assert.equal(s.cars[0].x, 0, "wrapped from 4->0 on a width-5 board");
});

test("isCarHit detects a car overlapping the snake on its row", () => {
  const s = baseState({ snake: [{ x: 1, y: 1 }], cars: [{ row: 1, x: 0, width: 2, speed: 0 }] });
  assert.equal(crossing.isCarHit(s), true);
  const miss = baseState({ snake: [{ x: 4, y: 1 }], cars: [{ row: 1, x: 0, width: 2, speed: 0 }] });
  assert.equal(crossing.isCarHit(miss), false);
});

test("stepping into a car ends the run", () => {
  const s = baseState({ snake: [{ x: 2, y: 2 }], cars: [{ row: 1, x: 2, width: 1, speed: 0 }], directionQueue: ["up"] });
  const r = crossing.stepCrossing(s);
  assert.equal(r.alive, false);
  assert.equal(r.events.some((e) => e.type === "carHit"), true);
});

test("no queued direction idles without moving", () => {
  const s = baseState();
  const before = JSON.stringify(s.snake);
  const r = crossing.stepCrossing(s);
  assert.equal(r.events[0].type, "idle");
  assert.equal(JSON.stringify(s.snake), before);
});

test("a move into a wall is blocked (snake stays put)", () => {
  const s = baseState({ snake: [{ x: 0, y: 2 }], directionQueue: ["left"] });
  const r = crossing.stepCrossing(s);
  assert.equal(r.events.some((e) => e.type === "wall"), true);
  assert.deepEqual(s.snake[0], { x: 0, y: 2 });
});

test("reaching the top bank (y=0) clears the stage, grows, and rewards", () => {
  const s = baseState({ snake: [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }], directionQueue: ["up"], stage: 2 });
  const r = crossing.stepCrossing(s);
  assert.equal(r.alive, true);
  const clear = r.events.find((e) => e.type === "stageClear");
  assert.ok(clear, "stageClear fired");
  assert.equal(clear.reward, 10 + 2 * 5);   // 20
  assert.equal(s.score, 2 * 100);           // 200
  assert.equal(s.snakeLength, 4, "grew by one on clear");
});

test("buildEntrySnake deliberately stages the complete body below the bottom bank", () => {
  assert.deepEqual(crossing.buildEntrySnake(grid, 2, 4), [
    { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 2, y: 6 }
  ]);
});

test("runs headless with no DOM", () => {
  assert.equal(typeof document, "undefined");
  assert.doesNotThrow(() => crossing.stepCrossing(baseState({ directionQueue: ["up"] })));
});
