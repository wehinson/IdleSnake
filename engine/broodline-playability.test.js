const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("./broodline.js");
function state(overrides = {}) {
  return { round: 1, wave: 1, pendingSeeds: 0, kills: 0, hatchlingsCollected: 0, eggsHatched: 0,
    armor: 0, maxArmor: 0, hp: 16, maxHp: 16, phase: "combat", selected: 0,
    head: { x: 15, y: 15 }, chain: [], enemies: [], pickups: [], effects: [], direction: "right", queue: [], ...overrides };
}
function enemy(pos) { return { type: "ranged", pos, hp: 100, maxHp: 100, cooldown: 99, stun: 0, burn: 0, poison: 0 }; }

test("every attacking companion works in the first and later chain slots with its range and cooldown", () => {
  for (const kind of ["garden", "electric", "lava", "rattle"]) for (const index of [0, 1]) {
    const chain = index ? [{ kind: "body", pos: { x: 14, y: 15 } }] : [];
    chain.push({ kind, pos: { x: 14 - index, y: 15 }, cooldown: 0 });
    const e = enemy({ x: 15 - index, y: 17 });
    const s = state({ chain, enemies: [e] });
    B.step(s, { rng: () => .99 });
    assert.ok(s.effects.some((effect) => effect.text === { garden: "GARDEN", electric: "STUN", lava: "BURN", rattle: "POISON" }[kind]), `${kind} slot ${index}`);
    assert.equal(chain[index].cooldown, kind === "garden" ? 500 : 900);
    if (kind === "electric") assert.equal(e.stun, 2);
    if (kind === "lava") assert.equal(e.burn, 2);
    if (kind === "rattle") assert.equal(e.poison, 4);
    B.step(s, { rng: () => .99 });
    assert.equal(chain[index].cooldown, (kind === "garden" ? 500 : 900) - B.TICK_MS);
  }
  const e = enemy({ x: 15, y: 18 });
  assert.equal(B.nearestEnemy(state({ enemies: [e] }), { x: 15, y: 15 }, 3), e);
  assert.equal(B.nearestEnemy(state({ enemies: [e] }), { x: 15, y: 15 }, 2), undefined);
});

test("cave hatching grants the same armor capacity as a collected cave without changing hatch progression", () => {
  const s = state({ chain: [{ kind: "egg", pos: { x: 14, y: 15 }, hatchAt: 1 }], enemies: [enemy({ x: 2, y: 2 })] });
  B.step(s, { rng: () => .5 });
  assert.equal(s.chain[0].kind, "cave"); assert.equal(s.maxArmor, 1); assert.equal(s.armor, 0);
  assert.equal(s.eggsHatched, 1); assert.equal(s.pendingSeeds, 2);
});

test("lethal damage ends mutations before another attacker or an expiring egg can act", () => {
  const attackers = [enemy({ x: 15, y: 18 }), enemy({ x: 16, y: 18 })];
  attackers.forEach((e) => { e.cooldown = 0; });
  const s = state({ hp: 1, chain: [{ kind: "egg", pos: { x: 14, y: 15 }, hatchAt: 1 }], enemies: attackers });
  const result = B.step(s, { rng: () => .5 });
  assert.equal(result.alive, false); assert.equal(s.hp, 0);
  assert.equal(s.effects.filter((effect) => effect.text === "HEAD HIT" || effect.text === "SEGMENT HIT").length, 1);
  assert.equal(s.chain[0].kind, "egg"); assert.equal(s.eggsHatched, 0); assert.equal(s.pendingSeeds, 0);
  assert.equal(result.events.filter((event) => event.type === "endRun").length, 1);
});

test("constant RNG still spawns distinct enemies outside the head/chain; full board has no fallback overlap", () => {
  const s = state({ head: { x: 1, y: 1 }, chain: [{ kind: "body", pos: { x: 2, y: 1 } }], round: 4 });
  B.spawnWave(s, () => 0);
  const positions = s.enemies.map((e) => B.key(e.pos));
  assert.equal(new Set(positions).size, B.roundSize(4));
  assert.ok(!positions.includes("1,1") && !positions.includes("2,1"));
  const occupied = new Set();
  for (let y = 1; y <= 28; y++) for (let x = 1; x <= 28; x++) occupied.add(`${x},${y}`);
  assert.equal(B.randomOpen(() => 0, occupied), null);
});
