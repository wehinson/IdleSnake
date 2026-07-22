// Single source of truth for the idle/simulation tuning constants.
//
// Pure data — no DOM, no globals. Loadable in Node (`require`) or the browser
// (`window.IdleSnakeConfig`), mirroring the UMD shape of snakebird-engine.js so
// the same file feeds both the headless engine and the browser host.
(function attachConfig(root, factory) {
  const config = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  if (typeof window !== "undefined") window.IdleSnakeConfig = config;
  else root.IdleSnakeConfig = config;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const gameplaySpeed = 1;
  const slowedTick = (milliseconds) => Math.round(milliseconds / gameplaySpeed);
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
    foodCount: { baseCount: 1, baseCost: 160, costRatio: 3.75 },
    shield: { baseCost: 420, costRatio: 4.5 },
    minigames: {
      levels: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      maxLevel: 9,
      baseCost: 700,
      costRatio: 2.6
    }
  };

  const snakeConfig = {
    // Start at 60% of the prior movement speed (190 ms per cell), which makes
    // the opening cadence 40% slower while preserving the existing speed-up
    // progression and minimum tick interval.
    startTickMs: slowedTick(190 / 0.6),
    minTickMs: slowedTick(82),
    maxQueuedDirections: 2,
    eggBoardMinRuns: 100,
    eggBoardMaxRuns: 200,
    eggSpawnChance: 0.05
  };

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
      // Nursery improvements are deliberately late-game sinks. Each purchase
      // advances exactly one level; there is no bulk-buy path.
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
    upgrades: {
      costRatio: 1.75
    },
    habitats: [
      { name: "Field", unlockScore: 0, naturalCapacity: 25, hardCapacity: 50, upgradeCost: 10, capacityPerUpgrade: 25, incomeMultiplier: 0.5,
        milestones: [{ score: 10, multiplier: 1.1 }, { score: 50, multiplier: 1.2 }, { score: 100, multiplier: 1.35 }] },
      { name: "Lake", unlockScore: 10, naturalCapacity: 30, hardCapacity: 60, upgradeCost: 15, capacityPerUpgrade: 30, incomeMultiplier: 0.75, producesSeeds: false, eggHatchReductionSeconds: 1,
        milestones: [{ score: 25, multiplier: 1.12 }, { score: 75, multiplier: 1.25 }, { score: 150, multiplier: 1.4 }] },
      { name: "Forest", unlockScore: 25, naturalCapacity: 50, hardCapacity: 100, upgradeCost: 25, capacityPerUpgrade: 50, incomeMultiplier: 1, producesBranches: true,
        milestones: [{ score: 50, multiplier: 1.15 }, { score: 100, multiplier: 1.3 }, { score: 250, multiplier: 1.5 }] },
      // Provisions producers also give their normal Seed income, and their
      // Provisions output advances egg progress.
      { name: "River", unlockScore: 50, naturalCapacity: 100, hardCapacity: 200, upgradeCost: 40, capacityPerUpgrade: 100, incomeMultiplier: 2, producesProvisions: true,
        milestones: [{ score: 100, multiplier: 1.18 }, { score: 250, multiplier: 1.35 }, { score: 500, multiplier: 1.65 }] },
      { name: "Cave", unlockScore: 100, naturalCapacity: 200, hardCapacity: 400, upgradeCost: 65, capacityPerUpgrade: 200, incomeMultiplier: 4,
        milestones: [{ score: 200, multiplier: 1.2 }, { score: 500, multiplier: 1.45 }, { score: 1000, multiplier: 1.8 }] },
      { name: "Ocean", unlockScore: 200, naturalCapacity: 400, hardCapacity: 800, upgradeCost: 100, capacityPerUpgrade: 400, incomeMultiplier: 8,
        milestones: [{ score: 400, multiplier: 1.22 }, { score: 800, multiplier: 1.55 }, { score: 1500, multiplier: 2 }] },
      { name: "Mountain", unlockScore: 400, naturalCapacity: 750, hardCapacity: 1500, upgradeCost: 160, capacityPerUpgrade: 750, incomeMultiplier: 16,
        milestones: [{ score: 750, multiplier: 1.25 }, { score: 1500, multiplier: 1.7 }, { score: 3000, multiplier: 2.2 }] },
      { name: "Blizzard", unlockScore: 750, naturalCapacity: 1500, hardCapacity: 3000, upgradeCost: 250, capacityPerUpgrade: 1500, incomeMultiplier: 32,
        milestones: [{ score: 1500, multiplier: 1.3 }, { score: 3000, multiplier: 1.85 }, { score: 6000, multiplier: 2.5 }] }
    ]
  };

  const notableConfig = {
    startingNotableCapacity: 1,
    capacityPerActiveHabitat: 1,
    habitatAssignmentChance: 0.001,
    directRecruitmentCost: 150,
    foragerProvisionPerSeed: 0.1,
    powerTypeWeights: [
      { value: "PRODUCTION_INCREASE", weight: 30 },
      { value: "CONSUMPTION_REDUCTION", weight: 25 },
      { value: "CAPACITY_INCREASE", weight: 20 },
      { value: "FORAGER", weight: 10 },
      { value: "RATIONER", weight: 15 }
    ],
    productionMagnitudeWeights: [
      { value: 0.15, weight: 45 }, { value: 0.25, weight: 30 },
      { value: 0.5, weight: 15 }, { value: 1, weight: 8 }, { value: 1.5, weight: 2 }
    ],
    consumptionMagnitudeWeights: [
      { value: 0.05, weight: 35 }, { value: 0.1, weight: 30 },
      { value: 0.2, weight: 20 }, { value: 0.3, weight: 10 },
      { value: 0.4, weight: 4 }, { value: 0.5, weight: 1 }
    ],
    capacityMagnitudeWeights: [
      { value: 0.1, weight: 35 }, { value: 0.2, weight: 30 },
      { value: 0.35, weight: 20 }, { value: 0.5, weight: 10 }, { value: 0.75, weight: 5 }
    ],
    rationerMagnitudeWeights: [
      { value: 0.25, weight: 55 }, { value: 0.5, weight: 35 }, { value: 0.75, weight: 10 }
    ],
    namePools: {
      names: ["Reed", "Coilmaw", "Ash", "Mirecoil", "Sedge", "Bracken", "Flint", "Willow", "Moss", "Rill"],
      epithets: ["", "the Far-Seeking", "of the Furrows", "Keeper of Stores", "the Steadfast", "the Seedwise", "of Deep Waters"]
    }
  };

  // Mastery rewards use stable IDs and explicit configured scores. These values
  // intentionally match the former board-area rule, but are no longer inferred
  // by reward code and can be balanced independently later.
  const boardMasteryConfig = [
    { masteryId: "snake-board-5x7", boardSize: "5x7", masteryScore: 31 },
    { masteryId: "snake-board-5x9", boardSize: "5x9", masteryScore: 41 },
    { masteryId: "snake-board-7x9", boardSize: "7x9", masteryScore: 59 },
    { masteryId: "snake-board-9x9", boardSize: "9x9", masteryScore: 77 },
    { masteryId: "snake-board-9x13", boardSize: "9x13", masteryScore: 113 },
    { masteryId: "snake-board-11x15", boardSize: "11x15", masteryScore: 161 },
    { masteryId: "snake-board-15x21", boardSize: "15x21", masteryScore: 311 },
    { masteryId: "snake-board-21x21", boardSize: "21x21", masteryScore: 437 }
  ];

  const migrationConfig = {
    destinations: ["Wetlands", "Highlands", "Badlands", "Coast"],
    pointCosts: {
      notable: 5, adult: 1, egg: 0.5,
      seeds: { bundleSize: 500, cost: 1 },
      branches: { bundleSize: 50, cost: 1 },
      provisions: { bundleSize: 50, cost: 1 }
    },
    requirements: { adults: 5, provisions: 100 },
    contribution: {
      basePoints: 2,
      metrics: {
        maxSnakeScore: { weight: 1.1, scale: 50 },
        totalAdultsProduced: { weight: 1.0, scale: 100 },
        totalNotablesRecruited: { weight: 1.0, scale: 3 },
        habitatsUnlocked: { weight: 0.55, scale: 2 },
        adultSnakesPlaced: { weight: 0.7, scale: 100 },
        boardMasteries: { weight: 0.7, scale: 2 },
        nestSlotsReached: { weight: 0.6, scale: 2 },
        nurserySizeReached: { weight: 0.6, scale: 3 }
      }
    },
    success: {
      base: 0.22,
      notableExperience: { weight: 0.75, scale: 25 },
      adults: { weight: 1.15, scale: 12 },
      provisions: { weight: 1.05, scale: 200 },
      eggs: { weight: 0.35, scale: 4 }
    },
    journey: {
      stopCounts: [{ value: 4, weight: 1 }, { value: 5, weight: 1 }, { value: 6, weight: 1 }],
      travelTimePerLegMs: 60 * 1000,
      returnRefundRate: 0.1,
      notableSurvivalChance: 0.5,
      stopPool: [
        { id: "forked-trail", type: "decision", weight: 3 },
        { id: "flooded-crossing", type: "decision", weight: 3 },
        { id: "cold-night", type: "decision", weight: 2 },
        { id: "seed-trial", type: "challenge", weight: 2 }
      ]
    },
    attrition: {
      adults: { minimum: 0.01, variable: 0.07, protectionStrength: 1.2, minimumSurvival: 1 },
      seeds: { minimum: 0.01, variable: 0.08, protectionStrength: 1.0, minimumSurvival: 0 },
      provisions: { minimum: 0.015, variable: 0.1, protectionStrength: 1.3, minimumSurvival: 1 },
      failedChallenge: { adults: 1, provisions: 15, seeds: 10, eggs: 0 },
      skippedChallenge: { adults: 2, provisions: 30, seeds: 25, eggs: 1 },
      nextLegHighMultiplier: 1.5,
      nextLegLowMultiplier: 0.7
    },
    challenge: { columns: 10, rows: 10, requiredSeeds: 20, tickMs: 150, startingLength: 3, foodCount: 1, obstacles: [] },
    founding: {
      baseTimeMs: 10 * 60 * 1000,
      msRemovedPerSnakeSeed: 1000,
      nurseryAvailable: false,
      colonyAvailable: false,
      nestAvailable: false,
      habitatsAvailable: false,
      allowedUpgrades: ["board", "foodType", "foodCount", "shield"]
    }
  };

  const tradeRouteConfig = {
    construction: { seedCostPerSide: 10_000, branchCostPerSide: 1_000, costScaling: 1 },
    direction: {
      baseShipmentCapacity: 100,
      capacityGrowth: 1.75,
      baseShipmentIntervalMs: 10 * 60 * 1000,
      speedReductionPerLevel: 0.9,
      minimumShipmentIntervalMs: 60 * 1000,
      efficiencyByLevel: [0.8, 0.85, 0.9, 0.93, 0.95],
      maximumDeliveryEfficiency: 0.95,
      baseMaximumWorkers: 5,
      workerSpeedBonus: 0.25,
      workerCapIncreasePerLevel: 1
    },
    upgrades: {
      capacity: { seedBaseCost: 2_500, branchBaseCost: 250, costGrowth: 2 },
      speed: { seedBaseCost: 5_000, branchBaseCost: 500, costGrowth: 2.25 },
      efficiency: { seedBaseCost: 7_500, branchBaseCost: 750, costGrowth: 2.5 },
      workerCap: { seedBaseCost: 10_000, branchBaseCost: 1_000, costGrowth: 3 }
    }
  };

  // Re-Supply missions intentionally live beside trade-route tuning: a mission
  // uses exactly one directional lane and its upgrades/workers.
  const resupplyConfig = {
    resupplyNotableProvisionCost: 100,
    resupplyAdultProvisionCost: 50,
    resupplyEggProvisionCost: 10,
    resupplyBaseTravelSeconds: 600,
    resupplyMaximumRouteDiscount: 0.40,
    resupplyDiscountScale: 6,
    resupplyMaximumWorkerTimeReduction: 0.40,
    resupplyWorkerTimeScale: 5,
    resupplyMinimumTravelSeconds: 60,
    resupplyMaxConcurrentPerDirection: 1
  };

  const historyRetentionConfig = {
    migrationPerOutcome: 50,
    completedResupplyMissions: 50
  };

  return { gameplaySpeed, upgradeConfig, snakeConfig, nurseryConfig, habitatConfig, notableConfig, boardMasteryConfig, migrationConfig, tradeRouteConfig, resupplyConfig, historyRetentionConfig };
});
