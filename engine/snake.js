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
  const { startTickMs, maxQueuedDirections } = snakeConfig;

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

  // Mastery fills the complete board. The initial segments already occupy
  // cells, so only the remaining area must be earned through Seed pickups.
  function masteryScore(grid, startingLength = 3) {
    const columns = Math.max(0, Math.floor(Number(grid && grid.columns) || 0));
    const rows = Math.max(0, Math.floor(Number(grid && grid.rows) || 0));
    const cells = columns * rows;
    return Math.max(0, cells - Math.max(0, Math.floor(Number(startingLength) || 0)));
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

  function foodPlacementWeight(foods, point) {
    let weight = 1;
    for (const food of foods) {
      if (food.kind === "egg") continue;
      const distance = Math.max(Math.abs(point.x - food.x), Math.abs(point.y - food.y));
      if (distance === 1) return 0.1;
      if (distance === 2) weight = 0.2;
    }
    return weight;
  }

  function placeFood(state, rng) {
    const { snake, foods, grid } = state;
    const occupied = new Set([
      ...snake.map((part) => `${part.x},${part.y}`),
      ...foods.map((snack) => `${snack.x},${snack.y}`)
    ]);
    const open = [];
    let totalWeight = 0;
    for (let y = 0; y < grid.rows; y += 1) {
      for (let x = 0; x < grid.columns; x += 1) {
        if (occupied.has(`${x},${y}`)) continue;
        const point = { x, y };
        const weight = foodPlacementWeight(foods, point);
        open.push({ point, weight });
        totalWeight += weight;
      }
    }
    if (open.length === 0) return null;
    let draw = Math.min(Math.max(Number(rng()) || 0, 0), 1 - Number.EPSILON) * totalWeight;
    for (const candidate of open) {
      draw -= candidate.weight;
      if (draw < 0) return candidate.point;
    }
    return open.at(-1).point;
  }

  function seedFoodCount(state) {
    return state.foods.filter((snack) => snack.kind !== "egg").length;
  }

  function spawnSeed(state, rng) {
    const seed = placeFood(state, rng);
    if (!seed) return false;
    state.foods.push({ ...seed, kind: "seed" });
    if (state.eggBoard && rng() < snakeConfig.eggSpawnChance) {
      const egg = placeFood(state, rng);
      if (egg) state.foods.push({ ...egg, kind: "egg" });
    }
    return true;
  }

  function spawnFoods(state, rng) {
    state.foods = [];
    while (seedFoodCount(state) < foodCount(state.upgrades) && spawnSeed(state, rng)) { /* fill seed slots */ }
    return state.foods;
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
    if (state.directionQueue.length >= maxQueuedDirections) return false;
    state.directionQueue.push(next);
    state.nextDirection = next;
    return true;
  }

  // A shield owns its safe redirect until the impact sequence ends. Inputs made
  // during that pause are kept behind the redirect and run on later ticks.
  function queueDirectionAfterShield(state, next) {
    if (!state.shieldImpact || !vectors[next]) return false;
    const queuedFrom = state.directionQueue.at(-1) || state.shieldImpact.redirectDirection;
    if (next === queuedFrom) return false;
    const currentVector = vectors[queuedFrom];
    const nextVector = vectors[next];
    if (currentVector.x + nextVector.x === 0 && currentVector.y + nextVector.y === 0) return false;
    if (state.directionQueue.length >= maxQueuedDirections) return false;
    state.directionQueue.push(next);
    state.nextDirection = next;
    return true;
  }

  // Immediate session turns validate against the last completed move.
  // A second perpendicular input can therefore complete a quick U-turn.
  function turnDirection(state, next) {
    if (!vectors[next] || next === state.direction) return false;
    const current = vectors[state.direction];
    const target = vectors[next];
    if (current.x + target.x === 0 && current.y + target.y === 0) return false;
    state.direction = next;
    state.nextDirection = next;
    state.directionQueue = [];
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
    const boardLevel = Math.max(0, upgradeConfig.board.levels.indexOf(`${grid.columns}x${grid.rows}`));
    // This baseline keeps board scaling separate from food acceleration.
    // movementInterval applies the preset to this starting speed, before the curve.
    const initialTickMs = opts.tickMs || startTickMs / (1 + boardLevel * snakeConfig.boardSpeedIncreasePerLevel);
    const state = {
      grid,
      snake: body,
      foods: [],
      direction,
      nextDirection: direction,
      directionQueue: [],
      collisionGraceRemainingMs: null,
      shieldImpact: null,
      lastTurn: 0,
      score: 0,
      initialTickMs,
      speedMultiplier: opts.speedMultiplier || 1,
      tickMs: initialTickMs / (opts.speedMultiplier || 1),
      upgrades: opts.upgrades || { foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0 },
      seeds: opts.seeds || 0,
      runSeedsEarned: 0,
      best: opts.best || 0,
      eggBoard: Boolean(opts.eggBoard)
    };
    state.tickMs = movementInterval(state);
    spawnFoods(state, rng);
    return state;
  }

  function accelerationProgress(score, target) {
    const boardProgress = Math.max(0, Number(score) || 0) / Math.max(1, Number(target) || 1);
    const start = snakeConfig.accelerationStartProgress;
    const asymptote = snakeConfig.accelerationAsymptoteProgress;
    const midpoint = (start + asymptote) / 2;
    // Put 10% and 90% of the raw logistic curve at the configured knees.
    const steepness = (2 * Math.log(9)) / (asymptote - start);
    const logistic = (progress) => 1 / (1 + Math.exp(-steepness * (progress - midpoint)));
    const baseline = logistic(0);
    return Math.max(0, Math.min(1, (logistic(boardProgress) - baseline) / (1 - baseline)));
  }

  // Preset and board determine both the starting speed and its asymptote.
  function movementInterval(state) {
    const startingSpeed = 1000 / (state.initialTickMs || startTickMs) * (state.speedMultiplier || 1);
    const maximumSpeed = startingSpeed * snakeConfig.maximumSpeedMultiplier;
    const food = Math.max(0, state.score || 0);
    const progress = accelerationProgress(food, masteryScore(state.grid));
    return 1000 / (startingSpeed + (maximumSpeed - startingSpeed) * progress);
  }

  function setSpeedMultiplier(state, multiplier) {
    state.speedMultiplier = multiplier;
    state.tickMs = movementInterval(state);
  }

  function turnSign(from, to) {
    const order = ["up", "right", "down", "left"];
    const delta = (order.indexOf(to) - order.indexOf(from) + 4) % 4;
    return delta === 1 ? 1 : delta === 3 ? -1 : 0;
  }

  function nextMoveInterval(state) {
    if (!snakeConfig.turnTimingEnabled) return state.tickMs;
    const queued = state.directionQueue[0];
    const turn = queued ? turnSign(state.direction, queued) : 0;
    return state.tickMs * (turn !== 0 && turn === state.lastTurn ? 0.5 : 1);
  }

  function canMoveDirection(state, direction) {
    const vector = vectors[direction];
    if (!vector) return false;
    const head = state.snake[0];
    const next = { x: head.x + vector.x, y: head.y + vector.y };
    return !isWallHit(state.grid, next) && !isSnakeHit(state.snake, next, false);
  }

  // Advance the snake one grid step. Returns { state, events, alive }.
  // Events: eat, seedsChanged, shield, speedChanged, bestScore, gameOver, win.
  function stepSnake(state, ctx) {
    ctx = ctx || {};
    const rng = ctx.rng || Math.random;
    const events = [];

    if (state.shieldImpact) {
      const impact = state.shieldImpact;
      impact.ticksElapsed += 1;
      impact.ticksRemaining -= 1;
      if (impact.ticksRemaining > 0) {
        events.push({ type: "shieldImpactTick", ticksRemaining: impact.ticksRemaining });
        return { state, events, alive: true };
      }
      state.direction = impact.redirectDirection;
      state.nextDirection = state.directionQueue.at(-1) || state.direction;
      state.shieldImpact = null;
      events.push({ type: "shieldRedirected", from: impact.incomingDirection, to: impact.redirectDirection });
    } else if (state.directionQueue.length > 0) {
      state.direction = state.directionQueue.shift();
      state.nextDirection = state.directionQueue.length > 0
        ? state.directionQueue[state.directionQueue.length - 1]
        : state.direction;
    }

    const head = state.snake[0];
    const vector = vectors[state.direction];
    let nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    const collision = isWallHit(state.grid, nextHead) || isSnakeHit(state.snake, nextHead, false);

    if (collision) {
      const redirect = findShieldRedirect(state);
      if (redirect) {
        state.upgrades.shieldLevel -= 1;
        state.nextDirection = redirect.direction;
        state.directionQueue = [];
        state.shieldImpact = {
          incomingDirection: state.direction,
          redirectDirection: redirect.direction,
          collisionPoint: nextHead,
          ticksElapsed: 0,
          ticksRemaining: 3
        };
        events.push({ type: "shield", incomingDirection: state.direction, redirectDirection: redirect.direction, collisionPoint: nextHead });
        return { state, events, alive: true };
      } else {
        if (ctx.collisionGraceMs > 0) {
          state.collisionGraceRemainingMs = ctx.collisionGraceMs;
          state.directionQueue = [];
          state.nextDirection = state.direction;
          events.push({ type: "collisionPending" });
          return { state, events, alive: true };
        }
        state.collisionGraceRemainingMs = null;
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
    let respawnSeed = false;

    if (willEat) {
      const eaten = state.foods[eatenFoodIndex];
      state.foods.splice(eatenFoodIndex, 1);
      if (eaten.kind === "egg") {
        events.push({ type: "eggCollected", at: nextHead });
      } else {
        state.score += 1;
        const gained = foodValue(state.upgrades);
        state.seeds += gained;
        state.runSeedsEarned = (state.runSeedsEarned || 0) + gained;
        state.tickMs = movementInterval(state);
        events.push({ type: "eat", value: gained, at: nextHead });
        events.push({ type: "seedsChanged" });
        events.push({ type: "speedChanged", tickMs: state.tickMs });
        respawnSeed = true;
      }
    }

    if (!willEat) {
      state.snake.pop();
    }

    if (respawnSeed) {
      spawnSeed(state, rng);
      // Near a full board there may not be enough room to replenish every
      // unlocked food slot. Keep the seeds that fit, then finish when the
      // snake fills the complete board.
      if (state.score >= masteryScore(state.grid)) {
        state.phase = "gameover";
        state.best = Math.max(state.best, state.score);
        events.push({ type: "bestScore", best: state.best });
        events.push({ type: "win" });
        return { state, events, alive: false };
      }
    }

    return { state, events, alive: true };
  }

  return {
    vectors,
    parseGridSize,
    masteryScore,
    accelerationProgress,
    foodValue,
    foodCount,
    isWallHit,
    isSnakeHit,
    placeFood,
    foodPlacementWeight,
    seedFoodCount,
    spawnSeed,
    spawnFoods,
    findShieldRedirect,
    queueDirection,
    queueDirectionAfterShield,
    turnDirection,
    createSnakeMode,
    setSpeedMultiplier,
    movementInterval,
    canMoveDirection,
    turnSign,
    nextMoveInterval,
    stepSnake
  };
});
