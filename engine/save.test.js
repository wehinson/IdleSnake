const test = require("node:test");
const assert = require("node:assert/strict");
const save = require("./save.js");
const { nurseryConfig, habitatConfig } = require("./config.js");

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

// A consolidated save object in game.js's schema (buildDefaultSaveState shape).
function consolidated(overrides = {}) {
  return {
    saveVersion: 1,
    savedAt: 1_000_000_000,
    currencies: { seeds: 0, provisions: 0 },
    upgrades: { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 0 },
    board: { selectedBoardLevel: 0, selectedDuelGridSize: 30 },
    records: { best: 0, crossingBest: 0, mazeBest: 0, breakoutBest: 0, sokobanBest: 0 },
    settings: { snakeColors: { body: "#111", head: "#222" } },
    nursery: { nestStartedAt: null, hatchlings: [], colonyCount: 0, lastUpdatedAt: 1_000_000_000 },
    habitats: { counts: habitatConfig.habitats.map(() => 0), lastUpdatedAt: 1_000_000_000 },
    snakebird: { unlockedLevel: 3, clearedLevels: [true, true], bestMoves: [10, 12], lastSelectedLevel: 2 },
    routes: [], regions: [], season: null, migration: null,
    prestigeHistory: [], accessibility: { colorblindMode: false, reducedMotion: false },
    ...overrides
  };
}

test("toEngineSave maps consolidated fields onto the engine save shape", () => {
  const save0 = save.toEngineSave(consolidated({
    currencies: { seeds: 777, provisions: 33, branches: 22 },
    records: { best: 55 },
    upgrades: { boardLevel: 2, foodTypeLevel: 3, foodCountLevel: 1, shieldLevel: 0, minigamesLevel: 0 }
  }));
  assert.equal(save0.seeds, 777);
  assert.equal(save0.provisions, 33);
  assert.equal(save0.branches, 22);
  assert.equal(save0.best, 55);
  assert.equal(save0.upgrades.boardLevel, 2);
});

test("hydrate loads a consolidated save and preserves seeds/best/upgrades/habitats", () => {
  const now = 1_000_000_000;
  const world = save.hydrate(consolidated({
    savedAt: now,
    currencies: { seeds: 1234, provisions: 56, branches: 78 },
    records: { best: 42 },
    upgrades: { boardLevel: 2, foodTypeLevel: 3, foodCountLevel: 1, shieldLevel: 2, minigamesLevel: 0 },
    nursery: { nestStartedAt: now - 120_000, lastUpdatedAt: now, hatchlings: [], colonyCount: 5 },
    habitats: { counts: [3, 1, 0, 0, 0, 0, 0, 0], upgradeLevels: [2, 1, 0, 0, 0, 0, 0, 0], lastUpdatedAt: now }
  }), { now, rng: seededRng(1) }).world;

  assert.equal(world.state.best, 42);
  assert.equal(world.state.provisions, 56);
  assert.equal(world.state.branches, 78);
  assert.equal(world.state.upgrades.boardLevel, 2);
  assert.equal(world.state.nursery.colonyCount, 5);
  assert.deepEqual(world.state.habitats.counts, [3, 1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(world.state.habitats.upgradeLevels, [2, 1, 0, 0, 0, 0, 0, 0]);
  assert.equal(world.state.nursery.eggElapsedMs, 120_000); // anchored to savedAt
});

test("offline gap (savedAt -> now) advances the egg exactly once", () => {
  const savedAt = 5_000_000;
  const now = savedAt + 3 * 60 * 1000;
  const { world, offlineMs } = save.hydrate(consolidated({
    savedAt,
    nursery: { nestStartedAt: savedAt - 60_000, lastUpdatedAt: savedAt, hatchlings: [], colonyCount: 0 }
  }), { now, rng: seededRng(2) });
  assert.equal(offlineMs, 3 * 60 * 1000);
  assert.equal(world.state.nursery.eggElapsedMs, 4 * 60 * 1000); // 1min saved + 3min offline
  assert.equal(world.state.nursery.hatchlings.length, 0);        // still < 5min hatch
});

test("long offline gap hatches the egg during catch-up", () => {
  const savedAt = 7_000_000;
  const now = savedAt + nurseryConfig.eggHatchMs + 60_000;
  const { world } = save.hydrate(consolidated({
    savedAt,
    currencies: { seeds: 10 },
    nursery: { nestStartedAt: savedAt, lastUpdatedAt: savedAt, hatchlings: [], colonyCount: 0 }
  }), { now, rng: seededRng(3) });
  assert.equal(world.state.nursery.hatchlings.length, 1);
  assert.equal(world.state.nursery.eggElapsedMs, null);
});

test("writeInto -> hydrate round-trips engine state through the consolidated save", () => {
  const t0 = 2_000_000;
  const blob = consolidated({ savedAt: t0, currencies: { seeds: 500 } });
  const first = save.hydrate(blob, { now: t0, rng: seededRng(4) }).world;
  first.state.nursery.eggProgress = 500; first.tick(1, { offline: true });
  first.tick(90_000, { offline: true });
  const seedsAfter = first.state.seeds;
  const eggAfter = first.state.nursery.eggElapsedMs;

  const t1 = t0 + 90_000;
  save.writeInto(blob, first, t1);
  const second = save.hydrate(blob, { now: t1, rng: seededRng(4) }).world;

  assert.equal(second.state.seeds, seedsAfter);
  assert.equal(second.state.nursery.eggElapsedMs, eggAfter);
});

test("writeInto preserves fields the engine doesn't own (the save-data feature)", () => {
  const now = 3_000_000;
  const blob = consolidated({ savedAt: now, currencies: { seeds: 500 } });
  const { world } = save.hydrate(blob, { now, rng: seededRng(5) });
  save.writeInto(blob, world, now + 1000);

  // Export/import-critical fields are untouched:
  assert.deepEqual(blob.settings.snakeColors, { body: "#111", head: "#222" });
  assert.deepEqual(blob.snakebird, { unlockedLevel: 3, clearedLevels: [true, true], bestMoves: [10, 12], lastSelectedLevel: 2 });
  assert.equal(blob.records.crossingBest, 0); // other-mode records preserved
  assert.equal(blob.saveVersion, 1);
  assert.ok(Array.isArray(blob.routes) && Array.isArray(blob.regions));
});

test("writeInto emits dual nursery format (engine + legacy readable)", () => {
  const now = 3_333_333;
  const blob = consolidated({ savedAt: now - 1000, currencies: { seeds: 500 } });
  const { world } = save.hydrate(blob, { now: now - 1000, rng: seededRng(6) });
  world.state.nursery.eggProgress = 500; world.tick(1, { offline: true });
  world.tick(30_000, { offline: true });
  save.writeInto(blob, world, now);

  assert.equal(blob.nursery.eggElapsedMs, 30_001);           // engine field
  assert.equal(blob.nursery.nestStartedAt, now - 30_001);    // legacy mirror
  assert.equal(blob.nursery.lastUpdatedAt, now);
  assert.equal(blob.savedAt, now);
});

test("world-system elapsed time round-trips through reserved migration/season slots", () => {
  const t0 = 8_000_000;
  const blob = consolidated({ savedAt: t0 });
  const first = save.hydrate(blob, { now: t0, rng: seededRng(7) }).world;
  first.tick(5000, { offline: true });
  save.writeInto(blob, first, t0 + 5000);
  assert.equal(blob.migration.elapsedMs, 5000);

  const second = save.hydrate(blob, { now: t0 + 5000, rng: seededRng(7) }).world;
  assert.equal(second.state.world.migration.elapsedMs, 5000);
});

test("missing/empty consolidated save yields a fresh world without throwing", () => {
  assert.doesNotThrow(() => {
    const { world } = save.hydrate(undefined, { now: 123456, rng: seededRng(8) });
    assert.equal(world.state.seeds, 0);
    assert.equal(world.state.nursery.eggElapsedMs, null);
  });
});
