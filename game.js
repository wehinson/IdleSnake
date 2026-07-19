const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const savePrefix = "snake-forever-";
const legacySavePrefix = "idlesnake-";
const consolidatedSaveKey = `${savePrefix}save`;
const SAVE_VERSION = 2;

// Legacy per-key names this game used before the save was consolidated into
// one versioned object. Kept only so migrateLegacySaveIfNeeded() can read
// old data out of localStorage; nothing writes to these keys anymore.
const saveKeysLegacyList = [
  "best",
  "battleship-best",
  "breakout-best",
  "runner-best",
  "colors",
  "crossing-best",
  "duel-grid-size",
  "habitats",
  "maze-best",
  "nursery",
  "seeds",
  "snakebird",
  "sokoban-best",
  "upgrades"
];

// Maps each legacy per-key name to its path inside the consolidated save
// object, so getSaveItem/setSaveItem can stay a drop-in seam for all the
// existing readX()/saveX() functions below.
const legacyKeyPaths = {
  "best": ["records", "best"],
  "battleship-best": ["records", "battleshipBest"],
  "breakout-best": ["records", "breakoutBest"],
  "runner-best": ["records", "runnerBest"],
  "centipede-best": ["records", "centipedeBest"],
  "colors": ["settings", "snakeColors"],
  "crossing-best": ["records", "crossingBest"],
  "duel-grid-size": ["board", "selectedDuelGridSize"],
  "habitats": ["habitats"],
  "maze-best": ["records", "mazeBest"],
  "nursery": ["nursery"],
  "seeds": ["currencies", "seeds"],
  "snakebird": ["snakebird"],
  "sokoban-best": ["records", "sokobanBest"],
  "upgrades": ["upgrades"]
};

function buildDefaultSaveState() {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: Date.now(),
    currencies: { seeds: 0, provisions: 0, branches: 0 },
    upgrades: { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 0 },
    board: { selectedBoardLevel: 0, selectedDuelGridSize: 30, mastery: {} },
    records: { best: 0, crossingBest: 0, mazeBest: 0, breakoutBest: 0, runnerBest: 0, sokobanBest: 0, battleshipBest: 0, centipedeBest: 0 },
    settings: { snakeColors: { body: null, head: null } },
    nursery: { nestStartedAt: null, hatchlings: [], colonyCount: 0, lastUpdatedAt: Date.now(), seedTickAccumulatorMs: 0, movementAccumulatorMs: 0 },
    habitats: { counts: [], upgradeLevels: [], lastUpdatedAt: Date.now() },
    notables: { retained: [], elders: [], pending: [], dismissedCount: 0, directRecruitmentsCompleted: 0, masteryRewardsClaimed: {}, nextId: 1 },
    snakebird: { unlockedLevel: 1, clearedLevels: [], bestMoves: [], lastSelectedLevel: 1 },
    // Reserved placeholders for systems that don't exist yet (routes, world
    // regions, seasons, migration, prestige, accessibility). Never mutated by
    // current game logic; they only round-trip through save/load so a future
    // feature can start using them without a save-breaking migration.
    tradeRoutes: [],
    activeResupplyMissions: [],
    completedResupplyMissions: [],
    nextResupplyMissionId: 1,
    regions: [],
    season: null,
    migration: null,
    prestigeHistory: [],
    accessibility: { colorblindMode: false, reducedMotion: false }
  };
}

function safeParse(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function normalizeSaveState(saved) {
  const base = buildDefaultSaveState();
  if (!saved || typeof saved !== "object") return base;
  return {
    ...base,
    ...saved,
    saveVersion: SAVE_VERSION,
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
      snakeColors: { ...base.settings.snakeColors, ...saved.settings?.snakeColors }
    },
    nursery: { ...base.nursery, ...saved.nursery },
    habitats: { ...base.habitats, ...saved.habitats },
    notables: { ...base.notables, ...saved.notables },
    snakebird: { ...base.snakebird, ...saved.snakebird },
    accessibility: { ...base.accessibility, ...saved.accessibility },
    tradeRoutes: Array.isArray(saved.tradeRoutes) ? structuredClone(saved.tradeRoutes) : Array.isArray(saved.routes) ? structuredClone(saved.routes) : [],
    activeResupplyMissions: Array.isArray(saved.activeResupplyMissions) ? structuredClone(saved.activeResupplyMissions) : [],
    completedResupplyMissions: Array.isArray(saved.completedResupplyMissions) ? structuredClone(saved.completedResupplyMissions) : [],
    nextResupplyMissionId: Math.max(1, Number(saved.nextResupplyMissionId) || 1),
    routes: undefined
  };
}

function loadConsolidatedSave() {
  try {
    const raw = localStorage.getItem(consolidatedSaveKey);
    if (raw === null) return buildDefaultSaveState();
    return normalizeSaveState(JSON.parse(raw));
  } catch {
    return buildDefaultSaveState();
  }
}

// One-time migration from the old per-key localStorage scheme into the
// consolidated save object. No-ops (and is safe to call unconditionally)
// once the consolidated key exists. Reads through both the current and
// legacy key prefixes so a browser that never got migrated under the old
// idlesnake- -> snake-forever- prefix rename still recovers its data.
function migrateLegacySaveIfNeeded() {
  if (localStorage.getItem(consolidatedSaveKey) !== null) return false;

  const legacyRead = (key) => {
    const current = localStorage.getItem(`${savePrefix}${key}`);
    if (current !== null) return current;
    return localStorage.getItem(`${legacySavePrefix}${key}`);
  };

  const hadAnyLegacyData = saveKeysLegacyList.some((key) => legacyRead(key) !== null);
  const migrated = buildDefaultSaveState();
  if (hadAnyLegacyData) {
    migrated.currencies.seeds = Number(legacyRead("seeds")) || 0;
    migrated.upgrades = safeParse(legacyRead("upgrades"), migrated.upgrades);
    migrated.board.selectedDuelGridSize = Number(legacyRead("duel-grid-size")) || migrated.board.selectedDuelGridSize;
    migrated.records.best = Number(legacyRead("best")) || 0;
    migrated.records.crossingBest = Number(legacyRead("crossing-best")) || 0;
    migrated.records.mazeBest = Number(legacyRead("maze-best")) || 0;
    migrated.records.breakoutBest = Number(legacyRead("breakout-best")) || 0;
    migrated.records.sokobanBest = Number(legacyRead("sokoban-best")) || 0;
    migrated.records.battleshipBest = Number(legacyRead("battleship-best")) || 0;
    migrated.settings.snakeColors = safeParse(legacyRead("colors"), migrated.settings.snakeColors);
    migrated.nursery = safeParse(legacyRead("nursery"), migrated.nursery);
    migrated.habitats = safeParse(legacyRead("habitats"), migrated.habitats);
    migrated.snakebird = safeParse(legacyRead("snakebird"), migrated.snakebird);
  }
  consolidatedSave = migrated;
  localStorage.setItem(consolidatedSaveKey, JSON.stringify(consolidatedSave));
  return true;
}

let consolidatedSave = buildDefaultSaveState();
if (!migrateLegacySaveIfNeeded()) {
  consolidatedSave = loadConsolidatedSave();
}

function getSaveItem(key) {
  const path = legacyKeyPaths[key];
  if (!path) return null;
  const value = path.reduce((obj, segment) => (obj === undefined || obj === null ? undefined : obj[segment]), consolidatedSave);
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function setSaveItem(key, value) {
  const path = legacyKeyPaths[key];
  if (!path) return;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = value;
  }
  let target = consolidatedSave;
  for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
  target[path[path.length - 1]] = parsed;
  persistConsolidatedSave();
}

// Debounced persistence for the consolidated save. Individual feature writes
// (seeds, nursery, habitats, upgrades, ...) were previously several separate
// localStorage keys written up to several times a second (synchronous
// JSON.stringify + I/O on the main thread), competing with the game loop.
// Coalesce them into one flush at most every ~1.5s, plus immediately whenever
// the page is hidden/closed so nothing is lost. The producer is evaluated at
// flush time so the write always reflects the latest in-memory state.
const saveFlushIntervalMs = 1500;
const pendingSaveProducers = new Map();
let saveFlushTimer = null;
// Set true only by the "hold to reset" flow. Once set, every persistence path
// (queued writes, the debounced flush, the pagehide/visibilitychange flush) is a
// no-op, so nothing re-writes the save between clearing it and the reload.
let resettingProgress = false;

function scheduleSaveFlush() {
  if (resettingProgress) return;
  if (saveFlushTimer === null) {
    saveFlushTimer = setTimeout(flushPendingSaves, saveFlushIntervalMs);
  }
}

function flushPendingSaves() {
  if (saveFlushTimer !== null) {
    clearTimeout(saveFlushTimer);
    saveFlushTimer = null;
  }
  if (resettingProgress) { pendingSaveProducers.clear(); return; }
  pendingSaveProducers.forEach((producer, key) => localStorage.setItem(key, producer()));
  pendingSaveProducers.clear();
}

function queueSave(key, producer) {
  if (resettingProgress) return;
  pendingSaveProducers.set(key, producer);
  scheduleSaveFlush();
}

function persistConsolidatedSave() {
  // Stamp savedAt at flush time so the engine's offline catch-up on next load
  // measures from the last real persist (see engine/save.js resolveSavedAt).
  queueSave(consolidatedSaveKey, () => {
    consolidatedSave.savedAt = Date.now();
    return JSON.stringify(consolidatedSave);
  });
}

function saveSeeds() {
  setSaveItem("seeds", String(seedsTotal));
}

function saveProvisions() {
  consolidatedSave.currencies.provisions = provisionsTotal;
  persistConsolidatedSave();
}

function saveBranches() {
  consolidatedSave.currencies.branches = branchesTotal;
  persistConsolidatedSave();
}

window.addEventListener("pagehide", flushPendingSaves);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPendingSaves();
});

const snakebirdEngine = window.SnakebirdEngine || (() => {
  const key = (point) => `${point.x},${point.y}`;
  const vectors = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const bodyContains = (body, point) => body.some((part) => part.x === point.x && part.y === point.y);
  const isSolid = (state, point) => point.x < 0 || point.x >= state.width || point.y < 0 || point.y >= state.height || state.solids.has(key(point));
  const parseLevel = (map) => {
    const body = [];
    const solids = new Set();
    const fruits = new Set();
    let exit = null;
    map.forEach((row, y) => [...row].forEach((cell, x) => {
      const point = { x, y };
      if (cell === "#") solids.add(key(point));
      if (cell === "F") fruits.add(key(point));
      if (cell === "G") exit = point;
      if (cell === "H") body.unshift(point);
      if (cell === "o") body.push(point);
    }));
    return { width: map[0].length, height: map.length, solids, fruits, exit, body, moves: 0, result: null };
  };
  const settleGravity = (state) => {
    const next = { ...state, body: state.body.map((part) => ({ ...part })) };
    while (true) {
      if (next.body.some((part) => part.y >= next.height)) return { state: next, fell: true };
      const canFall = next.body.every((part) => !next.solids.has(key({ x: part.x, y: part.y + 1 })));
      if (!canFall) return { state: next, fell: false };
      next.body = next.body.map((part) => ({ x: part.x, y: part.y + 1 }));
    }
  };
  const applyMove = (state, directionName) => {
    const vector = vectors[directionName];
    if (!vector) return { accepted: false, state };
    const head = state.body[0];
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    const fruitKey = key(nextHead);
    const ateFruit = state.fruits.has(fruitKey);
    const bodyToCheck = ateFruit ? state.body : state.body.slice(0, -1);
    if (isSolid(state, nextHead) || bodyContains(bodyToCheck, nextHead)) return { accepted: false, state };
    const next = {
      ...state,
      body: [nextHead, ...state.body.slice(0, ateFruit ? state.body.length : -1)],
      fruits: new Set(state.fruits),
      moves: state.moves + 1
    };
    if (ateFruit) next.fruits.delete(fruitKey);
    const settled = settleGravity(next);
    return { accepted: true, state: settled.state, fell: settled.fell, ateFruit };
  };
  const isComplete = (state) => {
    const head = state.body[0];
    return Boolean(head && state.exit && state.fruits.size === 0 && head.x === state.exit.x && head.y === state.exit.y);
  };
  const normalizeProgress = (saved = {}, levelCount = 5) => {
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
  };
  const recordCompletion = (saved, levelIndex, moves, levelCount, firstClearReward, replayReward) => {
    const progress = normalizeProgress(saved, levelCount);
    const index = Math.max(0, Math.min(levelCount - 1, Math.floor(levelIndex)));
    const firstClear = !progress.clearedLevels[index];
    progress.clearedLevels[index] = true;
    progress.unlockedLevel = Math.max(progress.unlockedLevel, Math.min(levelCount, index + 2));
    if (progress.bestMoves[index] === null || moves < progress.bestMoves[index]) progress.bestMoves[index] = moves;
    return { progress, firstClear, reward: firstClear ? firstClearReward : replayReward };
  };
  return { key, parseLevel, bodyContains, isSolid, settleGravity, applyMove, isComplete, normalizeProgress, recordCompletion };
})();
const scoreEl = document.querySelector("#score");
const timerEl = document.querySelector("#timer");
const gridLabelEl = document.querySelector("#gridLabel");
const duelGridSelect = document.querySelector("#duelGridSelect");
const bestEl = document.querySelector("#best");
const seedsTotalEl = document.querySelector("#seedsTotal");
const overlay = document.querySelector("#overlay");
const stateText = document.querySelector("#stateText");
const screenHint = document.querySelector("#screenHint");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const scoreLabelEl = document.querySelector("#scoreLabel");
const bestLabelEl = document.querySelector("#bestLabel");
const boardSizeSelect = document.querySelector("#boardSizeSelect");
const minigameKeys = document.querySelectorAll("[data-minigame]");
const personalizationScreen = document.querySelector("#personalizationScreen");
const personalizationBackButton = document.querySelector("#personalizationBackButton");
const openSaveDataButton = document.querySelector("#openSaveDataButton");
const saveDataScreen = document.querySelector("#saveDataScreen");
const saveDataExportArea = document.querySelector("#saveDataExportArea");
const saveDataImportArea = document.querySelector("#saveDataImportArea");
const copySaveDataButton = document.querySelector("#copySaveDataButton");
const importSaveDataButton = document.querySelector("#importSaveDataButton");
const saveDataBackButton = document.querySelector("#saveDataBackButton");
const saveDataStatus = document.querySelector("#saveDataStatus");
const snakebirdScreen = document.querySelector("#snakebirdScreen");
const bodyColorChoices = document.querySelector("#bodyColorChoices");
const headColorChoices = document.querySelector("#headColorChoices");
const upgradeButtons = {
  board: document.querySelector("#boardUpgradeButton"),
  foodType: document.querySelector("#foodTypeButton"),
  foodCount: document.querySelector("#foodCountButton"),
  shield: document.querySelector("#shieldButton"),
  minigames: document.querySelector("#minigamesButton")
};
const upgradeCards = {
  board: document.querySelector('[data-upgrade-card="board"]'),
  foodType: document.querySelector('[data-upgrade-card="foodType"]'),
  foodCount: document.querySelector('[data-upgrade-card="foodCount"]'),
  shield: document.querySelector('[data-upgrade-card="shield"]'),
  minigames: document.querySelector('[data-upgrade-card="minigames"]')
};

const boardUpgradeNameEl = document.querySelector("#boardUpgradeName");
const boardUpgradeLevelEl = document.querySelector("#boardUpgradeLevel");
const boardUpgradeCurrentEl = document.querySelector("#boardUpgradeCurrent");
const boardUpgradeNextEl = document.querySelector("#boardUpgradeNext");
const foodTypeNameEl = document.querySelector("#foodTypeName");
const foodTypeLevelEl = document.querySelector("#foodTypeLevel");
const foodTypeCurrentEl = document.querySelector("#foodTypeCurrent");
const foodTypeNextEl = document.querySelector("#foodTypeNext");
const foodCountNameEl = document.querySelector("#foodCountName");
const foodCountLevelEl = document.querySelector("#foodCountLevel");
const foodCountCurrentEl = document.querySelector("#foodCountCurrent");
const foodCountNextEl = document.querySelector("#foodCountNext");
const shieldNameEl = document.querySelector("#shieldName");
const shieldLevelEl = document.querySelector("#shieldLevel");
const shieldCurrentEl = document.querySelector("#shieldCurrent");
const shieldNextEl = document.querySelector("#shieldNext");
const minigamesNameEl = document.querySelector("#minigamesName");
const minigamesLevelEl = document.querySelector("#minigamesLevel");
const minigamesCurrentEl = document.querySelector("#minigamesCurrent");
const minigamesNextEl = document.querySelector("#minigamesNext");
const menuTabs = document.querySelectorAll("[data-menu-tab]");
const menuPanels = document.querySelectorAll("[data-menu-panel]");
const resetProgressButton = document.querySelector("#resetProgressButton");
const resetProgressFill = document.querySelector("#resetProgressFill");
const nurserySeedStatusEl = document.querySelector("#nurserySeedStatus");
const nurseryEggProgressTextEl = document.querySelector("#nurseryEggProgressText");
const eggProgressRateEl = document.querySelector("#eggProgressRate");
const eggProgressFillEl = document.querySelector("#eggProgressFill");
const nestStateEl = document.querySelector("#nestState");
const nestVisualEl = document.querySelector("#nestVisual");
const nestTimerEl = document.querySelector("#nestTimer");
const nestUpgradeButtonEl = document.querySelector("#nestUpgradeButton");
const nurseryBranchTotalEl = document.querySelector("#nurseryBranchTotal");
const nurseryCapacityEl = document.querySelector("#nurseryCapacity");
const nurseryUpgradeButtonEl = document.querySelector("#nurseryUpgradeButton");
const nurseryGrowthStatusEl = document.querySelector("#nurseryGrowthStatus");
const nurseryGridEl = document.querySelector("#nurseryGrid");
const hatchlingListEl = document.querySelector("#hatchlingList");
const colonyCountEl = document.querySelector("#colonyCount");
const colonyPlacedCountEl = document.querySelector("#colonyPlacedCount");
const colonyProvisionTotalEl = document.querySelector("#colonyProvisionTotal");
const colonyBranchTotalEl = document.querySelector("#colonyBranchTotal");
const colonySeedIncomeRateEl = document.querySelector("#colonySeedIncomeRate");
const colonyProvisionIncomeRateEl = document.querySelector("#colonyProvisionIncomeRate");
const colonyBranchIncomeRateEl = document.querySelector("#colonyBranchIncomeRate");
const colonyProvisionConsumptionRateEl = document.querySelector("#colonyProvisionConsumptionRate");
const habitatListEl = document.querySelector("#habitatList");
const colonyOverviewEl = document.querySelector("#colonyOverview");
const notablesButtonEl = document.querySelector("#notablesButton");
const notablesPanelEl = document.querySelector("#notablesPanel");
const notablesSummaryEl = document.querySelector("#notablesSummary");
const notablesRosterEl = document.querySelector("#notablesRoster");
const eldersRosterEl = document.querySelector("#eldersRoster");
const pendingNotableEl = document.querySelector("#pendingNotable");
const recruitNotableButtonEl = document.querySelector("#recruitNotableButton");
const closeNotablesButtonEl = document.querySelector("#closeNotablesButton");
const settleTabNotificationEl = document.querySelector("#settleTabNotification");
const migrationAvailableEl = document.querySelector("#migrationAvailable");
const migrationLifetimeEl = document.querySelector("#migrationLifetime");
const activeSettlementSelectEl = document.querySelector("#activeSettlementSelect");
const migrationFoundingStatusEl = document.querySelector("#migrationFoundingStatus");
const settleOverviewEl = document.querySelector("#settleOverview");
const tradePanelEl = document.querySelector("#tradePanel");
const tradeButtonEl = document.querySelector("#tradeButton");
const closeTradeButtonEl = document.querySelector("#closeTradeButton");
const migrationDestinationEl = document.querySelector("#migrationDestination");
const migrationNotableEl = document.querySelector("#migrationNotable");
const migrationAdultsEl = document.querySelector("#migrationAdults");
const migrationEggsEl = document.querySelector("#migrationEggs");
const migrationSeedsEl = document.querySelector("#migrationSeeds");
const migrationBranchesEl = document.querySelector("#migrationBranches");
const migrationProvisionsEl = document.querySelector("#migrationProvisions");
const migrationCostEl = document.querySelector("#migrationCost");
const migrationSuccessEl = document.querySelector("#migrationSuccess");
const migrationEstimateEl = document.querySelector("#migrationEstimate");
const migrationDepartEl = document.querySelector("#migrationDepart");
const migrationErrorEl = document.querySelector("#migrationError");
const activeExpeditionsEl = document.querySelector("#activeExpeditions");
const migrationHistoryEl = document.querySelector("#migrationHistory");
const tradeSettlementAEl = document.querySelector("#tradeSettlementA");
const tradeSettlementBEl = document.querySelector("#tradeSettlementB");
const tradeConstructionPreviewEl = document.querySelector("#tradeConstructionPreview");
const createTradeRouteButtonEl = document.querySelector("#createTradeRouteButton");
const tradeRouteErrorEl = document.querySelector("#tradeRouteError");
const tradeRouteNetworkEl = document.querySelector("#tradeRouteNetwork");
const tradeRouteManagementEl = document.querySelector("#tradeRouteManagement");
let selectedTradeRouteId = null;
let tradeNetworkRenderSignature = "";
let tradeManagementRenderSignature = "";

const defaultGrid = { columns: 5, rows: 7 };
const upgradeConfig = {
  board: {
    levels: ["5x7", "5x9", "7x9", "9x9", "9x13", "11x15", "15x21", "21x21"],
    baseCost: 18,
    costRatio: 2.35
  },
  foodType: {
    levels: [
      { name: "Seed", value: 1, kind: "seed" },
      { name: "Pod I", value: 2, kind: "pod" },
      { name: "Pod II", value: 3, kind: "pod" },
      { name: "Pod III", value: 4, kind: "pod" },
      { name: "Fruit I", value: 5, kind: "fruit" },
      { name: "Fruit II", value: 6, kind: "fruit" },
      { name: "Fruit III", value: 7, kind: "fruit" }
    ],
    baseCost: 24,
    costRatio: 2.15
  },
  foodCount: {
    baseCount: 1,
    baseCost: 160,
    costRatio: 3.75
  },
  shield: {
    baseCost: 420,
    costRatio: 4.5
  },
  minigames: {
    levels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    baseCost: 700,
    costRatio: 2.6
  }
};
const gameplaySpeed = 1;
const slowedTick = (milliseconds) => Math.round(milliseconds / gameplaySpeed);
const startTickMs = slowedTick(190);
const minTickMs = slowedTick(82);
const maxQueuedDirections = 2;
const nurseryConfig = {
  columns: 12,
  rows: 15,
  capacity: 2,
  eggCost: 500,
  eggCostRatio: 1.01,
  eggHatchMs: 5 * 60 * 1000,
  growthMs: 10 * 60 * 1000,
  twoBlockMs: 2 * 60 * 1000,
  threeBlockMs: 7 * 60 * 1000,
  seedIntervalMs: 1000,
  moveIntervalMs: 430,
  upgrades: {
    nest: { branchBaseCost: 50_000, costRatio: 5, slotsPerLevel: 1, maxSlots: 5 },
    nursery: { branchBaseCost: 100_000, seedBaseCost: 250_000, costRatio: 5, capacityPerLevel: 1 }
  }
};
const habitatConfig = {
  income: {
    basePerSecond: 0.01,
    foodValueMultiplier: true,
    milestoneMode: "multiply",
    overCapacityProvisionCost: 0.5
  },
  upgrades: { costRatio: 1.75 },
  habitats: [
    {
      name: "Field",
      unlockScore: 0,
      naturalCapacity: 25,
      hardCapacity: 50,
      upgradeCost: 10,
      capacityPerUpgrade: 25,
      incomeMultiplier: 0.5,
      milestones: [
        { score: 10, multiplier: 1.1 },
        { score: 50, multiplier: 1.2 },
        { score: 100, multiplier: 1.35 }
      ]
    },
    {
      name: "Lake",
      unlockScore: 10,
      naturalCapacity: 30,
      hardCapacity: 60,
      upgradeCost: 15,
      capacityPerUpgrade: 30,
      incomeMultiplier: 0.75,
      producesSeeds: false,
      eggHatchReductionSeconds: 1,
      milestones: [
        { score: 25, multiplier: 1.12 },
        { score: 75, multiplier: 1.25 },
        { score: 150, multiplier: 1.4 }
      ]
    },
    {
      name: "Forest",
      unlockScore: 25,
      naturalCapacity: 50,
      hardCapacity: 100,
      upgradeCost: 25,
      capacityPerUpgrade: 50,
      incomeMultiplier: 1,
      producesBranches: true,
      milestones: [
        { score: 50, multiplier: 1.15 },
        { score: 100, multiplier: 1.3 },
        { score: 250, multiplier: 1.5 }
      ]
    },
    {
      name: "River",
      unlockScore: 50,
      naturalCapacity: 100,
      hardCapacity: 200,
      upgradeCost: 40,
      capacityPerUpgrade: 100,
      incomeMultiplier: 2,
      producesProvisions: true,
      milestones: [
        { score: 100, multiplier: 1.18 },
        { score: 250, multiplier: 1.35 },
        { score: 500, multiplier: 1.65 }
      ]
    },
    {
      name: "Cave",
      unlockScore: 100,
      naturalCapacity: 200,
      hardCapacity: 400,
      upgradeCost: 65,
      capacityPerUpgrade: 200,
      incomeMultiplier: 4,
      milestones: [
        { score: 200, multiplier: 1.2 },
        { score: 500, multiplier: 1.45 },
        { score: 1000, multiplier: 1.8 }
      ]
    },
    {
      name: "Ocean",
      unlockScore: 200,
      naturalCapacity: 400,
      hardCapacity: 800,
      upgradeCost: 100,
      capacityPerUpgrade: 400,
      incomeMultiplier: 8,
      milestones: [
        { score: 400, multiplier: 1.22 },
        { score: 800, multiplier: 1.55 },
        { score: 1500, multiplier: 2 }
      ]
    },
    {
      name: "Mountain",
      unlockScore: 400,
      naturalCapacity: 750,
      hardCapacity: 1500,
      upgradeCost: 160,
      capacityPerUpgrade: 750,
      incomeMultiplier: 16,
      milestones: [
        { score: 750, multiplier: 1.25 },
        { score: 1500, multiplier: 1.7 },
        { score: 3000, multiplier: 2.2 }
      ]
    },
    {
      name: "Blizzard",
      unlockScore: 750,
      naturalCapacity: 1500,
      hardCapacity: 3000,
      upgradeCost: 250,
      capacityPerUpgrade: 1500,
      incomeMultiplier: 32,
      milestones: [
        { score: 1500, multiplier: 1.3 },
        { score: 3000, multiplier: 1.85 },
        { score: 6000, multiplier: 2.5 }
      ]
    }
  ]
};
const keyMap = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right"
};
const vectors = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const snakeColorChoices = {
  body: [
    { name: "Moss", value: "#29391f" },
    { name: "Dark purple", value: "#32204f" },
    { name: "Ocean", value: "#16465a" },
    { name: "Teal", value: "#176052" },
    { name: "Ember", value: "#843b2f" },
    { name: "Orange", value: "#a55b25" },
    { name: "Berry", value: "#702c57" },
    { name: "Charcoal", value: "#252a32" }
  ],
  head: [
    { name: "Forest", value: "#182413" },
    { name: "Violet", value: "#583b83" },
    { name: "Sky", value: "#267b91" },
    { name: "Mint", value: "#2d8b68" },
    { name: "Ruby", value: "#b3483d" },
    { name: "Gold", value: "#b0802d" },
    { name: "Plum", value: "#9b477e" },
    { name: "Slate", value: "#596474" }
  ]
};

const savedUpgrades = readUpgrades();
let grid = parseGridSize(upgradeConfig.board.levels[savedUpgrades.boardLevel]);
let selectedBoardLevel = savedUpgrades.boardLevel;
let boardMastery = { ...(consolidatedSave.board?.mastery || {}) };
let best = Number(getSaveItem("best") || 0);
let crossingBest = Number(getSaveItem("crossing-best") || 0);
if (!Number.isFinite(crossingBest)) crossingBest = 0;
let seedsTotal = Number(getSaveItem("seeds") || 0);
let provisionsTotal = Math.max(0, Number(consolidatedSave.currencies.provisions) || 0);
let branchesTotal = Math.max(0, Number(consolidatedSave.currencies.branches) || 0);
let upgrades = savedUpgrades;
let snakeColors = readSnakeColors();
let snake;
let previousSnake;
let digestionAnimations = [];
let foods;
let direction;
let nextDirection;
let directionQueue;
const activeDirectionKeys = new Set();
const activeDirectionClicks = new Set();
const directionPointerStarts = new Map();
const directionClickTimers = new Map();
const minimumDirectionClickMs = 230;
let score;
let state;
let tickMs;
let elapsedMs;
let lastFrameAt;
let timerStarted;
let animationId;
let nurseryClockId;
// Headless idle-economy engine (engine/index.js) — the authority for seeds,
// eggs, habitats and offline catch-up. The legacy `nursery`/`habitats`/
// `seedsTotal` globals below are kept as UI mirrors, refreshed from the engine
// each frame by mirrorEconomyFromWorld(). See the "idle-world bridge" section.
let idleWorld = null;
// Headless session engine (engine/session.js) — the single source of truth the
// browser game runs on. During the incremental migration it starts by owning the
// idle economy; gameplay modes are routed through it one at a time. The legacy
// globals below remain as UI mirrors, refreshed each frame from the snapshot.
let session = null;
let sessionLastSeeds = 0;
let sessionLastBest = 0;
let sessionLastUpgradesJson = "";
let latestSnapshot = null;
let idleLastWallAt = null;
let idleLastPersistAt = 0;
let boardMetrics;
let nursery = readNursery();
let habitats = readHabitats();
let notablesState = window.IdleSnakeNotables.createState(consolidatedSave.notables);
let nurseryCells = [];
let habitatCardRefs = [];
let gameMode = "snake";
let snakebird;
let snakebirdProgress;
let snakebirdLastLevelIndex = null;
let duelPlayer;
let duelOpponent;
let previousDuelPlayerBody;
let previousDuelOpponentBody;
let duelFoods;
let duelScore;
let duelWinner;
let stepAccumulatorMs = 0;
const duelGridSizes = [10, 15, 20, 30, 40];
let selectedDuelGridSize = readDuelGridSize();
let duelGrid = squareGrid(selectedDuelGridSize);
const duelTickMs = slowedTick(125);
let maze;
let mazePath;
let mazeDirection;
let mazeScore;
let mazeBest = Number(getSaveItem("maze-best") || 0);
let mazeLayoutIndex;
let mazeTravelDirection;
let mazeChoiceDirections;
let mazePendingChoices;
let mazePendingEnd;
const mazeGrid = { columns: 21, rows: 21 };
const mazeTickMs = slowedTick(105);
const crossingGrid = { columns: 15, rows: 13 };
const crossingTickMs = slowedTick(82);
let crossingStage;
let crossingScore;
let crossingSnake;
let previousCrossingSnake;
let crossingCars;
let crossingPhase;
let crossingTransitionUntil;
let crossingEntryColumn = Math.floor(crossingGrid.columns / 2);
let crossingSnakeLength = 3;
const mazeStart = { x: 10, y: 15 };
const mazeExit = { x: 10, y: 0 };
let breakout;
let breakoutBest = Number(getSaveItem("breakout-best") || 0);
let runner;
let runnerBest = Number(getSaveItem("runner-best") || 0);
if (!Number.isFinite(runnerBest)) runnerBest = 0;
let centipede;
let centipedeBest = Number(getSaveItem("centipede-best") || 0);
if (!Number.isFinite(centipedeBest)) centipedeBest = 0;
const centipedeGrid = { columns: 24, rows: 28 };
let sokoban;
let sokobanBest = Number(getSaveItem("sokoban-best") || 0);
let battleship = null;
let battleshipBest = Number(getSaveItem("battleship-best") || 0);
if (!Number.isFinite(battleshipBest)) battleshipBest = 0;
const battleshipGrid = { columns: 10, rows: 10 };
const battleshipReward = 300;
const battleshipAiDelayMs = 650;
let broodline;
const broodlineGrid = { columns: 30, rows: 30 };
const broodlineTickMs = slowedTick(220);
const broodlineView = 10;          // visible cells across the (30x30) world
const broodlineWavesPerRound = 5;  // each round clears 5 waves -> ~5x longer
const broodlineMaxHp = 16;
const broodlineScreen = document.querySelector("#broodlineScreen");
const broodlineChainEl = document.querySelector("#broodlineChain");
const broodlineFormationStatusEl = document.querySelector("#broodlineFormationStatus");
const broodlineMoveUpButton = document.querySelector("#broodlineMoveUp");
const broodlineMoveDownButton = document.querySelector("#broodlineMoveDown");
const broodlineContinueButton = document.querySelector("#broodlineContinue");
const broodlineEndButton = document.querySelector("#broodlineEnd");
const breakoutGrid = { columns: 18, rows: 18 };
const sokobanGrid = { columns: 15, rows: 15 };
const sokobanTickMs = 120;
const breakoutConfig = {
  basePaddleLength: 3,
  paddleSpeed: 330 * gameplaySpeed,
  ballSpeed: 258 * gameplaySpeed,
  powerupDropChance: 0.18,
  powerupFallSpeed: 92 * gameplaySpeed
};
const sokobanLevels = [
  {
    name: "First Push",
    reward: 20,
    map: [
      "###############",
      "#.............#",
      "#.............#",
      "#.............#",
      "#....###......#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#......###....#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############"
    ],
    snake: [{ x: 3, y: 11 }, { x: 2, y: 11 }, { x: 1, y: 11 }],
    crates: [{ x: 7, y: 7, kind: "light" }],
    goals: [{ x: 11, y: 7 }],
    pellets: [{ x: 5, y: 11 }],
    plates: [],
    gates: []
  },
  {
    name: "Hold the Gate",
    reward: 35,
    map: [
      "###############",
      "#.............#",
      "#..#########..#",
      "#.............#",
      "#..#########..#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#..#####......#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############"
    ],
    snake: [{ x: 3, y: 11 }, { x: 2, y: 11 }, { x: 1, y: 11 }],
    crates: [{ x: 4, y: 5, kind: "light" }, { x: 10, y: 9, kind: "light" }],
    goals: [{ x: 11, y: 5 }, { x: 11, y: 9 }],
    pellets: [{ x: 5, y: 11 }],
    plates: [{ x: 3, y: 3, id: "gate-a" }],
    gates: [{ x: 7, y: 3, id: "gate-a" }]
  },
  {
    name: "Anchor Point",
    reward: 45,
    map: [
      "###############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.............#",
      "###############",
      "###############",
      "###############",
      "###############",
      "###############",
      "###############",
      "###############"
    ],
    snake: [{ x: 1, y: 3 }, { x: 1, y: 2 }, { x: 1, y: 1 }],
    crates: [{ x: 6, y: 7, kind: "heavy" }],
    goals: [{ x: 7, y: 7 }],
    pellets: [{ x: 1, y: 4 }, { x: 1, y: 6 }],
    plates: [],
    gates: []
  },
  {
    name: "Brace Point",
    reward: 60,
    map: [
      "###############",
      "#.............#",
      "#..#####......#",
      "#.............#",
      "#......#####..#",
      "#.............#",
      "#.............#",
      "#..#####......#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############"
    ],
    snake: [{ x: 5, y: 11 }, { x: 4, y: 11 }, { x: 3, y: 11 }],
    crates: [{ x: 8, y: 11, kind: "heavy" }, { x: 8, y: 6, kind: "light" }],
    goals: [{ x: 11, y: 11 }, { x: 11, y: 6 }],
    pellets: [{ x: 6, y: 10 }, { x: 5, y: 9 }],
    plates: [{ x: 3, y: 5, id: "gate-b" }],
    gates: [{ x: 7, y: 5, id: "gate-b" }]
  },
  {
    name: "Twin Anchors",
    reward: 85,
    map: [
      "###############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############",
      "###############",
      "###############",
      "###############",
      "###############"
    ],
    snake: [{ x: 1, y: 3 }, { x: 1, y: 2 }, { x: 1, y: 1 }],
    crates: [{ x: 6, y: 7, kind: "heavy" }, { x: 8, y: 9, kind: "heavy" }],
    goals: [{ x: 7, y: 7 }, { x: 7, y: 9 }],
    pellets: [{ x: 1, y: 4 }, { x: 1, y: 6 }],
    plates: [],
    gates: []
  }
];
const mazeLayouts = [
  [
    [7, 14, 7, 11], [7, 11, 3, 11], [3, 11, 3, 7], [3, 7, 7, 7], [7, 7, 7, 3], [7, 3, 7, 0],
    [7, 11, 11, 11], [11, 11, 11, 13], [3, 7, 1, 7], [7, 7, 11, 7], [11, 7, 11, 5], [11, 5, 13, 5], [7, 3, 5, 3], [5, 3, 5, 1]
  ],
  [
    [7, 14, 7, 13], [7, 13, 11, 13], [11, 13, 11, 9], [11, 9, 5, 9], [5, 9, 5, 5], [5, 5, 9, 5], [9, 5, 9, 1], [9, 1, 7, 1], [7, 1, 7, 0],
    [7, 13, 3, 13], [3, 13, 3, 11], [11, 9, 13, 9], [13, 9, 13, 7], [5, 9, 1, 9], [1, 9, 1, 5], [5, 5, 5, 3], [5, 3, 3, 3], [9, 5, 13, 5]
  ],
  [
    [7, 14, 7, 11], [7, 11, 9, 11], [9, 11, 9, 7], [9, 7, 3, 7], [3, 7, 3, 3], [3, 3, 7, 3], [7, 3, 7, 0],
    [7, 11, 5, 11], [5, 11, 5, 13], [9, 11, 13, 11], [13, 11, 13, 9], [9, 7, 11, 7], [11, 7, 11, 3], [3, 7, 1, 7], [7, 3, 9, 3], [9, 3, 9, 1]
  ],
  [
    [7, 14, 7, 13], [7, 13, 5, 13], [5, 13, 5, 9], [5, 9, 11, 9], [11, 9, 11, 5], [11, 5, 7, 5], [7, 5, 7, 0],
    [7, 13, 9, 13], [9, 13, 9, 11], [5, 9, 3, 9], [3, 9, 3, 5], [11, 9, 13, 9], [13, 9, 13, 13], [11, 5, 11, 1], [7, 5, 3, 5], [3, 5, 3, 1]
  ],
  [
    [7, 14, 7, 11], [7, 11, 13, 11], [13, 11, 13, 7], [13, 7, 7, 7], [7, 7, 7, 5], [7, 5, 5, 5], [5, 5, 5, 1], [5, 1, 7, 1], [7, 1, 7, 0],
    [7, 11, 1, 11], [1, 11, 1, 9], [13, 7, 13, 3], [7, 7, 3, 7], [3, 7, 3, 13], [7, 5, 11, 5], [11, 5, 11, 3], [5, 1, 1, 1]
  ]
];

const snakebirdLevels = [
  {
    name: "First Perch",
    firstClearReward: 20,
    replayReward: 5,
    map: [
      ".........",
      ".........",
      "...F.....",
      ".........",
      "..###....",
      "..Hoo.F.G",
      "#########"
    ]
  },
  {
    name: "Long Reach",
    firstClearReward: 30,
    replayReward: 7,
    map: [
      "..........",
      "..........",
      "..........",
      "...###....",
      "..........",
      "..F.F.F.FG.",
      "...Hoo....",
      "##########"
    ]
  },
  {
    name: "Split Branch",
    firstClearReward: 45,
    replayReward: 10,
    map: [
      "...........",
      "...........",
      "..###......",
      "...........",
      "...........",
      "..F.F.F.FG.",
      "...Hoo.....",
      "###########"
    ]
  },
  {
    name: "Weight Shift",
    firstClearReward: 65,
    replayReward: 15,
    map: [
      "............",
      "............",
      "....###.....",
      "............",
      "..####......",
      "............",
      "............",
      "...HooFFFF.G",
      "############"
    ]
  },
  {
    name: "Nest Run",
    firstClearReward: 100,
    replayReward: 25,
    map: [
      ".............",
      ".............",
      "....###......",
      ".............",
      ".............",
      "..#####......",
      ".............",
      ".............",
      "...HooFFFFF.G",
      "#############"
    ]
  }
];

snakebirdProgress = readSnakebirdProgress();

// Snapshot of every persisted global, in the consolidated save shape. Used
// for export and as the source of truth written to localStorage.
function gatherSaveState() {
  return {
    ...consolidatedSave,
    saveVersion: SAVE_VERSION,
    savedAt: Date.now(),
    currencies: { seeds: seedsTotal, provisions: provisionsTotal, branches: branchesTotal },
    upgrades: { ...upgrades },
    board: { selectedBoardLevel, selectedDuelGridSize, mastery: { ...boardMastery } },
    records: { best, crossingBest, mazeBest, breakoutBest, runnerBest, sokobanBest, centipedeBest },
    settings: { snakeColors: { ...snakeColors } },
    nursery: { ...nursery },
    habitats: { ...habitats },
    notables: { ...notablesState },
    snakebird: { ...snakebirdProgress },
    migration: latestSnapshot?.migration ? structuredClone(latestSnapshot.migration) : consolidatedSave.migration,
    tradeRoutes: latestSnapshot?.tradeRoutes ? structuredClone(latestSnapshot.tradeRoutes) : consolidatedSave.tradeRoutes,
    activeResupplyMissions: latestSnapshot?.activeResupplyMissions ? structuredClone(latestSnapshot.activeResupplyMissions) : consolidatedSave.activeResupplyMissions,
    completedResupplyMissions: latestSnapshot?.completedResupplyMissions ? structuredClone(latestSnapshot.completedResupplyMissions) : consolidatedSave.completedResupplyMissions,
    nextResupplyMissionId: latestSnapshot?.nextResupplyMissionId || consolidatedSave.nextResupplyMissionId,
    routes: undefined
  };
}

// Restores every persisted global from a save object (startup, or after a
// successful import). Reuses the existing readX() clamp/fallback functions
// by routing them through the now-populated consolidatedSave.
function applySaveState(saved) {
  consolidatedSave = normalizeSaveState(saved);
  seedsTotal = Number(getSaveItem("seeds") || 0);
  provisionsTotal = Math.max(0, Number(consolidatedSave.currencies.provisions) || 0);
  branchesTotal = Math.max(0, Number(consolidatedSave.currencies.branches) || 0);
  upgrades = readUpgrades();
  grid = parseGridSize(upgradeConfig.board.levels[upgrades.boardLevel]);
  selectedBoardLevel = upgrades.boardLevel;
  boardMastery = { ...(consolidatedSave.board?.mastery || {}) };
  boardOptionsBuiltForLevel = -1;
  snakeColors = readSnakeColors();
  nursery = readNursery();
  habitats = readHabitats();
  notablesState = window.IdleSnakeNotables.createState(consolidatedSave.notables);
  best = Number(getSaveItem("best") || 0);
  crossingBest = Number(getSaveItem("crossing-best") || 0);
  mazeBest = Number(getSaveItem("maze-best") || 0);
  breakoutBest = Number(getSaveItem("breakout-best") || 0);
  runnerBest = Number(getSaveItem("runner-best") || 0);
  if (!Number.isFinite(runnerBest)) runnerBest = 0;
  centipedeBest = Number(getSaveItem("centipede-best") || 0);
  sokobanBest = Number(getSaveItem("sokoban-best") || 0);
  selectedDuelGridSize = readDuelGridSize();
  duelGrid = squareGrid(selectedDuelGridSize);
  snakebirdProgress = readSnakebirdProgress();
  syncHud();
  syncColorChoices();
  buildNurseryGrid();
  buildHabitatList();
  renderNotables();
  render();
}

function freshGame() {
  hideSnakebirdPicker();
  gameMode = "snake";
  setScreenHint("");
  grid = parseGridSize(upgradeConfig.board.levels[selectedBoardLevel]);
  const centerX = Math.floor(grid.columns / 2);
  const centerY = Math.floor(grid.rows / 2);
  const startBody = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY }
  ];
  digestionAnimations = [];
  // Build the ready snake run inside the session using the host's exact starting
  // layout/heading so gameplay is identical, then mirror it into render globals.
  const { snapshot } = session.dispatch({
    type: "selectMode",
    mode: "snake",
    setup: { grid: { ...grid }, snake: startBody, direction: "right", tickMs: startTickMs }
  });
  latestSnapshot = snapshot;
  mirrorSnakeFromSnapshot(snapshot);
  previousSnake = snake.map((part) => ({ ...part }));
  state = "ready";
  lastFrameAt = 0;
  timerStarted = false;
  boardMetrics = getBoardMetrics();
  syncHud();
  render();
  showOverlay("Ready");
}

function readSnakeColors() {
  const fallback = {
    body: snakeColorChoices.body[0].value,
    head: snakeColorChoices.head[0].value
  };
  try {
    const saved = JSON.parse(getSaveItem("colors") || "{}");
    return {
      body: snakeColorChoices.body.some((choice) => choice.value === saved.body) ? saved.body : fallback.body,
      head: snakeColorChoices.head.some((choice) => choice.value === saved.head) ? saved.head : fallback.head
    };
  } catch {
    return fallback;
  }
}

function saveSnakeColors() {
  setSaveItem("colors", JSON.stringify(snakeColors));
}

function buildColorChoices(container, type) {
  container.replaceChildren(...snakeColorChoices[type].map((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-swatch";
    button.dataset.colorType = type;
    button.dataset.color = choice.value;
    button.title = choice.name;
    button.setAttribute("aria-label", `${choice.name} ${type}`);
    button.style.setProperty("--swatch", choice.value);
    button.addEventListener("click", () => {
      snakeColors[type] = choice.value;
      saveSnakeColors();
      syncColorChoices();
      render();
    });
    return button;
  }));
}

function syncColorChoices() {
  document.querySelectorAll(".color-swatch").forEach((button) => {
    button.setAttribute("aria-pressed", String(snakeColors[button.dataset.colorType] === button.dataset.color));
  });
}

function showPersonalization() {
  hideSnakebirdPicker();
  personalizationScreen.hidden = false;
  overlay.classList.remove("visible");
  syncColorChoices();
}

function hidePersonalization() {
  personalizationScreen.hidden = true;
}

function showSaveData() {
  saveDataExportArea.value = JSON.stringify(gatherSaveState(), null, 2);
  saveDataImportArea.value = "";
  saveDataStatus.textContent = "";
  saveDataScreen.hidden = false;
  personalizationScreen.hidden = true;
}

function hideSaveData() {
  saveDataScreen.hidden = true;
  personalizationScreen.hidden = false;
}

async function copySaveData() {
  try {
    await navigator.clipboard.writeText(saveDataExportArea.value);
    saveDataStatus.textContent = "Copied to clipboard.";
  } catch {
    saveDataExportArea.select();
    saveDataStatus.textContent = "Clipboard unavailable — text selected, copy manually.";
  }
}

function importSaveData() {
  let parsed;
  try {
    parsed = JSON.parse(saveDataImportArea.value);
  } catch {
    saveDataStatus.textContent = "Import failed: invalid save data.";
    return;
  }
  if (!parsed || typeof parsed !== "object" || typeof parsed.saveVersion !== "number") {
    saveDataStatus.textContent = "Import failed: invalid save data.";
    return;
  }
  applySaveState(parsed);
  // Rebuild the session from the imported save (with offline catch-up) so
  // seeds/eggs/habitats resume from the restored state, then reset to a fresh
  // snake run (rebuilds the session's active run from the restored upgrades).
  initIdleWorld();
  freshGame();
  localStorage.setItem(consolidatedSaveKey, JSON.stringify(consolidatedSave));
  saveDataExportArea.value = JSON.stringify(gatherSaveState(), null, 2);
  saveDataStatus.textContent = "Import successful.";
}

function readSnakebirdProgress() {
  const fallback = {
    unlockedLevel: 1,
    clearedLevels: [false, false, false, false, false],
    bestMoves: [null, null, null, null, null],
    lastSelectedLevel: 1
  };

  try {
    const saved = JSON.parse(getSaveItem("snakebird") || "{}");
    return snakebirdEngine.normalizeProgress(saved, snakebirdLevels.length);
  } catch {
    return fallback;
  }
}

function saveSnakebirdProgress() {
  setSaveItem("snakebird", JSON.stringify(snakebirdProgress));
}

function snakebirdKey(point) {
  return `${point.x},${point.y}`;
}

function parseSnakebirdLevel(levelIndex) {
  const definition = snakebirdLevels[levelIndex];
  const parsed = snakebirdEngine.parseLevel(definition.map);
  return {
    ...parsed,
    levelIndex,
    result: null
  };
}

function hideSnakebirdPicker() {
  if (snakebirdScreen) snakebirdScreen.hidden = true;
}

function pickRandomSnakebirdLevel(excludeIndex) {
  const count = snakebirdLevels.length;
  if (count <= 1) return 0;
  let index;
  do {
    index = Math.floor(Math.random() * count);
  } while (index === excludeIndex);
  return index;
}

function loadSnakebirdLevel(levelIndex) {
  const safeIndex = Math.max(0, Math.min(snakebirdLevels.length - 1, levelIndex));
  snakebirdLastLevelIndex = safeIndex;
  gameMode = "snakebird";
  snakebird = parseSnakebirdLevel(safeIndex);
  grid = { columns: snakebird.width, rows: snakebird.height };
  direction = "right";
  nextDirection = "right";
  directionQueue = [];
  state = "ready";
  tickMs = 1000;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  boardMetrics = getBoardMetrics();
  syncHud();
  render();
  showOverlay(`Level ${safeIndex + 1} · Ready`);
  setScreenHint("Arrow keys / D-pad: move · collect all fruit · reach the exit");
}

function launchSnakebird() {
  hidePersonalization();
  gameMode = "snakebird";
  loadSnakebirdLevel(pickRandomSnakebirdLevel(snakebirdLastLevelIndex));
}

function snakebirdIsSolid(point) {
  return snakebirdEngine.isSolid(snakebird, point);
}

function snakebirdBodyContains(point, body = snakebird.body) {
  return snakebirdEngine.bodyContains(body, point);
}

function settleSnakebirdGravity() {
  const settled = snakebirdEngine.settleGravity(snakebird);
  snakebird = settled.state;
  return !settled.fell;
}

function snakebirdMove(directionName) {
  if (!snakebird || state !== "running" || !vectors[directionName]) return false;
  const previousBody = snakebird.body.map((part) => ({ ...part }));
  const result = snakebirdEngine.applyMove(snakebird, directionName);
  if (!result.accepted) return false;
  snakebird = result.state;
  direction = directionName;
  nextDirection = directionName;
  previousSnake = previousBody;

  if (result.fell) {
    endSnakebird(false, "Fell");
    return true;
  }

  if (snakebirdEngine.isComplete(snakebird)) {
    endSnakebird(true);
  }
  syncHud();
  render();
  return true;
}

function endSnakebird(won, failureReason = "") {
  state = "gameover";
  snakebird.result = won ? "won" : "lost";
  if (won) {
    const index = snakebird.levelIndex;
    const level = snakebirdLevels[index];
    const completion = snakebirdEngine.recordCompletion(
      snakebirdProgress,
      index,
      snakebird.moves,
      snakebirdLevels.length,
      level.firstClearReward,
      level.replayReward
    );
    snakebirdProgress = completion.progress;
    const reward = completion.reward;
    seedsTotal += reward;
    saveSeeds();
    saveSnakebirdProgress();
    snakebird.nextLevelIndex = pickRandomSnakebirdLevel(index);
    syncHud();
    showOverlay(`Level ${index + 1} Clear · +${formatNumber(reward)} Seeds`);
    setScreenHint(`Next level ready · Space / Start for Level ${snakebird.nextLevelIndex + 1}`);
  } else {
    syncHud();
    showOverlay(failureReason || "Puzzle Failed");
    setScreenHint("Reset to try the level again");
  }
}

function sokobanKey(point) {
  return `${point.x},${point.y}`;
}

function cloneSokobanPoints(points) {
  return points.map((point) => ({ ...point }));
}

function parseSokobanLevel(stageIndex) {
  // Delegated to the headless engine (engine/sokoban.js); shape is identical to
  // the previous inline builder, plus a totalPellets field for scoring.
  return window.IdleSnakeSokoban.parseLevel(sokobanLevels[stageIndex], sokobanGrid, stageIndex);
}

function loadSokobanLevel(stageIndex) {
  const safeIndex = Math.max(0, Math.min(sokobanLevels.length - 1, stageIndex));
  hideSnakebirdPicker();
  hidePersonalization();
  gameMode = "sokoban";
  sokoban = parseSokobanLevel(safeIndex);
  grid = { ...sokobanGrid };
  direction = "right";
  nextDirection = "right";
  directionQueue = [];
  state = "ready";
  tickMs = sokobanTickMs;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  boardMetrics = getBoardMetrics();
  syncHud();
  render();
  showOverlay(`Stage ${safeIndex + 1} · Ready`);
  setScreenHint("Arrow keys / D-pad: move · collect pellets · solve the crates");
}

function launchSokoban() {
  hideSnakebirdPicker();
  hidePersonalization();
  if (gameMode === "sokoban" && state !== "gameover") return;
  loadSokobanLevel(sokoban?.stageIndex || 0);
}

function sokobanIsWall(point) {
  return point.x < 0 || point.x >= sokobanGrid.columns || point.y < 0 || point.y >= sokobanGrid.rows || sokoban.walls.has(sokobanKey(point));
}

function sokobanCrateAt(point) {
  return sokoban.crates.find((crate) => crate.x === point.x && crate.y === point.y);
}

function sokobanSnakeContains(point, includeTail = true) {
  const body = includeTail ? sokoban.snake : sokoban.snake.slice(0, -1);
  return body.some((part) => part.x === point.x && part.y === point.y);
}

function sokobanGateAt(point) {
  return sokoban.gates.find((gate) => gate.x === point.x && gate.y === point.y);
}

function sokobanPlateActive(id) {
  const plate = sokoban.plates.find((candidate) => candidate.id === id);
  return Boolean(plate && sokobanSnakeContains(plate));
}

function sokobanIsOpen(point) {
  const gate = sokobanGateAt(point);
  return !sokobanIsWall(point) && (!gate || sokobanPlateActive(gate.id));
}

function sokobanIsGoal(point) {
  return sokoban.goals.some((goal) => goal.x === point.x && goal.y === point.y);
}

function sokobanStatusHint() {
  if (!sokoban) return "";
  const solved = sokoban.crates.filter((crate) => sokobanIsGoal(crate)).length;
  const activePlates = sokoban.plates.filter((plate) => sokobanSnakeContains(plate)).length;
  return `Stage ${sokoban.stageIndex + 1} · Move ${sokoban.moves} · ${solved}/${sokoban.crates.length} crates${activePlates ? ` · ${activePlates} plate active` : ""}`;
}

function sokobanIsBraced(directionName) {
  const vector = vectors[directionName];
  const tail = sokoban.snake[sokoban.snake.length - 1];
  if (!tail || !vector) return false;
  return sokobanIsWall({ x: tail.x - vector.x, y: tail.y - vector.y });
}

function sokobanMove(directionName) {
  if (!sokoban || state !== "running" || !vectors[directionName]) return false;

  // Move logic delegated to the headless engine; host keeps direction facing,
  // win handling, and the HUD/hint/render side-effects the engine omits.
  const result = window.IdleSnakeSokoban.applyMove(sokoban, directionName);
  if (!result.accepted) return false;

  direction = directionName;
  nextDirection = directionName;
  if (result.won) {
    endSokoban(true);
  } else {
    setScreenHint(sokobanStatusHint());
  }
  syncHud();
  render();
  return true;
}

function endSokoban(won) {
  state = "gameover";
  sokoban.result = won ? "won" : "reset";
  if (!won) return;

  const reward = sokobanLevels[sokoban.stageIndex].reward;
  sokobanBest = Math.max(sokobanBest, sokoban.score);
  seedsTotal += reward;
  saveSeeds();
  setSaveItem("sokoban-best", String(sokobanBest));
  syncHud();
  showOverlay(`Stage ${sokoban.stageIndex + 1} Clear · +${formatNumber(reward)} Seeds`);
  setScreenHint(sokoban.stageIndex < sokobanLevels.length - 1
    ? "Start for the next stage · Reset to replay"
    : "Campaign clear · Start to replay from stage 1");
}

// --- Battleship ("Venom Strike", phone key 8) --------------------------------
// Classic battleship rules on a 10x10 board: the ships are snakes and the bombs
// are venom strikes. The player manually places their fleet (with an 8-to-shuffle
// random helper), then trades one strike per turn with a hunt/target AI. Rules,
// placement and AI targeting live in engine/battleship.js; this host owns the
// two-grid render, the d-pad/click input, the AI-fire delay and the reward.

function launchBattleship() {
  hideSnakebirdPicker();
  hidePersonalization();
  if (gameMode === "battleship" && state !== "gameover") {
    // Re-pressing 8 mid-setup reshuffles the player's fleet (the random helper).
    if (battleship && battleship.phase === "placement") battleshipShuffle();
    return;
  }
  const B = window.IdleSnakeBattleship;
  gameMode = "battleship";
  grid = { ...battleshipGrid };
  battleship = {
    phase: "placement",       // placement -> playing -> over
    turn: "player",
    enemy: B.randomFleet(Math.random, battleshipGrid.columns) || B.emptyFleet(),
    player: B.emptyFleet(),
    placement: { index: 0, orientation: "h", x: 0, y: 0 },
    target: { x: Math.floor(battleshipGrid.columns / 2), y: Math.floor(battleshipGrid.rows / 2) },
    ai: B.createAi(),
    aiFireAt: null,
    result: null,
    lastPlayerShot: null,
    lastAiShot: null
  };
  direction = "right";
  nextDirection = "right";
  directionQueue = [];
  state = "running";
  tickMs = 60;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  boardMetrics = getBoardMetrics();
  hideOverlay();
  battleshipSetPlacementHint();
  syncHud();
  render();
}

function battleshipCurrentDef() {
  return window.IdleSnakeBattleship.FLEET[battleship.placement.index] || null;
}

function battleshipSetPlacementHint() {
  const def = battleshipCurrentDef();
  if (def) {
    setScreenHint(`Place the ${def.name} (${def.length}) · arrows move · Pause/R rotate · Start place · 8 shuffle`);
  } else {
    setScreenHint("Fleet ready · Start to begin the battle · 8 to re-shuffle");
  }
}

function battleshipClampAnchor() {
  const def = battleshipCurrentDef();
  if (!def) return;
  const maxX = battleship.placement.orientation === "h" ? battleshipGrid.columns - def.length : battleshipGrid.columns - 1;
  const maxY = battleship.placement.orientation === "v" ? battleshipGrid.rows - def.length : battleshipGrid.rows - 1;
  battleship.placement.x = Math.max(0, Math.min(battleship.placement.x, maxX));
  battleship.placement.y = Math.max(0, Math.min(battleship.placement.y, maxY));
}

function battleshipMoveCursor(directionName) {
  const vector = vectors[directionName];
  if (!battleship || !vector) return;
  if (battleship.phase === "placement" && battleshipCurrentDef()) {
    battleship.placement.x += vector.x;
    battleship.placement.y += vector.y;
    battleshipClampAnchor();
    render();
  } else if (battleship.phase === "playing" && battleship.turn === "player") {
    battleship.target.x = Math.max(0, Math.min(battleshipGrid.columns - 1, battleship.target.x + vector.x));
    battleship.target.y = Math.max(0, Math.min(battleshipGrid.rows - 1, battleship.target.y + vector.y));
    render();
  }
}

function battleshipRotate() {
  if (!battleship || battleship.phase !== "placement" || !battleshipCurrentDef()) return;
  battleship.placement.orientation = battleship.placement.orientation === "h" ? "v" : "h";
  battleshipClampAnchor();
  render();
}

function battleshipPlaceCurrent() {
  const B = window.IdleSnakeBattleship;
  const def = battleshipCurrentDef();
  if (!def) return;
  if (!B.placeShip(battleship.player, def, battleship.placement.x, battleship.placement.y, battleship.placement.orientation, battleshipGrid.columns)) {
    setScreenHint("Snakes can't overlap — pick another spot");
    return;
  }
  battleship.placement.index += 1;
  battleshipClampAnchor();
  battleshipSetPlacementHint();
  render();
}

function battleshipPlaceAt(x, y) {
  if (!battleship || battleship.phase !== "placement" || !battleshipCurrentDef()) return;
  battleship.placement.x = x;
  battleship.placement.y = y;
  battleshipClampAnchor();
  battleshipPlaceCurrent();
}

function battleshipShuffle() {
  const B = window.IdleSnakeBattleship;
  const fleet = B.randomFleet(Math.random, battleshipGrid.columns);
  if (!fleet) return;
  battleship.player = fleet;
  battleship.placement.index = B.FLEET.length;
  battleshipSetPlacementHint();
  render();
}

function battleshipBeginBattle() {
  battleship.phase = "playing";
  battleship.turn = "player";
  battleship.aiFireAt = null;
  battleship.target = { x: Math.floor(battleshipGrid.columns / 2), y: Math.floor(battleshipGrid.rows / 2) };
  timerStarted = true;
  elapsedMs = 0;
  lastFrameAt = performance.now();
  stepAccumulatorMs = 0;
  hideOverlay();
  setScreenHint("Aim with arrows · Start (or tap the top grid) to launch a venom strike");
  syncHud();
  render();
}

function battleshipFire() {
  if (!battleship || battleship.phase !== "playing" || battleship.turn !== "player") return;
  const B = window.IdleSnakeBattleship;
  const { x, y } = battleship.target;
  const outcome = B.fireAt(battleship.enemy, x, y);
  if (outcome.result === "repeat") {
    setScreenHint("You already struck there — aim somewhere new");
    return;
  }
  battleship.lastPlayerShot = { x, y, result: outcome.result };
  if (outcome.result === "sunk") setScreenHint(`Venom sank the enemy ${outcome.ship.name}!`);
  else setScreenHint(outcome.result === "hit" ? "Direct venom hit!" : "Venom splashed the water — miss");
  if (B.allSunk(battleship.enemy)) {
    endBattleship(true);
    return;
  }
  battleship.turn = "ai";
  battleship.aiFireAt = performance.now() + battleshipAiDelayMs;
  syncHud();
  render();
}

function stepBattleship(now) {
  if (!battleship || battleship.phase !== "playing" || battleship.turn !== "ai") return;
  if (battleship.aiFireAt && now < battleship.aiFireAt) return;
  const B = window.IdleSnakeBattleship;
  const { target, outcome } = B.aiFire(battleship.ai, battleship.player, Math.random, battleshipGrid.columns);
  if (!target) {
    battleship.turn = "player";
    battleship.aiFireAt = null;
    return;
  }
  battleship.lastAiShot = { x: target.x, y: target.y, result: outcome.result };
  if (outcome.result === "sunk") setScreenHint(`Enemy venom sank your ${outcome.ship.name}!`);
  else setScreenHint(outcome.result === "hit" ? "Your snake took a venom hit!" : "Enemy venom missed you");
  if (B.allSunk(battleship.player)) {
    endBattleship(false);
    return;
  }
  battleship.turn = "player";
  battleship.aiFireAt = null;
  syncHud();
}

function endBattleship(won) {
  battleship.phase = "over";
  battleship.result = won ? "won" : "lost";
  state = "gameover";
  if (won) {
    seedsTotal += battleshipReward;
    saveSeeds();
    battleshipBest += 1;
    setSaveItem("battleship-best", String(battleshipBest));
    showOverlay(`Victory · +${formatNumber(battleshipReward)} Seeds`);
    setScreenHint("All enemy snakes sunk · Start to play again");
  } else {
    showOverlay("Fleet Lost");
    setScreenHint("Your nest was wiped out · Start to try again");
  }
  syncHud();
  render();
}

function returnToRegularSnake() {
  hideSnakebirdPicker();
  hidePersonalization();
  hideBroodlineFormation();
  freshGame();
}

function launchVsSnake() {
  hideSnakebirdPicker();
  if (gameMode === "duel" && state !== "gameover") return;
  gameMode = "duel";
  setScreenHint("");
  grid = { ...duelGrid };
  const leftLane = Math.max(0, Math.floor(grid.columns / 2) - 1);
  const rightLane = Math.min(grid.columns - 1, leftLane + 1);
  duelPlayer = {
    body: [{ x: leftLane, y: grid.rows - 3 }, { x: leftLane, y: grid.rows - 2 }, { x: leftLane, y: grid.rows - 1 }],
    direction: "up",
    color: snakeColors.head
  };
  duelOpponent = {
    body: [{ x: rightLane, y: 2 }, { x: rightLane, y: 1 }, { x: rightLane, y: 0 }],
    direction: "down",
    color: "#fffdf0"
  };
  previousDuelPlayerBody = duelPlayer.body.map((part) => ({ ...part }));
  previousDuelOpponentBody = duelOpponent.body.map((part) => ({ ...part }));
  duelFoods = spawnDuelFoods(5);
  duelScore = 0;
  duelWinner = null;
  direction = "up";
  directionQueue = [];
  state = "ready";
  tickMs = duelTickMs;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  boardMetrics = getBoardMetrics();
  syncHud();
  render();
  showOverlay("Vs Snake · Ready");
}

function launchMaze() {
  hideSnakebirdPicker();
  if (gameMode === "maze" && state !== "gameover") return;
  gameMode = "maze";
  grid = { ...mazeGrid };
  mazeLayoutIndex = Math.floor(Math.random() * mazeLayouts.length);
  maze = buildNibblerBoard(mazeLayoutIndex);
  mazePath = [{ x: mazeStart.x, y: mazeStart.y }, { x: mazeStart.x - 1, y: mazeStart.y }, { x: mazeStart.x - 2, y: mazeStart.y }];
  previousSnake = mazePath.map((part) => ({ ...part }));
  mazeDirection = null;
  mazeScore = 0;
  mazeTravelDirection = null;
  mazeChoiceDirections = [];
  mazePendingChoices = null;
  mazePendingEnd = null;
  snake = mazePath;
  spawnMazeFood();
  direction = "up";
  directionQueue = [];
  state = "ready";
  tickMs = mazeTickMs;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  boardMetrics = getBoardMetrics();
  syncHud();
  render();
  hideOverlay();
  setScreenHint("Snake Forever · steer with arrows");
  showOverlay("Snake Forever · Ready");
}

function launchCrossing() {
  hideSnakebirdPicker();
  if (gameMode === "crossing" && state !== "gameover") return;
  gameMode = "crossing";
  grid = { ...crossingGrid };
  crossingEntryColumn = Math.floor(crossingGrid.columns / 2);
  crossingSnakeLength = 3;
  crossingStage = 1;
  crossingScore = 0;
  crossingPhase = "playing";
  crossingTransitionUntil = 0;
  direction = "up";
  nextDirection = "up";
  directionQueue = [];
  state = "ready";
  tickMs = crossingTickMs;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  resetCrossingStage();
  boardMetrics = getBoardMetrics();
  syncHud();
  render();
  showOverlay("Snakeger · Ready");
  setScreenHint("Arrow keys / D-pad: cross the road");
}

function resetCrossingStage() {
  // Enter the road vertically: the head sits on the bottom bank while the body
  // trails off-screen below it, so only the head shows until the snake climbs.
  // Left/right on the bank slides this entry column before committing upward.
  const entryX = Math.min(crossingGrid.columns - 1, Math.max(0, crossingEntryColumn));
  // Carry the persistent length across stages (only stage clears grow it).
  crossingSnake = Array.from({ length: crossingSnakeLength }, (_, index) => ({
    x: entryX,
    y: crossingGrid.rows - 1 + index
  }));
  previousCrossingSnake = crossingSnake.map((part) => ({ ...part }));
  crossingCars = buildCrossingCars(crossingStage);
  crossingPhase = "playing";
  crossingTransitionUntil = 0;
  direction = "up";
  nextDirection = "up";
  directionQueue = [];
}

function buildCrossingCars(stage) {
  const cars = [];
  const carCount = stage >= 5 ? 3 : stage >= 3 ? 2 : 1;
  const speedMultiplier = 1 + Math.min(1.25, (stage - 1) * 0.14);
  const carColors = ["#182413", "#4a5b3f", "#273425", "#697c58"];

  for (let row = 1; row < crossingGrid.rows - 1; row += 1) {
    const directionName = row % 2 === 0 ? "left" : "right";
    const directionSign = directionName === "right" ? 1 : -1;
    const baseSpeed = (0.11 + (row % 3) * 0.018) * speedMultiplier;

    for (let index = 0; index < carCount; index += 1) {
      const width = 1 + ((row + index + stage) % 3 === 0 ? 1 : 0);
      const spacing = crossingGrid.columns / carCount;
      const start = (row * 2.7 + index * spacing + stage * 1.35) % crossingGrid.columns;
      cars.push({
        row,
        x: directionSign > 0 ? start - width : crossingGrid.columns - start,
        width,
        speed: baseSpeed * directionSign,
        direction: directionName,
        color: carColors[(row + index) % carColors.length]
      });
    }
  }

  return cars;
}

function launchBreakout() {
  hideSnakebirdPicker();
  if (gameMode === "breakout" && state !== "gameover") return;
  gameMode = "breakout";
  grid = { ...breakoutGrid };
  boardMetrics = getBoardMetrics();
  const segmentSize = Math.max(18, Math.floor(boardMetrics.width / 16));
  const gap = Math.max(2, Math.floor(segmentSize * 0.08));
  breakout = {
    score: 0,
    lives: 2,
    segmentSize,
    gap,
    paddle: {
      x: 0,
      y: boardMetrics.height - segmentSize - 10,
      length: breakoutConfig.basePaddleLength,
      input: 0
    },
    balls: [],
    bricks: buildBreakoutLevel(boardMetrics.width),
    powerups: [],
    seedBoosts: [],
    heartsCollected: 0
  };
  breakout.paddle.x = (boardMetrics.width - breakoutPaddleWidth()) / 2;
  breakout.paddle.y = boardMetrics.height - segmentSize - 10;
  breakout.balls = [buildBreakoutBall(0)];
  direction = "right";
  directionQueue = [];
  state = "ready";
  tickMs = 16;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  syncHud();
  render();
  showOverlay("Brick Breakout · Ready");
  setScreenHint("Left / right to move · catch seeds to grow");
}

function launchRunner() {
  hideSnakebirdPicker();
  hidePersonalization();
  if (gameMode === "runner" && state !== "gameover") return;
  gameMode = "runner";
  grid = { columns: 18, rows: 18 };
  boardMetrics = getBoardMetrics();
  runner = window.IdleSnakeRunner.createState(boardMetrics.width, boardMetrics.height);
  direction = "right";
  directionQueue = [];
  state = "ready";
  tickMs = 16;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  syncHud();
  render();
  showOverlay("Snake Runner · Ready");
  setScreenHint("Up / Space: jump · clear the rocks");
}

function runnerJump() {
  if (!runner || state === "gameover") return false;
  if (state === "ready") startGame();
  return window.IdleSnakeRunner.jump(runner);
}

function buildBreakoutLevel(boardWidth) {
  const columns = 10;
  const rows = 5;
  const sideMargin = 14;
  const gap = 4;
  const brickWidth = (boardWidth - sideMargin * 2 - gap * (columns - 1)) / columns;
  const brickHeight = 16;
  const colors = ["#182413", "#29391f", "#38502a", "#496536", "#5c7840"];
  const bricks = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      bricks.push({
        x: sideMargin + column * (brickWidth + gap),
        y: 24 + row * (brickHeight + gap),
        width: brickWidth,
        height: brickHeight,
        color: colors[row]
      });
    }
  }
  return bricks;
}

// These helpers delegate to the headless engine (engine/breakout.js) so setup,
// rendering, and the physics step all share one implementation.
function breakoutPaddleWidth() {
  return breakout ? window.IdleSnakeBreakout.paddleWidth(breakout) : 0;
}

function setBreakoutPaddleLength(length) {
  window.IdleSnakeBreakout.setPaddleLength(breakout, length, boardMetrics.width);
}

function buildBreakoutBall(index = 0) {
  return window.IdleSnakeBreakout.buildBall(breakout, boardMetrics.width, index);
}

function createBreakoutPowerup(type, x, y) {
  return window.IdleSnakeBreakout.createPowerup(breakout, type, x, y);
}

const breakoutMaxHeartsPerLevel = 2;
const breakoutSeedBoostMs = 30000;

function randomBreakoutPowerupType(heartsAllowed) {
  return window.IdleSnakeBreakout.randomPowerupType(heartsAllowed, Math.random);
}

function buildNibblerBoard(layoutIndex = 0) {
  const open = new Set();
  let seed = [0x1f123bb5, 0x72a4d91c, 0xc3e87a61, 0x9b4f20de][layoutIndex % 4];
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const key = (x, y) => `${x},${y}`;
  const roomCount = 5;
  const roomSize = 3;
  const roomStride = 4;
  const origin = (coordinate) => 1 + coordinate * roomStride;
  const openRoom = (roomX, roomY) => {
    for (let x = origin(roomX); x < origin(roomX) + roomSize; x += 1) {
      for (let y = origin(roomY); y < origin(roomY) + roomSize; y += 1) open.add(key(x, y));
    }
  };
  const connectRooms = (from, to) => {
    if (from.x !== to.x) {
      const wallX = Math.max(origin(from.x), origin(to.x)) - 1;
      for (let y = origin(from.y); y < origin(from.y) + roomSize; y += 1) open.add(key(wallX, y));
    } else {
      const wallY = Math.max(origin(from.y), origin(to.y)) - 1;
      for (let x = origin(from.x); x < origin(from.x) + roomSize; x += 1) open.add(key(x, wallY));
    }
  };
  const visited = new Set();
  const stack = [{ x: 0, y: 0 }];
  visited.add(key(0, 0));
  openRoom(0, 0);

  while (stack.length) {
    const current = stack[stack.length - 1];
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ].filter((point) => point.x >= 0 && point.x < roomCount && point.y >= 0 && point.y < roomCount && !visited.has(key(point.x, point.y)));
    if (!neighbors.length) {
      stack.pop();
      continue;
    }
    const next = neighbors[Math.floor(random() * neighbors.length)];
    visited.add(key(next.x, next.y));
    openRoom(next.x, next.y);
    connectRooms(current, next);
    stack.push(next);
  }

  // Add a few alternate routes so the boards have arcade-style loops.
  for (let roomY = 0; roomY < roomCount; roomY += 1) {
    for (let roomX = 0; roomX < roomCount; roomX += 1) {
      if (roomX + 1 < roomCount && random() < 0.2) connectRooms({ x: roomX, y: roomY }, { x: roomX + 1, y: roomY });
      if (roomY + 1 < roomCount && random() < 0.2) connectRooms({ x: roomX, y: roomY }, { x: roomX, y: roomY + 1 });
    }
  }

  // The launch lane is always clear and points upward into the maze.
  [[8, 15], [9, 15], [10, 15], [10, 14]].forEach(([x, y]) => open.add(key(x, y)));
  return { open, food: null, level: 1, foodsEaten: 0 };
}

function spawnDuelFoods(count) {
  const foodsToPlace = [];
  while (foodsToPlace.length < count) {
    const point = {
      x: Math.floor(Math.random() * duelGrid.columns),
      y: Math.floor(Math.random() * duelGrid.rows)
    };
    const occupied = [...duelPlayer.body, ...duelOpponent.body, ...foodsToPlace];
    if (!occupied.some((part) => part.x === point.x && part.y === point.y)) foodsToPlace.push(point);
  }
  return foodsToPlace;
}

function squareGrid(size) {
  return { columns: size, rows: size };
}

function readDuelGridSize() {
  const saved = Number(getSaveItem("duel-grid-size"));
  return duelGridSizes.includes(saved) ? saved : 30;
}

function setDuelGridSize(size) {
  const nextSize = Number(size);
  if (!duelGridSizes.includes(nextSize)) return;
  selectedDuelGridSize = nextSize;
  duelGrid = squareGrid(selectedDuelGridSize);
  setSaveItem("duel-grid-size", String(selectedDuelGridSize));
  if (duelGridSelect) duelGridSelect.value = String(selectedDuelGridSize);
  if (gameMode === "duel") {
    state = "gameover";
    launchVsSnake();
  }
}

function broodlineKey(point) { return `${point.x},${point.y}`; }
function broodlineRandomOpen(occupied = new Set()) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const point = { x: 1 + Math.floor(Math.random() * 28), y: 1 + Math.floor(Math.random() * 28) };
    if (!occupied.has(broodlineKey(point))) return point;
  }
  return { x: 15, y: 15 };
}
function broodlineSpeciesLabel(kind) {
  return ({ garden: "Garden Snake", cave: "Cave Snake", electric: "Electric Snake", lava: "Lava Snake", rattle: "Rattle Snake", body: "Body segment", egg: "Egg" })[kind] || kind;
}
function broodlineHatchling(kind) { return { kind, cooldown: 0, burn: 0, poison: 0 }; }
function broodlineRoundSize() { return 4 + Math.floor((broodline.round - 1) * 1.35); }
function broodlineSpawnWave() {
  const occupied = new Set([broodlineKey(broodline.head), ...broodline.chain.map((part) => broodlineKey(part.pos))]);
  broodline.enemies = [];
  const rangedCount = Math.max(1, Math.round(broodlineRoundSize() / 4));
  for (let i = 0; i < broodlineRoundSize(); i += 1) {
    const pos = broodlineRandomOpen(occupied); occupied.add(broodlineKey(pos));
    const ranged = i < rangedCount;
    broodline.enemies.push({ type: ranged ? "ranged" : "melee", pos, hp: ranged ? 4 : 7, maxHp: ranged ? 4 : 7, cooldown: Math.random() * 5, stun: 0, burn: 0, poison: 0, target: null });
  }
}
function broodlineSpawnRound() {
  window.IdleSnakeBroodline.spawnRound(broodline, Math.random);
  state = "ready";
  hideBroodlineFormation();
  setScreenHint("Steer · attacks are automatic");
}
function launchBroodline() {
  gameMode = "broodline";
  grid = broodlineGrid;
  tickMs = broodlineTickMs;
  broodline = { round: 1, wave: 1, pendingSeeds: 0, kills: 0, hatchlingsCollected: 0, eggsHatched: 0, armor: 0, maxArmor: 0, hp: broodlineMaxHp, maxHp: broodlineMaxHp, phase: "combat", selected: 0,
    head: { x: 15, y: 15 }, camera: { x: 15 - broodlineView / 2, y: 15 - broodlineView / 2 }, chain: [], headColor: snakeColors.head, enemies: [], pickups: [], effects: [], direction: "right", queue: [] };
  broodlineSpawnRound();
  broodline.chain.forEach((part) => { part.pos = { ...part.pos }; });
  syncBroodlineFormation();
  syncHud();
  showOverlay("Broodline · Round 1");
}
function broodlineAddDrop(enemy) {
  const roll = Math.random();
  const kind = roll < .5 ? "body" : roll < .76 ? "garden" : roll < .84 ? "egg" : roll < .9 ? "cave" : roll < .95 ? "rattle" : roll < .98 ? "electric" : "lava";
  broodline.pickups.push({ kind, pos: { ...enemy.pos } });
}
function broodlineDamage(enemy, damage, label) {
  if (!enemy || enemy.hp <= 0) return;
  enemy.hp -= damage;
  broodline.effects.push({ pos: { ...enemy.pos }, text: label, ttl: 650 });
  if (enemy.hp <= 0) { broodline.kills += 1; broodline.pendingSeeds += 2; if (Math.random() < .65) broodlineAddDrop(enemy); }
}
function broodlineNearestEnemy(pos, range, forwardOnly = false) {
  return broodline.enemies.filter((enemy) => enemy.hp > 0 && (!forwardOnly || ((enemy.pos.x - pos.x) * vectors[broodline.direction].x + (enemy.pos.y - pos.y) * vectors[broodline.direction].y >= range.min && Math.abs(enemy.pos.x - pos.x) + Math.abs(enemy.pos.y - pos.y) <= range.max))).filter((enemy) => Math.abs(enemy.pos.x - pos.x) + Math.abs(enemy.pos.y - pos.y) <= range.max).sort((a, b) => Math.abs(a.pos.x - pos.x) + Math.abs(a.pos.y - pos.y) - (Math.abs(b.pos.x - pos.x) + Math.abs(b.pos.y - pos.y)))[0];
}
function broodlineManhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function broodlineOpenEnemyCell(point, enemy, reserved = new Set()) {
  if (point.x <= 0 || point.y <= 0 || point.x >= 29 || point.y >= 29) return false;
  if (broodline.chain.some((part) => part.pos.x === point.x && part.pos.y === point.y)) return false;
  if (reserved.has(broodlineKey(point))) return false;
  return !broodline.enemies.some((other) => other !== enemy && other.hp > 0 && other.pos.x === point.x && other.pos.y === point.y);
}
function broodlineStepToward(enemy, target, reserved) {
  const candidates = [];
  const dx = Math.sign(target.x - enemy.pos.x); const dy = Math.sign(target.y - enemy.pos.y);
  if (Math.abs(target.x - enemy.pos.x) >= Math.abs(target.y - enemy.pos.y)) {
    if (dx) candidates.push({ x: enemy.pos.x + dx, y: enemy.pos.y });
    if (dy) candidates.push({ x: enemy.pos.x, y: enemy.pos.y + dy });
  } else {
    if (dy) candidates.push({ x: enemy.pos.x, y: enemy.pos.y + dy });
    if (dx) candidates.push({ x: enemy.pos.x + dx, y: enemy.pos.y });
  }
  candidates.push(...vectorsToPoints(enemy.pos));
  const next = candidates.find((point) => broodlineOpenEnemyCell(point, enemy, reserved));
  if (next) { enemy.pos = next; reserved.add(broodlineKey(next)); }
}
function vectorsToPoints(pos) {
  return Object.values(vectors).map((vector) => ({ x: pos.x + vector.x, y: pos.y + vector.y }));
}
function broodlineClosestBodyTarget(pos) {
  const body = broodline.chain
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => part.kind === "body");
  return body.sort((a, b) => broodlineManhattan(pos, a.part.pos) - broodlineManhattan(pos, b.part.pos))[0] || { part: broodline.head, index: -1 };
}
function broodlineMeleeTargetCell(head, enemy) {
  return vectorsToPoints(head)
    .filter((point) => broodlineOpenEnemyCell(point, enemy))
    .sort((a, b) => broodlineManhattan(enemy.pos, a) - broodlineManhattan(enemy.pos, b))[0];
}
function broodlineStepAway(enemy, target, reserved) {
  const next = vectorsToPoints(enemy.pos)
    .filter((point) => broodlineOpenEnemyCell(point, enemy, reserved))
    .sort((a, b) => broodlineManhattan(b, target) - broodlineManhattan(a, target))[0];
  if (next) { enemy.pos = next; reserved.add(broodlineKey(next)); }
}
function broodlineCollect(growthPos = broodline.chain.at(-1)?.pos || broodline.head) {
  const head = broodline.head;
  const index = broodline.pickups.findIndex((drop) => drop.pos.x === head.x && drop.pos.y === head.y);
  if (index < 0) return;
  const drop = broodline.pickups.splice(index, 1)[0];
  const tail = { ...growthPos };
  if (drop.kind === "egg") broodline.chain.push({ kind: "egg", pos: { ...tail }, hatchAt: 30000 });
  else if (drop.kind === "body") broodline.chain.push({ kind: "body", pos: { ...tail } });
  else { broodline.chain.push({ kind: drop.kind, pos: { ...tail }, cooldown: 0 }); broodline.hatchlingsCollected += 1; broodline.pendingSeeds += 1; if (drop.kind === "cave") broodline.maxArmor += 1; }
}
function broodlineStep() {
  if (!broodline || broodline.phase !== "combat") return;
  // Combat simulation delegated to the headless engine (engine/broodline.js).
  // Host interprets the returned events for the run-end reward, wave HUD, and
  // the round-clear formation screen.
  const { events } = window.IdleSnakeBroodline.step(broodline, { rng: Math.random });
  for (const event of events) {
    if (event.type === "endRun") { broodlineEndRun(event.reason); return; }
    if (event.type === "wave") { syncHud(); }
    if (event.type === "roundClear") { state = "paused"; showBroodlineFormation(); }
  }
}
function broodlineTakeDamage(target = "head") {
  if (broodline.armor > 0) { broodline.armor -= 1; broodline.effects.push({ pos: { ...broodline.head }, text: "ARMOR", ttl: 700 }); return; }
  broodline.hp = Math.max(0, broodline.hp - 1);
  const bodyIndexes = broodline.chain.map((part, i) => part.kind === "body" ? i : -1).filter((i) => i >= 0);
  // Body segments still get bitten off when present; the shared health bar
  // tracks overall condition and is what actually ends the run.
  if (bodyIndexes.length) {
    const targetIndex = typeof target === "number" && bodyIndexes.includes(target) ? target : bodyIndexes.at(-1);
    broodline.chain.splice(targetIndex, 1);
  }
  broodline.effects.push({ pos: { ...broodline.head }, text: target === "head" ? "HEAD HIT" : "SEGMENT HIT", ttl: 800 });
  if (broodline.hp <= 0) broodlineEndRun("Overwhelmed");
}
function broodlineEndRun(message) { broodline.phase = "ended"; state = "gameover"; seedsTotal += broodline.pendingSeeds; saveSeeds(); syncHud(); showOverlay(`${message} · +${formatNumber(broodline.pendingSeeds)} Seeds`); hideBroodlineFormation(); }
function showBroodlineFormation() { syncBroodlineFormation(); broodlineScreen.hidden = false; broodlineFormationStatusEl.textContent = `Round ${broodline.round} clear · ${broodline.pendingSeeds} Seeds pending`; setScreenHint("Arrange the chain, then continue"); }
function hideBroodlineFormation() { if (broodlineScreen) broodlineScreen.hidden = true; }
function syncBroodlineFormation() { if (!broodlineChainEl || !broodline) return; broodlineChainEl.replaceChildren(...broodline.chain.map((part, index) => { const button = document.createElement("button"); button.className = `broodline-card${index === broodline.selected ? " is-selected" : ""}`; button.type = "button"; button.innerHTML = `<span>${broodlineSpeciesLabel(part.kind).toUpperCase()}</span><small>${part.kind === "egg" ? `${Math.ceil(part.hatchAt / 1000)}s` : "slot " + (index + 1)}</small>`; button.addEventListener("click", () => { broodline.selected = index; syncBroodlineFormation(); }); return button; })); }
function broodlineStartNext() { if (!broodline || broodline.phase !== "formation") return; broodline.round += 1; broodline.armor = broodline.maxArmor; broodline.hp = broodline.maxHp; broodlineSpawnRound(); state = "ready"; showOverlay(`Broodline · Round ${broodline.round}`); syncHud(); }

function isMinigameMode() {
  return ["duel", "maze", "breakout", "runner", "crossing", "snakebird", "sokoban", "broodline", "battleship"].includes(gameMode);
}

function restartCurrentMinigame() {
  if (gameMode === "duel") {
    state = "gameover";
    launchVsSnake();
  } else if (gameMode === "maze") {
    state = "gameover";
    launchMaze();
  } else if (gameMode === "breakout") {
    state = "gameover";
    launchBreakout();
  } else if (gameMode === "runner") {
    state = "gameover";
    launchRunner();
  } else if (gameMode === "crossing") {
    state = "gameover";
    launchCrossing();
  } else if (gameMode === "snakebird") {
    loadSnakebirdLevel(snakebird?.nextLevelIndex ?? snakebird?.levelIndex ?? 0);
  } else if (gameMode === "sokoban") {
    const nextStage = sokoban?.result === "won"
      ? (sokoban.stageIndex + 1) % sokobanLevels.length
      : sokoban?.stageIndex || 0;
    loadSokobanLevel(nextStage);
  } else if (gameMode === "broodline") {
    launchBroodline();
  } else if (gameMode === "battleship") {
    state = "gameover";
    launchBattleship();
  }
}

function startGame() {
  if (gameMode === "battleship") {
    if (state === "gameover") { launchBattleship(); return; }
    if (!battleship) return;
    if (battleship.phase === "placement") {
      if (battleshipCurrentDef()) battleshipPlaceCurrent();
      else battleshipBeginBattle();
    } else if (battleship.phase === "playing") {
      battleshipFire();
    }
    return;
  }
  if (gameMode === "snakebird") {
    if (state === "gameover") restartCurrentMinigame();
    if (state !== "running") {
      state = "running";
      timerStarted = true;
      lastFrameAt = performance.now();
      stepAccumulatorMs = 0;
      hideSnakebirdPicker();
      syncHud();
      hideOverlay();
    }
    return;
  }
  if (gameMode === "sokoban") {
    if (state === "gameover") {
      const nextStage = sokoban?.result === "won"
        ? (sokoban.stageIndex + 1) % sokobanLevels.length
        : sokoban?.stageIndex || 0;
      loadSokobanLevel(nextStage);
    }
    if (state !== "running") {
      state = "running";
      timerStarted = true;
      lastFrameAt = performance.now();
      stepAccumulatorMs = 0;
      syncHud();
      hideOverlay();
      setScreenHint(sokobanStatusHint());
    }
    return;
  }
  if (gameMode === "broodline") {
    if (state === "gameover") launchBroodline();
    if (broodline?.phase === "formation") return;
    if (state !== "running") { state = "running"; timerStarted = true; lastFrameAt = performance.now(); stepAccumulatorMs = 0; syncHud(); hideOverlay(); }
    return;
  }
  if (gameMode === "breakout") {
    if (state === "gameover") launchBreakout();
    if (state !== "running") {
      state = "running";
      timerStarted = true;
      lastFrameAt = performance.now();
      stepAccumulatorMs = 0;
      syncHud();
      hideOverlay();
    }
    return;
  }
  if (gameMode === "centipede") {
    if (state === "gameover") launchCentipede();
    if (state !== "running") {
      state = "running";
      timerStarted = true;
      lastFrameAt = performance.now();
      stepAccumulatorMs = 0;
      syncHud();
      hideOverlay();
      setScreenHint("Arrows to move · you auto-fire upward");
    }
    return;
  }
  if (gameMode === "runner") {
    if (state === "gameover") launchRunner();
    if (state !== "running") {
      state = "running";
      timerStarted = true;
      lastFrameAt = performance.now();
      stepAccumulatorMs = 0;
      syncHud();
      hideOverlay();
    }
    return;
  }
  if (gameMode === "crossing") {
    if (state === "gameover") launchCrossing();
    if (state !== "running") {
      state = "running";
      timerStarted = true;
      lastFrameAt = performance.now();
      stepAccumulatorMs = 0;
      syncHud();
      hideOverlay();
      setScreenHint("Reach the top bank");
    }
    return;
  }
  if (gameMode === "maze") {
    if (state === "gameover") launchMaze();
    if (state !== "running") {
      state = "running";
      timerStarted = true;
      lastFrameAt = performance.now();
      stepAccumulatorMs = 0;
      syncHud();
      hideOverlay();
      setScreenHint("Eat the gold bites · don't hit the walls");
    }
    return;
  }
  if (gameMode === "duel") {
    if (state === "gameover") launchVsSnake();
    state = "running";
    timerStarted = true;
    lastFrameAt = performance.now();
    stepAccumulatorMs = 0;
    syncHud();
    hideOverlay();
    return;
  }
  if (state === "gameover") {
    freshGame();
  }
  if (state !== "running") {
    session.dispatch({ type: "begin" });
    state = "running";
    timerStarted = true;
    lastFrameAt = performance.now();
    stepAccumulatorMs = 0;
    syncHud();
    hideOverlay();
  }
}

function readNursery() {
  const fallback = {
    nestLevel: 0,
    nurseryLevel: 0,
    nestEggs: [],
    nestStartedAt: null,
    hatchlings: [],
    colonyCount: 0,
    lastUpdatedAt: Date.now(),
    seedTickAccumulatorMs: 0,
    movementAccumulatorMs: 0
  };

  try {
    const saved = JSON.parse(getSaveItem("nursery") || "{}");
    const hatchlings = Array.isArray(saved.hatchlings)
      ? saved.hatchlings.slice(0, 64).map((hatchling, index) => ({
        id: String(hatchling.id || `hatchling-${index + 1}`),
        x: clampNumber(hatchling.x, 0, nurseryConfig.columns - 1, index === 0 ? 2 : 9),
        y: clampNumber(hatchling.y, 0, nurseryConfig.rows - 1, index === 0 ? 4 : 10),
        direction: vectors[hatchling.direction] ? hatchling.direction : index % 2 ? "left" : "right",
        progressMs: clampNumber(hatchling.progressMs, 0, nurseryConfig.growthMs, 0)
      }))
      : [];

    return {
      nestLevel: Math.floor(clampNumber(saved.nestLevel, 0, Number.MAX_SAFE_INTEGER, 0)),
      nurseryLevel: Math.floor(clampNumber(saved.nurseryLevel, 0, Number.MAX_SAFE_INTEGER, 0)),
      nestEggs: Array.isArray(saved.nestEggs) ? saved.nestEggs.slice(0, 64) : [],
      nestStartedAt: (() => {
        const savedNestStartedAt = Number(saved.nestStartedAt);
        return Number.isFinite(savedNestStartedAt) && savedNestStartedAt > 0
          ? savedNestStartedAt
          : null;
      })(),
      hatchlings,
      colonyCount: clampNumber(saved.colonyCount, 0, Number.MAX_SAFE_INTEGER, 0),
      lastUpdatedAt: Number.isFinite(Number(saved.lastUpdatedAt)) ? Number(saved.lastUpdatedAt) : Date.now(),
      seedTickAccumulatorMs: clampNumber(saved.seedTickAccumulatorMs, 0, nurseryConfig.seedIntervalMs, 0),
      movementAccumulatorMs: clampNumber(saved.movementAccumulatorMs, 0, nurseryConfig.moveIntervalMs, 0)
    };
  } catch {
    return fallback;
  }
}

function readHabitats() {
  const fallback = {
    counts: habitatConfig.habitats.map(() => 0),
    upgradeLevels: habitatConfig.habitats.map(() => 0),
    lastUpdatedAt: Date.now()
  };

  try {
    const saved = JSON.parse(getSaveItem("habitats") || "{}");
    const savedCounts = Array.isArray(saved.counts) ? saved.counts : [];
    const savedUpgradeLevels = Array.isArray(saved.upgradeLevels) ? saved.upgradeLevels : [];
    return {
      counts: habitatConfig.habitats.map((_, index) => Math.floor(clampNumber(
        savedCounts[index],
        0,
        Number.MAX_SAFE_INTEGER,
        0
      ))),
      upgradeLevels: habitatConfig.habitats.map((_, index) => Math.floor(clampNumber(
        savedUpgradeLevels[index],
        0,
        Number.MAX_SAFE_INTEGER,
        0
      ))),
      lastUpdatedAt: Number.isFinite(Number(saved.lastUpdatedAt))
        ? Number(saved.lastUpdatedAt)
        : Date.now()
    };
  } catch {
    return fallback;
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function saveNursery() {
  setSaveItem("nursery", JSON.stringify(nursery));
}

function saveHabitats() {
  setSaveItem("habitats", JSON.stringify(habitats));
}

function updateNursery(now) {
  if (!Number.isFinite(nursery.lastUpdatedAt)) {
    nursery.lastUpdatedAt = now;
    return false;
  }

  if (now <= nursery.lastUpdatedAt) return false;

  let changed = false;
  const previous = nursery.lastUpdatedAt;
  const hatchAt = nursery.nestStartedAt === null
    ? null
    : nursery.nestStartedAt + nurseryConfig.eggHatchMs;

  if (hatchAt !== null && hatchAt > previous && hatchAt <= now) {
    changed = advanceNursery(hatchAt - previous) || changed;
    if (nursery.hatchlings.length < nurseryConfig.capacity) {
      nursery.hatchlings.push(createHatchling());
    }
    nursery.nestStartedAt = null;
    nursery.seedTickAccumulatorMs = 0;
    nursery.lastUpdatedAt = hatchAt;
    changed = true;
    changed = advanceNursery(now - hatchAt) || changed;
  } else {
    changed = advanceNursery(now - previous) || changed;
  }

  nursery.lastUpdatedAt = now;
  if (changed) {
    saveSeeds();
    saveNursery();
  }

  return changed;
}

function advanceNursery(deltaMs) {
  if (deltaMs <= 0) return false;

  let changed = false;
  if (nursery.hatchlings.length === 0) {
    nursery.seedTickAccumulatorMs = 0;
    nursery.movementAccumulatorMs = 0;
    return false;
  }

  nursery.seedTickAccumulatorMs += deltaMs;
  while (nursery.seedTickAccumulatorMs >= nurseryConfig.seedIntervalMs && nursery.hatchlings.length > 0) {
    const activeCount = nursery.hatchlings.length;
    if (seedsTotal < activeCount) {
      nursery.seedTickAccumulatorMs = 0;
      break;
    }

    seedsTotal -= activeCount;
    nursery.seedTickAccumulatorMs -= nurseryConfig.seedIntervalMs;
    nursery.hatchlings.forEach((hatchling) => {
      hatchling.progressMs = Math.min(nurseryConfig.growthMs, hatchling.progressMs + nurseryConfig.seedIntervalMs);
    });
    changed = true;

    const graduates = nursery.hatchlings.filter((hatchling) => hatchling.progressMs >= nurseryConfig.growthMs);
    if (graduates.length > 0) {
      nursery.colonyCount += graduates.length;
      nursery.hatchlings = nursery.hatchlings.filter((hatchling) => hatchling.progressMs < nurseryConfig.growthMs);
      changed = true;
    }
  }

  if (nursery.hatchlings.length === 0) {
    nursery.seedTickAccumulatorMs = 0;
    nursery.movementAccumulatorMs = 0;
    return changed;
  }

  nursery.movementAccumulatorMs += deltaMs;
  let moveCount = 0;
  while (nursery.movementAccumulatorMs >= nurseryConfig.moveIntervalMs && moveCount < 48) {
    moveHatchlings();
    nursery.movementAccumulatorMs -= nurseryConfig.moveIntervalMs;
    moveCount += 1;
    changed = true;
  }

  return changed;
}

function createHatchling() {
  const index = nursery.hatchlings.length;
  return {
    id: `hatchling-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    x: index === 0 ? 2 : nurseryConfig.columns - 3,
    y: index === 0 ? 4 : nurseryConfig.rows - 5,
    direction: index % 2 === 0 ? "right" : "left",
    progressMs: 0
  };
}

function moveHatchlings() {
  nursery.hatchlings.forEach((hatchling) => {
    const choices = Object.keys(vectors).filter((directionName) => {
      const vector = vectors[directionName];
      const point = { x: hatchling.x + vector.x, y: hatchling.y + vector.y };
      return point.x >= 0 && point.x < nurseryConfig.columns && point.y >= 0 && point.y < nurseryConfig.rows;
    });
    if (choices.length === 0) return;

    const currentVector = vectors[hatchling.direction];
    const straight = currentVector
      ? { x: hatchling.x + currentVector.x, y: hatchling.y + currentVector.y }
      : null;
    const canContinue = straight && straight.x >= 0 && straight.x < nurseryConfig.columns && straight.y >= 0 && straight.y < nurseryConfig.rows;
    if (!canContinue || Math.random() < 0.24) {
      hatchling.direction = choices[Math.floor(Math.random() * choices.length)];
    }

    const vector = vectors[hatchling.direction];
    hatchling.x = Math.max(0, Math.min(nurseryConfig.columns - 1, hatchling.x + vector.x));
    hatchling.y = Math.max(0, Math.min(nurseryConfig.rows - 1, hatchling.y + vector.y));
  });
}

function buildNurseryGrid() {
  nurseryCells = [];
  nurseryGridEl.replaceChildren();
  for (let y = 0; y < nurseryConfig.rows; y += 1) {
    for (let x = 0; x < nurseryConfig.columns; x += 1) {
      const cell = document.createElement("span");
      cell.className = "nursery-cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      nurseryGridEl.append(cell);
      nurseryCells.push(cell);
    }
  }
}

// Indices of cells lit on the previous render, so we only touch the diff
// instead of clearing all ~180 cells on every refresh.
let litNurseryCells = new Map();
function renderNurseryGrid() {
  const nextLit = new Map();

  nursery.hatchlings.forEach((hatchling) => {
    const vector = vectors[hatchling.direction] || vectors.right;
    const length = hatchlingLength(hatchling.progressMs);
    for (let index = 0; index < length; index += 1) {
      const x = hatchling.x - vector.x * index;
      const y = hatchling.y - vector.y * index;
      if (x < 0 || x >= nurseryConfig.columns || y < 0 || y >= nurseryConfig.rows) continue;
      // Head wins over body if two parts overlap the same cell.
      const cls = index === 0 ? "is-head" : "is-body";
      const cellIndex = y * nurseryConfig.columns + x;
      if (cls === "is-head" || !nextLit.has(cellIndex)) nextLit.set(cellIndex, cls);
    }
  });

  // Clear cells that are no longer lit (or whose class changed).
  litNurseryCells.forEach((cls, cellIndex) => {
    if (nextLit.get(cellIndex) !== cls) nurseryCells[cellIndex].classList.remove(cls);
  });
  // Set cells that are newly lit (or changed class).
  nextLit.forEach((cls, cellIndex) => {
    if (litNurseryCells.get(cellIndex) !== cls) {
      const cell = nurseryCells[cellIndex];
      cell.classList.remove(cls === "is-head" ? "is-body" : "is-head");
      cell.classList.add(cls);
    }
  });

  litNurseryCells = nextLit;
}

function hatchlingLength(progressMs) {
  if (progressMs >= nurseryConfig.threeBlockMs) return 3;
  if (progressMs >= nurseryConfig.twoBlockMs) return 2;
  return 1;
}

function buildHabitatList() {
  habitatCardRefs = habitatConfig.habitats.map((habitat, index) => {
    const card = document.createElement("article");
    card.className = "habitat-card";
    card.innerHTML = `
      <div class="habitat-card-heading">
        <strong class="habitat-name">${habitat.name}</strong>
      </div>
      <p class="habitat-notable" hidden></p>
      <div class="habitat-primary-row">
        <span class="habitat-capacity" tabindex="0">
          <span class="habitat-snakes"><span class="habitat-assigned-count"></span>/<span class="habitat-natural-count"></span>/<span class="habitat-max-count"></span></span>
          <span class="habitat-capacity-tooltip" role="tooltip"></span>
        </span>
        <span class="habitat-production"></span>
      </div>
      <div class="habitat-over-capacity-row" hidden>
        <span class="habitat-provisions-use"></span>
        <span class="habitat-idle-snakes" hidden></span>
      </div>
      <p class="habitat-bonus"></p>
      <div class="habitat-actions">
        <button class="upgrade-button habitat-place-button" type="button">Assign snake</button>
        <button class="upgrade-button habitat-upgrade-button" type="button">Upgrade</button>
      </div>
    `;
    const button = card.querySelector(".habitat-place-button");
    const upgradeButton = card.querySelector(".habitat-upgrade-button");
    button.addEventListener("click", () => placeSnakeInHabitat(index));
    upgradeButton.addEventListener("click", () => upgradeHabitat(index));
    habitatListEl.append(card);
    return {
      card,
      button,
      upgradeButton,
      snakes: card.querySelector(".habitat-snakes"),
      assignedCount: card.querySelector(".habitat-assigned-count"),
      naturalCount: card.querySelector(".habitat-natural-count"),
      maxCount: card.querySelector(".habitat-max-count"),
      capacityTooltip: card.querySelector(".habitat-capacity-tooltip"),
      production: card.querySelector(".habitat-production"),
      overCapacityRow: card.querySelector(".habitat-over-capacity-row"),
      provisionsUse: card.querySelector(".habitat-provisions-use"),
      idleSnakes: card.querySelector(".habitat-idle-snakes"),
      bonus: card.querySelector(".habitat-bonus"),
      notable: card.querySelector(".habitat-notable")
    };
  });
}

function isHabitatUnlocked(habitat) {
  return best >= habitat.unlockScore;
}

function habitatMultiplier(habitat, snakeCount) {
  return habitat.milestones.reduce((multiplier, milestone) => {
    if (snakeCount < milestone.score) return multiplier;
    return habitatConfig.income.milestoneMode === "multiply"
      ? multiplier * milestone.multiplier
      : Math.max(multiplier, milestone.multiplier);
  }, 1);
}

function habitatIncomePerSecond(habitat, snakeCount) {
  const foodMultiplier = habitatConfig.income.foodValueMultiplier ? currentFoodType().value : 1;
  return habitatConfig.income.basePerSecond
    * habitat.incomeMultiplier
    * foodMultiplier
    * habitatMultiplier(habitat, snakeCount);
}

function totalHabitatIncomePerSecond() {
  return window.IdleSnakeEconomy.calculateHabitatActivation(
    habitats.counts, currentFoodType().value, notablesState, habitats.upgradeLevels).incomePerSecond;
}

// The slice of total habitat income that also counts toward egg progress
// (Provisions habitats only). The remainder is plain Seeds: income only.
function totalProvisionsPerSecond() {
  return window.IdleSnakeEconomy.calculateHabitatActivation(
    habitats.counts, currentFoodType().value, notablesState, habitats.upgradeLevels).provisionsProducedPerSecond;
}

function updateHabitatIncome(now) {
  if (!Number.isFinite(habitats.lastUpdatedAt)) {
    habitats.lastUpdatedAt = now;
    saveHabitats();
    return false;
  }
  if (now <= habitats.lastUpdatedAt) return false;

  const deltaMs = now - habitats.lastUpdatedAt;
  const income = totalHabitatIncomePerSecond() * deltaMs / 1000;
  habitats.lastUpdatedAt = now;
  if (income > 0) {
    seedsTotal = Math.round((seedsTotal + income) * 10000) / 10000;
    saveSeeds();
  }
  saveHabitats();
  return income > 0;
}

function renderHabitats() {
  const availableSnakes = Math.floor(nursery.colonyCount);
  const placedSnakes = habitats.counts.reduce((total, count) => total + count, 0);
  const activation = window.IdleSnakeEconomy.calculateHabitatActivation(
    habitats.counts, currentFoodType().value, notablesState, habitats.upgradeLevels,
    { activateAllOverCapacity: provisionsTotal > 0 });
  const fullActivation = window.IdleSnakeEconomy.calculateHabitatActivation(
    habitats.counts, currentFoodType().value, notablesState, habitats.upgradeLevels,
    { activateAllOverCapacity: true });
  const totalIncome = activation.incomePerSecond;
  const totalProvisions = activation.provisionsProducedPerSecond;
  const totalProvisionsUse = activation.provisionsConsumedPerSecond;
  const totalProvisionsDraw = fullActivation.provisionsConsumedPerSecond;
  const totalBranches = activation.branchesPerSecond;
  colonyCountEl.textContent = padScore(availableSnakes);
  colonyPlacedCountEl.textContent = padScore(placedSnakes);
  setText(colonyProvisionTotalEl, formatProvisions(provisionsTotal));
  setText(colonyBranchTotalEl, formatWholeNumber(branchesTotal));
  setText(colonySeedIncomeRateEl, formatDecimal(totalIncome));
  setText(colonyProvisionIncomeRateEl, formatProvisions(totalProvisions));
  setText(colonyBranchIncomeRateEl, formatDecimal(totalBranches));
  setText(colonyProvisionConsumptionRateEl, `${formatProvisions(totalProvisionsUse)} (${formatProvisions(totalProvisionsDraw)} Drawn)`);

  habitatCardRefs.forEach((ref, index) => {
    const habitat = habitatConfig.habitats[index];
    const count = habitats.counts[index];
    const unlocked = isHabitatUnlocked(habitat);
    const perSnakeRate = activation.perSnakeRates[index];
    const multiplier = habitatMultiplier(habitat, count);
    const nextMilestone = habitat.milestones.find((milestone) => count < milestone.score);
    const overCapacity = Math.max(0, count - habitat.naturalCapacity);
    const idleSnakes = activation.idleCounts[index];
    const workingSnakes = activation.activeCounts[index];
    const eggHatchReduction = workingSnakes * (habitat.eggHatchReductionSeconds || 0);
    const seedRate = activation.habitatSeedOutputs[index];
    const branchRate = activation.habitatBranchOutputs[index];
    const provisionRate = habitat.producesProvisions
      ? workingSnakes * perSnakeRate * activation.productionMultipliers[index]
      : 0;
    const provisionsUse = activation.activeOverCapacityCounts[index]
      * perSnakeRate * habitatConfig.income.overCapacityProvisionCost * activation.consumptionMultipliers[index];

    ref.card.classList.toggle("is-locked", !unlocked);
    ref.card.classList.toggle("produces-provisions", Boolean(habitat.producesProvisions));
    ref.card.classList.toggle("produces-branches", Boolean(habitat.producesBranches));
    ref.card.classList.toggle("speeds-egg-hatch", eggHatchReduction > 0);
    const notable = notablesState.retained.find((candidate) => candidate.status === "ASSIGNED" && candidate.assignedHabitatId === index);
    ref.notable.hidden = !notable;
    ref.notable.textContent = notable ? `Leader: ${notableDisplayName(notable)} · ${notablePowerText(notable)}` : "";
    const hardCapacity = activation.hardCapacities[index];
    ref.assignedCount.textContent = formatNumber(count);
    ref.naturalCount.textContent = formatNumber(habitat.naturalCapacity);
    ref.maxCount.textContent = formatNumber(hardCapacity);
    ref.naturalCount.classList.toggle("is-over-natural", count > habitat.naturalCapacity);
    ref.maxCount.classList.toggle("is-at-maximum", count === hardCapacity);
    ref.capacityTooltip.innerHTML = `<ul><li><strong>${formatNumber(count)}</strong> snakes assigned.</li><li>Local resources easily support <strong>${formatNumber(habitat.naturalCapacity)}</strong> individuals.</li><li>Space limits this habitat to <strong>${formatNumber(hardCapacity)}</strong> snakes. Upgrade to increase.</li></ul>`;
    ref.production.textContent = eggHatchReduction > 0
      ? `-${formatDecimal(eggHatchReduction)} sec per egg`
      : `${formatDecimal(seedRate)} seed/sec${branchRate > 0 ? ` + ${formatDecimal(branchRate)} branch/sec` : ""}${provisionRate > 0 ? ` + ${formatProvisions(provisionRate)} provision/sec` : ""}`;
    ref.overCapacityRow.hidden = overCapacity === 0;
    ref.provisionsUse.textContent = `Consumes ${formatProvisions(provisionsUse)}/sec`;
    ref.idleSnakes.hidden = idleSnakes === 0;
    ref.idleSnakes.textContent = `${formatNumber(idleSnakes)} idle snake${idleSnakes === 1 ? "" : "s"}`;
    ref.bonus.textContent = `×${formatDecimal(multiplier, 2)} habitat bonus${nextMilestone ? ` (next at ${formatNumber(nextMilestone.score)} snakes)` : ""}`;
    ref.card.classList.toggle("is-hard-over-capacity", count > hardCapacity);
    ref.button.disabled = !unlocked || availableSnakes < 1 || count >= hardCapacity;
    ref.button.textContent = !unlocked
      ? `Score ${formatNumber(habitat.unlockScore)}`
      : count >= hardCapacity
        ? "At capacity"
      : availableSnakes < 1
        ? "No snakes"
        : "Assign snake";

    const upgradeLevel = habitats.upgradeLevels[index];
    const upgradeCost = window.IdleSnakeEconomy.habitatUpgradeCost(habitat, upgradeLevel);
    ref.upgradeButton.disabled = !unlocked || branchesTotal < upgradeCost;
    ref.upgradeButton.textContent = !unlocked
      ? "Upgrade locked"
      : `Upgrade - ${formatNumber(upgradeCost)} Branches`;

  });
}

function placeSnakeInHabitat(index) {
  const habitat = habitatConfig.habitats[index];
  if (!habitat || !session || !isHabitatUnlocked(habitat) || nursery.colonyCount < 1) return;

  const now = Date.now();
  const { snapshot, events } = session.dispatch({ type: "placeHabitat", index });
  if (events.some((e) => e.type === "actionRejected")) return;
  mirrorEconomyFromWorld(now, snapshot);
  if (events.some((item) => item.type === "NOTABLE_GENERATED")) showNotablesMenu();
  saveNursery();
  saveHabitats();
  syncHud();
  syncPanels(now);
}

let nestVisualHasEgg = null;
function syncNurseryPanel(now = Date.now()) {
  const nurseryUpgrades = window.IdleSnakeConfig.nurseryConfig.upgrades;
  const nestLevel = nursery.nestLevel || 0;
  const nurseryLevel = nursery.nurseryLevel || 0;
  const nestCapacity = Math.min(nurseryUpgrades.nest.maxSlots, 1 + nestLevel * nurseryUpgrades.nest.slotsPerLevel);
  const capacity = nurseryConfig.capacity + nurseryLevel * nurseryUpgrades.nursery.capacityPerLevel;
  const nestCost = Math.ceil(nurseryUpgrades.nest.branchBaseCost * nurseryUpgrades.nest.costRatio ** nestLevel);
  const nurseryBranchCost = Math.ceil(nurseryUpgrades.nursery.branchBaseCost * nurseryUpgrades.nursery.costRatio ** nurseryLevel);
  const nurserySeedCost = Math.ceil(nurseryUpgrades.nursery.seedBaseCost * nurseryUpgrades.nursery.costRatio ** nurseryLevel);
  const eggHatchDuration = nursery.eggHatchDurationMs ?? nurseryConfig.eggHatchMs;
  const hatchAt = nursery.nestStartedAt === null ? null : nursery.nestStartedAt + eggHatchDuration;
  const eggHatchReduction = Math.max(0, (nurseryConfig.eggHatchMs - eggHatchDuration) / 1000);
  const activeCount = nursery.hatchlings.length;
  const eggRequirement = Math.floor(nurseryConfig.eggCost * Math.pow(nurseryConfig.eggCostRatio, nursery.eggsStarted || 0));
  const eggProgress = Math.min(eggRequirement, nursery.eggProgress || 0);
  const displayedProgress = Math.floor(eggProgress);
  const remainingEggSeeds = Math.max(0, eggRequirement - displayedProgress);
  setText(nurseryEggProgressTextEl, `${formatNumber(displayedProgress)} / ${formatNumber(eggRequirement)} seeds`);
  setText(eggProgressRateEl, `+${formatProvisions(totalProvisionsPerSecond())}/s`);
  setText(nurserySeedStatusEl, remainingEggSeeds > 0
    ? `${formatNumber(remainingEggSeeds)} seeds to next egg`
    : "Egg ready · waiting for nursery space");
  const eggProgressPercent = `${Math.min(100, (eggProgress / eggRequirement) * 100)}%`;
  if (eggProgressFillEl.style.width !== eggProgressPercent) eggProgressFillEl.style.width = eggProgressPercent;
  eggProgressFillEl.parentElement.setAttribute("aria-valuemax", String(eggRequirement));
  eggProgressFillEl.parentElement.setAttribute("aria-valuenow", String(displayedProgress));

  // A finished egg held in the nest because the yard is full (eggElapsedMs pinned
  // at eggHatchMs). It keeps the nest occupied and hatches once a slot frees.
  const extraEggs = nursery.nestEggs || [];
  const primaryEggHeld = nursery.eggElapsedMs !== null &&
    nursery.eggElapsedMs >= eggHatchDuration &&
    activeCount >= capacity;
  const extraEggHeld = extraEggs.some((egg) => egg.elapsedMs >= egg.hatchDurationMs) && activeCount >= capacity;
  const eggHeld = primaryEggHeld || extraEggHeld;
  const primaryHatching = hatchAt !== null && now < hatchAt;
  const extraHatching = extraEggs.some((egg) => egg.elapsedMs < egg.hatchDurationMs);
  const hatching = !eggHeld && (primaryHatching || extraHatching);
  if (eggHeld) {
    setText(nestStateEl, `READY · ${1 + (nursery.nestEggs || []).length}/${nestCapacity}`);
    setText(nestTimerEl, "Hatchling ready · waiting for nursery space");
  } else if (hatching) {
    setText(nestStateEl, `HATCHING · ${1 + (nursery.nestEggs || []).length}/${nestCapacity}`);
    setText(nestTimerEl, primaryHatching
      ? `Hatches in ${formatDuration(hatchAt - now)}${eggHatchReduction > 0 ? ` · Lake bonus -${formatDecimal(eggHatchReduction)} sec` : ""}`
      : `${extraEggs.length} egg${extraEggs.length === 1 ? "" : "s"} incubating`);
  } else {
    setText(nestStateEl, `EMPTY · ${(nursery.nestEggs || []).length}/${nestCapacity}`);
    setText(nestTimerEl, activeCount >= capacity ? "Nursery capacity reached" : "Ready for an egg");
  }
  // Only rewrite the nest glyph when the occupancy flips, not every refresh.
  const nestOccupied = eggHeld || hatching;
  if (nestVisualHasEgg !== nestOccupied) {
    nestVisualEl.classList.toggle("has-egg", nestOccupied);
    nestVisualEl.innerHTML = nestOccupied ? '<span class="egg-shape"></span>' : "<span>+</span>";
    nestVisualHasEgg = nestOccupied;
  }

  setText(nurseryCapacityEl, `${activeCount} / ${capacity}`);
  setText(nurseryBranchTotalEl, formatWholeNumber(branchesTotal));
  const nestMaxed = nestCapacity >= nurseryUpgrades.nest.maxSlots;
  nestUpgradeButtonEl.disabled = nestMaxed || branchesTotal < nestCost;
  nestUpgradeButtonEl.textContent = nestMaxed ? "Nest Slots Maxed · 5 / 5" : `Add Nest Slot · ${formatNumber(nestCost)} Branches`;
  nurseryUpgradeButtonEl.disabled = branchesTotal < nurseryBranchCost || seedsTotal < nurserySeedCost;
  nurseryUpgradeButtonEl.textContent = `Upgrade Nursery · ${formatNumber(nurseryBranchCost)} Branches + ${formatNumber(nurserySeedCost)} Seeds`;
  if (activeCount === 0) {
    setText(nurseryGrowthStatusEl, "Waiting for a hatchling");
  } else if (seedsTotal < activeCount) {
    setText(nurseryGrowthStatusEl, "Growth paused · seed bank too low");
  } else {
    setText(nurseryGrowthStatusEl, "Growing · 1 seed/sec each");
  }

  syncHatchlingRows();
  renderHabitats();
  renderNurseryGrid();
}

// Reuse hatchling row elements across refreshes; only create/remove rows when
// the hatchling count changes, and update text/bar width in place otherwise.
const hatchlingRowRefs = [];
function createHatchlingRow() {
  const row = document.createElement("div");
  row.className = "hatchling-row";
  const heading = document.createElement("div");
  heading.className = "hatchling-row-heading";
  const nameEl = document.createElement("span");
  const timeEl = document.createElement("span");
  heading.append(nameEl, timeEl);
  const bar = document.createElement("div");
  bar.className = "growth-bar";
  const fill = document.createElement("span");
  bar.append(fill);
  row.append(heading, bar);
  return { row, nameEl, timeEl, fill };
}

function syncHatchlingRows() {
  const list = nursery.hatchlings;
  while (hatchlingRowRefs.length < list.length) {
    const ref = createHatchlingRow();
    hatchlingRowRefs.push(ref);
    hatchlingListEl.append(ref.row);
  }
  while (hatchlingRowRefs.length > list.length) {
    const ref = hatchlingRowRefs.pop();
    ref.row.remove();
  }
  list.forEach((hatchling, index) => {
    const ref = hatchlingRowRefs[index];
    const percent = Math.round((hatchling.progressMs / nurseryConfig.growthMs) * 100);
    setText(ref.nameEl, `Hatchling ${index + 1}`);
    setText(ref.timeEl, `${formatDuration(nurseryConfig.growthMs - hatchling.progressMs)} left`);
    const width = `${percent}%`;
    if (ref.fill.style.width !== width) ref.fill.style.width = width;
  });
}

function layEgg() {
  if (!session) return;
  const now = Date.now();
  if (seedsTotal !== sessionLastSeeds) session.dispatch({ type: "syncSeeds", seeds: seedsTotal });
  const { snapshot, events } = session.dispatch({ type: "layEgg" });
  if (events.some((e) => e.type === "actionRejected")) return;
  seedsTotal = snapshot.seeds;
  sessionLastSeeds = seedsTotal;
  mirrorEconomyFromWorld(now, snapshot);
  saveSeeds();
  saveNursery();
  syncHud();
  syncPanels(now);
}

// ---- Idle-world bridge -----------------------------------------------------
// The engine owns the economy simulation; these helpers keep the legacy UI
// globals (seedsTotal/nursery/habitats) in sync with world.state so all the
// existing render/panel code keeps working unchanged.

// Copy engine economy state into the legacy globals the UI reads. Converts the
// engine's relative eggElapsedMs back to the absolute nestStartedAt the nursery
// panel expects, using `now` (epoch) so the hatch countdown stays correct.
function mirrorEconomyFromWorld(now, snapshot) {
  if (!session) return;
  const snap = snapshot || session.snapshot();
  const en = snap.nursery;
  nursery.eggElapsedMs = en.eggElapsedMs;
  nursery.nestLevel = en.nestLevel;
  nursery.nurseryLevel = en.nurseryLevel;
  nursery.nestEggs = en.nestEggs;
  nursery.eggHatchDurationMs = en.eggHatchDurationMs;
  nursery.eggProgress = en.eggProgress;
  nursery.eggsStarted = en.eggsStarted;
  nursery.nestStartedAt = en.eggElapsedMs == null ? null : now - en.eggElapsedMs;
  nursery.hatchlings = en.hatchlings;
  nursery.colonyCount = en.colonyCount;
  nursery.seedTickAccumulatorMs = en.seedTickAccumulatorMs;
  nursery.movementAccumulatorMs = en.movementAccumulatorMs;
  nursery.lastUpdatedAt = now;
  habitats.counts = snap.habitats.counts.slice();
  habitats.upgradeLevels = snap.habitats.upgradeLevels.slice();
  habitats.lastUpdatedAt = now;
  notablesState = window.IdleSnakeNotables.createState(snap.notables);
  consolidatedSave.notables = { ...notablesState };
  consolidatedSave.migration = structuredClone(snap.migration);
  consolidatedSave.tradeRoutes = structuredClone(snap.tradeRoutes || []);
  consolidatedSave.activeResupplyMissions = structuredClone(snap.activeResupplyMissions || []);
  consolidatedSave.completedResupplyMissions = structuredClone(snap.completedResupplyMissions || []);
  consolidatedSave.nextResupplyMissionId = snap.nextResupplyMissionId || 1;
  provisionsTotal = snap.provisions;
  branchesTotal = snap.branches;
  const upgradeStateChanged = JSON.stringify(upgrades) !== JSON.stringify(snap.upgrades);
  upgrades = { ...snap.upgrades };
  selectedBoardLevel = Math.min(upgrades.boardLevel, Math.max(0, Number(snap.selectedBoardLevel) || 0));
  if (upgradeStateChanged) boardOptionsBuiltForLevel = -1;
  consolidatedSave.upgrades = { ...upgrades };
  consolidatedSave.board = { ...consolidatedSave.board, selectedBoardLevel };
}

// Advance the idle economy on the unified clock. Called every frame from
// gameLoop with the real wall-clock delta (so it also catches up after the tab
// is throttled in the background); offline-across-reload is handled at load by
// IdleSnakeSave.hydrate. Absorbs gameplay seed changes before ticking and
// writes the result back, then mirrors to the UI globals.
function tickIdleWorld() {
  if (!session) return [];
  const now = Date.now();
  const dt = idleLastWallAt == null ? 0 : now - idleLastWallAt;
  idleLastWallAt = now;
  if (dt <= 0) return [];
  // Reconcile host-owned shared state into the session before ticking, but only
  // when it actually changed (each dispatch clones a snapshot). Seeds are still
  // awarded/spent by not-yet-migrated gameplay; upgrades are still purchased
  // host-side (economy food value depends on them); best comes from gameplay.
  // While a still-host-driven minigame is active, keep the session's snake run
  // from stepping in the background (economy still ticks). Removed in Phase 1.4
  // once every mode runs in the session.
  if (gameMode !== "snake" && latestSnapshot && latestSnapshot.phase === "running") session.dispatch({ type: "pause" });
  if (seedsTotal !== sessionLastSeeds) session.dispatch({ type: "syncSeeds", seeds: seedsTotal });
  if (best !== sessionLastBest) { session.dispatch({ type: "syncBest", best }); sessionLastBest = best; }
  const upgradesJson = JSON.stringify(upgrades);
  if (upgradesJson !== sessionLastUpgradesJson) { session.dispatch({ type: "setUpgrades", upgrades }); sessionLastUpgradesJson = upgradesJson; }
  const { snapshot, events } = session.tick(dt);
  latestSnapshot = snapshot;
  recordBoardMastery(snapshot);
  seedsTotal = snapshot.seeds;
  provisionsTotal = snapshot.provisions;
  branchesTotal = snapshot.branches;
  sessionLastSeeds = seedsTotal;
  best = snapshot.best;
  sessionLastBest = best;
  mirrorEconomyFromWorld(now, snapshot);
  if (events.some((item) => item.type === "NOTABLE_GENERATED")) showNotablesMenu();
  // Persist on the old ~250ms cadence (writes are debounced/coalesced anyway).
  if (now - idleLastPersistAt >= 250) {
    idleLastPersistAt = now;
    saveSeeds();
    saveProvisions();
    saveBranches();
    saveNursery();
    saveHabitats();
  }
  return events;
}

function upgradeHabitat(index) {
  const habitat = habitatConfig.habitats[index];
  if (!habitat || !session || !isHabitatUnlocked(habitat)) return;
  const now = Date.now();
  const { snapshot, events } = session.dispatch({ type: "upgradeHabitat", index });
  if (events.some((event) => event.type === "actionRejected")) return;
  latestSnapshot = snapshot;
  mirrorEconomyFromWorld(now, snapshot);
  saveBranches();
  saveHabitats();
  syncHud();
  syncPanels(now);
}

function upgradeNursery(kind) {
  if (!session) return;
  const now = Date.now();
  const { snapshot, events } = session.dispatch({ type: kind === "nest" ? "upgradeNest" : "upgradeNursery" });
  if (events.some((event) => event.type === "actionRejected")) return;
  latestSnapshot = snapshot;
  mirrorEconomyFromWorld(now, snapshot);
  saveSeeds();
  saveBranches();
  saveNursery();
  syncHud();
  syncPanels(now);
}

nestUpgradeButtonEl.addEventListener("click", () => upgradeNursery("nest"));
nurseryUpgradeButtonEl.addEventListener("click", () => upgradeNursery("nursery"));

function notableDisplayName(notable) {
  return notable.epithet ? `${notable.name}, ${notable.epithet}` : notable.name;
}

function notablePowerText(notable) {
  const percent = `${formatDecimal(notable.powerMagnitude * 100, 0)}%`;
  if (notable.powerType === "PRODUCTION_INCREASE") return `Production +${percent}`;
  if (notable.powerType === "CONSUMPTION_REDUCTION") return `Consumption −${percent}`;
  if (notable.powerType === "CAPACITY_INCREASE") return `Habitat capacity +${percent}`;
  if (notable.powerType === "FORAGER") return `${formatProvisions(notable.powerMagnitude)} Provision per Seed`;
  if (notable.powerType === "RATIONER") return `Shortage productivity ${percent}`;
  return notable.powerType;
}

function notableSourceText(notable) {
  if (notable.sourceType === "BOARD_MASTERY") return `Mastery of ${notable.sourceReference}`;
  if (notable.sourceType === "HABITAT_ASSIGNMENT") return `Placed in ${notable.sourceReference}`;
  if (notable.sourceType === "DIRECT_RECRUITMENT") return "Direct recruitment";
  return notable.sourceReference || notable.sourceType;
}

function notableContributionText(notable) {
  if (notable.powerType === "PRODUCTION_INCREASE") return `Generated ${formatDecimal(notable.totalProductionAdded)} bonus Seeds`;
  if (notable.powerType === "CONSUMPTION_REDUCTION") return `Prevented ${formatProvisions(notable.totalConsumptionPrevented)} Provision consumption`;
  if (notable.powerType === "CAPACITY_INCREASE") return `Enabled ${formatDecimal(notable.totalCapacityEnabled / 3600)} snake-hours of capacity`;
  if (notable.powerType === "FORAGER") return `Foraged ${formatProvisions(notable.totalProvisionsForaged)} Provisions`;
  if (notable.powerType === "RATIONER") return `Preserved ${formatDecimal(notable.totalShortageOutputPreserved)} Seeds during shortages`;
  return "No recorded contribution";
}

function commitNotableAction(action) {
  if (!session) return null;
  const result = session.dispatch({ ...action, now: Date.now() });
  const rejected = result.events.find((item) => item.type === "actionRejected");
  if (rejected) { window.alert(`Unable to complete that action: ${rejected.reason}.`); return result; }
  latestSnapshot = result.snapshot;
  mirrorEconomyFromWorld(Date.now(), result.snapshot);
  if (result.events.some((item) => item.type === "NOTABLE_GENERATED" || item.type === "NOTABLE_PENDING")) showNotablesMenu();
  saveNursery(); saveHabitats(); persistConsolidatedSave(); renderNotables(); syncNurseryPanel(Date.now());
  return result;
}

const NOTABLE_HOLD_CONFIRM_MS = 900;
function makeHoldConfirmButton(label, onConfirm) {
  const button = document.createElement("button");
  button.type = "button"; button.className = "notable-hold-confirm"; button.textContent = `Hold to ${label}`;
  button.style.setProperty("--hold-confirm-ms", `${NOTABLE_HOLD_CONFIRM_MS}ms`);
  let timer = null;
  const cancel = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    button.classList.remove("is-holding");
  };
  const start = (event) => {
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (timer !== null || event.repeat) return;
    button.classList.add("is-holding");
    timer = setTimeout(() => { timer = null; button.classList.remove("is-holding"); onConfirm(); }, NOTABLE_HOLD_CONFIRM_MS);
  };
  button.addEventListener("pointerdown", start);
  ["pointerup", "pointerleave", "pointercancel"].forEach((type) => button.addEventListener(type, cancel));
  button.addEventListener("keydown", start);
  button.addEventListener("keyup", cancel);
  button.addEventListener("blur", cancel);
  button.addEventListener("click", (event) => event.preventDefault());
  return button;
}

function buildNotableCard(notable, elder = false) {
  const card = document.createElement("article"); card.className = "notable-card";
  const habitat = notable.assignedHabitatId == null ? null : habitatConfig.habitats[notable.assignedHabitatId];
  const heading = document.createElement("strong"); heading.textContent = notableDisplayName(notable); card.append(heading);
  const details = document.createElement("p");
  details.textContent = `${notablePowerText(notable)} · ${habitat ? `Leader of ${habitat.name}` : elder ? "Retired" : "Inactive"} · Source: ${notableSourceText(notable)}`;
  card.append(details);
  const service = document.createElement("p"); service.className = "notable-service";
  const servedNames = notable.habitatsServed.map((index) => habitatConfig.habitats[index]?.name).filter(Boolean);
  service.textContent = `${formatDuration(notable.totalServiceTime)} served${servedNames.length ? ` in ${servedNames.join(", ")}` : ""} · ${notableContributionText(notable)}${elder && notable.retiredAt ? ` · Retired ${new Date(notable.retiredAt).toLocaleDateString()}` : ""}`;
  card.append(service);
  if (elder) return card;
  const actions = document.createElement("div"); actions.className = "notable-actions";
  if (notable.assignedHabitatId != null) {
    const unassign = document.createElement("button"); unassign.type = "button"; unassign.textContent = "Unassign";
    unassign.addEventListener("click", () => { if (confirm(`Remove ${notableDisplayName(notable)} from ${habitat.name}?`)) commitNotableAction({ type: "unassignNotable", notableId: notable.id }); });
    actions.append(unassign);
  } else {
    const select = document.createElement("select"); select.setAttribute("aria-label", `Assign ${notableDisplayName(notable)}`);
    const prompt = document.createElement("option"); prompt.value = ""; prompt.textContent = "Assign to…"; select.append(prompt);
    habitatConfig.habitats.forEach((item, index) => {
      if (!habitats.counts[index]) return;
      const option = document.createElement("option"); option.value = String(index);
      const occupant = notablesState.retained.find((candidate) => candidate.assignedHabitatId === index && candidate.id !== notable.id);
      option.textContent = occupant ? `Replace ${notableDisplayName(occupant)} in ${item.name}` : item.name;
      if (notable.powerType === "FORAGER" && !window.IdleSnakeNotables.isForagerEligible(item)) { option.disabled = true; option.textContent += " (Forager ineligible)"; }
      select.append(option);
    });
    select.addEventListener("change", () => {
      if (select.value === "") return;
      commitNotableAction({ type: "assignNotable", notableId: notable.id, habitatId: Number(select.value) });
    });
    actions.append(select);
  }
  const retire = makeHoldConfirmButton(notable.hasServed ? "Retire" : "Dismiss", () =>
    commitNotableAction({ type: notable.hasServed ? "retireNotable" : "dismissNotable", notableId: notable.id }));
  actions.append(retire); card.append(actions); return card;
}

function syncNotablesSummary() {
  if (!notablesButtonEl) return;
  const capacity = latestSnapshot?.notableCapacity ?? window.IdleSnakeNotables.capacity(notablesState, habitats.counts);
  const over = notablesState.retained.length > capacity;
  const label = `Notables: ${notablesState.retained.length} / ${capacity}${over ? " · Over Capacity" : ""}`;
  notablesButtonEl.textContent = label; if (notablesSummaryEl) notablesSummaryEl.textContent = label;
  return over;
}

function renderNotables() {
  const over = syncNotablesSummary();
  if (!notablesPanelEl || notablesPanelEl.hidden) return;
  notablesRosterEl.replaceChildren(...notablesState.retained.map((item) => buildNotableCard(item)));
  if (!notablesState.retained.length) notablesRosterEl.textContent = "No retained Notables.";
  eldersRosterEl.replaceChildren(...notablesState.elders.map((item) => buildNotableCard(item, true)));
  if (!notablesState.elders.length) eldersRosterEl.textContent = "No Elders yet.";
  const pending = notablesState.pending[0]; pendingNotableEl.replaceChildren();
  if (pending) {
    const card = buildNotableCard(pending); card.classList.add("is-pending");
    const title = document.createElement("h3"); title.textContent = `Pending candidate (${notablesState.pending.length})`; pendingNotableEl.append(title, card);
    const relieve = document.createElement("button"); relieve.type = "button"; relieve.textContent = "Relieve"; relieve.addEventListener("click", () => commitNotableAction({ type: "resolvePendingNotable", decision: "RELIEVE" }));
    card.querySelector(".notable-actions")?.remove(); const actions = document.createElement("div"); actions.className = "notable-actions"; actions.append(relieve);
    const replaceSelect = document.createElement("select"); replaceSelect.setAttribute("aria-label", `Replace a retained Notable with ${notableDisplayName(pending)}`);
    const replacePrompt = document.createElement("option"); replacePrompt.value = ""; replacePrompt.textContent = "Replace a Notable…"; replaceSelect.append(replacePrompt);
    notablesState.retained.forEach((existing) => { const option = document.createElement("option"); option.value = existing.id; option.textContent = notableDisplayName(existing); replaceSelect.append(option); });
    replaceSelect.addEventListener("change", () => { if (replaceSelect.value) commitNotableAction({ type: "resolvePendingNotable", decision: "REPLACE", replaceNotableId: replaceSelect.value }); });
    actions.append(replaceSelect); card.append(actions);
  }
  const cost = window.IdleSnakeConfig.notableConfig.directRecruitmentCost;
  recruitNotableButtonEl.disabled = nursery.colonyCount < cost || over;
  recruitNotableButtonEl.textContent = `Recruit Notable · Sacrifice ${cost} unassigned snakes`;
}

function showNotablesMenu() {
  if (!colonyOverviewEl || !notablesPanelEl) return;
  colonyOverviewEl.hidden = true;
  notablesPanelEl.hidden = false;
  renderNotables();
}

function showColonyOverview() {
  if (!colonyOverviewEl || !notablesPanelEl) return;
  notablesPanelEl.hidden = true;
  colonyOverviewEl.hidden = false;
}

function recordBoardMastery(snapshot) {
  if (!snapshot || snapshot.mode !== "snake" || !snapshot.active) return;
  const activeGrid = snapshot.active.grid;
  const size = `${activeGrid.columns}x${activeGrid.rows}`;
  const mastery = window.IdleSnakeConfig.boardMasteryConfig.find((item) => item.boardSize === size);
  if (!mastery || snapshot.active.score < mastery.masteryScore) return;
  if (boardMastery[size]) return;
  const reward = session.dispatch({ type: "claimBoardMastery", masteryId: mastery.masteryId, now: Date.now() });
  if (reward.events.some((item) => item.type === "actionRejected")) return;
  latestSnapshot = reward.snapshot;
  mirrorEconomyFromWorld(Date.now(), reward.snapshot);
  if (reward.events.some((item) => item.type === "NOTABLE_GENERATED")) showNotablesMenu();
  boardMastery[size] = true;
  consolidatedSave.board.mastery = { ...boardMastery };
  boardOptionsBuiltForLevel = -1;
  persistConsolidatedSave();
  syncUpgradeMenu();
}

// Rebuild the session from the current consolidatedSave (used at boot and after a
// save import). createGameSession anchors the offline clock to the save's
// savedAt; advanceOffline then credits idle income for the time the app was
// closed. Finally mirror the economy into the UI globals.
function initIdleWorld() {
  if (!window.IdleSnakeSession) return;
  session = window.IdleSnakeSession.createGameSession({ save: consolidatedSave, now: Date.now(), rng: Math.random });
  const { snapshot } = session.advanceOffline(Date.now());
  latestSnapshot = snapshot;
  idleLastWallAt = Date.now();
  idleLastPersistAt = idleLastWallAt;
  seedsTotal = snapshot.seeds;
  provisionsTotal = snapshot.provisions;
  branchesTotal = snapshot.branches;
  sessionLastSeeds = seedsTotal;
  best = snapshot.best;
  sessionLastBest = best;
  mirrorEconomyFromWorld(idleLastWallAt, snapshot);
  if (snapshot.notables.pending.length) showNotablesMenu();
}

// Copy the session's snake run into the legacy globals the renderer reads.
// modeAccumulatorMs/elapsedMs come straight from the snapshot so the existing
// interpolation (interpolatedPoint) and HUD timer keep working unchanged.
function mirrorSnakeFromSnapshot(snap) {
  if (!snap || snap.mode !== "snake" || !snap.active) return;
  const a = snap.active;
  snake = a.snake.map((part) => ({ x: part.x, y: part.y }));
  foods = a.foods.map((food) => ({ ...food }));
  direction = a.direction;
  nextDirection = a.nextDirection;
  directionQueue = a.directionQueue.slice();
  score = a.score;
  tickMs = a.tickMs;
  grid = a.grid;
  stepAccumulatorMs = snap.modeAccumulatorMs;
  elapsedMs = snap.elapsedMs;
}

// Interpret events returned by a session tick. Economy events (hatch) refresh
// the panels; snake events reproduce the HUD/save/overlay/animation side-effects
// the engine deliberately omits (mirrors the old host step() event loop).
// Persistence of seeds is handled by tickIdleWorld's throttled cadence, so
// seedsChanged is intentionally not persisted here (economy emits it constantly).
function interpretSessionEvents(events) {
  if (!events || events.length === 0) return;
  for (const event of events) {
    switch (event.type) {
      case "hatch":
      case "eggBoardHatched": idleLastPanelAt = 0; break;
      case "eat": if (gameMode === "snake") startDigestionAnimation(); break;
      case "shield": if (gameMode === "snake") saveUpgrades(); break;
      case "bestScore": if (gameMode === "snake") setSaveItem("best", String(best)); break;
      case "gameOver": if (gameMode === "snake") { state = "gameover"; syncHud(); showOverlay("Game Over"); } break;
      case "win": if (gameMode === "snake") { state = "gameover"; syncHud(); showOverlay("Maxed"); } break;
      case "migrationStopReached": setScreenHint("A migration convoy is waiting at a stop."); idleLastPanelAt = 0; break;
      case "migrationFailed": setScreenHint("A migration expedition was lost."); idleLastPanelAt = 0; break;
      case "settlementEstablished": setScreenHint("A new settlement is fully established."); idleLastPanelAt = 0; break;
      case "migrationChallengeCompleted": state = "gameover"; syncHud(); showOverlay("Challenge complete"); setScreenHint("The convoy passed the Seed Trial."); idleLastPanelAt = 0; break;
      case "migrationChallengeFailed": state = "gameover"; syncHud(); showOverlay("Attempt failed"); setScreenHint("The convoy took losses. Retry or skip from Migration."); idleLastPanelAt = 0; break;
    }
  }
}

function runNurseryClock() {
  const now = Date.now();
  tickIdleWorld();
  setText(seedsTotalEl, padSeeds(seedsTotal));
  syncPanels(now);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function togglePause() {
  if (gameMode === "battleship" && battleship && battleship.phase === "placement") {
    // During fleet setup the Pause button doubles as "rotate".
    battleshipRotate();
    return;
  }
  if (state === "ready") return;
  if (state === "gameover") {
    if (isMinigameMode()) restartCurrentMinigame();
    else freshGame();
    return;
  }
  if (state === "paused") {
    state = "running";
    lastFrameAt = performance.now();
    stepAccumulatorMs = 0;
    syncHud();
    hideOverlay();
  } else if (state === "running") {
    state = "paused";
    syncHud();
    showOverlay("Paused");
  }
}

function resetGame() {
  if (isMinigameMode()) {
    restartCurrentMinigame();
    return;
  }
  freshGame();
}

let idleLastPanelAt = 0;
function gameLoop(now) {
  // Idle economy advances on the SAME clock as gameplay, every frame, whatever
  // the gameplay phase (menu/ready/running/paused/gameover). This replaces the
  // old separate setInterval(runNurseryClock, 250).
  // Core snake now runs inside the session (stepped by tickIdleWorld). Remember
  // the pre-step body so the smooth interpolation has a "from" position — but
  // only adopt it as previousSnake on frames where a step actually lands. The
  // session only advances the body once per tickMs (every ~3-6 frames), so
  // overwriting previousSnake every frame collapsed the slide to a one-frame
  // teleport-per-tick, which read as shake (worse the longer the body got).
  const snakeBeforeStep = gameMode === "snake" && state === "running"
    ? snake.map((part) => ({ ...part }))
    : null;

  const sessionEvents = tickIdleWorld();
  interpretSessionEvents(sessionEvents);
  setText(seedsTotalEl, padSeeds(seedsTotal));
  const wallNow = Date.now();
  if (wallNow - idleLastPanelAt >= 200) {
    idleLastPanelAt = wallNow;
    syncPanels(wallNow);
  }

  if (gameMode === "snake") {
    // The session advanced (or held) the snake; mirror it into the render globals.
    if (latestSnapshot) mirrorSnakeFromSnapshot(latestSnapshot);
    if (state === "running") {
      // A step landed iff the head moved (or the body grew). Only then does the
      // pre-step body become the interpolation origin; otherwise previousSnake
      // is kept so the slide toward the current cell continues across frames.
      if (snakeBeforeStep && snakeStepped(snakeBeforeStep, snake)) previousSnake = snakeBeforeStep;
      syncHud();
    }
  } else if (state === "running") {
    const deltaMs = Math.min(100, now - lastFrameAt);
    elapsedMs += deltaMs;
    stepAccumulatorMs += deltaMs;
    while (stepAccumulatorMs >= tickMs && state === "running" && gameMode !== "broodline") {
      if (gameMode === "breakout") stepBreakout(tickMs);
      else if (gameMode === "runner") stepRunner(tickMs);
      else if (gameMode === "centipede") stepCentipede();
      else if (gameMode === "crossing") stepCrossing(now);
      else if (gameMode === "duel") stepVsSnake();
      else if (gameMode === "snakebird") {
        stepAccumulatorMs = 0;
        break;
      }
      else if (gameMode === "sokoban") {
        stepAccumulatorMs = 0;
        break;
      }
      else if (gameMode === "battleship") {
        stepBattleship(now);
        stepAccumulatorMs = 0;
        break;
      }
      else if (gameMode === "broodline") broodlineStep();
      else if (gameMode === "maze") {
        if (!stepMaze()) {
          stepAccumulatorMs = 0;
          break;
        }
      }
      stepAccumulatorMs -= tickMs;
    }
    if (gameMode === "broodline") {
      while (stepAccumulatorMs >= broodlineTickMs && state === "running") {
        broodlineStep();
        stepAccumulatorMs -= broodlineTickMs;
      }
    }
    syncHud();
  }

  lastFrameAt = now;
  render();
  animationId = requestAnimationFrame(gameLoop);
}

function stepCrossing(now) {
  if (!crossingSnake || !crossingCars) return;

  if (crossingPhase === "clearing") {
    previousCrossingSnake = crossingSnake.map((part) => ({ ...part }));
    if (now < crossingTransitionUntil) return;
    crossingStage += 1;
    resetCrossingStage();
    hideOverlay();
    setScreenHint(`Stage ${crossingStage}: reach the top bank`);
    syncHud();
    return;
  }

  // Active-phase step delegated to the headless engine (engine/crossing.js).
  // Host keeps the previousCrossingSnake anti-flicker snapshots, death handling,
  // and the stage-clear rewards/overlay/phase transition.
  const snapshot = crossingSnake.map((part) => ({ ...part }));
  const sim = {
    grid: crossingGrid, snake: crossingSnake, cars: crossingCars, score: crossingScore,
    stage: crossingStage, snakeLength: crossingSnakeLength, entryColumn: crossingEntryColumn,
    direction, nextDirection, directionQueue
  };
  const { events, alive } = window.IdleSnakeCrossing.stepCrossing(sim);

  crossingSnake = sim.snake;
  crossingCars = sim.cars;
  crossingScore = sim.score;
  crossingSnakeLength = sim.snakeLength;
  crossingEntryColumn = sim.entryColumn;
  direction = sim.direction;
  nextDirection = sim.nextDirection;
  previousCrossingSnake = snapshot;

  if (!alive) {
    endCrossing();
    return;
  }

  for (const event of events) {
    if (event.type === "stageClear") {
      crossingBest = Math.max(crossingBest, crossingScore);
      seedsTotal += event.reward;
      saveSeeds();
      setSaveItem("crossing-best", String(crossingBest));
      // Snap the snapshot to match so the clearing pause doesn't replay the
      // final hop's interpolation (the end-of-stage flicker).
      previousCrossingSnake = crossingSnake.map((part) => ({ ...part }));
      crossingPhase = "clearing";
      crossingTransitionUntil = now + 500;
      syncHud();
      showOverlay(`Stage ${crossingStage} Clear · +${formatNumber(event.reward)} Seeds`);
      setScreenHint("Next road loading");
    }
  }
}

function updateCrossingCars() {
  crossingCars.forEach((car) => {
    car.x += car.speed;
    while (car.x >= crossingGrid.columns) car.x -= crossingGrid.columns;
    while (car.x + car.width <= 0) car.x += crossingGrid.columns;
  });
}

function isCrossingCarHit() {
  // Shrink the collision box inward to match the car's visual inset
  // (drawCrossingCar insets by ~0.12 cell on each side) instead of using
  // the full logical width, which felt too wide horizontally.
  const carMargin = 0.18;
  return crossingSnake.some((part) => crossingCars.some((car) => {
    if (car.row !== part.y) return false;
    return [-crossingGrid.columns, 0, crossingGrid.columns].some((offset) => {
      const left = car.x + offset + carMargin;
      const right = car.x + offset + car.width - carMargin;
      return part.x + 1 > left && part.x < right;
    });
  }));
}

function endCrossing() {
  state = "gameover";
  crossingPhase = "gameover";
  directionQueue = [];
  crossingBest = Math.max(crossingBest, crossingScore);
  setSaveItem("crossing-best", String(crossingBest));
  setScreenHint("");
  syncHud();
  showOverlay(`Roadkill · Stage ${crossingStage}`);
}

function stepBreakout(deltaMs) {
  if (!breakout) return;
  // Physics simulation delegated to the headless engine (engine/breakout.js).
  // Host passes the canvas-derived board dimensions and interprets win/loss/
  // ball-lost events.
  const { events } = window.IdleSnakeBreakout.step(breakout, {
    deltaMs, boardWidth: boardMetrics.width, boardHeight: boardMetrics.height,
    elapsedMs, rng: Math.random
  });
  for (const event of events) {
    if (event.type === "win") { endBreakout(true); return; }
    if (event.type === "gameOver") { endBreakout(false); return; }
    if (event.type === "ballLost") {
      state = "ready";
      syncHud();
      showOverlay(`Ball Lost · ${event.lives} ${event.lives === 1 ? "life" : "lives"} left`);
      setScreenHint("Left / right to move · catch seeds to grow");
    }
  }
}

function endBreakout(won) {
  state = "gameover";
  breakoutBest = Math.max(breakoutBest, breakout.score);
  setSaveItem("breakout-best", String(breakoutBest));
  if (won) {
    seedsTotal += 500;
    saveSeeds();
  }
  syncHud();
  showOverlay(won ? "Level Clear · +500 Seeds" : "Game Over");
}

function stepRunner(deltaMs) {
  if (!runner) return;
  const { events } = window.IdleSnakeRunner.step(runner, { deltaMs, rng: Math.random });
  for (const event of events) {
    if (event.type !== "gameOver") continue;
    state = "gameover";
    runnerBest = Math.max(runnerBest, event.score);
    setSaveItem("runner-best", String(runnerBest));
    seedsTotal += event.reward;
    saveSeeds();
    syncHud();
    showOverlay(`Runner Down · +${formatNumber(event.reward)} Seeds`);
    setScreenHint("Start to run again");
    return;
  }
}

// Centipede (minigame 9). A villain centipede winds down a mushroom field; the
// shooter roams the bottom band and auto-fires. Grid logic lives in the headless
// engine (engine/centipede.js); the host owns input, rendering (the villain is
// tinted with the player's snake colors) and the score/wave/game-over events.
function launchCentipede() {
  hideSnakebirdPicker();
  hidePersonalization();
  if (gameMode === "centipede" && state !== "gameover") return;
  gameMode = "centipede";
  grid = { ...centipedeGrid };
  boardMetrics = getBoardMetrics();
  centipede = window.IdleSnakeCentipede.createState({
    cols: centipedeGrid.columns,
    rows: centipedeGrid.rows,
    rng: Math.random
  });
  direction = "right";
  nextDirection = "right";
  directionQueue = [];
  state = "ready";
  tickMs = 70;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  syncHud();
  render();
  showOverlay("Centipede · Ready");
  setScreenHint("Arrows to move · you auto-fire upward");
}

function stepCentipede() {
  if (!centipede) return;
  const { events, alive } = window.IdleSnakeCentipede.step(centipede, { rng: Math.random });
  for (const event of events) {
    if (event.type === "gameOver") { endCentipede(); return; }
    if (event.type === "playerHit" && alive) {
      // Pause after a hit so the player can regroup before the next life.
      state = "ready";
      syncHud();
      showOverlay(`Hit! · ${event.lives} ${event.lives === 1 ? "life" : "lives"} left`);
      setScreenHint("Arrows to move · you auto-fire upward");
      return;
    }
  }
  syncHud();
}

function endCentipede() {
  state = "gameover";
  centipedeBest = Math.max(centipedeBest, centipede.score);
  setSaveItem("centipede-best", String(centipedeBest));
  const reward = 40 * centipede.wavesCleared + Math.floor(centipede.score / 20);
  if (reward > 0) {
    seedsTotal += reward;
    saveSeeds();
  }
  syncHud();
  showOverlay(reward > 0 ? `Game Over · +${formatNumber(reward)} Seeds` : "Game Over");
}

// Core snake step, delegated to the headless engine (engine/snake.js). The host
// keeps the purely-visual concerns — the previousSnake snapshot for smooth
// interpolation and the digestion animation — and turns the engine's returned
// events into the HUD/save/overlay side-effects the engine deliberately omits.
function step() {
  previousSnake = snake.map((part) => ({ ...part }));
  const SnakeEngine = window.IdleSnakeSnake;

  // A state view over the live globals. Arrays (snake/foods/directionQueue) are
  // mutated in place by the engine; scalars are read back afterwards.
  const sim = {
    grid, snake, foods, direction, nextDirection, directionQueue,
    score, tickMs, upgrades, seeds: seedsTotal, best
  };
  const { events } = SnakeEngine.stepSnake(sim, { rng: Math.random });

  snake = sim.snake;
  foods = sim.foods;
  direction = sim.direction;
  nextDirection = sim.nextDirection;
  directionQueue = sim.directionQueue;
  score = sim.score;
  tickMs = sim.tickMs;
  seedsTotal = sim.seeds;
  best = sim.best;

  for (const event of events) {
    switch (event.type) {
      case "eat": startDigestionAnimation(); break;
      case "seedsChanged": saveSeeds(); break;
      case "shield": saveUpgrades(); break;
      case "bestScore": setSaveItem("best", String(best)); break;
      case "hudDirty": syncHud(); break;
      case "gameOver": state = "gameover"; syncHud(); showOverlay("Game Over"); break;
      case "win": state = "gameover"; syncHud(); showOverlay("Maxed"); break;
    }
  }
}

function endGame() {
  state = "gameover";
  if (score > best) {
    best = score;
    setSaveItem("best", String(best));
  }
  syncHud();
  showOverlay("Game Over");
}

function winGame() {
  state = "gameover";
  best = Math.max(best, score);
  setSaveItem("best", String(best));
  syncHud();
  showOverlay("Maxed");
}

function placeFood() {
  const occupied = new Set([
    ...snake.map((part) => `${part.x},${part.y}`),
    ...foods.map((snack) => `${snack.x},${snack.y}`)
  ]);
  const open = [];

  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        open.push({ x, y });
      }
    }
  }

  if (open.length === 0) {
    return null;
  }

  return open[Math.floor(Math.random() * open.length)];
}

function spawnFoods() {
  const spawned = [];
  foods = spawned;
  while (spawned.length < foodCount()) {
    const snack = placeFood();
    if (!snack) break;
    spawned.push(snack);
  }
  return spawned;
}

function findShieldRedirect() {
  if (upgrades.shieldLevel <= 0) return null;

  const turnDirections = direction === "up" || direction === "down"
    ? ["left", "right"]
    : ["up", "down"];
  const candidates = turnDirections
    .map((candidateDirection) => {
      const vector = vectors[candidateDirection];
      const point = {
        x: snake[0].x + vector.x,
        y: snake[0].y + vector.y
      };
      return {
        direction: candidateDirection,
        point,
        clearance: obstacleClearance(point, vector)
      };
    })
    .filter((candidate) => !isWallHit(candidate.point) && !isSnakeHit(candidate.point, false));

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.clearance - a.clearance);
  return candidates[0];
}

function obstacleClearance(point, vector) {
  let distance = 0;
  let probe = point;
  while (!isWallHit(probe) && !isSnakeHit(probe, false)) {
    distance += 1;
    probe = { x: probe.x + vector.x, y: probe.y + vector.y };
  }
  return distance;
}

function queueDirection(next) {
  if (!vectors[next]) return;
  if (gameMode === "snakebird") {
    queueSnakebirdDirection(next);
    return;
  }
  if (gameMode === "sokoban") {
    queueSokobanDirection(next);
    return;
  }
  if (gameMode === "broodline") {
    if (state === "ready") startGame();
    if (state !== "running" || broodline.queue.length >= 2) return;
    const queuedFrom = broodline.queue.at(-1) || broodline.direction;
    if (vectors[queuedFrom].x + vectors[next].x === 0 && vectors[queuedFrom].y + vectors[next].y === 0) return;
    broodline.queue.push(next);
    return;
  }
  if (gameMode === "breakout") {
    if (next === "left" || next === "right") {
      if (state === "ready") startGame();
      if (state !== "gameover" && breakout) breakout.paddle.input = next === "left" ? -1 : 1;
    }
    return;
  }
  if (gameMode === "runner") {
    if (next === "up") runnerJump();
    return;
  }
  if (gameMode === "centipede") {
    if (state === "ready") startGame();
    if (state !== "gameover" && centipede) {
      if (next === "left") centipede.player.inputX = -1;
      else if (next === "right") centipede.player.inputX = 1;
      else if (next === "up") centipede.player.inputY = -1;
      else if (next === "down") centipede.player.inputY = 1;
    }
    return;
  }
  if (gameMode === "crossing") {
    queueCrossingDirection(next);
    return;
  }
  if (gameMode === "maze") {
    queueMazeDirection(next);
    return;
  }
  if (gameMode === "duel") {
    queueDuelDirection(next);
    return;
  }
  if (gameMode === "battleship") {
    battleshipMoveCursor(next);
    return;
  }
  if (state === "ready") startGame();
  // The session owns the snake run: it validates the turn (reversal/dedup/queue
  // cap) and, from a ready run, begins running. Globals are mirrored next frame.
  session.dispatch({ type: "direction", direction: next });
}

function queueSnakebirdDirection(next) {
  if (snakebirdScreen && !snakebirdScreen.hidden) return;
  if (state === "ready") startGame();
  if (state !== "running") return;
  snakebirdMove(next);
}

function queueSokobanDirection(next) {
  if (state === "ready") startGame();
  if (state !== "running") return;
  sokobanMove(next);
}

function queueCrossingDirection(next) {
  if (state === "gameover" || state === "paused" || crossingPhase !== "playing") return;
  if (state === "ready") startGame();

  const queuedFrom = directionQueue.length > 0
    ? directionQueue[directionQueue.length - 1]
    : direction;

  const currentVector = vectors[queuedFrom];
  const nextVector = vectors[next];
  const reversing =
    currentVector.x + nextVector.x === 0 &&
    currentVector.y + nextVector.y === 0;
  // Backing down off the bank is blocked, but repeating forward/side is allowed
  // so the snake can advance every step (forward or to the side).
  if (reversing && crossingSnake.length > 1) return;

  if (directionQueue.length >= maxQueuedDirections) directionQueue.shift();
  directionQueue.push(next);
  nextDirection = next;
}

function queueDuelDirection(next) {
  if (state === "gameover" || state === "paused") return;
  if (state === "ready") startGame();

  const queuedFrom = directionQueue.length > 0
    ? directionQueue[directionQueue.length - 1]
    : duelPlayer.direction;
  if (next === queuedFrom) return;

  const currentVector = vectors[queuedFrom];
  const nextVector = vectors[next];
  if (currentVector.x + nextVector.x === 0 && currentVector.y + nextVector.y === 0) return;

  if (directionQueue.length >= maxQueuedDirections) {
    directionQueue.shift();
  }

  directionQueue.push(next);
  nextDirection = next;
}

function queueMazeDirection(next) {
  if (state === "gameover" || state === "paused") return;
  if (state === "ready") startGame();
  if (!vectors[next]) return;
  const current = directionQueue.length ? directionQueue[directionQueue.length - 1] : direction;
  const currentVector = vectors[current];
  const nextVector = vectors[next];
  if (currentVector.x + nextVector.x === 0 && currentVector.y + nextVector.y === 0) return;
  directionQueue = [next];
  nextDirection = next;
}

function updateDirectionButtonPressed(directionName) {
  const button = document.querySelector(`[data-direction="${directionName}"]`);
  if (!button) return;

  const keyIsPressed = [...activeDirectionKeys].some((key) => keyMap[key] === directionName);
  button.classList.toggle("is-pressed", keyIsPressed || activeDirectionClicks.has(directionName));
}

function animateDirectionClick(directionName, elapsedMs) {
  if (elapsedMs >= minimumDirectionClickMs) return;

  clearTimeout(directionClickTimers.get(directionName));
  activeDirectionClicks.add(directionName);
  updateDirectionButtonPressed(directionName);

  const remainingMs = minimumDirectionClickMs - elapsedMs;
  directionClickTimers.set(directionName, setTimeout(() => {
    activeDirectionClicks.delete(directionName);
    directionClickTimers.delete(directionName);
    updateDirectionButtonPressed(directionName);
  }, remainingMs));
}

function isWallHit(point) {
  return point.x < 0 || point.x >= grid.columns || point.y < 0 || point.y >= grid.rows;
}

function isSnakeHit(point, willGrow) {
  const body = willGrow ? snake : snake.slice(0, -1);
  return body.some((part) => part.x === point.x && part.y === point.y);
}

function duelContains(body, point) {
  return body.some((part) => part.x === point.x && part.y === point.y);
}

function duelNextHead(snakeRef) {
  const vector = vectors[snakeRef.direction];
  return { x: snakeRef.body[0].x + vector.x, y: snakeRef.body[0].y + vector.y };
}

function duelSafeDirections(snakeRef, otherRef) {
  return Object.keys(vectors).filter((candidate) => {
    const vector = vectors[candidate];
    if (vector.x + vectors[snakeRef.direction].x === 0 && vector.y + vectors[snakeRef.direction].y === 0) return false;
    const point = { x: snakeRef.body[0].x + vector.x, y: snakeRef.body[0].y + vector.y };
    return !isWallHit(point) && !duelContains(snakeRef.body, point) && !duelContains(otherRef.body, point);
  });
}

function chooseOpponentDirection() {
  const safe = duelSafeDirections(duelOpponent, duelPlayer);
  if (safe.length === 0) return;
  const target = duelFoods.reduce((closest, food) => {
    const distance = Math.abs(food.x - duelOpponent.body[0].x) + Math.abs(food.y - duelOpponent.body[0].y);
    return !closest || distance < closest.distance ? { food, distance } : closest;
  }, null);
  safe.sort((a, b) => {
    const av = vectors[a];
    const bv = vectors[b];
    const aPoint = { x: duelOpponent.body[0].x + av.x, y: duelOpponent.body[0].y + av.y };
    const bPoint = { x: duelOpponent.body[0].x + bv.x, y: duelOpponent.body[0].y + bv.y };
    if (!target) return 0;
    return (Math.abs(aPoint.x - target.food.x) + Math.abs(aPoint.y - target.food.y)) -
      (Math.abs(bPoint.x - target.food.x) + Math.abs(bPoint.y - target.food.y));
  });
  duelOpponent.direction = safe[0];
}

function stepVsSnake() {
  previousDuelPlayerBody = duelPlayer.body.map((part) => ({ ...part }));
  previousDuelOpponentBody = duelOpponent.body.map((part) => ({ ...part }));

  // Duel simulation (movement, simultaneous collision, opponent AI, food)
  // delegated to the headless engine (engine/duel.js). Host keeps the
  // previous-body snapshots and the win reward/overlay via endVsSnake.
  const sim = {
    grid: duelGrid, player: duelPlayer, opponent: duelOpponent, foods: duelFoods,
    score: duelScore, directionQueue, direction, nextDirection
  };
  const { alive, winner } = window.IdleSnakeDuel.stepVsSnake(sim, { rng: Math.random });

  duelFoods = sim.foods;
  duelScore = sim.score;
  direction = sim.direction;
  nextDirection = sim.nextDirection;

  if (!alive) {
    duelWinner = winner;
    endVsSnake(winner);
  }
}

function endVsSnake(winner) {
  state = "gameover";
  const reward = winner === "player" ? Math.max(5, best * 5) : 0;
  if (reward) {
    seedsTotal += reward;
    saveSeeds();
  }
  syncHud();
  showOverlay(winner === "player" ? `You Win · +${formatNumber(reward)} Seeds` : winner === "opponent" ? "White Snake Wins" : "Draw");
}

function mazeKey(point) {
  return `${point.x},${point.y}`;
}

function isMazeOpen(point) {
  return !isWallHit(point) && maze?.open.has(mazeKey(point));
}

function isMazeExit(point) {
  return point.x === mazeExit.x && point.y === mazeExit.y;
}

function oppositeDirection(name) {
  const vector = vectors[name];
  return Object.keys(vectors).find((candidate) => {
    const candidateVector = vectors[candidate];
    return candidateVector.x + vector.x === 0 && candidateVector.y + vector.y === 0;
  });
}

function mazeDirectionsFrom(point, previousDirection = mazeDirection) {
  const reverse = previousDirection ? oppositeDirection(previousDirection) : null;
  return Object.keys(vectors).filter((candidate) => {
    if (candidate === reverse) return false;
    const vector = vectors[candidate];
    return isMazeOpen({ x: point.x + vector.x, y: point.y + vector.y });
  });
}

function spawnMazeFood() {
  const candidates = [];
  for (const cell of maze.open) {
    const [x, y] = cell.split(",").map(Number);
    if (!mazePath.some((part) => part.x === x && part.y === y)) candidates.push({ x, y });
  }
  maze.food = candidates[Math.floor(Math.random() * candidates.length)] || null;
}

function showMazeChoices(readyChoices = null) {
  if (state !== "running") return;
  const choices = readyChoices || mazeDirectionsFrom(mazePath[mazePath.length - 1]);
  if (choices.length === 0) {
    endMaze(false);
    return;
  }
  mazeChoiceDirections = choices;
  mazeTravelDirection = null;
  hideOverlay();
  setScreenHint(`Choose: ${choices.map((choice) => choice.toUpperCase()).join(" / ")}`);
}

function moveThroughMaze(startDirection) {
  const choices = mazeChoiceDirections.length ? mazeChoiceDirections : mazeDirectionsFrom(mazePath[mazePath.length - 1]);
  if (!choices.includes(startDirection)) return;

  mazeTravelDirection = startDirection;
  mazeChoiceDirections = [];
  stepAccumulatorMs = 0;
  hideOverlay();
  setScreenHint("");
}

function stepMaze() {
  if (!maze || state !== "running") return false;

  // Step logic delegated to the headless engine (engine/maze.js). Host keeps the
  // previousSnake snapshot (only on a surviving move, as before), the round-clear
  // overlay/timeout, and death handling.
  const snapshot = mazePath.map((part) => ({ ...part }));
  const sim = {
    grid: mazeGrid, open: maze.open, path: mazePath, food: maze.food,
    foodsEaten: maze.foodsEaten, level: maze.level, score: mazeScore,
    tickMs, direction, directionQueue
  };
  const { events, alive } = window.IdleSnakeMaze.stepMaze(sim, { rng: Math.random });

  mazePath = sim.path;
  maze.food = sim.food;
  maze.foodsEaten = sim.foodsEaten;
  maze.level = sim.level;
  mazeScore = sim.score;
  tickMs = sim.tickMs;
  direction = sim.direction;

  if (!alive) {
    endMaze(false);
    return true;
  }

  previousSnake = snapshot;
  snake = mazePath;
  for (const event of events) {
    if (event.type === "levelUp") {
      showOverlay(`Round ${event.level - 1} Clear · +${formatNumber(event.reward)} Seeds`);
      window.setTimeout(() => { if (state === "running") hideOverlay(); }, 700);
    }
  }
  return true;
}

function endMaze(won) {
  state = "gameover";
  mazeTravelDirection = null;
  mazeChoiceDirections = [];
  mazePendingChoices = null;
  mazePendingEnd = null;
  setScreenHint("");
  const reward = won ? Math.max(10, mazeScore) : Math.floor(mazeScore / 4);
  mazeBest = Math.max(mazeBest, mazeScore);
  setSaveItem("maze-best", String(mazeBest));
  if (reward) {
    seedsTotal += reward;
    saveSeeds();
  }
  syncHud();
  showOverlay(won ? `Snake Forever Clear · +${formatNumber(reward)} Seeds` : `Nibbled the wall · +${formatNumber(reward)} Seeds`);
}

function drawBroodlinePickup(drop, x, y, cell) {
  const pickupSize = cell * .62;
  if (drop.kind === "egg") {
    ctx.fillStyle = "#efe7b4";
    ctx.beginPath();
    ctx.ellipse(x, y, cell * .22, cell * .3, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (drop.kind === "body") {
    ctx.fillStyle = snakeColors.body;
    ctx.strokeStyle = "#132218";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - pickupSize / 2, y - pickupSize / 2, pickupSize, pickupSize, pickupSize * .2);
    ctx.fill();
    ctx.stroke();
    return;
  }

  const hatchlingColors = { garden: "#67c993", cave: "#8fa6d6", electric: "#d9d45a", lava: "#e37a47", rattle: "#b996cf" };
  const color = hatchlingColors[drop.kind] || "#e5a04c";
  const radius = pickupSize * .42;
  ctx.strokeStyle = "#132218";
  ctx.lineWidth = Math.max(2, cell * .08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, radius, Math.PI * .18, Math.PI * 2.05);
  ctx.arc(x, y, radius * .58, Math.PI * 2.05, Math.PI * .38, true);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, cell * .055);
  ctx.beginPath();
  ctx.arc(x, y, radius, Math.PI * .18, Math.PI * 2.05);
  ctx.arc(x, y, radius * .58, Math.PI * 2.05, Math.PI * .38, true);
  ctx.stroke();

  const headX = x + radius * .92;
  const headY = y + radius * .18;
  ctx.fillStyle = color;
  ctx.strokeStyle = "#132218";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(headX, headY, pickupSize * .16, pickupSize * .12, .25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1b2b20";
  ctx.beginPath();
  ctx.arc(headX + pickupSize * .04, headY - pickupSize * .025, Math.max(1, cell * .018), 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "butt";
}

function drawBroodline() {
  if (!broodline) return;
  const cell = canvas.width / broodlineView; const head = broodline.head;
  const camera = broodline.camera;
  // The snake still steps a whole cell at a time; only the camera eases, so the
  // world pans smoothly toward re-centering the head after each discrete step.
  const maxCam = broodlineGrid.columns - broodlineView;
  const targetX = Math.max(0, Math.min(maxCam, head.x - broodlineView / 2));
  const targetY = Math.max(0, Math.min(maxCam, head.y - broodlineView / 2));
  camera.x += (targetX - camera.x) * 0.2;
  camera.y += (targetY - camera.y) * 0.2;
  if (Math.abs(targetX - camera.x) < 0.002) camera.x = targetX;
  if (Math.abs(targetY - camera.y) < 0.002) camera.y = targetY;
  ctx.fillStyle = "#16231d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const baseX = Math.floor(camera.x), baseY = Math.floor(camera.y);
  for (let wy = baseY; wy <= baseY + broodlineView; wy += 1) for (let wx = baseX; wx <= baseX + broodlineView; wx += 1) { ctx.fillStyle = (wx + wy) % 2 ? "#243b2a" : "#29452f"; ctx.fillRect((wx - camera.x) * cell, (wy - camera.y) * cell, cell, cell); }
  ctx.strokeStyle = "#d5df9d"; ctx.lineWidth = 3; ctx.strokeRect((1 - camera.x) * cell, (1 - camera.y) * cell, 28 * cell, 28 * cell);
  broodline.pickups.forEach((drop) => { const x = (drop.pos.x - camera.x + .5) * cell, y = (drop.pos.y - camera.y + .5) * cell; drawBroodlinePickup(drop, x, y, cell); });
  broodline.enemies.forEach((enemy) => { const x = (enemy.pos.x - camera.x + .5) * cell, y = (enemy.pos.y - camera.y + .5) * cell; ctx.fillStyle = enemy.type === "ranged" ? "#d58964" : "#c4574e"; ctx.beginPath(); enemy.type === "ranged" ? ctx.arc(x, y, cell * .3, 0, Math.PI * 2) : ctx.rect(x - cell * .3, y - cell * .3, cell * .6, cell * .6); ctx.fill(); ctx.fillStyle = "#f4d39a"; ctx.fillRect(x - cell * .25, y - cell * .48, cell * .5 * Math.max(0, enemy.hp / enemy.maxHp), 2); });
  broodline.chain.slice().reverse().forEach((part) => { const x = (part.pos.x - camera.x) * cell + cell * .1, y = (part.pos.y - camera.y) * cell + cell * .1, size = cell * .8; const colors = { body: "#91b957", garden: "#67c993", cave: "#8fa6d6", electric: "#d9d45a", lava: "#e37a47", rattle: "#b996cf", egg: "#f2e9ba" }; ctx.fillStyle = colors[part.kind] || "#91b957"; ctx.strokeStyle = "#132218"; ctx.lineWidth = 2; if (part.kind === "egg") { ctx.beginPath(); ctx.ellipse(x + size / 2, y + size / 2, size * .32, size * .4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } else { ctx.beginPath(); ctx.roundRect(x, y, size, size, size * .18); ctx.fill(); ctx.stroke(); } });
  const headX = (head.x - camera.x) * cell + cell * .1, headY = (head.y - camera.y) * cell + cell * .1, headSize = cell * .8;
  ctx.fillStyle = broodline.headColor || snakeColors.head; ctx.strokeStyle = "#132218"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(headX, headY, headSize, headSize, headSize * .18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#1b2b20"; ctx.fillRect(headX + headSize * .26, headY + headSize * .3, 3, 3); ctx.fillRect(headX + headSize * .62, headY + headSize * .3, 3, 3);
  broodline.effects.forEach((effect) => { ctx.fillStyle = "#f6e8a4"; ctx.font = "bold 10px Courier New"; ctx.fillText(effect.text, (effect.pos.x - camera.x) * cell - 5, (effect.pos.y - camera.y) * cell - 4); });
  drawBroodlineHealthBar();
}

function drawBroodlineHealthBar() {
  if (!broodline) return;
  const pad = 6, barH = 12, w = canvas.width - pad * 2;
  const ratio = Math.max(0, Math.min(1, broodline.hp / broodline.maxHp));
  ctx.fillStyle = "rgba(10,16,12,0.82)"; ctx.fillRect(pad - 3, pad - 3, w + 6, barH + 6);
  ctx.fillStyle = "#1c2c22"; ctx.fillRect(pad, pad, w, barH);
  ctx.fillStyle = ratio > .5 ? "#7bc86c" : ratio > .25 ? "#e0c15a" : "#d0574e";
  ctx.fillRect(pad, pad, w * ratio, barH);
  ctx.strokeStyle = "#d5df9d"; ctx.lineWidth = 1; ctx.strokeRect(pad + .5, pad + .5, w - 1, barH - 1);
  ctx.fillStyle = "#f6e8a4"; ctx.font = "bold 9px Courier New"; ctx.textBaseline = "middle";
  ctx.fillText(`HP ${broodline.hp}/${broodline.maxHp}`, pad + 5, pad + barH / 2 + 1);
  if (broodline.armor > 0) {
    const armorText = `ARMOR ${broodline.armor}`;
    ctx.textAlign = "right"; ctx.fillText(armorText, pad + w - 5, pad + barH / 2 + 1); ctx.textAlign = "left";
  }
  ctx.textBaseline = "alphabetic";
}

function render() {
  boardMetrics = getBoardMetrics();
  drawScreen();
  if (gameMode === "crossing") drawCrossing();
  else if (gameMode === "battleship") drawBattleship();
  else if (gameMode === "runner") drawRunner();
  else {
    if (gameMode !== "broodline") drawGrid();
    if (gameMode === "breakout") drawBreakout();
    else if (gameMode === "centipede") drawCentipede();
    else if (gameMode === "duel") drawVsSnake();
    else if (gameMode === "maze") drawMaze();
    else if (gameMode === "snakebird") drawSnakebird();
    else if (gameMode === "sokoban") drawSokoban();
    else if (gameMode === "broodline") drawBroodline();
    else {
      drawFood();
      drawSnake();
    }
  }
  drawScanlines();
}

function drawRunner() {
  if (!runner) return;
  const originX = boardMetrics.x;
  const originY = boardMetrics.y;
  const groundY = originY + runner.groundY;
  ctx.fillStyle = "rgba(24, 36, 19, 0.16)";
  ctx.fillRect(originX, groundY, boardMetrics.width, 3);
  for (let x = originX + 8; x < originX + boardMetrics.width; x += 22) ctx.fillRect(x, groundY + 8, 10, 2);
  runner.obstacles.forEach((obstacle) => {
    const x = originX + obstacle.x;
    const y = groundY - obstacle.height;
    ctx.fillStyle = "rgba(24, 36, 19, 0.28)";
    ctx.fillRect(x + 3, groundY + 2, obstacle.width, 3);
    ctx.fillStyle = obstacle.kind === "cactus" ? "#38502a" : "#29391f";
    if (obstacle.kind === "cactus") {
      drawRoundedRect(x, y, obstacle.width, obstacle.height);
      ctx.fillRect(x - obstacle.width * 0.45, y + obstacle.height * 0.42, obstacle.width * 0.45, Math.max(3, obstacle.height * 0.13));
      ctx.fillRect(x + obstacle.width, y + obstacle.height * 0.28, obstacle.width * 0.45, Math.max(3, obstacle.height * 0.13));
    } else {
      ctx.beginPath();
      ctx.moveTo(x, groundY); ctx.lineTo(x + obstacle.width * 0.22, y + obstacle.height * 0.28); ctx.lineTo(x + obstacle.width * 0.68, y); ctx.lineTo(x + obstacle.width, groundY); ctx.closePath(); ctx.fill();
    }
  });
  const { player } = runner;
  for (let index = window.IdleSnakeRunner.config.segmentCount - 1; index >= 0; index -= 1) {
    const segmentSize = player.size * (index === 0 ? 1 : 0.88);
    const x = originX + player.x - index * segmentSize * 0.72;
    const y = groundY - segmentSize - window.IdleSnakeRunner.segmentYOffset(runner, index);
    ctx.fillStyle = "rgba(24, 36, 19, 0.28)";
    ctx.fillRect(x + 2, groundY + 2, segmentSize, 3);
    ctx.fillStyle = index === 0 ? snakeColors.head : snakeColors.body;
    drawRoundedRect(x, y, segmentSize, segmentSize);
    ctx.fillStyle = "rgba(231, 225, 197, 0.2)";
    ctx.fillRect(x + 3, y + 3, Math.max(2, segmentSize - 6), Math.max(2, segmentSize * 0.12));
    if (index === 0) drawEyes(x, y, segmentSize, "right");
  }
  ctx.strokeStyle = "rgba(24, 36, 19, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(originX - 1, originY - 1, boardMetrics.width + 2, boardMetrics.height + 2);
}

function drawCrossing() {
  for (let y = 0; y < crossingGrid.rows; y += 1) {
    const rowRect = cellRect({ x: 0, y }, 0);
    const isBank = y === 0 || y === crossingGrid.rows - 1;
    ctx.fillStyle = isBank ? "#708b59" : "#344336";
    ctx.fillRect(rowRect.x, rowRect.y, boardMetrics.width, rowRect.size);

    if (isBank) {
      ctx.fillStyle = "rgba(231, 225, 197, 0.16)";
      for (let x = 0; x < crossingGrid.columns; x += 2) {
        const bankCell = cellRect({ x, y }, Math.max(2, boardMetrics.cellSize * 0.18));
        ctx.fillRect(bankCell.x, bankCell.y, bankCell.size, bankCell.size);
      }
    } else {
      ctx.fillStyle = "rgba(231, 225, 197, 0.22)";
      const dashWidth = Math.max(4, Math.floor(boardMetrics.cellSize * 0.36));
      const dashY = rowRect.y + rowRect.size * 0.5 - 1;
      for (let x = 0; x < crossingGrid.columns; x += 2) {
        const dashX = boardMetrics.x + x * boardMetrics.cellSize + boardMetrics.cellSize * 0.18;
        ctx.fillRect(dashX, dashY, dashWidth, 2);
      }
    }
  }

  crossingCars.forEach((car) => drawCrossingCar(car));

  crossingSnake.forEach((part, index) => {
    // Body segments still below the bottom bank stay hidden until they climb in.
    if (part.y >= crossingGrid.rows || part.y < 0) return;
    const previousPart = previousCrossingSnake?.[index] || previousCrossingSnake?.[previousCrossingSnake.length - 1] || part;
    const point = interpolatedPoint(previousPart, part, index);
    const inset = Math.max(3, boardMetrics.cellSize * (index === 0 ? 0.105 : 0.135));
    const rect = interpolatedCellRect(point, inset);
    if (index === 0) {
      const shadowOffset = Math.max(2, boardMetrics.cellSize * 0.08);
      ctx.fillStyle = "rgba(24, 36, 19, 0.34)";
      ctx.fillRect(rect.x + shadowOffset, rect.y + shadowOffset, rect.size, rect.size);
    }
    ctx.fillStyle = index === 0 ? snakeColors.head : snakeColors.body;
    drawRoundedRect(rect.x, rect.y, rect.size, rect.size);
    ctx.fillStyle = "rgba(156, 172, 119, 0.22)";
    ctx.fillRect(rect.x + 3, rect.y + 3, Math.max(1, rect.size - 6), Math.max(2, rect.size * 0.12));
  });

  const head = crossingSnake[0];
  const headPoint = interpolatedPoint(previousCrossingSnake?.[0] || head, head);
  const headRect = interpolatedCellRect(headPoint, Math.max(3, Math.floor(boardMetrics.cellSize * 0.11)));
  drawEyes(headRect.x, headRect.y, headRect.size);

  ctx.strokeStyle = "rgba(24, 36, 19, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(boardMetrics.x - 1, boardMetrics.y - 1, boardMetrics.width + 2, boardMetrics.height + 2);
}

function drawCrossingCar(car) {
  [-crossingGrid.columns, 0, crossingGrid.columns].forEach((offset) => {
    const left = car.x + offset;
    if (left + car.width <= 0 || left >= crossingGrid.columns) return;
    const inset = Math.max(2, boardMetrics.cellSize * 0.12);
    const rect = cellRect({ x: left, y: car.row }, inset);
    const width = car.width * boardMetrics.cellSize - inset * 2;
    ctx.fillStyle = "rgba(24, 36, 19, 0.3)";
    ctx.fillRect(rect.x + 2, rect.y + 3, width, Math.max(2, rect.size * 0.18));
    ctx.fillStyle = car.color;
    drawRoundedRect(rect.x, rect.y, width, rect.size);
    ctx.fillStyle = "rgba(231, 225, 197, 0.28)";
    ctx.fillRect(rect.x + 3, rect.y + 3, Math.max(2, width * 0.55), Math.max(2, rect.size * 0.12));
  });
}

function drawBreakout() {
  if (!breakout) return;
  const { paddle } = breakout;

  breakout.bricks.forEach((brick) => {
    ctx.fillStyle = "rgba(24, 36, 19, 0.3)";
    ctx.fillRect(boardMetrics.x + brick.x + 2, boardMetrics.y + brick.y + 2, brick.width, brick.height);
    ctx.fillStyle = brick.color;
    ctx.fillRect(boardMetrics.x + brick.x, boardMetrics.y + brick.y, brick.width, brick.height);
    ctx.fillStyle = "rgba(231, 225, 197, 0.24)";
    ctx.fillRect(boardMetrics.x + brick.x + 2, boardMetrics.y + brick.y + 2, Math.max(2, brick.width - 4), 2);
  });

  breakout.powerups.forEach((powerup) => {
    const x = boardMetrics.x + powerup.x;
    const y = boardMetrics.y + powerup.y;
    const radius = powerup.radius;
    ctx.fillStyle = "rgba(24, 36, 19, 0.3)";
    ctx.fillRect(x - radius + 2, y + radius + 2, radius * 2 - 2, 2);
    if (powerup.type === "seed") {
      ctx.fillStyle = "#182413";
      ctx.beginPath();
      ctx.ellipse(x, y + 1, radius * 0.7, radius, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9cac77";
      ctx.fillRect(x + 1, y - radius - 2, Math.max(2, radius * 0.24), radius * 0.7);
      ctx.fillRect(x + 3, y - radius - 2, Math.max(2, radius * 0.55), 2);
    } else if (powerup.type === "heart") {
      ctx.fillStyle = "#b3483d";
      ctx.font = `700 ${Math.max(16, Math.floor(radius * 2.1))}px Courier New, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("♥", x, y + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    } else {
      ctx.fillStyle = "#e4c65e";
      ctx.beginPath();
      ctx.arc(x - radius * 0.35, y, radius * 0.48, 0, Math.PI * 2);
      ctx.arc(x + radius * 0.35, y, radius * 0.48, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  breakout.balls.forEach((ball) => {
    const ballX = boardMetrics.x + ball.x;
    const ballY = boardMetrics.y + ball.y;
    ctx.fillStyle = "rgba(24, 36, 19, 0.3)";
    ctx.fillRect(ballX - ball.radius + 2, ballY + ball.radius + 2, ball.radius * 2 - 2, 2);
    ctx.fillStyle = "#e7e1c5";
    ctx.fillRect(ballX - ball.radius, ballY - ball.radius, ball.radius * 2, ball.radius * 2);
  });

  for (let index = 0; index < paddle.length; index += 1) {
    const x = boardMetrics.x + paddle.x + index * (breakout.segmentSize + breakout.gap);
    const y = boardMetrics.y + paddle.y;
    const isHead = index === paddle.length - 1;
    ctx.fillStyle = "rgba(24, 36, 19, 0.3)";
    ctx.fillRect(x + 2, y + 2, breakout.segmentSize, breakout.segmentSize);
    ctx.fillStyle = isHead ? snakeColors.head : snakeColors.body;
    drawRoundedRect(x, y, breakout.segmentSize, breakout.segmentSize);
    ctx.fillStyle = "rgba(156, 172, 119, 0.22)";
    ctx.fillRect(x + 3, y + 3, Math.max(1, breakout.segmentSize - 6), Math.max(2, breakout.segmentSize * 0.12));
    if (isHead) {
      const eyeSize = Math.max(2, Math.floor(breakout.segmentSize * 0.12));
      ctx.fillStyle = contrastingEyeColor(snakeColors.head);
      ctx.fillRect(x + breakout.segmentSize * 0.64, y + breakout.segmentSize * 0.28, eyeSize, eyeSize);
      ctx.fillRect(x + breakout.segmentSize * 0.64, y + breakout.segmentSize * 0.62, eyeSize, eyeSize);
    }
  }

}

function drawCentipede() {
  if (!centipede) return;
  const cs = boardMetrics.cellSize;

  // Mushroom field — the cap fades as it takes damage (4 hp = solid).
  for (const cell in centipede.mushrooms) {
    const hp = centipede.mushrooms[cell];
    const parts = cell.split(",");
    const rect = cellRect({ x: Number(parts[0]), y: Number(parts[1]) }, Math.max(2, cs * 0.16));
    ctx.fillStyle = "rgba(24, 36, 19, 0.26)";
    ctx.fillRect(rect.x + 2, rect.y + rect.size * 0.55, rect.size, rect.size * 0.4);
    ctx.fillStyle = `rgba(88, 110, 58, ${Math.min(1, 0.32 + 0.17 * hp)})`;
    ctx.beginPath();
    ctx.arc(rect.x + rect.size / 2, rect.y + rect.size * 0.46, rect.size * 0.5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(231, 225, 197, 0.45)";
    ctx.fillRect(rect.x + rect.size * 0.22, rect.y + rect.size * 0.24, Math.max(1, rect.size * 0.16), Math.max(1, rect.size * 0.16));
  }

  // Villain centipede — segments are tinted with the player's chosen snake
  // colours (body colour for the chain, head colour for each head).
  centipede.segments.forEach((seg) => {
    const rect = cellRect({ x: seg.x, y: seg.y }, Math.max(1, cs * 0.08));
    ctx.fillStyle = "rgba(24, 36, 19, 0.3)";
    ctx.fillRect(rect.x + 2, rect.y + 2, rect.size, rect.size);
    ctx.fillStyle = seg.isHead ? snakeColors.head : snakeColors.body;
    ctx.beginPath();
    ctx.arc(rect.x + rect.size / 2, rect.y + rect.size / 2, rect.size / 2, 0, Math.PI * 2);
    ctx.fill();
    if (seg.isHead) {
      const eye = Math.max(2, Math.floor(rect.size * 0.16));
      ctx.fillStyle = contrastingEyeColor(snakeColors.head);
      ctx.fillRect(rect.x + rect.size * 0.28, rect.y + rect.size * 0.3, eye, eye);
      ctx.fillRect(rect.x + rect.size * 0.58, rect.y + rect.size * 0.3, eye, eye);
    }
  });

  // Bullet.
  if (centipede.bullet) {
    const rect = cellRect(centipede.bullet, Math.max(2, cs * 0.38));
    ctx.fillStyle = "#e7e1c5";
    ctx.fillRect(rect.x, rect.y, rect.size, cs * 0.6);
  }

  // Player shooter — cream, so the hero reads clearly against the tinted villain.
  const p = cellRect(centipede.player, Math.max(1, cs * 0.12));
  ctx.fillStyle = "rgba(24, 36, 19, 0.32)";
  ctx.fillRect(p.x + 2, p.y + 3, p.size, p.size);
  ctx.fillStyle = "#182413";
  ctx.fillRect(p.x + p.size * 0.42, p.y - cs * 0.12, Math.max(2, p.size * 0.16), cs * 0.22);
  ctx.fillStyle = "#e7e1c5";
  ctx.beginPath();
  ctx.moveTo(p.x + p.size / 2, p.y);
  ctx.lineTo(p.x + p.size, p.y + p.size);
  ctx.lineTo(p.x, p.y + p.size);
  ctx.closePath();
  ctx.fill();

  // Faint divider marking the top of the shooter's band.
  const bandY = boardMetrics.y + (centipede.rows - centipede.playerRows) * cs;
  ctx.fillStyle = "rgba(24, 36, 19, 0.18)";
  ctx.fillRect(boardMetrics.x, bandY, boardMetrics.width, 2);
}

function drawVsSnake() {
  duelFoods.forEach((food) => {
    const rect = cellRect(food, Math.max(2, Math.floor(boardMetrics.cellSize * 0.2)));
    ctx.fillStyle = "#e4c65e";
    ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
  });
  [duelPlayer, duelOpponent].forEach((snakeRef) => {
    const previousBody = snakeRef === duelPlayer ? previousDuelPlayerBody : previousDuelOpponentBody;
    snakeRef.body.forEach((part, index) => {
      const previousPart = previousBody?.[index] || previousBody?.[previousBody.length - 1] || part;
      const point = interpolatedPoint(previousPart, part, index);
      const rect = interpolatedCellRect(point, Math.max(1, boardMetrics.cellSize * 0.12));
      ctx.fillStyle = index === 0
        ? snakeRef === duelOpponent ? snakeRef.color : snakeColors.head
        : snakeRef === duelOpponent ? "#d5d5c8" : snakeColors.body;
      drawRoundedRect(rect.x, rect.y, rect.size, rect.size);
      if (index === 0 && rect.size >= 5) {
        ctx.fillStyle = snakeRef === duelOpponent ? "#29391f" : contrastingEyeColor(snakeColors.head);
        ctx.fillRect(rect.x + 2, rect.y + 2, 2, 2);
        ctx.fillRect(rect.x + rect.size - 4, rect.y + 2, 2, 2);
      }
    });
  });
}

function drawMaze() {
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      const point = { x, y };
      const rect = cellRect(point, Math.max(1, Math.floor(boardMetrics.cellSize * 0.04)));
      if (isMazeOpen(point)) {
        ctx.fillStyle = "rgba(231, 225, 197, 0.18)";
      } else {
        ctx.fillStyle = "rgba(24, 36, 19, 0.74)";
      }
      ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
    }
  }

  if (maze?.food) {
    const foodRect = cellRect(maze.food, Math.max(4, Math.floor(boardMetrics.cellSize * 0.18)));
    ctx.fillStyle = "#e4c65e";
    ctx.beginPath();
    ctx.arc(foodRect.x + foodRect.size / 2, foodRect.y + foodRect.size / 2, foodRect.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  mazePath.forEach((part, index) => {
    const isHead = index === 0;
    const inset = Math.max(3, Math.floor(boardMetrics.cellSize * (isHead ? 0.16 : 0.25)));
    const previousPart = previousSnake?.[index] || previousSnake?.[previousSnake.length - 1] || part;
    const point = interpolatedPoint(previousPart, part, index);
    const rect = interpolatedCellRect(point, inset);
    ctx.fillStyle = isHead ? snakeColors.head : snakeColors.body;
    drawRoundedRect(rect.x, rect.y, rect.size, rect.size);
  });

  const headPoint = interpolatedPoint(previousSnake?.[0] || mazePath[0], mazePath[0]);
  const headRect = interpolatedCellRect(headPoint, Math.max(3, Math.floor(boardMetrics.cellSize * 0.16)));
  drawEyes(headRect.x, headRect.y, headRect.size);
}

function drawSnakebird() {
  if (!snakebird) return;

  for (let y = 0; y < snakebird.height; y += 1) {
    for (let x = 0; x < snakebird.width; x += 1) {
      const point = { x, y };
      const rect = cellRect(point, 1);
      if (snakebird.solids.has(snakebirdKey(point))) {
        ctx.fillStyle = "#29391f";
        ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
        ctx.fillStyle = "rgba(231, 225, 197, 0.12)";
        ctx.fillRect(rect.x + rect.size * 0.18, rect.y + rect.size * 0.18, rect.size * 0.64, 2);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(231, 225, 197, 0.18)" : "rgba(24, 36, 19, 0.06)";
        ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
      }
    }
  }

  if (snakebird.exit) {
    const exitRect = cellRect(snakebird.exit, Math.max(3, Math.floor(boardMetrics.cellSize * 0.16)));
    ctx.fillStyle = snakebird.fruits.size === 0 ? "#e4c65e" : "#718253";
    ctx.fillRect(exitRect.x, exitRect.y, exitRect.size, exitRect.size);
    ctx.strokeStyle = "#182413";
    ctx.lineWidth = Math.max(2, boardMetrics.cellSize * 0.06);
    ctx.strokeRect(exitRect.x + 2, exitRect.y + 2, exitRect.size - 4, exitRect.size - 4);
  }

  snakebird.fruits.forEach((fruitKey) => {
    const [x, y] = fruitKey.split(",").map(Number);
    const rect = cellRect({ x, y }, Math.max(3, Math.floor(boardMetrics.cellSize * 0.2)));
    const centerX = rect.x + rect.size / 2;
    const centerY = rect.y + rect.size / 2;
    ctx.fillStyle = "#182413";
    ctx.beginPath();
    ctx.arc(centerX, centerY + 1, rect.size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e4c65e";
    ctx.fillRect(centerX - 1, rect.y - 2, 2, Math.max(3, rect.size * 0.24));
  });

  snakebird.body.forEach((part, index) => {
    const rect = cellRect(part, Math.max(2, Math.floor(boardMetrics.cellSize * (index === 0 ? 0.1 : 0.14))));
    ctx.fillStyle = index === 0 ? snakeColors.head : snakeColors.body;
    drawRoundedRect(rect.x, rect.y, rect.size, rect.size);
    ctx.fillStyle = "rgba(156, 172, 119, 0.22)";
    ctx.fillRect(rect.x + 3, rect.y + 3, Math.max(1, rect.size - 6), Math.max(2, rect.size * 0.12));
  });

  const head = snakebird.body[0];
  if (head) {
    const headRect = cellRect(head, Math.max(3, Math.floor(boardMetrics.cellSize * 0.1)));
    drawEyes(headRect.x, headRect.y, headRect.size);
  }
}

function drawSokoban() {
  if (!sokoban) return;

  for (let y = 0; y < sokoban.height; y += 1) {
    for (let x = 0; x < sokoban.width; x += 1) {
      const point = { x, y };
      const rect = cellRect(point, 1);
      const gate = sokobanGateAt(point);
      const gateOpen = gate && sokobanPlateActive(gate.id);
      if (sokobanIsWall(point) && !gate) {
        ctx.fillStyle = "#29391f";
        ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
        ctx.fillStyle = "rgba(231, 225, 197, 0.13)";
        ctx.fillRect(rect.x + rect.size * 0.16, rect.y + rect.size * 0.16, rect.size * 0.68, Math.max(2, rect.size * 0.08));
      } else if (gate && !gateOpen) {
        ctx.fillStyle = "#182413";
        ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
        ctx.strokeStyle = "#e4c65e";
        ctx.lineWidth = Math.max(2, rect.size * 0.06);
        ctx.strokeRect(rect.x + 3, rect.y + 3, rect.size - 6, rect.size - 6);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(231, 225, 197, 0.2)" : "rgba(24, 36, 19, 0.06)";
        ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
      }
    }
  }

  sokoban.goals.forEach((goal) => {
    const rect = cellRect(goal, Math.max(4, Math.floor(boardMetrics.cellSize * 0.2)));
    ctx.strokeStyle = "#e4c65e";
    ctx.lineWidth = Math.max(2, boardMetrics.cellSize * 0.06);
    ctx.strokeRect(rect.x, rect.y, rect.size, rect.size);
  });

  sokoban.plates.forEach((plate) => {
    const rect = cellRect(plate, Math.max(4, Math.floor(boardMetrics.cellSize * 0.2)));
    const active = sokobanPlateActive(plate.id);
    ctx.fillStyle = active ? "#e4c65e" : "#718253";
    ctx.beginPath();
    ctx.arc(rect.x + rect.size / 2, rect.y + rect.size / 2, rect.size * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#182413";
    ctx.lineWidth = Math.max(2, boardMetrics.cellSize * 0.04);
    ctx.stroke();
  });

  sokoban.pellets.forEach((pellet) => {
    const rect = cellRect(pellet, Math.max(5, Math.floor(boardMetrics.cellSize * 0.28)));
    ctx.fillStyle = "#182413";
    ctx.beginPath();
    ctx.arc(rect.x + rect.size / 2, rect.y + rect.size / 2 + 1, rect.size * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e4c65e";
    ctx.fillRect(rect.x + rect.size * 0.48, rect.y - 2, Math.max(2, rect.size * 0.12), Math.max(3, rect.size * 0.3));
  });

  sokoban.crates.forEach((crate) => {
    const rect = cellRect(crate, Math.max(3, Math.floor(boardMetrics.cellSize * 0.13)));
    ctx.fillStyle = "rgba(24, 36, 19, 0.32)";
    ctx.fillRect(rect.x + 2, rect.y + 3, rect.size, rect.size);
    ctx.fillStyle = crate.kind === "heavy" ? "#4b3d2a" : "#a55b25";
    drawRoundedRect(rect.x, rect.y, rect.size, rect.size);
    ctx.strokeStyle = crate.kind === "heavy" ? "#e4c65e" : "#e7e1c5";
    ctx.lineWidth = Math.max(2, boardMetrics.cellSize * 0.05);
    ctx.strokeRect(rect.x + 4, rect.y + 4, rect.size - 8, rect.size - 8);
    if (crate.kind === "heavy" && rect.size >= 14) {
      ctx.fillStyle = "#e4c65e";
      ctx.font = `700 ${Math.max(10, Math.floor(rect.size * 0.34))}px Courier New, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", rect.x + rect.size / 2, rect.y + rect.size / 2 + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  });

  sokoban.snake.forEach((part, index) => {
    const rect = cellRect(part, Math.max(3, Math.floor(boardMetrics.cellSize * (index === 0 ? 0.1 : 0.14))));
    const isTail = index === sokoban.snake.length - 1;
    const onPlate = sokoban.plates.some((plate) => plate.x === part.x && plate.y === part.y);
    if (index === 0) {
      ctx.fillStyle = "rgba(24, 36, 19, 0.34)";
      ctx.fillRect(rect.x + 2, rect.y + 3, rect.size, rect.size);
    }
    ctx.fillStyle = index === 0 ? snakeColors.head : snakeColors.body;
    drawRoundedRect(rect.x, rect.y, rect.size, rect.size);
    ctx.fillStyle = "rgba(156, 172, 119, 0.22)";
    ctx.fillRect(rect.x + 3, rect.y + 3, Math.max(1, rect.size - 6), Math.max(2, rect.size * 0.12));
    if (onPlate || isTail) {
      ctx.strokeStyle = onPlate ? "#e4c65e" : "rgba(231, 225, 197, 0.45)";
      ctx.lineWidth = Math.max(2, boardMetrics.cellSize * 0.04);
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.size - 4, rect.size - 4);
    }
  });

  const head = sokoban.snake[0];
  if (head) {
    const headRect = cellRect(head, Math.max(3, Math.floor(boardMetrics.cellSize * 0.1)));
    drawEyes(headRect.x, headRect.y, headRect.size);
  }
}

// Two stacked 10x10 grids: enemy waters on top (where the player fires venom),
// their own nest below (where the AI fires). Layout is computed independently of
// getBoardMetrics/grid so both grids fit the square LCD screen.
function battleshipLayout() {
  const cols = battleshipGrid.columns;
  const rows = battleshipGrid.rows;
  const labelH = 16;
  const gap = 18;
  const usableH = canvas.height - labelH * 2 - gap - 14;
  const size = Math.max(8, Math.floor(Math.min((canvas.width - 24) / cols, usableH / (rows * 2))));
  const boardW = size * cols;
  const boardH = size * rows;
  const offsetX = Math.floor((canvas.width - boardW) / 2);
  const enemyY = labelH + 6;
  const playerY = enemyY + boardH + labelH + gap;
  return { cols, rows, size, boardW, boardH, offsetX, enemyY, playerY, labelH };
}

// Map a canvas click to { board: "enemy"|"player", x, y } or null, accounting
// for CSS scaling of the canvas.
function battleshipCellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * (canvas.width / rect.width);
  const py = (event.clientY - rect.top) * (canvas.height / rect.height);
  const L = battleshipLayout();
  const hit = (top) => {
    if (px < L.offsetX || px >= L.offsetX + L.boardW) return null;
    if (py < top || py >= top + L.boardH) return null;
    return { x: Math.floor((px - L.offsetX) / L.size), y: Math.floor((py - top) / L.size) };
  };
  const enemy = hit(L.enemyY);
  if (enemy) return { board: "enemy", ...enemy };
  const player = hit(L.playerY);
  if (player) return { board: "player", ...player };
  return null;
}

function battleshipGhost() {
  const def = battleshipCurrentDef();
  if (!def) return null;
  const B = window.IdleSnakeBattleship;
  const cells = B.shipCells(battleship.placement.x, battleship.placement.y, def.length, battleship.placement.orientation);
  return { cells, valid: B.canPlaceCells(battleship.player, cells, battleshipGrid.columns) };
}

function drawBattleship() {
  if (!battleship) return;
  const L = battleshipLayout();
  ctx.save();
  drawBattleshipLabel(battleship.phase === "over" ? "ENEMY WATERS · REVEALED" : "ENEMY WATERS · STRIKE", L.offsetX, L.enemyY - 5, L);
  drawBattleshipBoard({
    L,
    top: L.enemyY,
    fleet: battleship.enemy,
    revealSunk: true,
    revealAll: battleship.phase === "over",
    cursor: battleship.phase === "playing" && battleship.turn === "player" ? battleship.target : null,
    lastShot: battleship.lastPlayerShot
  });
  drawBattleshipLabel("YOUR NEST", L.offsetX, L.playerY - 5, L);
  drawBattleshipBoard({
    L,
    top: L.playerY,
    fleet: battleship.player,
    revealAll: true,
    ghost: battleship.phase === "placement" ? battleshipGhost() : null,
    lastShot: battleship.lastAiShot
  });
  ctx.restore();
}

function drawBattleshipLabel(text, x, y, L) {
  ctx.fillStyle = "#182413";
  ctx.font = `bold ${Math.max(9, Math.floor(L.labelH * 0.72))}px "Courier New", monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

function drawBattleshipBoard({ L, top, fleet, revealAll, revealSunk, cursor, ghost, lastShot }) {
  const { offsetX, size, cols, rows } = L;
  const B = window.IdleSnakeBattleship;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(24,36,19,0.16)" : "rgba(24,36,19,0.07)";
      ctx.fillRect(offsetX + x * size, top + y * size, size, size);
    }
  }
  fleet.ships.forEach((ship) => {
    const sunk = B.isSunk(ship, fleet.shots);
    if (!revealAll && !(revealSunk && sunk)) return;
    drawBattleshipShip(ship, offsetX, top, size, sunk);
  });
  if (ghost) {
    const inset = Math.max(2, size * 0.16);
    ghost.cells.forEach((c) => {
      ctx.fillStyle = ghost.valid ? "rgba(45,139,104,0.6)" : "rgba(179,72,61,0.55)";
      drawRoundedRect(offsetX + c.x * size + inset, top + c.y * size + inset, size - inset * 2, size - inset * 2);
    });
  }
  Object.keys(fleet.shots).forEach((k) => {
    const [sx, sy] = k.split(",").map(Number);
    const cx = offsetX + sx * size;
    const cy = top + sy * size;
    if (fleet.shots[k] === "hit") drawVenomHit(cx, cy, size);
    else drawVenomMiss(cx, cy, size);
  });
  if (lastShot) {
    ctx.strokeStyle = "rgba(231,225,197,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX + lastShot.x * size + 1.5, top + lastShot.y * size + 1.5, size - 3, size - 3);
  }
  if (cursor) drawBattleshipReticle(offsetX + cursor.x * size, top + cursor.y * size, size);
  ctx.strokeStyle = "rgba(24,36,19,0.32)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= cols; i += 1) {
    ctx.beginPath();
    ctx.moveTo(offsetX + i * size + 0.5, top + 0.5);
    ctx.lineTo(offsetX + i * size + 0.5, top + rows * size + 0.5);
    ctx.stroke();
  }
  for (let i = 0; i <= rows; i += 1) {
    ctx.beginPath();
    ctx.moveTo(offsetX + 0.5, top + i * size + 0.5);
    ctx.lineTo(offsetX + cols * size + 0.5, top + i * size + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(24,36,19,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, top, cols * size, rows * size);
}

function drawBattleshipShip(ship, offsetX, top, size, sunk) {
  const inset = Math.max(2, size * 0.17);
  ship.cells.forEach((c) => {
    ctx.fillStyle = sunk ? "rgba(24,36,19,0.72)" : snakeColors.body;
    drawRoundedRect(offsetX + c.x * size + inset, top + c.y * size + inset, size - inset * 2, size - inset * 2);
  });
  const head = ship.cells[0];
  ctx.fillStyle = sunk ? "#182413" : snakeColors.head;
  drawRoundedRect(offsetX + head.x * size + inset, top + head.y * size + inset, size - inset * 2, size - inset * 2);
}

function drawVenomHit(cx, cy, size) {
  const mx = cx + size / 2;
  const my = cy + size / 2;
  const r = size * 0.26;
  ctx.fillStyle = "#182413";
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(231,225,197,0.72)";
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  ctx.beginPath();
  ctx.moveTo(mx - r * 0.6, my - r * 0.6);
  ctx.lineTo(mx + r * 0.6, my + r * 0.6);
  ctx.moveTo(mx + r * 0.6, my - r * 0.6);
  ctx.lineTo(mx - r * 0.6, my + r * 0.6);
  ctx.stroke();
}

function drawVenomMiss(cx, cy, size) {
  ctx.fillStyle = "rgba(24,36,19,0.4)";
  ctx.beginPath();
  ctx.arc(cx + size / 2, cy + size / 2, Math.max(1.5, size * 0.12), 0, Math.PI * 2);
  ctx.fill();
}

function drawBattleshipReticle(cx, cy, size) {
  const bright = Math.floor(Date.now() / 400) % 2 === 0;
  ctx.strokeStyle = bright ? "#182413" : "rgba(24,36,19,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx + 2, cy + 2, size - 4, size - 4);
  ctx.beginPath();
  ctx.moveTo(cx + size / 2, cy + 4);
  ctx.lineTo(cx + size / 2, cy + size - 4);
  ctx.moveTo(cx + 4, cy + size / 2);
  ctx.lineTo(cx + size - 4, cy + size / 2);
  ctx.stroke();
}

function getBoardMetrics() {
  const margin = 12;
  const cellSize = Math.floor(Math.min(
    (canvas.width - margin * 2) / grid.columns,
    (canvas.height - margin * 2) / grid.rows
  ));
  const width = cellSize * grid.columns;
  const height = cellSize * grid.rows;
  return {
    cellSize,
    width,
    height,
    x: Math.floor((canvas.width - width) / 2),
    y: Math.floor((canvas.height - height) / 2)
  };
}

function cellRect(point, inset = 0) {
  return {
    x: boardMetrics.x + point.x * boardMetrics.cellSize + inset,
    y: boardMetrics.y + point.y * boardMetrics.cellSize + inset,
    size: boardMetrics.cellSize - inset * 2
  };
}

// A snake step advanced the body iff the head occupies a new cell, or the body
// grew this frame (eating adds a segment). Used to decide when to re-anchor the
// interpolation's "from" body so the slide plays out across the whole tick.
function snakeStepped(before, after) {
  if (!before?.length || !after?.length) return false;
  return before.length !== after.length
    || before[0].x !== after[0].x
    || before[0].y !== after[0].y;
}

// How far ahead of the logic clock the visual slide runs. The snake visibly
// commits to a move a hair before the next step is computed, which reads as
// snappier/more responsive input.
const MOVE_VISUAL_LEAD_MS = 20;

function interpolatedPoint(previous, current, index = 0) {
  // Quick, step-wise hop: reach the next tile in ~40% of the tick, then hold.
  // A shorter transition (vs sliding most of the tick) makes movement read as
  // crisp tile-to-tile steps rather than a long glide.
  const transitionMs = Math.min(80, tickMs * 0.4);
  const rawProgress = Math.min(1, Math.max(0, (stepAccumulatorMs + MOVE_VISUAL_LEAD_MS) / transitionMs));
  // Ease out so a newly accepted turn starts moving immediately.
  const progress = 1 - Math.pow(1 - rawProgress, 3);
  const segmentProgress = Math.max(0, progress - Math.min(0.06, index * 0.012));
  return {
    x: previous.x + (current.x - previous.x) * segmentProgress,
    y: previous.y + (current.y - previous.y) * segmentProgress
  };
}

function interpolatedCellRect(point, inset = 0) {
  return {
    x: boardMetrics.x + point.x * boardMetrics.cellSize + inset,
    y: boardMetrics.y + point.y * boardMetrics.cellSize + inset,
    size: boardMetrics.cellSize - inset * 2
  };
}

function drawRoundedRect(x, y, width, height) {
  const radius = Math.min(2.5, width * 0.10, height * 0.10);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawScreen() {
  ctx.fillStyle = "#9cac77";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(24, 36, 19, 0.06)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
  ctx.fillStyle = "rgba(24, 36, 19, 0.15)";
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      if ((x + y) % 2 === 0) {
        const rect = cellRect({ x, y });
        ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
      }
    }
  }

  ctx.strokeStyle = "rgba(24, 36, 19, 0.26)";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    boardMetrics.x - 1,
    boardMetrics.y - 1,
    boardMetrics.width + 2,
    boardMetrics.height + 2
  );
}

function drawSnake() {
  pruneDigestionAnimations();
  const now = performance.now();
  const cell = boardMetrics.cellSize;

  // Interpolated cell-space point for every segment (head included), reused by
  // both the connecting spine and the distinct blocks below.
  const points = snake.map((part, index) => {
    const previousPart = previousSnake?.[index] || previousSnake?.[previousSnake.length - 1] || part;
    return interpolatedPoint(previousPart, part, index);
  });

  // Connecting spine: a rounded path through segment centers, drawn UNDER the
  // blocks and narrower than them. The blocks cover most of it, leaving only a
  // slim neck visible in each gap — so the body reads as distinct blocks that
  // are unmistakably one snake. Round joins keep turns connected too.
  if (points.length > 1) {
    ctx.strokeStyle = lightenColor(snakeColors.body, 0.25);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, cell * 0.46);
    ctx.beginPath();
    points.forEach((point, index) => {
      const cx = boardMetrics.x + (point.x + 0.5) * cell;
      const cy = boardMetrics.y + (point.y + 0.5) * cell;
      if (index === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();
  }

  snake.forEach((part, index) => {
    const point = points[index];
    const baseInset = Math.max(3, boardMetrics.cellSize * (index === 0 ? 0.105 : 0.135));
    const digestionPulse = index === 0 ? 0 : digestionPulseForSegment(index, now);
    const inset = Math.max(1, baseInset - boardMetrics.cellSize * 0.1 * digestionPulse);
    const rect = interpolatedCellRect(point, inset);
    if (index === 0) {
      const shadowOffset = Math.max(2, boardMetrics.cellSize * 0.08);
      ctx.fillStyle = "rgba(24, 36, 19, 0.34)";
      ctx.fillRect(rect.x + shadowOffset, rect.y + shadowOffset, rect.size, rect.size);
    }
    const isTail = index !== 0 && index === snake.length - 1;
    ctx.fillStyle = index === 0 ? snakeColors.head : snakeColors.body;
    if (isTail) {
      // Trails behind the segment ahead of it: a smaller wedge pointing away
      // from the body so the run terminates in a distinct tail piece.
      drawTail(rect, points[index], points[index - 1]);
    } else {
      drawRoundedRect(rect.x, rect.y, rect.size, rect.size);
      ctx.fillStyle = "rgba(156, 172, 119, 0.22)";
      ctx.fillRect(rect.x + 3, rect.y + 3, Math.max(1, rect.size - 6), Math.max(2, rect.size * 0.12));
    }
  });
  const headInset = Math.max(3, Math.floor(boardMetrics.cellSize * 0.11));
  const headPoint = interpolatedPoint(previousSnake?.[0] || snake[0], snake[0]);
  const headRect = interpolatedCellRect(headPoint, headInset);
  // Aim the eyes at the direction the next step will actually move, so a fresh
  // turn shows on the head the instant it's pressed instead of a tick later.
  drawEyes(headRect.x, headRect.y, headRect.size, pendingHeadDirection());
}

// The heading the next standard-snake step will use: the imminent queued turn if
// one is buffered, otherwise the current committed direction.
function pendingHeadDirection() {
  return directionQueue.length > 0 ? directionQueue[0] : direction;
}

// Draw the final segment as a tapered tail: a wedge whose base sits toward the
// body and whose point trails outward, following the direction from the segment
// ahead. `cur`/`prev` are interpolated cell-space points. Slightly smaller than
// a body block so it reads as a distinct tail tip.
function drawTail(rect, cur, prev) {
  const cx = rect.x + rect.size / 2;
  const cy = rect.y + rect.size / 2;
  let dx = cur.x - prev.x;
  let dy = cur.y - prev.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) { dx = 0; dy = 1; } else { dx /= len; dy /= len; }
  const perpX = -dy;
  const perpY = dx;
  const back = rect.size * 0.5;   // base sits at the body-facing edge
  const tip = rect.size * 0.6;    // point trails just past the outer edge
  const half = rect.size * 0.4;   // base half-width (< block, so it tapers)
  const baseX = cx - dx * back;
  const baseY = cy - dy * back;
  ctx.beginPath();
  ctx.moveTo(baseX + perpX * half, baseY + perpY * half);
  ctx.lineTo(baseX - perpX * half, baseY - perpY * half);
  ctx.lineTo(cx + dx * tip, cy + dy * tip);
  ctx.closePath();
  ctx.fill();
}

function drawEyes(x, y, size, facing = direction) {
  if (size < 12) return;

  const vector = vectors[facing] || vectors[direction];
  const eyeSize = Math.max(2, Math.floor(size * 0.12));
  const forwardX = vector.x * size * 0.16;
  const forwardY = vector.y * size * 0.16;
  const sideX = vector.y * size * 0.22;
  const sideY = -vector.x * size * 0.22;
  const centerX = x + size / 2 + forwardX;
  const centerY = y + size / 2 + forwardY;

  ctx.fillStyle = contrastingEyeColor(snakeColors.head);
  ctx.fillRect(centerX + sideX - eyeSize / 2, centerY + sideY - eyeSize / 2, eyeSize, eyeSize);
  ctx.fillRect(centerX - sideX - eyeSize / 2, centerY - sideY - eyeSize / 2, eyeSize, eyeSize);
}

// Lighten a hex color by blending it toward white by `amount` (0..1).
function lightenColor(color, amount) {
  const hex = String(color).replace("#", "");
  if (hex.length < 6) return color;
  const channel = (start) => {
    const value = parseInt(hex.slice(start, start + 2), 16);
    const lifted = Math.round(value + (255 - value) * amount);
    return Math.max(0, Math.min(255, lifted)).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

function contrastingEyeColor(color) {
  const hex = String(color).replace("#", "");
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 145 ? "#101713" : "#e7e1c5";
}

function startDigestionAnimation() {
  digestionAnimations.push({ startedAt: performance.now(), snakeLength: snake.length });
}

// The "swallowed seed" bulge occupies mainly ONE block at a time and hops down
// the body, one segment every DIGESTION_SEGMENT_DELAY ms, until it reaches the
// tail and vanishes. Lower the delay to send the lump down faster. The segment
// on each side of the active one gets a small fraction of the bulge (a soft
// shoulder) so the lump doesn't look like it's snapping between blocks.
const DIGESTION_SEGMENT_DELAY = 70;
const DIGESTION_NEIGHBOR_SHARE = 0.15;
// The bulge shrinks as it nears the tail, bottoming out at this fraction of
// full size right at the last segment (rather than vanishing/popping there).
const DIGESTION_TAIL_TAPER_FLOOR = 0.35;

function pruneDigestionAnimations() {
  const now = performance.now();
  digestionAnimations = digestionAnimations.filter((animation) => {
    // Done once the lump has passed the last segment.
    return now - animation.startedAt < animation.snakeLength * DIGESTION_SEGMENT_DELAY;
  });
}

function digestionPulseForSegment(index, now) {
  const segmentDelay = DIGESTION_SEGMENT_DELAY;
  return digestionAnimations.reduce((strongestPulse, animation) => {
    const elapsed = now - animation.startedAt;
    if (elapsed < 0) return strongestPulse;
    // The single segment currently holding the bulge (1 = first body block).
    const activeIndex = 1 + Math.floor(elapsed / segmentDelay);
    const distance = Math.abs(index - activeIndex);
    if (distance > 1) return strongestPulse;
    // Ease the lump in and out within its own slot so it pops on one block,
    // then hands off to the next — never two at full size at once.
    const localProgress = (elapsed % segmentDelay) / segmentDelay;
    const pulse = Math.sin(localProgress * Math.PI);
    // Taper the peak down as the bulge approaches the tail.
    const tailIndex = Math.max(1, animation.snakeLength - 1);
    const nearingTail = Math.min(1, activeIndex / tailIndex);
    const taper = 1 - nearingTail * (1 - DIGESTION_TAIL_TAPER_FLOOR);
    const scaled = (distance === 0 ? pulse : pulse * DIGESTION_NEIGHBOR_SHARE) * taper;
    return Math.max(strongestPulse, scaled);
  }, 0);
}

function drawFood() {
  const foodType = currentFoodType();
  const pulse = state === "running" ? Math.sin(performance.now() / 130) * boardMetrics.cellSize * 0.05 : 0;

  foods.forEach((snack) => {
    const inset = Math.max(4, Math.floor(boardMetrics.cellSize * 0.18) - pulse);
    const rect = cellRect(snack, inset);
    const centerX = rect.x + rect.size / 2;
    const centerY = rect.y + rect.size / 2;

    if (snack.kind === "egg") {
      ctx.fillStyle = "#f2e9ba";
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, rect.size * 0.32, rect.size * 0.43, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#182413";
      ctx.lineWidth = Math.max(1, rect.size * 0.08);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = "#182413";
    if (foodType.kind === "fruit") {
      ctx.beginPath();
      ctx.arc(centerX, centerY + 1, rect.size * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(centerX - 1, rect.y - 2, 2, Math.max(3, rect.size * 0.22));
      ctx.fillStyle = "#9cac77";
      ctx.fillRect(centerX + 2, rect.y - 2, Math.max(2, rect.size * 0.22), 2);
    } else if (foodType.kind === "pod") {
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, rect.size * 0.34, rect.size * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9cac77";
      ctx.fillRect(centerX - 1, rect.y + rect.size * 0.22, 2, Math.max(2, rect.size * 0.14));
    } else {
      ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
      const cut = rect.size * 0.32;
      ctx.clearRect(rect.x + cut, rect.y + cut, rect.size - cut * 2, rect.size - cut * 2);
    }

    ctx.fillStyle = "rgba(24, 36, 19, 0.42)";
    ctx.fillRect(rect.x + 3, rect.y + rect.size + 2, Math.max(1, rect.size - 4), 2);
  });
}

function drawScanlines() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.055)";
  for (let y = 0; y < canvas.height; y += Math.max(8, Math.floor(boardMetrics.cellSize / 2))) {
    ctx.fillRect(0, y, canvas.width, 2);
  }
}

function syncHud() {
  const isSnakebird = gameMode === "snakebird";
  const isSokoban = gameMode === "sokoban";
  if (gameMode === "battleship" && battleship) {
    const B = window.IdleSnakeBattleship;
    scoreLabelEl.textContent = "Sunk";
    bestLabelEl.textContent = "Wins";
    setText(scoreEl, padScore(B.sunkCount(battleship.enemy)));
    setText(bestEl, padScore(battleshipBest));
    setText(seedsTotalEl, padSeeds(seedsTotal));
    if (duelGridSelect) duelGridSelect.hidden = true;
    if (gridLabelEl) gridLabelEl.hidden = false;
    setText(gridLabelEl, `${battleshipGrid.columns}x${battleshipGrid.rows}`);
    setText(timerEl, formatTime(timerStarted ? elapsedMs : 0));
    pauseButton.classList.toggle("is-active", state === "paused");
    return;
  }
  if (gameMode === "broodline" && broodline) {
    scoreLabelEl.textContent = "Seeds"; bestLabelEl.textContent = "Kills";
    scoreEl.textContent = padScore(broodline.pendingSeeds); bestEl.textContent = padScore(broodline.kills);
    gridLabelEl.textContent = `R${broodline.round}`; timerEl.textContent = formatTime(timerStarted ? elapsedMs : 0);
    setScreenHint(`BODY ${broodline.chain.filter((part) => part.kind === "body").length} · ARMOR ${broodline.armor}/${broodline.maxArmor} · HATCH ${broodline.chain.filter((part) => ["garden", "cave", "electric", "lava", "rattle"].includes(part.kind)).length}`);
    return;
  }
  if (scoreLabelEl) scoreLabelEl.textContent = isSnakebird ? "Moves" : "Score";
  if (bestLabelEl) bestLabelEl.textContent = isSnakebird ? "Best" : "Best";
  const activeScore = isSnakebird
    ? snakebird?.moves || 0
    : isSokoban
    ? sokoban?.score || 0
    : gameMode === "breakout"
    ? breakout?.score || 0
    : gameMode === "runner"
    ? runner?.score || 0
    : gameMode === "crossing"
      ? crossingScore
      : gameMode === "duel" ? duelScore : gameMode === "maze" ? mazeScore : gameMode === "centipede" ? centipede?.score || 0 : score;
  const activeBest = isSnakebird
    ? snakebirdProgress.bestMoves[snakebird?.levelIndex || 0]
    : isSokoban
    ? sokobanBest
    : gameMode === "breakout"
    ? breakoutBest
    : gameMode === "runner"
    ? runnerBest
    : gameMode === "crossing" ? crossingBest
    : gameMode === "maze" ? mazeBest
    : gameMode === "centipede" ? centipedeBest
    : Math.max(best, score);
  setText(scoreEl, padScore(activeScore));
  setText(bestEl, isSnakebird && activeBest === null ? "—" : padScore(activeBest));
  setText(seedsTotalEl, padSeeds(seedsTotal));
  if (duelGridSelect) {
    duelGridSelect.hidden = gameMode !== "duel";
    duelGridSelect.value = String(selectedDuelGridSize);
  }
  if (gridLabelEl) gridLabelEl.hidden = gameMode === "duel";
  setText(gridLabelEl, isSnakebird
    ? `L${(snakebird?.levelIndex || 0) + 1}/5`
    : isSokoban ? `S${(sokoban?.stageIndex || 0) + 1}/${sokobanLevels.length}`
    : gameMode === "breakout" ? `LIVES ${breakout?.lives ?? 0}`
    : gameMode === "runner" ? "RUN"
    : gameMode === "centipede" ? `LIVES ${centipede?.lives ?? 0} · W${centipede?.wave ?? 1}`
    : gameMode === "broodline" ? `R${broodline?.round || 1} W${broodline?.wave || 1}/${broodlineWavesPerRound}`
    : `${grid.columns}x${grid.rows}`);
  setText(timerEl, formatTime(timerStarted ? elapsedMs : 0));
  pauseButton.classList.toggle("is-active", state === "paused");
  // NOTE: syncNurseryPanel()/syncUpgradeMenu() are intentionally NOT called here.
  // syncHud() runs every animation frame; the idle panels only change on the
  // 250ms nursery clock and on discrete actions, which refresh them via
  // syncPanels(). Keeping them out of the per-frame path is the main perf fix.
}

// Refresh the idle/upgrade panels. Called from the 250ms nursery clock and from
// discrete state changes (purchases, eggs, placements) — never per frame.
function syncPanels(now = Date.now()) {
  syncNurseryPanel(now);
  syncUpgradeMenu();
  // Keep the always-visible count fresh without rebuilding the interactive
  // roster under the pointer every 250ms.
  syncNotablesSummary();
  syncMigrationPanel();
}

function replaceSelectOptions(select, items, selectedValue) {
  if (!select) return;
  const signature = JSON.stringify(items);
  if (select.dataset.optionsSignature !== signature) {
    select.replaceChildren(...items.map((item) => {
      const option = document.createElement("option");
      option.value = item.value; option.textContent = item.label; option.disabled = Boolean(item.disabled); return option;
    }));
    select.dataset.optionsSignature = signature;
  }
  if (items.some((item) => item.value === selectedValue)) select.value = selectedValue;
}

function migrationManifestFromInputs() {
  return {
    adults: Math.max(0, Math.floor(Number(migrationAdultsEl?.value) || 0)),
    eggs: Math.max(0, Math.floor(Number(migrationEggsEl?.value) || 0)),
    seeds: Math.max(0, Math.floor(Number(migrationSeedsEl?.value) || 0)),
    branches: Math.max(0, Math.floor(Number(migrationBranchesEl?.value) || 0)),
    provisions: Math.max(0, Math.floor(Number(migrationProvisionsEl?.value) || 0))
  };
}

function migrationActionButton(label, action, value, danger = false) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.dataset.migrationAction = action;
  if (value != null) button.dataset.value = value; if (danger) button.classList.add("is-danger"); return button;
}

function formatMigrationLosses(losses) {
  const labels = { adults: ["adult", "adults"], eggs: ["egg", "eggs"], seeds: ["Seed", "Seeds"], branches: ["Branch", "Branches"], provisions: ["Provision", "Provisions"] };
  return Object.entries(losses || {}).filter(([, amount]) => Number(amount) > 0).map(([resource, amount]) => {
    const count = formatWholeNumber(amount); const label = labels[resource] || [resource, `${resource}s`];
    return `${count} ${Number(amount) === 1 ? label[0] : label[1]}`;
  }).join(" · ") || "none";
}

function exactOptionLosses(manifest, option) {
  const remaining = { ...manifest }; const losses = {};
  [option.cost, option.penalty].forEach((change) => Object.entries(change || {}).forEach(([resource, amount]) => {
    const minimum = resource === "adults" || resource === "provisions" ? 1 : 0;
    const lost = Math.min(Math.max(0, Number(amount) || 0), Math.max(0, (Number(remaining[resource]) || 0) - minimum));
    remaining[resource] = Math.max(minimum, (Number(remaining[resource]) || 0) - lost);
    losses[resource] = (losses[resource] || 0) + lost;
  }));
  return losses;
}

function renderExpedition(expedition) {
  const card = document.createElement("article"); card.className = "migration-expedition-card"; card.dataset.expeditionId = expedition.id;
  const heading = document.createElement("h3"); heading.textContent = `${expedition.notable.name} → ${expedition.destination}`; card.append(heading);
  const summary = document.createElement("p");
  const stateLabel = expedition.state === "traveling" ? `Travel ${formatDuration(expedition.travelTimeRemainingMs)} left` : expedition.state === "waitingChallenge" ? "Seed Trial awaiting input" : "Decision awaiting input";
  summary.textContent = `${stateLabel} · Stop ${expedition.currentStopIndex}/${expedition.stopCount} · ${formatDecimal(expedition.chanceOfSuccess * 100, 1)}% overall · ${formatDecimal(Math.min(1, expedition.perStopChance) * 100, 1)}% roll`;
  card.append(summary);
  const cargo = document.createElement("p"); const m = expedition.currentManifest; cargo.textContent = `Cargo: ${m.adults} adults · ${m.eggs} eggs · ${m.seeds} seeds · ${m.branches} branches · ${m.provisions} provisions`; card.append(cargo);
  if (["waitingStop", "waitingChallenge"].includes(expedition.state)) {
    const previousLeg = [...expedition.attritionHistory].reverse().find((item) => item.type === "travel" && item.leg === expedition.currentStopIndex);
    const attrition = document.createElement("p"); attrition.className = "migration-attrition";
    attrition.textContent = `Previous leg attrition: ${formatMigrationLosses(previousLeg?.losses)}.`; card.append(attrition);
  }
  const actions = document.createElement("div"); actions.className = "migration-expedition-actions";
  if (expedition.state === "waitingStop" && expedition.stopEvent) {
    const eventTitle = document.createElement("p"); eventTitle.textContent = `${expedition.stopEvent.title}: ${expedition.stopEvent.description}`; card.append(eventTitle);
    expedition.stopEvent.options.forEach((option) => {
      const losses = formatMigrationLosses(exactOptionLosses(m, option));
      const outcome = losses === "none" ? option.detail : `Lose ${losses}`;
      actions.append(migrationActionButton(`${option.label} — ${outcome}`, "resolve", option.id));
    });
  }
  if (expedition.state === "waitingChallenge") {
    const challenge = expedition.stopEvent.challenge;
    const instruction = document.createElement("p"); instruction.textContent = `Eat ${challenge.requiredSeeds} Seeds on a ${challenge.columns} by ${challenge.rows} board.`; card.append(instruction);
    actions.append(migrationActionButton(`Attempt ${expedition.stopEvent.title}`, "challenge"));
    const skipLosses = exactOptionLosses(m, { penalty: window.IdleSnakeConfig.migrationConfig.attrition.skippedChallenge });
    actions.append(migrationActionButton(`Skip — lose ${formatMigrationLosses(skipLosses)}`, "skip", null, true));
  }
  actions.append(migrationActionButton("Order voluntary return · 10% MP refund", "return", null, true)); card.append(actions); return card;
}

function tradeRouteStatus(route) {
  if (route.isPaused) return "Paused";
  const api = window.IdleSnakeTradeRoutes;
  return api.isOperable(route, route.directionAToB) || api.isOperable(route, route.directionBToA) ? "Active" : "Idle";
}

function tradeButton(label, action, detail = {}) {
  const button = document.createElement("button"); button.type = "button"; button.className = "trade-route-button"; button.textContent = label; button.dataset.tradeAction = action;
  Object.entries(detail).forEach(([key, value]) => { button.dataset[key] = value; }); return button;
}

function renderTradeDirection(route, directionName, settlements) {
  const api = window.IdleSnakeTradeRoutes; const direction = directionName === "AToB" ? route.directionAToB : route.directionBToA;
  const resupplyApi = window.IdleSnakeResupply; const mission = (latestSnapshot?.activeResupplyMissions || []).find((item) => item.routeId === route.id && item.directionId === directionName);
  const endpoints = api.endpoints(route, directionName); const source = settlements.find((item) => item.id === endpoints.sourceId); const destination = settlements.find((item) => item.id === endpoints.destinationId);
  const card = document.createElement("article"); card.className = "trade-direction-card"; card.dataset.tradeDirection = directionName;
  const heading = document.createElement("h4"); heading.textContent = `${source?.name || endpoints.sourceId} → ${destination?.name || endpoints.destinationId}`; card.append(heading);
  const derived = document.createElement("p"); derived.className = "trade-direction-derived";
  derived.textContent = `Capacity ${formatWholeNumber(api.capacity(direction))} · ${formatDecimal(api.efficiency(direction) * 100, 0)}% delivered · ${formatDuration(api.interval(direction))}`; card.append(derived);
  if (resupplyApi) {
    const missionStats = document.createElement("p"); missionStats.className = "migration-cargo-note";
    missionStats.textContent = `Re-Supply: upgrade score ${resupplyApi.upgradeScore(direction)} · ${formatDecimal(resupplyApi.routeDiscount(direction) * 100, 0)}% provision discount · ${formatDuration(resupplyApi.travelDuration(direction))}`; card.append(missionStats);
  }
  if (mission) {
    const active = document.createElement("p"); active.className = "migration-founding"; active.dataset.resupplyArrivalAt = String(mission.arrivalTime);
    active.textContent = `Re-Supply in transit: ${mission.notableIds.length} Notable${mission.notableIds.length === 1 ? "" : "s"}, ${mission.adultCount} adults, ${mission.eggCount} eggs · arrives ${formatDuration(Math.max(0, mission.arrivalTime - Date.now()))}`; card.append(active);
  }

  const fields = document.createElement("div"); fields.className = "trade-direction-fields";
  const resourceLabel = document.createElement("label"); resourceLabel.textContent = "Export"; const resource = document.createElement("select"); resource.dataset.tradeField = "resourceType";
  [["seeds", "Seeds"], ["branches", "Branches"], ["provisions", "Provisions"]].forEach(([value, label]) => { const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = value === direction.resourceType; resource.append(option); }); resourceLabel.append(resource);
  const targetLabel = document.createElement("label"); targetLabel.textContent = "Target"; const target = document.createElement("input"); target.type = "number"; target.min = "0"; target.step = "1"; target.value = direction.shipmentTarget; target.dataset.tradeField = "shipmentTarget"; targetLabel.append(target);
  const reserveLabel = document.createElement("label"); reserveLabel.textContent = "Reserve"; const reserve = document.createElement("input"); reserve.type = "number"; reserve.min = "0"; reserve.step = "1"; reserve.value = direction.reserveThreshold; reserve.dataset.tradeField = "reserveThreshold"; reserveLabel.append(reserve);
  fields.append(resourceLabel, targetLabel, reserveLabel); card.append(fields, tradeButton("Apply configuration", "configure", { direction: directionName }));

  const workers = document.createElement("div"); workers.className = "trade-worker-row";
  const workerText = document.createElement("span"); workerText.textContent = `Workers ${direction.workersAssigned}/${direction.maxWorkers}`;
  const workerControls = document.createElement("span"); const minus = tradeButton("−", "workers", { direction: directionName, delta: -1 }); const plus = tradeButton("+", "workers", { direction: directionName, delta: 1 });
  minus.disabled = direction.workersAssigned <= 0; plus.disabled = direction.workersAssigned >= direction.maxWorkers; workerControls.append(minus, plus); workers.append(workerText, workerControls); card.append(workers);

  const schedule = document.createElement("p"); schedule.className = "migration-cargo-note trade-next-shipment";
  if (direction.nextShipmentAt != null) schedule.dataset.nextShipmentAt = String(direction.nextShipmentAt);
  schedule.textContent = direction.nextShipmentAt == null ? "No shipment scheduled" : `Next shipment ${formatDuration(Math.max(0, direction.nextShipmentAt - Date.now()))}`; card.append(schedule);
  const stats = document.createElement("p"); stats.className = "migration-cargo-note"; stats.textContent = `${formatWholeNumber(direction.lifetimeShipments)} shipments · ${formatWholeNumber(direction.lifetimeResourceSent)} sent · ${formatWholeNumber(direction.lifetimeResourceDelivered)} delivered`; card.append(stats);

  const actions = document.createElement("div"); actions.className = "trade-upgrade-grid";
  const levels = { capacity: direction.capacityLevel, speed: direction.speedLevel, efficiency: direction.efficiencyLevel, workerCap: direction.workerCapLevel };
  const labels = { capacity: "Capacity", speed: "Speed", efficiency: "Efficiency", workerCap: "Worker cap" };
  Object.entries(levels).forEach(([type, level]) => {
    const cost = api.upgradeCost(type, level); const button = tradeButton(`${labels[type]} L${level} · ${formatWholeNumber(cost.seeds)}S/${formatWholeNumber(cost.branches)}B`, "upgrade", { direction: directionName, upgradeType: type });
    if (type === "efficiency" && level >= window.IdleSnakeConfig.tradeRouteConfig.direction.efficiencyByLevel.length - 1) { button.textContent = `${labels[type]} MAX`; button.disabled = true; }
    actions.append(button);
  });
  actions.append(tradeButton(direction.isPaused ? "Resume direction" : "Pause direction", "direction-pause", { direction: directionName, paused: String(!direction.isPaused) })); card.append(actions);
  if (resupplyApi && !mission) {
    const builder = document.createElement("div"); builder.className = "trade-direction-fields";
    const notableLabel = document.createElement("label"); notableLabel.textContent = "Re-Supply Notables"; const notableSelect = document.createElement("select"); notableSelect.multiple = true; notableSelect.size = 3; notableSelect.dataset.resupplyField = "notables";
    resupplyApi.eligibleNotables(source).forEach((item) => { const option = document.createElement("option"); option.value = item.id; option.textContent = `${item.name}${item.epithet ? ` ${item.epithet}` : ""}`; notableSelect.append(option); }); notableLabel.append(notableSelect);
    const adultLabel = document.createElement("label"); adultLabel.textContent = `Colony adults (available ${formatWholeNumber(source?.economy?.nursery?.colonyCount || 0)})`; const adults = document.createElement("input"); adults.type = "number"; adults.min = "0"; adults.max = String(source?.economy?.nursery?.colonyCount || 0); adults.value = "0"; adults.dataset.resupplyField = "adults"; adultLabel.append(adults);
    const eggLabel = document.createElement("label"); const availableEggs = resupplyApi.availableEggs(source?.economy?.nursery); eggLabel.textContent = `Eggs (available ${formatWholeNumber(availableEggs)})`; const eggs = document.createElement("input"); eggs.type = "number"; eggs.min = "0"; eggs.max = String(availableEggs); eggs.value = "0"; eggs.dataset.resupplyField = "eggs"; eggLabel.append(eggs);
    builder.append(notableLabel, adultLabel, eggLabel); card.append(builder);
    const send = tradeButton("Send Re-Supply", "resupply", { direction: directionName }); send.disabled = direction.workersAssigned < 1 || !notableSelect.options.length; card.append(send);
  }
  if (mission) card.querySelectorAll("button, input, select").forEach((control) => { control.disabled = true; });
  return card;
}

function renderTradeNetwork(settlements, routes) {
  if (!tradeRouteNetworkEl) return; tradeRouteNetworkEl.replaceChildren();
  const ns = "http://www.w3.org/2000/svg"; const points = new Map(); const count = Math.max(1, settlements.length);
  settlements.forEach((settlement, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / count; points.set(settlement.id, { x: 160 + Math.cos(angle) * 105, y: 90 + Math.sin(angle) * 62 }); });
  routes.forEach((route) => { const a = points.get(route.settlementAId); const b = points.get(route.settlementBId); if (!a || !b) return;
    const line = document.createElementNS(ns, "line"); line.setAttribute("x1", a.x); line.setAttribute("y1", a.y); line.setAttribute("x2", b.x); line.setAttribute("y2", b.y); line.classList.add("trade-network-edge");
    if (route.id === selectedTradeRouteId) line.classList.add("is-selected"); line.dataset.routeId = route.id; line.setAttribute("role", "button"); line.setAttribute("aria-label", `Manage route ${route.id}`); tradeRouteNetworkEl.append(line);
  });
  settlements.forEach((settlement) => { const point = points.get(settlement.id); const group = document.createElementNS(ns, "g"); group.classList.add("trade-network-node"); if (settlement.status === "founding") group.classList.add("is-founding");
    const circle = document.createElementNS(ns, "circle"); circle.setAttribute("cx", point.x); circle.setAttribute("cy", point.y); circle.setAttribute("r", 17);
    const text = document.createElementNS(ns, "text"); text.setAttribute("x", point.x); text.setAttribute("y", point.y + 29); text.setAttribute("text-anchor", "middle"); text.textContent = settlement.name; group.append(circle, text); tradeRouteNetworkEl.append(group);
  });
}

function syncTradeRoutesPanel(migrationState) {
  if (!tradeSettlementAEl || !window.IdleSnakeTradeRoutes) return;
  const established = migrationState.settlements.filter((item) => item.status === "established"); const routes = latestSnapshot.tradeRoutes || [];
  const choices = established.map((item) => ({ value: item.id, label: item.name }));
  replaceSelectOptions(tradeSettlementAEl, choices, choices.some((item) => item.value === tradeSettlementAEl.value) ? tradeSettlementAEl.value : migrationState.activeSettlementId);
  const secondChoices = choices.filter((item) => item.value !== tradeSettlementAEl.value); replaceSelectOptions(tradeSettlementBEl, secondChoices, secondChoices.some((item) => item.value === tradeSettlementBEl.value) ? tradeSettlementBEl.value : secondChoices[0]?.value);
  const cost = window.IdleSnakeTradeRoutes.constructionCost(); const a = established.find((item) => item.id === tradeSettlementAEl.value); const b = established.find((item) => item.id === tradeSettlementBEl.value);
  const exists = routes.some((route) => [route.settlementAId, route.settlementBId].sort().join("::") === [a?.id, b?.id].sort().join("::"));
  setText(tradeConstructionPreviewEl, `${formatWholeNumber(cost.seeds)} Seeds + ${formatWholeNumber(cost.branches)} Branches from each settlement${exists ? " · already connected" : ""}`);
  createTradeRouteButtonEl.disabled = !a || !b || exists || a.economy?.seeds < cost.seeds || a.economy?.branches < cost.branches || b.economy?.seeds < cost.seeds || b.economy?.branches < cost.branches;
  if (!routes.some((route) => route.id === selectedTradeRouteId)) selectedTradeRouteId = routes[0]?.id || null;
  tradeRouteManagementEl.querySelectorAll("[data-next-shipment-at]").forEach((item) => { item.textContent = `Next shipment ${formatDuration(Math.max(0, Number(item.dataset.nextShipmentAt) - Date.now()))}`; });
  tradeRouteManagementEl.querySelectorAll("[data-resupply-arrival-at]").forEach((item) => { item.textContent = item.textContent.replace(/arrives .*/, `arrives ${formatDuration(Math.max(0, Number(item.dataset.resupplyArrivalAt) - Date.now()))}`); });
  const networkSignature = JSON.stringify({ settlements: migrationState.settlements.map((item) => [item.id, item.name, item.status]), routes: routes.map((item) => [item.id, item.settlementAId, item.settlementBId]), selectedTradeRouteId });
  if (networkSignature !== tradeNetworkRenderSignature) { renderTradeNetwork(migrationState.settlements, routes); tradeNetworkRenderSignature = networkSignature; }
  if (tradeRouteManagementEl.contains(document.activeElement) && ["INPUT", "SELECT"].includes(document.activeElement.tagName)) return;
  const selected = routes.find((route) => route.id === selectedTradeRouteId);
  const managementSignature = JSON.stringify({ selected, names: migrationState.settlements.map((item) => [item.id, item.name]) });
  if (managementSignature === tradeManagementRenderSignature) return;
  tradeManagementRenderSignature = managementSignature; tradeRouteManagementEl.replaceChildren();
  if (!selected) { const empty = document.createElement("p"); empty.className = "migration-cargo-note"; empty.textContent = migrationState.settlements.length < 2 ? "Found a second settlement to unlock Trade." : established.length < 2 ? "Wait for the new settlement to become established before constructing a trade route." : "No trade routes constructed."; tradeRouteManagementEl.append(empty); return; }
  const aSettlement = migrationState.settlements.find((item) => item.id === selected.settlementAId); const bSettlement = migrationState.settlements.find((item) => item.id === selected.settlementBId);
  const header = document.createElement("article"); header.className = "trade-route-header"; const title = document.createElement("h3"); title.textContent = `${aSettlement?.name} ↔ ${bSettlement?.name}`;
  const total = selected.directionAToB.lifetimeResourceSent + selected.directionBToA.lifetimeResourceSent; const summary = document.createElement("p"); summary.textContent = `${tradeRouteStatus(selected)} · Built ${new Date(selected.createdAt).toLocaleDateString()} · ${formatWholeNumber(total)} cargo sent`;
  const headerActions = document.createElement("div"); headerActions.className = "trade-route-header-actions"; headerActions.append(tradeButton(selected.isPaused ? "Resume route" : "Pause route", "route-pause", { paused: String(!selected.isPaused) }), tradeButton("Dismantle", "dismantle"));
  header.append(title, summary, headerActions); tradeRouteManagementEl.append(header, renderTradeDirection(selected, "AToB", migrationState.settlements), renderTradeDirection(selected, "BToA", migrationState.settlements));
  const history = (latestSnapshot.completedResupplyMissions || []).filter((item) => item.routeId === selected.id).slice(-5).reverse();
  if (history.length) { const block = document.createElement("article"); block.className = "trade-route-header"; const title = document.createElement("h3"); title.textContent = "Re-Supply history"; block.append(title); history.forEach((item) => { const line = document.createElement("p"); line.textContent = `${item.notableIds.length} Notables · ${item.adultCount} adults · ${item.eggCount} eggs · ${formatWholeNumber(item.provisionsConsumed)} Provisions · ${formatDuration(item.travelDuration)}`; block.append(line); }); tradeRouteManagementEl.append(block); }
}

function showSettleOverview() {
  if (!settleOverviewEl || !tradePanelEl) return;
  settleOverviewEl.hidden = false; tradePanelEl.hidden = true;
}

function showTradePanel() {
  if (!settleOverviewEl || !tradePanelEl || tradeButtonEl?.disabled) return;
  settleOverviewEl.hidden = true; tradePanelEl.hidden = false;
}

function syncMigrationPanel() {
  if (!latestSnapshot?.migration || !migrationAvailableEl) return;
  const migrationState = latestSnapshot.migration; const config = window.IdleSnakeConfig.migrationConfig;
  setText(migrationAvailableEl, `${formatDecimal(migrationState.availablePoints, 2)} MP`);
  setText(migrationLifetimeEl, `${formatDecimal(migrationState.totalEarned, 2)} MP`);
  const settlementItems = migrationState.settlements.map((item) => ({ value: item.id, label: `${item.name}${item.status === "founding" ? " (founding)" : ""}` }));
  replaceSelectOptions(activeSettlementSelectEl, settlementItems, migrationState.activeSettlementId);
  const grasslands = migrationState.settlements.find((item) => item.id === "grasslands"); const economy = grasslands?.economy;
  const claimedDestinations = new Set([...migrationState.settlements.map((item) => String(item.region || item.name).toLowerCase()), ...migrationState.activeExpeditions.map((item) => String(item.destination).toLowerCase())]);
  const destinationItems = config.destinations.map((name) => ({ value: name, label: `${name}${claimedDestinations.has(name.toLowerCase()) ? " (settled)" : ""}`, disabled: claimedDestinations.has(name.toLowerCase()) }));
  const selectableDestinations = destinationItems.filter((item) => !item.disabled);
  replaceSelectOptions(migrationDestinationEl, destinationItems, selectableDestinations.some((item) => item.value === migrationDestinationEl.value) ? migrationDestinationEl.value : selectableDestinations[0]?.value);
  const notableItems = (economy?.notables?.retained || []).map((item) => ({ value: item.id, label: `${item.name}${item.epithet ? ` ${item.epithet}` : ""}` }));
  if (!notableItems.length) notableItems.push({ value: "", label: "No Grasslands Notable available", disabled: true });
  replaceSelectOptions(migrationNotableEl, notableItems, notableItems.some((item) => item.value === migrationNotableEl.value) ? migrationNotableEl.value : notableItems[0].value);
  const available = economy ? window.IdleSnakeMigration.manifestAvailable(economy) : { adults: 0, eggs: 0, seeds: 0, branches: 0, provisions: 0 };
  [[migrationAdultsEl, available.adults], [migrationEggsEl, available.eggs], [migrationSeedsEl, available.seeds], [migrationBranchesEl, available.branches], [migrationProvisionsEl, available.provisions]].forEach(([input, max]) => { if (input) input.max = String(Math.floor(max)); });
  const manifest = migrationManifestFromInputs(); const notable = economy?.notables?.retained?.find((item) => item.id === migrationNotableEl.value); const cost = window.IdleSnakeMigration.calculateCost(manifest); const success = window.IdleSnakeMigration.calculateSuccess(manifest, notable);
  setText(migrationCostEl, `${formatDecimal(cost, 2)} MP`); setText(migrationSuccessEl, notable ? `${formatDecimal(success * 100, 1)}%` : "—");
  const adultRate = window.IdleSnakeMigration.attritionRate("adults", success) * 100; const provisionRate = window.IdleSnakeMigration.attritionRate("provisions", success) * 100;
  setText(migrationEstimateEl, `Estimated ordinary loss per leg: ${formatDecimal(adultRate, 1)}% adults, ${formatDecimal(provisionRate, 1)}% provisions. Eggs are immune.`);
  migrationDepartEl.disabled = !grasslands || grasslands.status !== "established" || !notable || !selectableDestinations.length || manifest.adults < config.requirements.adults || manifest.provisions < config.requirements.provisions || cost > migrationState.availablePoints;
  activeExpeditionsEl.replaceChildren();
  if (migrationState.activeExpeditions.length) migrationState.activeExpeditions.forEach((expedition) => activeExpeditionsEl.append(renderExpedition(expedition)));
  else { const empty = document.createElement("p"); empty.className = "migration-cargo-note"; empty.textContent = "No active expeditions."; activeExpeditionsEl.append(empty); }
  migrationHistoryEl.replaceChildren();
  const history = [...migrationState.completedMigrations.map((item) => ({ ...item, label: "Arrived" })), ...migrationState.failedMigrations.map((item) => ({ ...item, label: "Failed" })), ...migrationState.returnedMigrations.map((item) => ({ ...item, label: "Returned" }))].sort((a, b) => (b.arrivalTime || 0) - (a.arrivalTime || 0)).slice(0, 5);
  if (history.length) { const title = document.createElement("p"); title.className = "migration-cargo-note"; title.textContent = "Recent history"; migrationHistoryEl.append(title, ...history.map((item) => { const row = document.createElement("p"); row.className = "migration-cargo-note"; row.textContent = `${item.label}: ${item.destination} · ${item.notable?.name || "Unknown"}`; return row; })); }
  const activeSettlement = migrationState.settlements.find((item) => item.id === migrationState.activeSettlementId); const founding = activeSettlement?.status === "founding";
  migrationFoundingStatusEl.hidden = !founding; if (founding) setText(migrationFoundingStatusEl, `Founding ${formatDuration(activeSettlement.foundingRemainingMs)} · every normal Snake Seed removes 1 second. Nursery and Colony are locked.`);
  menuTabs.forEach((tab) => { if (["nursery", "colony"].includes(tab.dataset.menuTab)) tab.disabled = founding; });
  const tradeUnlocked = migrationState.settlements.length >= 2;
  if (tradeButtonEl) { tradeButtonEl.disabled = !tradeUnlocked; tradeButtonEl.classList.toggle("is-ready", tradeUnlocked); }
  const decisionPending = migrationState.activeExpeditions.some((item) => ["waitingStop", "waitingChallenge"].includes(item.state));
  if (settleTabNotificationEl) settleTabNotificationEl.hidden = !decisionPending;
  syncTradeRoutesPanel(migrationState);
}

function padScore(value) {
  return String(value).padStart(3, "0");
}

function padSeeds(value) {
  return formatDecimal(value, 2);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readUpgrades() {
  const fallback = {
    boardLevel: 0,
    foodTypeLevel: 0,
    foodCountLevel: 0,
    shieldLevel: 0,
    minigamesLevel: 0
  };

  try {
    const saved = JSON.parse(getSaveItem("upgrades") || "{}");
    return {
      boardLevel: clampLevel(saved.boardLevel, upgradeConfig.board.levels.length - 1),
      foodTypeLevel: clampLevel(saved.foodTypeLevel, upgradeConfig.foodType.levels.length - 1),
      foodCountLevel: clampLevel(saved.foodCountLevel, 99),
      shieldLevel: clampLevel(saved.shieldLevel, 99),
      minigamesLevel: clampLevel(saved.minigamesLevel, upgradeConfig.minigames.levels.length)
    };
  } catch {
    return fallback;
  }
}

function clampLevel(value, max) {
  const level = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0;
  return Math.max(0, Math.min(max, level));
}

function saveUpgrades() {
  setSaveItem("upgrades", JSON.stringify(upgrades));
}

function parseGridSize(size) {
  const [columns, rows] = String(size).split("x").map(Number);
  return columns && rows ? { columns, rows } : { ...defaultGrid };
}

function currentFoodType() {
  return upgradeConfig.foodType.levels[upgrades.foodTypeLevel];
}

function foodCount() {
  return upgradeConfig.foodCount.baseCount + upgrades.foodCountLevel;
}

function upgradeCost(config, level) {
  return Math.ceil(config.baseCost * config.costRatio ** level);
}

function syncUpgradeMenu() {
  const boardMaxed = upgrades.boardLevel >= upgradeConfig.board.levels.length - 1;
  const nextBoard = upgradeConfig.board.levels[upgrades.boardLevel + 1];
  selectedBoardLevel = clampLevel(selectedBoardLevel, upgrades.boardLevel);
  const selectedBoard = upgradeConfig.board.levels[selectedBoardLevel];
  boardUpgradeNameEl.textContent = selectedBoard;
  boardUpgradeLevelEl.textContent = `LV ${selectedBoardLevel + 1}`;
  boardUpgradeCurrentEl.textContent = `${selectedBoard} board`;
  boardUpgradeNextEl.textContent = boardMaxed ? "Next: Maximum board" : `Next: ${nextBoard}`;
  syncBoardSizeSelect();
  updateUpgradeButton("board", boardMaxed ? null : upgradeCost(upgradeConfig.board, upgrades.boardLevel));

  const foodType = currentFoodType();
  const foodTypeMaxed = upgrades.foodTypeLevel >= upgradeConfig.foodType.levels.length - 1;
  const nextFoodType = upgradeConfig.foodType.levels[upgrades.foodTypeLevel + 1];
  foodTypeNameEl.textContent = foodType.name;
  foodTypeLevelEl.textContent = `LV ${upgrades.foodTypeLevel + 1}`;
  foodTypeCurrentEl.textContent = foodEffect(foodType);
  foodTypeNextEl.textContent = foodTypeMaxed
    ? "Next: Maximum food"
    : `Next: ${nextFoodType.name}, ${foodEffect(nextFoodType)}`;
  updateUpgradeButton("foodType", foodTypeMaxed ? null : upgradeCost(upgradeConfig.foodType, upgrades.foodTypeLevel));

  const snacks = foodCount();
  const nextSnacks = snacks + 1;
  foodCountNameEl.textContent = `${snacks} snack${snacks === 1 ? "" : "s"}`;
  foodCountLevelEl.textContent = `LV ${upgrades.foodCountLevel + 1}`;
  foodCountCurrentEl.textContent = `${snacks} snack${snacks === 1 ? "" : "s"} on board`;
  foodCountNextEl.textContent = `Next: ${nextSnacks} snacks on board`;
  updateUpgradeButton("foodCount", upgradeCost(upgradeConfig.foodCount, upgrades.foodCountLevel));

  shieldNameEl.textContent = `${upgrades.shieldLevel} held`;
  shieldLevelEl.textContent = `LV ${upgrades.shieldLevel + 1}`;
  shieldCurrentEl.textContent = `${upgrades.shieldLevel} collision save${upgrades.shieldLevel === 1 ? "" : "s"}`;
  shieldNextEl.textContent = `Next: ${upgrades.shieldLevel + 1} shield${upgrades.shieldLevel + 1 === 1 ? "" : "s"}`;
  updateUpgradeButton("shield", upgradeCost(upgradeConfig.shield, upgrades.shieldLevel));

  const minigamesMaxed = upgrades.minigamesLevel >= upgradeConfig.minigames.levels.length;
  const unlockedMinigame = upgradeConfig.minigames.levels[upgrades.minigamesLevel - 1];
  const nextMinigame = upgradeConfig.minigames.levels[upgrades.minigamesLevel];
  minigamesNameEl.textContent = minigamesMaxed ? "All unlocked" : unlockedMinigame ? `Game ${unlockedMinigame}` : "None unlocked";
  minigamesLevelEl.textContent = `LV ${upgrades.minigamesLevel}`;
  minigamesCurrentEl.textContent = upgrades.minigamesLevel ? `${upgrades.minigamesLevel} phone game${upgrades.minigamesLevel === 1 ? "" : "s"} unlocked` : "Unlock phone game 1";
  minigamesNextEl.textContent = minigamesMaxed ? "Next: Maximum games" : `Next: phone game ${nextMinigame}`;
  updateUpgradeButton("minigames", minigamesMaxed ? null : upgradeCost(upgradeConfig.minigames, upgrades.minigamesLevel));
  syncMinigameKeys();

  upgradeCards.board.classList.toggle("is-maxed", boardMaxed);
  upgradeCards.foodType.classList.toggle("is-maxed", foodTypeMaxed);
  upgradeCards.foodCount.classList.remove("is-maxed");
  upgradeCards.shield.classList.remove("is-maxed");
  upgradeCards.minigames.classList.toggle("is-maxed", minigamesMaxed);
}

function syncMinigameKeys() {
  minigameKeys.forEach((key) => {
    const unlocked = Number(key.dataset.minigame) === 0
      ? true
      : Number(key.dataset.minigame) <= upgrades.minigamesLevel;
    key.disabled = false;
    key.classList.toggle("is-locked", !unlocked);
    key.setAttribute("aria-disabled", String(!unlocked));
    key.title = Number(key.dataset.minigame) === 0
      ? "Open snake personalization"
      : unlocked ? `Launch minigame ${key.dataset.minigame}` : "Purchase Minigame Upgrade to Unlock.";
  });
}

let boardOptionsBuiltForLevel = -1;
function syncBoardSizeSelect() {
  // Only rebuild the <option>s when the set of unlocked board sizes changes.
  // syncUpgradeMenu() runs several times a second, and rebuilding the dropdown
  // every time both allocates garbage and can disrupt an open <select>.
  if (boardOptionsBuiltForLevel !== upgrades.boardLevel) {
    const unlockedLevels = upgradeConfig.board.levels.slice(0, upgrades.boardLevel + 1);
    boardSizeSelect.replaceChildren(...unlockedLevels.map((size, level) => {
      const option = document.createElement("option");
      option.value = String(level);
      option.textContent = boardMastery[size] ? `♛ ${size}` : size;
      return option;
    }));
    boardSizeSelect.hidden = unlockedLevels.length < 2;
    boardOptionsBuiltForLevel = upgrades.boardLevel;
  }
  const selectedValue = String(selectedBoardLevel);
  if (boardSizeSelect.value !== selectedValue) boardSizeSelect.value = selectedValue;
}

function foodEffect(foodType) {
  return `+${foodType.value} seed${foodType.value === 1 ? "" : "s"} per snack`;
}

function updateUpgradeButton(type, cost) {
  const button = upgradeButtons[type];
  if (!button) return;
  const maxed = cost === null;
  button.disabled = maxed || seedsTotal < cost;
  button.textContent = maxed ? "Maxed" : `Buy ${formatNumber(cost)}`;
}

function grantMinigameFunds() {
  const grant = upgradeConfig.minigames.levels.reduce(
    (total, _level, level) => total + upgradeCost(upgradeConfig.minigames, level),
    0
  );
  seedsTotal += grant;
  saveSeeds();
  syncHud();
  syncPanels();
  setScreenHint(`+${formatNumber(grant)} seeds granted for minigame upgrades`);
}

function grantAdultSnakes() {
  if (!session) return;
  const now = Date.now();
  const { snapshot } = session.dispatch({ type: "addColonySnakes", amount: 5 });
  latestSnapshot = snapshot;
  mirrorEconomyFromWorld(now, snapshot);
  saveNursery();
  syncPanels(now);
  setScreenHint("+5 adult snakes added to the colony");
}

function purchaseUpgrade(type) {
  const config = upgradeConfig[type];
  const levelKey = `${type}Level`;
  if (!config || !(levelKey in upgrades)) return;
  if (type === "board" && upgrades.boardLevel >= config.levels.length - 1) return;
  if (type === "foodType" && upgrades.foodTypeLevel >= config.levels.length - 1) return;

  if (!session) return;
  const now = Date.now();
  const { snapshot, events } = session.dispatch({ type: "buyUpgrade", upgrade: type });
  if (events.some((event) => event.type === "actionRejected")) return;
  latestSnapshot = snapshot;
  seedsTotal = snapshot.seeds;
  sessionLastSeeds = seedsTotal;
  best = snapshot.best;
  sessionLastBest = best;
  mirrorEconomyFromWorld(now, snapshot);
  sessionLastUpgradesJson = JSON.stringify(upgrades);
  saveSeeds();
  saveUpgrades();

  if (type === "board") {
    grid = parseGridSize(config.levels[upgrades.boardLevel]);
    freshGame();
  } else if (type === "foodCount") {
    freshGame();
  } else {
    syncHud();
    render();
  }
  syncPanels();
}

function setActiveBoardLevel(level) {
  const nextLevel = Number(level);
  if (!Number.isInteger(nextLevel) || nextLevel < 0 || nextLevel > upgrades.boardLevel) return;

  if (!session) return;
  const { snapshot, events } = session.dispatch({ type: "selectBoard", level: nextLevel });
  if (events.some((event) => event.type === "actionRejected")) return;
  latestSnapshot = snapshot;
  mirrorEconomyFromWorld(Date.now(), snapshot);
  grid = parseGridSize(upgradeConfig.board.levels[selectedBoardLevel]);
  freshGame();
  syncPanels();
}

const numberFormatCache = new Map();
const compactNumberSuffixes = ["", "k", "M", "B", "T", "Q"];

function getNumberFormat(maximumFractionDigits) {
  let formatter = numberFormatCache.get(maximumFractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits
    });
    numberFormatCache.set(maximumFractionDigits, formatter);
  }
  return formatter;
}

// Keep UI values readable without hiding their scale. Compact units cover through
// quadrillions; larger values use scientific notation. The displayed mantissa
// never has more than five significant digits.
function formatCompactNumber(value, maximumFractionDigits = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(number);

  const absolute = Math.abs(number);
  if (absolute === 0) return "0";

  let suffixIndex = absolute >= 100000 ? Math.floor(Math.log10(absolute) / 3) : 0;
  if (suffixIndex >= compactNumberSuffixes.length) {
    return number.toExponential(4);
  }

  let scaled = number / (1000 ** suffixIndex);
  let integerDigits = Math.max(1, Math.floor(Math.log10(Math.abs(scaled))) + 1);
  let fractionDigits = Math.min(maximumFractionDigits, Math.max(0, 5 - integerDigits));
  scaled = Number(scaled.toFixed(fractionDigits));

  // Rounding at a unit boundary (for example 99,999.9) belongs in the next unit.
  if (Math.abs(scaled) >= (suffixIndex === 0 ? 100000 : 1000)
      && suffixIndex < compactNumberSuffixes.length - 1) {
    suffixIndex += 1;
    scaled = number / (1000 ** suffixIndex);
    integerDigits = Math.max(1, Math.floor(Math.log10(Math.abs(scaled))) + 1);
    fractionDigits = Math.min(maximumFractionDigits, Math.max(0, 5 - integerDigits));
    scaled = Number(scaled.toFixed(fractionDigits));
  }

  if (suffixIndex === compactNumberSuffixes.length - 1 && Math.abs(scaled) >= 1000) {
    return number.toExponential(4);
  }

  return `${getNumberFormat(fractionDigits).format(scaled)}${compactNumberSuffixes[suffixIndex]}`;
}

function formatNumber(value) {
  return formatCompactNumber(value);
}

function formatWholeNumber(value) {
  return formatCompactNumber(Math.floor(Math.max(0, Number(value) || 0)), 0);
}

function formatProvisions(value) {
  const floored = Math.floor(Math.max(0, Number(value) || 0) * 10) / 10;
  return floored.toFixed(1);
}

function formatDecimal(value, maximumFractionDigits = 4) {
  return formatCompactNumber(value, maximumFractionDigits);
}

// Write to a text node only when the value actually changed, so stable HUD
// fields don't trigger style/layout invalidation every animation frame.
function setText(el, value) {
  if (!el) return;
  const next = String(value);
  if (el.textContent !== next) el.textContent = next;
}

function showOverlay(text) {
  stateText.textContent = text;
  overlay.classList.add("visible");
}

function hideOverlay() {
  overlay.classList.remove("visible");
}

function setScreenHint(text) {
  if (!screenHint) return;
  screenHint.textContent = text;
  screenHint.classList.toggle("is-visible", Boolean(text));
}

function setMenuTab(activeTab) {
  const requestedTab = [...menuTabs].find((tab) => tab.dataset.menuTab === activeTab);
  if (requestedTab?.disabled) activeTab = "migration";
  menuTabs.forEach((tab) => {
    const isActive = tab.dataset.menuTab === activeTab;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  menuPanels.forEach((panel) => {
    panel.hidden = panel.dataset.menuPanel !== activeTab;
  });
  // The top-level Colony tab is an explicit return to the Colony overview;
  // Notables remains a sub-screen reached from its dedicated button.
  if (activeTab === "colony") showColonyOverview();
  if (activeTab === "migration") showSettleOverview();
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    event.preventDefault();
    returnToRegularSnake();
    return;
  }

  if (event.code === "KeyG" && event.shiftKey) {
    event.preventDefault();
    grantMinigameFunds();
    return;
  }

  if (event.code === "KeyH" && event.shiftKey) {
    event.preventDefault();
    if (!event.repeat) grantAdultSnakes();
    return;
  }

  if (event.code === "KeyN" && event.shiftKey) {
    event.preventDefault();
    if (!event.repeat) {
      setMenuTab("colony");
      commitNotableAction({ type: "generateNotable", sourceType: "DEV_CODE", sourceReference: "Shift+N" });
      showNotablesMenu();
    }
    return;
  }

  if (event.code === "KeyR" && gameMode === "battleship" && battleship?.phase === "placement") {
    event.preventDefault();
    if (!event.repeat) battleshipRotate();
    return;
  }

  if (keyMap[event.code]) {
    event.preventDefault();
    const directionName = keyMap[event.code];
    queueDirection(directionName);
    if (!event.repeat) {
      activeDirectionKeys.add(event.code);
      updateDirectionButtonPressed(directionName);
    }
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (gameMode === "runner") {
      if (!event.repeat) runnerJump();
      return;
    }
    togglePause();
  }

  if (event.code === "Enter") {
    event.preventDefault();
    startGame();
  }
});

document.addEventListener("keyup", (event) => {
  if (keyMap[event.code]) {
    event.preventDefault();
    activeDirectionKeys.delete(event.code);
    const directionName = keyMap[event.code];
    updateDirectionButtonPressed(directionName);
  }

  if (gameMode === "centipede" && centipede) {
    const released = keyMap[event.code];
    if (released === "left" || released === "right") centipede.player.inputX = 0;
    else if (released === "up" || released === "down") centipede.player.inputY = 0;
    return;
  }

  if (gameMode !== "breakout" || !breakout) return;
  if (event.code === "ArrowLeft" || event.code === "KeyA" || event.code === "ArrowRight" || event.code === "KeyD") {
    breakout.paddle.input = 0;
  }
});

window.addEventListener("blur", () => {
  activeDirectionKeys.clear();
  activeDirectionClicks.clear();
  directionPointerStarts.clear();
  directionClickTimers.forEach((timer) => clearTimeout(timer));
  directionClickTimers.clear();
  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.classList.remove("is-pressed");
  });
  if (gameMode === "centipede" && centipede) { centipede.player.inputX = 0; centipede.player.inputY = 0; }
  flushPendingSaves();
});

document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    queueDirection(button.dataset.direction);
    directionPointerStarts.set(event.pointerId, {
      directionName: button.dataset.direction,
      startedAt: performance.now()
    });
  });
  button.addEventListener("pointerup", () => {
    if (gameMode === "breakout" && breakout) breakout.paddle.input = 0;
    if (gameMode === "centipede" && centipede) { centipede.player.inputX = 0; centipede.player.inputY = 0; }
  });
  button.addEventListener("pointercancel", (event) => {
    directionPointerStarts.delete(event.pointerId);
    if (gameMode === "breakout" && breakout) breakout.paddle.input = 0;
    if (gameMode === "centipede" && centipede) { centipede.player.inputX = 0; centipede.player.inputY = 0; }
  });
});
document.addEventListener("pointerup", (event) => {
  const pointerStart = directionPointerStarts.get(event.pointerId);
  if (pointerStart) {
    directionPointerStarts.delete(event.pointerId);
    animateDirectionClick(pointerStart.directionName, performance.now() - pointerStart.startedAt);
  }

  if (gameMode === "breakout" && breakout) breakout.paddle.input = 0;
  if (gameMode === "centipede" && centipede) { centipede.player.inputX = 0; centipede.player.inputY = 0; }
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", resetGame);

// Battleship supports pointer play: click your nest to place a snake during
// setup, click enemy waters to launch a venom strike on your turn.
canvas.addEventListener("click", (event) => {
  if (gameMode !== "battleship" || !battleship) return;
  const cell = battleshipCellFromEvent(event);
  if (!cell) return;
  if (battleship.phase === "placement" && cell.board === "player") {
    battleshipPlaceAt(cell.x, cell.y);
  } else if (battleship.phase === "placement" && cell.board === "enemy" && !battleshipCurrentDef()) {
    battleshipBeginBattle();
  } else if (battleship.phase === "playing" && battleship.turn === "player" && cell.board === "enemy") {
    battleship.target = { x: cell.x, y: cell.y };
    battleshipFire();
  }
});
personalizationBackButton.addEventListener("click", hidePersonalization);
openSaveDataButton.addEventListener("click", showSaveData);
saveDataBackButton.addEventListener("click", hideSaveData);
copySaveDataButton.addEventListener("click", copySaveData);
importSaveDataButton.addEventListener("click", importSaveData);
buildColorChoices(bodyColorChoices, "body");
buildColorChoices(headColorChoices, "head");
syncColorChoices();

const RESET_HOLD_MS = 900;
resetProgressButton?.style.setProperty("--reset-hold-ms", `${RESET_HOLD_MS}ms`);
let resetHoldTimer = null;
function cancelResetHold() {
  if (resetHoldTimer !== null) { clearTimeout(resetHoldTimer); resetHoldTimer = null; }
  resetProgressButton?.classList.remove("is-holding");
  if (resetProgressFill) {
    resetProgressFill.style.transition = "none";
    resetProgressFill.style.width = "0%";
    void resetProgressFill.offsetWidth;
    resetProgressFill.style.transition = "";
  }
}
function startResetHold() {
  if (resetHoldTimer !== null) return;
  resetProgressButton?.classList.add("is-holding");
  if (resetProgressFill) resetProgressFill.style.width = "100%";
  resetHoldTimer = setTimeout(() => {
    resetHoldTimer = null;
    resetProgressButton?.classList.remove("is-holding");
    // Fully wipe progress. Shut down every persistence path first, otherwise the
    // running game loop (or the pagehide flush that fires during reload) would
    // re-write the current in-memory seeds/upgrades right after we clear them.
    resettingProgress = true;
    if (animationId) cancelAnimationFrame(animationId);
    if (saveFlushTimer !== null) { clearTimeout(saveFlushTimer); saveFlushTimer = null; }
    pendingSaveProducers.clear();
    localStorage.removeItem(consolidatedSaveKey);
    saveKeysLegacyList.forEach((key) => {
      localStorage.removeItem(`${savePrefix}${key}`);
      localStorage.removeItem(`${legacySavePrefix}${key}`);
    });
    location.reload();
  }, RESET_HOLD_MS);
}
resetProgressButton?.addEventListener("pointerdown", (event) => { event.preventDefault(); startResetHold(); });
["pointerup", "pointerleave", "pointercancel"].forEach((type) => resetProgressButton?.addEventListener(type, cancelResetHold));
menuTabs.forEach((tab) => {
  tab.addEventListener("click", () => setMenuTab(tab.dataset.menuTab));
});

function commitMigrationAction(action) {
  if (!session) return null;
  const result = session.dispatch({ ...action, now: Date.now() });
  latestSnapshot = result.snapshot;
  mirrorEconomyFromWorld(Date.now(), result.snapshot);
  const rejected = result.events.find((item) => item.type === "actionRejected");
  if (rejected) setText(migrationErrorEl, rejected.reason.replace(/([A-Z])/g, " $1").toLowerCase());
  else setText(migrationErrorEl, "");
  interpretSessionEvents(result.events);
  syncHud(); syncPanels(); persistConsolidatedSave();
  return result;
}

function commitTradeAction(action) {
  const result = commitMigrationAction(action); if (!result) return null;
  const rejected = result.events.find((item) => item.type === "actionRejected");
  setText(tradeRouteErrorEl, rejected ? rejected.reason.replace(/([A-Z])/g, " $1").toLowerCase() : "");
  if (rejected) setText(migrationErrorEl, "");
  return result;
}

activeSettlementSelectEl?.addEventListener("change", () => {
  const result = commitMigrationAction({ type: "selectSettlement", settlementId: activeSettlementSelectEl.value });
  if (!result || result.events.some((item) => item.type === "actionRejected")) return;
  freshGame(); setMenuTab("migration"); setScreenHint(`Now managing ${activeSettlementSelectEl.selectedOptions[0]?.textContent || "settlement"}.`);
});

migrationDepartEl?.addEventListener("click", () => {
  const result = commitMigrationAction({ type: "startMigration", originSettlementId: "grasslands", destination: migrationDestinationEl.value, notableId: migrationNotableEl.value, manifest: migrationManifestFromInputs() });
  if (result && !result.events.some((item) => item.type === "actionRejected")) setScreenHint("Expedition departed. Migration Points and cargo are permanently committed.");
});

[migrationDestinationEl, migrationNotableEl, migrationAdultsEl, migrationEggsEl, migrationSeedsEl, migrationBranchesEl, migrationProvisionsEl].forEach((control) => {
  control?.addEventListener("input", syncMigrationPanel);
  control?.addEventListener("change", syncMigrationPanel);
});

tradeButtonEl?.addEventListener("click", showTradePanel);
closeTradeButtonEl?.addEventListener("click", showSettleOverview);

[tradeSettlementAEl, tradeSettlementBEl].forEach((control) => control?.addEventListener("change", () => syncTradeRoutesPanel(latestSnapshot.migration)));
createTradeRouteButtonEl?.addEventListener("click", () => {
  const result = commitTradeAction({ type: "createTradeRoute", settlementAId: tradeSettlementAEl.value, settlementBId: tradeSettlementBEl.value });
  const created = result?.events.find((item) => item.type === "tradeRouteCreated"); if (created) { selectedTradeRouteId = created.routeId; syncTradeRoutesPanel(result.snapshot.migration); setScreenHint("Permanent trade route constructed."); }
});
tradeRouteNetworkEl?.addEventListener("click", (event) => { const routeId = event.target.dataset.routeId; if (!routeId) return; selectedTradeRouteId = routeId; syncTradeRoutesPanel(latestSnapshot.migration); });
tradeRouteManagementEl?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-trade-action]"); if (!button || !selectedTradeRouteId) return;
  const action = button.dataset.tradeAction; const direction = button.dataset.direction;
  if (action === "route-pause") commitTradeAction({ type: "setTradeRoutePaused", routeId: selectedTradeRouteId, isPaused: button.dataset.paused === "true" });
  if (action === "direction-pause") commitTradeAction({ type: "setTradeDirectionPaused", routeId: selectedTradeRouteId, direction, isPaused: button.dataset.paused === "true" });
  if (action === "workers") {
    const route = latestSnapshot.tradeRoutes.find((item) => item.id === selectedTradeRouteId); const lane = direction === "AToB" ? route?.directionAToB : route?.directionBToA;
    commitTradeAction({ type: "setTradeWorkers", routeId: selectedTradeRouteId, direction, workersAssigned: (lane?.workersAssigned || 0) + Number(button.dataset.delta) });
  }
  if (action === "upgrade") commitTradeAction({ type: "purchaseTradeUpgrade", routeId: selectedTradeRouteId, direction, upgradeType: button.dataset.upgradeType });
  if (action === "configure") {
    const card = button.closest("[data-trade-direction]");
    commitTradeAction({ type: "configureTradeDirection", routeId: selectedTradeRouteId, direction,
      resourceType: card.querySelector('[data-trade-field="resourceType"]').value,
      shipmentTarget: Number(card.querySelector('[data-trade-field="shipmentTarget"]').value),
      reserveThreshold: Number(card.querySelector('[data-trade-field="reserveThreshold"]').value) });
  }
  if (action === "resupply") {
    const card = button.closest("[data-trade-direction]"); const notableIds = [...card.querySelector('[data-resupply-field="notables"]').selectedOptions].map((item) => item.value);
    const adultCount = Number(card.querySelector('[data-resupply-field="adults"]').value); const eggCount = Number(card.querySelector('[data-resupply-field="eggs"]').value); const route = latestSnapshot.tradeRoutes.find((item) => item.id === selectedTradeRouteId); const lane = direction === "AToB" ? route?.directionAToB : route?.directionBToA; const resupplyApi = window.IdleSnakeResupply;
    const base = resupplyApi.baseProvisionRequirement(notableIds.length, adultCount, eggCount); const discount = resupplyApi.routeDiscount(lane); const cost = resupplyApi.provisionRequirement(notableIds.length, adultCount, eggCount, lane); const duration = resupplyApi.travelDuration(lane);
    if (!confirm(`Send ${notableIds.length} Notables, ${adultCount} adults, and ${eggCount} eggs?\n\nBase Provisions: ${formatWholeNumber(base)}\nRoute Discount: ${formatDecimal(discount * 100, 0)}%\nFinal Provisions: ${formatWholeNumber(cost)}\nWorkers: ${lane.workersAssigned}\nTravel Time: ${formatDuration(duration)}`)) return;
    const result = commitTradeAction({ type: "dispatchResupply", routeId: selectedTradeRouteId, direction, notableIds, adultCount, eggCount }); if (result && !result.events.some((item) => item.type === "actionRejected")) setScreenHint("Re-Supply mission departed safely. Its direction is locked until arrival.");
  }
  if (action === "dismantle" && confirm("Dismantle this permanent route? Assigned workers will return, but construction and upgrade costs will not be refunded.")) {
    commitTradeAction({ type: "dismantleTradeRoute", routeId: selectedTradeRouteId }); selectedTradeRouteId = null;
  }
});

activeExpeditionsEl?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-migration-action]"); const card = button?.closest("[data-expedition-id]"); if (!button || !card) return;
  const expeditionId = card.dataset.expeditionId; const action = button.dataset.migrationAction;
  if (action === "resolve") commitMigrationAction({ type: "resolveMigrationStop", expeditionId, optionId: button.dataset.value });
  if (action === "skip") commitMigrationAction({ type: "skipMigrationChallenge", expeditionId });
  if (action === "return") commitMigrationAction({ type: "returnMigration", expeditionId });
  if (action === "challenge") {
    const result = commitMigrationAction({ type: "beginMigrationChallenge", expeditionId });
    if (!result || result.events.some((item) => item.type === "actionRejected")) return;
    gameMode = "snake"; state = "running"; latestSnapshot = result.snapshot; mirrorSnakeFromSnapshot(result.snapshot); previousSnake = snake.map((part) => ({ ...part })); lastFrameAt = performance.now(); timerStarted = true; hideOverlay(); setScreenHint(`Seed Trial: collect ${result.snapshot.migrationChallenge.requiredSeeds} Seeds before collision.`); render();
  }
});
boardSizeSelect.addEventListener("change", () => {
  setActiveBoardLevel(boardSizeSelect.value);
});
duelGridSelect?.addEventListener("change", () => {
  setDuelGridSize(duelGridSelect.value);
});
broodlineMoveUpButton?.addEventListener("click", () => { if (!broodline || broodline.selected <= 0) return; const index = broodline.selected; [broodline.chain[index - 1], broodline.chain[index]] = [broodline.chain[index], broodline.chain[index - 1]]; broodline.selected -= 1; syncBroodlineFormation(); });
broodlineMoveDownButton?.addEventListener("click", () => { if (!broodline || broodline.selected >= broodline.chain.length - 1) return; const index = broodline.selected; [broodline.chain[index + 1], broodline.chain[index]] = [broodline.chain[index], broodline.chain[index + 1]]; broodline.selected += 1; syncBroodlineFormation(); });
broodlineContinueButton?.addEventListener("click", () => broodlineStartNext());
broodlineEndButton?.addEventListener("click", () => broodlineEndRun("Run ended"));
upgradeButtons.board.addEventListener("click", () => purchaseUpgrade("board"));
upgradeButtons.foodType.addEventListener("click", () => purchaseUpgrade("foodType"));
upgradeButtons.foodCount.addEventListener("click", () => purchaseUpgrade("foodCount"));
upgradeButtons.shield.addEventListener("click", () => purchaseUpgrade("shield"));
upgradeButtons.minigames.addEventListener("click", () => purchaseUpgrade("minigames"));
minigameKeys.forEach((key) => {
  key.addEventListener("click", () => {
    const gameNumber = Number(key.dataset.minigame);
    if (gameNumber === 9 && gameMode === "duel") {
      launchRunner();
      return;
    }
    if (gameNumber === 0) {
      if (!personalizationScreen.hidden || gameMode === "duel" || gameMode === "maze" || gameMode === "breakout" || gameMode === "runner" || gameMode === "crossing" || gameMode === "snakebird" || gameMode === "sokoban" || gameMode === "broodline" || gameMode === "battleship" || gameMode === "centipede") {
        returnToRegularSnake();
      } else {
        showPersonalization();
      }
      return;
    }
    const unlocked = gameNumber === 0 ? upgrades.minigamesLevel >= 10 : gameNumber <= upgrades.minigamesLevel;
    if (!unlocked) return;
    if (gameNumber === 1) launchVsSnake();
    else if (gameNumber === 2) launchMaze();
    else if (gameNumber === 3) launchBreakout();
    else if (gameNumber === 4) launchCrossing();
    else if (gameNumber === 5) launchSnakebird();
    else if (gameNumber === 6) launchSokoban();
    else if (gameNumber === 7) launchBroodline();
    else if (gameNumber === 8) launchBattleship();
    else if (gameNumber === 9) launchCentipede();
    else showOverlay(`Minigame ${gameNumber} coming soon`);
  });
});

notablesButtonEl?.addEventListener("click", showNotablesMenu);
closeNotablesButtonEl?.addEventListener("click", showColonyOverview);
closeNotablesButtonEl?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  showColonyOverview();
});
recruitNotableButtonEl?.addEventListener("click", () => {
  const cost = window.IdleSnakeConfig.notableConfig.directRecruitmentCost;
  if (confirm(`Sacrifice ${cost} unassigned adult snakes to recruit one Notable?`)) commitNotableAction({ type: "recruitNotable" });
});

buildNurseryGrid();
buildHabitatList();
// Build the session (economy + offline catch-up) FIRST, since freshGame() now
// creates the snake run inside it. Then let gameLoop drive both on one clock.
initIdleWorld();
freshGame();
syncPanels(Date.now());
cancelAnimationFrame(animationId);
animationId = requestAnimationFrame((now) => {
  lastFrameAt = now;
  gameLoop(now);
});
