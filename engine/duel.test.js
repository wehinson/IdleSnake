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

test("running the player into a wall ends the duel in the opponent's favor", () => {
  const s = state({
    player: { body: [{ x: 9, y: 5 }, { x: 8, y: 5 }], direction: "right" }, // (10,5) is a wall
    opponent: { body: [{ x: 2, y: 2 }, { x: 1, y: 2 }], direction: "down" },
    foods: [{ x: 0, y: 9 }, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }]
  });
  const r = duel.stepVsSnake(s, { rng: seededRng(1) });
  assert.equal(r.alive, false);
  assert.equal(r.winner, "opponent");
  assert.equal(r.events.some((e) => e.type === "gameOver"), true);
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
