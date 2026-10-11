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
    const seed = ledger.rngState;
    assert.equal(rewards.settle(ledger, run, active, detail, 100, () => { throw Error("idle RNG"); }).reward, 0, mode);
    assert.equal(ledger.rngState, seed);
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

test("pre-award saves retain the first jitter seed; inconsistent receipt counters recover safely", () => {
  const game = createGameSession({ now: 0, rng: () => .123 });
  game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition: { map: ["....", "HG..", "####"] } } });
  const save = game.serialize();
  assert.ok(Number.isInteger(save.session.minigameRewards.rngState));
  const restored = createGameSession({ now: 0, save, rng: () => { throw Error("first reward cannot reseed"); } });
  const paid = solve(game); const reloaded = solve(restored);
  assert.equal(paid.events.find(e => e.type === "runEnded").reward, reloaded.events.find(e => e.type === "runEnded").reward);
  const ledger = rewards.createLedger({ nextRunId: 1, lastReceipt: { mode: "duel", runId: 10, amount: 100 } });
  const fresh = rewards.beginRun(ledger, "duel"); fresh.engaged = true;
  assert.equal(fresh.runId, 11);
  assert.ok(rewards.settle(ledger, fresh, ...performances.duel, 0, () => .5).reward > 0);
});

test("future Colony production scaling is consumed through the existing income query", () => {
  const snapshot = createGameSession({ now: 0, save: { habitats: { counts: [2] } } }).snapshot();
  const before = rewards.otherIncomePerSecond(snapshot);
  const production = config.habitatConfig.income.basePerSecond;
  try {
    config.habitatConfig.income.basePerSecond = production * 10;
    const after = rewards.otherIncomePerSecond(snapshot);
    assert.ok(Math.abs(after - before * 10) < 1e-10);
    const oldReward = rewards.calculate({ normalizedScore: 1, incomePerSecond: before }).amount;
    const scaled = rewards.calculate({ normalizedScore: 1, incomePerSecond: after }).amount;
    assert.ok(scaled > oldReward && scaled / oldReward < Math.sqrt(10));
  } finally { config.habitatConfig.income.basePerSecond = production; }
});

test("natural Snakebird fall and unsolved Sokoban cannot pay progress or time", () => {
  const game = createGameSession({ now: 0, rng: () => .5 });
  game.dispatch({ type: "selectMode", mode: "snakebird", setup: { definition: { map: ["....", "H...", "...."] } } });
  const fell = game.dispatch({ type: "direction", direction: "right" });
  assert.equal(fell.snapshot.phase, "gameover");
  assert.equal(fell.events.find(e => e.type === "runEnded").reward, 0);
  assert.equal(fell.events.find(e => e.type === "runEnded").outcome, "loss");
  game.dispatch({ type: "selectMode", mode: "sokoban" });
  game.dispatch({ type: "direction", direction: "up" });
  game.tick(10000); game.dispatch({ type: "restart" });
  assert.equal(game.snapshot().seeds, 0, "Sokoban has no terminal loss; abort pays nothing");
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
  assert.equal(hydrated.snapshot().minigameRewards.rngState, game.snapshot().minigameRewards.rngState);
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
      if (engaged && ["broodline", "centipede", "runner"].includes(mode)) assert.ok(ended[0].reward > 0, `${mode}: applied play with earned progress`);
      assert.equal(game.tick(1000).events.some(e => e.type === "runEnded"), false, mode);
      assert.equal(game.snapshot().minigameRewards.earnings[mode], ended[0].reward, mode);
    }
  }
});

test("neutral directions and axes cleared before simulation cannot enable autoplay rewards", () => {
  for (const mode of ["breakout", "centipede"]) {
    const traces = [false, true].map(bypass => {
      const game = createGameSession({ now: 0, rng: () => .4 });
      game.dispatch({ type: "selectMode", mode });
      if (bypass && mode === "breakout") game.dispatch({ type: "direction", direction: "up" });
      else {
        if (bypass) {
          game.dispatch({ type: "setInputAxis", axis: "x", value: 1 });
          game.dispatch({ type: "setInputAxis", axis: "x", value: 0 });
        }
        game.dispatch({ type: "begin" });
      }
      const result = runHeadless(game, { steps: 2500, stepMs: 100, controller: s => s.phase === "ready" ? { type: "begin" } : null });
      assert.equal(result.ended, true, mode);
      assert.equal(result.snapshot.seeds, 0, mode);
      assert.equal(result.snapshot.minigameRewards.earnings[mode], 0, mode);
      assert.equal(result.events.some(e => e.type === "controlledMove"), false, mode);
      return { score: result.snapshot.active.score, steps: result.steps };
    });
    assert.deepEqual(traces[0], traces[1], `${mode}: input never reached simulation`);
  }
});

test("applied movement is recorded before automatic growth or respawn, and rejected motion is not", () => {
  const breakout = require("./breakout.js");
  const centipede = require("./centipede.js");
  const bricks = breakout.createState(); bricks.paddle.input = 1;
  assert.ok(breakout.step(bricks, { deltaMs: 1, boardWidth: 720, boardHeight: 720, elapsedMs: 1, rng: () => .4 }).events.some(e => e.type === "controlledMove"));
  bricks.paddle.x = 720 - breakout.paddleWidth(bricks);
  assert.equal(breakout.step(bricks, { deltaMs: 1, boardWidth: 720, boardHeight: 720, elapsedMs: 2, rng: () => .4 }).events.some(e => e.type === "controlledMove"), false);
  const shooter = centipede.createState({ rng: () => .4 });
  shooter.player.inputX = -1;
  assert.ok(centipede.step(shooter, { rng: () => .4 }).events.some(e => e.type === "controlledMove"));
  shooter.player.x = 0;
  assert.equal(centipede.step(shooter, { rng: () => .4 }).events.some(e => e.type === "controlledMove"), false);
});

test("cancelled Nibbler directions match Start-only scoring traces and never enable a payout", () => {
  const traces = [false, true].map(cancelled => {
    let index = 0;
    const draws = [.4, .4, .6547619047619048];
    const game = createGameSession({ now: 0, rng: () => draws[index++] ?? .4 });
    game.dispatch({ type: "selectMode", mode: "maze" });
    if (cancelled) {
      game.dispatch({ type: "direction", direction: "right" });
      game.dispatch({ type: "direction", direction: "up" });
    } else game.dispatch({ type: "begin" });
    const trace = [];
    for (let step = 0; step < 4; step++) {
      const result = game.tick(100);
      const { directionQueue, ...world } = result.snapshot.active;
      trace.push({ active: world, events: result.events });
    }
    assert.equal(game.snapshot().phase, "gameover");
    assert.equal(game.snapshot().active.score, 10, "real autoplay eats one food");
    assert.equal(game.snapshot().seeds, 0);
    assert.equal(game.snapshot().minigameRewards.earnings.maze, 0);
    return { trace, ledger: game.snapshot().minigameRewards };
  });
  assert.deepEqual(traces[0], traces[1], "cancelled input did not affect any simulated movement or reward RNG");
});

test("an applied Nibbler turn with earned food pays, while a turn rejected by a wall does not", () => {
  for (const open of [["2,2", "3,2", "4,2"], ["2,2", "2,1"]]) {
    const game = createGameSession({ now: 0, rng: () => .4 });
    game.dispatch({ type: "selectMode", mode: "maze", setup: {
      grid: { columns: 5, rows: 5 }, tickMs: 100, open,
      path: [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }], food: { x: 3, y: 2 }
    } });
    game.dispatch({ type: "direction", direction: "right" });
    const result = runHeadless(game, { steps: 10, stepMs: 100 });
    assert.equal(result.ended, true);
    const amount = result.events.find(e => e.type === "runEnded").reward;
    if (open.includes("3,2")) {
      assert.ok(result.snapshot.active.score >= 10);
      assert.ok(amount > 0, "actual nondefault move ate food");
    } else assert.equal(amount, 0, "accepted direction never moved into its wall");
  }
});

test("directional modes require an applied command, even when a terminal step reports earned progress", () => {
  for (const [mode, moduleName, stepName, direction] of [
    ["duel", "duel", "stepVsSnake", "left"], ["maze", "maze", "stepMaze", "right"],
    ["crossing", "crossing", "stepCrossing", "up"], ["broodline", "broodline", "step", "up"]
  ]) {
    const engine = require(`./${moduleName}.js`);
    const originalStep = engine[stepName];
    for (const applied of [false, true]) {
      const game = createGameSession({ now: 0, rng: () => .4 });
      game.dispatch({ type: "selectMode", mode, setup: mode === "maze" ? {
        open: ["10,15", "11,15", "12,15"], food: { x: 12, y: 15 }
      } : mode === "crossing" ? { entryColumn: 0, grid: { columns: 10, rows: 3 } } : undefined });
      const queued = game.dispatch({ type: "direction", direction });
      assert.equal(queued.events.some(e => e.type === "actionRejected"), false, mode);
      let steps = 0;
      engine[stepName] = (active, context) => {
        if (applied && steps++ === 0) return originalStep(active, context);
        // Terminal fixture represents termination before the queued command runs.
        active.score = 100; active.pendingSeeds = 2; active.kills = 1;
        return { state: active, alive: false, winner: "player", events: [] };
      };
      let ended;
      try {
        for (let tick = 0; tick < 8 && !ended; tick++) ended = game.tick(100).events.find(e => e.type === "runEnded");
      } finally { engine[stepName] = originalStep; }
      assert.ok(ended, mode);
      if (applied) assert.ok(ended.reward > 0, `${mode}: real movement applied first`);
      else assert.equal(ended.reward, 0, `${mode}: raw accepted command never ran`);
    }
  }
});

test("exhausted receipt IDs disable rewards without preventing directional game startup", () => {
  const game = createGameSession({ now: 0, rng: () => .4, save: {
    minigameRewards: { nextRunId: Number.MAX_SAFE_INTEGER - 1 }
  } });
  for (const mode of ["duel", "maze", "crossing", "broodline"]) {
    const selected = game.dispatch({ type: "selectMode", mode });
    assert.equal(selected.snapshot.phase, "ready", mode);
    game.dispatch({ type: "direction", direction: mode === "duel" ? "left" : mode === "maze" ? "right" : "up" });
    game.tick(100);
    assert.equal(game.snapshot().seeds, 0, mode);
  }
});
