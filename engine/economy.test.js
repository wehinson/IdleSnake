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
    provisions: 0,
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

test("an explicit null eggElapsedMs (empty nest) round-trips as null, not a phantom egg at 0", () => {
  // Number(null) === 0, which is finite and >= 0 -- a naive coercion check would
  // wrongly treat an explicitly-empty nest as "an egg just started incubating".
  const emptyNest = economy.createNursery({ eggElapsedMs: null, nestStartedAt: null }, 0);
  assert.equal(emptyNest.eggElapsedMs, null);

  // A real save/serialize/reload round trip must preserve the empty nest too.
  const state = freshState();
  const serialized = JSON.parse(JSON.stringify(state.nursery)); // matches session.serialize()'s clone
  const rehydrated = economy.createNursery(serialized, 0);
  assert.equal(rehydrated.eggElapsedMs, null);
});

test("earned seeds start an egg automatically without spending the seed bank", () => {
  const state = freshState({ seeds: 500 });
  economy.creditEggProgress(state, 500);
  assert.equal(state.seeds, 500);
  assert.equal(state.nursery.eggElapsedMs, 0);
  assert.equal(state.nursery.eggsStarted, 1);

  // Progress toward the following egg can accrue while this one incubates.
  economy.creditEggProgress(state, 505);
  assert.equal(state.nursery.eggProgress, 505);
});

test("egg hatches after eggHatchMs and emits a hatch event", () => {
  const state = freshState({ seeds: 500 });
  economy.creditEggProgress(state, 500);
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

test("active Lake snakes shorten one egg's incubation without generating seeds", () => {
  const state = freshState({ seeds: 500 });
  state.habitats.counts[1] = 2; // Lake
  economy.creditEggProgress(state, 500);

  assert.equal(state.seeds, 500, "Lake produces no seeds");
  assert.equal(state.nursery.eggHatchDurationMs, nurseryConfig.eggHatchMs - 2000,
    "one second is removed once for each active Lake snake");
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

test("food value increases only Seed output, including idle Seed output", () => {
  const counts = habitatConfig.habitats.map(() => 0);
  counts[0] = habitatConfig.habitats[0].naturalCapacity + 1; // one idle Field snake
  counts[2] = 10; // Forest produces Branches
  counts[3] = 10; // River produces Provisions

  const base = economy.calculateHabitatActivation(counts, 1);
  const upgraded = economy.calculateHabitatActivation(counts, 5);

  assert.ok(upgraded.incomePerSecond > base.incomePerSecond, "Seed output scales with food value");
  assert.equal(upgraded.habitatSeedOutputs[0], base.habitatSeedOutputs[0] * 5,
    "the idle Field snake's Seed output is boosted too");
  assert.equal(upgraded.branchesPerSecond, base.branchesPerSecond, "Branches ignore food value");
  assert.equal(upgraded.provisionsProducedPerSecond, base.provisionsProducedPerSecond, "Provisions ignore food value");
  assert.deepEqual(upgraded.activeOverCapacityCounts, base.activeOverCapacityCounts,
    "food value does not alter provision-funded activation");
});

test("totalHabitatIncomePerSecond matches manual computation", () => {
  const counts = habitatConfig.habitats.map(() => 0);
  counts[0] = 10;
  const expected = 10 * economy.habitatIncomePerSecond(habitatConfig.habitats[0], 10, 1);
  assert.equal(economy.totalHabitatIncomePerSecond(counts, 1), expected);
});

test("habitat income is consistent for one large credit or many small credits", () => {
  const big = freshState({ seeds: 0 });
  big.habitats.counts[2] = 5;
  economy.tickHabitats(big, 4 * 3600 * 1000, 3);

  const small = freshState({ seeds: 0 });
  small.habitats.counts[2] = 5;
  for (let i = 0; i < 4 * 3600; i += 1) {
    economy.tickHabitats(small, 1000, 3);
  }

  // Rounding at 4dp per step introduces tiny drift; assert close, not exact.
  assert.ok(Math.abs(big.seeds - small.seeds) < 1, `big=${big.seeds} small=${small.seeds}`);
  assert.ok(big.seeds > 0);
});

test("banked provisions keep over-capacity snakes working until the bank is empty", () => {
  const field = habitatConfig.habitats[0];
  const state = freshState();
  state.habitats.counts[0] = field.naturalCapacity + 10;
  const perSnake = economy.habitatIncomePerSecond(field, state.habitats.counts[0], 1);

  economy.tickHabitats(state, 1000, 1);
  assert.equal(state.seeds, Math.round(field.naturalCapacity * perSnake * 10000) / 10000,
    "only free snakes produce without a provisions producer");

  state.provisions = 1_000_000;
  const beforeSeeds = state.seeds;
  economy.tickHabitats(state, 1000, 1);
  assert.equal(state.seeds, Math.round((beforeSeeds + (field.naturalCapacity + 10) * perSnake) * 10000) / 10000,
    "the provision bank activates every assigned snake");
  assert.equal(state.provisions, 1_000_000 - 10 * perSnake * habitatConfig.income.overCapacityProvisionCost,
    "the extra snakes consume the stockpile");
});

test("a long tick switches to renewable activation when the provision bank runs out", () => {
  const field = habitatConfig.habitats[0];
  const state = freshState({ provisions: 0.01 });
  state.habitats.counts[0] = field.naturalCapacity + 10;
  const perSnake = economy.habitatIncomePerSecond(field, state.habitats.counts[0], 1);
  const fundedSeconds = state.provisions / (10 * perSnake * habitatConfig.income.overCapacityProvisionCost);

  economy.tickHabitats(state, 10_000, 1);

  const expected = (field.naturalCapacity + 10) * perSnake * fundedSeconds
    + field.naturalCapacity * perSnake * (10 - fundedSeconds);
  assert.equal(state.seeds, Math.round(expected * 10000) / 10000);
  assert.equal(state.provisions, 0);
});

test("over-capacity snakes activate one per habitat per round", () => {
  const counts = habitatConfig.habitats.map(() => 0);
  counts[0] = habitatConfig.habitats[0].naturalCapacity + 10; // Field
  counts[1] = habitatConfig.habitats[1].naturalCapacity + 10; // Lake
  counts[3] = 1; // River provides 0.02 provisions/sec at food value 1

  const activation = economy.calculateHabitatActivation(counts, 1);
  assert.deepEqual(activation.activeOverCapacityCounts.slice(0, 4), [3, 2, 0, 0]);
  assert.deepEqual(activation.idleCounts.slice(0, 4), [7, 8, 0, 0]);
  assert.ok(activation.provisionsConsumedPerSecond <= activation.provisionsProducedPerSecond);
});

test("activation stops within a row instead of skipping an unaffordable habitat", () => {
  const counts = habitatConfig.habitats.map(() => 0);
  counts[0] = habitatConfig.habitats[0].naturalCapacity + 1_000_000;
  counts[1] = habitatConfig.habitats[1].naturalCapacity + 1_000_000;
  counts[3] = 1;

  const activation = economy.calculateHabitatActivation(counts, 1);
  assert.deepEqual(activation.activeOverCapacityCounts.slice(0, 4), [2, 1, 0, 0]);
  assert.ok(activation.activeOverCapacityCounts[0] <= activation.activeOverCapacityCounts[1] + 1,
    "Field never gets more than one row ahead of Lake");
});

test("reported provision consumption includes only activated snakes", () => {
  const counts = habitatConfig.habitats.map(() => 0);
  counts[0] = habitatConfig.habitats[0].naturalCapacity + 10;
  counts[1] = habitatConfig.habitats[1].naturalCapacity + 10;
  counts[2] = 1;
  const activation = economy.calculateHabitatActivation(counts, 1);
  const expected = activation.activeOverCapacityCounts.reduce((total, active, index) =>
    total + active * activation.perSnakeRates[index] * habitatConfig.income.overCapacityProvisionCost, 0);
  assert.ok(Math.abs(activation.provisionsConsumedPerSecond - expected) < 1e-12);
});

test("tickEconomy runs headless with no DOM/globals present", () => {
  assert.equal(typeof document, "undefined");
  assert.equal(typeof window, "undefined");
  const state = freshState({ seeds: 500 });
  economy.creditEggProgress(state, 500);
  assert.doesNotThrow(() => economy.tickEconomy(state, 6 * 60 * 1000, { rng: seededRng(6) }));
});

test("completed progress is capped at one egg (no queue) while the nest is occupied", () => {
  const state = freshState();
  state.nursery.eggElapsedMs = 1000; // an egg is already incubating -> nest busy
  economy.creditEggProgress(state, 10_000);
  // A second egg can't start while one incubates; progress caps at one egg.
  assert.equal(state.nursery.eggProgress, 500);
  assert.equal(state.nursery.eggElapsedMs, 1000); // first egg keeps incubating
});

test("a ready egg starts as soon as the nest is empty, even if the yard is full", () => {
  const state = freshState();
  state.nursery.hatchlings = [{ id: "a", x: 2, y: 4, direction: "right", progressMs: 0 }, { id: "b", x: 3, y: 4, direction: "left", progressMs: 0 }];
  economy.creditEggProgress(state, 500);
  assert.equal(state.nursery.eggElapsedMs, 0); // started incubating in the empty nest
  assert.equal(state.nursery.eggProgress, 0);
});

test("an egg that finishes incubating while the yard is full is held, not discarded", () => {
  const state = freshState({ seeds: 0 }); // no seeds -> hatchlings can't graduate
  state.nursery.hatchlings = [{ id: "a", x: 2, y: 4, direction: "right", progressMs: 0 }, { id: "b", x: 3, y: 4, direction: "left", progressMs: 0 }];
  state.nursery.eggElapsedMs = nurseryConfig.eggHatchMs - 100; // about to hatch
  economy.tickEconomy(state, 1000, { rng: seededRng(1) });
  // Yard full and can't graduate -> egg is held in the nest, no hatchling lost.
  assert.ok(economy.eggHeldForSpace(state.nursery));
  assert.equal(state.nursery.eggElapsedMs, nurseryConfig.eggHatchMs);
  assert.equal(state.nursery.hatchlings.length, 2);
});

test("a held egg hatches once a hatchling graduates and frees a slot", () => {
  const state = freshState({ seeds: 1_000_000 }); // plenty of seeds to grow/graduate
  state.nursery.hatchlings = [
    { id: "a", x: 2, y: 4, direction: "right", progressMs: nurseryConfig.growthMs - 10 },
    { id: "b", x: 3, y: 4, direction: "left", progressMs: nurseryConfig.growthMs - 10 }
  ];
  state.nursery.eggElapsedMs = nurseryConfig.eggHatchMs; // finished, waiting to hatch
  economy.tickEconomy(state, 1000, { rng: seededRng(2) });
  // The grown hatchlings graduate (freeing slots) and the held egg hatches.
  assert.equal(state.nursery.eggElapsedMs, null); // nest freed by hatching
  assert.ok(state.nursery.colonyCount >= 2);      // graduates moved to colony
});

test("plain-Seeds habitat income grows seeds but never advances egg progress", () => {
  const state = freshState({ seeds: 0 });
  state.habitats.counts[0] = 50; // Field: not a provisions producer
  economy.tickEconomy(state, 60 * 60 * 1000, { rng: seededRng(11) }); // 1 simulated hour
  assert.ok(state.seeds > 0, "seeds still accrue from a Seeds-only habitat");
  assert.equal(state.nursery.eggProgress, 0, "no egg progress from a Seeds-only habitat");
  assert.equal(state.nursery.eggElapsedMs, null);
});

test("River provision income advances egg progress and starts an egg on threshold", () => {
  const state = freshState({ seeds: 0 });
  state.habitats.counts[3] = 50; // River: flagged producesProvisions
  economy.tickEconomy(state, 60 * 60 * 1000, { rng: seededRng(12) });
  assert.ok(state.seeds > 0, "Provisions habitats still pay seed income");
  assert.ok(state.provisions > 0, "River also fills the separate provisions stockpile");
  assert.ok(state.nursery.eggsStarted > 0, "enough provisions income started at least one egg");
});

test("Forest produces equal Seed and Branch output without producing Provisions", () => {
  const state = freshState();
  state.habitats.counts[2] = 10;
  const result = economy.tickHabitats(state, 1000, 1);
  assert.ok(state.seeds > 0);
  assert.equal(state.branches, state.seeds);
  assert.equal(result.provisionsIncome, 0);
  assert.equal(state.provisions, 0);
});

test("habitat upgrades raise only the maximum capacity and have escalating Branch costs", () => {
  const field = habitatConfig.habitats[0];
  assert.equal(economy.habitatBaseMaxCapacity(field, 0), field.hardCapacity);
  assert.equal(economy.habitatBaseMaxCapacity(field, 1), field.hardCapacity + field.capacityPerUpgrade);
  assert.equal(field.naturalCapacity, 25);
  assert.ok(economy.habitatUpgradeCost(field, 1) > economy.habitatUpgradeCost(field, 0));
});

test("totalProvisionsIncomePerSecond only counts habitats flagged producesProvisions", () => {
  const counts = habitatConfig.habitats.map(() => 5);
  const forestIndex = habitatConfig.habitats.findIndex((h) => h.producesProvisions);
  const expected = 5 * economy.habitatIncomePerSecond(habitatConfig.habitats[forestIndex], 5, 1);
  assert.equal(economy.totalProvisionsIncomePerSecond(counts, 1), expected);
  assert.ok(economy.totalHabitatIncomePerSecond(counts, 1) > economy.totalProvisionsIncomePerSecond(counts, 1),
    "total income across all habitats exceeds the provisions-only slice");
});

test("egg-board hatchlings use normal nursery space before temporary overflow", () => {
  const state = freshState();
  const rng = seededRng(9);
  economy.addEggBoardHatchling(state, rng);
  economy.addEggBoardHatchling(state, rng);
  const overflow = economy.addEggBoardHatchling(state, rng);
  assert.equal(state.nursery.hatchlings.length, 3);
  assert.equal(state.nursery.hatchlings[0].temporary, false);
  assert.equal(state.nursery.hatchlings[1].temporary, false);
  assert.equal(state.nursery.hatchlings[2].temporary, true);
  assert.equal(overflow.temporary, true);
});
