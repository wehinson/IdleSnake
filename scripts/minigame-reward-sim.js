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
  freshLoss: rewards.calculate({ normalizedScore: 1, incomePerSecond }).amount,
  freshWin: rewards.calculate({ normalizedScore: 1, incomePerSecond, won: true }).amount,
  scoreQuarter: rewards.calculate({ normalizedScore: .25, incomePerSecond }).amount,
  scoreFour: rewards.calculate({ normalizedScore: 4, incomePerSecond }).amount,
  repeatedWins: repeat(incomePerSecond, ["breakout"], 100, true),
  rotatingWins: repeat(incomePerSecond, ["breakout", "snakebird", "sokoban", "battleship", "duel"], 100, true),
  repeatedEndless: repeat(incomePerSecond, ["maze"], 100, false),
  freshAfterRepeats: rewards.calculate({ normalizedScore: 1, incomePerSecond, won: true }).amount
}));
if (require.main === module) console.log(JSON.stringify(result, null, 2));
module.exports = { repeat, result };
