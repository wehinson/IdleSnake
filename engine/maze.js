// Timed Nibbler rules. Corridor shoulders and shaking are presentation only.
(function attachMaze(root, factory) {
  const api = factory(typeof module !== "undefined" && module.exports ? require("./maze-levels.js") : root.IdleSnakeMazeLevels);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeMaze = api;
})(typeof window !== "undefined" ? window : globalThis, (campaign) => {
  const vectors = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const key = (point) => `${point.x},${point.y}`;
  const TIME_LIMIT_MS = 180000, TICK_MS = 105 / 1.3, MIN_TICK_MS = TICK_MS, LEVEL_COUNT = 15;
  function isOpen(state, point) {
    return point.x >= 0 && point.x < state.grid.columns && point.y >= 0 && point.y < state.grid.rows && state.open.has(key(point));
  }
  function parseLevel(definition) {
    const map = definition.map, open = new Set(), seeds = [], body = []; let head;
    map.forEach((row, y) => [...row].forEach((char, x) => {
      if (char !== "#") open.add(`${x},${y}`);
      if (char === "S") seeds.push({ x, y });
      if (char === "H") head = { x, y };
      if (char === "o") body.push({ x, y });
    }));
    if (!head || body.length !== 2 || seeds.length !== 15) throw new Error("Nibbler level needs one head, two body tiles and fifteen Seeds.");
    const neck = body.find((point) => Math.abs(point.x - head.x) + Math.abs(point.y - head.y) === 1), tail = body.find((point) => point !== neck);
    if (!neck || Math.abs(tail.x - neck.x) + Math.abs(tail.y - neck.y) !== 1) throw new Error("Nibbler starting body must be connected.");
    return { grid: { columns: Math.max(...map.map((row) => row.length)), rows: map.length }, open, seeds, path: [head, neck, tail] };
  }
  function createState(setup = {}, levelIndex = 0) {
    const definition = setup.definition || campaign.levels[levelIndex], parsed = parseLevel(definition);
    return { ...parsed, grid: setup.grid || parsed.grid,
      open: Array.isArray(setup.open) ? new Set(setup.open) : parsed.open,
      path: Array.isArray(setup.path) ? setup.path.map((p) => ({ ...p })) : parsed.path,
      seeds: Array.isArray(setup.seeds) ? setup.seeds.map((p) => ({ ...p })) : setup.food ? [{ ...setup.food }] : parsed.seeds,
      levelIndex, level: levelIndex + 1, levelCount: LEVEL_COUNT, name: definition.name,
      score: 0, seedsCollected: 0, totalSeeds: 15, timeLimitMs: TIME_LIMIT_MS, remainingMs: TIME_LIMIT_MS,
      tickMs: setup.tickMs || TICK_MS, direction: setup.direction || definition.direction || "up", directionQueue: [], stalled: false, result: null };
  }
  function terminal(state) {
    return { won: state.result === "won", reason: state.result === "won" ? "allSeeds" : state.result,
      remainingMs: state.remainingMs, timeLimitMs: state.timeLimitMs, seedsCollected: state.seedsCollected,
      totalSeeds: state.totalSeeds, levelIndex: state.levelIndex, score: state.score };
  }
  function stepMaze(state) {
    const events = [];
    if (state.result) return { state, events, alive: false, ...terminal(state) };
    if (state.directionQueue.length) state.direction = state.directionQueue.shift();
    const v = vectors[state.direction], head = state.path[0], next = { x: head.x + v.x, y: head.y + v.y };
    if (!isOpen(state, next)) {
      if (!state.stalled) events.push({ type: "mazeStalled" });
      state.stalled = true; return { state, events, alive: true, won: false };
    }
    const seedIndex = state.seeds.findIndex((point) => point.x === next.x && point.y === next.y);
    const body = seedIndex >= 0 ? state.path : state.path.slice(0, -1);
    if (body.some((point) => point.x === next.x && point.y === next.y)) {
      state.result = "selfCollision"; state.stalled = false;
      events.push({ type: "gameOver", ...terminal(state) }); return { state, events, alive: false, ...terminal(state) };
    }
    state.stalled = false; state.path.unshift(next);
    if (seedIndex < 0) state.path.pop();
    else {
      state.seeds.splice(seedIndex, 1); state.seedsCollected += 1; state.score += 10;
      events.push({ type: "eat", seedsCollected: state.seedsCollected });
      if (state.seedsCollected === 15 && state.seeds.length === 0 && state.remainingMs > 0) {
        state.result = "won"; events.push({ type: "gameOver", ...terminal(state) });
        return { state, events, alive: false, ...terminal(state) };
      }
    }
    return { state, events, alive: true, won: false };
  }
  // Charge at the currently applied stall rate. Queued input changes neither
  // the timer rate nor engagement before its movement tick applies.
  function advanceTime(state, deltaMs, accumulatorMs = 0, applyStep = stepMaze) {
    let pending = Math.max(0, Number(deltaMs) || 0), clock = accumulatorMs, consumedMs = 0; const events = [];
    while (pending > 0 && !state.result) {
      const rate = state.stalled ? 3 : 1;
      const slice = Math.min(pending, Math.max(0, state.tickMs - clock), state.remainingMs / rate);
      state.remainingMs = Math.max(0, state.remainingMs - slice * rate);
      pending -= slice; clock += slice; consumedMs += slice;
      if (state.remainingMs <= 1e-8) {
        state.remainingMs = 0; state.result = "timeout"; events.push({ type: "gameOver", ...terminal(state) }); break;
      }
      if (clock + 1e-8 >= state.tickMs) {
        clock = Math.max(0, clock - state.tickMs); const stepped = applyStep(state); events.push(...stepped.events);
      }
    }
    return { state, events, alive: !state.result, consumedMs, accumulatorMs: state.result ? 0 : clock, ...terminal(state) };
  }
  function normalProgress(raw) {
    const clearedLevels = [...new Set((Array.isArray(raw?.clearedLevels) ? raw.clearedLevels : []).filter((n) => Number.isInteger(n) && n >= 0 && n < LEVEL_COUNT))].sort((a, b) => a - b);
    return { clearedLevels, unlockedLevel: Math.max(1, Math.min(LEVEL_COUNT, Math.floor(Number(raw?.unlockedLevel) || 1))),
      lastSelectedLevel: Math.max(0, Math.min(LEVEL_COUNT - 1, Math.floor(Number(raw?.lastSelectedLevel) || 0))) };
  }
  return { vectors, key, TIME_LIMIT_MS, TICK_MS, MIN_TICK_MS, LEVEL_COUNT, isOpen, parseLevel, createState, terminal, stepMaze, advanceTime, normalProgress };
});
