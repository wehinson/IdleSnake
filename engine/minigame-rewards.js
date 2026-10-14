// Authoritative Seed rewards. Pure calculations plus a persisted, seeded ledger.
(function attachRewards(root, factory) {
  const api = factory(typeof require === "function" ? require("./economy.js") : root.IdleSnakeEconomy);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeMinigameRewards = api;
})(typeof window !== "undefined" ? window : globalThis, (economy) => {
  const VERSION = 1;
  const MAX_VALUE = 1e12;
  const MAX_REWARD = 5e8;
  const RANDOM_BOUND = 0.03;
  const MAZE_TIME_LIMIT_MS = 180000;
  const MAZE_TOTAL_SEEDS = 15;
  const calibration = Object.freeze({ duel: 10, maze: 1, breakout: 400, crossing: 600,
    snakebird: 1, sokoban: 1, broodline: 63, battleship: 5, centipede: 1000, runner: 1000 });
  const modes = Object.freeze(Object.keys(calibration));
  const winLossModes = Object.freeze(["duel", "maze", "breakout", "snakebird", "sokoban", "battleship"]);
  const scoreOnlyModes = Object.freeze(["crossing", "broodline", "centipede", "runner"]);
  const bounded = (value, max = MAX_VALUE) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Number(value))) : 0;
  const round = (value) => Math.round(value * 10000) / 10000;
  // Apply the user's whole-Seed ceiling to the final formula, without first
  // rounding away a positive fraction. Legacy wallet/history fractions remain.
  const roundReward = (value) => Math.ceil(bounded(value, MAX_REWARD));

  function createLedger(raw, legacyEarnings) {
    const earnings = raw?.earnings || legacyEarnings || {};
    const lastReceipt = raw?.lastReceipt && modes.includes(raw.lastReceipt.mode) && Number.isSafeInteger(raw.lastReceipt.runId) && raw.lastReceipt.runId > 0
      ? { mode: raw.lastReceipt.mode, runId: raw.lastReceipt.runId, amount: bounded(raw.lastReceipt.amount, MAX_REWARD) } : null;
    return { version: VERSION,
      earnings: Object.fromEntries(modes.map(mode => [mode, bounded(earnings[mode])])),
      rngState: Number.isInteger(raw?.rngState) && raw.rngState >= 0 && raw.rngState <= 0xffffffff ? raw.rngState : null,
      nextRunId: Math.max(1, Math.floor(bounded(raw?.nextRunId, Number.MAX_SAFE_INTEGER - 1)), (lastReceipt?.runId || 0) + 1),
      lastReceipt };
  }
  // Shares the public income query used by the HUD. No currency deltas, score,
  // minigame income, Length Bonus from an inactive Snake, or award feedback.
  function otherIncomePerSecond(state) {
    const settlement = state.migration?.settlements?.find(item => item.id === state.migration.activeSettlementId);
    if (settlement && settlement.status !== "established") return 0;
    return bounded(economy.calculateHabitatActivation(state.habitats.counts,
      economy.foodValueFromUpgrades(state.upgrades), state.notables, state.habitats.upgradeLevels,
      { activateAllOverCapacity: state.provisions > 0 }).incomePerSecond);
  }
  function performance(mode, active, detail = {}) {
    let won = (["maze", "breakout", "snakebird", "sokoban", "battleship"].includes(mode) && detail.won === true)
      || (mode === "duel" && detail.winner === "player");
    let score = bounded(active?.score);
    let meaningful = score > 0;
    if (mode === "maze") {
      // Only engine-owned canonical fields verify a timed clear. Event metadata
      // alone cannot invent collected seeds or repair a missing/malformed timer.
      const validClear = active?.totalSeeds === MAZE_TOTAL_SEEDS && active?.seedsCollected === MAZE_TOTAL_SEEDS
        && Array.isArray(active?.seeds) && active.seeds.length === 0
        && active?.result === "won"
        && active?.timeLimitMs === MAZE_TIME_LIMIT_MS && Number.isFinite(active?.remainingMs)
        && active.remainingMs > 0 && active.remainingMs <= active.timeLimitMs;
      won = won && validClear;
      score = won ? Math.max(0, Math.min(1, active.remainingMs / active.timeLimitMs)) : 0;
      meaningful = won;
    } else if (mode === "snakebird") {
      const optimum = bounded(active?.definition?.optimalMoves);
      score = won && active?.moves > 0 ? (optimum > 0 ? Math.min(1, optimum / active.moves) : 1) : 0;
      meaningful = won && active?.moves > 0;
    } else if (mode === "sokoban") {
      const maximum = (active?.crates?.length || 0) * 100 + bounded(active?.totalPellets) * 10;
      score = maximum > 0 ? Math.min(1, score / maximum) : 0;
      meaningful = won && active?.moves > 0 && maximum > 0;
    } else if (mode === "broodline") {
      score = bounded(active?.pendingSeeds);
      meaningful = active?.kills > 0 || active?.round > 1 || active?.wave > 1 || detail.banked === true;
    } else if (mode === "battleship") {
      // Keep measured progress separate from the win-only payout gate.
      meaningful = score > 0 || Object.values(active?.enemy?.shots || {}).some(shot => shot === "hit" || shot === "sunk");
    } else if (mode === "duel") meaningful = score > 0 || won;
    return { score, normalizedScore: score / calibration[mode], meaningful,
      won, rewardable: winLossModes.includes(mode) ? won : scoreOnlyModes.includes(mode),
      outcome: won ? "win" : mode === "duel" && detail.winner === null ? "draw"
        : scoreOnlyModes.includes(mode) ? (mode === "broodline" && detail.banked === true ? "banked" : "score") : "loss" };
  }
  function calculate({ normalizedScore = 0, won = false, incomePerSecond = 0, historicalEarnings = 0, random = 0.5, eligible = true } = {}) {
    const q = bounded(normalizedScore);
    const income = bounded(incomePerSecond);
    const history = bounded(historicalEarnings);
    const incomeFactor = Math.sqrt(1 + income);
    const scoreFactor = 1 + 3 * q / (1 + q);
    const winFactor = won ? 3 : 1;
    const diversityFactor = 0.25 + 0.75 / Math.sqrt(1 + history / (400 * incomeFactor));
    const randomFactor = 1 + RANDOM_BOUND * (2 * bounded(random, 1) - 1);
    const amount = eligible ? roundReward(40 * incomeFactor * scoreFactor * winFactor * diversityFactor * randomFactor) : 0;
    return { amount, normalizedScore: q, incomePerSecond: income, historicalEarnings: history,
      incomeFactor, scoreFactor, winFactor, diversityFactor, randomFactor };
  }
  function beginRun(ledger, mode, rng = () => 0.5) {
    if (!modes.includes(mode)) return null;
    const runId = ledger.nextRunId;
    if (runId >= Number.MAX_SAFE_INTEGER - 1) return null;
    // Establish and save the stream before any completion, so reloading a
    // pre-payout save cannot reroll the first award with a different host RNG.
    if (ledger.rngState === null) ledger.rngState = Math.floor(bounded(rng(), 1) * 0xffffffff) >>> 0;
    ledger.nextRunId += 1;
    return { mode, runId, engaged: false, paid: false };
  }
  function settle(ledger, run, active, detail, incomePerSecond, rng) {
    if (!run || run.paid || ledger.lastReceipt?.runId >= run.runId) return null;
    run.paid = true;
    const measured = performance(run.mode, active, detail);
    const eligible = run.engaged && measured.meaningful && measured.rewardable;
    // Rejections/zero progress never advance the saved reward stream.
    let random = 0.5;
    if (eligible) {
      if (ledger.rngState === null) ledger.rngState = Math.floor(bounded(rng(), 1) * 0xffffffff) >>> 0;
      ledger.rngState = (Math.imul(ledger.rngState, 1664525) + 1013904223) >>> 0;
      random = ledger.rngState / 4294967296;
    }
    const rewardDetails = calculate({ ...measured, incomePerSecond, historicalEarnings: ledger.earnings[run.mode], random, eligible });
    ledger.earnings[run.mode] = round(Math.min(MAX_VALUE, ledger.earnings[run.mode] + rewardDetails.amount));
    ledger.lastReceipt = { mode: run.mode, runId: run.runId, amount: rewardDetails.amount };
    return { reward: rewardDetails.amount, rewardDetails, outcome: measured.outcome, runId: run.runId };
  }
  const explanation = "Whole Seeds, rounded up: wins or score-only progress; Nibbler rewards time left. Passive income and lower game earnings boost rewards. Losses/draws pay 0. Luck ±3% before rounding.";
  return { VERSION, MAX_VALUE, MAX_REWARD, RANDOM_BOUND, MAZE_TIME_LIMIT_MS, MAZE_TOTAL_SEEDS, calibration, modes, winLossModes, scoreOnlyModes, roundReward, createLedger, otherIncomePerSecond, performance, calculate, beginRun, settle, explanation };
});
