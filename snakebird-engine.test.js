const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./snakebird-engine.js");

test("parses level dimensions, body, fruit, and exit", () => {
  const state = engine.parseLevel([
    ".....",
    "..F..",
    "..G..",
    "..Hoo",
    "#####"
  ]);

  assert.equal(state.width, 5);
  assert.equal(state.height, 5);
  assert.deepEqual(state.body, [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }]);
  assert.equal(state.fruits.has("2,1"), true);
  assert.deepEqual(state.exit, { x: 2, y: 2 });
  assert.equal(state.solids.size, 5);
});

test("moves the body and blocks solid or self-colliding moves", () => {
  const state = engine.parseLevel([
    ".....",
    ".....",
    ".....",
    "..Hoo",
    "#####"
  ]);

  const moved = engine.applyMove(state, "left");
  assert.equal(moved.accepted, true);
  assert.deepEqual(moved.state.body, [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }]);
  assert.equal(moved.state.moves, 1);

  const blocked = engine.applyMove(moved.state, "down");
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.state.moves, 1);
});

test("eating fruit grows the snake", () => {
  const state = engine.parseLevel([
    ".....",
    ".....",
    ".....",
    "..HF.",
    "#####"
  ]);

  const fruitMove = engine.applyMove(state, "right");
  assert.equal(fruitMove.accepted, true);
  assert.equal(fruitMove.ateFruit, true);
  assert.equal(fruitMove.state.body.length, 2);
  assert.equal(fruitMove.state.fruits.size, 0);
});

test("gravity settles on platforms and reports a fall off the board", () => {
  const platformState = engine.parseLevel([
    ".....",
    "..H..",
    ".....",
    ".....",
    "#####"
  ]);
  const settled = engine.applyMove(platformState, "left");
  assert.equal(settled.fell, false);
  assert.deepEqual(settled.state.body[0], { x: 1, y: 3 });

  const fallingState = engine.parseLevel([
    ".....",
    "..H..",
    ".....",
    "....."
  ]);
  const falling = engine.applyMove(fallingState, "left");
  assert.equal(falling.accepted, true);
  assert.equal(falling.fell, true);
});

test("exit completion requires the fruit set to be empty", () => {
  const state = engine.parseLevel([
    ".....",
    "..F..",
    "..G..",
    "..H..",
    "#####"
  ]);

  assert.equal(engine.isComplete(state), false);
  const cleared = {
    ...state,
    body: [{ x: 2, y: 2 }],
    fruits: new Set()
  };
  assert.equal(engine.isComplete(cleared), true);
});

test("normalizes malformed progress and unlocks only sequentially", () => {
  const progress = engine.normalizeProgress({
    unlockedLevel: 5,
    clearedLevels: [true, false, true, true, false],
    bestMoves: [12, "bad", 0, 8.9, -1],
    lastSelectedLevel: 5
  }, 5);

  assert.equal(progress.unlockedLevel, 2);
  assert.deepEqual(progress.clearedLevels, [true, false, true, true, false]);
  assert.deepEqual(progress.bestMoves, [12, null, null, 8, null]);
  assert.equal(progress.lastSelectedLevel, 2);
  assert.deepEqual(engine.normalizeProgress(null, 5), {
    unlockedLevel: 1,
    clearedLevels: [false, false, false, false, false],
    bestMoves: [null, null, null, null, null],
    lastSelectedLevel: 1
  });
});

test("awards first-clear and replay rewards while preserving best moves", () => {
  const first = engine.recordCompletion({
    clearedLevels: [false, false, false, false, false],
    bestMoves: [null, null, null, null, null],
    lastSelectedLevel: 1
  }, 0, 18, 5, 20, 5);

  assert.equal(first.firstClear, true);
  assert.equal(first.reward, 20);
  assert.equal(first.progress.unlockedLevel, 2);
  assert.equal(first.progress.bestMoves[0], 18);

  const replay = engine.recordCompletion(first.progress, 0, 24, 5, 20, 5);
  assert.equal(replay.firstClear, false);
  assert.equal(replay.reward, 5);
  assert.equal(replay.progress.bestMoves[0], 18);

  const improved = engine.recordCompletion(replay.progress, 0, 12, 5, 20, 5);
  assert.equal(improved.progress.bestMoves[0], 12);
});
