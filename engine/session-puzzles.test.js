const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const { runHeadless } = require("./simulate.js");
const levels = require("./puzzle-levels.js");
const snakebird = require("../snakebird-engine.js");
const sokoban = require("./sokoban.js");
const firstPush = ["right", "right", "right", "up", "up", "up", "up", "right", "right", "right", "right"];

test("all shipped puzzle levels load through the session with unchanged content", () => {
  const game = createGameSession({ now: 0 });
  for (const mode of ["snakebird", "sokoban"]) {
    levels[mode].forEach((definition, levelIndex) => {
      const { active } = game.dispatch({ type: "selectPuzzleLevel", mode, levelIndex }).snapshot;
      assert.deepEqual(active.definition, definition);
      if (mode === "snakebird") {
        const parsed = snakebird.parseLevel(definition.map);
        assert.deepEqual(active.body, parsed.body);
        assert.deepEqual(active.fruits, [...parsed.fruits]);
        assert.equal(active.levelCount, levels.snakebird.length);
      } else {
        const parsed = sokoban.parseLevel(definition, { columns: 15, rows: 15 }, levelIndex);
        assert.deepEqual(active.snake, parsed.snake);
        assert.deepEqual(active.crates, parsed.crates);
        assert.deepEqual(active.walls, [...parsed.walls]);
      }
    });
  }
});

test("puzzle selection rejects invalid actions without changing the session", () => {
  const game = createGameSession({ now: 0 });
  const before = game.snapshot();
  for (const action of [
    { type: "launchPuzzle", mode: "toString" },
    { type: "continuePuzzle" },
    ...[-1, 5, 0.5, NaN].map(levelIndex => ({ type: "selectPuzzleLevel", mode: "snakebird", levelIndex }))
  ]) {
    const result = game.dispatch(action);
    assert.ok(result.events.some(e => e.type === "actionRejected"));
    assert.deepEqual(result.snapshot, before);
  }
});

test("Snakebird selection uses injected randomness and excludes an immediate repeat across modes", () => {
  const sequence = () => {
    const game = createGameSession({ now: 0, rng: () => 0 });
    const chosen = [];
    for (let i = 0; i < 10; i++) {
      chosen.push(game.dispatch({ type: "launchPuzzle", mode: "snakebird" }).snapshot.active.levelIndex);
      game.dispatch({ type: "selectMode", mode: "snake" });
    }
    return chosen;
  };
  const chosen = sequence();
  assert.deepEqual(chosen, sequence());
  chosen.slice(1).forEach((value, i) => assert.notEqual(value, chosen[i]));
});

test("puzzle restart preserves the current board and clears moves", () => {
  for (const mode of ["snakebird", "sokoban"]) {
    const game = createGameSession({ now: 0 });
    const initial = game.dispatch({ type: "selectPuzzleLevel", mode, levelIndex: 2 }).snapshot.active;
    game.dispatch({ type: "direction", direction: mode === "snakebird" ? "left" : "down" });
    assert.deepEqual(game.dispatch({ type: "restart" }).snapshot.active, initial);
    game.dispatch({ type: "direction", direction: mode === "snakebird" ? "left" : "down" });
    assert.deepEqual(game.dispatch({ type: "continuePuzzle" }).snapshot.active, initial);
  }
});

test("headless shipped Sokoban completion pays once, persists records, and advances the level", () => {
  const game = createGameSession({ now: 0 });
  game.dispatch({ type: "launchPuzzle", mode: "sokoban" });
  const result = runHeadless(game, {
    steps: 100, controller: (_, i) => ({ type: "direction", direction: firstPush[i] })
  });
  assert.equal(result.ended, true);
  assert.equal(result.steps, firstPush.length);
  assert.equal(result.snapshot.phase, "gameover");
  assert.equal(result.snapshot.seeds, levels.sokoban[0].reward);
  assert.equal(result.events.filter(e => e.type === "runEnded").length, 1);
  game.dispatch({ type: "direction", direction: "right" });
  assert.equal(game.snapshot().seeds, result.snapshot.seeds);
  const restored = createGameSession({ now: 0, save: game.serialize() }).snapshot();
  assert.equal(restored.records.sokobanBest, result.snapshot.records.sokobanBest);
  assert.equal(game.dispatch({ type: "continuePuzzle" }).snapshot.active.stageIndex, 1);
  game.dispatch({ type: "selectMode", mode: "snake" });
  assert.equal(game.dispatch({ type: "launchPuzzle", mode: "sokoban" }).snapshot.active.stageIndex, 1);
});

test("Snakebird input completion stops headless ticks, preserves rewards and progress, and selects another level", () => {
  const game = createGameSession({ now: 0, rng: () => 0 });
  const definition = { firstClearReward: 20, replayReward: 5, map: ["....", "HG..", "####"] };
  game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition, levelIndex: 0, levelCount: 5 } });
  const driver = () => runHeadless(game, { steps: 10, controller: () => ({ type: "direction", direction: "right" }) });
  const first = driver();
  assert.equal(first.ended, true);
  assert.equal(first.steps, 1);
  assert.equal(first.snapshot.seeds, 20);
  assert.equal(game.serialize().savedAt, 0, "no clock update after the winning action");
  game.dispatch({ type: "restart" });
  const replay = driver();
  assert.equal(replay.snapshot.seeds, 25);
  assert.equal(replay.snapshot.snakebirdProgress.bestMoves[0], 1);
  assert.deepEqual(createGameSession({ now: 0, save: game.serialize() }).snapshot().snakebirdProgress, replay.snapshot.snakebirdProgress);
  const next = game.dispatch({ type: "continuePuzzle" }).snapshot;
  assert.notEqual(next.active.levelIndex, 0);
  assert.deepEqual(next.active.definition, levels.snakebird[next.active.levelIndex]);
});

test("Sokoban final-level completion wraps to the first shipped level", () => {
  const game = createGameSession({ now: 0 });
  const definition = { reward: 1, map: ["#####", "#...#", "#####"], snake: [{ x: 1, y: 1 }], crates: [{ x: 2, y: 1, kind: "light" }], goals: [{ x: 3, y: 1 }], pellets: [], plates: [], gates: [] };
  game.dispatch({ type: "selectMode", mode: "sokoban", setup: { definition, levelIndex: 4 } });
  assert.equal(game.dispatch({ type: "direction", direction: "right" }).snapshot.phase, "gameover");
  const next = game.dispatch({ type: "continuePuzzle" }).snapshot;
  assert.equal(next.active.stageIndex, 0);
  assert.deepEqual(next.active.definition, levels.sokoban[0]);
});

test("puzzle snapshots reuse only immutable definition data and remain isolated", () => {
  const game = createGameSession({ now: 0 });
  const first = game.dispatch({ type: "selectPuzzleLevel", mode: "sokoban", levelIndex: 0 }).snapshot;
  const second = game.snapshot();

  assert.notEqual(first.active, second.active);
  assert.equal(first.active.definition, second.active.definition);
  assert.equal(first.active.walls, second.active.walls);
  assert.equal(Object.isFrozen(first.active.definition), true);
  assert.equal(Object.isFrozen(first.active.walls), true);

  const firstSnake = first.active.snake.map((point) => ({ ...point }));
  game.dispatch({ type: "direction", direction: "up" });
  assert.deepEqual(first.active.snake, firstSnake);
  assert.deepEqual(first.active.walls, second.active.walls);
});
