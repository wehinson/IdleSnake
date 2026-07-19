const test = require("node:test");
const assert = require("node:assert/strict");
const runner = require("./runner.js");
const fixedRng = () => 0.5;

test("a grounded snake can jump and lands again", () => {
  const state = runner.createState(504, 504);
  assert.equal(runner.jump(state), true);
  runner.step(state, { deltaMs: 100, rng: fixedRng });
  assert.ok(state.player.y < state.groundY - state.player.size);
  for (let i = 0; i < 30; i += 1) runner.step(state, { deltaMs: 50, rng: fixedRng });
  assert.equal(state.player.grounded, true);
  assert.equal(state.player.y, state.groundY - state.player.size);
});

test("body segments follow a delayed visual jump wave", () => {
  const state = runner.createState(504, 504);
  runner.jump(state);
  runner.step(state, { deltaMs: 100, rng: fixedRng });
  assert.ok(runner.segmentYOffset(state, 0) > runner.segmentYOffset(state, 1));
  assert.equal(runner.segmentYOffset(state, 3), 0);
});

test("score rises with distance and speed scales over time", () => {
  const state = runner.createState(504, 504);
  const startSpeed = state.speed;
  for (let i = 0; i < 20; i += 1) runner.step(state, { deltaMs: 50, rng: fixedRng });
  assert.ok(state.score > 0);
  assert.ok(state.speed > startSpeed);
});

test("a colliding obstacle ends the run with score-based reward", () => {
  const state = runner.createState(504, 504);
  state.score = 17; state.distance = state.score * runner.config.scoreDistance; state.nextObstacleAt = Infinity;
  state.obstacles.push({ x: state.player.x, width: state.player.size, height: state.player.size, kind: "rock" });
  const result = runner.step(state, { deltaMs: 1, rng: fixedRng });
  assert.equal(result.alive, false);
  assert.equal(result.events[0].reward, result.events[0].score);
});

test("runs headlessly without a DOM", () => {
  assert.equal(typeof document, "undefined");
  assert.doesNotThrow(() => runner.step(runner.createState(504, 504), { deltaMs: 16, rng: fixedRng }));
});
