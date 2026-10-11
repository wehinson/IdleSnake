const test = require("node:test");
const assert = require("node:assert/strict");
const breakout = require("./breakout.js");
const crossing = require("./crossing.js");
const { createGameSession } = require("./session.js");

function tick(state, deltaMs, elapsedMs = deltaMs, rng = () => 0.99) {
  return breakout.step(state, { deltaMs, elapsedMs, boardWidth: 720, boardHeight: 720, rng });
}

test("Breakout has four equal-size rows near the top with black3 blue2 green1 green1 health", () => {
  const state = breakout.createState();
  assert.equal(state.bricks.length, 40);
  const rows = [...new Set(state.bricks.map((brick) => brick.y))];
  assert.deepEqual(rows, [28, 64, 100, 136]);
  rows.forEach((y, row) => {
    const bricks = state.bricks.filter((brick) => brick.y === y);
    assert.equal(bricks.length, 10);
    bricks.forEach((brick) => {
      assert.equal(brick.height, 32);
      assert.equal(brick.width, 65.6);
      assert.equal(brick.hp, [3, 2, 1, 1][row]);
      assert.equal(brick.maxHp, brick.hp);
      assert.equal(brick.color, breakout.BRICK_COLORS[brick.hp]);
    });
    assert.equal(bricks[0].x, 14);
    assert.equal(bricks.at(-1).x + bricks.at(-1).width, 706);
  });
});

test("Breakout damage separates each contact, fractures persist, and only destruction scores or drops", () => {
  const state = breakout.createState({ bricks: [{ x: 100, y: 100, width: 80, height: 32, hp: 3, maxHp: 3 }] });
  for (let hit = 1; hit <= 3; hit += 1) {
    state.balls = [{ x: 140, y: 145, radius: 10, vx: 0, vy: -270.9 }];
    const result = tick(state, 16, hit * 16, () => 0);
    assert.equal(result.events.filter((event) => event.type === "brickHit").length, 1);
    if (hit < 3) {
      assert.equal(state.bricks[0].hp, 3 - hit);
      assert.equal(state.bricks[0].maxHp, 3);
      assert.equal(state.bricks[0].color, breakout.BRICK_COLORS[3 - hit]);
      assert.equal(state.score, 0);
      assert.equal(state.powerups.length, 0);
      assert.ok(state.balls[0].vy > 0);
      assert.ok(state.balls[0].y > 142);
    } else {
      assert.equal(state.bricks.length, 0);
      assert.equal(state.score, 10);
      assert.equal(state.powerups.length, 1);
      assert.equal(result.events.at(-1).type, "win");
    }
  }
});

test("Breakout tail warns only at extended tail end, faster at two seconds, steady reduced motion, clears on expiry/reset", () => {
  const state = breakout.createState();
  state.paddle.length = 5; state.seedBoosts = [30000, 35000];
  assert.equal(breakout.tailWarning(state, 24999), null);
  assert.equal(breakout.tailWarning(state, 25000).phase, "warning");
  assert.equal(breakout.tailWarning(state, 27999).phase, "warning");
  assert.equal(breakout.tailWarning(state, 28000).phase, "urgent");
  assert.equal(breakout.tailWarning(state, 28000).index, 0);
  assert.ok(breakout.tailWarning(state, 28000).periodMs < breakout.tailWarning(state, 25000).periodMs);
  assert.notEqual(breakout.tailWarning(state, 28200).dim, breakout.tailWarning(state, 28400).dim);
  assert.equal(breakout.tailWarning(state, 28200, true).dim, true);
  assert.equal(breakout.tailWarning(state, 28400, true).dim, true);
  tick(state, 16, 30016);
  assert.equal(state.paddle.length, 4);
  assert.deepEqual(state.seedBoosts, [35000]);
  tick(state, 16, 35016);
  assert.equal(state.paddle.length, 3);
  assert.equal(breakout.tailWarning(state, 35016), null);
  assert.equal(breakout.tailWarning(breakout.createState(), 28000), null);
});

test("Breakout scales paddle, every served ball and falling pickups by 1.5 and preserves equal-time frame partitions", () => {
  assert.equal(breakout.config.paddleSpeed, 231 * 1.5);
  assert.equal(breakout.config.ballSpeed, 180.6 * 1.5);
  assert.equal(breakout.config.powerupFallSpeed, 64.4 * 1.5);
  const run = (frames) => {
    const state = breakout.createState();
    state.paddle.input = 1;
    state.balls = [{ x: 360, y: 450, radius: 10, vx: 112 * 1.5, vy: -140 * 1.5 }];
    state.powerups = [breakout.createPowerup(state, "seed", 30, 300)];
    let elapsed = 0;
    for (const delta of frames) tick(state, delta, elapsed += delta);
    return state;
  };
  const expected = run([100]);
  for (const frames of [Array(6).fill(100 / 6), Array(3).fill(100 / 3), Array(15).fill(100 / 15)]) {
    const actual = run(frames);
    assert.ok(Math.abs(actual.paddle.x - expected.paddle.x) < 1e-8);
    assert.ok(Math.abs(actual.balls[0].x - expected.balls[0].x) < 1e-8);
    assert.ok(Math.abs(actual.balls[0].y - expected.balls[0].y) < 1e-8);
    assert.ok(Math.abs(actual.powerups[0].y - expected.powerups[0].y) < 1e-8);
  }
  assert.ok(Math.abs(expected.paddle.x - ((720 - 143) / 2 + 34.65)) < 1e-8);
  assert.ok(Math.abs(expected.powerups[0].y - 309.66) < 1e-8);
  for (const index of [0, 1, 2]) {
    const ball = breakout.buildBall(expected, 720, index);
    assert.equal(Math.abs(ball.vx), 180.6 * 0.62 * 1.5);
    assert.equal(ball.vy, -180.6 * 0.78 * 1.5);
  }
});

test("fast balls cannot tunnel through thin bricks or paddle, including long frames", () => {
  const state = breakout.createState({ bricks: [{ x: 100, y: 100, width: 80, height: 16, hp: 2 }] });
  state.balls = [{ x: 140, y: 180, radius: 5, vx: 0, vy: -5000 }];
  tick(state, 40);
  assert.equal(state.bricks[0].hp, 1);
  assert.ok(state.balls[0].vy > 0);
  state.balls = [{ x: state.paddle.x + 70, y: 600, radius: 5, vx: 0, vy: 5000 }];
  tick(state, 40, 80);
  assert.ok(state.balls[0].vy < 0);
  assert.equal(state.lives, 2);
});

test("paddle collision geometry uses growth and expiry in the same physics slice", () => {
  const state = breakout.createState({ bricks: [{ x: 100, y: 100, width: 80, height: 16 }] });
  state.powerups = [breakout.createPowerup(state, "seed", state.paddle.x + 30, state.paddle.y)];
  // Growth keeps the center but adds a half-segment at each end.
  state.balls = [{ x: state.paddle.x - 15, y: state.paddle.y - 11, radius: 10, vx: 0, vy: 270.9 }];
  tick(state, 16);
  assert.equal(state.paddle.length, 4);
  assert.ok(state.balls[0].vy < 0, "newly grown edge catches the ball immediately");
  state.seedBoosts = [100];
  const oldRight = state.paddle.x + breakout.paddleWidth(state);
  state.balls = [{ x: oldRight - 10, y: state.paddle.y - 11, radius: 5, vx: 0, vy: 270.9 }];
  tick(state, 40, 140);
  assert.equal(state.paddle.length, 3);
  assert.ok(state.balls[0].vy > 0, "expired edge no longer catches the ball");
});

test("session Breakout retains long-frame time and is independent of classic speed presets", () => {
  const run = (frames, speed) => {
    const game = createGameSession({ now: 0, rng: () => 0.9 });
    const changed = game.dispatch({ type: "setSnakeSpeed", snakeSpeed: speed });
    assert.equal(changed.events.some((event) => event.type === "actionRejected"), false);
    assert.equal(changed.snapshot.snakeSpeed, speed);
    game.dispatch({ type: "selectMode", mode: "breakout" });
    game.dispatch({ type: "begin" });
    for (const frame of frames) game.tick(frame);
    return game.snapshot();
  };
  const expected = run([200], "snake");
  const actual = run([100, 100], "snake");
  assert.equal(expected.elapsedMs, 200);
  assert.deepEqual(expected.active.balls, actual.active.balls);
  for (const speed of ["turtle", "rabbit"]) assert.deepEqual(run([200], speed).active.balls, expected.active.balls);
});

test("Breakout long frames stop the run clock at ball loss and keep growth time for the next serve", () => {
  const runSession = (delta) => {
    const game = createGameSession({ now: 0, rng: () => 0.99 });
    game.dispatch({ type: "selectMode", mode: "breakout", setup: { bricks: [{ x: 0, y: 5, width: 1, height: 1 }] } });
    game.dispatch({ type: "begin" });
    for (let count = 0; count < 600; count++) {
      const result = game.tick(delta);
      if (result.snapshot.phase !== "running") return result.snapshot;
    }
    assert.fail("fixture did not lose a ball");
  };
  const single = runSession(60000);
  const partitioned = runSession(100);
  assert.equal(single.phase, "ready");
  assert.ok(Math.abs(single.elapsedMs - partitioned.elapsedMs) < 1e-6);
  assert.ok(single.elapsedMs < 30000);
  assert.deepEqual(single.active.balls, partitioned.active.balls);
  const runGrowth = (delta) => {
    const state = breakout.createState({ bricks: [{ x: 0, y: 5, width: 1, height: 1 }] });
    state.paddle.length = 4; state.seedBoosts = [30000];
    state.balls = [{ x: 20, y: 650, radius: 10, vx: 0, vy: 270.9 }];
    let elapsed = 0;
    for (let count = 0; count < 600; count++) {
      const result = tick(state, delta, elapsed += delta);
      elapsed -= result.unconsumedMs || 0;
      if (result.events.some((event) => event.type === "ballLost")) {
        tick(state, 16, elapsed + 16);
        return { state, elapsed };
      }
    }
    assert.fail("growth fixture did not lose a ball");
  };
  const grownSingle = runGrowth(60000);
  const grownPartitioned = runGrowth(100);
  assert.equal(grownSingle.state.paddle.length, 4);
  assert.deepEqual(grownSingle.state.seedBoosts, [30000]);
  assert.deepEqual(grownSingle.state.seedBoosts, grownPartitioned.state.seedBoosts);
  assert.ok(Math.abs(grownSingle.elapsed - grownPartitioned.elapsed) < 1e-6);
});

test("caught pickups grow or add a correctly scaled ball and restore collision width on expiry", () => {
  const state = breakout.createState();
  const x = state.paddle.x + 40;
  state.powerups = [breakout.createPowerup(state, "seed", x, state.paddle.y - 1), breakout.createPowerup(state, "multiball", x, state.paddle.y - 1)];
  tick(state, 16);
  assert.equal(state.paddle.length, 4);
  assert.equal(state.balls.length, 2);
  assert.equal(state.powerups.length, 0);
  assert.ok(state.seedBoosts[0] > 30000);
  assert.equal(Math.abs(state.balls[1].vx), breakout.config.ballSpeed * 0.62);
  const pickup = breakout.createPowerup(state, "multiball", 0, 0);
  assert.ok(pickup.radius < breakout.buildBall(state, 720).radius);
});

test("Snakeger green is most common and each tier has its independent lane speed ratio", () => {
  for (const stage of [1, 3, 5, 10]) {
    const cars = crossing.buildCars(stage, { columns: 15, rows: 13 });
    const counts = { green: 0, blue: 0, black: 0 };
    for (const car of cars) {
      counts[car.tier]++;
      const green = (0.11 + (car.row % 3) * 0.018) * (1 + Math.min(1.25, (stage - 1) * 0.14));
      assert.ok(Math.abs(Math.abs(car.speed) / green - crossing.LOG_TIERS[car.tier].speed) < 1e-10);
      assert.equal(car.color, crossing.LOG_TIERS[car.tier].color);
    }
    assert.ok(counts.green > counts.blue && counts.green > counts.black);
  }
});

test("Snakeger faster logs overtake through overlap without snapping and wrapped collisions remain lethal", () => {
  const cars = [{ row: 1, x: 4, width: 2, speed: 0.1 }, { row: 1, x: 3.9, width: 2, speed: 0.15625 }];
  const state = { grid: { columns: 15, rows: 13 }, cars, snake: [{ x: 7, y: 12 }] };
  for (let index = 0; index < 10; index++) crossing.updateCars(state);
  assert.ok(cars[1].x > cars[0].x);
  assert.deepEqual(cars.map((car) => car.speed), [0.1, 0.15625]);
  assert.ok(Math.abs(cars[0].x - 5) < 1e-10);
  assert.ok(Math.abs(cars[1].x - 5.4625) < 1e-10);
  state.cars = [{ row: 1, x: 14.7, width: 2, speed: 0.1 }];
  state.snake = [{ x: 0, y: 1 }];
  assert.equal(crossing.isCarHit(state), true);
  state.cars = [{ row: 1, x: -1.7, width: 2, speed: -0.1 }];
  assert.equal(crossing.isCarHit(state), true);
});

test("crossing stage win flushes queued input, locks Start, then requires explicit start without idle rewards", () => {
  const game = createGameSession({ now: 0, rng: () => 0.9 });
  game.dispatch({ type: "selectMode", mode: "crossing", setup: { grid: { columns: 10, rows: 2 }, entryColumn: 0, tickMs: 1 } });
  game.dispatch({ type: "direction", direction: "up" });
  game.dispatch({ type: "direction", direction: "right" });
  const clear = game.tick(1);
  assert.equal(clear.snapshot.active.subphase, "clearing");
  assert.deepEqual(clear.snapshot.active.directionQueue, []);
  assert.ok(game.dispatch({ type: "primaryAction" }).events.some((event) => event.type === "actionRejected"));
  assert.ok(game.dispatch({ type: "direction", direction: "up" }).events.some((event) => event.reason === "stageTransition"));
  assert.equal(game.tick(999).snapshot.active.stage, 1);
  const ready = game.tick(1).snapshot;
  assert.equal(ready.phase, "ready");
  assert.equal(ready.active.stage, 2);
  assert.equal(ready.active.snakeLength, 4);
  assert.ok(game.dispatch({ type: "playDirection", direction: "up" }).events.some((event) => event.reason === "explicitStartRequired"));
  const idle = game.tick(1000);
  assert.equal(idle.snapshot.phase, "ready");
  assert.equal(idle.snapshot.active.score, 100);
  assert.equal(idle.events.some((event) => event.type === "reward"), false);
  assert.equal(game.dispatch({ type: "primaryAction" }).snapshot.phase, "running");
  assert.deepEqual(game.snapshot().active.directionQueue, []);
});

test("crossing death flushes input and directional repeats cannot start the replacement run", () => {
  const game = createGameSession({ now: 0, rng: () => 0.9 });
  game.dispatch({ type: "selectMode", mode: "crossing", setup: { grid: { columns: 1, rows: 3 }, entryColumn: 0, tickMs: 1 } });
  game.dispatch({ type: "direction", direction: "up" });
  game.dispatch({ type: "direction", direction: "right" });
  const death = game.tick(1).snapshot;
  assert.equal(death.phase, "gameover");
  assert.deepEqual(death.active.directionQueue, []);
  assert.equal(game.dispatch({ type: "playDirection", direction: "up" }).snapshot.phase, "ready");
  const repeated = game.dispatch({ type: "playDirection", direction: "up" });
  assert.equal(repeated.snapshot.phase, "ready");
  assert.ok(repeated.events.some((event) => event.reason === "explicitStartRequired"));
  assert.equal(game.tick(1000).snapshot.phase, "ready");
  assert.equal(game.dispatch({ type: "primaryAction" }).snapshot.phase, "running");
});
