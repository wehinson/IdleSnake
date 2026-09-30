const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const economy = require("./economy.js");
const { nurseryConfig, snakeConfig } = require("./config.js");
const { validateSaveCandidate } = require("./save-guard.js");

function game(setup = {}) {
  const session = createGameSession({ now: 1000, rng: () => 0.5 });
  session.dispatch({ type: "selectMode", mode: "snake", setup: {
    grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "up",
    snake: [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }], ...setup
  } });
  return session;
}

test("reload preserves food, body, queued turns, countdown, clock, pause and shields", () => {
  for (const phase of ["ready", "running", "paused"]) {
    const session = game();
    if (phase !== "ready") {
      session.dispatch({ type: "begin", initialDelayMs: 100 });
      session.tick(50);
      session.dispatch({ type: "direction", direction: "right" });
      if (phase === "paused") session.dispatch({ type: "pause" });
    }
    const saved = session.serialize();
    assert.equal(validateSaveCandidate(saved).ok, true);
    const restored = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.99 });
    assert.deepEqual(restored.snapshot().active, session.snapshot().active);
    assert.equal(restored.snapshot().phase, phase);
    assert.equal(restored.snapshot().modeAccumulatorMs, session.snapshot().modeAccumulatorMs);
    assert.equal(restored.snapshot().eggBoardCountdown, session.snapshot().eggBoardCountdown);
  }
});

test("long clock gaps and offline reload keep Snake moving through death; pause stays paused", () => {
  const live = game(); live.dispatch({ type: "begin" });
  assert.equal(live.tick(10000).snapshot.phase, "gameover");
  assert.equal(live.tick(10000).events.some((e) => e.type === "runEnded"), false);
  const original = game(); original.dispatch({ type: "begin" });
  const restored = createGameSession({ save: original.serialize(), now: 11000 });
  assert.equal(restored.advanceOffline(11000).snapshot.phase, "gameover");
  original.dispatch({ type: "pause" });
  const paused = createGameSession({ save: original.serialize(), now: 11000 });
  assert.equal(paused.advanceOffline(11000).snapshot.phase, "paused");
  assert.deepEqual(paused.snapshot().active.snake, original.snapshot().active.snake);
});

test("timestamped input corrects the latest move through 34 ms late without changing the deadline", () => {
  for (const lateness of [0, 1, 16, 34]) {
    const session = game(); session.dispatch({ type: "begin" });
    session.tick(200 + lateness);
    const result = session.dispatch({ type: "direction", direction: "right", inputAt: 1199 });
    assert.ok(result.events.some((e) => e.type === "movementCorrected"));
    assert.deepEqual(result.snapshot.active.snake[0], { x: 11, y: 10 });
    assert.equal(result.snapshot.modeAccumulatorMs, lateness);
    assert.equal(result.snapshot.active.tickMs, 200);
    assert.equal(result.snapshot.active.collisionGraceRemainingMs, null);
    session.tick(199 - lateness);
    assert.deepEqual(session.snapshot().active.snake[0], { x: 11, y: 10 });
    session.tick(1);
    assert.deepEqual(session.snapshot().active.snake[0], { x: 12, y: 10 });
  }
});

test("input after the deadline or beyond tolerance queues for the next move; reversals stay rejected", () => {
  for (const [late, inputAt] of [[35, 1199], [10, 1201]]) {
    const session = game(); session.dispatch({ type: "begin" }); session.tick(200 + late);
    const result = session.dispatch({ type: "direction", direction: "right", inputAt });
    assert.equal(result.events.some((e) => e.type === "movementCorrected"), false);
    assert.deepEqual(result.snapshot.active.snake[0], { x: 10, y: 9 });
    assert.deepEqual(result.snapshot.active.directionQueue, ["right"]);
  }
  const session = game(); session.dispatch({ type: "begin" }); session.tick(210);
  assert.ok(session.dispatch({ type: "direction", direction: "down", inputAt: 1199 }).events.some((e) => e.type === "actionRejected"));
});

test("correction reverses food rewards, growth and respawn and handles a pending collision", () => {
  const session = game();
  const saved = session.serialize(); saved.session.active.foods = [{ x: 10, y: 9, kind: "seed" }];
  const eating = createGameSession({ save: saved, now: 1000, rng: () => 0.5 });
  eating.dispatch({ type: "begin" }); eating.tick(210);
  assert.equal(eating.snapshot().active.score, 1);
  const corrected = eating.dispatch({ type: "direction", direction: "right", inputAt: 1199 }).snapshot;
  assert.equal(corrected.active.score, 0); assert.equal(corrected.seeds, 0);
  assert.equal(corrected.active.snake.length, 3); assert.equal(corrected.active.tickMs, 200);
  assert.deepEqual(corrected.active.foods, [{ x: 10, y: 9, kind: "seed" }]);
  const wall = game({ snake: [{ x: 10, y: 0 }, { x: 10, y: 1 }, { x: 10, y: 2 }] });
  wall.dispatch({ type: "begin" }); wall.tick(210);
  assert.equal(wall.snapshot().active.collisionGraceRemainingMs, snakeConfig.collisionGraceMs - 10);
  const turn = wall.dispatch({ type: "direction", direction: "right", inputAt: 1199 }).snapshot;
  assert.deepEqual(turn.active.snake[0], { x: 11, y: 0 });
  assert.equal(turn.modeAccumulatorMs, 10);
  assert.equal(turn.active.collisionGraceRemainingMs, null);
});

test("a frame between movement and delayed input retains correction history", () => {
  const session = game(); session.dispatch({ type: "begin" }); session.tick(205); session.tick(29);
  const result = session.dispatch({ type: "playDirection", direction: "right", inputAt: 1199 });
  assert.deepEqual(result.snapshot.active.snake[0], { x: 11, y: 10 });
  assert.equal(result.snapshot.modeAccumulatorMs, 34);
});

test("each hatchling costs exactly 1000 Seeds over 15 minutes with blocks at 5 and 10 minutes", () => {
  const nursery = economy.createNursery({}, 0);
  nursery.hatchlings = [{ id: "a", x: 2, y: 4, direction: "right", progressMs: 0 }];
  let seeds = 1000;
  const advance = (dt) => { ({ seeds } = economy.advanceNursery(nursery, seeds, dt, () => 0.5)); };
  advance(899); assert.equal(seeds, 1000);
  advance(1); assert.equal(seeds, 999);
  advance(300000 - 901); assert.equal(economy.hatchlingLength(nursery.hatchlings[0].progressMs), 1);
  advance(1); assert.equal(economy.hatchlingLength(nursery.hatchlings[0].progressMs), 2);
  advance(299999); assert.equal(economy.hatchlingLength(nursery.hatchlings[0].progressMs), 2);
  advance(1); assert.equal(economy.hatchlingLength(nursery.hatchlings[0].progressMs), 3);
  advance(299999); assert.equal(nursery.colonyCount, 0);
  advance(1); assert.equal(nursery.colonyCount, 1); assert.equal(seeds, 0);
  assert.equal(nursery.hatchlings.length, 0);
});

test("feeding stops without Seeds and the saved pause stops live and offline growth without spending Seeds", () => {
  const session = game(); session.dispatch({ type: "addDevelopmentHatchling" });
  const nursery = session.snapshot().nursery;
  assert.equal(nursery.hatchlings.length, 1);
  session.tick(5000); assert.equal(session.snapshot().nursery.hatchlings[0].progressMs, 0);
  session.dispatch({ type: "addSeeds", amount: 1000 }); session.tick(450);
  session.dispatch({ type: "toggleFeeding" });
  const before = session.snapshot(); const saved = session.serialize();
  const paused = createGameSession({ save: saved, now: saved.savedAt + 600000 });
  paused.advanceOffline(saved.savedAt + 600000);
  assert.equal(paused.snapshot().nursery.feedingPaused, true);
  assert.equal(paused.snapshot().seeds, before.seeds);
  assert.equal(paused.snapshot().nursery.hatchlings[0].progressMs, 450);
  paused.dispatch({ type: "toggleFeeding" }); paused.tick(450);
  assert.equal(paused.snapshot().seeds, before.seeds - 1);
  assert.equal(paused.snapshot().nursery.hatchlings[0].progressMs, 900);
  assert.equal(nurseryConfig.growthMs / nurseryConfig.seedIntervalMs, 1000);
});
