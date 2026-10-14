const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../snakebird-engine.js");
const { snakebird: levels } = require("./puzzle-levels.js");
const evidence = require("./snakebird-solutions.json");
const { solve, replay, directions } = require("../scripts/solve-snakebird.js");
const { createGameSession } = require("./session.js");

function supportedSegments(state) {
  return state.body.filter(part => state.solids.has(engine.key({ x: part.x, y: part.y + 1 })));
}

test("campaign has exactly15 distinct legal, initially supported boards in increasing solution-length order", () => {
  assert.equal(levels.length, 15);
  assert.equal(evidence.levels.length, 15);
  assert.equal(new Set(levels.map(l => l.name)).size, 15);
  assert.equal(new Set(levels.map(l => l.map.join("\n"))).size, 15);
  for (const [i, level] of levels.entries()) {
    const content = level.map.join("");
    assert.ok(level.map.every(row => row.length === level.map[0].length), level.name);
    assert.match(content, /^[.#FGoH]+$/);
    assert.equal([...content].filter(c => c === "H").length, 1);
    assert.equal([...content].filter(c => c === "G").length, 1);
    const state = engine.parseLevel(level.map);
    assert.ok(state.fruits.size >= 1 && state.fruits.size <= 4);
    assert.ok(supportedSegments(state).length > 0, level.name);
    assert.deepEqual(engine.settleGravity(state).state.body, state.body);
    assert.ok(!engine.isComplete(state));
    for (let j = 1; j < state.body.length; j += 1) {
      const a = state.body[j - 1], b = state.body[j];
      assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 1, level.name);
    }
    assert.equal(evidence.levels[i].level, i + 1);
    assert.equal(evidence.levels[i].name, level.name);
    assert.ok(level.optimalMoves >= (levels[i - 1]?.optimalMoves || 7));
  }
});

for (const [i, level] of levels.entries()) {
  test(`L${i + 1} ${level.name}: shortest solution, fruit growth, support and settled escape`, () => {
    const note = evidence.levels[i];
    const result = solve(level.map);
    assert.equal(result.status, "solved");
    assert.equal(result.moves, level.optimalMoves);
    assert.equal(result.moves, note.optimalMoves);
    const verified = replay(level.map, note.witness);
    assert.equal(verified.complete, true);
    assert.equal(verified.state.moves, result.moves);
    assert.equal(verified.state.fruits.size, 0);
    assert.deepEqual(verified.trace.filter(t => t.ateFruit).map(t => t.fruit), note.fruitOrder);
    assert.deepEqual(verified.trace.filter(t => t.drop > 0).map(t => ({ move: t.move, cells: t.drop })), note.gravityDrops);

    let state = engine.parseLevel(level.map);
    const initialLength = state.body.length, initialFruits = state.fruits.size;
    let tailOnlySupport = false;
    for (const [step, symbol] of [...note.witness].entries()) {
      const before = state;
      const moved = engine.applyMove(state, directions[symbol]);
      assert.equal(moved.accepted, true);
      assert.equal(moved.fell, false);
      state = moved.state;
      assert.equal(state.body.length, before.body.length + (moved.ateFruit ? 1 : 0));
      assert.equal(state.fruits.size, before.fruits.size - (moved.ateFruit ? 1 : 0));
      assert.equal(new Set(state.body.map(engine.key)).size, state.body.length);
      assert.ok(state.body.every(p => p.x >= 0 && p.x < state.width && p.y >= 0 && p.y < state.height && !state.solids.has(engine.key(p))));
      const support = supportedSegments(state);
      assert.ok(support.length > 0);
      if (support.length === 1 && engine.key(support[0]) === engine.key(state.body.at(-1))) tailOnlySupport = true;
      assert.equal(engine.isComplete(state), step === note.witness.length - 1);
    }
    assert.equal(state.body.length, initialLength + initialFruits);
    assert.ok(tailOnlySupport, "a tail anchor is part of every selected solution");
    assert.ok(result.falls > 0, "each board exposes genuine lethal support-loss choices");
  });
}

test("Two Fruit Bridge needs both growth segments, even when collection requirement is relaxed", () => {
  const level = levels[3];
  for (const fruit of engine.parseLevel(level.map).fruits) {
    const map = level.map.map((row, y) => [...row].map((c, x) => engine.key({ x, y }) === fruit ? "." : c).join(""));
    assert.equal(solve(map, { maxDepth: Infinity }).status, "unsolved");
  }
});

test("required fruit orders reject tempting early harvests with exhaustive actual-engine search", () => {
  for (const [index, forbiddenFirst] of [[6, "9,4"], [8, "8,4"], [9, "8,2"], [10, "5,1"], [14, "6,9"]]) {
    assert.equal(solve(levels[index].map, { firstFruit: forbiddenFirst, maxDepth: Infinity }).status, "unsolved", levels[index].name);
  }
});

test("Fold and Climb needs post-descent growth and legally enters its vacating tail twice", () => {
  const map = levels[4].map;
  const witness = evidence.levels[4].witness;
  const beforeFruit = replay(map, witness.slice(0, 7)).state;
  const withoutFruit = { ...beforeFruit, fruits: new Set() };
  assert.equal(solve(map, { initialState: withoutFruit, maxDepth: Infinity }).status, "unsolved");
  let state = replay(map, witness.slice(0, 8)).state;
  for (const symbol of witness.slice(8, 10)) {
    const tail = engine.key(state.body.at(-1));
    assert.equal(engine.applyMove({ ...state, fruits: new Set([tail]) }, directions[symbol]).accepted, false, "growth cannot vacate the tail");
    const moved = engine.applyMove(state, directions[symbol]);
    assert.equal(moved.accepted, true);
    assert.equal(engine.key(moved.state.body[0]), tail);
    state = moved.state;
  }
});

test("gravity neither eats fruit it passes nor wins at an unsupported exit", () => {
  const throughFruit = engine.parseLevel([".....", "..H..", ".F...", ".....", "#####"]);
  const drop = engine.applyMove(throughFruit, "left");
  assert.equal(drop.accepted, true);
  assert.equal(drop.fell, false);
  assert.equal(drop.state.body[0].y, 3);
  assert.equal(drop.state.fruits.has("1,2"), true);
  assert.equal(drop.ateFruit, false);
  const unsupportedExit = engine.parseLevel([".....", "..G..", "..H..", "..#..", "....."]);
  const exit = engine.applyMove(unsupportedExit, "up");
  assert.equal(exit.accepted, true);
  assert.deepEqual(exit.state.body[0], { x: 2, y: 2 });
  assert.equal(engine.isComplete(exit.state), false);
});

test("solver distinguishes search limits from an exhausted unsolvable graph", () => {
  assert.equal(solve(levels[0].map, { maxStates: 2 }).status, "limit");
  assert.equal(solve(levels[0].map, { maxDepth: 1 }).status, "depth-limit");
});

test("old five-board progress keeps clear credit and archives incomparable moves once, across v5 and legacy saves", () => {
  const old = { unlockedLevel: 3, clearedLevels: [true, true, false, true, true], bestMoves: [7, 9, null, 14, 18], lastSelectedLevel: 2 };
  const v5 = createGameSession({ now: 0 }).serialize();
  v5.session.snakebirdProgress = old;
  v5.session.seeds = 123;
  v5.session.migration.settlements[0].economy.seeds = 123;
  v5.session.records.sokobanBest = 99;
  const legacy = { saveVersion: 2, savedAt: 0, currencies: { seeds: 123 }, snakebird: old, records: { sokobanBest: 99 } };
  for (const save of [v5, legacy]) {
    const game = createGameSession({ now: 0, save });
    const before = game.snapshot();
    assert.deepEqual(game.snapshot().snakebirdProgress, old, "archive on shipped selection; loading alone does not reset records");
    const snapshot = game.dispatch({ type: "selectPuzzleLevel", mode: "snakebird", levelIndex: 0 }).snapshot;
    const progress = snapshot.snakebirdProgress;
    assert.equal(snapshot.seeds, 123);
    assert.equal(snapshot.records.sokobanBest, 99);
    for (const field of ["nursery", "habitats", "notables", "migration", "upgrades"]) assert.deepEqual(snapshot[field], before[field], field);
    assert.equal(progress.campaignVersion, 2);
    assert.deepEqual(progress.clearedLevels.slice(0, 5), old.clearedLevels);
    assert.ok(progress.clearedLevels.slice(5).every(v => !v));
    assert.deepEqual(progress.bestMoves, Array(15).fill(null));
    assert.deepEqual(progress.legacyRecords["1"], { clearedLevels: old.clearedLevels, bestMoves: old.bestMoves, lastSelectedLevel: 2 });
    assert.equal(progress.unlockedLevel, 3);
    const completion = engine.recordCompletion(progress, 0, 7, 15, 20, 5);
    assert.equal(completion.firstClear, false, "credited slots never become first-clear again");
    assert.deepEqual(completion.progress.legacyRecords, progress.legacyRecords);
    game.dispatch({ type: "restart" });
    assert.deepEqual(game.snapshot().snakebirdProgress, progress);
    const restored = createGameSession({ now: 0, save: JSON.parse(JSON.stringify(game.serialize())) });
    assert.deepEqual(restored.snapshot().snakebirdProgress, progress);
    assert.deepEqual(restored.dispatch({ type: "selectPuzzleLevel", mode: "snakebird", levelIndex: 14 }).snapshot.snakebirdProgress, progress);
  }
  assert.equal(engine.migrateCampaignProgress({ ...old, clearedLevels: Array(5).fill(true) }, 15, 2).unlockedLevel, 6);
});

test("all15 witnesses complete in the real session, persist sequential progress, and do not repeat end events", () => {
  const game = createGameSession({ now: 0 });
  for (const [index, note] of evidence.levels.entries()) {
    game.dispatch({ type: "selectPuzzleLevel", mode: "snakebird", levelIndex: index });
    const events = [];
    for (const symbol of note.witness) events.push(...game.dispatch({ type: "direction", direction: directions[symbol] }).events);
    const snapshot = game.snapshot();
    assert.equal(snapshot.phase, "gameover");
    assert.equal(snapshot.active.moves, note.optimalMoves);
    assert.equal(snapshot.active.fruits.length, 0);
    assert.equal(snapshot.snakebirdProgress.clearedLevels[index], true);
    assert.equal(snapshot.snakebirdProgress.bestMoves[index], note.optimalMoves);
    assert.equal(snapshot.snakebirdProgress.unlockedLevel, Math.min(15, index + 2));
    assert.equal(events.filter(e => e.type === "runEnded" && e.won).length, 1);
    const late = game.dispatch({ type: "direction", direction: "left" });
    assert.ok(!late.events.some(e => e.type === "runEnded"));
    assert.equal(late.snapshot.seeds, snapshot.seeds);
  }
  const progress = game.snapshot().snakebirdProgress;
  assert.ok(progress.clearedLevels.every(Boolean));
  const restored = createGameSession({ now: 0, save: JSON.parse(JSON.stringify(game.serialize())) });
  assert.deepEqual(restored.snapshot().snakebirdProgress, progress);
  restored.dispatch({ type: "selectPuzzleLevel", mode: "snakebird", levelIndex: 0 });
  for (const symbol of evidence.levels[0].witness) restored.dispatch({ type: "direction", direction: directions[symbol] });
  assert.deepEqual(restored.snapshot().snakebirdProgress, progress);
});

test("random launches and continue preserve direct access to all15 without immediate repeats", () => {
  const game = createGameSession({ now: 0, rng: () => 0.999999 });
  const launched = game.dispatch({ type: "launchPuzzle", mode: "snakebird" }).snapshot;
  assert.equal(launched.active.levelIndex, 14);
  assert.equal(launched.active.levelCount, 15);
  assert.equal(launched.snakebirdProgress.unlockedLevel, 1);
  for (const symbol of evidence.levels[14].witness) game.dispatch({ type: "direction", direction: directions[symbol] });
  const next = game.dispatch({ type: "continuePuzzle" }).snapshot.active;
  assert.notEqual(next.levelIndex, 14);
  assert.deepEqual(next.definition, levels[next.levelIndex]);
  assert.equal(next.levelCount, 15);
});
