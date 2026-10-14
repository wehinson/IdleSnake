const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("./battleship.js");
const C = require("./centipede.js");
const { createGameSession } = require("./session.js");
const python = B.FLEET[2];
function rng(seed) { let value = seed >>> 0; return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296); }
function rowFleet() {
  const fleet = B.emptyFleet();
  B.FLEET.forEach((def, i) => assert.ok(B.placeShip(fleet, def, 0, i * 2, "h")));
  return fleet;
}
function field(overrides = {}) {
  return { cols: 100, rows: 100, playerRows: 6, player: { x: 50, y: 99, inputX: 0, inputY: 0 },
    bullets: [], mushrooms: {}, segments: [{ x: 10, y: 0, dir: 1, vDir: 1, isHead: true }],
    score: 0, lives: 3, wave: 1, wavesCleared: 0, ...overrides };
}

test("Python is the third fleet piece: four-cell end-bend L with four distinct contiguous rotations, total18", () => {
  assert.deepEqual(B.FLEET.map(def => def.length), [5, 4, 4, 3, 2]);
  assert.equal(python.name, "Python"); assert.equal(python.shape, "L"); assert.equal(B.TOTAL_SHIP_CELLS, 18);
  const expected = {
    h: [[0, 0], [1, 0], [2, 0], [2, 1]], v: [[1, 0], [1, 1], [1, 2], [0, 2]],
    h2: [[2, 1], [1, 1], [0, 1], [0, 0]], v2: [[0, 2], [0, 1], [0, 0], [1, 0]]
  };
  let orientation = "h";
  for (const name of Object.keys(expected)) {
    assert.equal(orientation, name);
    const cells = B.shipCells(0, 0, python, name);
    assert.deepEqual(cells.map(c => [c.x, c.y]), expected[name]); assert.equal(cells.length, 4);
    cells.slice(1).forEach((c, i) => assert.equal(Math.abs(c.x - cells[i].x) + Math.abs(c.y - cells[i].y), 1));
    orientation = B.nextOrientation(python, orientation);
  }
  assert.equal(orientation, "h");
  assert.deepEqual(B.orientations(B.FLEET[3]), ["h", "v"], "Viper stays the other straight length3");
});
test("all L rotations fit exactly at bounds, reject negative/overflow/overlap, permit touching and empty bounding-box holes", () => {
  for (const orientation of B.orientations(python)) {
    const { width, height } = B.shipBounds(python, orientation);
    const fleet = B.emptyFleet();
    assert.ok(B.placeShip(fleet, python, 10 - width, 10 - height, orientation));
    assert.equal(B.canPlace(B.emptyFleet(), python, 11 - width, 10 - height, orientation), false);
    assert.equal(B.canPlace(B.emptyFleet(), python, 10 - width, 11 - height, orientation), false);
    assert.equal(B.canPlace(B.emptyFleet(), python, -1, 0, orientation), false);
    assert.equal(B.canPlace(B.emptyFleet(), python, 0, -1, orientation), false);
    assert.equal(B.placeShip(fleet, python, 10 - width, 10 - height, orientation), false);
    assert.equal(B.canPlace(B.emptyFleet(), python, 0, 0, orientation, 2), false);
  }
  const fleet = B.emptyFleet(); B.placeShip(fleet, python, 0, 0, "h");
  assert.ok(B.placeShip(fleet, B.FLEET[4], 0, 1, "h"), "two cells in the L's bounding-box holes are legal and touch its arm");
  assert.equal(B.occupied(fleet).size, 6); assert.equal(B.randomFleet(rng(1), 4), null, "Titanoboa cannot fit");
  assert.equal(B.canPlaceCells(B.emptyFleet(), []), false);
});
test("seeded AI fleets use the L rotations with18 unique legal occupied cells and can be sunk without repeated shots", () => {
  const rotations = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const fleet = B.randomFleet(rng(seed)); assert.ok(fleet); assert.equal(B.occupied(fleet).size, 18);
    const ship = fleet.ships[2]; rotations.add(ship.orientation);
    assert.equal(ship.shape, "L"); assert.equal(ship.cells.length, 4); assert.equal(ship.length, 4);
    assert.ok(fleet.ships.every(s => s.cells.every(c => c.x >= 0 && c.x < 10 && c.y >= 0 && c.y < 10)));
    const same = B.randomFleet(rng(seed)); assert.deepEqual(same, fleet);
    const ai = B.createAi(); let shots = 0;
    while (!B.allSunk(fleet) && shots < 100) { assert.notEqual(B.aiFire(ai, fleet, rng(seed + shots)).outcome.result, "repeat"); shots++; }
    assert.ok(B.allSunk(fleet)); assert.equal(Object.values(fleet.shots).filter(value => value === "hit").length, 18);
  }
  assert.deepEqual([...rotations].sort(), ["h", "h2", "v", "v2"]);
});
test("an L's empty cells miss, its fourth actual hit sinks it, and repeat hits do not alter totals", () => {
  const fleet = B.emptyFleet(); B.placeShip(fleet, python, 0, 0, "h");
  assert.equal(B.fireAt(fleet, 0, 1).result, "miss"); assert.equal(B.shipAt(fleet, 1, 1), undefined);
  for (const cell of fleet.ships[0].cells.slice(0, 3)) { assert.equal(B.fireAt(fleet, cell.x, cell.y).result, "hit"); assert.equal(B.sunkCount(fleet), 0); }
  assert.equal(B.fireAt(fleet, 2, 1).result, "sunk"); assert.equal(B.sunkCount(fleet), 1);
  assert.equal(B.fireAt(fleet, 2, 1).result, "repeat"); assert.equal(Object.values(fleet.shots).filter(s => s === "hit").length, 4);
});
test("actual session rotate/clamp/place uses L bounds and restores straight orientation after Python", () => {
  const game = createGameSession({ now: 0, rng: rng(7) }); game.dispatch({ type: "selectMode", mode: "battleship" });
  game.dispatch({ type: "battleshipPlace", x: 0, y: 0 }); game.dispatch({ type: "battleshipPlace", x: 0, y: 2 });
  for (const orientation of ["h", "v", "h2", "v2"]) {
    for (let i = 0; i < 10; i++) { game.dispatch({ type: "direction", direction: "right" }); game.dispatch({ type: "direction", direction: "down" }); }
    const p = game.snapshot().active.placement, bounds = B.shipBounds(python, orientation);
    assert.equal(p.orientation, orientation); assert.equal(p.x, 10 - bounds.width); assert.equal(p.y, 10 - bounds.height);
    assert.ok(B.canPlace(B.emptyFleet(), python, p.x, p.y, p.orientation)); game.dispatch({ type: "battleshipRotate" });
  }
  game.dispatch({ type: "battleshipRotate" }); game.dispatch({ type: "battleshipRotate" });
  const placed = game.dispatch({ type: "battleshipPlace", x: 0, y: 4 });
  assert.equal(placed.snapshot.active.player.ships[2].orientation, "h2"); assert.equal(placed.snapshot.active.player.ships[2].cells.length, 4);
  assert.equal(placed.snapshot.active.placement.orientation, "h");
});
test("the final L cell wins an18-hit fleet once and preserves durable rewards but no active board on reload", () => {
  const enemy = rowFleet(), last = enemy.ships[2].cells[3];
  for (const ship of enemy.ships) for (const c of ship.cells) if (c.x !== last.x || c.y !== last.y) enemy.shots[B.key(c.x, c.y)] = "hit";
  assert.equal(B.sunkCount(enemy), 4);
  const game = createGameSession({ now: 0, rng: rng(9) });
  game.dispatch({ type: "selectMode", mode: "battleship", setup: { enemyFleet: enemy, playerFleet: rowFleet() } }); game.dispatch({ type: "battleshipStart" });
  const won = game.dispatch({ type: "battleshipFire", ...last }), payout = won.events.find(e => e.type === "runEnded");
  assert.equal(won.snapshot.active.score, 5); assert.equal(payout.outcome, "win"); assert.ok(payout.reward > 0);
  assert.equal(Object.values(won.snapshot.active.enemy.shots).filter(s => s === "hit").length, 18);
  assert.ok(!game.dispatch({ type: "battleshipFire", ...last }).events.some(e => e.type === "runEnded"));
  const save = game.serialize(), restored = createGameSession({ now: 0, save }).snapshot();
  assert.equal(restored.active, null); assert.equal(restored.seeds, won.snapshot.seeds); assert.deepEqual(restored.minigameRewards, won.snapshot.minigameRewards);
});

test("210ms fire cadence is identical for misses and impacts, with2 bullets airborne before the first impact", () => {
  const missed = field(), hit = field({ mushrooms: { "50,98": 4 } });
  const launches = [], impactLaunches = [];
  for (let tick = 1; tick <= 15; tick++) {
    const a = C.step(missed), b = C.step(hit);
    if (a.events.some(e => e.type === "shotFired")) launches.push(tick * 70);
    if (b.events.some(e => e.type === "shotFired")) impactLaunches.push(tick * 70);
    if (tick === 4) { assert.equal(missed.bullets.length, 2); assert.ok(missed.bullets.every(projectile => projectile.y > 85)); assert.equal(missed.score, 0); }
  }
  assert.deepEqual(launches, [70, 280, 490, 700, 910]); assert.deepEqual(impactLaunches, launches);
  assert.equal(C.config.fireIntervalMs, 210); assert.ok(Math.abs(1000 / C.config.fireIntervalMs - 4.7619047619) < 1e-8);
});
test("session elapsed partitions preserve projectile positions, per-shot fractions and fire clock", () => {
  const partitions = [Array(10).fill(70), Array(7).fill(100), [17, 83, 31, 69, 40, 60, 90, 10, 25, 75, 12, 88, 80, 20]];
  const results = partitions.map(parts => {
    const game = createGameSession({ now: 0, rng: rng(8) });
    game.dispatch({ type: "selectMode", mode: "centipede", setup: { rows: 60, startLength: 2 } }); game.dispatch({ type: "begin" });
    const events = parts.flatMap(dt => game.tick(dt).events).filter(e => e.type === "shotFired");
    assert.equal(events.length, 4); return game.snapshot().active;
  });
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[0], results[2]);
});
test("concurrent bullets check every traversed row and cannot destroy or score the same segment twice", () => {
  for (const y of [8, 7, 6]) {
    const s = field({ bullets: [{ x: 50, y: 9, travelRows: .8 }, { x: 49, y: 9, travelRows: .8 }], mushrooms: { [`50,${y}`]: 4, [`49,${y}`]: 4 } });
    C.step(s); assert.equal(s.mushrooms[`50,${y}`], 3); assert.equal(s.mushrooms[`49,${y}`], 3);
  }
  const s = field({ bullets: [{ x: 10, y: 3 }, { x: 10, y: 3 }], segments: [{ x: 10, y: 1, dir: 1, vDir: 1, isHead: false }, { x: 30, y: 1, dir: 1, vDir: 1, isHead: true }] });
  const result = C.step(s); assert.equal(result.events.filter(e => e.type === "segmentDestroyed").length, 1);
  assert.equal(s.score, 10); assert.equal(s.mushrooms["10,1"], 3);
});
test("wave changes discard stale projectiles without resetting the regular fire schedule", () => {
  const s = field({ bullets: [{ x: 10, y: 3 }, { x: 80, y: 80 }], fireAccumulatorMs: 70,
    segments: [{ x: 10, y: 1, dir: 1, vDir: 1, isHead: true }] });
  const old = s.bullets[1], result = C.step(s, { rng: rng(4) });
  assert.equal(s.wave, 2); assert.equal(s.wavesCleared, 1); assert.equal(s.bullets.length, 0);
  assert.equal(s.fireAccumulatorMs, 140); assert.ok(!s.bullets.includes(old)); assert.equal(s.score, 100);
  assert.equal(result.events.filter(e => e.type === "waveClear").length, 1);
  assert.ok(C.step(s).events.some(e => e.type === "shotFired"));
});
test("controlledMove precedes projectile effects and nonfatal/fatal collisions clear all projectiles without duplicate terminal events", () => {
  const s = field({ player: { x: 49, y: 99, inputX: 1, inputY: 0 }, segmentAccumulatorMs: 0,
    segments: [{ x: 50, y: 99, dir: 1, vDir: 1, isHead: true }], bullets: [{ x: 50, y: 3 }], mushrooms: { "50,1": 1 } });
  const result = C.step(s); assert.equal(result.events[0].type, "controlledMove"); assert.equal(result.events[1].type, "mushroomDestroyed");
  assert.equal(s.lives, 2); assert.deepEqual(s.bullets, []); assert.equal(s.fireAccumulatorMs, 140);
  assert.ok(!result.events.some(e => e.type === "shotFired" || e.type === "gameOver"));
  s.lives = 1; s.segments = [{ ...s.player, dir: 1, vDir: 1, isHead: true }]; s.segmentAccumulatorMs = 0;
  s.bullets = [{ x: 80, y: 80 }]; const fatal = C.step(s);
  assert.equal(fatal.alive, false); assert.deepEqual(s.bullets, []); assert.equal(fatal.events.filter(e => e.type === "gameOver").length, 1);
  assert.deepEqual(C.step(s).events, []);
});
test("session pause freezes projectiles/fire clock, restart is fresh, and nonfatal Ready contains no stale shots", () => {
  const game = createGameSession({ now: 0, rng: rng(5) }); game.dispatch({ type: "selectMode", mode: "centipede" }); game.dispatch({ type: "begin" });
  for (let i = 0; i < 4; i++) game.tick(70);
  game.dispatch({ type: "pause" }); const before = game.snapshot().active;
  game.tick(1000); assert.deepEqual(game.snapshot().active, before);
  game.dispatch({ type: "resume" }); const restarted = game.dispatch({ type: "restart" });
  assert.deepEqual(restarted.snapshot.active.bullets, []); assert.equal(restarted.snapshot.active.fireAccumulatorMs, 140);
  assert.equal(restarted.snapshot.active.score, 0); assert.equal(restarted.snapshot.phase, "ready");
  game.dispatch({ type: "selectMode", mode: "centipede", setup: { cols: 1, rows: 2, playerRows: 2, startLength: 1, lives: 2 } }); game.dispatch({ type: "begin" });
  const hit = game.tick(70); assert.equal(hit.snapshot.phase, "ready"); assert.deepEqual(hit.snapshot.active.bullets, []);
  assert.ok(!hit.events.some(e => e.type === "runEnded"));
});
