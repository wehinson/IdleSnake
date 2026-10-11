const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const snake = require("./snake.js");
const { snakeConfig } = require("./config.js");
const { validateSaveCandidate } = require("./save-guard.js");

function gameAt({ foods = [{ x: 11, y: 10, kind: "seed" }], body, speed = "snake", score = 0,
  upgrades = {}, rng = () => 0.5 } = {}) {
  const initial = createGameSession({ now: 1000, rng: () => 0.5 });
  initial.dispatch({ type: "selectMode", mode: "snake", setup: {
    grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "right",
    snake: body || [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]
  } });
  const saved = initial.serialize();
  saved.session.active.foods = foods;
  saved.session.active.score = score;
  saved.session.snakeSpeed = speed;
  Object.assign(saved.session.upgrades, upgrades);
  const game = createGameSession({ save: saved, now: 1000, rng });
  game.dispatch({ type: "begin" });
  return game;
}
const turn = (game, direction = "up", inputAt, type = "direction") => game.dispatch({ type, direction, inputAt });
const rejected = result => result.events.some(e => e.type === "actionRejected");
const deferred = result => result.events.some(e => e.deferredUntilSeed);

test("84.9% turns normally; 85% and 99% hold the Seed heading then turn exactly once", () => {
  for (const progress of [0.849, 0.85, 0.99]) {
    for (const type of ["direction", "playDirection"]) {
      const game = gameAt();
      const interval = game.snapshot().active.tickMs;
      game.tick(interval * progress);
      const requested = turn(game, "up", undefined, type);
      const held = progress >= 0.85;
      assert.equal(deferred(requested), held);
      assert.deepEqual(requested.snapshot.active.directionQueue, held ? [] : ["up"]);
      assert.equal(requested.snapshot.active.direction, "right");
      const stepped = game.tick(interval - requested.snapshot.modeAccumulatorMs);
      assert.deepEqual(stepped.snapshot.active.snake[0], held ? { x: 11, y: 10 } : { x: 10, y: 9 });
      assert.equal(stepped.snapshot.active.score, held ? 1 : 0);
      assert.equal(stepped.snapshot.seeds, held ? 1 : 0);
      assert.equal(stepped.events.filter(e => e.type === "eat").length, held ? 1 : 0);
      if (held) {
        assert.deepEqual(stepped.snapshot.active.directionQueue, ["up"]);
        const next = game.tick(stepped.snapshot.active.tickMs);
        assert.deepEqual(next.snapshot.active.snake[0], { x: 11, y: 9 });
        assert.equal(next.snapshot.active.score, 1);
        assert.equal(next.events.some(e => e.type === "eat"), false);
      }
    }
  }
});

test("empty cells, eggs and Seeds two cells away do not hold late turns", () => {
  for (const foods of [[], [{ x: 11, y: 10, kind: "egg" }], [{ x: 12, y: 10, kind: "seed" }]]) {
    const game = gameAt({ foods }); game.tick(198);
    assert.equal(deferred(turn(game)), false);
    assert.deepEqual(game.tick(2).snapshot.active.snake[0], { x: 10, y: 9 });
  }
});

test("latest legal grace turn replaces its predecessor; invalid requests retain it", () => {
  const game = gameAt(); game.tick(170);
  assert.equal(deferred(turn(game, "up")), true);
  assert.equal(deferred(turn(game, "down")), true);
  for (const direction of ["left", "right", "unknown"]) assert.equal(rejected(turn(game, direction)), true);
  assert.equal(game.snapshot().active.deferredSeedTurn, "down");
  assert.deepEqual(game.tick(30).snapshot.active.directionQueue, ["down"]);
  assert.deepEqual(game.tick(game.snapshot().active.tickMs).snapshot.active.snake[0], { x: 11, y: 11 });
});

test("unsafe deferred wall/body turns are discarded after pickup without losing the Seed", () => {
  for (const body of [
    [{ x: 18, y: 0 }, { x: 17, y: 0 }, { x: 16, y: 0 }],
    [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 }, { x: 12, y: 9 }]
  ]) {
    const game = gameAt({ body, foods: [{ x: body[0].x + 1, y: body[0].y, kind: "seed" }] });
    game.tick(170); turn(game);
    const result = game.tick(30);
    assert.equal(result.snapshot.active.score, 1);
    assert.equal(result.snapshot.phase, "running");
    assert.deepEqual(result.snapshot.active.directionQueue, []);
    assert.equal(result.snapshot.active.deferredSeedTurn, undefined);
  }
});

test("early-buffered Seed heading and earlier queued path retain precedence", () => {
  const game = gameAt({ foods: [{ x: 10, y: 9, kind: "seed" }] });
  game.tick(100); turn(game, "up"); turn(game, "left");
  game.tick(70);
  assert.equal(deferred(turn(game, "down")), true);
  const step = game.tick(30).snapshot;
  assert.deepEqual(step.active.snake[0], { x: 10, y: 9 });
  assert.deepEqual(step.active.directionQueue, ["left", "down"]);
  assert.deepEqual(game.tick(step.active.tickMs).snapshot.active.snake[0], { x: 9, y: 9 });
});

test("presets and accelerated speeds share the fractional boundary", () => {
  for (const speed of Object.keys(snakeConfig.speedPresets)) {
    for (const score of [0, 250]) {
      for (const progress of [0.849, 0.85, 0.99]) {
        const game = gameAt({ speed, score });
        const interval = game.snapshot().active.tickMs;
        game.tick(interval * progress);
        assert.equal(deferred(turn(game)), progress >= 0.85, `${speed}, score ${score}, ${progress}`);
      }
    }
  }
});

test("pause, save/reload and a speed change preserve the pending grace turn", () => {
  const game = gameAt(); game.tick(170); turn(game);
  game.dispatch({ type: "pause" });
  assert.equal(rejected(turn(game, "down")), true);
  game.tick(1000);
  assert.equal(game.snapshot().modeAccumulatorMs, 170);
  const saved = game.serialize();
  assert.equal(validateSaveCandidate(saved).ok, true);
  const restored = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.5 });
  assert.deepEqual(restored.snapshot().active, game.snapshot().active);
  restored.dispatch({ type: "setSnakeSpeed", snakeSpeed: "rabbit" });
  restored.dispatch({ type: "resume" });
  const before = restored.snapshot();
  assert.ok(Math.abs(before.modeAccumulatorMs / before.active.tickMs - 0.85) < 1e-12);
  const step = restored.tick(before.active.tickMs - before.modeAccumulatorMs).snapshot;
  assert.equal(step.active.score, 1);
  assert.deepEqual(step.active.directionQueue, ["up"]);
  assert.equal(restored.dispatch({ type: "restart" }).snapshot.active.deferredSeedTurn, undefined);
});

test("input timestamps honor 84.9/85/99% through the 34 ms correction window", () => {
  for (const lateness of [0, 16, 34]) {
    for (const progress of [0.849, 0.85, 0.99]) {
      const game = gameAt(); game.tick(200 + lateness);
      const result = turn(game, "up", 1000 + 200 * progress);
      const held = progress >= 0.85;
      assert.equal(result.events.some(e => e.type === "movementCorrected"), !held);
      assert.deepEqual(result.snapshot.active.snake[0], held ? { x: 11, y: 10 } : { x: 10, y: 9 });
      assert.equal(result.snapshot.seeds, held ? 1 : 0);
      assert.equal(result.events.some(e => e.type === "eat"), false, "replay must not emit a second pickup");
      assert.ok(Math.abs(result.snapshot.modeAccumulatorMs - lateness) < 1e-10);
    }
  }
  const late = gameAt(); late.tick(235);
  assert.equal(turn(late, "up", 1169.8).events.some(e => e.type === "movementCorrected"), false);
  assert.equal(late.snapshot().active.score, 1);
});

test("timestamps processed before the deadline use request time, and future time cannot bypass grace", () => {
  for (const inputAt of [1169.8, 1170, 1198, 9000]) {
    const game = gameAt(); game.tick(198);
    const result = turn(game, "up", inputAt);
    assert.equal(deferred(result), inputAt >= 1170);
    assert.equal(game.tick(2).snapshot.active.score, inputAt >= 1170 ? 1 : 0);
  }
});

test("a pre-85% timestamp predating the last frame still corrects; repeated late requests keep the latest legal turn", () => {
  const early = gameAt(); early.tick(195); early.tick(10);
  assert.equal(turn(early, "up", 1169.8).events.some(e => e.type === "movementCorrected"), true);
  assert.equal(early.snapshot().active.score, 0);
  const late = gameAt(); late.tick(195); late.tick(10);
  turn(late, "up", 1170);
  assert.deepEqual(late.snapshot().active.directionQueue, ["up"]);
  turn(late, "down", 1198);
  assert.deepEqual(late.snapshot().active.directionQueue, ["down"]);
  assert.equal(rejected(turn(late, "left", 1199)), true);
  assert.deepEqual(late.snapshot().active.directionQueue, ["down"]);
  assert.equal(late.snapshot().active.score, 1);
  assert.equal(late.snapshot().seeds, 1);
});

test("a full early buffer still retains one latest legal grace request after the Seed step", () => {
  const game = gameAt({ foods: [{ x: 10, y: 9, kind: "seed" }] });
  game.tick(100); turn(game, "up"); turn(game, "left"); turn(game, "up");
  game.tick(70);
  assert.equal(deferred(turn(game, "right")), true);
  const result = game.tick(30);
  assert.deepEqual(result.snapshot.active.directionQueue, ["left", "up", "right"]);
  assert.equal(result.snapshot.active.score, 1);
});

test("Ready and other modes retain normal turn behavior", () => {
  const game = gameAt(); game.dispatch({ type: "restart" });
  assert.equal(deferred(turn(game)), false);
  assert.equal(game.snapshot().phase, "running");
  game.dispatch({ type: "selectMode", mode: "duel" });
  game.dispatch({ type: "begin" }); game.tick(100);
  assert.equal(deferred(turn(game, "left")), false);
  assert.deepEqual(game.snapshot().active.directionQueue, ["left"]);
});

test("batched and sliced stepping agree after a held pickup", () => {
  function run(slices) {
    const game = gameAt(); game.tick(198); turn(game);
    const events = slices.flatMap(dt => game.tick(dt).events);
    return { snapshot: game.snapshot(), events };
  }
  const batched = run([302]);
  const sliced = run([2, 100, 100, 100]);
  assert.deepEqual(batched, sliced);
  assert.equal(batched.events.filter(e => e.type === "eat").length, 1);
});

test("core step itself releases deferred input only after canonical Seed consumption", () => {
  const state = snake.createSnakeMode({ columns: 20, rows: 20 }, {
    direction: "right", snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], rng: () => 0.5
  });
  state.foods = [{ x: 11, y: 10, kind: "seed" }];
  assert.equal(snake.seedTurnGraceHeading(state, state.tickMs * 0.85), "right");
  assert.equal(snake.deferSeedTurn(state, "up"), true);
  const step = snake.stepSnake(state, { rng: () => 0.5 });
  assert.deepEqual(step.state.snake[0], { x: 11, y: 10 });
  assert.deepEqual(step.state.directionQueue, ["up"]);
  assert.equal(step.events.filter(e => e.type === "eat").length, 1);
});

test("approved tongue presentation keeps the imminent heading through grace and removes the consumed Seed", () => {
  const fs = require("node:fs");
  const vm = require("node:vm");
  const tongue = require("./tongue.js");
  const source = fs.readFileSync(require.resolve("../game.js"), "utf8");
  const context = vm.createContext({ gameView: {} });
  vm.runInContext(source.slice(source.indexOf("function pendingHeadDirection()"), source.indexOf("// Draw the final segment")), context);
  const tracker = tongue.createCatchTracker("gooFork", { outwardDurationScale: 0.5, returnOnCancel: true });
  const game = gameAt();
  const update = nowMs => {
    const snap = game.snapshot();
    context.gameView = snap.active;
    const heading = vm.runInContext("pendingHeadDirection()", context);
    return { heading, frame: tracker.update({ head: snap.active.snake[0], direction: heading,
      seeds: snap.active.foods.filter(f => f.kind !== "egg"), running: true, nowMs,
      tickMs: snap.active.tickMs, stepProgress: snap.modeAccumulatorMs / snap.active.tickMs }) };
  };
  update(0); game.tick(170);
  const before = update(170);
  turn(game);
  const held = update(170);
  assert.equal(held.heading, "right");
  assert.deepEqual(held.frame, before.frame);
  assert.notEqual(held.frame.phase, "return");
  const pickup = game.tick(30);
  const after = update(200);
  assert.equal(after.heading, "up");
  assert.equal(pickup.events.filter(e => e.type === "eat").length, 1);
  assert.equal(game.snapshot().active.foods.some(f => f.x === 11 && f.y === 10), false);
  assert.equal(after.frame, null);
});

test("timestamped grace replacement behind earlier buffers agrees before pickup and 0/5/16/34 ms late", () => {
  function run(lateness, delayed) {
    let draws = 0;
    const game = gameAt({ foods: [{ x: 10, y: 9, kind: "seed" }], rng: () => { draws++; return 0.5; } });
    game.tick(100); turn(game, "up"); turn(game, "left");
    game.tick(70); turn(game, "down");
    if (delayed) game.tick(30 + lateness);
    else game.tick(28);
    const replacement = turn(game, "up", 1198);
    assert.equal(rejected(replacement), false);
    assert.equal(deferred(replacement), true);
    assert.equal(replacement.events.some(e => e.type === "eat" || e.type === "movementCorrected"), false);
    if (!delayed) game.tick(2 + lateness);
    assert.deepEqual(game.snapshot().active.directionQueue, ["left", "up"]);
    assert.deepEqual(game.snapshot().active.seedTurnQueueGuards, [1]);
    const invalid = turn(game, "right", 1199);
    assert.equal(rejected(invalid), true);
    assert.deepEqual(game.snapshot().active.directionQueue, ["left", "up"]);
    assert.equal(draws, 1, "replay must reuse the canonical pickup RNG draw");
    const saved = game.serialize();
    assert.equal(validateSaveCandidate(saved).ok, true);
    const restored = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.5 });
    assert.deepEqual(restored.snapshot().active, game.snapshot().active);
    return { snapshot: game.snapshot(), saved };
  }
  for (const lateness of [0, 5, 16, 34]) assert.deepEqual(run(lateness, true), run(lateness, false));
});

const respawnSafetyBody = [
  [10, 10], [9, 10], [9, 11], [10, 11], [11, 11],
  [11, 10], [11, 9], [11, 8], [10, 8], [10, 7]
].map(([x, y]) => ({ x, y }));
const respawnSafetyFoods = [{ x: 10, y: 9, kind: "seed" }, { x: 9, y: 9, kind: "seed" }];
const respawnSafetyDraws = [0, 0.4228240862476992, 0];

test("core revalidates grace turn after buffered pickups and their respawns without speculative RNG", () => {
  function run(reload) {
    let state = snake.createSnakeMode({ columns: 20, rows: 20 }, {
      snake: respawnSafetyBody, direction: "right", tickMs: 200,
      upgrades: { foodTypeLevel: 0, foodCountLevel: 1, shieldLevel: 0 }, rng: () => 0.5
    });
    state.foods = structuredClone(respawnSafetyFoods);
    state.directionQueue = ["up", "left", "up"];
    assert.equal(snake.deferSeedTurn(state, "right"), true);
    let draws = 0;
    const events = [];
    for (let stepIndex = 0; stepIndex < 4; stepIndex++) {
      const result = snake.stepSnake(state, { rng: () => {
        assert.ok(draws < respawnSafetyDraws.length, "only actual pickups may consume RNG");
        return respawnSafetyDraws[draws++];
      } });
      assert.equal(result.alive, true);
      events.push(...result.events);
      if (stepIndex === 0) assert.deepEqual(state.seedTurnQueueGuards, [2]);
      if (stepIndex === 1) assert.deepEqual(state.seedTurnQueueGuards, [1]);
      if (stepIndex === 2) {
        assert.deepEqual(state.snake[0], { x: 9, y: 8 });
        assert.equal(state.snake.length, 13, "newly spawned Seed grew the body");
        assert.deepEqual(state.directionQueue, ["right"]);
        assert.deepEqual(state.seedTurnQueueGuards, [0]);
      }
      if (reload) {
        const saved = JSON.parse(JSON.stringify(state));
        state = snake.restoreSnakeMode(saved, { upgrades: saved.upgrades, seeds: saved.seeds,
          best: saved.best, speedMultiplier: saved.speedMultiplier });
        assert.deepEqual(state, saved, "guard identity must survive every save boundary");
      }
    }
    assert.equal(draws, 3);
    assert.equal(state.score, 3);
    assert.equal(state.seeds, 3);
    assert.deepEqual(state.snake[0], { x: 9, y: 7 });
    assert.deepEqual(state.directionQueue, []);
    assert.equal(state.seedTurnQueueGuards, undefined);
    assert.equal(events.some(e => e.type === "gameOver" || e.type === "shield"), false);
    return { state, events };
  }
  assert.deepEqual(run(true), run(false));
});

test("respawn growth safety is deterministic for batched, sliced and saved session stepping", () => {
  function run(kind) {
    let draws = 0;
    const rng = () => {
      assert.ok(draws < respawnSafetyDraws.length);
      return respawnSafetyDraws[draws++];
    };
    let game = gameAt({ foods: structuredClone(respawnSafetyFoods), body: respawnSafetyBody,
      upgrades: { foodCountLevel: 1 }, rng });
    turn(game, "up"); turn(game, "left"); turn(game, "up");
    game.tick(170); turn(game, "right");
    const events = [...game.tick(30).events];
    if (kind === "saved") {
      const saved = game.serialize();
      assert.equal(validateSaveCandidate(saved).ok, true);
      const before = game.snapshot();
      game = createGameSession({ save: saved, now: saved.savedAt, rng });
      assert.deepEqual(game.snapshot().active, before.active);
    }
    let remaining = 600;
    while (remaining > 0) {
      const slice = kind === "batched" ? remaining : Math.min(remaining, 10);
      events.push(...game.tick(slice).events);
      remaining -= slice;
    }
    assert.equal(game.snapshot().phase, "running");
    assert.equal(game.snapshot().active.score, 3);
    assert.equal(game.snapshot().seeds, 3);
    assert.deepEqual(game.snapshot().active.snake[0], { x: 9, y: 7 });
    assert.equal(events.filter(e => e.type === "eat").length, 3);
    assert.equal(draws, 3);
    const snapshot = structuredClone(game.snapshot());
    const saved = game.serialize();
    const committedTime = 200 + events.filter(e => e.type === "speedChanged").reduce((sum, e) => sum + e.tickMs, 0);
    assert.ok(Math.abs(snapshot.modeAccumulatorMs - (800 - committedTime)) < 1e-9);
    assert.ok(Math.abs(snapshot.elapsedMs - 800) < 1e-9);
    // Existing fractional tick arithmetic differs at machine precision when
    // sliced. Only clocks tolerate that; geometry, rewards, saves and events
    // below must otherwise match exactly.
    snapshot.elapsedMs = saved.session.elapsedMs = snapshot.hud.elapsedMs = 800;
    snapshot.modeAccumulatorMs = saved.session.modeAccumulatorMs = Number(snapshot.modeAccumulatorMs.toFixed(9));
    return { snapshot, saved, events };
  }
  assert.deepEqual(run("batched"), run("sliced"));
  assert.deepEqual(run("saved"), run("sliced"));
});

test("multiple pending grace guards follow their own buffered turns and save boundaries", () => {
  let state = snake.createSnakeMode({ columns: 20, rows: 20 }, {
    direction: "right", snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], rng: () => 0.5
  });
  state.foods = [{ x: 10, y: 9, kind: "seed" }, { x: 9, y: 9, kind: "seed" }];
  state.directionQueue = ["up", "left"];
  snake.deferSeedTurn(state, "up");
  snake.stepSnake(state, { rng: () => 0 });
  assert.deepEqual(state.directionQueue, ["left", "up"]);
  assert.deepEqual(state.seedTurnQueueGuards, [1]);
  snake.deferSeedTurn(state, "right");
  snake.stepSnake(state, { rng: () => 0 });
  assert.deepEqual(state.directionQueue, ["up", "right"]);
  assert.deepEqual(state.seedTurnQueueGuards, [0, 1]);
  const saved = JSON.parse(JSON.stringify(state));
  state = snake.restoreSnakeMode(saved, { upgrades: saved.upgrades, seeds: saved.seeds,
    best: saved.best, speedMultiplier: saved.speedMultiplier });
  assert.deepEqual(state, saved);
  snake.stepSnake(state, { rng: () => 0 });
  assert.deepEqual(state.snake[0], { x: 9, y: 8 });
  assert.deepEqual(state.seedTurnQueueGuards, [0]);
  snake.stepSnake(state, { rng: () => 0 });
  assert.deepEqual(state.snake[0], { x: 10, y: 8 });
  assert.equal(state.seedTurnQueueGuards, undefined);
});

test("discarding an unsafe guarded turn revalidates later inputs against the retained heading", () => {
  const state = snake.createSnakeMode({ columns: 20, rows: 20 }, {
    direction: "up", snake: [{ x: 19, y: 10 }, { x: 19, y: 11 }, { x: 19, y: 12 }], rng: () => 0.5
  });
  state.foods = [];
  state.directionQueue = ["right", "down", "left"];
  state.seedTurnQueueGuards = [0, 2];
  const step = snake.stepSnake(state, { rng: () => { assert.fail("no pickup, no RNG"); } });
  assert.equal(step.alive, true);
  assert.equal(state.direction, "up");
  assert.deepEqual(state.snake[0], { x: 19, y: 9 });
  assert.deepEqual(state.directionQueue, ["left"], "down became an illegal reversal after right was dropped");
  assert.deepEqual(state.seedTurnQueueGuards, [0]);
  snake.stepSnake(state);
  assert.deepEqual(state.snake[0], { x: 18, y: 9 });
  assert.equal(state.seedTurnQueueGuards, undefined);
});
