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
      levels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      baseCost: 700,
      costRatio: 2.6
    }
  };

  const snakeConfig = {
    startTickMs: 190,
    minTickMs: 82,
    maxQueuedDirections: 2
  };

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
      { name: "Field", unlockScore: 0, incomeMultiplier: 0.5,
        milestones: [{ score: 10, multiplier: 1.1 }, { score: 50, multiplier: 1.2 }, { score: 100, multiplier: 1.35 }] },
      { name: "Lake", unlockScore: 10, incomeMultiplier: 0.75,
        milestones: [{ score: 25, multiplier: 1.12 }, { score: 75, multiplier: 1.25 }, { score: 150, multiplier: 1.4 }] },
      { name: "Forest", unlockScore: 25, incomeMultiplier: 1,
        milestones: [{ score: 50, multiplier: 1.15 }, { score: 100, multiplier: 1.3 }, { score: 250, multiplier: 1.5 }] },
      { name: "River", unlockScore: 50, incomeMultiplier: 2,
        milestones: [{ score: 100, multiplier: 1.18 }, { score: 250, multiplier: 1.35 }, { score: 500, multiplier: 1.65 }] },
      { name: "Cave", unlockScore: 100, incomeMultiplier: 4,
        milestones: [{ score: 200, multiplier: 1.2 }, { score: 500, multiplier: 1.45 }, { score: 1000, multiplier: 1.8 }] },
      { name: "Ocean", unlockScore: 200, incomeMultiplier: 8,
        milestones: [{ score: 400, multiplier: 1.22 }, { score: 800, multiplier: 1.55 }, { score: 1500, multiplier: 2 }] },
      { name: "Mountain", unlockScore: 400, incomeMultiplier: 16,
        milestones: [{ score: 750, multiplier: 1.25 }, { score: 1500, multiplier: 1.7 }, { score: 3000, multiplier: 2.2 }] },
      { name: "Blizzard", unlockScore: 750, incomeMultiplier: 32,
        milestones: [{ score: 1500, multiplier: 1.3 }, { score: 3000, multiplier: 1.85 }, { score: 6000, multiplier: 2.5 }] }
    ]
  };

  return { upgradeConfig, snakeConfig, nurseryConfig, habitatConfig };
});
