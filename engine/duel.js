// Headless duel minigame (VS Snake) — player vs. a food-seeking AI snake with
// simultaneous move resolution. Real-time; the step is pure here. Port of
// game.js stepVsSnake + chooseOpponentDirection + duel helpers + spawnDuelFoods.
// Win rewards/overlay stay host-side (endVsSnake), driven by a gameOver event.
(function attachDuel(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeDuel = engine;
  else root.IdleSnakeDuel = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const vectors = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  const GRID = Object.freeze({ columns: 20, rows: 25 });

  function wrap(grid, point) {
    return { x: (point.x % grid.columns + grid.columns) % grid.columns, y: (point.y % grid.rows + grid.rows) % grid.rows };
  }
  function distance(grid, a, b) {
    const dx = Math.abs(a.x - b.x); const dy = Math.abs(a.y - b.y);
    return Math.min(dx, grid.columns - dx) + Math.min(dy, grid.rows - dy);
  }

  function isWallHit(grid, point) {
    return point.x < 0 || point.x >= grid.columns || point.y < 0 || point.y >= grid.rows;
  }
  function contains(body, point) {
    return body.some((part) => part.x === point.x && part.y === point.y);
  }
  function nextHead(snakeRef, grid, direction = snakeRef.direction) {
    const vector = vectors[direction];
    return wrap(grid, { x: snakeRef.body[0].x + vector.x, y: snakeRef.body[0].y + vector.y });
  }

  function safeDirections(state, snakeRef, otherRef) {
    return Object.keys(vectors).filter((candidate) => {
      const vector = vectors[candidate];
      if (vector.x + vectors[snakeRef.direction].x === 0 && vector.y + vectors[snakeRef.direction].y === 0) return false;
      const point = nextHead(snakeRef, state.grid, candidate);
      return !contains(snakeRef.body, point) && !contains(otherRef.body, point);
    });
  }

  // Opponent AI: head toward the nearest food along a still-safe direction.
  function chooseOpponentDirection(state) {
    const safe = safeDirections(state, state.opponent, state.player);
    if (safe.length === 0) return;
    const target = state.foods.reduce((closest, food) => {
      const foodDistance = distance(state.grid, food, state.opponent.body[0]);
      return !closest || foodDistance < closest.distance ? { food, distance: foodDistance } : closest;
    }, null);
    const exits = (candidate) => {
      const point = nextHead(state.opponent, state.grid, candidate);
      const remaining = contains(state.foods, point) ? state.opponent.body : state.opponent.body.slice(0, -1);
      return Object.keys(vectors).filter((direction) => {
        const v = vectors[direction]; const forward = vectors[candidate];
        if (v.x + forward.x === 0 && v.y + forward.y === 0) return false;
        const next = wrap(state.grid, { x: point.x + v.x, y: point.y + v.y });
        return !contains(remaining, next) && !contains(state.player.body, next);
      }).length;
    };
    const viable = safe.filter((direction) => exits(direction) > 0);
    // A single lookahead avoids greedy closed pockets without a perfect pathfinder.
    const candidates = viable.length ? viable : safe;
    candidates.sort((a, b) => {
      const aPoint = nextHead(state.opponent, state.grid, a);
      const bPoint = nextHead(state.opponent, state.grid, b);
      if (!target) return 0;
      return distance(state.grid, aPoint, target.food) - distance(state.grid, bPoint, target.food);
    });
    state.aiTicks = (state.aiTicks || 0) + 1;
    let chosen = candidates[0];
    // Occasionally keep a safe heading instead of chasing a Seed. Limit the
    // detour to two cells, so the handicap never substitutes reckless collisions.
    if (target && state.aiTicks % 13 === 0 && candidates.includes(state.opponent.direction)) {
      const straight = nextHead(state.opponent, state.grid);
      const best = nextHead(state.opponent, state.grid, chosen);
      if (distance(state.grid, straight, target.food) <= distance(state.grid, best, target.food) + 2) chosen = state.opponent.direction;
    }
    state.opponent.direction = chosen;
  }

  function spawnFoods(state, count, rng) {
    const foodsToPlace = [];
    let guard = 0;
    while (foodsToPlace.length < count && guard < 10000) {
      guard += 1;
      const point = { x: Math.floor(rng() * state.grid.columns), y: Math.floor(rng() * state.grid.rows) };
      const occupied = [...state.player.body, ...state.opponent.body, ...state.foods, ...foodsToPlace];
      if (!occupied.some((part) => part.x === point.x && part.y === point.y)) foodsToPlace.push(point);
    }
    return foodsToPlace;
  }

  // One duel tick. State: { grid, player:{body,direction}, opponent:{body,direction},
  // foods, score, directionQueue, direction, nextDirection }. Returns { state,
  // events, alive, winner }. Events: eat, gameOver{winner}.
  function stepVsSnake(state, ctx) {
    const rng = (ctx && ctx.rng) || Math.random;
    const events = [];

    if (state.directionQueue.length > 0) {
      state.player.direction = state.directionQueue.shift();
      state.direction = state.player.direction;
      state.nextDirection = state.directionQueue.length > 0
        ? state.directionQueue[state.directionQueue.length - 1]
        : state.direction;
    }
    chooseOpponentDirection(state);

    const playerHead = nextHead(state.player, state.grid);
    const opponentHead = nextHead(state.opponent, state.grid);
    const playerFood = state.foods.findIndex((f) => f.x === playerHead.x && f.y === playerHead.y);
    const opponentFood = state.foods.findIndex((f) => f.x === opponentHead.x && f.y === opponentHead.y);

    const headSwap = playerHead.x === state.opponent.body[0].x && playerHead.y === state.opponent.body[0].y &&
      opponentHead.x === state.player.body[0].x && opponentHead.y === state.player.body[0].y;
    // A vacated tail is safe unless growing. Old heads become body segments;
    // a simultaneous head swap is resolved by the dedicated head-on rule.
    const playerBodyAfterMove = (playerFood >= 0 ? state.player.body : state.player.body.slice(0, -1)).slice(headSwap ? 1 : 0);
    const opponentBodyAfterMove = (opponentFood >= 0 ? state.opponent.body : state.opponent.body.slice(0, -1)).slice(headSwap ? 1 : 0);
    const playerCollision =
      contains(playerBodyAfterMove, playerHead) || contains(opponentBodyAfterMove, playerHead);
    const opponentCollision =
      contains(opponentBodyAfterMove, opponentHead) || contains(playerBodyAfterMove, opponentHead);
    const sameCellHeadOn = playerHead.x === opponentHead.x && playerHead.y === opponentHead.y;
    const headToHead = sameCellHeadOn || headSwap;

    if (playerCollision || opponentCollision || headToHead) {
      let winner;
      if (headToHead && !playerCollision && !opponentCollision) {
        winner = state.player.body.length > state.opponent.body.length ? "player"
          : state.opponent.body.length > state.player.body.length ? "opponent" : null;
      } else {
        winner = playerCollision && !opponentCollision ? "opponent"
          : opponentCollision && !playerCollision ? "player" : null;
      }
      const collisions = [];
      const record = (actor, point, ownBody, hit) => {
        if (hit) collisions.push({ actor, point: { ...point }, kind: contains(ownBody, point) ? "self" : "other" });
        else if (headToHead && (winner === null || winner !== actor)) collisions.push({ actor, point: { ...point }, kind: "headOn" });
      };
      record("player", playerHead, playerBodyAfterMove, playerCollision);
      record("opponent", opponentHead, opponentBodyAfterMove, opponentCollision);
      state.outcome = { winner, collisions, playerHead: { ...playerHead }, opponentHead: { ...opponentHead } };
      events.push({ type: "gameOver", ...state.outcome });
      return { state, events, alive: false, ...state.outcome };
    }

    state.player.body.unshift(playerHead);
    state.opponent.body.unshift(opponentHead);
    const eatenFoods = new Set();
    if (playerFood >= 0) { state.score += 1; eatenFoods.add(`${playerHead.x},${playerHead.y}`); events.push({ type: "eat" }); }
    else state.player.body.pop();
    if (opponentFood >= 0) { state.opponentSeeds = (state.opponentSeeds || 0) + 1; eatenFoods.add(`${opponentHead.x},${opponentHead.y}`); }
    else state.opponent.body.pop();
    if (eatenFoods.size) state.foods = state.foods.filter((f) => !eatenFoods.has(`${f.x},${f.y}`));
    while (state.foods.length < 5) {
      const placed = spawnFoods(state, 1, rng);
      if (placed.length === 0) break; // board full — can't place more
      state.foods.push(...placed);
    }

    return { state, events, alive: true, winner: null };
  }

  return { GRID, vectors, wrap, distance, isWallHit, contains, nextHead, safeDirections, chooseOpponentDirection, spawnFoods, stepVsSnake };
});
