// Legacy storage projection. The browser supplies time and display defaults.
(function attachSaveProjection(root, factory) {
  const api = factory(typeof require === "function" ? require("./config.js") : root.IdleSnakeConfig);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeSaveProjection = api;
})(typeof window !== "undefined" ? window : globalThis, (config) => {
  function create({ now, mobileControlsDefault, saveVersion: SAVE_VERSION, legacySaveVersion: LEGACY_SAVE_VERSION }) {
    function clampNumber(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function buildDefaultSaveState() {
  return {
    saveVersion: LEGACY_SAVE_VERSION,
    savedAt: now,
    currencies: { seeds: 0, provisions: 0, branches: 0 },
    upgrades: { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 0, lengthBonusLevel: 0 },
    board: { selectedBoardLevel: 0, selectedDuelGridSize: 30, mastery: {} },
    records: { best: 0, crossingBest: 0, mazeBest: 0, breakoutBest: 0, runnerBest: 0, sokobanBest: 0, battleshipBest: 0, centipedeBest: 0 },
    settings: { snakeColors: { body: null, head: null }, mobileControls: mobileControlsDefault },
    nursery: { nestStartedAt: null, hatchlings: [], colonyCount: 0, resupplyEggHolding: 0, lastUpdatedAt: now, seedTickAccumulatorMs: 0, movementAccumulatorMs: 0 },
    habitats: { counts: [], upgradeLevels: [], lastUpdatedAt: now },
    notables: { retained: [], elders: [], pending: [], dismissedCount: 0, directRecruitmentsCompleted: 0, masteryRewardsClaimed: {}, nextId: 1 },
    snakebird: { unlockedLevel: 1, clearedLevels: [], bestMoves: [], lastSelectedLevel: 1 },
    // Reserved placeholders for systems that don't exist yet (routes, world
    // regions, seasons, migration, prestige, accessibility). Never mutated by
    // current game logic; they only round-trip through save/load so a future
    // feature can start using them without a save-breaking migration.
    tradeRoutes: [],
    activeResupplyMissions: [],
    completedResupplyMissions: [],
    resupplyTotals: { completedMissions: 0, notablesDelivered: 0, adultsDelivered: 0, eggsDelivered: 0, provisionsConsumed: 0 },
    nextResupplyMissionId: 1,
    eggBoardCountdown: null,
    regions: [],
    season: null,
    migration: null,
    prestigeHistory: [],
    accessibility: { reducedMotion: false }
  };
}

function normalizeSaveState(saved) {
  const base = buildDefaultSaveState();
  if (!saved || typeof saved !== "object") return base;
  return {
    ...base,
    ...saved,
    saveVersion: LEGACY_SAVE_VERSION,
    currencies: { ...base.currencies, ...saved.currencies },
    upgrades: { ...base.upgrades, ...saved.upgrades },
    board: {
      ...base.board,
      ...saved.board,
      mastery: saved.board?.mastery && typeof saved.board.mastery === "object" ? saved.board.mastery : {}
    },
    records: { ...base.records, ...saved.records },
    settings: {
      ...base.settings,
      ...saved.settings,
      snakeColors: { ...base.settings.snakeColors, ...saved.settings?.snakeColors },
      mobileControls: { ...base.settings.mobileControls, ...saved.settings?.mobileControls }
    },
    nursery: {
      ...base.nursery,
      ...saved.nursery,
      resupplyEggHolding: Math.floor(clampNumber(saved.nursery?.resupplyEggHolding, 0, Number.MAX_SAFE_INTEGER, 0))
    },
    habitats: { ...base.habitats, ...saved.habitats },
    notables: { ...base.notables, ...saved.notables },
    snakebird: { ...base.snakebird, ...saved.snakebird },
    accessibility: { ...base.accessibility, ...saved.accessibility },
    tradeRoutes: Array.isArray(saved.tradeRoutes) ? structuredClone(saved.tradeRoutes) : Array.isArray(saved.routes) ? structuredClone(saved.routes) : [],
    activeResupplyMissions: Array.isArray(saved.activeResupplyMissions) ? structuredClone(saved.activeResupplyMissions) : [],
    completedResupplyMissions: Array.isArray(saved.completedResupplyMissions) ? structuredClone(saved.completedResupplyMissions) : [],
    resupplyTotals: Object.fromEntries(Object.entries(base.resupplyTotals).map(([key, value]) => [key, Math.floor(clampNumber(saved.resupplyTotals?.[key], 0, Number.MAX_SAFE_INTEGER, value))])),
    nextResupplyMissionId: Math.max(1, Number(saved.nextResupplyMissionId) || 1),
    eggBoardCountdown: Number.isInteger(Number(saved.eggBoardCountdown)) && Number(saved.eggBoardCountdown) > 0
      ? Math.min(Number.MAX_SAFE_INTEGER, Number(saved.eggBoardCountdown))
      : null,
    routes: undefined
  };
}

function projectSaveForUi(saved) {
  if (saved?.saveVersion !== SAVE_VERSION || !saved.session) return normalizeSaveState(saved);
  const state = saved.session;
  return normalizeSaveState({
    saveVersion: LEGACY_SAVE_VERSION,
    savedAt: saved.savedAt,
    currencies: { seeds: state.seeds, provisions: state.provisions, branches: state.branches },
    upgrades: state.upgrades,
    board: {
      selectedBoardLevel: state.selectedBoardLevel,
      selectedDuelGridSize: state.selectedDuelGridSize,
      mastery: Object.fromEntries(config.boardMasteryConfig.map((item) => [item.boardSize, Boolean(state.notables?.masteryRewardsClaimed?.[item.masteryId])]))
    },
    records: { best: state.best, ...(state.records || {}) },
    settings: { snakeColors: state.cosmetics, mobileControls: state.mobileControls },
    nursery: state.nursery,
    habitats: state.habitats,
    notables: state.notables,
    snakebird: state.snakebirdProgress,
    migration: state.migration,
    tradeRoutes: state.tradeRoutes,
    activeResupplyMissions: state.activeResupplyMissions,
    completedResupplyMissions: state.completedResupplyMissions,
    resupplyTotals: state.resupplyTotals,
    nextResupplyMissionId: state.nextResupplyMissionId,
    eggBoardCountdown: state.eggBoardCountdown,
    accessibility: { reducedMotion: state.reducedMotion }
  });
}
    return { buildDefaultSaveState, normalizeSaveState, projectSaveForUi };
  }
  return { create };
});
