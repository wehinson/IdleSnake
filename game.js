const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const savePrefix = "snake-forever-";
const legacySavePrefix = "idlesnake-";
const consolidatedSaveKey = `${savePrefix}save`;
const consolidatedBackupKey = `${consolidatedSaveKey}:backup`;
const saveGuard = window.IdleSnakeSaveGuard;
const SAVE_VERSION = saveGuard.CURRENT_VERSION;
const LEGACY_SAVE_VERSION = saveGuard.LEGACY_VERSION;
let startupStorageNotice = "";
let storageWarningShown = false;

function isMobilePhone() {
  if (navigator.userAgentData?.mobile === true) return true;
  return /Android.*Mobile|iPhone|iPod|IEMobile|Windows Phone|Opera Mini/i.test(navigator.userAgent || "");
}

function defaultMobileControls() {
  return { swipeControls: isMobilePhone(), biggerDpad: false };
}

function classifyStorageError(error) {
  return /quota|exceeded/i.test(String(error?.name || "") + String(error?.message || "")) ? "quota" : "unavailable";
}
function storageNotice(kind) {
  return kind === "quota" ? "Storage quota exceeded; progress could not be saved." : "Storage unavailable; progress cannot currently be saved.";
}
function safeStorage(operation, key, value) {
  try { return { ok: true, value: operation === "get" ? localStorage.getItem(key) : (operation === "set" ? localStorage.setItem(key, value) : localStorage.removeItem(key)) }; }
  catch (error) { const kind = classifyStorageError(error); console.warn(`IdleSnake storage ${operation} failed (${kind}).`); return { ok: false, kind }; }
}
function reportStorageFailure(kind, saveDataMessage) {
  const message = storageNotice(kind);
  if (saveDataMessage && saveDataStatus) saveDataStatus.textContent = message;
  else if (!storageWarningShown) { storageWarningShown = true; setScreenHint(message); }
}

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
    saveVersion: LEGACY_SAVE_VERSION,
    savedAt: Date.now(),
    currencies: { seeds: 0, provisions: 0, branches: 0 },
    upgrades: { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 0 },
    board: { selectedBoardLevel: 0, selectedDuelGridSize: 30, mastery: {} },
    records: { best: 0, crossingBest: 0, mazeBest: 0, breakoutBest: 0, runnerBest: 0, sokobanBest: 0, battleshipBest: 0, centipedeBest: 0 },
    settings: { snakeColors: { body: null, head: null }, mobileControls: defaultMobileControls() },
    nursery: { nestStartedAt: null, hatchlings: [], colonyCount: 0, resupplyEggHolding: 0, lastUpdatedAt: Date.now(), seedTickAccumulatorMs: 0, movementAccumulatorMs: 0 },
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

// Legacy-shaped values remain useful to the renderer, but are only a UI
// projection. Canonical V5 state is never flattened for durable storage.
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
      mastery: Object.fromEntries(window.IdleSnakeConfig.boardMasteryConfig.map((item) => [item.boardSize, Boolean(state.notables?.masteryRewardsClaimed?.[item.masteryId])]))
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

function loadConsolidatedSave() {
  const primary = safeStorage("get", consolidatedSaveKey);
  if (!primary.ok) { startupStorageNotice = storageNotice(primary.kind); return buildDefaultSaveState(); }
  if (primary.value === null) return buildDefaultSaveState();
  const checked = saveGuard.validateImportText(primary.value);
  if (checked.ok) return checked.value;
  const backup = safeStorage("get", consolidatedBackupKey);
  if (backup.ok && backup.value !== null) {
    const recovered = saveGuard.validateImportText(backup.value);
    if (recovered.ok) { startupStorageNotice = "Backup save recovered."; safeStorage("set", consolidatedSaveKey, backup.value); return recovered.value; }
  }
  startupStorageNotice = "Stored progress could not be recovered.";
  return buildDefaultSaveState();
}

// One-time migration from the old per-key localStorage scheme into the
// consolidated save object. No-ops (and is safe to call unconditionally)
// once the consolidated key exists. Reads through both the current and
// legacy key prefixes so a browser that never got migrated under the old
// idlesnake- -> snake-forever- prefix rename still recovers its data.
function migrateLegacySaveIfNeeded() {
  const primary = safeStorage("get", consolidatedSaveKey);
  if (!primary.ok) { startupStorageNotice = storageNotice(primary.kind); return false; }
  if (primary.value !== null) return false;

  const legacyRead = (key) => {
    const current = safeStorage("get", `${savePrefix}${key}`);
    if (!current.ok) return null;
    if (current.value !== null) return current.value;
    const legacy = safeStorage("get", `${legacySavePrefix}${key}`);
    return legacy.ok ? legacy.value : null;
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
  const migratedSession = window.IdleSnakeSession.createGameSession({ save: migrated, now: Date.now(), rng: Math.random, mobileControlsDefault: defaultMobileControls() });
  const envelope = migratedSession.serialize();
  const written = safeStorage("set", consolidatedSaveKey, JSON.stringify(envelope));
  if (!written.ok) startupStorageNotice = storageNotice(written.kind);
  return envelope;
}

const migratedSaveEnvelope = migrateLegacySaveIfNeeded();
let loadedSaveEnvelope = migratedSaveEnvelope || loadConsolidatedSave();
let consolidatedSave = projectSaveForUi(loadedSaveEnvelope);

function getSaveItem(key) {
  const path = legacyKeyPaths[key];
  if (!path) return null;
  const value = path.reduce((obj, segment) => (obj === undefined || obj === null ? undefined : obj[segment]), consolidatedSave);
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function setSaveItem(key, value) {
  // Kept as a compatibility seam for UI call sites. Feature-specific values
  // are already committed through session actions; persistence serializes the
  // session and never reconstructs a save from key/value mirrors.
  void key;
  void value;
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
  for (const [key, producer] of pendingSaveProducers) {
    try {
      const value = producer();
      const previous = safeStorage("get", key);
      if (!previous.ok) { reportStorageFailure(previous.kind); return; }
      if (previous.value !== null && saveGuard.validateImportText(previous.value).ok) {
        const backedUp = safeStorage("set", `${key}:backup`, previous.value);
        if (!backedUp.ok) { reportStorageFailure(backedUp.kind); return; }
      }
      const written = safeStorage("set", key, value);
      if (!written.ok) { reportStorageFailure(written.kind); return; }
      pendingSaveProducers.delete(key);
      storageWarningShown = false;
    } catch (error) { console.warn("IdleSnake save flush failed.", error); setScreenHint("Progress could not be saved."); return; }
  }
}

function queueSave(key, producer) {
  if (resettingProgress) return;
  pendingSaveProducers.set(key, producer);
  scheduleSaveFlush();
}

function persistConsolidatedSave() {
  // Stamp savedAt at flush time so the engine's offline catch-up on next load
  // measures from the last real persist.
  queueSave(consolidatedSaveKey, () => {
    return JSON.stringify(session.serialize());
  });
}

function saveSeeds() {
  setSaveItem("seeds", String(seedsTotal));
}

function saveProvisions() {
  persistConsolidatedSave();
}

function saveBranches() {
  persistConsolidatedSave();
}

window.addEventListener("pagehide", flushPendingSaves);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPendingSaves();
});

const snakebirdEngine = window.SnakebirdEngine;
const scoreEl = document.querySelector("#score");
const timerEl = document.querySelector("#timer");
const gridLabelEl = document.querySelector("#gridLabel");
const duelGridSelect = document.querySelector("#duelGridSelect");
const bestEl = document.querySelector("#best");
const seedsTotalEl = document.querySelector("#seedsTotal");
const overlay = document.querySelector("#overlay");
const stateText = document.querySelector("#stateText");
const readyStartPrompt = document.querySelector("#readyStartPrompt");
const screenHint = document.querySelector("#screenHint");
const gameStatus = document.querySelector("#gameStatus");
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
const reducedMotionButton = document.querySelector("#reducedMotionButton");
const swipeControlsButton = document.querySelector("#swipeControlsButton");
const biggerDpadButton = document.querySelector("#biggerDpadButton");
const controlsEl = document.querySelector(".controls");
const phoneNavEl = document.querySelector(".phone-nav");
const minigameKeypadEl = document.querySelector("#minigameKeypad");
const minimizedKeypadButton = document.querySelector("#minimizedKeypadButton");
const largeDpadPersonalizeButton = document.querySelector("#largeDpadPersonalizeButton");
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
const { gameplaySpeed, upgradeConfig, snakeConfig, nurseryConfig, habitatConfig } = window.IdleSnakeConfig;
const slowedTick = (milliseconds) => Math.round(milliseconds / gameplaySpeed);
const { startTickMs, minTickMs } = snakeConfig;
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
let crumbAnimations = [];
let deathAnimation = null;
let runSeedsEarned = 0;
let foods;
let direction;
let nextDirection;
let directionQueue;
const activeDirectionKeys = new Set();
const activeDirectionClicks = new Set();
const directionPointerStarts = new Map();
const swipePointerStarts = new Map();
const directionClickTimers = new Map();
const minimumDirectionClickMs = 230;
let score;
let state;
let tickMs;
let elapsedMs;
let lastFrameAt;
let timerStarted;
let animationId;
let deathOverlayTimer = null;
// The session is authoritative for Snake and the economy. The browser mirrors
// snapshots only for rendering and existing UI state.
let session = null;
let latestSnapshot = null;
let latestFrameSnapshot = null;
let idleLastWallAt = null;
let idleLastPersistAt = 0;
let boardMetrics;
let nursery = readNursery();
let habitats = readHabitats();
let notablesState = window.IdleSnakeNotables.createState(consolidatedSave.notables);
let nurseryCells = [];
let habitatCardRefs = [];
let gameMode = "snake";
const sessionOwnedModes = new Set(["snake", "snakebird", "sokoban", "runner", "duel", "maze", "crossing", "breakout", "centipede", "broodline", "battleship"]);
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
let mazeScore;
let mazeBest = Number(getSaveItem("maze-best") || 0);
const mazeGrid = { columns: 21, rows: 21 };
const mazeTickMs = window.IdleSnakeMaze.TICK_MS;
const crossingGrid = { columns: 15, rows: 13 };
const crossingTickMs = slowedTick(82);
let crossingStage;
let crossingScore;
let crossingSnake;
let previousCrossingSnake;
let crossingCars;
let crossingPhase;
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
let broodline;
const broodlineGrid = { columns: 30, rows: 30 };
const broodlineTickMs = window.IdleSnakeBroodline.TICK_MS;
const broodlineView = 10;          // visible cells across the (30x30) world
const broodlineWavesPerRound = 5;  // each round clears 5 waves -> ~5x longer
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

// The session serializer is the single durable producer for storage, export,
// backup, rollback, and import finalization.
function gatherSaveState() {
  return session.serialize();
}

// Refresh every legacy browser variable from an immutable session snapshot.
// These values exist for rendering only and never feed durable reconstruction.
function applySessionSnapshot(snapshot, savedAt = Date.now()) {
  consolidatedSave = projectSaveForUi({ saveVersion: SAVE_VERSION, savedAt, session: snapshot });
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
  battleshipBest = Number(getSaveItem("battleship-best") || 0);
  if (!Number.isFinite(battleshipBest)) battleshipBest = 0;
  selectedDuelGridSize = readDuelGridSize();
  duelGrid = squareGrid(selectedDuelGridSize);
  snakebirdProgress = readSnakebirdProgress();
  syncAccessibilityPreference();
  syncMobileControlPreferences();
  syncHud();
  syncColorChoices();
  buildNurseryGrid();
  buildHabitatList();
  renderNotables();
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
  crumbAnimations = [];
  deathAnimation = null;
  runSeedsEarned = 0;
  clearTimeout(deathOverlayTimer);
  deathOverlayTimer = null;
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
  if (session) {
    const result = session.dispatch({ type: "setCosmetics", cosmetics: { ...snakeColors } });
    latestSnapshot = result.snapshot;
  }
  persistConsolidatedSave();
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

function syncLargeDpadPersonalizeButton() {
  if (!largeDpadPersonalizeButton) return;
  const personalizationOpen = !personalizationScreen.hidden || !saveDataScreen.hidden;
  largeDpadPersonalizeButton.textContent = personalizationOpen ? "Back" : "Personalize";
  largeDpadPersonalizeButton.setAttribute("aria-label", personalizationOpen ? "Back to game" : "Personalize");
}

function showPersonalization() {
  hideSnakebirdPicker();
  saveDataScreen.hidden = true;
  personalizationScreen.hidden = false;
  overlay.classList.remove("visible");
  syncColorChoices();
  syncAccessibilityPreference();
  syncLargeDpadPersonalizeButton();
}

function hidePersonalization() {
  personalizationScreen.hidden = true;
  syncLargeDpadPersonalizeButton();
}

function showSaveData() {
  saveDataExportArea.value = JSON.stringify(gatherSaveState(), null, 2);
  saveDataImportArea.value = "";
  saveDataStatus.textContent = "";
  saveDataScreen.hidden = false;
  personalizationScreen.hidden = true;
  syncLargeDpadPersonalizeButton();
}

function hideSaveData() {
  saveDataScreen.hidden = true;
  personalizationScreen.hidden = false;
  syncLargeDpadPersonalizeButton();
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
  const checked = saveGuard.validateImportText(saveDataImportArea.value);
  if (!checked.ok) { saveDataStatus.textContent = checked.message; return; }
  const candidate = checked.value;
  // Dry-run the exact session hydrator before changing memory or storage.
  try {
    window.IdleSnakeSession.createGameSession({ save: candidate, now: Date.now(), rng: Math.random, mobileControlsDefault: defaultMobileControls() });
  } catch (error) {
    console.warn("IdleSnake import hydration failed.", error);
    saveDataStatus.textContent = "Import failed: save could not be loaded.";
    return;
  }
  const previousLive = gatherSaveState();
  const primary = safeStorage("get", consolidatedSaveKey);
  if (!primary.ok) { reportStorageFailure(primary.kind, true); return; }
  let importedSession;
  let importedSnapshot;
  let canonicalCandidate;
  try {
    const now = Date.now();
    importedSession = window.IdleSnakeSession.createGameSession({ save: candidate, now, rng: Math.random, mobileControlsDefault: defaultMobileControls() });
    // Offline catch-up belongs to the live hydrated candidate and runs once.
    importedSnapshot = importedSession.advanceOffline(now).snapshot;
    canonicalCandidate = importedSession.serialize();
  } catch (error) {
    console.warn("IdleSnake import hydration failed.", error);
    saveDataStatus.textContent = "Import failed: save could not be loaded.";
    return;
  }
  // Never replace a known-good backup with malformed primary content.
  if (primary.value !== null && saveGuard.validateImportText(primary.value).ok) {
    const backedUp = safeStorage("set", consolidatedBackupKey, primary.value);
    if (!backedUp.ok) { reportStorageFailure(backedUp.kind, true); return; }
  }
  const serialized = JSON.stringify(canonicalCandidate);
  const written = safeStorage("set", consolidatedSaveKey, serialized);
  if (!written.ok) { reportStorageFailure(written.kind, true); return; }
  try {
    session = importedSession;
    loadedSaveEnvelope = canonicalCandidate;
    latestSnapshot = importedSnapshot;
    applySessionSnapshot(importedSnapshot, canonicalCandidate.savedAt);
    initializeSessionClocks(importedSnapshot);
    freshGame();
    const finalized = safeStorage("set", consolidatedSaveKey, JSON.stringify(gatherSaveState()));
    if (!finalized.ok) throw Object.assign(new Error("storage finalization failed"), { storageKind: finalized.kind });
  } catch (error) {
    console.warn("IdleSnake import apply failed; rolling back.", error);
    if (primary.value === null) safeStorage("remove", consolidatedSaveKey);
    else safeStorage("set", consolidatedSaveKey, primary.value);
    try {
      session = window.IdleSnakeSession.createGameSession({ save: previousLive, now: Date.now(), rng: Math.random, mobileControlsDefault: defaultMobileControls() });
      latestSnapshot = session.snapshot();
      applySessionSnapshot(latestSnapshot, previousLive.savedAt);
      initializeSessionClocks(latestSnapshot);
      freshGame();
    } catch (restoreError) { console.warn("IdleSnake live rollback failed.", restoreError); }
    if (error.storageKind) reportStorageFailure(error.storageKind, true);
    else saveDataStatus.textContent = "Import safely rolled back.";
    return;
  }
  saveDataExportArea.value = JSON.stringify(gatherSaveState(), null, 2);
  saveDataStatus.textContent = "Import successful.";
}

function savedReducedMotion() {
  return Boolean((session ? session.snapshot() : latestSnapshot)?.reducedMotion ?? consolidatedSave?.accessibility?.reducedMotion);
}

function effectiveReducedMotion() {
  return savedReducedMotion() || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function syncAccessibilityPreference() {
  const enabled = savedReducedMotion();
  document.documentElement.dataset.reducedMotion = String(enabled);
  if (reducedMotionButton) {
    reducedMotionButton.setAttribute("aria-pressed", String(enabled));
    reducedMotionButton.textContent = `Reduced motion: ${enabled ? "On" : "Off"}`;
  }
}

function toggleReducedMotion() {
  if (!session) return;
  const result = session.dispatch({ type: "setReducedMotion", reducedMotion: !savedReducedMotion() });
  latestSnapshot = result.snapshot;
  persistConsolidatedSave();
  syncAccessibilityPreference();
  render();
}

function savedMobileControls() {
  const fallback = defaultMobileControls();
  const controls = (session ? session.snapshot() : latestSnapshot)?.mobileControls ?? consolidatedSave?.settings?.mobileControls;
  return {
    swipeControls: typeof controls?.swipeControls === "boolean" ? controls.swipeControls : fallback.swipeControls,
    biggerDpad: typeof controls?.biggerDpad === "boolean" ? controls.biggerDpad : fallback.biggerDpad
  };
}

function syncMobileControlPreferences() {
  const controls = savedMobileControls();
  phoneNavEl?.classList.toggle("is-large-dpad", controls.biggerDpad);
  controlsEl?.classList.toggle("is-large-dpad-controls", controls.biggerDpad);
  syncPrimaryActionButton();
  if (!controls.biggerDpad) {
    minigameKeypadEl?.classList.remove("is-open");
    minimizedKeypadButton?.setAttribute("aria-expanded", "false");
  }
  if (swipeControlsButton) {
    swipeControlsButton.setAttribute("aria-pressed", String(controls.swipeControls));
    swipeControlsButton.textContent = `Swipe Controls: ${controls.swipeControls ? "On" : "Off"}`;
  }
  if (biggerDpadButton) {
    biggerDpadButton.setAttribute("aria-pressed", String(controls.biggerDpad));
    biggerDpadButton.textContent = `Bigger D-Pad: ${controls.biggerDpad ? "On" : "Off"}`;
  }
}

function toggleMobileControl(control) {
  if (!session || !["swipeControls", "biggerDpad"].includes(control)) return;
  const current = savedMobileControls();
  const result = session.dispatch({ type: "setMobileControls", mobileControls: { ...current, [control]: !current[control] } });
  if (result.events.some((event) => event.type === "actionRejected")) return;
  latestSnapshot = result.snapshot;
  persistConsolidatedSave();
  syncMobileControlPreferences();
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
  const { snapshot } = session.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition: snakebirdLevels[safeIndex], levelIndex: safeIndex, levelCount: snakebirdLevels.length } });
  latestSnapshot = snapshot;
  latestFrameSnapshot = snapshot;
  projectSnakebirdSnapshot(snapshot);
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

function snakebirdMove(directionName) {
  if (!snakebird || !vectors[directionName]) return false;
  const previousBody = snakebird.body.map((part) => ({ ...part }));
  const result = session.dispatch({ type: "direction", direction: directionName });
  if (result.events.some((event) => event.type === "actionRejected")) return false;
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectSnakebirdSnapshot(result.snapshot);
  direction = directionName;
  nextDirection = directionName;
  previousSnake = previousBody;

  const ended = result.events.find((event) => event.type === "runEnded");
  if (ended) {
    if (ended.won) { saveSeeds(); saveSnakebirdProgress(); showOverlay(`Level ${snakebird.levelIndex + 1} Clear · +${formatNumber(ended.reward)} Seeds`); }
    else showOverlay("Fell");
  }
  syncHud();
  render();
  return true;
}

function sokobanKey(point) {
  return `${point.x},${point.y}`;
}

function loadSokobanLevel(stageIndex) {
  const safeIndex = Math.max(0, Math.min(sokobanLevels.length - 1, stageIndex));
  hideSnakebirdPicker();
  hidePersonalization();
  gameMode = "sokoban";
  const { snapshot } = session.dispatch({ type: "selectMode", mode: "sokoban", setup: { definition: sokobanLevels[safeIndex], grid: sokobanGrid, levelIndex: safeIndex } });
  latestSnapshot = snapshot;
  latestFrameSnapshot = snapshot;
  projectSokobanSnapshot(snapshot);
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

function sokobanIsGoal(point) {
  return sokoban.goals.some((goal) => goal.x === point.x && goal.y === point.y);
}

function sokobanStatusHint() {
  if (!sokoban) return "";
  const solved = sokoban.crates.filter((crate) => sokobanIsGoal(crate)).length;
  const activePlates = sokoban.plates.filter((plate) => sokobanSnakeContains(plate)).length;
  return `Stage ${sokoban.stageIndex + 1} · Move ${sokoban.moves} · ${solved}/${sokoban.crates.length} crates${activePlates ? ` · ${activePlates} plate active` : ""}`;
}

function sokobanMove(directionName) {
  if (!sokoban || !vectors[directionName]) return false;

  const result = session.dispatch({ type: "direction", direction: directionName });
  if (result.events.some((event) => event.type === "actionRejected")) return false;
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectSokobanSnapshot(result.snapshot);

  direction = directionName;
  nextDirection = directionName;
  const ended = result.events.find((event) => event.type === "runEnded");
  if (ended?.won) {
    sokobanBest = Math.max(sokobanBest, ended.score);
    setSaveItem("sokoban-best", String(sokobanBest));
    saveSeeds();
    showOverlay(`Stage ${ended.stageIndex + 1} Clear · +${formatNumber(ended.reward)} Seeds`);
  } else {
    setScreenHint(sokobanStatusHint());
  }
  syncHud();
  render();
  return true;
}

// --- Battleship ("Venom Strike", phone key 8) --------------------------------
// Classic battleship rules on a 10x10 board: the ships are snakes and the bombs
// are venom strikes. The player manually places their fleet (with an 8-to-shuffle
// random helper), then trades one strike per turn with a hunt/target AI. The
// session owns every mutation and reward; this host only dispatches commands,
// projects immutable snapshots, and renders the two grids.

function launchBattleship() {
  hideSnakebirdPicker();
  hidePersonalization();
  if (gameMode === "battleship" && state !== "gameover") {
    // Re-pressing 8 mid-setup reshuffles the player's fleet (the random helper).
    if (battleship && battleship.phase === "placement") battleshipShuffle();
    return;
  }
  gameMode = "battleship";
  grid = { ...battleshipGrid };
  const result = session.dispatch({ type: "selectMode", mode: "battleship" });
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectBattleshipSnapshot(result.snapshot);
  direction = "right";
  nextDirection = "right";
  directionQueue = [];
  timerStarted = false;
  boardMetrics = getBoardMetrics();
  hideOverlay();
  battleshipSetPlacementHint();
  syncHud();
  render();
}

function battleshipCurrentDef() {
  return battleship ? window.IdleSnakeBattleship.FLEET[battleship.placement.index] || null : null;
}

function battleshipSetPlacementHint() {
  const def = battleshipCurrentDef();
  if (def) {
    setScreenHint(`Place the ${def.name} (${def.length}) · arrows move · Pause/R rotate · Start place · 8 shuffle`);
  } else {
    setScreenHint("Fleet ready · Start to begin the battle · 8 to re-shuffle");
  }
}

function battleshipMoveCursor(directionName) {
  if (!battleship || !vectors[directionName]) return false;
  return dispatchBattleship({ type: "direction", direction: directionName });
}

function battleshipRotate() {
  return dispatchBattleship({ type: "battleshipRotate" });
}

function battleshipPlaceCurrent() {
  return dispatchBattleship({ type: "battleshipPlace" });
}

function battleshipPlaceAt(x, y) {
  return dispatchBattleship({ type: "battleshipPlace", x, y });
}

function battleshipShuffle() {
  return dispatchBattleship({ type: "battleshipShuffle" });
}

function battleshipBeginBattle() {
  if (!dispatchBattleship({ type: "battleshipStart" })) return false;
  timerStarted = true;
  lastFrameAt = performance.now();
  stepAccumulatorMs = 0;
  hideOverlay();
  setScreenHint("Aim with arrows · Start (or tap the top grid) to launch a venom strike");
  syncHud();
  render();
  return true;
}

function battleshipFire(x, y) {
  const action = { type: "battleshipFire" };
  if (Number.isInteger(x) && Number.isInteger(y)) Object.assign(action, { x, y });
  return dispatchBattleship(action);
}

function restartBattleship() {
  if (!dispatchBattleship({ type: "restart" })) return false;
  timerStarted = false;
  elapsedMs = 0;
  stepAccumulatorMs = 0;
  hideOverlay();
  battleshipSetPlacementHint();
  syncHud();
  return true;
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
  const result = session.dispatch({ type: "selectMode", mode: "duel", setup: { grid, tickMs: duelTickMs, foodCount: 5 } });
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  duelPlayer = null;
  duelOpponent = null;
  projectDuelSnapshot(result.snapshot);
  duelWinner = null;
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
  const result = session.dispatch({ type: "selectMode", mode: "maze", setup: { grid, tickMs: mazeTickMs } });
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  maze = null;
  mazePath = [];
  previousSnake = [];
  projectMazeSnapshot(result.snapshot);
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
  const result = session.dispatch({ type: "selectMode", mode: "crossing", setup: { grid, tickMs: crossingTickMs } });
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  crossingSnake = null;
  previousCrossingSnake = null;
  crossingCars = null;
  projectCrossingSnapshot(result.snapshot);
  timerStarted = false;
  boardMetrics = getBoardMetrics();
  syncHud();
  render();
  showOverlay("Snakeger · Ready");
  setScreenHint("Arrow keys / D-pad: cross the road");
}

function launchBreakout() {
  hideSnakebirdPicker();
  if (gameMode === "breakout" && state !== "gameover") return;
  gameMode = "breakout";
  grid = { ...breakoutGrid };
  boardMetrics = getBoardMetrics();
  const segmentSize = Math.max(18, Math.floor(boardMetrics.width / 16));
  const gap = Math.max(2, Math.floor(segmentSize * 0.08));
  const result = session.dispatch({
    type: "selectMode",
    mode: "breakout",
    setup: { width: boardMetrics.width, height: boardMetrics.height, segmentSize, gap }
  });
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectBreakoutSnapshot(result.snapshot);
  direction = "right";
  directionQueue = [];
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
  const result = session.dispatch({ type: "selectMode", mode: "runner", setup: { width: boardMetrics.width, height: boardMetrics.height } });
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectRunnerSnapshot(result.snapshot);
  direction = "right";
  directionQueue = [];
  stepAccumulatorMs = 0;
  timerStarted = false;
  syncHud();
  render();
  showOverlay("Snake Runner · Ready");
  setScreenHint("Up / Space: jump · clear the rocks");
}

function runnerJump() {
  if (!runner || state === "gameover") return false;
  const result = session.dispatch({ type: "direction", direction: "up" });
  if (result.events.some((event) => event.type === "actionRejected")) return false;
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectRunnerSnapshot(result.snapshot);
  timerStarted = true;
  hideOverlay();
  return true;
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
  if (!duelGridSizes.includes(nextSize) || !session) return;
  const result = session.dispatch({ type: "setSelectedDuelGridSize", selectedDuelGridSize: nextSize });
  if (result.events.some((event) => event.type === "actionRejected")) return;
  latestSnapshot = result.snapshot;
  selectedDuelGridSize = result.snapshot.selectedDuelGridSize;
  duelGrid = squareGrid(selectedDuelGridSize);
  persistConsolidatedSave();
  if (duelGridSelect) duelGridSelect.value = String(selectedDuelGridSize);
  if (gameMode === "duel") {
    state = "gameover";
    launchVsSnake();
  }
}

function broodlineSpeciesLabel(kind) {
  return ({ garden: "Garden Snake", cave: "Cave Snake", electric: "Electric Snake", lava: "Lava Snake", rattle: "Rattle Snake", body: "Body segment", egg: "Egg" })[kind] || kind;
}
function launchBroodline() {
  gameMode = "broodline";
  grid = { ...broodlineGrid };
  tickMs = broodlineTickMs;
  const result = session.dispatch({ type: "selectMode", mode: "broodline", setup: { grid } });
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectBroodlineSnapshot(result.snapshot);
  stepAccumulatorMs = 0;
  timerStarted = false;
  hideBroodlineFormation();
  syncBroodlineFormation();
  syncHud();
  showOverlay("Broodline · Round 1");
  setScreenHint("Steer · attacks are automatic");
}
function showBroodlineFormation() { syncBroodlineFormation(); broodlineScreen.hidden = false; broodlineFormationStatusEl.textContent = `Round ${broodline.round} clear · ${broodline.pendingSeeds} Seeds pending`; setScreenHint("Arrange the chain, then continue"); }
function hideBroodlineFormation() { if (broodlineScreen) broodlineScreen.hidden = true; }
function dispatchBroodlineFormation(action) {
  const result = session.dispatch(action);
  if (result.events.some((event) => event.type === "actionRejected")) return false;
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectBroodlineSnapshot(result.snapshot);
  interpretSessionEvents(result.events);
  syncBroodlineFormation();
  syncHud();
  return true;
}
function syncBroodlineFormation() { if (!broodlineChainEl || !broodline) return; broodlineChainEl.replaceChildren(...broodline.chain.map((part, index) => { const button = document.createElement("button"); button.className = `broodline-card${index === broodline.selected ? " is-selected" : ""}`; button.type = "button"; button.innerHTML = `<span>${broodlineSpeciesLabel(part.kind).toUpperCase()}</span><small>${part.kind === "egg" ? `${Math.ceil(part.hatchAt / 1000)}s` : "slot " + (index + 1)}</small>`; button.addEventListener("click", () => dispatchBroodlineFormation({ type: "broodlineSelect", index })); return button; })); }

function isMinigameMode() {
  return ["duel", "maze", "breakout", "runner", "crossing", "snakebird", "sokoban", "broodline", "battleship", "centipede"].includes(gameMode);
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
    loadSnakebirdLevel(snakebird?.result === "won"
      ? pickRandomSnakebirdLevel(snakebird.levelIndex)
      : snakebird?.levelIndex ?? 0);
  } else if (gameMode === "sokoban") {
    const nextStage = sokoban?.result === "won"
      ? (sokoban.stageIndex + 1) % sokobanLevels.length
      : sokoban?.stageIndex || 0;
    loadSokobanLevel(nextStage);
  } else if (gameMode === "broodline") {
    launchBroodline();
  } else if (gameMode === "battleship") {
    restartBattleship();
  } else if (gameMode === "centipede") {
    state = "gameover";
    launchCentipede();
  }
}

function startGame() {
  if (gameMode === "battleship") {
    if (state === "gameover") { restartBattleship(); return; }
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
    if (state === "ready") {
      const result = session.dispatch({ type: "begin" });
      if (result.events.some((event) => event.type === "actionRejected")) return;
      latestSnapshot = result.snapshot;
      latestFrameSnapshot = result.snapshot;
      projectSnakebirdSnapshot(result.snapshot);
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
    if (state === "ready") {
      const result = session.dispatch({ type: "begin" });
      if (result.events.some((event) => event.type === "actionRejected")) return;
      latestSnapshot = result.snapshot;
      latestFrameSnapshot = result.snapshot;
      projectSokobanSnapshot(result.snapshot);
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
    if (state === "ready") {
      const result = session.dispatch({ type: "begin" });
      if (result.events.some((event) => event.type === "actionRejected")) return;
      latestSnapshot = result.snapshot;
      latestFrameSnapshot = result.snapshot;
      projectBroodlineSnapshot(result.snapshot);
      timerStarted = true;
      lastFrameAt = performance.now();
      stepAccumulatorMs = 0;
      syncHud();
      hideOverlay();
      setScreenHint("Steer · attacks are automatic");
    }
    return;
  }
  if (gameMode === "breakout") {
    if (state === "gameover") launchBreakout();
    if (state === "ready") {
      const result = session.dispatch({ type: "begin" });
      if (result.events.some((event) => event.type === "actionRejected")) return;
      latestSnapshot = result.snapshot;
      latestFrameSnapshot = result.snapshot;
      projectBreakoutSnapshot(result.snapshot);
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
    if (state === "ready") {
      const result = session.dispatch({ type: "begin" });
      if (result.events.some((event) => event.type === "actionRejected")) return;
      latestSnapshot = result.snapshot;
      latestFrameSnapshot = result.snapshot;
      projectCentipedeSnapshot(result.snapshot);
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
    if (state === "ready") {
      const result = session.dispatch({ type: "begin" });
      if (result.events.some((event) => event.type === "actionRejected")) return;
      latestSnapshot = result.snapshot;
      latestFrameSnapshot = result.snapshot;
      projectRunnerSnapshot(result.snapshot);
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
    if (state !== "ready") return;
    const result = session.dispatch({ type: "begin" });
    if (result.events.some((event) => event.type === "actionRejected")) return;
    latestSnapshot = result.snapshot;
    latestFrameSnapshot = result.snapshot;
    projectCrossingSnapshot(result.snapshot);
    timerStarted = true;
    lastFrameAt = performance.now();
    stepAccumulatorMs = 0;
    syncHud();
    hideOverlay();
    setScreenHint("Reach the top bank");
    return;
  }
  if (gameMode === "maze") {
    if (state === "gameover") launchMaze();
    if (state === "ready") {
      const result = session.dispatch({ type: "begin" });
      if (result.events.some((event) => event.type === "actionRejected")) return;
      latestSnapshot = result.snapshot;
      latestFrameSnapshot = result.snapshot;
      projectMazeSnapshot(result.snapshot);
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
    if (state !== "ready") return;
    const result = session.dispatch({ type: "begin" });
    if (result.events.some((event) => event.type === "actionRejected")) return;
    latestSnapshot = result.snapshot;
    latestFrameSnapshot = result.snapshot;
    projectDuelSnapshot(result.snapshot);
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
    // Unlike steering, keypad Start does not provide a turn to react with.
    // Give it half a movement tick of extra lead-in before the opening move.
    const result = session.dispatch({ type: "begin", initialDelayMs: tickMs / 2 });
    if (result.events.some((event) => event.type === "actionRejected")) return;
    latestSnapshot = result.snapshot;
    mirrorSnakeFromSnapshot(result.snapshot);
    state = result.snapshot.phase;
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
      resupplyEggHolding: Math.floor(clampNumber(saved.resupplyEggHolding, 0, Number.MAX_SAFE_INTEGER, 0)),
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
  habitatListEl.replaceChildren();
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


function totalProvisionsPerSecond() {
  return window.IdleSnakeEconomy.calculateHabitatActivation(
    habitats.counts, currentFoodType().value, notablesState, habitats.upgradeLevels
  ).provisionsProducedPerSecond;
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
  const { snapshot, events } = session.dispatch({ type: "layEgg" });
  if (events.some((e) => e.type === "actionRejected")) return;
  seedsTotal = snapshot.seeds;
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
  nursery.resupplyEggHolding = en.resupplyEggHolding;
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
  provisionsTotal = snap.provisions;
  branchesTotal = snap.branches;
  const upgradeStateChanged = JSON.stringify(upgrades) !== JSON.stringify(snap.upgrades);
  upgrades = { ...snap.upgrades };
  selectedBoardLevel = Math.min(upgrades.boardLevel, Math.max(0, Number(snap.selectedBoardLevel) || 0));
  if (upgradeStateChanged) boardOptionsBuiltForLevel = -1;
}

// Advance the idle economy on the unified clock. Called every frame from
// gameLoop with the real wall-clock delta (so it also catches up after the tab
// is throttled in the background); offline-across-reload is handled during
// session initialization. Absorbs gameplay seed changes before ticking and
// writes the result back, then mirrors to the UI globals.
function tickIdleWorld() {
  if (!session) return [];
  const now = Date.now();
  const dt = idleLastWallAt == null ? 0 : now - idleLastWallAt;
  idleLastWallAt = now;
  if (dt <= 0) return [];
  const { snapshot, events } = session.tick(dt, { snapshot: "frame" });
  latestFrameSnapshot = snapshot;
  recordBoardMastery(snapshot);
  seedsTotal = snapshot.seeds;
  provisionsTotal = snapshot.provisions;
  branchesTotal = snapshot.branches;
  best = snapshot.best;
  if (events.some((item) => item.type === "NOTABLE_GENERATED")) showNotablesMenu();
  // Full snapshots and heavyweight browser mirrors share a bounded cadence;
  // gameplay and the immediate HUD above still advance every animation frame.
  if (now - idleLastPersistAt >= 250) {
    idleLastPersistAt = now;
    latestSnapshot = session.snapshot();
    mirrorEconomyFromWorld(now, latestSnapshot);
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
  boardOptionsBuiltForLevel = -1;
  persistConsolidatedSave();
  syncUpgradeMenu();
}

function initializeSessionClocks(snapshot) {
  idleLastWallAt = Date.now();
  idleLastPersistAt = idleLastWallAt;
  seedsTotal = snapshot.seeds;
  provisionsTotal = snapshot.provisions;
  branchesTotal = snapshot.branches;
  best = snapshot.best;
  mirrorEconomyFromWorld(idleLastWallAt, snapshot);
}

// Hydrate the authoritative envelope at boot and perform offline catch-up once.
function initIdleWorld() {
  if (!window.IdleSnakeSession) return;
  const now = Date.now();
  session = window.IdleSnakeSession.createGameSession({ save: loadedSaveEnvelope, now, rng: Math.random, mobileControlsDefault: defaultMobileControls() });
  const { snapshot } = session.advanceOffline(now);
  latestSnapshot = snapshot;
  applySessionSnapshot(snapshot, loadedSaveEnvelope.savedAt);
  initializeSessionClocks(snapshot);
  if (snapshot.notables.pending.length) showNotablesMenu();
}

// Copy the session's snake run into the legacy globals the renderer reads.
// modeAccumulatorMs/elapsedMs come straight from the snapshot so the HUD timer
// keeps working unchanged.
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

// Puzzle renderers keep their legacy-shaped display records, but those records
// are projections rather than aliases of the authoritative session snapshot.
// Sets must be rebuilt explicitly: JSON cloning would silently lose them.
function clonePuzzlePoints(points) {
  return Array.isArray(points) ? points.map((point) => ({ ...point })) : [];
}

function projectSnakebirdSnapshot(snap) {
  if (!snap || snap.mode !== "snakebird" || !snap.active) return;
  const active = snap.active;
  snakebird = {
    ...active,
    body: clonePuzzlePoints(active.body),
    fruits: new Set(active.fruits || []),
    solids: new Set(active.solids || []),
    exit: active.exit ? { ...active.exit } : null,
    definition: active.definition ? { ...active.definition, map: [...(active.definition.map || [])] } : null
  };
  if (snap.snakebirdProgress) {
    snakebirdProgress = {
      ...snap.snakebirdProgress,
      clearedLevels: [...(snap.snakebirdProgress.clearedLevels || [])],
      bestMoves: [...(snap.snakebirdProgress.bestMoves || [])]
    };
  }
  seedsTotal = snap.seeds;
  state = snap.phase;
  grid = { columns: snakebird.width, rows: snakebird.height };
  elapsedMs = snap.elapsedMs;
}

function projectSokobanSnapshot(snap) {
  if (!snap || snap.mode !== "sokoban" || !snap.active) return;
  const active = snap.active;
  sokoban = {
    ...active,
    walls: new Set(active.walls || []),
    snake: clonePuzzlePoints(active.snake),
    previousSnake: clonePuzzlePoints(active.previousSnake),
    crates: clonePuzzlePoints(active.crates),
    previousCrates: clonePuzzlePoints(active.previousCrates),
    goals: clonePuzzlePoints(active.goals),
    plates: clonePuzzlePoints(active.plates),
    gates: clonePuzzlePoints(active.gates),
    pellets: clonePuzzlePoints(active.pellets),
    definition: active.definition ? { ...active.definition, map: [...(active.definition.map || [])], snake: clonePuzzlePoints(active.definition.snake), crates: clonePuzzlePoints(active.definition.crates), goals: clonePuzzlePoints(active.definition.goals), pellets: clonePuzzlePoints(active.definition.pellets), plates: clonePuzzlePoints(active.definition.plates), gates: clonePuzzlePoints(active.definition.gates) } : null
  };
  seedsTotal = snap.seeds;
  state = snap.phase;
  grid = { columns: sokoban.width, rows: sokoban.height };
  elapsedMs = snap.elapsedMs;
}

function projectRunnerSnapshot(snap) {
  if (!snap || snap.mode !== "runner" || !snap.active) return;
  runner = {
    ...snap.active,
    player: { ...snap.active.player },
    obstacles: (snap.active.obstacles || []).map((obstacle) => ({ ...obstacle }))
  };
  state = snap.phase;
  elapsedMs = snap.elapsedMs;
  tickMs = snap.active.tickMs || 16;
  stepAccumulatorMs = snap.modeAccumulatorMs || 0;
  seedsTotal = snap.seeds;
  if (snap.records) {
    const projectedBest = Math.max(0, Number(snap.records.runnerBest) || 0);
    if (projectedBest !== runnerBest) {
      runnerBest = projectedBest;
      setSaveItem("runner-best", String(runnerBest));
    }
  }
}

function projectBattleshipSnapshot(snap) {
  if (!snap || snap.mode !== "battleship" || !snap.active) return;
  battleship = structuredClone(snap.active);
  grid = { ...battleship.grid };
  state = snap.phase;
  elapsedMs = snap.elapsedMs;
  stepAccumulatorMs = snap.modeAccumulatorMs || 0;
  seedsTotal = snap.seeds;
  if (snap.records) {
    const projectedBest = Math.max(0, Number(snap.records.battleshipBest) || 0);
    if (projectedBest !== battleshipBest) {
      battleshipBest = projectedBest;
      setSaveItem("battleship-best", String(battleshipBest));
    }
  }
}

function dispatchBattleship(action) {
  if (!session || gameMode !== "battleship") return false;
  const result = session.dispatch(action);
  const rejected = result.events.find((event) => event.type === "actionRejected");
  if (rejected) {
    const hints = {
      invalidPlacement: "Snakes can't overlap — pick another spot",
      fleetIncomplete: "Place every snake before starting the battle",
      repeatTarget: "You already struck there — aim somewhere new",
      notPlayerTurn: "Wait for the enemy venom strike"
    };
    if (hints[rejected.reason]) setScreenHint(hints[rejected.reason]);
    return false;
  }
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectBattleshipSnapshot(result.snapshot);
  interpretSessionEvents(result.events);
  if (battleship?.phase === "placement") battleshipSetPlacementHint();
  syncHud();
  render();
  return true;
}

function projectBreakoutSnapshot(snap) {
  if (!snap || snap.mode !== "breakout" || !snap.active) return;
  const active = snap.active;
  const brickColors = ["#182413", "#29391f", "#38502a", "#496536", "#5c7840"];
  breakout = {
    ...active,
    board: { ...active.board },
    paddle: { ...active.paddle },
    balls: (active.balls || []).map((ball) => ({ ...ball })),
    bricks: (active.bricks || []).map((brick) => ({
      ...brick,
      color: brick.color || brickColors[Math.max(0, Math.min(brickColors.length - 1, Math.round((brick.y - 58) / 20)))]
    })),
    powerups: (active.powerups || []).map((powerup) => ({ ...powerup })),
    seedBoosts: (active.seedBoosts || []).map((boost) => ({ ...boost }))
  };
  state = snap.phase;
  elapsedMs = snap.elapsedMs;
  tickMs = 16;
  stepAccumulatorMs = snap.modeAccumulatorMs || 0;
  seedsTotal = snap.seeds;
  if (snap.records) {
    const projectedBest = Math.max(0, Number(snap.records.breakoutBest) || 0);
    if (projectedBest !== breakoutBest) breakoutBest = projectedBest;
  }
}

function setBreakoutAxis(value) {
  if (!session || gameMode !== "breakout") return false;
  const result = session.dispatch({ type: "setInputAxis", axis: "x", value });
  if (result.events.some((event) => event.type === "actionRejected")) return false;
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectBreakoutSnapshot(result.snapshot);
  return true;
}

function projectDuelSnapshot(snap) {
  if (!snap || snap.mode !== "duel" || !snap.active) return;
  const active = snap.active;
  const nextPlayerBody = (active.player?.body || []).map((part) => ({ ...part }));
  const nextOpponentBody = (active.opponent?.body || []).map((part) => ({ ...part }));
  const playerMoved = Boolean(duelPlayer) && (duelPlayer.body.length !== nextPlayerBody.length ||
    (duelPlayer.body[0] && nextPlayerBody[0] && (duelPlayer.body[0].x !== nextPlayerBody[0].x || duelPlayer.body[0].y !== nextPlayerBody[0].y)));
  if (playerMoved) {
    previousDuelPlayerBody = duelPlayer.body.map((part) => ({ ...part }));
    previousDuelOpponentBody = duelOpponent.body.map((part) => ({ ...part }));
  } else if (!duelPlayer) {
    previousDuelPlayerBody = nextPlayerBody.map((part) => ({ ...part }));
    previousDuelOpponentBody = nextOpponentBody.map((part) => ({ ...part }));
  }
  duelPlayer = { ...active.player, body: nextPlayerBody, color: snakeColors.head };
  duelOpponent = { ...active.opponent, body: nextOpponentBody, color: "#fffdf0" };
  duelFoods = (active.foods || []).map((food) => ({ ...food }));
  duelScore = active.score || 0;
  direction = active.direction;
  nextDirection = active.nextDirection;
  directionQueue = [...(active.directionQueue || [])];
  grid = { ...active.grid };
  state = snap.phase;
  elapsedMs = snap.elapsedMs;
  tickMs = active.tickMs || duelTickMs;
  stepAccumulatorMs = snap.modeAccumulatorMs || 0;
  seedsTotal = snap.seeds;
}

function projectMazeSnapshot(snap) {
  if (!snap || snap.mode !== "maze" || !snap.active) return;
  const active = snap.active;
  const nextPath = clonePuzzlePoints(active.path);
  const moved = mazePath?.length > 0 && (mazePath.length !== nextPath.length ||
    (mazePath[0] && nextPath[0] && (mazePath[0].x !== nextPath[0].x || mazePath[0].y !== nextPath[0].y)));
  if (moved) previousSnake = clonePuzzlePoints(mazePath);
  else if (!mazePath?.length) previousSnake = clonePuzzlePoints(nextPath);
  mazePath = nextPath;
  maze = {
    open: new Set(active.open || []),
    food: active.food ? { ...active.food } : null,
    foodsEaten: active.foodsEaten,
    level: active.level
  };
  snake = mazePath;
  mazeScore = active.score || 0;
  direction = active.direction;
  nextDirection = active.directionQueue?.at(-1) || active.direction;
  directionQueue = [...(active.directionQueue || [])];
  grid = { ...active.grid };
  state = snap.phase;
  elapsedMs = snap.elapsedMs;
  tickMs = active.tickMs || mazeTickMs;
  stepAccumulatorMs = snap.modeAccumulatorMs || 0;
  seedsTotal = snap.seeds;
  if (snap.records) {
    const projectedBest = Math.max(0, Number(snap.records.mazeBest) || 0);
    if (projectedBest !== mazeBest) {
      mazeBest = projectedBest;
      setSaveItem("maze-best", String(mazeBest));
    }
  }
}

function projectCrossingSnapshot(snap) {
  if (!snap || snap.mode !== "crossing" || !snap.active) return;
  const active = snap.active;
  const nextSnake = clonePuzzlePoints(active.snake);
  const stageChanged = crossingStage != null && crossingStage !== active.stage;
  const phaseChanged = crossingPhase != null && crossingPhase !== active.subphase;
  const moved = crossingSnake?.length > 0 && (crossingSnake.length !== nextSnake.length ||
    (crossingSnake[0] && nextSnake[0] && (crossingSnake[0].x !== nextSnake[0].x || crossingSnake[0].y !== nextSnake[0].y)));
  // Stage boundaries and the clearing hold are intentional hard cuts. Within a
  // playing stage, retain the old body only when a logical step actually lands.
  if (stageChanged || phaseChanged || !crossingSnake?.length) previousCrossingSnake = clonePuzzlePoints(nextSnake);
  else if (moved) previousCrossingSnake = clonePuzzlePoints(crossingSnake);
  crossingSnake = nextSnake;
  crossingCars = (active.cars || []).map((car) => ({ ...car }));
  crossingStage = active.stage;
  crossingScore = active.score || 0;
  crossingPhase = active.subphase;
  direction = active.direction;
  nextDirection = active.nextDirection;
  directionQueue = [...(active.directionQueue || [])];
  grid = { ...active.grid };
  state = snap.phase;
  elapsedMs = snap.elapsedMs;
  tickMs = active.tickMs || crossingTickMs;
  stepAccumulatorMs = snap.modeAccumulatorMs || 0;
  seedsTotal = snap.seeds;
  if (snap.records) {
    const projectedBest = Math.max(0, Number(snap.records.crossingBest) || 0);
    if (projectedBest !== crossingBest) {
      crossingBest = projectedBest;
      setSaveItem("crossing-best", String(crossingBest));
    }
  }
}

function projectCentipedeSnapshot(snap) {
  if (!snap || snap.mode !== "centipede" || !snap.active) return;
  centipede = structuredClone(snap.active);
  grid = { columns: centipede.cols, rows: centipede.rows };
  state = snap.phase;
  elapsedMs = snap.elapsedMs;
  tickMs = centipede.tickMs || 70;
  stepAccumulatorMs = snap.modeAccumulatorMs || 0;
  seedsTotal = snap.seeds;
  if (snap.records) {
    const projectedBest = Math.max(0, Number(snap.records.centipedeBest) || 0);
    if (projectedBest !== centipedeBest) {
      centipedeBest = projectedBest;
      setSaveItem("centipede-best", String(centipedeBest));
    }
  }
}

function projectBroodlineSnapshot(snap) {
  if (!snap || snap.mode !== "broodline" || !snap.active) return;
  const previousCamera = broodline?.camera;
  broodline = structuredClone(snap.active);
  broodline.camera = previousCamera
    ? { ...previousCamera }
    : { x: broodline.head.x - broodlineView / 2, y: broodline.head.y - broodlineView / 2 };
  broodline.headColor = snakeColors.head;
  grid = { ...broodline.grid };
  state = snap.phase;
  elapsedMs = snap.elapsedMs;
  tickMs = broodline.tickMs || broodlineTickMs;
  stepAccumulatorMs = snap.modeAccumulatorMs || 0;
  seedsTotal = snap.seeds;
}

function setCentipedeAxis(axis, value) {
  if (!session || gameMode !== "centipede") return false;
  const result = session.dispatch({ type: "setInputAxis", axis, value });
  if (result.events.some((event) => event.type === "actionRejected")) return false;
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectCentipedeSnapshot(result.snapshot);
  return true;
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
      case "eat": if (gameMode === "snake") { runSeedsEarned += Math.max(0, Number(event.value) || 0); startDigestionAnimation(); startCrumbAnimation(event.at); } break;
      case "shield": if (gameMode === "snake") saveUpgrades(); break;
      case "bestScore": if (gameMode === "snake") setSaveItem("best", String(best)); break;
      case "gameOver": if (gameMode === "snake") { state = "gameover"; startDeathAnimation(); syncHud(); showDeathOverlay("Game Over"); } break;
      case "win": if (gameMode === "snake") { state = "gameover"; syncHud(); showOverlay("Maxed"); } break;
      case "runEnded":
        if (event.mode === "runner") {
          state = "gameover";
          syncHud();
          showOverlay(`Runner Down · +${formatNumber(event.reward || 0)} Seeds`);
          setScreenHint("Start to run again");
        } else if (event.mode === "duel") {
          duelWinner = event.winner;
          state = "gameover";
          syncHud();
          showOverlay(event.winner === "player" ? `Winner · +${formatNumber(event.reward || 0)} Seeds` : event.winner === "opponent" ? "Defeated" : "Draw");
        } else if (event.mode === "centipede") {
          state = "gameover";
          syncHud();
          showOverlay(event.reward > 0 ? `Game Over · +${formatNumber(event.reward)} Seeds` : "Game Over");
        } else if (event.mode === "maze") {
          state = "gameover";
          syncHud();
          showOverlay(`Nibbled the wall · +${formatNumber(event.reward || 0)} Seeds`);
          setScreenHint("Start to explore again");
        } else if (event.mode === "crossing") {
          state = "gameover";
          syncHud();
          showOverlay(`Roadkill · Stage ${crossingStage}`);
          setScreenHint("Start to cross again");
        } else if (event.mode === "breakout") {
          state = "gameover";
          syncHud();
          showOverlay(event.reward > 0 ? `Level Clear · +${formatNumber(event.reward)} Seeds` : "Game Over");
          setScreenHint("Start to build another paddle");
        } else if (event.mode === "broodline") {
          state = "gameover";
          hideBroodlineFormation();
          syncHud();
          showOverlay(`${event.reason || "Run ended"} · +${formatNumber(event.reward || 0)} Seeds`);
          setScreenHint("Start to begin a new Broodline");
        } else if (event.mode === "battleship") {
          state = "gameover";
          syncHud();
          showOverlay(event.won ? `Victory · +${formatNumber(event.reward || 0)} Seeds` : "Fleet Lost");
          setScreenHint(event.won ? "All enemy snakes sunk · Start to play again" : "Your nest was wiped out · Start to try again");
        }
        break;
      case "battleshipShot":
        if (event.actor === "player") {
          setScreenHint(event.result === "sunk" ? `Venom sank the enemy ${event.ship}!` : event.result === "hit" ? "Direct venom hit!" : "Venom splashed the water — miss");
        } else {
          setScreenHint(event.result === "sunk" ? `Enemy venom sank your ${event.ship}!` : event.result === "hit" ? "Your snake took a venom hit!" : "Enemy venom missed you");
        }
        break;
      case "runReady":
        if (event.mode === "breakout" && event.reason === "ballLost") {
          state = "ready";
          syncHud();
          showOverlay(`Ball Lost · ${event.lives} ${event.lives === 1 ? "life" : "lives"} left`);
          setScreenHint("Left / right to move · catch seeds to grow");
        } else if (event.mode === "broodline" && event.round) {
          hideBroodlineFormation();
          state = "ready";
          timerStarted = false;
          syncHud();
          showOverlay(`Broodline · Round ${event.round}`);
          setScreenHint("Steer · attacks are automatic");
        }
        break;
      case "roundClear":
        if (gameMode === "broodline") {
          projectBroodlineSnapshot(latestFrameSnapshot || latestSnapshot);
          timerStarted = false;
          showBroodlineFormation();
          syncHud();
        }
        break;
      case "levelUp":
        if (gameMode === "maze") {
          showOverlay(`Round ${event.level - 1} Clear · +${formatNumber(event.reward)} Seeds`);
          window.setTimeout(() => { if (state === "running" && gameMode === "maze") hideOverlay(); }, 700);
        }
        break;
      case "stageClear":
        if (gameMode === "crossing") {
          showOverlay(`Stage ${crossingStage} Clear · +${formatNumber(event.reward)} Seeds`);
          setScreenHint("Next road loading");
        }
        break;
      case "stageStarted":
        if (gameMode === "crossing") {
          hideOverlay();
          setScreenHint(`Stage ${event.stage}: reach the top bank`);
        }
        break;
      case "playerHit":
        if (gameMode === "centipede") {
          syncHud();
          showOverlay(`Hit! · ${event.lives} ${event.lives === 1 ? "life" : "lives"} left`);
          setScreenHint("Arrows to move · you auto-fire upward");
        }
        break;
      case "migrationStopReached": setScreenHint("A migration convoy is waiting at a stop."); idleLastPanelAt = 0; break;
      case "migrationFailed": setScreenHint("A migration expedition was lost."); idleLastPanelAt = 0; break;
      case "settlementEstablished": setScreenHint("A new settlement is fully established."); idleLastPanelAt = 0; break;
      case "migrationChallengeCompleted": state = "gameover"; syncHud(); showOverlay("Challenge complete"); setScreenHint("The convoy passed the Seed Trial."); idleLastPanelAt = 0; break;
      case "migrationChallengeFailed": state = "gameover"; syncHud(); showOverlay("Attempt failed"); setScreenHint("The convoy took losses. Retry or skip from Migration."); idleLastPanelAt = 0; break;
    }
  }
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
    if (sessionOwnedModes.has(gameMode)) {
      // A throttled/background browser may not have delivered animation frames
      // during the pause. Credit that wall time to the idle world while the
      // session is still paused, so resuming cannot feed it into gameplay.
      interpretSessionEvents(tickIdleWorld());
      const result = session.dispatch({ type: "resume" });
      if (result.events.some((event) => event.type === "actionRejected")) return;
      latestSnapshot = result.snapshot;
      latestFrameSnapshot = result.snapshot;
      state = result.snapshot.phase;
      if (gameMode === "snake") { mirrorSnakeFromSnapshot(result.snapshot); previousSnake = snake.map((part) => ({ ...part })); }
      else if (gameMode === "snakebird") projectSnakebirdSnapshot(result.snapshot);
      else if (gameMode === "sokoban") projectSokobanSnapshot(result.snapshot);
      else if (gameMode === "runner") projectRunnerSnapshot(result.snapshot);
      else if (gameMode === "maze") projectMazeSnapshot(result.snapshot);
      else if (gameMode === "crossing") projectCrossingSnapshot(result.snapshot);
      else if (gameMode === "breakout") projectBreakoutSnapshot(result.snapshot);
      else if (gameMode === "broodline") projectBroodlineSnapshot(result.snapshot);
      else if (gameMode === "battleship") projectBattleshipSnapshot(result.snapshot);
    } else {
      state = "running";
    }
    lastFrameAt = performance.now();
    stepAccumulatorMs = 0;
    syncHud();
    hideOverlay();
  } else if (state === "running") {
    if (sessionOwnedModes.has(gameMode)) {
      const result = session.dispatch({ type: "pause" });
      if (result.events.some((event) => event.type === "actionRejected")) return;
      latestSnapshot = result.snapshot;
      latestFrameSnapshot = result.snapshot;
      state = result.snapshot.phase;
      if (gameMode === "snake") mirrorSnakeFromSnapshot(result.snapshot);
      else if (gameMode === "snakebird") projectSnakebirdSnapshot(result.snapshot);
      else if (gameMode === "sokoban") projectSokobanSnapshot(result.snapshot);
      else if (gameMode === "runner") projectRunnerSnapshot(result.snapshot);
      else if (gameMode === "maze") projectMazeSnapshot(result.snapshot);
      else if (gameMode === "crossing") projectCrossingSnapshot(result.snapshot);
      else if (gameMode === "breakout") projectBreakoutSnapshot(result.snapshot);
      else if (gameMode === "broodline") projectBroodlineSnapshot(result.snapshot);
      else if (gameMode === "battleship") projectBattleshipSnapshot(result.snapshot);
    } else {
      state = "paused";
    }
    syncHud();
    showOverlay("Paused");
  }
}

function activatePrimaryAction() {
  if (!controlsEl?.classList.contains("is-large-dpad-controls")) {
    togglePause();
    return;
  }
  if (state === "gameover") {
    resetGame();
  } else if (state === "ready") {
    startGame();
  } else {
    togglePause();
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
  // the former separate nursery interval.
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
  if (gameMode === "snakebird") projectSnakebirdSnapshot(latestFrameSnapshot || latestSnapshot);
  if (gameMode === "sokoban") projectSokobanSnapshot(latestFrameSnapshot || latestSnapshot);
  if (gameMode === "runner") projectRunnerSnapshot(latestFrameSnapshot || latestSnapshot);
  if (gameMode === "duel") projectDuelSnapshot(latestFrameSnapshot || latestSnapshot);
  if (gameMode === "maze") projectMazeSnapshot(latestFrameSnapshot || latestSnapshot);
  if (gameMode === "crossing") projectCrossingSnapshot(latestFrameSnapshot || latestSnapshot);
  if (gameMode === "breakout") projectBreakoutSnapshot(latestFrameSnapshot || latestSnapshot);
  if (gameMode === "centipede") projectCentipedeSnapshot(latestFrameSnapshot || latestSnapshot);
  if (gameMode === "broodline") projectBroodlineSnapshot(latestFrameSnapshot || latestSnapshot);
  if (gameMode === "battleship") projectBattleshipSnapshot(latestFrameSnapshot || latestSnapshot);
  setText(seedsTotalEl, padSeeds(seedsTotal));
  const wallNow = Date.now();
  if (wallNow - idleLastPanelAt >= 200) {
    idleLastPanelAt = wallNow;
    syncPanels(wallNow);
  }

  if (gameMode === "snake") {
    // The session advanced (or held) the snake; mirror it into the render globals.
    if (latestFrameSnapshot || latestSnapshot) mirrorSnakeFromSnapshot(latestFrameSnapshot || latestSnapshot);
    if (state === "running") {
      // A step landed iff the head moved (or the body grew). Only then does the
      // pre-step body become the interpolation origin; otherwise previousSnake
      // is kept so the slide toward the current cell continues across frames.
      if (snakeBeforeStep && snakeStepped(snakeBeforeStep, snake)) previousSnake = snakeBeforeStep;
      syncHud();
    }
  }

  lastFrameAt = now;
  render();
  animationId = requestAnimationFrame(gameLoop);
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
  const result = session.dispatch({ type: "selectMode", mode: "centipede", setup: { grid, tickMs: 70 } });
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectCentipedeSnapshot(result.snapshot);
  direction = "right";
  nextDirection = "right";
  directionQueue = [];
  stepAccumulatorMs = 0;
  timerStarted = false;
  syncHud();
  render();
  showOverlay("Centipede · Ready");
  setScreenHint("Arrows to move · you auto-fire upward");
}

function queueDirection(next) {
  if (!vectors[next]) return;
  if (state === "gameover") {
    resetGame();
    return;
  }
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
    if (state !== "running" || broodline?.phase !== "combat") return;
    const result = session.dispatch({ type: "direction", direction: next });
    if (result.events.some((event) => event.type === "actionRejected")) return;
    latestSnapshot = result.snapshot;
    latestFrameSnapshot = result.snapshot;
    projectBroodlineSnapshot(result.snapshot);
    timerStarted = true;
    hideOverlay();
    return;
  }
  if (gameMode === "breakout") {
    if (next === "left" || next === "right") {
      if (state === "ready") startGame();
      if (state !== "gameover" && breakout) setBreakoutAxis(next === "left" ? -1 : 1);
    }
    return;
  }
  if (gameMode === "runner") {
    if (next === "up") runnerJump();
    return;
  }
  if (gameMode === "centipede") {
    if (state === "ready") startGame();
    if (state === "gameover" || !centipede) return;
    if (next === "left") setCentipedeAxis("x", -1);
    else if (next === "right") setCentipedeAxis("x", 1);
    else if (next === "up") setCentipedeAxis("y", -1);
    else if (next === "down") setCentipedeAxis("y", 1);
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
  snakebirdMove(next);
}

function queueSokobanDirection(next) {
  sokobanMove(next);
}

function queueCrossingDirection(next) {
  if (state === "gameover" || state === "paused") return;
  const result = session.dispatch({ type: "direction", direction: next });
  if (result.events.some((event) => event.type === "actionRejected")) return;
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectCrossingSnapshot(result.snapshot);
  timerStarted = true;
  lastFrameAt = performance.now();
  hideOverlay();
  setScreenHint("Reach the top bank");
}

function queueDuelDirection(next) {
  if (state === "gameover" || state === "paused") return;
  const result = session.dispatch({ type: "direction", direction: next });
  if (result.events.some((event) => event.type === "actionRejected")) return;
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectDuelSnapshot(result.snapshot);
  timerStarted = true;
  hideOverlay();
}

function queueMazeDirection(next) {
  if (state === "gameover" || state === "paused") return;
  if (state === "ready") startGame();
  const result = session.dispatch({ type: "direction", direction: next });
  if (result.events.some((event) => event.type === "actionRejected")) return;
  latestSnapshot = result.snapshot;
  latestFrameSnapshot = result.snapshot;
  projectMazeSnapshot(result.snapshot);
  timerStarted = true;
  hideOverlay();
}

function updateDirectionButtonPressed(directionName) {
  const button = document.querySelector(`[data-direction="${directionName}"]`);
  if (!button) return;

  const keyIsPressed = [...activeDirectionKeys].some((key) => keyMap[key] === directionName);
  button.classList.toggle("is-pressed", !effectiveReducedMotion() && (keyIsPressed || activeDirectionClicks.has(directionName)));
}

function animateDirectionClick(directionName, elapsedMs) {
  if (effectiveReducedMotion() || elapsedMs >= minimumDirectionClickMs) return;

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

function mazeKey(point) {
  return `${point.x},${point.y}`;
}

function isMazeOpen(point) {
  return !isWallHit(point) && maze?.open.has(mazeKey(point));
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
      drawCrumbs();
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

function interpolatedPoint(previous, current, index = 0) {
  // Snake positions always render at their logical grid cell. This keeps the
  // crisp reduced-motion movement while leaving eating's body-bulge effect
  // independent of the movement preference.
  return { x: current.x, y: current.y };
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

  if (deathAnimation && state === "gameover") {
    if (effectiveReducedMotion()) deathAnimation = null;
    else {
      drawDeathAnimation(now);
      return;
    }
  }

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

// On collision, the body breaks into its individual tiles in a head-to-tail
// cascade. Each tile hops first, then drops below the display and fades away.
// Cap the whole stagger at 1.2 seconds so very long snakes do not leave the
// player waiting an unreasonable amount of time before the effect completes.
const DEATH_TILE_DURATION_MS = 820;
const DEATH_CONNECTOR_DURATION_MS = 980;
const DEATH_SEED_DURATION_MS = 920;
const DEATH_MAX_STAGGER_MS = 1200;
const DEATH_TILE_DELAY_MS = 70;

function startDeathAnimation() {
  if (effectiveReducedMotion() || !snake?.length) {
    deathAnimation = null;
    return;
  }
  deathAnimation = {
    startedAt: performance.now(),
    direction,
    segments: snake.map((part) => ({ ...part })),
    seeds: buildDeathSeedParticles(runSeedsEarned),
    delayMs: Math.min(DEATH_TILE_DELAY_MS, DEATH_MAX_STAGGER_MS / Math.max(1, snake.length - 1))
  };
}

function buildDeathSeedParticles(seedsEarned) {
  // Particle quantity follows actual eat-event payouts for this run. Square
  // root scaling keeps large late-game earnings celebratory but bounded.
  const count = Math.min(18, 3 + Math.ceil(Math.sqrt(Math.max(0, seedsEarned)) * 1.7));
  const energy = 0.85 + Math.min(0.55, Math.log10(Math.max(0, seedsEarned) + 1) * 0.22);
  return Array.from({ length: count }, (_, index) => {
    // Canvas Y increases downward, so this fixed upper-half fan always bursts
    // toward the top of the screen rather than following the snake's facing.
    const spread = count === 1 ? 0.5 : index / (count - 1);
    return {
      angle: -Math.PI * 0.82 + spread * Math.PI * 0.64,
      distance: energy * (1.25 + (index % 4) * 0.16),
      size: 0.16 + (index % 3) * 0.025,
      spin: (index % 2 === 0 ? -1 : 1) * (1.4 + (index % 5) * 0.25)
    };
  });
}

function drawDeathAnimation(now) {
  const animation = deathAnimation;
  if (!animation) return;
  const cell = boardMetrics.cellSize;
  const elapsed = now - animation.startedAt;

  // The pale necks are their own debris pieces. Keep each one in place until
  // the headward tile releases it, then give it a lower hop, a slower fall,
  // sideways drift, and a tumble so the breakup does not feel too uniform.
  // Draw these first so unreleased connectors still sit underneath the tiles.
  animation.segments.slice(0, -1).forEach((part, index) => {
    const nextPart = animation.segments[index + 1];
    const rawLocal = (elapsed - (index + 0.45) * animation.delayMs) / DEATH_CONNECTOR_DURATION_MS;
    if (rawLocal >= 1) return;
    const local = Math.max(0, rawLocal);
    const startX = boardMetrics.x + ((part.x + nextPart.x) / 2 + 0.5) * cell;
    const startY = boardMetrics.y + ((part.y + nextPart.y) / 2 + 0.5) * cell;
    const angle = Math.atan2(nextPart.y - part.y, nextPart.x - part.x);
    const jumpEnd = 0.28;
    const jumpHeight = cell * 0.42;
    const fall = local <= jumpEnd ? 0 : (local - jumpEnd) / (1 - jumpEnd);
    const offsetY = local <= jumpEnd
      ? -Math.sin((local / jumpEnd) * Math.PI / 2) * jumpHeight
      : -jumpHeight + fall * fall * (canvas.height - startY + cell * 1.4);
    const driftDirection = index % 2 === 0 ? -1 : 1;
    const offsetX = driftDirection * cell * (local * 0.16 + fall * fall * 0.58);
    const rotation = driftDirection * local * Math.PI * 0.72;
    const fade = local < 0.72 ? 1 : 1 - (local - 0.72) / 0.28;
    const length = cell * 0.46;
    const thickness = Math.max(2, cell * 0.22);

    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(startX + offsetX, startY + offsetY);
    ctx.rotate(angle + rotation);
    const connectorShadowOffset = Math.max(1.5, cell * 0.055);
    ctx.fillStyle = "rgba(24, 36, 19, 0.28)";
    ctx.beginPath();
    ctx.roundRect(-length / 2 + connectorShadowOffset, -thickness / 2 + connectorShadowOffset, length, thickness, thickness / 2);
    ctx.fill();
    ctx.fillStyle = lightenColor(snakeColors.body, 0.25);
    ctx.beginPath();
    ctx.roundRect(-length / 2, -thickness / 2, length, thickness, thickness / 2);
    ctx.fill();
    ctx.restore();
  });

  animation.segments.forEach((part, index) => {
    const rawLocal = (elapsed - index * animation.delayMs) / DEATH_TILE_DURATION_MS;
    if (rawLocal >= 1) return;
    const local = Math.max(0, rawLocal);

    const baseInset = Math.max(3, cell * (index === 0 ? 0.105 : 0.135));
    const rect = cellRect(part, baseInset);
    const jumpEnd = 0.34;
    const jumpHeight = cell * 0.72;
    let offsetY;
    if (local <= jumpEnd) {
      offsetY = -Math.sin((local / jumpEnd) * Math.PI / 2) * jumpHeight;
    } else {
      const fall = (local - jumpEnd) / (1 - jumpEnd);
      const distanceBelowScreen = canvas.height - rect.y + cell;
      offsetY = -jumpHeight + fall * fall * distanceBelowScreen;
    }
    const fade = local < 0.78 ? 1 : 1 - (local - 0.78) / 0.22;
    const y = rect.y + offsetY;

    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    const shadowOffset = Math.max(2, cell * 0.08);
    const isTail = index === animation.segments.length - 1 && index !== 0;
    ctx.fillStyle = "rgba(24, 36, 19, 0.32)";
    if (isTail) {
      drawTail({ ...rect, x: rect.x + shadowOffset, y: y + shadowOffset }, part, animation.segments[index - 1]);
    } else {
      drawRoundedRect(rect.x + shadowOffset, y + shadowOffset, rect.size, rect.size);
    }
    ctx.fillStyle = index === 0 ? snakeColors.head : snakeColors.body;
    if (isTail) {
      const previousPart = animation.segments[index - 1];
      drawTail({ ...rect, y }, part, previousPart);
    } else {
      drawRoundedRect(rect.x, y, rect.size, rect.size);
      ctx.fillStyle = "rgba(156, 172, 119, 0.22)";
      ctx.fillRect(rect.x + 3, y + 3, Math.max(1, rect.size - 6), Math.max(2, rect.size * 0.12));
    }
    if (index === 0) drawEyes(rect.x, y, rect.size, animation.direction);
    ctx.restore();
  });

  drawDeathSeedBurst(animation, elapsed, cell);
}

function drawDeathSeedBurst(animation, elapsed, cell) {
  const head = animation.segments[0];
  if (!head || elapsed < 0 || elapsed >= DEATH_SEED_DURATION_MS) return;
  const progress = elapsed / DEATH_SEED_DURATION_MS;
  const originX = boardMetrics.x + (head.x + 0.5) * cell;
  const originY = boardMetrics.y + (head.y + 0.5) * cell;
  const fade = progress < 0.62 ? 1 : 1 - (progress - 0.62) / 0.38;

  animation.seeds.forEach((seed, index) => {
    const distance = seed.distance * cell * progress;
    const x = originX + Math.cos(seed.angle) * distance;
    // Give the burst a clearly readable ascent instead of relying on a short
    // ballistic curve whose apex was easy to miss at phone scale. Every seed
    // rises for nearly half the effect, then drops past its starting point.
    const ascentEnd = 0.44;
    const riseHeight = cell * (0.9 + seed.distance * 0.32);
    const y = progress <= ascentEnd
      ? originY - Math.sin((progress / ascentEnd) * Math.PI / 2) * riseHeight
      : originY - riseHeight
        + Math.pow((progress - ascentEnd) / (1 - ascentEnd), 2) * (riseHeight + cell * 3);
    const size = Math.max(3, cell * seed.size);
    const shadowOffset = Math.max(1, size * 0.18);

    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(x, y);
    ctx.rotate(seed.spin * progress + index * 0.12);
    ctx.fillStyle = "rgba(24, 36, 19, 0.28)";
    ctx.fillRect(-size / 2 + shadowOffset, -size / 2 + shadowOffset, size, size);
    ctx.fillStyle = "#182413";
    const cut = size * 0.3;
    ctx.fillRect(-size / 2, -size / 2, size, cut);
    ctx.fillRect(-size / 2, size / 2 - cut, size, cut);
    ctx.fillRect(-size / 2, -size / 2 + cut, cut, size - cut * 2);
    ctx.fillRect(size / 2 - cut, -size / 2 + cut, cut, size - cut * 2);
    ctx.restore();
  });
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

const CRUMB_DURATION_MS = 1440;
const CRUMB_MAX_DURATION_MS = CRUMB_DURATION_MS * 1.35;
const CRUMBS_PER_BITE = 6;
const CRUMB_DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};
const CRUMB_SHAPES = [
  [[0, 0]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[1, 0], [1, 1], [1, 2], [0, 2]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]]
];

function crumbDirectionForBite(head) {
  const previousHead = snake?.[0];
  const x = head.x - (previousHead?.x ?? head.x);
  const y = head.y - (previousHead?.y ?? head.y);
  return Math.abs(x) + Math.abs(y) === 1
    ? { x, y }
    : { ...(CRUMB_DIRECTION_VECTORS[direction] || CRUMB_DIRECTION_VECTORS.right) };
}

function startCrumbAnimation(head) {
  if (effectiveReducedMotion() || !head) return;
  crumbAnimations.push({
    startedAt: performance.now(),
    head: { ...head },
    direction: crumbDirectionForBite(head),
    particles: Array.from({ length: CRUMBS_PER_BITE }, (_, index) => ({
      drift: (Math.random() - 0.5) * (0.7 + index * 0.08),
      drop: 2.1 + Math.random() * 1.6,
      forward: 0.12 + Math.random() * 0.16,
      size: 0.07 + Math.random() * 0.04,
      delay: index * 22,
      duration: CRUMB_DURATION_MS * (0.65 + Math.random() * 0.7),
      shape: CRUMB_SHAPES[Math.floor(Math.random() * CRUMB_SHAPES.length)],
      rotation: Math.floor(Math.random() * 4),
      tumbles: 1 + Math.floor(Math.random() * 3),
      spinDirection: Math.random() < 0.5 ? -1 : 1
    }))
  });
}

function drawCrumbShape(crumb, blockSize, color) {
  const width = Math.max(...crumb.shape.map(([x]) => x)) + 1;
  const height = Math.max(...crumb.shape.map(([, y]) => y)) + 1;
  const pixelSize = blockSize > 2 ? blockSize - 1 : blockSize;
  const left = -width * blockSize / 2;
  const top = -height * blockSize / 2;

  ctx.fillStyle = "rgba(24, 36, 19, 0.28)";
  crumb.shape.forEach(([blockX, blockY]) => {
    ctx.fillRect(left + blockX * blockSize + 1, top + blockY * blockSize + 1, pixelSize, pixelSize);
  });
  ctx.fillStyle = color;
  crumb.shape.forEach(([blockX, blockY]) => {
    ctx.fillRect(left + blockX * blockSize, top + blockY * blockSize, pixelSize, pixelSize);
  });
}

function drawCrumbs() {
  if (effectiveReducedMotion()) {
    crumbAnimations = [];
    return;
  }

  const now = performance.now();
  const cell = boardMetrics.cellSize;
  crumbAnimations = crumbAnimations.filter((animation) => now - animation.startedAt < CRUMB_MAX_DURATION_MS + CRUMBS_PER_BITE * 22);

  crumbAnimations.forEach((animation) => {
    const originX = boardMetrics.x + (animation.head.x + 0.5) * cell;
    const originY = boardMetrics.y + (animation.head.y + 0.58) * cell;
    animation.particles.forEach((crumb, index) => {
      const elapsed = now - animation.startedAt - crumb.delay;
      if (elapsed < 0 || elapsed >= crumb.duration) return;
      const progress = elapsed / crumb.duration;
      const directionalX = animation.direction.x * crumb.forward;
      const directionalY = animation.direction.y * crumb.forward * 0.65;
      const x = originX + (crumb.drift + directionalX) * cell * progress;
      const y = originY + cell * (crumb.drop * progress * progress + directionalY * progress + index * 0.025 * progress);
      const blockSize = Math.max(2, Math.round(cell * crumb.size));
      const fade = progress < 0.65 ? 1 : 1 - (progress - 0.65) / 0.35;
      const completedTurns = Math.min(crumb.tumbles, Math.floor(progress * (crumb.tumbles + 1)));

      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate((crumb.rotation + completedTurns * crumb.spinDirection) * Math.PI / 2);
      drawCrumbShape(crumb, blockSize, index % 3 === 0 ? "#4b562f" : "#182413");
      ctx.restore();
    });
  });
}

// The "swallowed seed" bulge occupies mainly ONE block at a time and hops down
// the body, one segment every DIGESTION_SEGMENT_DELAY ms, until it reaches the
// tail and vanishes. Its pace is proportional to the snake's tick interval,
// retaining the former 70 ms / 190 ms visual relationship: it starts slower
// with the snake and accelerates as the run speeds up. The segment on each
// side of the active one gets a small fraction of the bulge (a soft shoulder)
// so the lump doesn't look like it's snapping between blocks.
const DIGESTION_SEGMENT_DELAY_RATIO = 70 / 190;
const DIGESTION_NEIGHBOR_SHARE = 0.15;
// The bulge shrinks as it nears the tail, bottoming out at this fraction of
// full size right at the last segment (rather than vanishing/popping there).
const DIGESTION_TAIL_TAPER_FLOOR = 0.35;

function digestionSegmentDelay() {
  return tickMs * DIGESTION_SEGMENT_DELAY_RATIO;
}

function pruneDigestionAnimations() {
  const now = performance.now();
  const segmentDelay = digestionSegmentDelay();
  digestionAnimations = digestionAnimations.filter((animation) => {
    // Done once the lump has passed the last segment.
    return now - animation.startedAt < animation.snakeLength * segmentDelay;
  });
}

function digestionPulseForSegment(index, now) {
  const segmentDelay = digestionSegmentDelay();
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
  const pulse = state === "running" && !effectiveReducedMotion() ? Math.sin(performance.now() / 130) * boardMetrics.cellSize * 0.05 : 0;

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
  syncPrimaryActionButton();
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

function syncPrimaryActionButton() {
  if (!pauseButton) return;
  const usesLargeDpad = controlsEl?.classList.contains("is-large-dpad-controls");
  const label = !usesLargeDpad ? "Pause"
    : state === "gameover" ? "Reset"
    : state === "ready" ? "Start"
    : state === "paused" ? "Resume"
    : "Pause";
  pauseButton.textContent = label;
  pauseButton.removeAttribute("aria-label");
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
    if (route.id === selectedTradeRouteId) line.classList.add("is-selected"); line.dataset.routeId = route.id; line.setAttribute("role", "button"); line.setAttribute("tabindex", "0"); line.setAttribute("aria-pressed", String(route.id === selectedTradeRouteId)); line.setAttribute("aria-label", `Manage trade route between ${settlements.find((item) => item.id === route.settlementAId)?.name || route.settlementAId} and ${settlements.find((item) => item.id === route.settlementBId)?.name || route.settlementBId}`); tradeRouteNetworkEl.append(line);
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
  minigamesNextEl.textContent = activeSettlementIsFounding()
    ? "Unavailable while founding"
    : minigamesMaxed ? "Next: Maximum games" : `Next: phone game ${nextMinigame}`;
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
    key.disabled = !unlocked;
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
  const unavailableWhileFounding = type === "minigames" && activeSettlementIsFounding();
  button.disabled = unavailableWhileFounding || maxed || seedsTotal < cost;
  button.textContent = unavailableWhileFounding ? "Unavailable while founding" : maxed ? "Maxed" : `Buy ${formatNumber(cost)}`;
  button.title = unavailableWhileFounding ? "Minigame upgrades are unavailable while this settlement is founding." : "";
}

function activeSettlementIsFounding() {
  const migrationState = latestSnapshot?.migration;
  return migrationState?.settlements?.find((item) => item.id === migrationState.activeSettlementId)?.status === "founding";
}

function grantMinigameFunds() {
  const grant = upgradeConfig.minigames.levels.reduce(
    (total, _level, level) => total + upgradeCost(upgradeConfig.minigames, level),
    0
  );
  const result = session.dispatch({ type: "addSeeds", amount: grant });
  latestSnapshot = result.snapshot;
  seedsTotal = result.snapshot.seeds;
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
  best = snapshot.best;
  mirrorEconomyFromWorld(now, snapshot);
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
  if (readyStartPrompt) {
    const resetPrompt = state === "gameover";
    readyStartPrompt.hidden = !(resetPrompt || (gameMode === "snake" && text === "Ready"));
    readyStartPrompt.textContent = resetPrompt ? "Press any control to reset." : "Press any control to begin.";
  }
  overlay.classList.add("visible");
  if (gameStatus) gameStatus.textContent = `${gameMode === "snake" ? "Snake Forever" : gameMode}: ${text}`;
  if (canvas) canvas.setAttribute("aria-label", `${gameMode === "snake" ? "Snake Forever" : gameMode} play field: ${text}`);
}

function showDeathOverlay(text) {
  clearTimeout(deathOverlayTimer);
  deathOverlayTimer = null;
  if (effectiveReducedMotion() || !deathAnimation) {
    showOverlay(text);
    return;
  }

  // Publish the state immediately for assistive technology, but keep the
  // centered panel out of the way until the seed burst reaches its apex.
  showOverlay(text);
  overlay.classList.remove("visible");
  if (readyStartPrompt) readyStartPrompt.hidden = true;
  const animationAtDeath = deathAnimation;
  deathOverlayTimer = window.setTimeout(() => {
    deathOverlayTimer = null;
    if (state === "gameover" && gameMode === "snake" && deathAnimation === animationAtDeath) showOverlay(text);
  }, DEATH_SEED_DURATION_MS * 0.46);
}

function hideOverlay() {
  overlay.classList.remove("visible");
  if (readyStartPrompt) readyStartPrompt.hidden = true;
  if (state === "running") {
    if (gameStatus) gameStatus.textContent = `${gameMode === "snake" ? "Snake Forever" : gameMode}: Running`;
    if (canvas) canvas.setAttribute("aria-label", `${gameMode === "snake" ? "Snake Forever" : gameMode} play field: Running`);
  }
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

function isLocalDevelopmentMode(locationLike = window.location) {
  const hostname = String(locationLike?.hostname || "").replace(/^\[|\]$/g, "").toLowerCase();
  const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  return loopback && new URLSearchParams(locationLike?.search || "").get("dev") === "1";
}

document.addEventListener("keydown", (event) => {
  if (state === "gameover" && event.code === "Escape") {
    event.preventDefault();
    resetGame();
    return;
  }

  if (event.code === "Escape") {
    event.preventDefault();
    returnToRegularSnake();
    return;
  }

  if (isLocalDevelopmentMode() && event.code === "KeyG" && event.shiftKey) {
    event.preventDefault();
    grantMinigameFunds();
    return;
  }

  if (isLocalDevelopmentMode() && event.code === "KeyH" && event.shiftKey) {
    event.preventDefault();
    if (!event.repeat) grantAdultSnakes();
    return;
  }

  if (isLocalDevelopmentMode() && event.code === "KeyN" && event.shiftKey) {
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
    if (released === "left" || released === "right") setCentipedeAxis("x", 0);
    else if (released === "up" || released === "down") setCentipedeAxis("y", 0);
    return;
  }

  if (gameMode !== "breakout" || !breakout) return;
  if (event.code === "ArrowLeft" || event.code === "KeyA" || event.code === "ArrowRight" || event.code === "KeyD") {
    setBreakoutAxis(0);
  }
});

window.addEventListener("blur", () => {
  activeDirectionKeys.clear();
  activeDirectionClicks.clear();
  directionPointerStarts.clear();
  swipePointerStarts.clear();
  directionClickTimers.forEach((timer) => clearTimeout(timer));
  directionClickTimers.clear();
  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.classList.remove("is-pressed");
  });
  if (gameMode === "breakout" && breakout) setBreakoutAxis(0);
  if (gameMode === "centipede" && centipede) { setCentipedeAxis("x", 0); setCentipedeAxis("y", 0); }
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
    if (gameMode === "breakout" && breakout) setBreakoutAxis(0);
    if (gameMode === "centipede" && centipede) { setCentipedeAxis("x", 0); setCentipedeAxis("y", 0); }
  });
  button.addEventListener("pointercancel", (event) => {
    directionPointerStarts.delete(event.pointerId);
    if (gameMode === "breakout" && breakout) setBreakoutAxis(0);
    if (gameMode === "centipede" && centipede) { setCentipedeAxis("x", 0); setCentipedeAxis("y", 0); }
  });
});
document.addEventListener("pointerup", (event) => {
  const pointerStart = directionPointerStarts.get(event.pointerId);
  if (pointerStart) {
    directionPointerStarts.delete(event.pointerId);
    animateDirectionClick(pointerStart.directionName, performance.now() - pointerStart.startedAt);
  }

  if (gameMode === "breakout" && breakout) setBreakoutAxis(0);
  if (gameMode === "centipede" && centipede) { setCentipedeAxis("x", 0); setCentipedeAxis("y", 0); }
});

// Swipes are intentionally limited to the continuously moving Snake mode.
// Other minigames either need held-axis input or already use the board itself.
canvas.addEventListener("pointerdown", (event) => {
  if (!savedMobileControls().swipeControls || gameMode !== "snake") return;
  swipePointerStarts.set(event.pointerId, { x: event.clientX, y: event.clientY });
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener("pointerup", (event) => {
  const start = swipePointerStarts.get(event.pointerId);
  if (!start) return;
  swipePointerStarts.delete(event.pointerId);
  const deltaX = event.clientX - start.x;
  const deltaY = event.clientY - start.y;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) return;
  queueDirection(Math.abs(deltaX) > Math.abs(deltaY)
    ? (deltaX > 0 ? "right" : "left")
    : (deltaY > 0 ? "down" : "up"));
});
canvas.addEventListener("pointercancel", (event) => swipePointerStarts.delete(event.pointerId));

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", activatePrimaryAction);
resetButton.addEventListener("click", resetGame);
reducedMotionButton?.addEventListener("click", toggleReducedMotion);
swipeControlsButton?.addEventListener("click", () => toggleMobileControl("swipeControls"));
biggerDpadButton?.addEventListener("click", () => toggleMobileControl("biggerDpad"));
minimizedKeypadButton?.addEventListener("click", () => {
  const open = !minigameKeypadEl?.classList.contains("is-open");
  minigameKeypadEl?.classList.toggle("is-open", open);
  minimizedKeypadButton.setAttribute("aria-expanded", String(open));
});
largeDpadPersonalizeButton?.addEventListener("click", () => {
  if (personalizationScreen.hidden && saveDataScreen.hidden) {
    showPersonalization();
    return;
  }
  personalizationScreen.hidden = true;
  saveDataScreen.hidden = true;
  syncLargeDpadPersonalizeButton();
});
reducedMotionButton?.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) toggleReducedMotion();
});

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
    battleshipFire(cell.x, cell.y);
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
    const removedPrimary = safeStorage("remove", consolidatedSaveKey);
    const removedBackup = safeStorage("remove", consolidatedBackupKey);
    if (!removedPrimary.ok || !removedBackup.ok) { reportStorageFailure((!removedPrimary.ok ? removedPrimary : removedBackup).kind); resettingProgress = false; return; }
    saveKeysLegacyList.forEach((key) => {
      safeStorage("remove", `${savePrefix}${key}`);
      safeStorage("remove", `${legacySavePrefix}${key}`);
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
function selectTradeRoute(routeId, focus = false) {
  if (!routeId || !latestSnapshot?.migration || selectedTradeRouteId === routeId) return;
  selectedTradeRouteId = routeId;
  syncTradeRoutesPanel(latestSnapshot.migration);
  if (focus) tradeRouteNetworkEl?.querySelector(`[data-route-id="${CSS.escape(routeId)}"]`)?.focus();
}
tradeRouteNetworkEl?.addEventListener("click", (event) => selectTradeRoute(event.target.dataset.routeId));
tradeRouteNetworkEl?.addEventListener("keydown", (event) => {
  if (!event.target.dataset.routeId || !["Enter", " ", "Spacebar"].includes(event.key)) return;
  event.preventDefault();
  selectTradeRoute(event.target.dataset.routeId, true);
});
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
broodlineMoveUpButton?.addEventListener("click", () => dispatchBroodlineFormation({ type: "broodlineMove", direction: "up" }));
broodlineMoveDownButton?.addEventListener("click", () => dispatchBroodlineFormation({ type: "broodlineMove", direction: "down" }));
broodlineContinueButton?.addEventListener("click", () => dispatchBroodlineFormation({ type: "broodlineContinue" }));
broodlineEndButton?.addEventListener("click", () => dispatchBroodlineFormation({ type: "broodlineEnd" }));
upgradeButtons.board.addEventListener("click", () => purchaseUpgrade("board"));
upgradeButtons.foodType.addEventListener("click", () => purchaseUpgrade("foodType"));
upgradeButtons.foodCount.addEventListener("click", () => purchaseUpgrade("foodCount"));
upgradeButtons.shield.addEventListener("click", () => purchaseUpgrade("shield"));
upgradeButtons.minigames.addEventListener("click", () => purchaseUpgrade("minigames"));
minigameKeys.forEach((key) => {
  key.addEventListener("click", () => {
    if (state === "gameover") {
      resetGame();
      return;
    }
    const gameNumber = Number(key.dataset.minigame);
    // Intentional hidden route: key 9 normally starts Centipede, but from Duel
    // it launches Runner. Runner is not an additional paid unlock.
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
    const unlocked = gameNumber === 0 || gameNumber <= upgrades.minigamesLevel;
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
if (startupStorageNotice) setScreenHint(startupStorageNotice);
syncPanels(Date.now());
cancelAnimationFrame(animationId);
animationId = requestAnimationFrame((now) => {
  lastFrameAt = now;
  gameLoop(now);
});
