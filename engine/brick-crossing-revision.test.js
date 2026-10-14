const test = require("node:test");
const assert = require("node:assert/strict");
const breakout = require("./breakout.js");
const crossing = require("./crossing.js");
const { createGameSession } = require("./session.js");
const sliceMs = 1000 / 240;
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
function step(state, dt, elapsedMs, rng = () => 0.99) {
  return breakout.step(state, { deltaMs: dt, elapsedMs, boardWidth: 720, boardHeight: 720, rng });
}
const magnitude = (ball) => Math.hypot(ball.vx, ball.vy);

test("ball scalar rises linearly through 0/45/90/135 seconds and caps at 3x at 180 seconds", () => {
  for (const [time, scale] of [[0, 1], [45000, 1.5], [90000, 2], [135000, 2.5], [180000, 3], [270000, 3]]) {
    assert.equal(breakout.ballSpeedMultiplier(time), scale);
    const state = breakout.createState();
    const initial = magnitude(state.balls[0]);
    step(state, sliceMs, time);
    near(magnitude(state.balls[0]), initial * scale);
    assert.equal(state.balls[0].speedScale, scale);
  }
  assert.equal(breakout.ballSpeedMultiplier(-1000), 1);
});

test("initial serves, life respawns and multiball share the current run-time scalar", () => {
  const state = breakout.createState();
  const initial = magnitude(state.balls[0]);
  for (const time of [0, 45000, 90000, 180000, 270000]) {
    state.ballElapsedMs = time;
    for (const index of [0, 1, 2]) near(magnitude(breakout.buildBall(state, 720, index)), initial * breakout.ballSpeedMultiplier(time));
  }
  state.balls = [{ x: 20, y: 740, radius: 10, vx: 0, vy: 270.9 }];
  const loss = step(state, 16, 45016);
  assert.ok(loss.events.some(event => event.type === "ballLost"));
  near(magnitude(state.balls[0]), initial * breakout.ballSpeedMultiplier(state.ballElapsedMs));
  const multiball = breakout.createState();
  multiball.powerups = [breakout.createPowerup(multiball, "multiball", multiball.paddle.x + 40, multiball.paddle.y)];
  step(multiball, 16, 90016);
  assert.equal(multiball.balls.length, 2);
  for (const ball of multiball.balls) near(magnitude(ball), initial * breakout.ballSpeedMultiplier(multiball.ballElapsedMs));
});

test("accelerating motion is deterministic across long and 30/60/144 Hz frame partitions", () => {
  const simulate = frames => {
    const state = breakout.createState();
    state.ballElapsedMs = 90000;
    state.balls = [breakout.buildBall(state, 720)];
    let elapsed = 90000;
    for (const dt of frames) step(state, dt, elapsed += dt);
    return state.balls[0];
  };
  const total = 125;
  const expected = simulate([total]);
  for (const hz of [30, 60, 144]) {
    const frames = Array(Math.floor(total / (1000 / hz))).fill(1000 / hz);
    frames.push(total - frames.reduce((sum, dt) => sum + dt, 0));
    const actual = simulate(frames);
    for (const field of ["x", "y", "vx", "vy", "speedScale"]) near(actual[field], expected[field]);
  }
});

test("Ready and pause do not advance ball acceleration or the elapsed game clock", () => {
  const game = createGameSession({ now: 0, rng: () => 0.9 });
  game.dispatch({ type: "selectMode", mode: "breakout" });
  const initial = game.snapshot().active.balls;
  const ready = game.tick(100);
  assert.equal(ready.snapshot.elapsedMs, 0);
  assert.deepEqual(ready.snapshot.active.balls, initial);
  game.dispatch({ type: "begin" }); game.tick(20);
  game.dispatch({ type: "pause" });
  const frozen = game.snapshot();
  const paused = game.tick(100).snapshot;
  assert.equal(paused.elapsedMs, frozen.elapsedMs);
  assert.deepEqual(paused.active.balls, frozen.active.balls);
  assert.equal(paused.active.ballElapsedMs, frozen.active.ballElapsedMs);
});

test("cap-speed thin-brick and paddle impacts reflect without tunneling or repeated damage", () => {
  const state = breakout.createState({ bricks: [{ x: 100, y: 100, width: 80, height: 1, hp: 3, color: breakout.BRICK_COLORS[3] }] });
  state.ballElapsedMs = 180000;
  const ball = breakout.buildBall(state, 720);
  const capSpeed = magnitude(ball);
  Object.assign(ball, { x: 140, y: 140, radius: 5, vx: 0, vy: -capSpeed });
  state.balls = [ball];
  const hit = step(state, 100, 180100);
  assert.equal(hit.events.filter(event => event.type === "brickHit").length, 1);
  assert.equal(state.bricks[0].hp, 2);
  assert.equal(state.bricks[0].color, breakout.BRICK_COLORS[3]);
  assert.ok(state.balls[0].vy > 0);
  Object.assign(state.balls[0], { x: state.paddle.x + 70, y: state.paddle.y - 40, vx: 0, vy: capSpeed });
  step(state, 100, 180200);
  assert.equal(state.lives, 2);
  assert.ok(state.balls[0].vy < 0);
  near(magnitude(state.balls[0]), capSpeed);
});

test("acceleration preserves controlledMove before early terminal events and returns unused frame time", () => {
  for (const controlled of [true, false]) {
    const state = breakout.createState({ bricks: [{ x: 0, y: 0, width: 720, height: 710, hp: 1 }] });
    state.paddle.input = controlled ? 1 : 0;
    const result = step(state, 100, 90100);
    assert.equal(result.events.some(event => event.type === "controlledMove"), controlled);
    assert.equal(result.events.at(-1).type, "win");
    assert.ok(result.unconsumedMs > 90);
    assert.ok(state.ballElapsedMs < 90010);
  }
});

test("multiball thresholds use the same 18 percent brick-drop denominator and reduce only seed probability", () => {
  assert.equal(breakout.config.powerupDropChance, 0.18);
  const count = hearts => {
    const result = { seed: 0, heart: 0, multiball: 0 };
    for (let index = 0; index < 100; index++) result[breakout.randomPowerupType(hearts, () => (index + 0.5) / 100)]++;
    return result;
  };
  assert.deepEqual(count(true), { seed: 50, heart: 10, multiball: 40 });
  assert.deepEqual(count(false), { seed: 50, heart: 0, multiball: 50 });
  assert.equal(breakout.randomPowerupType(true, () => 0.499999), "seed");
  assert.equal(breakout.randomPowerupType(true, () => 0.5), "heart");
  assert.equal(breakout.randomPowerupType(true, () => 0.6), "multiball");
});

test("every lane visibly mixes colors with minimal early density and exact independent speed ratios", () => {
  for (const stage of [1, 3, 5, 20]) {
    const cars = crossing.buildCars(stage, { columns: 15, rows: 13 });
    const globalCounts = { green: 0, blue: 0, black: 0 };
    for (let row = 1; row < 12; row++) {
      const lane = cars.filter(car => car.row === row);
      const counts = { green: 0, blue: 0, black: 0 };
      for (const car of lane) {
        counts[car.tier]++;
        globalCounts[car.tier]++;
        assert.equal(car.color, crossing.LOG_TIERS[car.tier].color);
        const greenSpeed = (0.11 + (row % 3) * 0.018) * (1 + Math.min(1.25, (stage - 1) * 0.14));
        near(Math.abs(car.speed), greenSpeed * crossing.LOG_TIERS[car.tier].speed);
        assert.equal(Math.sign(car.speed), row % 2 === 0 ? -1 : 1);
      }
      assert.ok(counts.green > 0 && counts.blue + counts.black > 0);
      assert.ok(new Set(lane.map(car => car.color)).size >= 2);
      assert.equal(lane.length, stage >= 5 ? 3 : 2);
    }
    assert.ok(globalCounts.green > globalCounts.blue && globalCounts.green > globalCounts.black);
  }
});

test("mixed-lane overtaking does not alter velocity and lethal wrapped body collisions remain valid", () => {
  const lane = crossing.buildCars(5, { columns: 15, rows: 13 }).filter(car => car.row === 3);
  const green = lane.find(car => car.tier === "green");
  const black = lane.find(car => car.tier === "black");
  green.row = 1; black.row = 1;
  green.speed = Math.abs(green.speed); black.speed = Math.abs(black.speed);
  green.x = 4; black.x = 3.9;
  const state = { grid: { columns: 15, rows: 13 }, snake: [{ x: 7, y: 12 }], cars: [green, black] };
  const velocities = state.cars.map(car => car.speed);
  for (let count = 0; count < 12; count++) crossing.updateCars(state);
  assert.ok(black.x > green.x);
  assert.deepEqual(state.cars.map(car => car.speed), velocities);
  state.snake = [{ x: 7, y: 12 }, { x: 0, y: 1 }];
  green.x = 14.8;
  assert.equal(crossing.isCarHit(state), true, "wrapped log hits body even when head is safe");
  green.x = -0.8;
  assert.equal(crossing.isCarHit(state), true);
});
