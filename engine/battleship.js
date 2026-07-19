// Headless battleship minigame — "Venom Strike". Ships are snakes, bombs are
// venom strikes. Pure and turn-based: no DOM, no timers. The host (game.js)
// owns rendering, input, the AI-fire delay and rewards; this module owns the
// rules — fleet layout, placement validation, shot resolution and the AI's
// hunt/target targeting. Standard 10x10 board with the classic 5-ship fleet.
(function attachBattleship(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeBattleship = engine;
  else root.IdleSnakeBattleship = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const SIZE = 10;
  // Classic battleship fleet (lengths 5/4/3/3/2), themed as snakes.
  const FLEET = [
    { name: "Titanoboa", length: 5 },
    { name: "Anaconda", length: 4 },
    { name: "Python", length: 3 },
    { name: "Viper", length: 3 },
    { name: "Adder", length: 2 }
  ];
  const TOTAL_SHIP_CELLS = FLEET.reduce((sum, def) => sum + def.length, 0); // 17

  const key = (x, y) => `${x},${y}`;

  // Cells a ship of `length` occupies from anchor (x,y). Orientation "h" runs
  // rightward (+x), "v" runs downward (+y).
  function shipCells(x, y, length, orientation) {
    const cells = [];
    for (let i = 0; i < length; i += 1) {
      cells.push(orientation === "h" ? { x: x + i, y } : { x, y: y + i });
    }
    return cells;
  }

  function inBounds(cells, size = SIZE) {
    return cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < size && c.y < size);
  }

  // A fleet is the board being fired upon: its placed ships plus every shot
  // received (key -> "hit" | "miss"). Enemy ships stay hidden to the shooter;
  // only `shots` is public information.
  function emptyFleet() {
    return { ships: [], shots: {} };
  }

  function occupied(fleet) {
    const set = new Set();
    fleet.ships.forEach((ship) => ship.cells.forEach((c) => set.add(key(c.x, c.y))));
    return set;
  }

  // Standard rules allow ships to touch, so placement only rejects
  // out-of-bounds and overlapping cells.
  function canPlaceCells(fleet, cells, size = SIZE) {
    if (!inBounds(cells, size)) return false;
    const occ = occupied(fleet);
    return cells.every((c) => !occ.has(key(c.x, c.y)));
  }

  function canPlace(fleet, def, x, y, orientation, size = SIZE) {
    return canPlaceCells(fleet, shipCells(x, y, def.length, orientation), size);
  }

  function placeShip(fleet, def, x, y, orientation, size = SIZE) {
    const cells = shipCells(x, y, def.length, orientation);
    if (!canPlaceCells(fleet, cells, size)) return false;
    fleet.ships.push({ name: def.name, length: def.length, orientation, cells });
    return true;
  }

  // Build a full fleet placed at random. Retries the whole layout if a ship
  // ever fails to fit (extremely rare on a 10x10), so callers always get a
  // valid board or null.
  function randomFleet(rng = Math.random, size = SIZE) {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const fleet = emptyFleet();
      let complete = true;
      for (const def of FLEET) {
        let placed = false;
        for (let tries = 0; tries < 200 && !placed; tries += 1) {
          const orientation = rng() < 0.5 ? "h" : "v";
          const maxX = orientation === "h" ? size - def.length : size - 1;
          const maxY = orientation === "v" ? size - def.length : size - 1;
          const x = Math.floor(rng() * (maxX + 1));
          const y = Math.floor(rng() * (maxY + 1));
          placed = placeShip(fleet, def, x, y, orientation, size);
        }
        if (!placed) { complete = false; break; }
      }
      if (complete) return fleet;
    }
    return null;
  }

  function shipAt(fleet, x, y) {
    return fleet.ships.find((ship) => ship.cells.some((c) => c.x === x && c.y === y));
  }

  function isSunk(ship, shots) {
    return ship.cells.every((c) => shots[key(c.x, c.y)] === "hit");
  }

  // Resolve a venom strike at (x,y). Returns "repeat" for an already-fired cell
  // (caller should ignore it and not pass the turn), otherwise "miss", "hit" or
  // "sunk" (with the ship that went down).
  function fireAt(fleet, x, y) {
    const k = key(x, y);
    if (fleet.shots[k]) return { result: "repeat" };
    const ship = shipAt(fleet, x, y);
    if (!ship) {
      fleet.shots[k] = "miss";
      return { result: "miss" };
    }
    fleet.shots[k] = "hit";
    if (isSunk(ship, fleet.shots)) return { result: "sunk", ship };
    return { result: "hit", ship };
  }

  function sunkCount(fleet) {
    return fleet.ships.filter((ship) => isSunk(ship, fleet.shots)).length;
  }

  function allSunk(fleet) {
    return fleet.ships.length > 0 && fleet.ships.every((ship) => isSunk(ship, fleet.shots));
  }

  // --- Opponent AI: classic hunt/target ---------------------------------
  // Hunt mode fires on a checkerboard parity (no 2-cell ship can hide from it).
  // On a hit it switches to target mode, queueing the four orthogonal
  // neighbours; a fresh hit extends the queue, and sinking a ship clears it.
  function createAi() {
    return { queue: [] };
  }

  const NEIGHBORS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

  function chooseTarget(ai, fleet, rng = Math.random, size = SIZE) {
    // Target mode: drain the neighbour queue, skipping spent/out-of-bounds cells.
    while (ai.queue.length) {
      const t = ai.queue.shift();
      if (t.x < 0 || t.y < 0 || t.x >= size || t.y >= size) continue;
      if (fleet.shots[key(t.x, t.y)]) continue;
      return t;
    }
    // Hunt mode: prefer parity cells, fall back to any remaining cell.
    const parity = [];
    const any = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (fleet.shots[key(x, y)]) continue;
        any.push({ x, y });
        if ((x + y) % 2 === 0) parity.push({ x, y });
      }
    }
    const pool = parity.length ? parity : any;
    if (!pool.length) return null;
    return pool[Math.floor(rng() * pool.length)];
  }

  // Fold a resolved shot back into the AI state so its next target is informed.
  function recordResult(ai, target, outcome) {
    if (outcome.result === "hit") {
      NEIGHBORS.forEach((d) => ai.queue.push({ x: target.x + d.x, y: target.y + d.y }));
    } else if (outcome.result === "sunk") {
      ai.queue = [];
    }
  }

  // Convenience: pick + fire + learn in one call. Returns { target, outcome }.
  function aiFire(ai, fleet, rng = Math.random, size = SIZE) {
    const target = chooseTarget(ai, fleet, rng, size);
    if (!target) return { target: null, outcome: { result: "repeat" } };
    const outcome = fireAt(fleet, target.x, target.y);
    recordResult(ai, target, outcome);
    return { target, outcome };
  }

  return {
    SIZE,
    FLEET,
    TOTAL_SHIP_CELLS,
    key,
    shipCells,
    emptyFleet,
    occupied,
    canPlaceCells,
    canPlace,
    placeShip,
    randomFleet,
    shipAt,
    isSunk,
    fireAt,
    sunkCount,
    allSunk,
    createAi,
    chooseTarget,
    recordResult,
    aiFire
  };
});
