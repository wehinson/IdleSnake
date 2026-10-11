const test = require("node:test");
const assert = require("node:assert/strict");
const broodline = require("./broodline.js");
const { createGameSession } = require("./session.js");
function advance(game, ms) { while (ms > 0) { const dt = Math.min(ms, 100); game.tick(dt); ms -= dt; } }
function formation(game) {
  game.dispatch({ type: "selectMode", mode: "broodline" }); game.dispatch({ type: "begin" });
  const original = broodline.step;
  broodline.step = (state) => {
    state.phase = "formation"; state.head = { x: 15, y: 15 };
    state.chain = [
      { kind: "body", pos: { x: 14, y: 15 } },
      { kind: "garden", pos: { x: 13, y: 15 }, cooldown: 500 },
      { kind: "cave", pos: { x: 12, y: 15 } }
    ];
    state.hp = 3; state.maxArmor = 2; state.pendingSeeds = 27;
    return { state, alive: true, events: [{ type: "roundClear" }] };
  };
  try { advance(game, 220); } finally { broodline.step = original; }
}
test("Broodline forward input starts Ready without a queued duplicate; reversal, queue bound, pause and restart stay intact", () => {
  const game = createGameSession({ now: 0, rng: () => .7 });
  game.dispatch({ type: "selectMode", mode: "broodline" });
  const rejected = game.dispatch({ type: "direction", direction: "left" });
  assert.equal(rejected.snapshot.phase, "ready"); assert.ok(rejected.events.some((e) => e.type === "actionRejected"));
  const started = game.dispatch({ type: "direction", direction: "right" });
  assert.equal(started.snapshot.phase, "running"); assert.deepEqual(started.snapshot.active.queue, []);
  assert.ok(started.events.some((e) => e.type === "runStarted"));
  game.dispatch({ type: "direction", direction: "up" }); game.dispatch({ type: "direction", direction: "left" });
  assert.ok(game.dispatch({ type: "direction", direction: "down" }).events.some((e) => e.type === "actionRejected"));
  assert.deepEqual(game.snapshot().active.queue, ["up", "left"]);
  game.dispatch({ type: "pause" }); const paused = game.snapshot().active; advance(game, 600);
  assert.deepEqual(game.snapshot().active, paused);
  game.dispatch({ type: "resume" }); game.dispatch({ type: "restart" });
  assert.equal(game.snapshot().phase, "ready"); assert.deepEqual(game.snapshot().active.queue, []);
  assert.equal(game.dispatch({ type: "direction", direction: "right" }).snapshot.phase, "running");
});
test("formation reorders companion identities and timers while retaining geometry through subsequent real combat ticks", () => {
  const game = createGameSession({ now: 0, rng: () => .7 }); formation(game);
  const before = game.snapshot().active;
  game.dispatch({ type: "broodlineSelect", index: 2 });
  const moved = game.dispatch({ type: "broodlineMove", direction: "up" });
  assert.deepEqual(moved.snapshot.active.chain.map((part) => part.pos), before.chain.map((part) => part.pos));
  assert.deepEqual(moved.snapshot.active.chain.map((part) => part.kind), ["body", "cave", "garden"]);
  assert.equal(moved.snapshot.active.chain[2].cooldown, 500);
  const continued = game.dispatch({ type: "broodlineContinue" });
  assert.equal(continued.snapshot.active.hp, 16); assert.equal(continued.snapshot.active.armor, 2);
  assert.equal(continued.snapshot.active.pendingSeeds, 27);
  assert.equal(game.dispatch({ type: "direction", direction: "right" }).snapshot.phase, "running");
  for (let tick = 0; tick < 3; tick++) {
    advance(game, 220); const active = game.snapshot().active;
    const positions = [active.head, ...active.chain.map((part) => part.pos)];
    for (let i = 1; i < positions.length; i++) assert.equal(broodline.manhattan(positions[i - 1], positions[i]), 1);
    assert.deepEqual(active.chain.map((part) => part.kind), ["body", "cave", "garden"]);
  }
});
test("Centipede pause freezes independent clocks and life-loss Ready resumes the tuned movement without paying a run twice", () => {
  const game = createGameSession({ now: 0, rng: () => .7 });
  game.dispatch({ type: "selectMode", mode: "centipede", setup: { cols: 1, rows: 2, playerRows: 2, startLength: 1, lives: 2 } });
  game.dispatch({ type: "begin" }); game.dispatch({ type: "pause" });
  const paused = game.snapshot().active; advance(game, 700); assert.deepEqual(game.snapshot().active, paused);
  game.dispatch({ type: "resume" });
  const firstHit = game.tick(70);
  assert.equal(firstHit.snapshot.phase, "ready"); assert.equal(firstHit.snapshot.active.lives, 1);
  assert.ok(!firstHit.events.some((e) => e.type === "runEnded"));
  game.dispatch({ type: "begin" });
  let ended; for (let i = 0; i < 6 && game.snapshot().phase !== "gameover"; i++) ended = game.tick(70);
  assert.equal(ended.snapshot.phase, "gameover"); assert.equal(ended.events.filter((e) => e.type === "runEnded").length, 1);
  const seeds = game.snapshot().seeds;
  assert.ok(!game.tick(100).events.some((e) => e.type === "runEnded")); assert.equal(game.snapshot().seeds, seeds);
});
