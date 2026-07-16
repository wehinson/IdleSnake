// Headless maze minigame ("Snake Forever" mode) — snake threading a maze,
// eating food, leveling up. Real-time (host drives it from the tick loop), but
// the per-step logic is pure here. Port of game.js stepMaze/spawnMazeFood; the
// junction-choice/travel UI stays host-side (it only sets `direction`).
(function attachMaze(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeMaze = engine;
  else root.IdleSnakeMaze = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const vectors = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  const key = (point) => `${point.x},${point.y}`;

  const TICK_MS = 105;   // matches game.js mazeTickMs
  const MIN_TICK_MS = 62;

  function isOpen(state, point) {
    return point.x >= 0 && point.x < state.grid.columns &&
      point.y >= 0 && point.y < state.grid.rows &&
      state.open.has(key(point));
  }

  // Pick a new food cell from open cells not occupied by the snake path.
  function spawnFood(state, rng) {
    const candidates = [];
    for (const cell of state.open) {
      const [x, y] = cell.split(",").map(Number);
      if (!state.path.some((part) => part.x === x && part.y === y)) candidates.push({ x, y });
    }
    state.food = candidates[Math.floor((rng || Math.random)() * candidates.length)] || null;
    return state.food;
  }

  // Advance one maze step. State: { grid, open:Set, path:[], food, foodsEaten,
  // level, score, tickMs, direction, directionQueue }. Returns { state, events,
  // alive }. Events: eat, levelUp{level,reward}, gameOver.
  function stepMaze(state, ctx) {
    const rng = (ctx && ctx.rng) || Math.random;
    const events = [];
    if (state.directionQueue.length) state.direction = state.directionQueue.shift();
    const vector = vectors[state.direction];
    const head = state.path[0];
    const next = { x: head.x + vector.x, y: head.y + vector.y };
    const ateFood = state.food && next.x === state.food.x && next.y === state.food.y;
    const bodyToCheck = ateFood ? state.path : state.path.slice(0, -1);

    if (!isOpen(state, next) || bodyToCheck.some((part) => part.x === next.x && part.y === next.y)) {
      events.push({ type: "gameOver" });
      return { state, events, alive: false };
    }

    state.path.unshift(next);
    if (!ateFood) state.path.pop();

    if (ateFood) {
      state.foodsEaten += 1;
      state.score += 10 * state.level;
      events.push({ type: "eat" });
      if (state.foodsEaten >= 10 + state.level * 2) {
        state.level += 1;
        state.foodsEaten = 0;
        state.tickMs = Math.max(MIN_TICK_MS, TICK_MS - (state.level - 1) * 7);
        state.score += 100 * state.level;
        events.push({ type: "levelUp", level: state.level, reward: 100 * state.level });
      }
      spawnFood(state, rng);
    }

    return { state, events, alive: true };
  }

  return { vectors, key, TICK_MS, MIN_TICK_MS, isOpen, spawnFood, stepMaze };
});
