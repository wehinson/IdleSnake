// Headless crossing minigame ("Snakeger" — Frogger-style road crossing).
// Real-time; the active-phase step is pure here. Port of game.js stepCrossing's
// play phase + updateCrossingCars + isCrossingCarHit. The clearing-phase timing
// (now-based pause between stages) and overlays/saves stay host-side.
(function attachCrossing(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeCrossing = engine;
  else root.IdleSnakeCrossing = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const vectors = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };

  function isWallHit(grid, point) {
    return point.x < 0 || point.x >= grid.columns || point.y < 0 || point.y >= grid.rows;
  }

  // The crossing snake enters from below the bottom bank. Keeping its staged
  // tail cells deliberate gives every new stage the same clean starting shape.
  function buildEntrySnake(grid, entryColumn, snakeLength) {
    return Array.from({ length: snakeLength }, (_, index) => ({ x: entryColumn, y: grid.rows - 1 + index }));
  }

  // Advance every car and wrap it around the board width.
  function updateCars(state) {
    state.cars.forEach((car) => {
      car.x += car.speed;
      while (car.x >= state.grid.columns) car.x -= state.grid.columns;
      while (car.x + car.width <= 0) car.x += state.grid.columns;
    });
  }

  // Collision test with the inset hitbox (matches drawCrossingCar's visual inset).
  function isCarHit(state) {
    const carMargin = 0.18;
    return state.snake.some((part) => state.cars.some((car) => {
      if (car.row !== part.y) return false;
      return [-state.grid.columns, 0, state.grid.columns].some((offset) => {
        const left = car.x + offset + carMargin;
        const right = car.x + offset + car.width - carMargin;
        return part.x + 1 > left && part.x < right;
      });
    }));
  }

  // One active-phase tick. State: { grid, snake, cars, score, stage, snakeLength,
  // entryColumn, direction, nextDirection, directionQueue }. Returns { state,
  // events, alive }. Events: carHit, idle, wall, move, stageClear{reward}.
  function stepCrossing(state) {
    updateCars(state);
    if (isCarHit(state)) return { state, events: [{ type: "carHit" }], alive: false };

    if (state.directionQueue.length === 0) {
      return { state, events: [{ type: "idle" }], alive: true };
    }
    state.direction = state.directionQueue.shift();
    state.nextDirection = state.directionQueue.length > 0
      ? state.directionQueue[state.directionQueue.length - 1]
      : state.direction;

    const head = state.snake[0];
    const vector = vectors[state.direction];
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    if (isWallHit(state.grid, nextHead)) {
      return { state, events: [{ type: "wall" }], alive: true };
    }

    state.snake.unshift(nextHead);
    state.snake.pop(); // fixed length while crossing lanes
    state.entryColumn = state.snake[0].x;

    if (isCarHit(state)) return { state, events: [{ type: "carHit" }], alive: false };

    const events = [{ type: "move" }];
    if (nextHead.y === 0) {
      state.snakeLength += 1;
      state.snake.push({ ...state.snake[state.snake.length - 1] });
      const reward = 10 + state.stage * 5;
      state.score += state.stage * 100;
      events.push({ type: "stageClear", reward });
    }
    return { state, events, alive: true };
  }

  return { vectors, isWallHit, buildEntrySnake, updateCars, isCarHit, stepCrossing };
});
