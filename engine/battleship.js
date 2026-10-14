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
  // Python replaces the first former length-3 piece: four occupied cells in a
  // 3x2 L (three inline, then a perpendicular bend at the end).
  const FLEET = [
    { name: "Titanoboa", length: 5 },
    { name: "Anaconda", length: 4 },
    { name: "Python", length: 4, shape: "L" },
    { name: "Viper", length: 3 },
    { name: "Adder", length: 2 }
  ];
  const TOTAL_SHIP_CELLS = FLEET.reduce((sum, def) => sum + def.length, 0); // 18

  const key = (x, y) => `${x},${y}`;

  function orientations(def) { return def.shape === "L" ? ["h", "v", "h2", "v2"] : ["h", "v"]; }
  function nextOrientation(def, orientation) {
    const choices = orientations(def);
    return choices[(choices.indexOf(orientation) + 1) % choices.length];
  }

  // The anchor is the rotated bounding box's top-left. Cell order follows the
  // snake head through its tail, so rendering connects the bend, never a hole.
  // Numeric lengths retain the straight-ship API used by custom fixtures.
  function shipCells(x, y, definition, orientation = "h") {
    const def = typeof definition === "number" ? { length: definition } : definition;
    if (!def || !orientations(def).includes(orientation) || !Number.isInteger(def.length) || def.length < 1) return [];
    if (def.shape === "L") {
      if (def.length !== 4) return [];
      let cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }];
      for (let turn = 0; turn < orientations(def).indexOf(orientation); turn++) cells = cells.map((c) => ({ x: -c.y, y: c.x }));
      const minX = Math.min(...cells.map(c => c.x)), minY = Math.min(...cells.map(c => c.y));
      return cells.map(c => ({ x: x + c.x - minX, y: y + c.y - minY }));
    }
    const cells = [];
    for (let i = 0; i < def.length; i += 1) {
      cells.push(orientation === "h" ? { x: x + i, y } : { x, y: y + i });
    }
    return cells;
  }

  function shipBounds(def, orientation) {
    const cells = shipCells(0, 0, def, orientation);
    return { width: cells.length ? Math.max(...cells.map(c => c.x)) + 1 : 0,
      height: cells.length ? Math.max(...cells.map(c => c.y)) + 1 : 0 };
  }

  function inBounds(cells, size = SIZE) {
    return cells.length > 0 && cells.every((c) => Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.x < size && c.y < size);
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
    if (!inBounds(cells, size) || new Set(cells.map(c => key(c.x, c.y))).size !== cells.length) return false;
    const occ = occupied(fleet);
    return cells.every((c) => !occ.has(key(c.x, c.y)));
  }

  function canPlace(fleet, def, x, y, orientation, size = SIZE) {
    return canPlaceCells(fleet, shipCells(x, y, def, orientation), size);
  }

  function placeShip(fleet, def, x, y, orientation, size = SIZE) {
    const cells = shipCells(x, y, def, orientation);
    if (!canPlaceCells(fleet, cells, size)) return false;
    fleet.ships.push({ name: def.name, length: cells.length, ...(def.shape ? { shape: def.shape } : {}), orientation, cells });
    return true;
  }

  // Build a full fleet placed at random. Retries the whole layout if a ship
  // ever fails to fit (extremely rare on a 10x10), so callers always get a
  // valid board or null.
  function randomFleet(rng = Math.random, size = SIZE) {
    if (!Number.isInteger(size) || size < 1 || size * size < TOTAL_SHIP_CELLS
      || FLEET.some(def => !orientations(def).some(orientation => { const b = shipBounds(def, orientation); return b.width <= size && b.height <= size; }))) return null;
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const fleet = emptyFleet();
      let complete = true;
      for (const def of FLEET) {
        let placed = false;
        for (let tries = 0; tries < 200 && !placed; tries += 1) {
          const choices = orientations(def);
          const orientation = choices[Math.floor(rng() * choices.length)];
          const bounds = shipBounds(def, orientation);
          const maxX = size - bounds.width;
          const maxY = size - bounds.height;
          if (maxX < 0 || maxY < 0) continue;
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
    orientations,
    nextOrientation,
    shipBounds,
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
