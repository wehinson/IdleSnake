const test = require("node:test");
const assert = require("node:assert/strict");
const economy = require("./economy.js");
const { nurseryConfig, habitatConfig } = require("./config.js");

// A deterministic rng so hatchling movement/ids are reproducible in tests.
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function freshState(overrides = {}) {
  return {
    seeds: 0,
    upgrades: { foodTypeLevel: 0 },
    nursery: economy.createNursery({}, 0),
    habitats: economy.createHabitats({}),
    ...overrides
  };
}

test("createNursery normalizes and derives egg elapsed from legacy nestStartedAt", () => {
  const fresh = economy.createNursery(null, 0);
  assert.equal(fresh.eggElapsedMs, null);
  assert.deepEqual(fresh.hatchlings, []);
  assert.equal(fresh.colonyCount, 0);

  // Legacy save: nest started 2 minutes before the host's `now`.
  const now = 10_000_000;
  const legacy = economy.createNursery({ nestStartedAt: now - 120_000 }, now);
  assert.equal(legacy.eggElapsedMs, 120_000);
});

test("layEgg deducts the egg cost and starts the timer, and is gated", () => {
  const state = freshState({ seeds: 500 });
  const ok = economy.layEgg(state);
  assert.equal(ok.accepted, true);
  assert.equal(state.seeds, 0);
  assert.equal(state.nursery.eggElapsedMs, 0);

  // Cannot lay a second egg while one is incubating.
  state.seeds = 500;
  assert.equal(economy.layEgg(state).accepted, false);
  assert.equal(state.seeds, 500);
});

test("egg hatches after eggHatchMs and emits a hatch event", () => {
  const state = freshState({ seeds: 500 });
  economy.layEgg(state);
  const rng = seededRng(1);

  // Just short of hatching: no hatchling yet.
  economy.tickEconomy(state, nurseryConfig.eggHatchMs - 1000, { rng });
  assert.equal(state.nursery.hatchlings.length, 0);
  assert.equal(state.nursery.eggElapsedMs, nurseryConfig.eggHatchMs - 1000);

  // Cross the threshold: exactly one hatchling and one hatch event.
  const { events } = economy.tickEconomy(state, 2000, { rng });
  assert.equal(state.nursery.hatchlings.length, 1);
  assert.equal(state.nursery.eggElapsedMs, null);
  assert.equal(events.filter((e) => e.type === "hatch").length, 1);
});

test("hatchlings burn seeds to grow and graduate into the colony", () => {
  const state = freshState({ seeds: 100000 });
  state.nursery.hatchlings = [{ id: "a", x: 2, y: 4, direction: "right", progressMs: 0 }];
  const rng = seededRng(2);

  // Growth requires growthMs of seed-ticks (1 seed/sec for a lone hatchling).
  economy.tickEconomy(state, nurseryConfig.growthMs, { rng });

  assert.equal(state.nursery.colonyCount, 1, "hatchling graduated");
  assert.equal(state.nursery.hatchlings.length, 0, "pen is empty after graduation");
  // ~growthMs seconds of upkeep were spent (1 seed/sec).
  assert.ok(state.seeds <= 100000 - nurseryConfig.growthMs / 1000 + 1);
});

test("growth stalls when seeds run out and resumes when refilled", () => {
  const state = freshState({ seeds: 3 });
  state.nursery.hatchlings = [{ id: "a", x: 2, y: 4, direction: "right", progressMs: 0 }];
  const rng = seededRng(3);

  economy.tickEconomy(state, nurseryConfig.growthMs, { rng });
  // Only 3 seeds => at most 3 seconds of growth, nowhere near graduating.
  assert.equal(state.nursery.colonyCount, 0);
  assert.ok(state.nursery.hatchlings[0].progressMs <= 3 * nurseryConfig.seedIntervalMs);
  assert.ok(state.seeds < 1);
});

test("habitat income accrues over time and scales with food value", () => {
  const base = freshState({ seeds: 0 });
  base.habitats.counts[0] = 10; // Field
  economy.tickEconomy(base, 10_000, { rng: seededRng(4), foodValue: 1 });
  const earnedAtFood1 = base.seeds;
  assert.ok(earnedAtFood1 > 0, "income accrued");

  const richer = freshState({ seeds: 0 });
  richer.habitats.counts[0] = 10;
  economy.tickEconomy(richer, 10_000, { rng: seededRng(4), foodValue: 5 });
  assert.ok(richer.seeds > earnedAtFood1, "higher food value => more income");
});

test("totalHabitatIncomePerSecond matches manual computation", () => {
  const counts = habitatConfig.habitats.map(() => 0);
  counts[0] = 10;
  const expected = 10 * economy.habitatIncomePerSecond(habitatConfig.habitats[0], 10, 1);
  assert.equal(economy.totalHabitatIncomePerSecond(counts, 1), expected);
});

test("offline catch-up: one big tick equals many small ticks (habitat income)", () => {
  const big = freshState({ seeds: 0 });
  big.habitats.counts[2] = 5;
  economy.tickEconomy(big, 4 * 3600 * 1000, { rng: seededRng(5), foodValue: 3 });

  const small = freshState({ seeds: 0 });
  small.habitats.counts[2] = 5;
  for (let i = 0; i < 4 * 3600; i += 1) {
    economy.tickEconomy(small, 1000, { rng: seededRng(5), foodValue: 3 });
  }

  // Rounding at 4dp per step introduces tiny drift; assert close, not exact.
  assert.ok(Math.abs(big.seeds - small.seeds) < 1, `big=${big.seeds} small=${small.seeds}`);
  assert.ok(big.seeds > 0);
});

test("tickEconomy runs headless with no DOM/globals present", () => {
  assert.equal(typeof document, "undefined");
  assert.equal(typeof window, "undefined");
  const state = freshState({ seeds: 500 });
  economy.layEgg(state);
  assert.doesNotThrow(() => economy.tickEconomy(state, 6 * 60 * 1000, { rng: seededRng(6) }));
});
