const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const battleship = require("./battleship.js");

function lcg(seed) {
  let value = seed >>> 0 || 1;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x100000000; };
}

function rowFleet() {
  const fleet = battleship.emptyFleet();
  battleship.FLEET.forEach((def, row) => {
    assert.equal(battleship.placeShip(fleet, def, 0, row, "h"), true);
  });
  return fleet;
}

function oneShipCellRemaining(fleet, remaining) {
  for (let y = 0; y < battleship.SIZE; y += 1) {
    for (let x = 0; x < battleship.SIZE; x += 1) {
      if (x === remaining.x && y === remaining.y) continue;
      fleet.shots[battleship.key(x, y)] = battleship.shipAt(fleet, x, y) ? "hit" : "miss";
    }
  }
  return fleet;
}

test("Battleship session owns bounded placement, rotation, shuffle, start, and restart", () => {
  const game = createGameSession({ now: 0, rng: lcg(25) });
  let result = game.dispatch({ type: "selectMode", mode: "battleship", setup: { enemyFleet: rowFleet() } });
  assert.equal(result.snapshot.phase, "ready");
  assert.equal(result.snapshot.active.phase, "placement");
  assert.ok(result.snapshot.supportedModes.includes("battleship"));

  game.dispatch({ type: "direction", direction: "left" });
  assert.equal(game.snapshot().active.placement.x, 0, "placement cursor is clamped to the board");
  result = game.dispatch({ type: "battleshipRotate" });
  assert.equal(result.snapshot.active.placement.orientation, "v");
  result = game.dispatch({ type: "battleshipPlace", x: 0, y: 0 });
  assert.equal(result.snapshot.active.player.ships[0].orientation, "v");
  assert.ok(game.dispatch({ type: "battleshipPlace", x: 0, y: 0 }).events.some((item) => item.reason === "invalidPlacement"));
  assert.ok(game.dispatch({ type: "battleshipStart" }).events.some((item) => item.reason === "fleetIncomplete"));

  result = game.dispatch({ type: "battleshipShuffle" });
  assert.equal(result.snapshot.active.player.ships.length, battleship.FLEET.length);
  result = game.dispatch({ type: "battleshipStart" });
  assert.equal(result.snapshot.phase, "running");
  assert.equal(result.snapshot.active.phase, "playing");

  result = game.dispatch({ type: "restart", setup: { enemyFleet: rowFleet() } });
  assert.equal(result.snapshot.phase, "ready");
  assert.equal(result.snapshot.active.player.ships.length, 0);
  assert.equal(result.snapshot.active.result, null);
});

test("Battleship victory is authoritative, rewarded once, recorded, and serialized", () => {
  const enemy = oneShipCellRemaining(rowFleet(), { x: 0, y: 0 });
  const game = createGameSession({
    now: 0,
    rng: () => 0,
    save: { records: { battleshipBest: 2 } }
  });
  game.dispatch({ type: "selectMode", mode: "battleship", setup: { playerFleet: rowFleet(), enemyFleet: enemy, aiDelayMs: 1 } });
  game.dispatch({ type: "battleshipStart" });
  const won = game.dispatch({ type: "battleshipFire", x: 0, y: 0 });

  assert.deepEqual(won.events.find((item) => item.type === "runEnded"), { type: "runEnded", mode: "battleship", won: true, reward: 300 });
  assert.equal(won.snapshot.phase, "gameover");
  assert.equal(won.snapshot.active.result, "won");
  assert.equal(won.snapshot.seeds, 300);
  assert.equal(won.snapshot.records.battleshipBest, 3);
  assert.equal(won.snapshot.hud.best, 3);
  assert.equal(won.snapshot.hud.score, battleship.FLEET.length);
  assert.ok(game.dispatch({ type: "battleshipFire", x: 0, y: 0 }).events.some((item) => item.reason === "notRunning"));
  assert.equal(game.snapshot().seeds, 300, "a completed battle cannot pay twice");

  const restored = createGameSession({ save: game.serialize(), now: 0, rng: () => 0 }).snapshot();
  assert.equal(restored.records.battleshipBest, 3);
  assert.equal(restored.seeds, 300);
  assert.equal(restored.active, null, "live turn state is intentionally not persisted");
});

test("Battleship AI delay advances only while running and resolves a deterministic loss", () => {
  const player = oneShipCellRemaining(rowFleet(), { x: 0, y: 0 });
  const game = createGameSession({ now: 0, rng: () => 0 });
  game.dispatch({ type: "selectMode", mode: "battleship", setup: { playerFleet: player, enemyFleet: rowFleet(), aiDelayMs: 650 } });
  game.dispatch({ type: "battleshipStart" });
  const fired = game.dispatch({ type: "battleshipFire", x: 9, y: 9 });
  assert.equal(fired.snapshot.active.turn, "ai");

  game.tick(649);
  assert.equal(game.snapshot().active.lastAiShot, null);
  game.dispatch({ type: "pause" });
  game.tick(1000);
  assert.equal(game.snapshot().active.lastAiShot, null, "paused time does not advance the AI turn");
  game.dispatch({ type: "resume" });
  const lost = game.tick(1);

  assert.deepEqual(lost.snapshot.active.lastAiShot, { x: 0, y: 0, result: "sunk" });
  assert.equal(lost.snapshot.phase, "gameover");
  assert.equal(lost.snapshot.active.result, "lost");
  assert.equal(lost.snapshot.seeds, 0);
  assert.equal(lost.snapshot.records.battleshipBest, 0);
  assert.deepEqual(lost.events.find((item) => item.type === "runEnded"), { type: "runEnded", mode: "battleship", won: false, reward: 0 });
});
