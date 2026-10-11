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
  const calibration = Object.freeze({ duel: 10, maze: 320, breakout: 400, crossing: 600,
    snakebird: 1, sokoban: 1, broodline: 63, battleship: 5, centipede: 1000, runner: 1000 });
  const modes = Object.freeze(Object.keys(calibration));
  const bounded = (value, max = MAX_VALUE) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Number(value))) : 0;
  const round = (value) => Math.round(value * 10000) / 10000;

  function createLedger(raw, legacyEarnings) {
    const earnings = raw?.earnings || legacyEarnings || {};
    return { version: VERSION,
      earnings: Object.fromEntries(modes.map(mode => [mode, bounded(earnings[mode])])),
      rngState: Number.isInteger(raw?.rngState) && raw.rngState >= 0 && raw.rngState <= 0xffffffff ? raw.rngState : null,
      nextRunId: Math.max(1, Math.floor(bounded(raw?.nextRunId, Number.MAX_SAFE_INTEGER - 1))),
      lastReceipt: raw?.lastReceipt && modes.includes(raw.lastReceipt.mode) && Number.isSafeInteger(raw.lastReceipt.runId)
        ? { mode: raw.lastReceipt.mode, runId: raw.lastReceipt.runId, amount: bounded(raw.lastReceipt.amount, MAX_REWARD) } : null };
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
    const won = (["breakout", "snakebird", "sokoban", "battleship"].includes(mode) && detail.won === true)
      || (mode === "duel" && detail.winner === "player");
    let score = bounded(active?.score);
    let meaningful = score > 0;
    if (mode === "snakebird") {
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
      // Partial losses need an actual successful shot, not merely placement.
      meaningful = score > 0 || Object.values(active?.enemy?.shots || {}).some(shot => shot === "hit" || shot === "sunk");
    } else if (mode === "duel") meaningful = score > 0 || won;
    return { score, normalizedScore: score / calibration[mode], meaningful,
      won, outcome: won ? "win" : detail.banked ? "banked" : mode === "duel" && detail.winner === null ? "draw" : "loss" };
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
    const amount = eligible ? round(Math.min(MAX_REWARD, 40 * incomeFactor * scoreFactor * winFactor * diversityFactor * randomFactor)) : 0;
    return { amount, normalizedScore: q, incomePerSecond: income, historicalEarnings: history,
      incomeFactor, scoreFactor, winFactor, diversityFactor, randomFactor };
  }
  function beginRun(ledger, mode) {
    if (!modes.includes(mode)) return null;
    const runId = ledger.nextRunId;
    if (runId >= Number.MAX_SAFE_INTEGER - 1) return null;
    ledger.nextRunId += 1;
    return { mode, runId, engaged: false, paid: false };
  }
  function settle(ledger, run, active, detail, incomePerSecond, rng) {
    if (!run || run.paid || ledger.lastReceipt?.runId >= run.runId) return null;
    run.paid = true;
    const measured = performance(run.mode, active, detail);
    const eligible = run.engaged && measured.meaningful;
    // Rejections/zero progress never draw randomness. Seed once from the engine
    // RNG, then persist this independent stream across reloads and mode changes.
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
  const explanation = "Seeds at run end: progress + wins, boosted by passive income; games with fewer earned Seeds pay more. Luck ±3%.";
  return { VERSION, MAX_VALUE, MAX_REWARD, RANDOM_BOUND, calibration, modes, createLedger, otherIncomePerSecond, performance, calculate, beginRun, settle, explanation };
});
