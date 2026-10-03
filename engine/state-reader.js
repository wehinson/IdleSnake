// Read-only access to session snapshots. This module stores no game state.
(function attachStateReader(root, factory) {
  const api = factory(typeof require === "function" ? require("./config.js") : root.IdleSnakeConfig);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeStateReader = api;
})(typeof window !== "undefined" ? window : globalThis, (config) => {
  const empty = Object.freeze([]);
  function createStateReader(readFull, readFrame = readFull) {
    const full = () => readFull();
    const frame = () => readFrame() || full();
    const active = () => frame().active || {};
    const mode = () => frame().mode;
    const fields = {
      gameMode: mode, state: () => frame().phase,
      elapsedMs: () => frame().elapsedMs, stepAccumulatorMs: () => frame().modeAccumulatorMs,
      tickMs: () => active().tickMs || 16,
      seedsTotal: () => frame().seeds, provisionsTotal: () => frame().provisions,
      lengthBonus: () => frame().hud.lengthBonus,
      branchesTotal: () => frame().branches, best: () => frame().best,
      upgrades: () => full().upgrades, selectedBoardLevel: () => full().selectedBoardLevel,
      selectedDuelGridSize: () => full().selectedDuelGridSize,
      nursery: () => full().nursery, habitats: () => full().habitats,
      notablesState: () => full().notables, snakebirdProgress: () => full().snakebirdProgress,
      boardMastery: () => Object.freeze(Object.fromEntries(config.boardMasteryConfig.map((item) =>
        [item.boardSize, Boolean(full().notables.masteryRewardsClaimed[item.masteryId])]))),
      grid: () => {
        const a = active();
        if (a.grid) return a.grid;
        if (mode() === "centipede") return Object.freeze({ columns: a.cols, rows: a.rows });
        if (mode() === "snakebird" || mode() === "sokoban") return Object.freeze({ columns: a.width, rows: a.height });
        if (mode() === "breakout" || mode() === "runner") return Object.freeze({ columns: 18, rows: 18 });
        const [columns, rows] = config.upgradeConfig.board.levels[full().selectedBoardLevel].split("x").map(Number);
        return Object.freeze({ columns, rows });
      },
      duelGrid: () => Object.freeze({ columns: full().selectedDuelGridSize, rows: full().selectedDuelGridSize }),
      snake: () => active().snake || active().path || empty,
      runSeedsEarned: () => active().runSeedsEarned || 0,
      foods: () => active().foods || empty, score: () => active().score || 0,
      direction: () => active().direction || "right",
      nextDirection: () => active().nextDirection || active().directionQueue?.at(-1) || active().direction || "right",
      directionQueue: () => active().directionQueue || active().queue || empty,
      shieldLevel: () => full().upgrades?.shieldLevel ?? active().upgrades?.shieldLevel ?? 0,
      shieldImpact: () => active().shieldImpact || null,
      duelPlayer: () => active().player, duelOpponent: () => active().opponent,
      duelFoods: () => active().foods || empty, duelScore: () => active().score || 0,
      duelWinner: () => active().winner,
      mazePath: () => active().path || empty, mazeScore: () => active().score || 0,
      crossingStage: () => active().stage, crossingScore: () => active().score || 0,
      crossingSnake: () => active().snake || empty, crossingCars: () => active().cars || empty,
      crossingPhase: () => active().subphase
    };
    for (const name of ["snakebird", "sokoban", "runner", "breakout", "battleship", "centipede", "broodline", "maze"])
      fields[name] = () => mode() === name ? frame().active : null;
    for (const name of ["crossing", "maze", "breakout", "runner", "centipede", "sokoban", "battleship"])
      fields[`${name}Best`] = () => frame().records[`${name}Best`] || 0;
    return Object.freeze(Object.defineProperties({}, Object.fromEntries(
      Object.entries(fields).map(([name, get]) => [name, { get, enumerable: true }]))));
  }
  return { createStateReader };
});
