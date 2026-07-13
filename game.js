const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
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
const snakebirdScreen = document.querySelector("#snakebirdScreen");
const snakebirdLevelButtons = document.querySelectorAll("[data-snakebird-level]");
const snakebirdPickerStatus = document.querySelector("#snakebirdPickerStatus");
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
const layEggButton = document.querySelector("#layEggButton");
const nurserySeedStatusEl = document.querySelector("#nurserySeedStatus");
const nestStateEl = document.querySelector("#nestState");
const nestVisualEl = document.querySelector("#nestVisual");
const nestTimerEl = document.querySelector("#nestTimer");
const nurseryCapacityEl = document.querySelector("#nurseryCapacity");
const nurseryGrowthStatusEl = document.querySelector("#nurseryGrowthStatus");
const nurseryGridEl = document.querySelector("#nurseryGrid");
const hatchlingListEl = document.querySelector("#hatchlingList");
const colonyCountEl = document.querySelector("#colonyCount");
const colonyPlacedCountEl = document.querySelector("#colonyPlacedCount");
const colonyIncomeRateEl = document.querySelector("#colonyIncomeRate");
const habitatListEl = document.querySelector("#habitatList");

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
const startTickMs = 190;
const minTickMs = 82;
const maxQueuedDirections = 2;
const nurseryConfig = {
  columns: 12,
  rows: 15,
  capacity: 2,
  eggCost: 500,
  eggHatchMs: 5 * 60 * 1000,
  growthMs: 10 * 60 * 1000,
  twoBlockMs: 2 * 60 * 1000,
  threeBlockMs: 7 * 60 * 1000,
  seedIntervalMs: 1000,
  moveIntervalMs: 430
};
const habitatConfig = {
  income: {
    basePerSecond: 0.01,
    foodValueMultiplier: true,
    milestoneMode: "multiply"
  },
  habitats: [
    {
      name: "Field",
      unlockScore: 0,
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
      incomeMultiplier: 0.75,
      milestones: [
        { score: 25, multiplier: 1.12 },
        { score: 75, multiplier: 1.25 },
        { score: 150, multiplier: 1.4 }
      ]
    },
    {
      name: "Forest",
      unlockScore: 25,
      incomeMultiplier: 1,
      milestones: [
        { score: 50, multiplier: 1.15 },
        { score: 100, multiplier: 1.3 },
        { score: 250, multiplier: 1.5 }
      ]
    },
    {
      name: "River",
      unlockScore: 50,
      incomeMultiplier: 2,
      milestones: [
        { score: 100, multiplier: 1.18 },
        { score: 250, multiplier: 1.35 },
        { score: 500, multiplier: 1.65 }
      ]
    },
    {
      name: "Cave",
      unlockScore: 100,
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
let best = Number(localStorage.getItem("idlesnake-best") || 0);
let crossingBest = Number(localStorage.getItem("idlesnake-crossing-best") || 0);
if (!Number.isFinite(crossingBest)) crossingBest = 0;
let seedsTotal = Number(localStorage.getItem("idlesnake-seeds") || 0);
let upgrades = savedUpgrades;
let snakeColors = readSnakeColors();
let snake;
let previousSnake;
let digestionAnimations = [];
let foods;
let direction;
let nextDirection;
let directionQueue;
let score;
let state;
let tickMs;
let elapsedMs;
let lastFrameAt;
let timerStarted;
let animationId;
let nurseryClockId;
let boardMetrics;
let nursery = readNursery();
let habitats = readHabitats();
let nurseryCells = [];
let habitatCardRefs = [];
let gameMode = "snake";
let snakebird;
let snakebirdProgress;
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
const duelTickMs = 125;
let maze;
let mazePath;
let mazeDirection;
let mazeScore;
let mazeBest = Number(localStorage.getItem("idlesnake-maze-best") || 0);
let mazeLayoutIndex;
let mazeTravelDirection;
let mazeChoiceDirections;
let mazePendingChoices;
let mazePendingEnd;
const mazeGrid = { columns: 21, rows: 21 };
const mazeTickMs = 105;
const crossingGrid = { columns: 15, rows: 13 };
const crossingTickMs = 82;
let crossingStage;
let crossingScore;
let crossingSnake;
let previousCrossingSnake;
let crossingCars;
let crossingPhase;
let crossingTransitionUntil;
const mazeStart = { x: 10, y: 15 };
const mazeExit = { x: 10, y: 0 };
let breakout;
let breakoutBest = Number(localStorage.getItem("idlesnake-breakout-best") || 0);
let sokoban;
let sokobanBest = Number(localStorage.getItem("idlesnake-sokoban-best") || 0);
let broodline;
const broodlineGrid = { columns: 30, rows: 30 };
const broodlineTickMs = 220;
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
  paddleSpeed: 330,
  ballSpeed: 258,
  powerupDropChance: 0.18,
  powerupFallSpeed: 92
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

function freshGame() {
  hideSnakebirdPicker();
  gameMode = "snake";
  setScreenHint("");
  grid = parseGridSize(upgradeConfig.board.levels[selectedBoardLevel]);
  const centerX = Math.floor(grid.columns / 2);
  const centerY = Math.floor(grid.rows / 2);
  snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY }
  ];
  previousSnake = snake.map((part) => ({ ...part }));
  digestionAnimations = [];
  direction = "right";
  nextDirection = "right";
  directionQueue = [];
  score = 0;
  state = "ready";
  tickMs = startTickMs;
  elapsedMs = 0;
  lastFrameAt = 0;
  stepAccumulatorMs = 0;
  timerStarted = false;
  boardMetrics = getBoardMetrics();
  foods = spawnFoods();
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
    const saved = JSON.parse(localStorage.getItem("idlesnake-colors") || "{}");
    return {
      body: snakeColorChoices.body.some((choice) => choice.value === saved.body) ? saved.body : fallback.body,
      head: snakeColorChoices.head.some((choice) => choice.value === saved.head) ? saved.head : fallback.head
    };
  } catch {
    return fallback;
  }
}

function saveSnakeColors() {
  localStorage.setItem("idlesnake-colors", JSON.stringify(snakeColors));
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

function readSnakebirdProgress() {
  const fallback = {
    unlockedLevel: 1,
    clearedLevels: [false, false, false, false, false],
    bestMoves: [null, null, null, null, null],
    lastSelectedLevel: 1
  };

  try {
    const saved = JSON.parse(localStorage.getItem("idlesnake-snakebird") || "{}");
    return snakebirdEngine.normalizeProgress(saved, snakebirdLevels.length);
  } catch {
    return fallback;
  }
}

function saveSnakebirdProgress() {
  localStorage.setItem("idlesnake-snakebird", JSON.stringify(snakebirdProgress));
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

function showSnakebirdPicker() {
  if (!snakebirdScreen) return;
  hidePersonalization();
  snakebirdScreen.hidden = false;
  hideOverlay();
  if (state === "running") state = "paused";
  syncSnakebirdPicker();
}

function hideSnakebirdPicker() {
  if (snakebirdScreen) snakebirdScreen.hidden = true;
}

function syncSnakebirdPicker() {
  if (!snakebirdScreen || !snakebirdPickerStatus) return;
  snakebirdLevelButtons.forEach((button) => {
    const levelNumber = Number(button.dataset.snakebirdLevel);
    const index = levelNumber - 1;
    const unlocked = levelNumber <= snakebirdProgress.unlockedLevel;
    const cleared = snakebirdProgress.clearedLevels[index];
    const bestMoves = snakebirdProgress.bestMoves[index];
    button.disabled = !unlocked;
    button.classList.toggle("is-locked", !unlocked);
    button.classList.toggle("is-cleared", cleared);
    button.classList.toggle("is-selected", snakebird?.levelIndex === index);
    button.setAttribute("aria-label", `Level ${levelNumber}${cleared ? ` cleared in ${bestMoves} moves` : unlocked ? " available" : " locked"}`);
    button.title = !unlocked ? "Clear the previous level to unlock" : cleared ? `Best: ${bestMoves} moves` : "Play level";
  });

  const selectedLevel = snakebird ? snakebird.levelIndex + 1 : snakebirdProgress.lastSelectedLevel;
  const definition = snakebirdLevels[selectedLevel - 1];
  const bestMoves = snakebirdProgress.bestMoves[selectedLevel - 1];
  snakebirdPickerStatus.textContent = `${selectedLevel}. ${definition.name} · ${bestMoves ? `Best ${bestMoves} moves` : "Not cleared yet"}`;
}

function selectSnakebirdLevel(levelNumber) {
  const index = Number(levelNumber) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= snakebirdLevels.length) return;
  if (index + 1 > snakebirdProgress.unlockedLevel) return;

  snakebirdProgress.lastSelectedLevel = index + 1;
  saveSnakebirdProgress();
  loadSnakebirdLevel(index);
  hideSnakebirdPicker();
}

function loadSnakebirdLevel(levelIndex) {
  const safeIndex = Math.max(0, Math.min(snakebirdLevels.length - 1, levelIndex));
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
  syncSnakebirdPicker();
  render();
  showOverlay(`Level ${safeIndex + 1} · Ready`);
  setScreenHint("Arrow keys / D-pad: move · collect all fruit · reach the exit");
}

function launchSnakebird(showPicker = true) {
  hidePersonalization();
  gameMode = "snakebird";
  const selectedLevel = Math.max(1, Math.min(snakebirdProgress.unlockedLevel, snakebirdProgress.lastSelectedLevel));
  loadSnakebirdLevel(selectedLevel - 1);
  if (showPicker) showSnakebirdPicker();
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
    localStorage.setItem("idlesnake-seeds", String(seedsTotal));
    saveSnakebirdProgress();
    snakebird.nextLevelIndex = index < snakebirdLevels.length - 1 ? index + 1 : 0;
    if (index < snakebirdLevels.length - 1) {
      snakebirdProgress.lastSelectedLevel = index + 2;
      saveSnakebirdProgress();
    }
    syncHud();
    showOverlay(`Level ${index + 1} Clear · +${formatNumber(reward)} Seeds`);
    setScreenHint(index < snakebirdLevels.length - 1
      ? `Next level ready · Space / Start for Level ${index + 2}`
      : "Campaign clear · Space / Start for Level 1");
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
  const definition = sokobanLevels[stageIndex];
  const walls = new Set();
  definition.map.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "#") walls.add(sokobanKey({ x, y }));
    });
  });
  return {
    stageIndex,
    width: sokobanGrid.columns,
    height: sokobanGrid.rows,
    walls,
    snake: cloneSokobanPoints(definition.snake),
    previousSnake: cloneSokobanPoints(definition.snake),
    crates: definition.crates.map((crate) => ({ ...crate })),
    previousCrates: definition.crates.map((crate) => ({ ...crate })),
    goals: cloneSokobanPoints(definition.goals),
    plates: definition.plates.map((plate) => ({ ...plate })),
    gates: definition.gates.map((gate) => ({ ...gate })),
    pellets: cloneSokobanPoints(definition.pellets),
    moves: 0,
    score: 0,
    result: null
  };
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

  const vector = vectors[directionName];
  const head = sokoban.snake[0];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
  const crate = sokobanCrateAt(nextHead);
  const snakeWithoutTail = sokoban.snake.slice(0, -1);

  if (!sokobanIsOpen(nextHead)) return false;
  if (snakeWithoutTail.some((part) => part.x === nextHead.x && part.y === nextHead.y)) return false;

  let nextCratePoint = null;
  if (crate) {
    if (crate.kind === "heavy" && (sokoban.snake.length < 5 || !sokobanIsBraced(directionName))) return false;
    nextCratePoint = { x: crate.x + vector.x, y: crate.y + vector.y };
    const blockedBySnake = snakeWithoutTail.some((part) => part.x === nextCratePoint.x && part.y === nextCratePoint.y);
    const blockedByOtherCrate = sokoban.crates.some((candidate) => candidate !== crate && candidate.x === nextCratePoint.x && candidate.y === nextCratePoint.y);
    if (!sokobanIsOpen(nextCratePoint) || blockedBySnake || blockedByOtherCrate) return false;
  }

  sokoban.previousSnake = cloneSokobanPoints(sokoban.snake);
  sokoban.previousCrates = sokoban.crates.map((candidate) => ({ ...candidate }));
  sokoban.snake.unshift(nextHead);
  const pelletIndex = sokoban.pellets.findIndex((pellet) => pellet.x === nextHead.x && pellet.y === nextHead.y);
  const grew = pelletIndex >= 0;
  if (grew) sokoban.pellets.splice(pelletIndex, 1);
  else sokoban.snake.pop();

  if (crate && nextCratePoint) {
    crate.x = nextCratePoint.x;
    crate.y = nextCratePoint.y;
  }

  direction = directionName;
  nextDirection = directionName;
  sokoban.moves += 1;
  sokoban.score = sokoban.crates.filter((candidate) => sokobanIsGoal(candidate)).length * 100 +
    (sokobanLevels[sokoban.stageIndex].pellets.length - sokoban.pellets.length) * 10;
  const won = sokoban.crates.every((candidate) => sokobanIsGoal(candidate));
  if (won) {
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
  localStorage.setItem("idlesnake-seeds", String(seedsTotal));
  localStorage.setItem("idlesnake-sokoban-best", String(sokobanBest));
  syncHud();
  showOverlay(`Stage ${sokoban.stageIndex + 1} Clear · +${formatNumber(reward)} Seeds`);
  setScreenHint(sokoban.stageIndex < sokobanLevels.length - 1
    ? "Start for the next stage · Reset to replay"
    : "Campaign clear · Start to replay from stage 1");
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
  setScreenHint("McVey's Folly · steer with arrows");
  showOverlay("McVey's Folly · Ready");
}

function launchCrossing() {
  hideSnakebirdPicker();
  if (gameMode === "crossing" && state !== "gameover") return;
  gameMode = "crossing";
  grid = { ...crossingGrid };
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
  crossingSnake = [
    { x: 7, y: crossingGrid.rows - 1 },
    { x: 6, y: crossingGrid.rows - 1 },
    { x: 5, y: crossingGrid.rows - 1 }
  ];
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
    powerups: []
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

function breakoutPaddleWidth() {
  if (!breakout) return 0;
  return breakout.paddle.length * breakout.segmentSize + (breakout.paddle.length - 1) * breakout.gap;
}

function setBreakoutPaddleLength(length) {
  const center = breakout.paddle.x + breakoutPaddleWidth() / 2;
  breakout.paddle.length = length;
  breakout.paddle.x = Math.max(0, Math.min(boardMetrics.width - breakoutPaddleWidth(), center - breakoutPaddleWidth() / 2));
}

function buildBreakoutBall(index = 0) {
  const sign = index % 2 === 0 ? 1 : -1;
  return {
    x: boardMetrics.width / 2 + (index ? sign * 14 : 0),
    y: breakout.paddle.y - breakout.segmentSize - 34,
    radius: Math.max(5, Math.floor(breakout.segmentSize * 0.23)),
    vx: breakoutConfig.ballSpeed * 0.62 * sign,
    vy: -breakoutConfig.ballSpeed * 0.78
  };
}

function createBreakoutPowerup(type, x, y) {
  return {
    type,
    x,
    y,
    radius: Math.max(6, Math.floor(breakout.segmentSize * 0.2))
  };
}

function randomBreakoutPowerupType() {
  const roll = Math.random();
  if (roll < 0.45) return "seed";
  if (roll < 0.72) return "heart";
  return "multiball";
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
  const saved = Number(localStorage.getItem("idlesnake-duel-grid-size"));
  return duelGridSizes.includes(saved) ? saved : 30;
}

function setDuelGridSize(size) {
  const nextSize = Number(size);
  if (!duelGridSizes.includes(nextSize)) return;
  selectedDuelGridSize = nextSize;
  duelGrid = squareGrid(selectedDuelGridSize);
  localStorage.setItem("idlesnake-duel-grid-size", String(selectedDuelGridSize));
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
function broodlineSpawnRound() {
  const occupied = new Set([broodlineKey(broodline.head), ...broodline.chain.map((part) => broodlineKey(part.pos))]);
  broodline.enemies = [];
  const rangedCount = Math.max(1, Math.round(broodlineRoundSize() / 4));
  for (let i = 0; i < broodlineRoundSize(); i += 1) {
    const pos = broodlineRandomOpen(occupied); occupied.add(broodlineKey(pos));
    const ranged = i < rangedCount;
    broodline.enemies.push({ type: ranged ? "ranged" : "melee", pos, hp: ranged ? 4 : 7, maxHp: ranged ? 4 : 7, cooldown: 0, stun: 0, burn: 0, poison: 0, target: null });
  }
  broodline.phase = "combat";
  state = "ready";
  hideBroodlineFormation();
  setScreenHint("Steer · attacks are automatic");
}
function launchBroodline() {
  gameMode = "broodline";
  grid = broodlineGrid;
  tickMs = broodlineTickMs;
  broodline = { round: 1, pendingSeeds: 0, kills: 0, hatchlingsCollected: 0, eggsHatched: 0, armor: 0, maxArmor: 0, phase: "combat", selected: 0,
    head: { x: 15, y: 15 }, camera: { x: 8, y: 8 }, chain: [], headColor: snakeColors.head, enemies: [], pickups: [], effects: [], direction: "right", queue: [] };
  broodlineSpawnRound();
  broodline.chain.forEach((part) => { part.pos = { ...part.pos }; });
  broodline.enemies.forEach((enemy) => { enemy.cooldown = Math.random() * 5; });
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
  if (broodline.queue.length) broodline.direction = broodline.queue.shift();
  const vector = vectors[broodline.direction]; const previousHead = { ...broodline.head }; const old = broodline.chain.map((part) => ({ ...part.pos }));
  const next = { x: broodline.head.x + vector.x, y: broodline.head.y + vector.y };
  if (next.x <= 0 || next.y <= 0 || next.x >= 29 || next.y >= 29) return broodlineEndRun("Wall death");
  const collision = broodline.chain.findIndex((part) => part.pos.x === next.x && part.pos.y === next.y);
  if (collision >= 0) { broodline.chain.splice(collision); broodline.effects.push({ pos: next, text: "TRUNCATED", ttl: 900 }); }
  const retainedLength = broodline.chain.length;
  const growthPos = retainedLength ? old[retainedLength - 1] : previousHead;
  broodline.head = next;
  broodline.chain.forEach((part, index) => { part.pos = index === 0 ? { ...previousHead } : { ...old[index - 1] }; });
  broodlineCollect(growthPos);
  const bite = broodlineNearestEnemy(next, { min: 0, max: 3 });
  const forward = broodlineNearestEnemy(next, { min: 3, max: 5 }, true);
  if (bite) broodlineDamage(bite, 2, "FANG BITE"); else if (forward) broodlineDamage(forward, 1, "VENOM");
  broodline.chain.slice(1).forEach((part) => {
    if (!["garden", "electric", "lava", "rattle"].includes(part.kind)) return;
    part.cooldown = Math.max(0, (part.cooldown || 0) - broodlineTickMs);
    const enemy = broodlineNearestEnemy(part.pos, part.kind === "rattle" || part.kind === "electric" ? 3 : 2);
    if (enemy && part.cooldown === 0) { broodlineDamage(enemy, part.kind === "rattle" ? 0 : 1, part.kind === "electric" ? "STUN" : part.kind === "lava" ? "BURN" : part.kind === "rattle" ? "POISON" : "GARDEN"); if (part.kind === "electric") enemy.stun = 3; if (part.kind === "lava") enemy.burn = 3; if (part.kind === "rattle") enemy.poison = 5; part.cooldown = part.kind === "garden" ? 500 : 900; }
  });
  const reserved = new Set();
  broodline.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    enemy.cooldown -= 1;
    enemy.stun = Math.max(0, enemy.stun - 1);
    if (enemy.burn > 0) { enemy.burn -= 1; broodlineDamage(enemy, 1, "BURN"); }
    if (enemy.poison > 0) { enemy.poison -= 1; broodlineDamage(enemy, 1, "POISON"); }
    if (enemy.hp <= 0 || enemy.stun) return;

    if (enemy.type === "melee") {
      const distance = broodlineManhattan(enemy.pos, broodline.head);
      enemy.target = "head";
      if (distance <= 1) {
        if (enemy.cooldown <= 0) { broodlineTakeDamage("head"); enemy.cooldown = 4; }
        return;
      }
      const attackCell = broodlineMeleeTargetCell(broodline.head, enemy);
      broodlineStepToward(enemy, attackCell || broodline.head, reserved);
      return;
    }

    const target = broodlineClosestBodyTarget(enemy.pos);
    // The fallback is the head, which is a coordinate rather than a chain part.
    const targetPos = target.index >= 0 ? target.part.pos : target.part;
    const distance = broodlineManhattan(enemy.pos, targetPos);
    enemy.target = target.index >= 0 ? target.index : "head";
    if (distance <= 5 && enemy.cooldown <= 0) {
      broodlineTakeDamage(target.index >= 0 ? target.index : "head");
      enemy.cooldown = 5;
    }
    if (distance < 3) broodlineStepAway(enemy, targetPos, reserved);
    else if (distance > 5) broodlineStepToward(enemy, targetPos, reserved);
    else reserved.add(broodlineKey(enemy.pos));
  });
  broodline.enemies = broodline.enemies.filter((enemy) => enemy.hp > 0); broodline.effects.forEach((effect) => effect.ttl -= broodlineTickMs); broodline.effects = broodline.effects.filter((effect) => effect.ttl > 0);
  broodline.chain.filter((part) => part.kind === "egg").forEach((egg) => { egg.hatchAt -= broodlineTickMs; if (egg.hatchAt <= 0) { egg.kind = ["garden", "garden", "garden", "cave", "rattle", "electric", "lava"][Math.floor(Math.random() * 7)]; broodline.eggsHatched += 1; broodline.pendingSeeds += 2; broodline.effects.push({ pos: { ...egg.pos }, text: "HATCH!", ttl: 1000 }); } });
  if (!broodline.enemies.length) { broodline.phase = "formation"; broodline.pendingSeeds += 10 + broodline.round; state = "paused"; showBroodlineFormation(); }
}
function broodlineTakeDamage(target = "head") {
  if (broodline.armor > 0) { broodline.armor -= 1; broodline.effects.push({ pos: { ...broodline.head }, text: "ARMOR", ttl: 700 }); return; }
  const bodyIndexes = broodline.chain.map((part, i) => part.kind === "body" ? i : -1).filter((i) => i >= 0);
  // A new run deliberately begins as a solo head. Until it collects its
  // first segment, an attack cannot remove a body part or end the run.
  if (!bodyIndexes.length) {
    broodline.effects.push({ pos: { ...broodline.head }, text: "DODGE", ttl: 600 });
    return;
  }
  const targetIndex = typeof target === "number" && bodyIndexes.includes(target) ? target : bodyIndexes.at(-1);
  broodline.chain.splice(targetIndex, 1);
  broodline.effects.push({ pos: { ...broodline.head }, text: target === "head" ? "HEAD HIT" : "SEGMENT HIT", ttl: 800 });
}
function broodlineEndRun(message) { broodline.phase = "ended"; state = "gameover"; seedsTotal += broodline.pendingSeeds; localStorage.setItem("idlesnake-seeds", String(seedsTotal)); syncHud(); showOverlay(`${message} · +${formatNumber(broodline.pendingSeeds)} Seeds`); hideBroodlineFormation(); }
function showBroodlineFormation() { syncBroodlineFormation(); broodlineScreen.hidden = false; broodlineFormationStatusEl.textContent = `Round ${broodline.round} clear · ${broodline.pendingSeeds} Seeds pending`; setScreenHint("Arrange the chain, then continue"); }
function hideBroodlineFormation() { if (broodlineScreen) broodlineScreen.hidden = true; }
function syncBroodlineFormation() { if (!broodlineChainEl || !broodline) return; broodlineChainEl.replaceChildren(...broodline.chain.map((part, index) => { const button = document.createElement("button"); button.className = `broodline-card${index === broodline.selected ? " is-selected" : ""}`; button.type = "button"; button.innerHTML = `<span>${broodlineSpeciesLabel(part.kind).toUpperCase()}</span><small>${part.kind === "egg" ? `${Math.ceil(part.hatchAt / 1000)}s` : "slot " + (index + 1)}</small>`; button.addEventListener("click", () => { broodline.selected = index; syncBroodlineFormation(); }); return button; })); }
function broodlineStartNext() { if (!broodline || broodline.phase !== "formation") return; broodline.round += 1; broodline.armor = broodline.maxArmor; broodlineSpawnRound(); state = "ready"; showOverlay(`Broodline · Round ${broodline.round}`); syncHud(); }

function isMinigameMode() {
  return ["duel", "maze", "breakout", "crossing", "snakebird", "sokoban", "broodline"].includes(gameMode);
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
  } else if (gameMode === "crossing") {
    state = "gameover";
    launchCrossing();
  } else if (gameMode === "snakebird") {
    loadSnakebirdLevel(snakebird?.nextLevelIndex ?? snakebird?.levelIndex ?? 0);
  } else if (gameMode === "sokoban") {
    loadSokobanLevel(sokoban?.stageIndex || 0);
  } else if (gameMode === "broodline") {
    launchBroodline();
  }
}

function startGame() {
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
    nestStartedAt: null,
    hatchlings: [],
    colonyCount: 0,
    lastUpdatedAt: Date.now(),
    seedTickAccumulatorMs: 0,
    movementAccumulatorMs: 0
  };

  try {
    const saved = JSON.parse(localStorage.getItem("idlesnake-nursery") || "{}");
    const hatchlings = Array.isArray(saved.hatchlings)
      ? saved.hatchlings.slice(0, nurseryConfig.capacity).map((hatchling, index) => ({
        id: String(hatchling.id || `hatchling-${index + 1}`),
        x: clampNumber(hatchling.x, 0, nurseryConfig.columns - 1, index === 0 ? 2 : 9),
        y: clampNumber(hatchling.y, 0, nurseryConfig.rows - 1, index === 0 ? 4 : 10),
        direction: vectors[hatchling.direction] ? hatchling.direction : index % 2 ? "left" : "right",
        progressMs: clampNumber(hatchling.progressMs, 0, nurseryConfig.growthMs, 0)
      }))
      : [];

    return {
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
    lastUpdatedAt: Date.now()
  };

  try {
    const saved = JSON.parse(localStorage.getItem("idlesnake-habitats") || "{}");
    const savedCounts = Array.isArray(saved.counts) ? saved.counts : [];
    return {
      counts: habitatConfig.habitats.map((_, index) => Math.floor(clampNumber(
        savedCounts[index],
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
  localStorage.setItem("idlesnake-nursery", JSON.stringify(nursery));
}

function saveHabitats() {
  localStorage.setItem("idlesnake-habitats", JSON.stringify(habitats));
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
    localStorage.setItem("idlesnake-seeds", String(seedsTotal));
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

function renderNurseryGrid() {
  nurseryCells.forEach((cell) => cell.classList.remove("is-body", "is-head"));

  nursery.hatchlings.forEach((hatchling) => {
    const vector = vectors[hatchling.direction] || vectors.right;
    const length = hatchlingLength(hatchling.progressMs);
    const parts = Array.from({ length }, (_, index) => ({
      x: hatchling.x - vector.x * index,
      y: hatchling.y - vector.y * index,
      head: index === 0
    }));
    parts.forEach((part) => {
      if (part.x < 0 || part.x >= nurseryConfig.columns || part.y < 0 || part.y >= nurseryConfig.rows) return;
      const cell = nurseryCells[part.y * nurseryConfig.columns + part.x];
      cell.classList.add(part.head ? "is-head" : "is-body");
    });
  });
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
        <div>
          <span class="upgrade-label">Habitat ${index + 1}</span>
          <strong class="habitat-name">${habitat.name}</strong>
        </div>
        <span class="upgrade-level habitat-state"></span>
      </div>
      <div class="habitat-stats">
        <span class="habitat-snakes"></span>
        <span class="habitat-income"></span>
      </div>
      <p class="habitat-unlock"></p>
      <div class="habitat-milestones"></div>
      <button class="upgrade-button habitat-place-button" type="button">Place snake</button>
    `;
    const button = card.querySelector(".habitat-place-button");
    button.addEventListener("click", () => placeSnakeInHabitat(index));
    const milestoneEls = habitat.milestones.map((milestone) => {
      const milestoneEl = document.createElement("span");
      milestoneEl.className = "habitat-milestone";
      milestoneEl.textContent = `○ ${formatNumber(milestone.score)} · ×${formatDecimal(milestone.multiplier, 2)}`;
      milestoneEl.title = `Earn with ${formatNumber(milestone.score)} snakes in this habitat`;
      return milestoneEl;
    });
    card.querySelector(".habitat-milestones").append(...milestoneEls);
    habitatListEl.append(card);
    return {
      card,
      button,
      state: card.querySelector(".habitat-state"),
      snakes: card.querySelector(".habitat-snakes"),
      income: card.querySelector(".habitat-income"),
      unlock: card.querySelector(".habitat-unlock"),
      milestones: milestoneEls
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
  return habitatConfig.habitats.reduce((total, habitat, index) => (
    total + habitats.counts[index] * habitatIncomePerSecond(habitat, habitats.counts[index])
  ), 0);
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
    localStorage.setItem("idlesnake-seeds", String(seedsTotal));
  }
  saveHabitats();
  return income > 0;
}

function renderHabitats() {
  const availableSnakes = Math.floor(nursery.colonyCount);
  const placedSnakes = habitats.counts.reduce((total, count) => total + count, 0);
  const totalIncome = totalHabitatIncomePerSecond();
  colonyCountEl.textContent = padScore(availableSnakes);
  colonyPlacedCountEl.textContent = padScore(placedSnakes);
  colonyIncomeRateEl.textContent = `${formatDecimal(totalIncome)} seed/sec`;

  habitatCardRefs.forEach((ref, index) => {
    const habitat = habitatConfig.habitats[index];
    const count = habitats.counts[index];
    const unlocked = isHabitatUnlocked(habitat);
    const rate = habitatIncomePerSecond(habitat, count);
    const multiplier = habitatMultiplier(habitat, count);
    const nextMilestone = habitat.milestones.find((milestone) => count < milestone.score);

    ref.card.classList.toggle("is-locked", !unlocked);
    ref.state.textContent = unlocked ? "OPEN" : "LOCKED";
    ref.snakes.textContent = `${formatNumber(count)} snake${count === 1 ? "" : "s"}`;
    ref.income.textContent = `${formatDecimal(rate)} / sec each`;
    ref.unlock.textContent = unlocked
      ? `${formatDecimal(multiplier, 2)}× habitat bonus`
      : `Unlock at best score ${formatNumber(habitat.unlockScore)}`;
    ref.button.disabled = !unlocked || availableSnakes < 1;
    ref.button.textContent = !unlocked
      ? `Score ${formatNumber(habitat.unlockScore)}`
      : availableSnakes < 1
        ? "No snakes"
        : "Place snake";

    ref.milestones.forEach((milestoneEl, milestoneIndex) => {
      const milestone = habitat.milestones[milestoneIndex];
      const earned = count >= milestone.score;
      milestoneEl.classList.toggle("is-earned", earned);
      milestoneEl.textContent = `${earned ? "✓" : "○"} ${formatNumber(milestone.score)} · ×${formatDecimal(milestone.multiplier, 2)}`;
      milestoneEl.title = earned
        ? `Earned with ${formatNumber(milestone.score)} snakes in this habitat`
        : `Earn with ${formatNumber(milestone.score)} snakes in this habitat`;
    });

    if (nextMilestone && unlocked) {
      ref.unlock.textContent += ` · next at ${formatNumber(nextMilestone.score)} snakes`;
    }
  });
}

function placeSnakeInHabitat(index) {
  const habitat = habitatConfig.habitats[index];
  if (!habitat || !isHabitatUnlocked(habitat) || nursery.colonyCount < 1) return;

  const now = Date.now();
  updateNursery(now);
  updateHabitatIncome(now);
  if (nursery.colonyCount < 1) return;

  nursery.colonyCount -= 1;
  habitats.counts[index] += 1;
  nursery.lastUpdatedAt = now;
  saveNursery();
  saveHabitats();
  syncHud();
}

function syncNurseryPanel(now = Date.now()) {
  const hatchAt = nursery.nestStartedAt === null ? null : nursery.nestStartedAt + nurseryConfig.eggHatchMs;
  const activeCount = nursery.hatchlings.length;
  const canLayEgg = nursery.nestStartedAt === null && activeCount < nurseryConfig.capacity && seedsTotal >= nurseryConfig.eggCost;

  nurserySeedStatusEl.textContent = activeCount > 0
    ? `${formatNumber(seedsTotal)} banked · ${activeCount} seed${activeCount === 1 ? "" : "s"}/sec required`
    : `${formatNumber(seedsTotal)} seeds banked`;
  layEggButton.disabled = !canLayEgg;

  if (hatchAt !== null && now < hatchAt) {
    nestStateEl.textContent = "HATCHING";
    nestTimerEl.textContent = `Hatches in ${formatDuration(hatchAt - now)}`;
    nestVisualEl.classList.add("has-egg");
    nestVisualEl.innerHTML = '<span class="egg-shape"></span>';
  } else {
    nestStateEl.textContent = "EMPTY";
    nestTimerEl.textContent = activeCount >= nurseryConfig.capacity ? "Nursery capacity reached" : "Ready for an egg";
    nestVisualEl.classList.remove("has-egg");
    nestVisualEl.innerHTML = "<span>+</span>";
  }

  nurseryCapacityEl.textContent = `${activeCount} / ${nurseryConfig.capacity}`;
  if (activeCount === 0) {
    nurseryGrowthStatusEl.textContent = "Waiting for a hatchling";
  } else if (seedsTotal < activeCount) {
    nurseryGrowthStatusEl.textContent = "Growth paused · seed bank too low";
  } else {
    nurseryGrowthStatusEl.textContent = "Growing · 1 seed/sec each";
  }

  hatchlingListEl.replaceChildren(...nursery.hatchlings.map((hatchling, index) => {
    const row = document.createElement("div");
    row.className = "hatchling-row";
    const percent = Math.round((hatchling.progressMs / nurseryConfig.growthMs) * 100);
    row.innerHTML = `<div class="hatchling-row-heading"><span>Hatchling ${index + 1}</span><span>${formatDuration(nurseryConfig.growthMs - hatchling.progressMs)} left</span></div><div class="growth-bar"><span style="width: ${percent}%"></span></div>`;
    return row;
  }));
  renderHabitats();
  renderNurseryGrid();
}

function layEgg() {
  const now = Date.now();
  updateNursery(now);
  if (nursery.nestStartedAt !== null || nursery.hatchlings.length >= nurseryConfig.capacity || seedsTotal < nurseryConfig.eggCost) return;

  seedsTotal -= nurseryConfig.eggCost;
  nursery.nestStartedAt = now;
  nursery.lastUpdatedAt = now;
  nursery.seedTickAccumulatorMs = 0;
  nursery.movementAccumulatorMs = 0;
  localStorage.setItem("idlesnake-seeds", String(seedsTotal));
  saveNursery();
  syncHud();
}

function runNurseryClock() {
  const now = Date.now();
  const nurseryChanged = updateNursery(now);
  const habitatChanged = updateHabitatIncome(now);
  if (nurseryChanged || habitatChanged) {
    seedsTotalEl.textContent = padSeeds(seedsTotal);
    syncUpgradeMenu();
  }
  syncNurseryPanel(now);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function togglePause() {
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

function gameLoop(now) {
  if (state === "running") {
    const deltaMs = Math.min(100, now - lastFrameAt);
    elapsedMs += deltaMs;
    stepAccumulatorMs += deltaMs;
    while (stepAccumulatorMs >= tickMs && state === "running" && gameMode !== "broodline") {
      if (gameMode === "breakout") stepBreakout(tickMs);
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
      else if (gameMode === "broodline") broodlineStep();
      else if (gameMode === "maze") {
        if (!stepMaze()) {
          stepAccumulatorMs = 0;
          break;
        }
      } else step();
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
    if (now < crossingTransitionUntil) return;
    crossingStage += 1;
    resetCrossingStage();
    hideOverlay();
    setScreenHint(`Stage ${crossingStage}: reach the top bank`);
    syncHud();
    return;
  }

  updateCrossingCars();
  if (isCrossingCarHit()) {
    endCrossing();
    return;
  }

  if (directionQueue.length === 0) return;
  direction = directionQueue.shift();
  nextDirection = directionQueue.length > 0
    ? directionQueue[directionQueue.length - 1]
    : direction;

  const head = crossingSnake[0];
  const vector = vectors[direction];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
  if (isWallHit(nextHead)) return;

  previousCrossingSnake = crossingSnake.map((part) => ({ ...part }));
  crossingSnake.unshift(nextHead);

  const reachedNewLane = nextHead.y !== head.y && nextHead.y > 0 && nextHead.y < crossingGrid.rows - 1;
  if (!reachedNewLane) crossingSnake.pop();

  if (isCrossingCarHit()) {
    endCrossing();
    return;
  }

  if (nextHead.y === 0) {
    crossingSnake.push({ ...crossingSnake[crossingSnake.length - 1] });
    const reward = 10 + crossingStage * 5;
    crossingScore += crossingStage * 100;
    crossingBest = Math.max(crossingBest, crossingScore);
    seedsTotal += reward;
    localStorage.setItem("idlesnake-seeds", String(seedsTotal));
    localStorage.setItem("idlesnake-crossing-best", String(crossingBest));
    crossingPhase = "clearing";
    crossingTransitionUntil = now + 500;
    syncHud();
    showOverlay(`Stage ${crossingStage} Clear · +${formatNumber(reward)} Seeds`);
    setScreenHint("Next road loading");
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
  return crossingSnake.some((part) => crossingCars.some((car) => {
    if (car.row !== part.y) return false;
    return [-crossingGrid.columns, 0, crossingGrid.columns].some((offset) => {
      const left = car.x + offset;
      const right = left + car.width;
      return part.x + 1 > left && part.x < right;
    });
  }));
}

function endCrossing() {
  state = "gameover";
  crossingPhase = "gameover";
  directionQueue = [];
  crossingBest = Math.max(crossingBest, crossingScore);
  localStorage.setItem("idlesnake-crossing-best", String(crossingBest));
  setScreenHint("");
  syncHud();
  showOverlay(`Roadkill · Stage ${crossingStage}`);
}

function stepBreakout(deltaMs) {
  if (!breakout) return;
  const dt = Math.min(40, deltaMs) / 1000;
  const boardWidth = boardMetrics.width;
  const boardHeight = boardMetrics.height;
  const paddle = breakout.paddle;
  const paddleWidth = breakoutPaddleWidth();

  paddle.x = Math.max(0, Math.min(boardWidth - paddleWidth, paddle.x + paddle.input * breakoutConfig.paddleSpeed * dt));

  const remainingPowerups = [];
  const pendingMultiballs = [];
  breakout.powerups.forEach((powerup) => {
    powerup.y += breakoutConfig.powerupFallSpeed * dt;
    const caught = powerup.y + powerup.radius >= paddle.y &&
      powerup.y - powerup.radius <= paddle.y + breakout.segmentSize &&
      powerup.x >= paddle.x - powerup.radius &&
      powerup.x <= paddle.x + paddleWidth + powerup.radius;
    if (caught) {
      if (powerup.type === "seed") {
        setBreakoutPaddleLength(Math.min(10, paddle.length + 1));
      } else if (powerup.type === "heart") {
        breakout.lives += 1;
      } else if (powerup.type === "multiball") {
        pendingMultiballs.push(powerup);
      }
    } else if (powerup.y - powerup.radius <= boardHeight) {
      remainingPowerups.push(powerup);
    }
  });
  breakout.powerups = remainingPowerups;

  const remainingBalls = [];
  for (const ball of breakout.balls) {
    const previousY = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius >= boardWidth) {
      ball.x = boardWidth - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    const paddleTop = paddle.y;
    const hitPaddle = ball.vy > 0 &&
      previousY + ball.radius <= paddleTop + Math.max(2, breakout.segmentSize * 0.25) &&
      ball.y + ball.radius >= paddleTop &&
      ball.x + ball.radius >= paddle.x &&
      ball.x - ball.radius <= paddle.x + paddleWidth;
    if (hitPaddle) {
      ball.y = paddleTop - ball.radius;
      const hit = Math.max(-1, Math.min(1, (ball.x - (paddle.x + paddleWidth / 2)) / (paddleWidth / 2)));
      const speed = Math.max(breakoutConfig.ballSpeed, Math.hypot(ball.vx, ball.vy));
      const horizontal = Math.max(-0.86, Math.min(0.86, hit * 0.92 || (ball.vx < 0 ? -0.16 : 0.16)));
      ball.vx = speed * horizontal;
      ball.vy = -Math.sqrt(Math.max(1, speed * speed - ball.vx * ball.vx));
    }

    if (ball.y - ball.radius > boardHeight) continue;

    const brickIndex = breakout.bricks.findIndex((brick) =>
      ball.x + ball.radius >= brick.x &&
      ball.x - ball.radius <= brick.x + brick.width &&
      ball.y + ball.radius >= brick.y &&
      ball.y - ball.radius <= brick.y + brick.height
    );
    if (brickIndex >= 0) {
      const brick = breakout.bricks[brickIndex];
      breakout.bricks.splice(brickIndex, 1);
      breakout.score += 10;
      const cameFromAbove = previousY + ball.radius <= brick.y;
      const cameFromBelow = previousY - ball.radius >= brick.y + brick.height;
      if (cameFromAbove || cameFromBelow) ball.vy *= -1;
      else ball.vx *= -1;
      if (Math.random() < breakoutConfig.powerupDropChance) {
        breakout.powerups.push(createBreakoutPowerup(
          randomBreakoutPowerupType(),
          brick.x + brick.width / 2,
          brick.y + brick.height / 2
        ));
      }
      if (breakout.bricks.length === 0) {
        endBreakout(true);
        return;
      }
    }

    remainingBalls.push(ball);
  }

  pendingMultiballs.forEach((_powerup, index) => {
    const ball = buildBreakoutBall(remainingBalls.length + index);
    ball.x = paddle.x + paddleWidth / 2;
    ball.y = paddle.y - ball.radius - 4;
    remainingBalls.push(ball);
  });

  if (remainingBalls.length === 0) {
    breakout.lives -= 1;
    if (breakout.lives <= 0) {
      endBreakout(false);
      return;
    }
    breakout.balls = [buildBreakoutBall(0)];
  } else {
    breakout.balls = remainingBalls;
  }
}

function endBreakout(won) {
  state = "gameover";
  breakoutBest = Math.max(breakoutBest, breakout.score);
  localStorage.setItem("idlesnake-breakout-best", String(breakoutBest));
  if (won) {
    seedsTotal += 500;
    localStorage.setItem("idlesnake-seeds", String(seedsTotal));
  }
  syncHud();
  showOverlay(won ? "Level Clear · +500 Seeds" : "Game Over");
}

function step() {
  previousSnake = snake.map((part) => ({ ...part }));
  if (directionQueue.length > 0) {
    direction = directionQueue.shift();
    nextDirection = directionQueue.length > 0
      ? directionQueue[directionQueue.length - 1]
      : direction;
  }
  const head = snake[0];
  const vector = vectors[direction];
  let nextHead = {
    x: head.x + vector.x,
    y: head.y + vector.y
  };
  let shieldRedirected = false;
  const collision = isWallHit(nextHead) || isSnakeHit(nextHead, false);

  if (collision) {
    const redirect = findShieldRedirect();
    if (redirect) {
      upgrades.shieldLevel -= 1;
      saveUpgrades();
      direction = redirect.direction;
      nextDirection = redirect.direction;
      directionQueue = [];
      nextHead = redirect.point;
      shieldRedirected = true;
    } else {
      endGame();
      return;
    }
  }

  const eatenFoodIndex = foods.findIndex((snack) => snack.x === nextHead.x && snack.y === nextHead.y);
  const willEat = eatenFoodIndex >= 0;
  snake.unshift(nextHead);

  if (willEat) {
    score += 1;
    seedsTotal += currentFoodType().value;
    localStorage.setItem("idlesnake-seeds", String(seedsTotal));
    tickMs = Math.max(minTickMs, startTickMs - score * 2.8);
    foods.splice(eatenFoodIndex, 1);
    startDigestionAnimation();
    const replacement = placeFood();
    if (replacement) {
      foods.push(replacement);
    }
    if (foods.length < foodCount()) {
      winGame();
    }
  } else {
    snake.pop();
  }

  if (shieldRedirected) {
    syncHud();
  }
}

function endGame() {
  state = "gameover";
  if (score > best) {
    best = score;
    localStorage.setItem("idlesnake-best", String(best));
  }
  syncHud();
  showOverlay("Game Over");
}

function winGame() {
  state = "gameover";
  best = Math.max(best, score);
  localStorage.setItem("idlesnake-best", String(best));
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
  if (state === "ready") startGame();

  const queuedFrom = directionQueue.length > 0
    ? directionQueue[directionQueue.length - 1]
    : direction;
  if (next === queuedFrom) return;

  const currentVector = vectors[queuedFrom];
  const nextVector = vectors[next];
  const reversing =
    currentVector.x + nextVector.x === 0 &&
    currentVector.y + nextVector.y === 0;

  if (reversing) return;

  if (directionQueue.length >= maxQueuedDirections) {
    directionQueue.shift();
  }

  directionQueue.push(next);
  nextDirection = next;
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
  if (next === queuedFrom) return;

  const currentVector = vectors[queuedFrom];
  const nextVector = vectors[next];
  const reversing =
    currentVector.x + nextVector.x === 0 &&
    currentVector.y + nextVector.y === 0;
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

function animateDirectionButton(directionName) {
  const button = document.querySelector(`[data-direction="${directionName}"]`);
  if (!button) return;

  button.classList.remove("is-pressed");
  void button.offsetWidth;
  button.classList.add("is-pressed");
  window.setTimeout(() => {
    button.classList.remove("is-pressed");
  }, 115);
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
  if (directionQueue.length > 0) {
    duelPlayer.direction = directionQueue.shift();
    direction = duelPlayer.direction;
    nextDirection = directionQueue.length > 0
      ? directionQueue[directionQueue.length - 1]
      : direction;
  }
  chooseOpponentDirection();
  const playerHead = duelNextHead(duelPlayer);
  const opponentHead = duelNextHead(duelOpponent);
  const playerFood = duelFoods.findIndex((food) => food.x === playerHead.x && food.y === playerHead.y);
  const opponentFood = duelFoods.findIndex((food) => food.x === opponentHead.x && food.y === opponentHead.y);
  const playerCollision = isWallHit(playerHead) || duelContains(duelPlayer.body, playerHead) || duelContains(duelOpponent.body, playerHead);
  const opponentCollision = isWallHit(opponentHead) || duelContains(duelOpponent.body, opponentHead) || duelContains(duelPlayer.body, opponentHead);
  const headOn = playerHead.x === opponentHead.x && playerHead.y === opponentHead.y;

  if (playerCollision || opponentCollision || headOn) {
    if (headOn && !playerCollision && !opponentCollision) {
      duelWinner = duelPlayer.body.length > duelOpponent.body.length
        ? "player"
        : duelOpponent.body.length > duelPlayer.body.length ? "opponent" : null;
    } else {
      duelWinner = playerCollision && !opponentCollision ? "opponent" : opponentCollision && !playerCollision ? "player" : null;
    }
    endVsSnake(duelWinner);
    return;
  }

  duelPlayer.body.unshift(playerHead);
  duelOpponent.body.unshift(opponentHead);
  const eatenFoods = new Set();
  if (playerFood >= 0) {
    duelScore += 1;
    eatenFoods.add(`${playerHead.x},${playerHead.y}`);
  } else {
    duelPlayer.body.pop();
  }
  if (opponentFood >= 0) {
    eatenFoods.add(`${opponentHead.x},${opponentHead.y}`);
  } else {
    duelOpponent.body.pop();
  }
  if (eatenFoods.size) {
    duelFoods = duelFoods.filter((food) => !eatenFoods.has(`${food.x},${food.y}`));
  }
  while (duelFoods.length < 5) duelFoods.push(...spawnDuelFoods(1));
}

function endVsSnake(winner) {
  state = "gameover";
  const reward = winner === "player" ? Math.max(5, best * 5) : 0;
  if (reward) {
    seedsTotal += reward;
    localStorage.setItem("idlesnake-seeds", String(seedsTotal));
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
  if (directionQueue.length) direction = directionQueue.shift();
  const vector = vectors[direction];
  const head = mazePath[0];
  const next = { x: head.x + vector.x, y: head.y + vector.y };
  const ateFood = maze.food && next.x === maze.food.x && next.y === maze.food.y;
  const bodyToCheck = ateFood ? mazePath : mazePath.slice(0, -1);
  if (!isMazeOpen(next) || bodyToCheck.some((part) => part.x === next.x && part.y === next.y)) {
    endMaze(false);
    return true;
  }
  previousSnake = mazePath.map((part) => ({ ...part }));
  mazePath.unshift(next);
  if (!ateFood) mazePath.pop();
  if (ateFood) {
    maze.foodsEaten += 1;
    mazeScore += 10 * maze.level;
    if (maze.foodsEaten >= 10 + maze.level * 2) {
      maze.level += 1;
      maze.foodsEaten = 0;
      tickMs = Math.max(62, mazeTickMs - (maze.level - 1) * 7);
      mazeScore += 100 * maze.level;
      showOverlay(`Round ${maze.level - 1} Clear · +${formatNumber(100 * maze.level)} Seeds`);
      window.setTimeout(() => { if (state === "running") hideOverlay(); }, 700);
    }
    spawnMazeFood();
  }
  snake = mazePath;
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
  localStorage.setItem("idlesnake-maze-best", String(mazeBest));
  if (reward) {
    seedsTotal += reward;
    localStorage.setItem("idlesnake-seeds", String(seedsTotal));
  }
  syncHud();
  showOverlay(won ? `McVey's Folly Clear · +${formatNumber(reward)} Seeds` : `Nibbled the wall · +${formatNumber(reward)} Seeds`);
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
  const cell = canvas.width / 15; const head = broodline.head;
  const camera = broodline.camera;
  const viewportHead = { x: head.x - camera.x, y: head.y - camera.y };
  if (viewportHead.x < 2) camera.x = Math.max(0, camera.x - 1);
  if (viewportHead.x > 12) camera.x = Math.min(15, camera.x + 1);
  if (viewportHead.y < 2) camera.y = Math.max(0, camera.y - 1);
  if (viewportHead.y > 12) camera.y = Math.min(15, camera.y + 1);
  ctx.fillStyle = "#16231d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let vy = 0; vy < 15; vy += 1) for (let vx = 0; vx < 15; vx += 1) { const wx = vx + camera.x, wy = vy + camera.y; ctx.fillStyle = (wx + wy) % 2 ? "#243b2a" : "#29452f"; ctx.fillRect(vx * cell, vy * cell, cell, cell); }
  ctx.strokeStyle = "#d5df9d"; ctx.lineWidth = 3; ctx.strokeRect((1 - camera.x) * cell, (1 - camera.y) * cell, 28 * cell, 28 * cell);
  broodline.pickups.forEach((drop) => { const x = (drop.pos.x - camera.x + .5) * cell, y = (drop.pos.y - camera.y + .5) * cell; drawBroodlinePickup(drop, x, y, cell); });
  broodline.enemies.forEach((enemy) => { const x = (enemy.pos.x - camera.x + .5) * cell, y = (enemy.pos.y - camera.y + .5) * cell; ctx.fillStyle = enemy.type === "ranged" ? "#d58964" : "#c4574e"; ctx.beginPath(); enemy.type === "ranged" ? ctx.arc(x, y, cell * .3, 0, Math.PI * 2) : ctx.rect(x - cell * .3, y - cell * .3, cell * .6, cell * .6); ctx.fill(); ctx.fillStyle = "#f4d39a"; ctx.fillRect(x - cell * .25, y - cell * .48, cell * .5 * Math.max(0, enemy.hp / enemy.maxHp), 2); });
  broodline.chain.slice().reverse().forEach((part) => { const x = (part.pos.x - camera.x) * cell + cell * .1, y = (part.pos.y - camera.y) * cell + cell * .1, size = cell * .8; const colors = { body: "#91b957", garden: "#67c993", cave: "#8fa6d6", electric: "#d9d45a", lava: "#e37a47", rattle: "#b996cf", egg: "#f2e9ba" }; ctx.fillStyle = colors[part.kind] || "#91b957"; ctx.strokeStyle = "#132218"; ctx.lineWidth = 2; if (part.kind === "egg") { ctx.beginPath(); ctx.ellipse(x + size / 2, y + size / 2, size * .32, size * .4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } else { ctx.beginPath(); ctx.roundRect(x, y, size, size, size * .18); ctx.fill(); ctx.stroke(); } });
  const headX = (head.x - camera.x) * cell + cell * .1, headY = (head.y - camera.y) * cell + cell * .1, headSize = cell * .8;
  ctx.fillStyle = broodline.headColor || snakeColors.head; ctx.strokeStyle = "#132218"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(headX, headY, headSize, headSize, headSize * .18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#1b2b20"; ctx.fillRect(headX + headSize * .26, headY + headSize * .3, 3, 3); ctx.fillRect(headX + headSize * .62, headY + headSize * .3, 3, 3);
  broodline.effects.forEach((effect) => { ctx.fillStyle = "#f6e8a4"; ctx.font = "bold 10px Courier New"; ctx.fillText(effect.text, (effect.pos.x - camera.x) * cell - 5, (effect.pos.y - camera.y) * cell - 4); });
}

function render() {
  boardMetrics = getBoardMetrics();
  drawScreen();
  if (gameMode === "crossing") drawCrossing();
  else {
    if (gameMode !== "broodline") drawGrid();
    if (gameMode === "breakout") drawBreakout();
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

function interpolatedPoint(previous, current, index = 0) {
  // Keep the classic cell-by-cell rhythm, but soften each hop instead of
  // sliding continuously for the entire tick.
  const transitionMs = Math.min(105, tickMs * 0.55);
  const rawProgress = Math.min(1, Math.max(0, stepAccumulatorMs / transitionMs));
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
  snake.forEach((part, index) => {
    const previousPart = previousSnake?.[index] || previousSnake?.[previousSnake.length - 1] || part;
    const point = interpolatedPoint(previousPart, part, index);
    const baseInset = Math.max(3, boardMetrics.cellSize * (index === 0 ? 0.105 : 0.135));
    const digestionPulse = index === 0 ? 0 : digestionPulseForSegment(index, now);
    const inset = Math.max(1, baseInset - boardMetrics.cellSize * 0.06 * digestionPulse);
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
  const headInset = Math.max(3, Math.floor(boardMetrics.cellSize * 0.11));
  const headPoint = interpolatedPoint(previousSnake?.[0] || snake[0], snake[0]);
  const headRect = interpolatedCellRect(headPoint, headInset);
  drawEyes(headRect.x, headRect.y, headRect.size);
}

function drawEyes(x, y, size) {
  if (size < 12) return;

  const vector = vectors[direction];
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

function pruneDigestionAnimations() {
  const now = performance.now();
  digestionAnimations = digestionAnimations.filter((animation) => {
    const tailIndex = Math.max(1, animation.snakeLength - 1);
    return now - animation.startedAt < tailIndex * 70 + 280;
  });
}

function digestionPulseForSegment(index, now) {
  const segmentDelay = 70;
  const pulseDuration = 280;
  return digestionAnimations.reduce((strongestPulse, animation) => {
    const elapsed = now - animation.startedAt - (index - 1) * segmentDelay;
    if (elapsed < 0 || elapsed > pulseDuration) {
      return strongestPulse;
    }
    const progress = elapsed / pulseDuration;
    const pulse = Math.sin(progress * Math.PI);
    return Math.max(strongestPulse, pulse);
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
    : gameMode === "crossing"
      ? crossingScore
      : gameMode === "duel" ? duelScore : gameMode === "maze" ? mazeScore : score;
  const activeBest = isSnakebird
    ? snakebirdProgress.bestMoves[snakebird?.levelIndex || 0]
    : isSokoban
    ? sokobanBest
    : gameMode === "breakout"
    ? breakoutBest
    : gameMode === "crossing" ? crossingBest
    : gameMode === "maze" ? mazeBest
    : Math.max(best, score);
  scoreEl.textContent = padScore(activeScore);
  bestEl.textContent = isSnakebird && activeBest === null ? "—" : padScore(activeBest);
  seedsTotalEl.textContent = padSeeds(seedsTotal);
  if (duelGridSelect) {
    duelGridSelect.hidden = gameMode !== "duel";
    duelGridSelect.value = String(selectedDuelGridSize);
  }
  if (gridLabelEl) gridLabelEl.hidden = gameMode === "duel";
  gridLabelEl.textContent = isSnakebird
    ? `L${(snakebird?.levelIndex || 0) + 1}/5`
    : isSokoban ? `S${(sokoban?.stageIndex || 0) + 1}/3`
    : gameMode === "breakout" ? `LIVES ${breakout?.lives ?? 0}` : `${grid.columns}x${grid.rows}`;
  timerEl.textContent = formatTime(timerStarted ? elapsedMs : 0);
  pauseButton.classList.toggle("is-active", state === "paused");
  if (isSnakebird) syncSnakebirdPicker();
  syncNurseryPanel();
  syncUpgradeMenu();
}

function padScore(value) {
  return String(value).padStart(3, "0");
}

function padSeeds(value) {
  return formatDecimal(value, 2).padStart(6, "0");
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
    const saved = JSON.parse(localStorage.getItem("idlesnake-upgrades") || "{}");
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
  localStorage.setItem("idlesnake-upgrades", JSON.stringify(upgrades));
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

function syncBoardSizeSelect() {
  const unlockedLevels = upgradeConfig.board.levels.slice(0, upgrades.boardLevel + 1);
  boardSizeSelect.replaceChildren(...unlockedLevels.map((size, level) => {
    const option = document.createElement("option");
    option.value = String(level);
    option.textContent = size;
    return option;
  }));
  boardSizeSelect.hidden = unlockedLevels.length < 2;
  boardSizeSelect.value = String(selectedBoardLevel);
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
  localStorage.setItem("idlesnake-seeds", String(seedsTotal));
  syncHud();
  setScreenHint(`+${formatNumber(grant)} seeds granted for minigame upgrades`);
}

function purchaseUpgrade(type) {
  const config = upgradeConfig[type];
  const levelKey = `${type}Level`;
  if (!config || !(levelKey in upgrades)) return;
  if (type === "board" && upgrades.boardLevel >= config.levels.length - 1) return;
  if (type === "foodType" && upgrades.foodTypeLevel >= config.levels.length - 1) return;

  const cost = upgradeCost(config, upgrades[levelKey]);
  if (seedsTotal < cost) return;

  seedsTotal -= cost;
  upgrades[levelKey] += 1;
  localStorage.setItem("idlesnake-seeds", String(seedsTotal));
  saveUpgrades();

  if (type === "board") {
    selectedBoardLevel = upgrades.boardLevel;
    grid = parseGridSize(config.levels[upgrades.boardLevel]);
    freshGame();
  } else if (type === "foodCount") {
    freshGame();
  } else {
    syncHud();
    render();
  }
}

function setActiveBoardLevel(level) {
  const nextLevel = Number(level);
  if (!Number.isInteger(nextLevel) || nextLevel < 0 || nextLevel > upgrades.boardLevel) return;

  selectedBoardLevel = nextLevel;
  grid = parseGridSize(upgradeConfig.board.levels[selectedBoardLevel]);
  freshGame();
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatDecimal(value, maximumFractionDigits = 4) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits
  });
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
  menuTabs.forEach((tab) => {
    const isActive = tab.dataset.menuTab === activeTab;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  menuPanels.forEach((panel) => {
    panel.hidden = panel.dataset.menuPanel !== activeTab;
  });
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

  if (keyMap[event.code]) {
    event.preventDefault();
    const directionName = keyMap[event.code];
    queueDirection(directionName);
    animateDirectionButton(directionName);
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
  }

  if (event.code === "Enter") {
    event.preventDefault();
    startGame();
  }
});

document.addEventListener("keyup", (event) => {
  if (gameMode !== "breakout" || !breakout) return;
  if (event.code === "ArrowLeft" || event.code === "KeyA" || event.code === "ArrowRight" || event.code === "KeyD") {
    breakout.paddle.input = 0;
  }
});

document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("pointerdown", () => {
    queueDirection(button.dataset.direction);
    animateDirectionButton(button.dataset.direction);
  });
  button.addEventListener("pointerup", () => {
    if (gameMode === "breakout" && breakout) breakout.paddle.input = 0;
  });
  button.addEventListener("pointercancel", () => {
    if (gameMode === "breakout" && breakout) breakout.paddle.input = 0;
  });
});
document.addEventListener("pointerup", () => {
  if (gameMode === "breakout" && breakout) breakout.paddle.input = 0;
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", resetGame);
personalizationBackButton.addEventListener("click", hidePersonalization);
buildColorChoices(bodyColorChoices, "body");
buildColorChoices(headColorChoices, "head");
syncColorChoices();
layEggButton.addEventListener("click", layEgg);
menuTabs.forEach((tab) => {
  tab.addEventListener("click", () => setMenuTab(tab.dataset.menuTab));
});
boardSizeSelect.addEventListener("change", () => {
  setActiveBoardLevel(boardSizeSelect.value);
});
duelGridSelect?.addEventListener("change", () => {
  setDuelGridSize(duelGridSelect.value);
});
snakebirdLevelButtons.forEach((button) => {
  button.addEventListener("click", () => selectSnakebirdLevel(button.dataset.snakebirdLevel));
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
    if (gameNumber === 0) {
      if (!personalizationScreen.hidden || gameMode === "duel" || gameMode === "maze" || gameMode === "breakout" || gameMode === "crossing" || gameMode === "snakebird" || gameMode === "sokoban" || gameMode === "broodline") {
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
    else if (gameNumber === 5) launchSnakebird(true);
    else if (gameNumber === 6) launchSokoban();
    else if (gameNumber === 7) launchBroodline();
    else showOverlay(`Minigame ${gameNumber} coming soon`);
  });
});

buildNurseryGrid();
buildHabitatList();
freshGame();
clearInterval(nurseryClockId);
runNurseryClock();
nurseryClockId = setInterval(runNurseryClock, 250);
cancelAnimationFrame(animationId);
animationId = requestAnimationFrame((now) => {
  lastFrameAt = now;
  gameLoop(now);
});
