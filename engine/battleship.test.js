const test = require("node:test");
const assert = require("node:assert/strict");
const bs = require("./battleship.js");

test("shipCells lays out horizontal and vertical runs from the anchor", () => {
  assert.deepEqual(bs.shipCells(2, 3, 3, "h"), [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }]);
  assert.deepEqual(bs.shipCells(2, 3, 3, "v"), [{ x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 }]);
});

test("placeShip accepts in-bounds, rejects overlap and out-of-bounds", () => {
  const fleet = bs.emptyFleet();
  assert.equal(bs.placeShip(fleet, { name: "A", length: 3 }, 0, 0, "h"), true);
  assert.equal(fleet.ships.length, 1);
  // Overlaps the first ship's (2,0) cell.
  assert.equal(bs.placeShip(fleet, { name: "B", length: 2 }, 2, 0, "h"), false);
  // Runs off the right edge (x 8,9,10 on a size-10 board).
  assert.equal(bs.placeShip(fleet, { name: "C", length: 3 }, 8, 5, "h"), false);
  assert.equal(fleet.ships.length, 1);
});

test("randomFleet places the full 5-ship fleet spanning 17 unique cells", () => {
  const fleet = bs.randomFleet(Math.random, bs.SIZE);
  assert.ok(fleet, "expected a valid fleet");
  assert.equal(fleet.ships.length, bs.FLEET.length);
  assert.equal(bs.occupied(fleet).size, bs.TOTAL_SHIP_CELLS);
});

test("fireAt resolves miss, hit, sunk and repeat", () => {
  const fleet = bs.emptyFleet();
  bs.placeShip(fleet, { name: "Adder", length: 2 }, 0, 0, "h"); // cells (0,0),(1,0)
  assert.equal(bs.fireAt(fleet, 5, 5).result, "miss");
  assert.equal(bs.fireAt(fleet, 5, 5).result, "repeat");
  assert.equal(bs.fireAt(fleet, 0, 0).result, "hit");
  const sunk = bs.fireAt(fleet, 1, 0);
  assert.equal(sunk.result, "sunk");
  assert.equal(sunk.ship.name, "Adder");
  assert.equal(bs.allSunk(fleet), true);
  assert.equal(bs.sunkCount(fleet), 1);
});

test("allSunk is false while any ship survives", () => {
  const fleet = bs.emptyFleet();
  bs.placeShip(fleet, { name: "Adder", length: 2 }, 0, 0, "h");
  bs.placeShip(fleet, { name: "Viper", length: 3 }, 0, 2, "h");
  bs.fireAt(fleet, 0, 0);
  bs.fireAt(fleet, 1, 0); // Adder sunk
  assert.equal(bs.allSunk(fleet), false);
  assert.equal(bs.sunkCount(fleet), 1);
});

test("AI queues orthogonal neighbours after a hit and clears them on a sink", () => {
  const fleet = bs.emptyFleet();
  bs.placeShip(fleet, { name: "Adder", length: 2 }, 5, 5, "h"); // (5,5),(6,5)
  const ai = bs.createAi();
  bs.recordResult(ai, { x: 5, y: 5 }, { result: "hit" });
  assert.equal(ai.queue.length, 4);
  // Next target must come from the neighbour queue (not a random hunt cell).
  const next = bs.chooseTarget(ai, fleet, () => 0);
  assert.ok(next.x >= 4 && next.x <= 6 && next.y >= 4 && next.y <= 6);
  bs.recordResult(ai, next, { result: "sunk" });
  assert.equal(ai.queue.length, 0);
});

test("aiFire eventually sinks an entire fleet without repeating cells", () => {
  const fleet = bs.randomFleet(() => Math.random());
  const ai = bs.createAi();
  let shots = 0;
  const seen = new Set();
  while (!bs.allSunk(fleet) && shots < bs.SIZE * bs.SIZE + 1) {
    const { target, outcome } = bs.aiFire(ai, fleet, () => Math.random());
    assert.notEqual(outcome.result, "repeat");
    const k = bs.key(target.x, target.y);
    assert.equal(seen.has(k), false, "AI fired the same cell twice");
    seen.add(k);
    shots += 1;
  }
  assert.equal(bs.allSunk(fleet), true);
  assert.ok(shots <= bs.SIZE * bs.SIZE, "AI should win within the board size");
});
