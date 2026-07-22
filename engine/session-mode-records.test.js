const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");

function lcg(seed) {
  let value = seed >>> 0 || 1;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x100000000; };
}

test("canonical per-mode records update without changing Snake best and survive hydration", () => {
  const game = createGameSession({
    now: 0,
    rng: lcg(1),
    save: { saveVersion: 2, records: { best: 77, crossingBest: 4, mazeBest: 3, breakoutBest: 2, sokobanBest: 1 } }
  });

  game.dispatch({ type: "selectMode", mode: "maze", setup: {
    grid: { columns: 5, rows: 5 }, tickMs: 1,
    open: ["2,1", "2,2", "2,3", "2,4"],
    path: [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }],
    food: { x: 2, y: 1 }
  } });
  game.dispatch({ type: "begin" });
  game.tick(1);
  const mazeEnded = game.tick(1);
  assert.equal(mazeEnded.snapshot.active.score, 10);
  assert.equal(mazeEnded.snapshot.records.mazeBest, 10);
  assert.equal(mazeEnded.snapshot.hud.best, 10);
  assert.equal(mazeEnded.events.find((item) => item.type === "runEnded").reward, 2, "Maze reward remains score / 4");

  game.dispatch({ type: "selectMode", mode: "crossing", setup: { grid: { columns: 10, rows: 3 }, entryColumn: 0, tickMs: 1 } });
  game.dispatch({ type: "direction", direction: "up" }); game.tick(1);
  game.dispatch({ type: "direction", direction: "up" });
  const crossingClear = game.tick(1);
  assert.equal(crossingClear.snapshot.active.score, 100);
  assert.equal(crossingClear.snapshot.records.crossingBest, 100);
  assert.equal(crossingClear.snapshot.hud.best, 100);
  assert.ok(crossingClear.events.some((item) => item.type === "reward" && item.amount === 15), "Crossing reward is unchanged");

  const width = 360; const height = 480; const segmentSize = 22;
  game.dispatch({ type: "selectMode", mode: "breakout", setup: {
    width, height, segmentSize, gap: 3,
    bricks: [{ x: 165, y: 375, width: 30, height: 30, hp: 1 }]
  } });
  game.dispatch({ type: "begin" });
  const breakoutEnded = game.tick(16);
  assert.equal(breakoutEnded.snapshot.phase, "gameover");
  assert.equal(breakoutEnded.snapshot.active.score, 10);
  assert.equal(breakoutEnded.snapshot.records.breakoutBest, 10);
  assert.equal(breakoutEnded.snapshot.hud.best, 10);
  assert.equal(breakoutEnded.events.find((item) => item.type === "runEnded").reward, 500, "Breakout win reward is unchanged");

  const sokobanDefinition = {
    reward: 7, map: ["#####", "#...#", "#####"], snake: [{ x: 1, y: 1 }],
    crates: [{ x: 2, y: 1, kind: "light" }], goals: [{ x: 3, y: 1 }], pellets: [], plates: [], gates: []
  };
  game.dispatch({ type: "selectMode", mode: "sokoban", setup: { definition: sokobanDefinition, grid: { columns: 5, rows: 3 }, levelIndex: 0 } });
  const sokobanEnded = game.dispatch({ type: "direction", direction: "right" });
  assert.equal(sokobanEnded.snapshot.records.sokobanBest, 100);
  assert.equal(sokobanEnded.snapshot.hud.best, 100);
  assert.equal(sokobanEnded.events.find((item) => item.type === "runEnded").reward, 7, "Sokoban reward is unchanged");

  const final = game.snapshot();
  assert.equal(final.best, 77, "per-mode completions never overwrite ordinary Snake best");
  assert.deepEqual(
    { crossingBest: final.records.crossingBest, mazeBest: final.records.mazeBest, breakoutBest: final.records.breakoutBest, sokobanBest: final.records.sokobanBest },
    { crossingBest: 100, mazeBest: 10, breakoutBest: 10, sokobanBest: 100 }
  );

  const restored = createGameSession({ save: game.serialize(), now: 0, rng: lcg(2) }).snapshot();
  assert.equal(restored.best, 77);
  assert.deepEqual(restored.records, final.records);
});
