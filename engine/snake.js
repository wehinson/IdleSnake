// Headless core snake mode: movement, collision, food spawning, body/score,
// shield redirect. Pure port of game.js step()/placeFood()/spawnFoods()/
// isWallHit()/isSnakeHit()/findShieldRedirect(), with inline HUD/save side
// effects lifted into a returned `events` array.
//
// Operates on the shared world state (reads/writes `seeds`, `best`, `upgrades`
// alongside the snake-specific fields) so it drops straight into the unified
// tick. No DOM, no globals, no Math.random except through an injected rng.
(function attachSnakeMode(root, factory) {
  const engine = factory(
    typeof require === "function" ? require("./config.js") : (root.IdleSnakeConfig || {})
  );
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeSnake = engine;
  else root.IdleSnakeSnake = engine;
})(typeof window !== "undefined" ? window : globalThis, (config) => {
  const { snakeConfig, upgradeConfig } = config;
  const { startTickMs, minTickMs, maxQueuedDirections } = snakeConfig;

  const vectors = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  function parseGridSize(text) {
    const [columns, rows] = String(text).split("x").map((value) => Number(value));
    return { columns, rows };
  }

  function foodValue(upgrades) {
    const level = Math.max(0, Math.min(upgradeConfig.foodType.levels.length - 1, Math.floor(upgrades.foodTypeLevel || 0)));
    return upgradeConfig.foodType.levels[level].value;
  }

  function foodCount(upgrades) {
    return upgradeConfig.foodCount.baseCount + (upgrades.foodCountLevel || 0);
  }

  function isWallHit(grid, point) {
    return point.x < 0 || point.x >= grid.columns || point.y < 0 || point.y >= grid.rows;
  }

  function isSnakeHit(snake, point, willGrow) {
    const body = willGrow ? snake : snake.slice(0, -1);
    return body.some((part) => part.x === point.x && part.y === point.y);
  }

  function placeFood(state, rng) {
    const { snake, foods, grid } = state;
    const occupied = new Set([
      ...snake.map((part) => `${part.x},${part.y}`),
      ...foods.map((snack) => `${snack.x},${snack.y}`)
    ]);
    const open = [];
    for (let y = 0; y < grid.rows; y += 1) {
      for (let x = 0; x < grid.columns; x += 1) {
        if (!occupied.has(`${x},${y}`)) open.push({ x, y });
      }
    }
    if (open.length === 0) return null;
    return open[Math.floor(rng() * open.length)];
  }

  function spawnFoods(state, rng) {
    const spawned = [];
    state.foods = spawned;
    while (spawned.length < foodCount(state.upgrades)) {
      const snack = placeFood(state, rng);
      if (!snack) break;
      spawned.push(snack);
    }
    return spawned;
  }

  function obstacleClearance(state, point, vector) {
    let distance = 0;
    let probe = point;
    while (!isWallHit(state.grid, probe) && !isSnakeHit(state.snake, probe, false)) {
      distance += 1;
      probe = { x: probe.x + vector.x, y: probe.y + vector.y };
    }
    return distance;
  }

  function findShieldRedirect(state) {
    if ((state.upgrades.shieldLevel || 0) <= 0) return null;
    const turnDirections = state.direction === "up" || state.direction === "down"
      ? ["left", "right"]
      : ["up", "down"];
    const candidates = turnDirections.map((candidateDirection) => {
      const vector = vectors[candidateDirection];
      const point = { x: state.snake[0].x + vector.x, y: state.snake[0].y + vector.y };
      return { direction: candidateDirection, point, clearance: obstacleClearance(state, point, vector) };
    }).filter((candidate) => candidate.clearance > 0);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.clearance - a.clearance);
    return candidates[0];
  }

  // Classic-mode direction queue with reversal guard (game.js queueDirection).
  function queueDirection(state, next) {
    if (!vectors[next]) return false;
    const queuedFrom = state.directionQueue.length > 0
      ? state.directionQueue[state.directionQueue.length - 1]
      : state.direction;
    if (next === queuedFrom) return false;
    const currentVector = vectors[queuedFrom];
    const nextVector = vectors[next];
    if (currentVector.x + nextVector.x === 0 && currentVector.y + nextVector.y === 0) return false;
    if (state.directionQueue.length >= maxQueuedDirections) state.directionQueue.shift();
    state.directionQueue.push(next);
    state.nextDirection = next;
    return true;
  }

  // Build a ready-to-run classic snake mode for the given grid.
  function createSnakeMode(grid, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const startX = Math.floor(grid.columns / 2);
    const startY = Math.floor(grid.rows / 2);
    // The host may inject its exact starting layout/direction/tickMs for parity;
    // otherwise use the engine's default (centered, facing up).
    const body = Array.isArray(opts.snake) && opts.snake.length
      ? opts.snake.map((part) => ({ x: part.x, y: part.y }))
      : [
          { x: startX, y: startY },
          { x: startX, y: startY + 1 },
          { x: startX, y: startY + 2 }
        ];
    const direction = opts.direction && vectors[opts.direction] ? opts.direction : "up";
    const state = {
      grid,
      snake: body,
      foods: [],
      direction,
      nextDirection: direction,
      directionQueue: [],
      score: 0,
      tickMs: opts.tickMs || startTickMs,
      upgrades: opts.upgrades || { foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0 },
      seeds: opts.seeds || 0,
      best: opts.best || 0
    };
    spawnFoods(state, rng);
    return state;
  }

  // Advance the snake one grid step. Returns { state, events, alive }.
  // Events: eat, seedsChanged, shield, speedChanged, bestScore, gameOver, win.
  function stepSnake(state, ctx) {
    ctx = ctx || {};
    const rng = ctx.rng || Math.random;
    const events = [];

    if (state.directionQueue.length > 0) {
      state.direction = state.directionQueue.shift();
      state.nextDirection = state.directionQueue.length > 0
        ? state.directionQueue[state.directionQueue.length - 1]
        : state.direction;
    }

    const head = state.snake[0];
    const vector = vectors[state.direction];
    let nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    let shieldRedirected = false;
    const collision = isWallHit(state.grid, nextHead) || isSnakeHit(state.snake, nextHead, false);

    if (collision) {
      const redirect = findShieldRedirect(state);
      if (redirect) {
        state.upgrades.shieldLevel -= 1;
        state.direction = redirect.direction;
        state.nextDirection = redirect.direction;
        state.directionQueue = [];
        nextHead = redirect.point;
        shieldRedirected = true;
        events.push({ type: "shield" });
      } else {
        state.phase = "gameover";
        if (state.score > state.best) {
          state.best = state.score;
          events.push({ type: "bestScore", best: state.best });
        }
        events.push({ type: "gameOver" });
        return { state, events, alive: false };
      }
    }

    const eatenFoodIndex = state.foods.findIndex((snack) => snack.x === nextHead.x && snack.y === nextHead.y);
    const willEat = eatenFoodIndex >= 0;
    state.snake.unshift(nextHead);

    if (willEat) {
      state.score += 1;
      const gained = foodValue(state.upgrades);
      state.seeds += gained;
      state.tickMs = Math.max(minTickMs, startTickMs - state.score * 2.8);
      state.foods.splice(eatenFoodIndex, 1);
      events.push({ type: "eat", value: gained, at: nextHead });
      events.push({ type: "seedsChanged" });
      events.push({ type: "speedChanged", tickMs: state.tickMs });
      const replacement = placeFood(state, rng);
      if (replacement) state.foods.push(replacement);
      if (state.foods.length < foodCount(state.upgrades)) {
        state.phase = "gameover";
        state.best = Math.max(state.best, state.score);
        events.push({ type: "bestScore", best: state.best });
        events.push({ type: "win" });
        return { state, events, alive: false };
      }
    } else {
      state.snake.pop();
    }

    if (shieldRedirected) events.push({ type: "hudDirty" });
    return { state, events, alive: true };
  }

  return {
    vectors,
    parseGridSize,
    foodValue,
    foodCount,
    isWallHit,
    isSnakeHit,
    placeFood,
    spawnFoods,
    findShieldRedirect,
    queueDirection,
    createSnakeMode,
    stepSnake
  };
});
