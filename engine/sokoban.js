// Headless sokoban minigame — snake-pushes-crates puzzle. Turn-based and pure.
// Port of game.js parseSokobanLevel/sokobanMove and its predicate helpers, with
// the inline HUD/save/render side-effects lifted into a returned events array.
// State shape matches game.js's sokoban object so the host renderer is unchanged.
(function attachSokoban(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeSokoban = engine;
  else root.IdleSnakeSokoban = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const vectors = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  const key = (point) => `${point.x},${point.y}`;
  const clonePoints = (points) => points.map((p) => ({ ...p }));

  function parseLevel(definition, grid, stageIndex) {
    const walls = new Set();
    definition.map.forEach((row, y) => {
      [...row].forEach((cell, x) => { if (cell === "#") walls.add(key({ x, y })); });
    });
    return {
      stageIndex,
      width: grid.columns,
      height: grid.rows,
      walls,
      snake: clonePoints(definition.snake),
      previousSnake: clonePoints(definition.snake),
      crates: definition.crates.map((c) => ({ ...c })),
      previousCrates: definition.crates.map((c) => ({ ...c })),
      goals: clonePoints(definition.goals),
      plates: definition.plates.map((p) => ({ ...p })),
      gates: definition.gates.map((g) => ({ ...g })),
      pellets: clonePoints(definition.pellets),
      totalPellets: definition.pellets.length,
      moves: 0,
      score: 0,
      result: null
    };
  }

  function isWall(state, point) {
    return point.x < 0 || point.x >= state.width || point.y < 0 || point.y >= state.height ||
      state.walls.has(key(point));
  }
  function crateAt(state, point) {
    return state.crates.find((crate) => crate.x === point.x && crate.y === point.y);
  }
  function snakeContains(state, point, includeTail = true) {
    const body = includeTail ? state.snake : state.snake.slice(0, -1);
    return body.some((part) => part.x === point.x && part.y === point.y);
  }
  function gateAt(state, point) {
    return state.gates.find((gate) => gate.x === point.x && gate.y === point.y);
  }
  function plateActive(state, id) {
    const plate = state.plates.find((candidate) => candidate.id === id);
    return Boolean(plate && snakeContains(state, plate));
  }
  function isOpen(state, point) {
    const gate = gateAt(state, point);
    return !isWall(state, point) && (!gate || plateActive(state, gate.id));
  }
  function isGoal(state, point) {
    return state.goals.some((goal) => goal.x === point.x && goal.y === point.y);
  }
  function isBraced(state, directionName) {
    const vector = vectors[directionName];
    const tail = state.snake[state.snake.length - 1];
    if (!tail || !vector) return false;
    return isWall(state, { x: tail.x - vector.x, y: tail.y - vector.y });
  }

  // Attempt a move. Returns { accepted, state, events, won }. Rejected (illegal)
  // moves leave state untouched and accepted=false. Events: move, pellet, crate, win.
  function applyMove(state, directionName) {
    const vector = vectors[directionName];
    if (!vector) return { accepted: false, state, events: [], won: false };

    const head = state.snake[0];
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    const crate = crateAt(state, nextHead);
    const snakeWithoutTail = state.snake.slice(0, -1);

    if (!isOpen(state, nextHead)) return { accepted: false, state, events: [], won: false };
    if (snakeWithoutTail.some((part) => part.x === nextHead.x && part.y === nextHead.y)) {
      return { accepted: false, state, events: [], won: false };
    }

    let nextCratePoint = null;
    if (crate) {
      if (crate.kind === "heavy" && (state.snake.length < 5 || !isBraced(state, directionName))) {
        return { accepted: false, state, events: [], won: false };
      }
      nextCratePoint = { x: crate.x + vector.x, y: crate.y + vector.y };
      const blockedBySnake = snakeWithoutTail.some((part) => part.x === nextCratePoint.x && part.y === nextCratePoint.y);
      const blockedByOtherCrate = state.crates.some((c) => c !== crate && c.x === nextCratePoint.x && c.y === nextCratePoint.y);
      if (!isOpen(state, nextCratePoint) || blockedBySnake || blockedByOtherCrate) {
        return { accepted: false, state, events: [], won: false };
      }
    }

    state.previousSnake = clonePoints(state.snake);
    state.previousCrates = state.crates.map((c) => ({ ...c }));
    state.snake.unshift(nextHead);
    const pelletIndex = state.pellets.findIndex((pellet) => pellet.x === nextHead.x && pellet.y === nextHead.y);
    const grew = pelletIndex >= 0;
    const events = [{ type: "move" }];
    if (grew) { state.pellets.splice(pelletIndex, 1); events.push({ type: "pellet" }); }
    else state.snake.pop();

    if (crate && nextCratePoint) {
      crate.x = nextCratePoint.x;
      crate.y = nextCratePoint.y;
      events.push({ type: "crate" });
    }

    state.moves += 1;
    state.score = state.crates.filter((c) => isGoal(state, c)).length * 100 +
      (state.totalPellets - state.pellets.length) * 10;

    const won = state.crates.every((c) => isGoal(state, c));
    if (won) { state.result = "won"; events.push({ type: "win" }); }

    return { accepted: true, state, events, won };
  }

  return {
    vectors, key, parseLevel,
    isWall, crateAt, snakeContains, gateAt, plateActive, isOpen, isGoal, isBraced,
    applyMove
  };
});
