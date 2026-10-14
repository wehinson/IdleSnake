// Independent of the unrelated root balance harness; uses the shipped formula.
const rewards = require("../engine/minigame-rewards.js");
function repeat(incomePerSecond, modes, runs, won) {
  const earnings = Object.fromEntries(rewards.modes.map(mode => [mode, 0]));
  const payouts = [];
  for (let i = 0; i < runs; i++) {
    const mode = modes[i % modes.length];
    const result = rewards.calculate({ normalizedScore: 1, won, incomePerSecond, historicalEarnings: earnings[mode], random: .5 });
    earnings[mode] += result.amount; payouts.push(result.amount);
  }
  return { first: payouts[0], tenth: payouts[9], hundredth: payouts[99], total: Math.round(payouts.reduce((a, b) => a + b, 0) * 10000) / 10000 };
}
const result = [0, 99, 9999].map(incomePerSecond => ({
  incomePerSecond,
  freshScoreOnly: rewards.calculate({ normalizedScore: 1, incomePerSecond }).amount,
  genuineLoss: rewards.calculate({ normalizedScore: 1, incomePerSecond, eligible: false }).amount,
  freshWin: rewards.calculate({ normalizedScore: 1, incomePerSecond, won: true }).amount,
  scoreQuarter: rewards.calculate({ normalizedScore: .25, incomePerSecond }).amount,
  scoreFour: rewards.calculate({ normalizedScore: 4, incomePerSecond }).amount,
  repeatedWins: repeat(incomePerSecond, ["breakout"], 100, true),
  rotatingWins: repeat(incomePerSecond, ["breakout", "snakebird", "sokoban", "battleship", "duel"], 100, true),
  repeatedScoreOnly: repeat(incomePerSecond, ["centipede"], 100, false),
  timedNibbler: [45000, 90000, 180000].map(remainingMs => ({ remainingMs,
    amount: rewards.calculate({ normalizedScore: remainingMs / rewards.MAZE_TIME_LIMIT_MS, won: true, incomePerSecond }).amount })),
  freshAfterRepeats: rewards.calculate({ normalizedScore: 1, incomePerSecond, won: true }).amount
}));
function realTraces() {
  const { createGameSession } = require("../engine/session.js");
  const { runHeadless } = require("../engine/simulate.js");
  return [1, 12, 44].flatMap(seed => ["duel", "maze", "crossing", "broodline", "centipede", "runner", "breakout"].map(mode => {
    let value = seed;
    const game = createGameSession({ now: 0, rng: () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296) });
    game.dispatch({ type: "selectMode", mode });
    game.dispatch({ type: "direction", direction: mode === "runner" ? "up" : ["duel", "centipede", "breakout"].includes(mode) ? "left" : mode === "maze" ? "right" : "up" });
    const trace = runHeadless(game, { steps: 6000, stepMs: 40, controller: s => s.phase === "ready" ? { type: "begin" } : null });
    const ended = trace.events.find(e => e.type === "runEnded");
    const details = ended?.rewardDetails;
    return { mode, seed, ended: trace.ended, elapsedMs: trace.snapshot.elapsedMs,
      score: trace.snapshot.active.score ?? trace.snapshot.active.pendingSeeds,
      outcome: ended?.outcome, normalizedScore: details?.normalizedScore, actualAward: ended?.reward,
      appliedMovement: trace.events.some(e => e.type === "controlledMove"),
      awardsAtIncomes: details ? [0, 99, 9999].map(incomePerSecond => rewards.calculate({ normalizedScore: details.normalizedScore,
        won: details.winFactor === 3, incomePerSecond, eligible: ended.reward > 0 }).amount) : null };
  }));
}
if (require.main === module) console.log(JSON.stringify(process.argv.includes("--traces") ? { matrix: result, traces: realTraces() } : result, null, 2));
module.exports = { repeat, result, realTraces };
