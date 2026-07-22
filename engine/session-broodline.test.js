const test = require("node:test");
const assert = require("node:assert/strict");
const broodline = require("./broodline.js");
const { createGameSession } = require("./session.js");

function lcg(seed) {
  let value = seed >>> 0 || 1;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x100000000; };
}

function enterFormation(game, pendingSeeds = 27) {
  game.dispatch({ type: "selectMode", mode: "broodline" });
  game.dispatch({ type: "begin" });
  const originalStep = broodline.step;
  broodline.step = (state) => {
    state.phase = "formation";
    state.chain = [
      { kind: "body", pos: { x: 14, y: 15 } },
      { kind: "garden", pos: { x: 13, y: 15 }, cooldown: 0 },
      { kind: "cave", pos: { x: 12, y: 15 }, cooldown: 0 }
    ];
    state.selected = 0; state.pendingSeeds = pendingSeeds;
    state.hp = 3; state.maxHp = 20; state.armor = 0; state.maxArmor = 4;
    return { state, alive: true, events: [{ type: "roundClear" }] };
  };
  try { game.tick(100); game.tick(100); game.tick(broodline.TICK_MS - 200); } finally { broodline.step = originalStep; }
  assert.equal(game.snapshot().active.phase, "formation");
}

test("Broodline formation commands validate, reorder canonically, and preserve pause/restart lifecycle", () => {
  const snake = createGameSession({ now: 0 });
  assert.ok(snake.dispatch({ type: "broodlineSelect", index: 0 }).events.some((item) => item.reason === "invalidMode"));

  const game = createGameSession({ now: 0, rng: lcg(12) });
  game.dispatch({ type: "selectMode", mode: "broodline" });
  assert.ok(game.dispatch({ type: "broodlineSelect", index: 0 }).events.some((item) => item.reason === "notInFormation"));
  enterFormation(game);

  for (const index of [-1, 1.5, 3]) {
    assert.ok(game.dispatch({ type: "broodlineSelect", index }).events.some((item) => item.reason === "invalidIndex"));
  }
  const selected = game.dispatch({ type: "broodlineSelect", index: 2 });
  assert.deepEqual(selected.events, [{ type: "broodlineFormationSelected", index: 2 }]);
  assert.equal(Object.isFrozen(selected), true);
  assert.equal(Object.isFrozen(selected.snapshot.active), true);
  assert.equal(Object.isFrozen(selected.events), true);
  assert.equal(Object.isFrozen(selected.events[0]), true);

  const moved = game.dispatch({ type: "broodlineMove", direction: "up" });
  assert.deepEqual(moved.events, [{ type: "broodlineFormationMoved", direction: "up", from: 2, to: 1 }]);
  assert.deepEqual(moved.snapshot.active.chain.map((part) => part.kind), ["body", "cave", "garden"]);
  assert.equal(moved.snapshot.active.selected, 1);
  assert.deepEqual(selected.snapshot.active.chain.map((part) => part.kind), ["body", "garden", "cave"], "earlier snapshots remain isolated");
  assert.ok(game.dispatch({ type: "broodlineMove", direction: "left" }).events.some((item) => item.reason === "invalidDirection"));
  game.dispatch({ type: "broodlineSelect", index: 0 });
  assert.ok(game.dispatch({ type: "broodlineMove", direction: "up" }).events.some((item) => item.reason === "invalidIndex"));

  game.dispatch({ type: "pause" });
  for (const action of [
    { type: "broodlineSelect", index: 1 }, { type: "broodlineMove", direction: "down" },
    { type: "broodlineContinue" }, { type: "broodlineEnd" }
  ]) assert.ok(game.dispatch(action).events.some((item) => item.reason === "notRunning"), action.type);
  game.dispatch({ type: "resume" });

  const continued = game.dispatch({ type: "broodlineContinue" });
  assert.equal(continued.snapshot.phase, "ready");
  assert.equal(continued.snapshot.active.phase, "combat");
  assert.equal(continued.snapshot.active.round, 2);
  assert.equal(continued.snapshot.active.wave, 1);
  assert.equal(continued.snapshot.active.hp, 20);
  assert.equal(continued.snapshot.active.armor, 4);
  assert.deepEqual(continued.events, [
    { type: "broodlineRoundContinued", round: 2 },
    { type: "runReady", mode: "broodline", round: 2 }
  ]);
  const restarted = game.dispatch({ type: "restart" });
  assert.equal(restarted.snapshot.phase, "ready");
  assert.equal(restarted.snapshot.active.round, 1);
  assert.equal(restarted.snapshot.active.pendingSeeds, 0);
  assert.equal(restarted.snapshot.active.rewardCollected, false);
});

test("Broodline explicit end collects the canonical pending reward exactly once", () => {
  const game = createGameSession({ now: 0, rng: lcg(44), save: { seeds: 5 } });
  enterFormation(game, 27);
  const ended = game.dispatch({ type: "broodlineEnd" });
  assert.equal(ended.snapshot.phase, "gameover");
  assert.equal(ended.snapshot.active.phase, "ended");
  assert.equal(ended.snapshot.active.rewardCollected, true);
  assert.equal(ended.snapshot.seeds, 32);
  assert.deepEqual(ended.events, [{ type: "runEnded", mode: "broodline", reason: "Run ended", reward: 27 }]);

  const repeated = game.dispatch({ type: "broodlineEnd" });
  assert.ok(repeated.events.some((item) => item.type === "actionRejected"));
  assert.equal(repeated.snapshot.seeds, 32);
  const restarted = game.dispatch({ type: "restart" });
  assert.equal(restarted.snapshot.seeds, 32);
  assert.equal(restarted.snapshot.active.pendingSeeds, 0);
});
