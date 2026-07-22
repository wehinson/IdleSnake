const test = require("node:test");
const assert = require("node:assert/strict");
const broodline = require("./broodline.js");

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

function freshState(overrides = {}) {
  return {
    round: 1, wave: 1, pendingSeeds: 0, kills: 0, hatchlingsCollected: 0, eggsHatched: 0,
    armor: 0, maxArmor: 0, hp: 16, maxHp: 16, phase: "combat", selected: 0,
    head: { x: 15, y: 15 }, chain: [], enemies: [], pickups: [], effects: [],
    direction: "right", queue: [], ...overrides
  };
}

test("spawnRound populates a combat wave", () => {
  const s = freshState();
  broodline.spawnRound(s, seededRng(1));
  assert.equal(s.phase, "combat");
  assert.equal(s.wave, 1);
  assert.ok(s.enemies.length >= 4, "at least roundSize enemies");
  assert.ok(s.enemies.every((e) => e.hp > 0));
});

test("uses the authoritative 220 ms cadence for cooldowns, effects, and eggs", () => {
  assert.equal(broodline.TICK_MS, 220);
  const s = freshState({
    chain: [
      { kind: "body", pos: { x: 14, y: 15 } },
      { kind: "garden", pos: { x: 13, y: 15 }, cooldown: 500 },
      { kind: "egg", pos: { x: 12, y: 15 }, hatchAt: 500 }
    ],
    effects: [{ pos: { x: 15, y: 15 }, text: "TEST", ttl: 500 }]
  });
  broodline.step(s, { rng: seededRng(8) });
  assert.equal(s.chain[1].cooldown, 500 - broodline.TICK_MS);
  assert.equal(s.effects[0].ttl, 500 - broodline.TICK_MS);
  assert.equal(s.chain[2].hatchAt, 500 - broodline.TICK_MS);
});

test("clamps or resolves timers that have less than one tick remaining", () => {
  const s = freshState({
    chain: [
      { kind: "body", pos: { x: 14, y: 15 } },
      { kind: "garden", pos: { x: 13, y: 15 }, cooldown: 1 },
      { kind: "egg", pos: { x: 12, y: 15 }, hatchAt: 1 }
    ],
    effects: [{ pos: { x: 15, y: 15 }, text: "EXPIRE", ttl: 1 }]
  });
  broodline.step(s, { rng: () => 0 });
  assert.equal(s.chain[1].cooldown, 0);
  assert.notEqual(s.chain[2].kind, "egg");
  assert.equal(s.effects.some((effect) => effect.text === "EXPIRE"), false);
});

test("moving into the wall ends the run", () => {
  const s = freshState({ head: { x: 1, y: 15 }, direction: "left" });
  const r = broodline.step(s, { rng: seededRng(2) });
  assert.equal(r.alive, false);
  assert.equal(s.phase, "ended");
  assert.equal(r.events.some((e) => e.type === "endRun"), true);
});

test("the head moves and the chain follows", () => {
  const s = freshState({ chain: [{ kind: "body", pos: { x: 14, y: 15 } }] });
  broodline.step(s, { rng: seededRng(3) });
  assert.deepEqual(s.head, { x: 16, y: 15 }, "head moved right");
  assert.deepEqual(s.chain[0].pos, { x: 15, y: 15 }, "segment took the old head cell");
});

test("an adjacent enemy is bitten for damage and dies", () => {
  const s = freshState({ enemies: [{ type: "melee", pos: { x: 16, y: 15 }, hp: 2, maxHp: 7, cooldown: 99, stun: 0, burn: 0, poison: 0, target: null }] });
  const r = broodline.step(s, { rng: seededRng(4) });
  // Head steps onto (16,15)? No — enemy occupies it; bite happens at range<=3.
  assert.equal(s.kills >= 1 || s.enemies.every((e) => e.hp < 2), true, "enemy took fang damage");
  assert.ok(r.alive);
});

test("clearing the final wave triggers a roundClear event", () => {
  const s = freshState({ wave: broodline.WAVES_PER_ROUND, enemies: [] });
  const r = broodline.step(s, { rng: seededRng(5) });
  assert.equal(s.phase, "formation");
  assert.equal(r.events.some((e) => e.type === "roundClear"), true);
  assert.ok(s.pendingSeeds >= 10 + s.round);
});

test("clearing a non-final wave advances to the next wave", () => {
  const s = freshState({ wave: 1, enemies: [] });
  const r = broodline.step(s, { rng: seededRng(6) });
  assert.equal(s.wave, 2);
  assert.equal(r.events.some((e) => e.type === "wave"), true);
  assert.ok(s.enemies.length > 0, "next wave spawned");
});

test("runs headless with no DOM", () => {
  assert.equal(typeof document, "undefined");
  const s = freshState();
  broodline.spawnRound(s, seededRng(7));
  assert.doesNotThrow(() => { for (let i = 0; i < 20; i++) broodline.step(s, { rng: seededRng(7) }); });
});
