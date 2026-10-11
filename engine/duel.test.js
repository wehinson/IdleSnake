const test = require("node:test");
const assert = require("node:assert/strict");
const duel = require("./duel.js");

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

const grid = { columns: 10, rows: 10 };
function state(overrides = {}) {
  return {
    grid,
    player: { body: [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }], direction: "right" },
    opponent: { body: [{ x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }], direction: "left" },
    foods: [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 9 }],
    score: 0,
    directionQueue: [],
    direction: "right",
    nextDirection: "right",
    ...overrides
  };
}

test("both snakes move and keep length when not eating", () => {
  const s = state();
  const r = duel.stepVsSnake(s, { rng: seededRng(1) });
  assert.equal(r.alive, true);
  assert.deepEqual(s.player.body[0], { x: 4, y: 5 }, "player moved right");
  assert.equal(s.player.body.length, 3);
});

test("player eating food grows and scores", () => {
  const s = state({
    player: { body: [{ x: 4, y: 5 }, { x: 3, y: 5 }], direction: "right" },
    foods: [{ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }]
  });
  const r = duel.stepVsSnake(s, { rng: seededRng(2) });
  assert.equal(s.score, 1);
  assert.equal(s.player.body.length, 3, "grew");
  assert.equal(r.events.some((e) => e.type === "eat"), true);
});

test("player crosses an edge onto the opposite cell", () => {
  const s = state({
    player: { body: [{ x: 9, y: 5 }, { x: 8, y: 5 }], direction: "right" }, // wraps to (0,5)
    opponent: { body: [{ x: 2, y: 2 }, { x: 1, y: 2 }], direction: "down" },
    foods: [{ x: 0, y: 9 }, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }]
  });
  const r = duel.stepVsSnake(s, { rng: seededRng(1) });
  assert.equal(r.alive, true);
  assert.deepEqual(s.player.body[0], { x: 0, y: 5 });
  assert.equal(r.events.some((e) => e.type === "gameOver"), false);
});

function headSwapState(playerLength, opponentLength) {
  const player = Array.from({ length: playerLength }, (_, index) => ({ x: 4 - index, y: 5 }));
  // Block the AI's non-left alternatives so its existing direction produces the
  // simultaneous exchange without changing opponent-AI production behavior.
  const opponent = [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 6 }];
  while (opponent.length < opponentLength) opponent.push({ x: 6 + opponent.length, y: 5 });
  return state({ player: { body: player, direction: "right" }, opponent: { body: opponent, direction: "left" }, foods: [{ x: 0, y: 5 }] });
}

test("equal-length head swaps are a draw", () => {
  const r = duel.stepVsSnake(headSwapState(3, 3), { rng: seededRng(4) });
  assert.equal(r.alive, false);
  assert.equal(r.winner, null);
});

test("head swaps use the existing longer-snake winner rule", () => {
  assert.equal(duel.stepVsSnake(headSwapState(4, 3), { rng: seededRng(5) }).winner, "player");
  assert.equal(duel.stepVsSnake(headSwapState(3, 4), { rng: seededRng(6) }).winner, "opponent");
});

test("adjacent snakes that do not swap heads do not falsely collide", () => {
  const s = state({
    player: { body: [{ x: 4, y: 5 }], direction: "right" },
    opponent: { body: [{ x: 5, y: 5 }], direction: "up" },
    foods: [{ x: 5, y: 0 }]
  });
  const r = duel.stepVsSnake(s, { rng: seededRng(7) });
  assert.equal(r.alive, true);
});

test("the opponent AI steers toward the nearest food", () => {
  const s = state({
    opponent: { body: [{ x: 5, y: 5 }, { x: 5, y: 6 }], direction: "up" },
    foods: [{ x: 8, y: 5 }], // directly to the right
    player: { body: [{ x: 0, y: 0 }], direction: "right" }
  });
  duel.chooseOpponentDirection(s);
  assert.equal(s.opponent.direction, "right", "chose the direction toward food");
});

test("the board is refilled to 5 foods after eating", () => {
  const s = state({
    player: { body: [{ x: 4, y: 5 }, { x: 3, y: 5 }], direction: "right" },
    foods: [{ x: 5, y: 5 }]
  });
  duel.stepVsSnake(s, { rng: seededRng(3) });
  assert.equal(s.foods.length, 5);
});

test("runs headless with no DOM", () => {
  assert.equal(typeof document, "undefined");
  assert.doesNotThrow(() => duel.stepVsSnake(state(), { rng: seededRng(1) }));
});

test("all four edges wrap for either snake on the rectangular board", () => {
  const cases = [
    ["left", { x: 0, y: 12 }, { x: 19, y: 12 }],
    ["right", { x: 19, y: 12 }, { x: 0, y: 12 }],
    ["up", { x: 10, y: 0 }, { x: 10, y: 24 }],
    ["down", { x: 10, y: 24 }, { x: 10, y: 0 }]
  ];
  for (const [direction, head, expected] of cases) {
    for (const actor of ["player", "opponent"]) {
      const s = state({ grid: duel.GRID, player: { body: [{ x: 4, y: 4 }], direction: "right" }, opponent: { body: [{ x: 15, y: 15 }], direction: "down" }, foods: [expected] });
      s[actor] = { body: [head], direction };
      const result = duel.stepVsSnake(s, { rng: seededRng(8) });
      assert.equal(result.alive, true, `${actor} ${direction}`);
      assert.deepEqual(s[actor].body[0], expected, `${actor} ${direction}`);
      assert.equal(s[actor].body.length, 2, "food on wrapped destination grows the snake");
    }
  }
});

test("AI chooses toroidal nearest food and rejects wrapped body occupancy", () => {
  const s = state({ grid: duel.GRID, opponent: { body: [{ x: 0, y: 10 }, { x: 0, y: 11 }], direction: "up" }, player: { body: [{ x: 4, y: 5 }], direction: "up" }, foods: [{ x: 18, y: 10 }, { x: 3, y: 10 }] });
  duel.chooseOpponentDirection(s);
  assert.equal(s.opponent.direction, "left");
  s.player.body.push({ x: 19, y: 10 });
  assert.equal(duel.safeDirections(s, s.opponent, s.player).includes("left"), false);
});

test("wrapped collisions distinguish occupied bodies and vacated tails", () => {
  for (const grows of [false, true]) {
    const s = state({ grid: duel.GRID,
      player: { body: [{ x: 0, y: 10 }], direction: "left" },
      opponent: { body: [{ x: 18, y: 10 }, { x: 18, y: 11 }, { x: 19, y: 10 }], direction: "up" },
      foods: [{ x: 18, y: 7 }, ...(grows ? [{ x: 18, y: 9 }] : [])] });
    const result = duel.stepVsSnake(s, { rng: seededRng(3) });
    assert.equal(result.alive, !grows);
    if (grows) assert.equal(result.winner, "opponent");
  }
  const s = state({ grid: duel.GRID,
    player: { body: [{ x: 0, y: 10 }, { x: 19, y: 10 }, { x: 19, y: 11 }], direction: "left" },
    opponent: { body: [{ x: 10, y: 15 }], direction: "up" } });
  assert.equal(duel.stepVsSnake(s, { rng: seededRng(3) }).winner, "opponent");
});

test("wrapped head swaps retain draw and longer-snake outcomes", () => {
  for (const [playerLength, opponentLength, winner] of [[3, 3, null], [4, 3, "player"], [3, 4, "opponent"]]) {
    const s = state({ grid: duel.GRID,
      player: { body: Array.from({ length: playerLength }, (_, i) => ({ x: i, y: 10 })), direction: "left" },
      opponent: { body: [{ x: 19, y: 10 }, { x: 19, y: 9 }, { x: 19, y: 11 }, ...(opponentLength === 4 ? [{ x: 18, y: 11 }] : [])], direction: "right" },
      foods: [{ x: 2, y: 10 }] });
    const result = duel.stepVsSnake(s, { rng: seededRng(4) });
    assert.equal(result.alive, false);
    assert.equal(result.winner, winner);
  }
});

test("entering an opponent's old head still hits its body when that head moves away", () => {
  const s = state({
    player: { body: [{ x: 4, y: 5 }], direction: "right" },
    opponent: { body: [{ x: 5, y: 5 }, { x: 6, y: 5 }], direction: "up" },
    foods: [{ x: 5, y: 3 }] });
  assert.equal(duel.stepVsSnake(s, { rng: seededRng(2) }).winner, "opponent");
});
