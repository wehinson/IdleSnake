const test = require("node:test");
const assert = require("node:assert/strict");
const rewards = require("./minigame-rewards.js");
const { createGameSession } = require("./session.js");

const timedClear = { score: 150, timeLimitMs: 180000, remainingMs: 90000,
  totalSeeds: 15, seedsCollected: 15, seeds: [], result: "won" };
const cases = {
  duel: [{ score: 10 }, { winner: "player" }],
  maze: [timedClear, { won: true, reason: "allSeeds" }],
  breakout: [{ score: 400 }, { won: true }],
  snakebird: [{ moves: 1, definition: { optimalMoves: 1 } }, { won: true }],
  sokoban: [{ score: 110, moves: 1, crates: [{}], totalPellets: 1 }, { won: true }],
  battleship: [{ score: 5, enemy: { shots: { "0,0": "sunk" } } }, { won: true }],
  crossing: [{ score: 600 }, {}], broodline: [{ pendingSeeds: 63, kills: 1 }, { banked: true }],
  centipede: [{ score: 1000 }, {}], runner: [{ score: 1000 }, {}]
};
function award(mode, active, detail, engaged = true) {
  const ledger = rewards.createLedger({ earnings: { [mode]: .125 }, rngState: 19 });
  const run = rewards.beginRun(ledger, mode); run.engaged = engaged;
  const paid = rewards.settle(ledger, run, active, detail, 0, () => { throw Error("saved RNG cannot reseed"); });
  return { ledger, run, paid };
}

test("revision: whole-Seed ceiling follows the complete capped formula, including tiny fractions", () => {
  for (const [input, expected] of [[0, 0], [Number.MIN_VALUE, 1], [1e-9, 1], [1, 1],
    [1.00000001, 2], [71.999999, 72], [rewards.MAX_REWARD, rewards.MAX_REWARD],
    [1e300, rewards.MAX_REWARD], [-1, 0], [NaN, 0], [Infinity, 0]]) {
    assert.equal(rewards.roundReward(input), expected);
  }
  const random = .5000001;
  const raw = 40 * (1 + .03 * (2 * random - 1));
  assert.equal(Math.round(raw * 10000) / 10000, 40, "old four-decimal rounding would erase this positive fraction");
  assert.equal(rewards.calculate({ normalizedScore: 0, random }).amount, 41);
  assert.equal(rewards.calculate({ normalizedScore: 0, random: .5 }).amount, 40);
  assert.equal(rewards.calculate({ normalizedScore: 1e300, incomePerSecond: 1e300, won: true, eligible: false }).amount, 0);
});

test("revision: all ten modes distinguish genuine losses/draws from score-only and deliberate banking", () => {
  assert.deepEqual(new Set(Object.keys(cases)), new Set(rewards.modes));
  assert.equal(rewards.winLossModes.length, 6); assert.equal(rewards.scoreOnlyModes.length, 4);
  for (const [mode, [active, detail]] of Object.entries(cases)) {
    const { ledger, run, paid } = award(mode, active, detail);
    assert.ok(Number.isInteger(paid.reward) && paid.reward > 0, mode);
    assert.equal(ledger.earnings[mode], .125 + paid.reward, mode);
    assert.equal(ledger.lastReceipt.amount, paid.reward, mode);
    assert.equal(paid.rewardDetails.amount, paid.reward, mode);
    assert.equal(rewards.settle(ledger, { ...run, paid: false }, active, detail, 0, () => .9), null, mode);

    const loss = award(mode, active, mode === "duel" ? { winner: "opponent" } : { won: false });
    if (rewards.winLossModes.includes(mode)) {
      assert.equal(loss.paid.reward, 0, mode);
      assert.equal(loss.paid.outcome, "loss", mode);
      assert.equal(loss.ledger.rngState, 19, `${mode}: zero award does not advance RNG`);
      assert.equal(loss.ledger.earnings[mode], .125, mode);
      assert.equal(loss.ledger.lastReceipt.amount, 0, `${mode}: terminal rejection still has one receipt`);
    } else {
      assert.ok(loss.paid.reward > 0, `${mode}: explicit score-only assumption`);
      assert.equal(loss.paid.outcome, "score", mode);
      assert.equal(loss.paid.rewardDetails.winFactor, 1, mode);
    }
  }
  const draw = award("duel", cases.duel[0], { winner: null });
  assert.equal(draw.paid.outcome, "draw"); assert.equal(draw.paid.reward, 0);
  assert.equal(draw.ledger.rngState, 19);
  const bank = award("broodline", cases.broodline[0], { banked: true });
  assert.equal(bank.paid.outcome, "banked"); assert.ok(bank.paid.reward > 0);
});

test("revision: verified timed Nibbler clears reward more remaining milliseconds monotonically", () => {
  let previous = 0;
  for (const remainingMs of [1, 1000, 45000, 90000, 179999, 180000]) {
    const active = { ...timedClear, remainingMs };
    const measured = rewards.performance("maze", active, { won: true });
    assert.equal(measured.normalizedScore, remainingMs / 180000);
    const paid = award("maze", active, { won: true }).paid;
    assert.ok(paid.reward >= previous); previous = paid.reward;
  }
  const ordinary = award("maze", { ...timedClear, remainingMs: 89000 }, { won: true }).paid.reward;
  const stallPenalty = award("maze", { ...timedClear, remainingMs: 87000 }, { won: true }).paid.reward;
  assert.ok(stallPenalty <= ordinary, "3x draining stalled time cannot improve the final reward");
});

test("revision: missing/malformed timers and detail-only Nibbler clear claims fail closed", () => {
  const malformed = [
    {}, { ...timedClear, timeLimitMs: undefined }, { ...timedClear, timeLimitMs: "180000" },
    { ...timedClear, timeLimitMs: 300000 }, { ...timedClear, timeLimitMs: 0 },
    ...[undefined, NaN, Infinity, -1, 0, 180001, "90000"].map(remainingMs => ({ ...timedClear, remainingMs })),
    { ...timedClear, seedsCollected: 14 }, { ...timedClear, totalSeeds: 14 },
    { ...timedClear, seedsCollected: 16, totalSeeds: 16 }, { ...timedClear, seeds: [{}] },
    { ...timedClear, seeds: undefined }, { ...timedClear, result: "timeout" },
    { ...timedClear, result: "selfCollision" }, { ...timedClear, result: null }
  ];
  for (const active of malformed) {
    const detail = { won: true, reason: "allSeeds", ...timedClear };
    const { paid, ledger } = award("maze", active, detail);
    assert.equal(paid.reward, 0); assert.equal(paid.outcome, "loss");
    assert.equal(paid.rewardDetails.normalizedScore, 0);
    assert.equal(ledger.rngState, 19); assert.equal(ledger.earnings.maze, .125);
  }
});

test("revision: genuine wins, score-only progress and bank still require applied play", () => {
  for (const [mode, [active, detail]] of Object.entries(cases)) {
    const { paid, ledger } = award(mode, active, detail, false);
    assert.equal(paid.reward, 0, mode); assert.equal(ledger.rngState, 19, mode);
  }
  for (const mode of rewards.scoreOnlyModes) {
    const { paid } = award(mode, { score: 0, pendingSeeds: 0, kills: 0, round: 1, wave: 1 }, {});
    assert.equal(paid.reward, 0, `${mode}: controls without earned progress`);
  }
  const idleClear = award("maze", { ...timedClear, stalled: true }, { won: true }, false);
  assert.equal(idleClear.paid.reward, 0, "wall-shake/idle metadata cannot manufacture applied engagement");
});

test("revision: whole awards preserve historical fractions, save version, deterministic reload and offline receipts", () => {
  const initialSession = createGameSession({ now: 0, rng: () => .5 });
  initialSession.dispatch({ type: "addSeeds", amount: 7.125 });
  const initial = initialSession.serialize();
  initial.session.minigameRewards = rewards.createLedger({ earnings: { snakebird: .125 }, rngState: 17 });
  const game = createGameSession({ now: 0, save: initial, rng: () => .5 });
  const solve = session => {
    session.dispatch({ type: "selectMode", mode: "snakebird", setup: {
      definition: { map: ["....", "HG..", "####"], optimalMoves: 1 }
    } });
    return session.dispatch({ type: "direction", direction: "right" });
  };
  const first = solve(game);
  const paid = first.events.find(event => event.type === "runEnded");
  assert.ok(Number.isInteger(paid.reward) && paid.reward > 0);
  assert.equal(first.snapshot.seeds, 7.125 + paid.reward);
  assert.equal(first.snapshot.minigameRewards.earnings.snakebird, .125 + paid.reward);
  game.dispatch({ type: "direction", direction: "right" });
  const saved = game.serialize();
  assert.equal(saved.saveVersion, 5); assert.equal(saved.session.minigameRewards.version, 1);
  const reloaded = createGameSession({ now: 0, save: saved, rng: () => .9 });
  reloaded.advanceOffline(1000);
  assert.equal(reloaded.snapshot().seeds, saved.session.seeds);
  assert.deepEqual(reloaded.snapshot().minigameRewards, saved.session.minigameRewards);
  const a = solve(game); const b = solve(reloaded);
  assert.equal(a.events.find(event => event.type === "runEnded").reward, b.events.find(event => event.type === "runEnded").reward);
  assert.deepEqual(a.snapshot.minigameRewards, b.snapshot.minigameRewards);
  assert.equal(rewards.createLedger({ lastReceipt: { mode: "duel", runId: 1, amount: .125 } }).lastReceipt.amount, .125,
    "old paid fractional receipts are retained, never retroactively rounded or paid again");
});
