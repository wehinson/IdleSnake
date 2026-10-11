const test = require("node:test");
const assert = require("node:assert/strict");
const rewards = require("./minigame-rewards.js");
const config = require("./config.js");
const { createGameSession } = require("./session.js");
const { runHeadless } = require("./simulate.js");

const performances = {
  duel: [{ score: 10 }, { winner: "player" }],
  maze: [{ score: 320 }, {}],
  breakout: [{ score: 400 }, { won: true }],
  crossing: [{ score: 600 }, {}],
  snakebird: [{ moves: 20, definition: { optimalMoves: 20 } }, { won: true }],
  sokoban: [{ score: 220, moves: 30, crates: [{}, {}], totalPellets: 2 }, { won: true }],
  broodline: [{ pendingSeeds: 63, kills: 20, round: 1, wave: 5 }, { banked: true }],
  battleship: [{ score: 5, enemy: { shots: { "0,0": "hit" } } }, { won: true }],
  centipede: [{ score: 1000, wavesCleared: 1 }, {}],
  runner: [{ score: 1000 }, {}]
};
function solve(game, mode = "snakebird") {
  const definition = mode === "snakebird" ? { map: ["....", "HG..", "####"], optimalMoves: 1, firstClearReward: 20, replayReward: 5 }
    : { map: ["#####", "#...#", "#####"], snake: [{ x: 1, y: 1 }], crates: [{ x: 2, y: 1, kind: "light" }], goals: [{ x: 3, y: 1 }], pellets: [], plates: [], gates: [], reward: 7 };
  game.dispatch({ type: "selectMode", mode, setup: { definition } });
  return game.dispatch({ type: "direction", direction: "right" });
}

test("inventory includes all nine catalog modes and hidden Runner, with measured calibration", () => {
  assert.deepEqual(new Set(rewards.modes), new Set([...config.minigameCatalog.map(g => g.mode), "runner"]));
  for (const [mode, [active, outcome]] of Object.entries(performances)) {
    const measured = rewards.performance(mode, active, outcome);
    assert.equal(measured.normalizedScore, 1, mode);
    assert.equal(measured.meaningful, true, mode);
    assert.equal(measured.won, ["duel", "breakout", "snakebird", "sokoban", "battleship"].includes(mode), mode);
    const ledger = rewards.createLedger();
    const run = rewards.beginRun(ledger, mode); run.engaged = true;
    const paid = rewards.settle(ledger, run, active, outcome, 0, () => 0.5);
    const nominal = measured.won ? 300 : 100;
    assert.ok(paid.reward >= nominal * .97 && paid.reward <= nominal * 1.03, mode);
    assert.equal(ledger.earnings[mode], paid.reward, mode);
    assert.equal(rewards.settle(ledger, { ...run, paid: false }, active, outcome, 0, () => { throw Error("replay RNG"); }), null, mode);
  }
});

test("score, wins and passive income are monotonic at fixed other factors", () => {
  for (const historicalEarnings of [0, 1000, 1e6, 1e12]) {
    for (const incomePerSecond of [0, 1, 100, 10000, 1e12]) {
      const fixed = { historicalEarnings, incomePerSecond, random: .5 };
      let prior = 0;
      for (const normalizedScore of [0, .001, .1, .5, 1, 2, 10, 1000, 1e12]) {
        const lost = rewards.calculate({ ...fixed, normalizedScore });
        const won = rewards.calculate({ ...fixed, normalizedScore, won: true });
        assert.ok(lost.amount >= prior);
        assert.ok(Math.abs(won.amount - 3 * lost.amount) < .0003, "significant win factor");
        prior = lost.amount;
      }
    }
    let prior = 0;
    for (const incomePerSecond of [0, .01, .1, 1, 10, 100, 10000, 1e12]) {
      const paid = rewards.calculate({ historicalEarnings, incomePerSecond, normalizedScore: 1 });
      assert.ok(paid.amount >= prior); prior = paid.amount;
    }
  }
  assert.equal(rewards.calculate({ normalizedScore: 1 }).amount, 100, "new save floor");
  assert.equal(rewards.calculate({ normalizedScore: 1, incomePerSecond: 99 }).amount, 1000);
  assert.equal(rewards.calculate({ normalizedScore: 1, incomePerSecond: 9999 }).amount, 10000);
});

test("earnings reduce repeats, while switching and reload never reset a mode's history", () => {
  const ledger = rewards.createLedger({ rngState: 42 });
  let previousFactor = 2;
  for (let i = 0; i < 30; i++) {
    const run = rewards.beginRun(ledger, "breakout"); run.engaged = true;
    const paid = rewards.settle(ledger, run, ...performances.breakout, 99, () => .5);
    assert.ok(paid.rewardDetails.diversityFactor < previousFactor);
    previousFactor = paid.rewardDetails.diversityFactor;
    if (i === 10) {
      const other = rewards.beginRun(ledger, "centipede"); other.engaged = true;
      const varied = rewards.settle(ledger, other, ...performances.centipede, 99, () => .5);
      assert.equal(varied.rewardDetails.diversityFactor, 1);
      assert.equal(rewards.createLedger(JSON.parse(JSON.stringify(ledger))).earnings.breakout, ledger.earnings.breakout);
    }
  }
  assert.ok(previousFactor > .25 && previousFactor < .5);
  assert.ok(rewards.calculate({ normalizedScore: 1, historicalEarnings: 0 }).amount >
    rewards.calculate({ normalizedScore: 1, historicalEarnings: 10000 }).amount);
});

test("progress and engagement gates reject idle, reset, placement and failed puzzles", () => {
  for (const [mode, [active, detail]] of Object.entries(performances)) {
    const ledger = rewards.createLedger();
    const run = rewards.beginRun(ledger, mode);
    assert.equal(rewards.settle(ledger, run, active, detail, 100, () => { throw Error("idle RNG"); }).reward, 0, mode);
    assert.equal(ledger.rngState, null);
  }
  for (const mode of rewards.modes) {
    const measured = rewards.performance(mode, { score: 0, moves: 10, pendingSeeds: 0, wave: 1, round: 1, crates: [{}], totalPellets: 2, enemy: { shots: {} } }, {});
    assert.equal(measured.meaningful, false, mode);
  }
  const losingBird = rewards.performance("snakebird", { moves: 99999, definition: { optimalMoves: 10 } }, { won: false });
  assert.equal(losingBird.normalizedScore, 0);
  assert.equal(losingBird.meaningful, false);
  const fast = rewards.performance("snakebird", { moves: 10, definition: { optimalMoves: 10 } }, { won: true });
  const slow = rewards.performance("snakebird", { moves: 20, definition: { optimalMoves: 10 } }, { won: true });
  assert.ok(fast.normalizedScore > slow.normalizedScore);
});

test("bounds and ±3% randomness stay finite for malformed and extreme inputs", () => {
  const nominal = rewards.calculate({ normalizedScore: 1, won: true, incomePerSecond: 99 }).amount;
  assert.equal(rewards.calculate({ normalizedScore: 1, won: true, incomePerSecond: 99, random: 0 }).amount, nominal * .97);
  assert.equal(rewards.calculate({ normalizedScore: 1, won: true, incomePerSecond: 99, random: 1 }).amount, nominal * 1.03);
  for (const value of [-1, NaN, Infinity, -Infinity, undefined, null, "bad", 1e300, Number.MAX_SAFE_INTEGER]) {
    const result = rewards.calculate({ normalizedScore: value, incomePerSecond: value, historicalEarnings: value, random: value, won: true });
    assert.ok(Object.values(result).every(Number.isFinite));
    assert.ok(result.amount >= 0 && result.amount <= rewards.MAX_REWARD);
  }
  const migrated = rewards.createLedger({ earnings: { duel: -1, maze: Infinity, breakout: "72.125", crossing: 1e300 } });
  assert.equal(migrated.earnings.duel, 0); assert.equal(migrated.earnings.maze, 0);
  assert.equal(migrated.earnings.breakout, 72.125); assert.equal(migrated.earnings.crossing, rewards.MAX_VALUE);
});

test("passive query includes actual production inputs and excludes awards, stockpiles and Snake length", () => {
  const game = createGameSession({ now: 0, save: { habitats: { counts: [2] }, upgrades: { foodTypeLevel: 1 } } });
  let snapshot = game.snapshot();
  const baseline = rewards.otherIncomePerSecond(snapshot);
  assert.ok(baseline > 0);
  assert.equal(baseline, snapshot.hud.lengthBonus.seedIncomePerSecond);
  solve(game);
  game.dispatch({ type: "addSeeds", amount: 1e8 });
  snapshot = game.snapshot();
  assert.equal(rewards.otherIncomePerSecond(snapshot), baseline);
  const full = JSON.parse(JSON.stringify(snapshot));
  full.habitats.counts[0] = 20;
  assert.ok(rewards.otherIncomePerSecond(full) > baseline);
  full.migration.settlements.find(s => s.id === full.migration.activeSettlementId).status = "founding";
  assert.equal(rewards.otherIncomePerSecond(full), 0);
});

test("real puzzle completions survive reload/offline once, with a continuous seeded reward stream", () => {
  const uninterrupted = createGameSession({ now: 0, rng: () => .5 });
  const reload = createGameSession({ now: 0, rng: () => .5 });
  for (const game of [uninterrupted, reload]) {
    const first = solve(game);
    assert.ok(first.snapshot.seeds > 0);
    for (let i = 0; i < 5; i++) game.dispatch({ type: "direction", direction: "right" });
    assert.equal(game.snapshot().seeds, first.snapshot.seeds);
  }
  const save = reload.serialize();
  assert.equal(save.session.rewardRun, null);
  const resumed = createGameSession({ now: 0, save, rng: () => { throw Error("saved reward RNG must be used"); } });
  resumed.advanceOffline(10000); resumed.advanceOffline(10000);
  assert.equal(resumed.snapshot().seeds, save.session.seeds);
  assert.deepEqual(resumed.snapshot().minigameRewards, save.session.minigameRewards);
  const a = solve(uninterrupted, "sokoban"); const b = solve(resumed, "sokoban");
  assert.equal(a.events.find(e => e.type === "runEnded").reward, b.events.find(e => e.type === "runEnded").reward);
  assert.deepEqual(a.snapshot.minigameRewards, b.snapshot.minigameRewards);
});

test("legacy and current saves migrate known earnings without inventing them from records", () => {
  for (const save of [
    { records: { best: 9999, sokobanBest: 9999 }, minigameEarnings: { sokoban: 80 } },
    { saveVersion: 5, session: { records: { best: 9999 }, minigameRewards: { earnings: { sokoban: 80 }, rngState: 17 } } }
  ]) {
    const game = createGameSession({ now: 0, save });
    assert.equal(game.snapshot().minigameRewards.earnings.sokoban, 80);
    assert.equal(game.snapshot().minigameRewards.earnings.snakebird, 0);
    assert.deepEqual(createGameSession({ now: 0, save: game.serialize() }).snapshot().minigameRewards, game.snapshot().minigameRewards);
  }
});

test("unfinished games, mode changes, restart and offline hydration never produce free payouts", () => {
  const game = createGameSession({ now: 0, rng: () => .4 });
  for (const mode of rewards.modes) {
    game.dispatch({ type: "selectMode", mode });
    game.dispatch({ type: "begin" });
    game.dispatch({ type: "restart" });
    assert.equal(game.snapshot().seeds, 0, mode);
  }
  const hydrated = createGameSession({ now: 0, save: game.serialize(), rng: () => .4 });
  hydrated.advanceOffline(1e6);
  assert.equal(hydrated.snapshot().seeds, 0);
  assert.equal(hydrated.snapshot().minigameRewards.rngState, null);
});

test("natural endless failures pay once; Start-only automatic progress pays nothing", () => {
  for (const mode of ["duel", "maze", "crossing", "broodline", "centipede", "runner"]) {
    for (const engaged of [true, false]) {
      const game = createGameSession({ now: 0, rng: () => .4 });
      game.dispatch({ type: "selectMode", mode });
      game.dispatch(engaged ? { type: "direction", direction: mode === "runner" ? "up" : mode === "duel" ? "left" : mode === "maze" ? "right" : "up" } : { type: "begin" });
      const result = runHeadless(game, { steps: 1400, stepMs: 100, controller: s => s.phase === "ready" ? { type: "begin" } : null });
      if (mode === "crossing" && !engaged) {
        assert.equal(result.ended, false, "idle Crossing waits for movement");
        assert.equal(result.snapshot.seeds, 0); continue;
      }
      assert.equal(result.ended, true, mode);
      const ended = result.events.filter(e => e.type === "runEnded");
      assert.equal(ended.length, 1, mode);
      if (!engaged) assert.equal(ended[0].reward, 0, `${mode}: autoplay`);
      assert.equal(game.tick(1000).events.some(e => e.type === "runEnded"), false, mode);
      assert.equal(game.snapshot().minigameRewards.earnings[mode], ended[0].reward, mode);
    }
  }
});
