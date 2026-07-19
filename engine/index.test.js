const test = require("node:test");
const assert = require("node:assert/strict");
const { createWorld } = require("./index.js");
const { nurseryConfig } = require("./config.js");

function startEgg(world) { world.state.nursery.eggProgress = 500; world.tick(1, { offline: true }); }

function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test("one tick advances the economy and the active snake mode together", () => {
  const world = createWorld({ seeds: 500 }, { rng: seededRng(1) });
  startEgg(world);
  world.startSnake({ columns: 9, rows: 9 });

  const eggBefore = world.state.nursery.eggElapsedMs;
  const headBefore = { ...world.state.snake[0] };

  // A single unified tick large enough to move the snake at least once.
  // (offline bypasses the live 100ms clamp so one call crosses the step threshold.)
  world.tick(world.state.tickMs + 5, { offline: true });

  assert.ok(world.state.nursery.eggElapsedMs > eggBefore, "egg timer advanced");
  assert.notDeepEqual(world.state.snake[0], headBefore, "snake moved");
  // Same call drove both — proving one clock.
});

test("economy keeps ticking even when no mode is running (idle)", () => {
  const world = createWorld({ seeds: 500 }, { rng: seededRng(2) });
  startEgg(world);
  // phase stays "ready" — no snake started.
  world.tick(nurseryConfig.eggHatchMs + 1000, { offline: true });
  assert.equal(world.state.nursery.hatchlings.length, 1, "egg hatched while idle");
});

test("offline catch-up: one big tick hatches an egg and accrues habitat income", () => {
  const save = {
    seeds: 100000,
    habitats: { counts: [10, 0, 0, 0, 0, 0, 0, 0] },
    nursery: { eggElapsedMs: 0 }
  };
  const world = createWorld(save, { rng: seededRng(3) });
  const seedsBefore = world.state.seeds;

  world.tick(4 * 3600 * 1000, { offline: true }); // 4 hours in one step

  assert.equal(world.state.nursery.hatchlings.length >= 1 || world.state.nursery.colonyCount >= 1, true,
    "egg progressed to hatch/colony offline");
  // Habitat income accrued (10 Field snakes), net of any nursery seed burn.
  assert.notEqual(world.state.seeds, seedsBefore);
});

test("live dt is clamped but offline dt is not", () => {
  const world = createWorld({ seeds: 500 }, { rng: seededRng(4) });
  startEgg(world);
  world.tick(5000);                     // live: clamped to 100ms
  assert.equal(world.state.nursery.eggElapsedMs, 101);

  world.tick(5000, { offline: true });  // offline: full 5000ms
  assert.equal(world.state.nursery.eggElapsedMs, 5101);
});

test("serialize round-trips through a new world", () => {
  const world = createWorld({ seeds: 500 }, { rng: seededRng(5) });
  startEgg(world);
  world.tick(60000, { offline: true });
  const snapshot = world.serialize();

  const restored = createWorld(snapshot, { rng: seededRng(5) });
  assert.equal(restored.state.seeds, world.state.seeds);
  assert.equal(restored.state.nursery.eggElapsedMs, world.state.nursery.eggElapsedMs);
  assert.deepEqual(restored.state.habitats.counts, world.state.habitats.counts);
});

test("world hooks accrue elapsed time on the same clock (stub)", () => {
  const world = createWorld({}, { rng: seededRng(6) });
  world.tick(1000, { offline: true });
  assert.equal(world.state.world.migration.elapsedMs, 1000);
  assert.equal(world.state.world.events.elapsedMs, 1000);
});

test("the whole world ticks headless with no DOM", () => {
  assert.equal(typeof document, "undefined");
  assert.equal(typeof window, "undefined");
  const world = createWorld({ seeds: 500 }, { rng: seededRng(7) });
  world.startSnake({ columns: 11, rows: 11 });
  assert.doesNotThrow(() => {
    for (let i = 0; i < 100; i += 1) world.tick(50);
  });
});
