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

  function isWallHit(grid, point) {
    return point.x < 0 || point.x >= grid.columns || point.y < 0 || point.y >= grid.rows;
  }
  function contains(body, point) {
    return body.some((part) => part.x === point.x && part.y === point.y);
  }
  function nextHead(snakeRef) {
    const vector = vectors[snakeRef.direction];
    return { x: snakeRef.body[0].x + vector.x, y: snakeRef.body[0].y + vector.y };
  }

  function safeDirections(state, snakeRef, otherRef) {
    return Object.keys(vectors).filter((candidate) => {
      const vector = vectors[candidate];
      if (vector.x + vectors[snakeRef.direction].x === 0 && vector.y + vectors[snakeRef.direction].y === 0) return false;
      const point = { x: snakeRef.body[0].x + vector.x, y: snakeRef.body[0].y + vector.y };
      return !isWallHit(state.grid, point) && !contains(snakeRef.body, point) && !contains(otherRef.body, point);
    });
  }

  // Opponent AI: head toward the nearest food along a still-safe direction.
  function chooseOpponentDirection(state) {
    const safe = safeDirections(state, state.opponent, state.player);
    if (safe.length === 0) return;
    const target = state.foods.reduce((closest, food) => {
      const distance = Math.abs(food.x - state.opponent.body[0].x) + Math.abs(food.y - state.opponent.body[0].y);
      return !closest || distance < closest.distance ? { food, distance } : closest;
    }, null);
    safe.sort((a, b) => {
      const aPoint = { x: state.opponent.body[0].x + vectors[a].x, y: state.opponent.body[0].y + vectors[a].y };
      const bPoint = { x: state.opponent.body[0].x + vectors[b].x, y: state.opponent.body[0].y + vectors[b].y };
      if (!target) return 0;
      return (Math.abs(aPoint.x - target.food.x) + Math.abs(aPoint.y - target.food.y)) -
        (Math.abs(bPoint.x - target.food.x) + Math.abs(bPoint.y - target.food.y));
    });
    state.opponent.direction = safe[0];
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

    const playerHead = nextHead(state.player);
    const opponentHead = nextHead(state.opponent);
    const playerFood = state.foods.findIndex((f) => f.x === playerHead.x && f.y === playerHead.y);
    const opponentFood = state.foods.findIndex((f) => f.x === opponentHead.x && f.y === opponentHead.y);

    // Simultaneous resolution: heads/tails leaving their squares this tick
    // shouldn't block unless both heads move into the same square.
    const playerBodyAfterMove = (playerFood >= 0 ? state.player.body : state.player.body.slice(0, -1)).slice(1);
    const opponentBodyAfterMove = (opponentFood >= 0 ? state.opponent.body : state.opponent.body.slice(0, -1)).slice(1);
    const playerCollision = isWallHit(state.grid, playerHead) ||
      contains(playerBodyAfterMove, playerHead) || contains(opponentBodyAfterMove, playerHead);
    const opponentCollision = isWallHit(state.grid, opponentHead) ||
      contains(opponentBodyAfterMove, opponentHead) || contains(playerBodyAfterMove, opponentHead);
    const sameCellHeadOn = playerHead.x === opponentHead.x && playerHead.y === opponentHead.y;
    const headSwap = playerHead.x === state.opponent.body[0].x && playerHead.y === state.opponent.body[0].y &&
      opponentHead.x === state.player.body[0].x && opponentHead.y === state.player.body[0].y;
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
      events.push({ type: "gameOver", winner });
      return { state, events, alive: false, winner };
    }

    state.player.body.unshift(playerHead);
    state.opponent.body.unshift(opponentHead);
    const eatenFoods = new Set();
    if (playerFood >= 0) { state.score += 1; eatenFoods.add(`${playerHead.x},${playerHead.y}`); events.push({ type: "eat" }); }
    else state.player.body.pop();
    if (opponentFood >= 0) eatenFoods.add(`${opponentHead.x},${opponentHead.y}`);
    else state.opponent.body.pop();
    if (eatenFoods.size) state.foods = state.foods.filter((f) => !eatenFoods.has(`${f.x},${f.y}`));
    while (state.foods.length < 5) {
      const placed = spawnFoods(state, 1, rng);
      if (placed.length === 0) break; // board full — can't place more
      state.foods.push(...placed);
    }

    return { state, events, alive: true, winner: null };
  }

  return { vectors, isWallHit, contains, nextHead, safeDirections, chooseOpponentDirection, spawnFoods, stepVsSnake };
});
