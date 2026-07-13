(function attachSnakebirdEngine(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.SnakebirdEngine = engine;
  else root.SnakebirdEngine = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const vectors = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  function key(point) {
    return `${point.x},${point.y}`;
  }

  function parseLevel(map) {
    const height = map.length;
    const width = map[0].length;
    const solids = new Set();
    const fruits = new Set();
    const body = [];
    let exit = null;

    map.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        const point = { x, y };
        if (cell === "#") solids.add(key(point));
        if (cell === "F") fruits.add(key(point));
        if (cell === "G") exit = point;
        if (cell === "H") body.unshift(point);
        if (cell === "o") body.push(point);
      });
    });

    return { width, height, solids, fruits, exit, body, moves: 0, result: null };
  }

  function bodyContains(body, point) {
    return body.some((part) => part.x === point.x && part.y === point.y);
  }

  function isSolid(state, point) {
    return point.x < 0 || point.x >= state.width || point.y < 0 || point.y >= state.height ||
      state.solids.has(key(point));
  }

  function settleGravity(state) {
    const next = {
      ...state,
      body: state.body.map((part) => ({ ...part }))
    };

    while (true) {
      if (next.body.some((part) => part.y >= next.height)) return { state: next, fell: true };
      const canFall = next.body.every((part) => {
        const below = { x: part.x, y: part.y + 1 };
        return !next.solids.has(key(below));
      });
      if (!canFall) return { state: next, fell: false };
      next.body = next.body.map((part) => ({ x: part.x, y: part.y + 1 }));
    }
  }

  function applyMove(state, directionName) {
    const vector = vectors[directionName];
    if (!vector) return { accepted: false, state };

    const head = state.body[0];
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    const fruitKey = key(nextHead);
    const ateFruit = state.fruits.has(fruitKey);
    const bodyToCheck = ateFruit ? state.body : state.body.slice(0, -1);
    if (isSolid(state, nextHead) || bodyContains(bodyToCheck, nextHead)) {
      return { accepted: false, state };
    }

    const next = {
      ...state,
      body: [nextHead, ...state.body.slice(0, ateFruit ? state.body.length : -1)],
      fruits: new Set(state.fruits),
      moves: state.moves + 1
    };
    if (ateFruit) next.fruits.delete(fruitKey);

    const settled = settleGravity(next);
    return {
      accepted: true,
      state: settled.state,
      fell: settled.fell,
      ateFruit
    };
  }

  function isComplete(state) {
    const head = state.body[0];
    return Boolean(head && state.exit && state.fruits.size === 0 && head.x === state.exit.x && head.y === state.exit.y);
  }

  function normalizeProgress(saved = {}, levelCount = 5) {
    saved = saved && typeof saved === "object" ? saved : {};
    const clearedLevels = Array.from({ length: levelCount }, (_, index) => Boolean(saved.clearedLevels?.[index]));
    const bestMoves = Array.from({ length: levelCount }, (_, index) => {
      const value = Number(saved.bestMoves?.[index]);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
    });
    let unlockedLevel = 1;
    while (unlockedLevel < levelCount && clearedLevels[unlockedLevel - 1]) unlockedLevel += 1;
    const requestedLevel = Math.floor(Number(saved.lastSelectedLevel) || 1);
    return {
      unlockedLevel,
      clearedLevels,
      bestMoves,
      lastSelectedLevel: Math.max(1, Math.min(unlockedLevel, requestedLevel))
    };
  }

  function recordCompletion(saved, levelIndex, moves, levelCount, firstClearReward, replayReward) {
    const progress = normalizeProgress(saved, levelCount);
    const index = Math.max(0, Math.min(levelCount - 1, Math.floor(levelIndex)));
    const firstClear = !progress.clearedLevels[index];
    progress.clearedLevels[index] = true;
    progress.unlockedLevel = Math.max(progress.unlockedLevel, Math.min(levelCount, index + 2));
    if (progress.bestMoves[index] === null || moves < progress.bestMoves[index]) progress.bestMoves[index] = moves;
    return { progress, firstClear, reward: firstClear ? firstClearReward : replayReward };
  }

  return { key, parseLevel, bodyContains, isSolid, settleGravity, applyMove, isComplete, normalizeProgress, recordCompletion };
});
