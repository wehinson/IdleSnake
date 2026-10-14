const test = require("node:test");
const assert = require("node:assert/strict");
const economy = require("./economy.js");
const queries = require("./queries.js");
const notables = require("./notables.js");
const migration = require("./migration.js");
const { createGameSession } = require("./session.js");
const { habitatConfig, nurseryConfig } = require("./config.js");

const clone = (value) => JSON.parse(JSON.stringify(value));
const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
function leader(powerType, habitatId = 0, powerMagnitude = 0.5) {
  return { id: `leader-${habitatId}`, name: "Reed", powerType, powerMagnitude, status: "ASSIGNED", assignedHabitatId: habitatId };
}
function game(counts = [], extra = {}) {
  const session = createGameSession({ now: 1000, rng: () => 0.99, save: { savedAt: 1000,
    currencies: { seeds: 0, branches: 1000, provisions: 0 }, records: { best: 10000 },
    nursery: { colonyCount: 100 }, habitats: { counts }, ...extra } });
  session.dispatch({ type: "selectMode", mode: "snake" });
  return session;
}
function local(counts, retained = []) {
  return { seeds: 0, branches: 0, provisions: 0, upgrades: {},
    nursery: economy.createNursery({}, 0), habitats: economy.createHabitats({ counts }),
    notables: notables.createState({ retained }) };
}
function rejectReason(result) { return result.events.find((item) => item.type === "actionRejected")?.reason; }

test("habitats require four vs five previous snakes, with no score gate and no chain bypass", () => {
  const session = game([4]);
  let panel = queries.habitatPanel(session.snapshot());
  assert.deepEqual(panel.habitats.map((item) => item.visible), [true, false, false, false, false, false, false, false]);
  assert.equal(panel.nextHabitat.snakesNeeded, 1);
  assert.equal(rejectReason(session.dispatch({ type: "placeHabitat", index: 1 })), "habitatUnavailable");
  assert.equal(rejectReason(session.dispatch({ type: "upgradeHabitat", index: 1 })), "habitatUnavailable");
  session.dispatch({ type: "placeHabitat", index: 0 });
  panel = queries.habitatPanel(session.snapshot());
  assert.equal(panel.habitats[1].unlocked, true);
  assert.equal(panel.habitats[2].visible, false);
  assert.equal(panel.nextHabitat.snakesNeeded, 5);
  assert.equal(rejectReason(session.dispatch({ type: "upgradeHabitat", index: 1 })), undefined);
  assert.equal(rejectReason(session.dispatch({ type: "placeHabitat", index: 1, count: 5 })), undefined);
  assert.equal(queries.habitatPanel(session.snapshot()).habitats[2].unlocked, true);
  assert.equal(rejectReason(session.dispatch({ type: "placeHabitat", index: 3 })), "habitatUnavailable");
  const zeroScore = game([5], { records: { best: 0 } });
  assert.equal(rejectReason(zeroScore.dispatch({ type: "placeHabitat", index: 1 })), undefined);
  assert.equal(queries.habitatPanel(game([], { records: { best: 0 } }).snapshot()).habitats[0].unlocked, true);
});

test("legacy higher populations persist and produce, but expansion requires repairing the chain", () => {
  const session = game([4, 5, 2, 1]);
  const before = session.snapshot();
  const panel = queries.habitatPanel(before);
  assert.equal(panel.habitats[2].legacyOccupied, true);
  assert.equal(panel.habitats[2].visible, true);
  assert.equal(panel.habitats[2].unlocked, false);
  assert.equal(rejectReason(session.dispatch({ type: "placeHabitat", index: 2 })), "habitatUnavailable");
  assert.equal(rejectReason(session.dispatch({ type: "upgradeHabitat", index: 2 })), "habitatUnavailable");
  session.tick(1000);
  assert.ok(session.snapshot().seeds > before.seeds);
  assert.ok(session.snapshot().branches > before.branches);
  const saved = session.serialize();
  const restored = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.99 });
  assert.deepEqual(restored.snapshot().habitats.counts, before.habitats.counts);
  restored.dispatch({ type: "placeHabitat", index: 0 });
  assert.equal(queries.habitatPanel(restored.snapshot()).habitats[2].unlocked, true);
  assert.equal(rejectReason(restored.dispatch({ type: "placeHabitat", index: 2 })), undefined);
});

test("a reduced saved prerequisite relocks its dependent chain without deleting occupants", () => {
  const session = game([5, 5, 5]);
  assert.equal(queries.habitatPanel(session.snapshot()).habitats[3].unlocked, true);
  const saved = session.serialize();
  // No live habitat removal command exists. Model a changed/reduced population
  // through the persisted authoritative settlement economy instead.
  saved.session.habitats.counts[0] = 4;
  saved.session.migration.settlements[0].economy.habitats.counts[0] = 4;
  const restored = createGameSession({ save: saved, now: saved.savedAt });
  const panel = queries.habitatPanel(restored.snapshot());
  assert.deepEqual(panel.habitats.slice(0, 4).map((item) => item.unlocked), [true, false, false, false]);
  assert.deepEqual(restored.snapshot().habitats.counts.slice(0, 3), [4, 5, 5]);
  assert.equal(rejectReason(restored.dispatch({ type: "upgradeHabitat", index: 2 })), "habitatUnavailable");
});

test("every production type is exactly ten times its old formula; costs and hatch reductions stay unchanged", () => {
  habitatConfig.habitats.forEach((habitat, index) => {
    const counts = habitatConfig.habitats.map(() => 0);
    counts[index] = habitat.naturalCapacity;
    const state = local(counts, [leader("PRODUCTION_INCREASE", index)]);
    const activation = economy.calculateHabitatActivation(counts, 5, state.notables);
    const oldBase = habitatConfig.income.basePerSecond * habitat.incomeMultiplier * economy.habitatMultiplier(habitat, counts[index]);
    const expectedBase = counts[index] * oldBase * 10 * 1.5;
    near(activation.habitatSeedOutputs[index], habitat.producesSeeds === false ? 0 : expectedBase * 5);
    near(activation.habitatBranchOutputs[index], habitat.producesBranches ? expectedBase : 0);
    near(activation.habitatProvisionOutputs[index], habitat.producesProvisions ? expectedBase : 0);
    near(activation.eggHatchReductionSeconds, counts[index] * (habitat.eggHatchReductionSeconds || 0));
    near(activation.upkeepPerSnakeRates[index], oldBase);
    economy.tickHabitats(state, 1000, 5, 1.25);
    near(state.seeds, economy.roundSeeds(activation.habitatSeedOutputs[index] * 1.25));
    near(state.branches, economy.roundSeeds(activation.habitatBranchOutputs[index]));
    near(state.provisions, economy.roundSeeds(activation.habitatProvisionOutputs[index]));
    const cost = economy.habitatUpgradeCost(habitat, 0);
    assert.equal(cost, habitat.upgradeCost);
  });
});

test("Forager and Rationer scale actual output; provision upkeep reduction remains at its original scale", () => {
  const forager = local([1], [leader("FORAGER", 0, 0.1)]);
  economy.tickHabitats(forager, 1000, 5, 2);
  near(forager.seeds, 0.5);
  near(forager.provisions, 0.025); // Length boosts Seeds, not Forager provisions.
  const rationer = local([26], [leader("RATIONER", 0, 0.5)]);
  const activation = economy.calculateHabitatActivation([26], 5, rationer.notables);
  const oldBase = 0.01 * 0.5 * 1.1;
  near(activation.habitatSeedOutputs[0], 25.5 * oldBase * 10 * 5);
  const reducer = local([26], [leader("CONSUMPTION_REDUCTION", 0, 0.5)]);
  reducer.provisions = 1;
  economy.tickHabitats(reducer, 1000, 5);
  near(reducer.provisions, 1 - oldBase * 0.5 * 0.5);
  near(reducer.notables.retained[0].totalConsumptionPrevented, oldBase * 0.5 * 0.5);
});

test("current query rates include length only for Seeds and reads never accrue service", () => {
  const session = game([1, 0, 1, 1], { notables: { retained: [leader("FORAGER", 0, 0.1)] } });
  session.dispatch({ type: "begin" });
  const snapshot = session.snapshot();
  const panel = queries.habitatPanel(snapshot);
  assert.ok(panel.seedIncomeMultiplier > 1);
  near(panel.seedIncomePerSecond, panel.activation.incomePerSecond * panel.seedIncomeMultiplier);
  panel.habitats.forEach((item, index) => near(item.seedRate, panel.activation.habitatSeedOutputs[index] * panel.seedIncomeMultiplier));
  const before = snapshot.seeds;
  const after = session.tick(100).snapshot;
  near(after.seeds - before, economy.roundSeeds(panel.seedIncomePerSecond * 0.1));
  near(after.notables.retained[0].totalProvisionsForaged, panel.habitats[0].foragerRate * 0.1);
  const service = after.notables.retained[0].totalServiceTime;
  for (let i = 0; i < 10; i += 1) { queries.habitatPanel(session.snapshot()); session.snapshot(); session.serialize(); }
  assert.equal(session.snapshot().notables.retained[0].totalServiceTime, service);
});

test("zero-effect assigned leaders serve by elapsed passive time, including pause, unassign and offline reload", () => {
  for (const powerType of ["CAPACITY_INCREASE", "CONSUMPTION_REDUCTION", "RATIONER"]) {
    const session = game([1], { notables: { retained: [leader(powerType)] } });
    session.tick(1234);
    let notable = session.snapshot().notables.retained[0];
    assert.equal(notable.totalServiceTime, 1234);
    assert.equal(notable.hasServed, true);
    assert.deepEqual(notable.habitatsServed, [0]);
    assert.equal(notable.totalCapacityEnabled + notable.totalConsumptionPrevented + notable.totalShortageOutputPreserved, 0);
    session.dispatch({ type: "begin" }); session.dispatch({ type: "pause" }); session.tick(766);
    assert.equal(session.snapshot().notables.retained[0].totalServiceTime, 2000); // Idle colony also works while the game is paused.
    session.dispatch({ type: "unassignNotable", notableId: notable.id }); session.tick(1000);
    assert.equal(session.snapshot().notables.retained[0].totalServiceTime, 2000);
    session.dispatch({ type: "assignNotable", notableId: notable.id, habitatId: 0 });
    const saved = session.serialize();
    const restored = createGameSession({ save: saved, now: saved.savedAt + 60000 });
    restored.advanceOffline(saved.savedAt + 60000);
    notable = restored.snapshot().notables.retained[0];
    assert.equal(notable.totalServiceTime, 62000);
    restored.advanceOffline(saved.savedAt + 60000);
    assert.equal(restored.snapshot().notables.retained[0].totalServiceTime, 62000);
  }
});

test("empty habitats and inactive or expedition leaders do not accrue service", () => {
  for (const retained of [[leader("CAPACITY_INCREASE")], [{ ...leader("CAPACITY_INCREASE"), status: "INACTIVE" }], [{ ...leader("CAPACITY_INCREASE"), status: "EXPEDITION" }]]) {
    const state = local(retained[0].status === "ASSIGNED" ? [] : [1], retained);
    economy.tickHabitats(state, 1000, 1);
    assert.equal(state.notables.retained[0].totalServiceTime, 0);
  }
});

test("time growth, gates and service remain local to established settlements; founding does not serve", () => {
  const original = game([5], { notables: { retained: [leader("CAPACITY_INCREASE")] }, nursery: { colonyCount: 100, feedingPaused: true,
    hatchlings: [{ id: "a", progressMs: nurseryConfig.growthMs - 1000 }] } });
  const saved = original.serialize();
  const home = saved.session.migration.settlements[0];
  const remote = clone(home); remote.id = "wetlands"; remote.name = "Wetlands"; remote.region = "Wetlands";
  remote.economy.habitats.counts[0] = 4;
  const founding = clone(remote); founding.id = "highlands"; founding.name = "Highlands";
  founding.status = "founding"; founding.foundingRemainingMs = 60000;
  saved.session.migration.settlements.push(remote, founding);
  const session = createGameSession({ save: saved, now: saved.savedAt + 1000 });
  session.advanceOffline(saved.savedAt + 1000);
  let settlements = session.snapshot().migration.settlements;
  for (const item of settlements.slice(0, 2)) {
    assert.equal(item.economy.nursery.colonyCount, 101);
    assert.equal(item.economy.nursery.hatchlings.length, 0);
    assert.equal(item.economy.notables.retained[0].totalServiceTime, 1000);
    assert.equal(item.economy.seeds, item.id === "grasslands" ? 0.25 : 0.2);
  }
  assert.equal(settlements[2].economy.notables.retained[0].totalServiceTime, 0);
  assert.equal(settlements[2].economy.nursery.hatchlings.length, 1);
  session.dispatch({ type: "selectSettlement", settlementId: "wetlands" });
  assert.equal(queries.habitatPanel(session.snapshot()).habitats[1].unlocked, false);
  assert.equal(rejectReason(session.dispatch({ type: "placeHabitat", index: 1 })), "habitatUnavailable");
  session.dispatch({ type: "placeHabitat", index: 0 });
  assert.equal(queries.habitatPanel(session.snapshot()).habitats[1].unlocked, true);
  session.dispatch({ type: "selectSettlement", settlementId: "grasslands" });
  assert.equal(session.snapshot().habitats.counts[0], 5);
  settlements = session.snapshot().migration.settlements;
  assert.equal(settlements[1].economy.habitats.counts[0], 5);
});

test("migration habitat milestones use population gates and preserve historical earned high-water marks", () => {
  const session = game([4]);
  const saved = session.serialize();
  assert.equal(saved.session.migration.settlements[0].stats.habitatsUnlocked, 1);
  session.dispatch({ type: "placeHabitat", index: 0 });
  const next = session.serialize();
  assert.equal(next.session.migration.settlements[0].stats.habitatsUnlocked, 2);
  next.session.migration.settlements[0].economy.habitats.counts[0] = 4;
  next.session.habitats.counts[0] = 4;
  const restored = createGameSession({ save: next, now: next.savedAt });
  const credited = restored.serialize();
  assert.equal(credited.session.migration.settlements[0].stats.habitatsUnlocked, 2);
  assert.equal(migration.creditActiveSettlement(credited.session), 0);
});

test("zero-food egg incubation and maturation match online/offline and persisted partial growth", () => {
  const original = game([], { nursery: { colonyCount: 0, feedingPaused: true, eggElapsedMs: 0,
    hatchlings: [{ id: "first", progressMs: 10000, feedingAccumulatorMs: 899 }] } });
  const saved = original.serialize();
  const live = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.99 });
  const idle = createGameSession({ save: saved, now: saved.savedAt + nurseryConfig.eggHatchMs + nurseryConfig.growthMs, rng: () => 0.99 });
  for (let i = 0; i < 1200; i += 1) live.tick(1000);
  idle.advanceOffline(saved.savedAt + 1200000);
  for (const session of [live, idle]) {
    const n = session.snapshot().nursery;
    assert.equal(n.colonyCount, 2); assert.equal(n.hatchlings.length, 0); assert.equal(n.eggElapsedMs, null);
    assert.equal(session.snapshot().seeds, 0);
    const restored = createGameSession({ save: session.serialize(), now: session.serialize().savedAt });
    assert.equal(restored.snapshot().nursery.colonyCount, 2);
  }
});

function productionState(snapshot) {
  const n = snapshot.nursery;
  return { seeds: snapshot.seeds, branches: snapshot.branches, provisions: snapshot.provisions,
    adults: n.colonyCount, eggsStarted: n.eggsStarted, eggElapsedMs: n.eggElapsedMs,
    eggProgress: n.eggProgress, eggHatchDurationMs: n.eggHatchDurationMs,
    hatchlingProgress: n.hatchlings.map((h) => h.progressMs), nestEggs: n.nestEggs,
    resupplyEggHolding: n.resupplyEggHolding };
}

test("recurring nursery production is identical for one-hour live and offline scheduling", () => {
  const saved = game([5, 5, 5, 25], { currencies: { seeds: 0, branches: 0, provisions: 0 }, nursery: { colonyCount: 0 } }).serialize();
  const live = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.99 });
  const offline = createGameSession({ save: saved, now: saved.savedAt + 3600000, rng: () => 0.99 });
  for (let i = 0; i < 3600; i += 1) live.tick(1000);
  offline.advanceOffline(saved.savedAt + 3600000);
  const actual = productionState(offline.snapshot());
  assert.deepEqual(actual, productionState(live.snapshot()));
  assert.equal(actual.adults, 6); assert.equal(actual.eggsStarted, 9);
  assert.deepEqual(actual.hatchlingProgress, [505000, 210000]);
  assert.equal(actual.eggElapsedMs, 210000); assert.equal(actual.eggProgress, 546);
  const settled = offline.serialize();
  offline.advanceOffline(saved.savedAt + 3600000);
  assert.deepEqual(productionState(offline.snapshot()), actual, "the same offline target is not accrued twice");
  const restored = createGameSession({ save: settled, now: settled.savedAt, rng: () => 0.99 });
  assert.deepEqual(productionState(restored.snapshot()), actual, "partial incubation and growth persist");
});

test("recurring scheduling preserves partial saves, yard backpressure and zero-duration incubation", () => {
  for (const counts of [[5, 5, 5, 25], [5, 330, 5, 25]]) {
    const original = game(counts, { currencies: { seeds: 0, branches: 0, provisions: 1e6 },
      habitats: { counts, upgradeLevels: [0, 9] }, nursery: { colonyCount: 0, nestLevel: 1, eggElapsedMs: 300000,
        eggHatchDurationMs: 300000, eggProgress: 500,
        hatchlings: [{ id: "a", progressMs: 899999 }, { id: "b", progressMs: 600001 }],
        nestEggs: [{ elapsedMs: 299999, hatchDurationMs: 300000 }], resupplyEggHolding: 2 } });
    const saved = original.serialize();
    const live = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.99 });
    const offline = createGameSession({ save: saved, now: saved.savedAt + 3600000, rng: () => 0.99 });
    for (let i = 0; i < 3600; i += 1) live.tick(1000);
    offline.advanceOffline(saved.savedAt + 3600000);
    const a = productionState(live.snapshot()); const b = productionState(offline.snapshot());
    for (const key of ["seeds", "branches", "provisions", "eggProgress"]) { near(a[key], b[key], 0.01); delete a[key]; delete b[key]; }
    assert.deepEqual(a, b);
    assert.ok(a.adults >= 6, "recurring production continues after the saved held eggs");
  }
});

test("Lake query reports the capped effective current reduction used to start real eggs", () => {
  for (const [lakeCount, expected] of [[0, 0], [12, 12], [65, 65], [330, 300]]) {
    // River output funds every Lake snake without relying on a temporary bank.
    const counts = [5, lakeCount, 5, 25];
    const session = game(counts, { currencies: { seeds: 0, branches: 0, provisions: 0 },
      habitats: { counts, upgradeLevels: [0, 9] } });
    const snapshot = session.snapshot();
    const panel = queries.habitatPanel(snapshot);
    assert.equal(panel.habitats[1].eggHatchReduction, expected);
    const state = local(counts); state.habitats.upgradeLevels[1] = 9;
    economy.creditEggProgress(state, 500);
    assert.equal(state.nursery.eggHatchDurationMs, nurseryConfig.eggHatchMs - expected * 1000);
    assert.equal(economy.calculateHabitatActivation(counts, 1, undefined, [0, 9]).eggHatchReductionSeconds, lakeCount,
      "raw nonproduction mechanics are preserved");
  }
  const unsupported = game([5, 330], { currencies: { seeds: 0, branches: 0, provisions: 0 },
    habitats: { counts: [5, 330], upgradeLevels: [0, 9] } });
  assert.equal(queries.habitatPanel(unsupported.snapshot()).habitats[1].eggHatchReduction, 30, "only active Lake snakes affect incubation");
});

test("bank-funded production does not change the authoritative recurring Lake egg-start reduction", () => {
  for (const bank of [0, 1e6]) for (const [river, reduction] of [[0, 30], [1, 57], [25, 300]]) {
    const counts = [5, 330, 5, river];
    const session = game(counts, { currencies: { seeds: 0, branches: 0, provisions: bank },
      habitats: { counts, upgradeLevels: [0, 9] }, nursery: { eggProgress: 500 } });
    const before = session.snapshot(); const panel = queries.habitatPanel(before);
    assert.equal(panel.habitats[1].eggHatchReduction, reduction);
    assert.equal(economy.eggHatchReductionSeconds(before), reduction);
    if (bank > 0) assert.equal(panel.activation.activeCounts[1], 330, "current funded production remains unchanged");
    const after = session.tick(1).snapshot;
    assert.equal(after.nursery.eggHatchDurationMs, nurseryConfig.eggHatchMs - reduction * 1000);
    assert.equal(queries.habitatPanel(after).habitats[1].eggHatchReduction, reduction);
  }
});

function fundedSave() {
  const counts = [5, 5, 5, 300, 5, 5, 5, 6000];
  return game(counts, { currencies: { seeds: 0, branches: 0, provisions: 1e6 },
    habitats: { counts, upgradeLevels: counts.map(() => 2) }, nursery: { colonyCount: 0 } }).serialize();
}

test("funded egg-income thresholds use actual gross producer output before bank depletion", () => {
  const saved = fundedSave();
  const initial = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.99 });
  const snapshot = initial.snapshot();
  const full = economy.calculateHabitatActivation(snapshot.habitats.counts, 1, snapshot.notables, snapshot.habitats.upgradeLevels, { activateAllOverCapacity: true });
  near(full.provisionsProducedPerSecond, 95.58);
  const firstEggMs = 500 / full.provisionsProducedPerSecond * 1000;
  initial.tick(firstEggMs);
  assert.equal(initial.snapshot().nursery.eggsStarted, 1);
  near(initial.snapshot().nursery.eggElapsedMs, 0);
  const live = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.99 });
  const offline = createGameSession({ save: saved, now: saved.savedAt + 200000, rng: () => 0.99 });
  for (let i = 0; i < 200; i += 1) live.tick(1000);
  offline.advanceOffline(saved.savedAt + 200000);
  const a = productionState(live.snapshot()); const b = productionState(offline.snapshot());
  for (const key of ["seeds", "branches", "provisions", "eggElapsedMs", "eggProgress"]) { near(a[key], b[key], 0.001); delete a[key]; delete b[key]; }
  assert.deepEqual(a, b);
  assert.ok(offline.snapshot().provisions > 0, "fixture is still bank-funded");
});

test("fractional production slices graduate at the exact consumed deadline and survive partial reload", () => {
  const saved = game([5, 5, 5, 11], { currencies: { seeds: 0, branches: 0, provisions: 0 },
    nursery: { colonyCount: 0, nestLevel: 2, nurseryLevel: 2,
      hatchlings: [{ id: "original-a", progressMs: 0 }, { id: "original-b", progressMs: 0 }] } }).serialize();
  const live = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.99 });
  const offline = createGameSession({ save: saved, now: saved.savedAt + 900000, rng: () => 0.99 });
  for (let i = 0; i < 900; i += 1) live.tick(1000);
  offline.advanceOffline(saved.savedAt + 900000);
  for (const session of [live, offline]) {
    assert.equal(session.snapshot().nursery.colonyCount, 2);
    assert.ok(session.snapshot().nursery.hatchlings.every((h) => !h.id.startsWith("original-")));
    const complete = session.serialize();
    const restored = createGameSession({ save: complete, now: complete.savedAt, rng: () => 0.99 });
    assert.equal(restored.snapshot().nursery.colonyCount, 2);
    restored.advanceOffline(complete.savedAt);
    assert.equal(restored.snapshot().nursery.colonyCount, 2, "repeated saved target does not accrue again");
  }
  const partial = createGameSession({ save: saved, now: saved.savedAt + 899999, rng: () => 0.99 });
  partial.advanceOffline(saved.savedAt + 899999);
  assert.equal(partial.snapshot().nursery.colonyCount, 0, "a real millisecond before the deadline remains immature");
  const checkpoint = partial.serialize();
  const restored = createGameSession({ save: checkpoint, now: checkpoint.savedAt + 1, rng: () => 0.99 });
  restored.advanceOffline(checkpoint.savedAt + 1);
  assert.equal(restored.snapshot().nursery.colonyCount, 2);
});
function assertElapsedParity(actual, expected, slices) {
  const a = productionState(actual); const b = productionState(expected);
  // Existing Seed/Branch rounding costs at most half a 4dp unit per slice.
  for (const key of ["seeds", "branches"]) { near(a[key], b[key], (slices + 100) * 0.00006); delete a[key]; delete b[key]; }
  const compare = (x, y) => {
    if (typeof x === "number") near(x, y, 1e-7);
    else if (Array.isArray(x)) { assert.equal(x.length, y.length); x.forEach((v, i) => compare(v, y[i])); }
    else if (x && typeof x === "object") { assert.deepEqual(Object.keys(x), Object.keys(y)); Object.keys(x).forEach((key) => compare(x[key], y[key])); }
    else assert.equal(x, y);
  };
  compare(a, b);
}

function advanceFrames(session, total, frame) {
  let elapsed = 0; let slices = 0;
  while (elapsed < total) { const dt = Math.min(frame, total - elapsed); session.tick(dt); elapsed += dt; slices += 1; }
  return slices;
}

test("funded depletion preserves gameplay for live frame sizes, offline and persisted elapsed slices", () => {
  const saved = fundedSave(); const total = 1202000;
  const offline = createGameSession({ save: saved, now: saved.savedAt + total, rng: () => 0.99 });
  offline.advanceOffline(saved.savedAt + total);
  const expected = offline.snapshot();
  assert.equal(expected.nursery.colonyCount, 1); assert.equal(expected.nursery.eggsStarted, 4);
  assert.equal(expected.provisions, 0, "continuous funding leaves no frame-sized reserve");
  for (const frame of [1000, 250, 33]) {
    let live = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.99 });
    const split = 200123; // Save while the bank is positive, not at a scheduler boundary.
    let slices = advanceFrames(live, split, frame);
    const checkpoint = live.serialize(); assert.ok(live.snapshot().provisions > 0);
    live = createGameSession({ save: checkpoint, now: checkpoint.savedAt, rng: () => 0.99 });
    slices += advanceFrames(live, total - split, frame);
    assertElapsedParity(live.snapshot(), expected, slices);
    const ended = live.serialize();
    const restored = createGameSession({ save: ended, now: ended.savedAt, rng: () => 0.99 });
    restored.advanceOffline(ended.savedAt);
    assertElapsedParity(restored.snapshot(), live.snapshot(), 0);
  }
  const sliced = createGameSession({ save: saved, now: saved.savedAt + 200123, rng: () => 0.99 });
  sliced.advanceOffline(saved.savedAt + 200123);
  const checkpoint = sliced.serialize();
  const restored = createGameSession({ save: checkpoint, now: checkpoint.savedAt + total - 200123, rng: () => 0.99 });
  restored.advanceOffline(saved.savedAt + total);
  assertElapsedParity(restored.snapshot(), expected, 2);
});

test("small fractional frames cannot quantize a positive reserve into different egg deadlines", () => {
  const counts = [5, 5, 5, 300, 5, 5, 5, 6000];
  const initial = local(counts); initial.provisions = 10000; initial.habitats.upgradeLevels.fill(2);
  const expected = clone(initial); economy.tickEconomy(expected, 100000, { rng: () => 0.99 });
  for (const frame of [33, 17, 7.3]) {
    const live = clone(initial); let elapsed = 0; let slices = 0;
    while (elapsed < 100000) { const dt = Math.min(frame, 100000 - elapsed); economy.tickEconomy(live, dt, { rng: () => 0.99 }); elapsed += dt; slices += 1; }
    assertElapsedParity(live, expected, slices);
  }
});

test("effective production conserves depleted reserves and shares modifiers, queries, contributions and service", () => {
  for (const power of [null, "FORAGER", "RATIONER", "PRODUCTION_INCREASE", "CONSUMPTION_REDUCTION"]) {
    for (const bank of [0, 1]) {
      const initial = local([1000, 5, 5, 1], power ? [leader(power, 0, 0.5)] : []); initial.provisions = bank;
      const plan = economy.habitatProductionPlan(initial, 1);
      const base = plan.baselineActivation; const full = plan.fullActivation;
      const surplus = base.provisionsProducedPerSecond + base.foragerProducedPerSecond - base.provisionsConsumedPerSecond;
      const deficit = full.provisionsConsumedPerSecond - full.provisionsProducedPerSecond - full.foragerProducedPerSecond;
      if (surplus > 0 && deficit > 0) {
        near(plan.depletedFullDuty, surplus / (surplus + deficit));
        near(plan.depletedActivation.provisionsProducedPerSecond + plan.depletedActivation.foragerProducedPerSecond,
          plan.depletedActivation.provisionsConsumedPerSecond);
      }
      assert.deepEqual(full.upkeepPerSnakeRates, base.upkeepPerSnakeRates);
      const whole = clone(initial); economy.tickEconomy(whole, 60000, { rng: () => 0.99 });
      const frames = clone(initial); for (let i = 0; i < 240; i += 1) economy.tickEconomy(frames, 250, { rng: () => 0.99 });
      assertElapsedParity(frames, whole, 240);
      if (deficit > 0) assert.equal(whole.provisions, 0);
      const panel = queries.habitatPanel(whole);
      const current = economy.habitatProductionPlan(whole, 1).currentActivation;
      near(panel.seedIncomePerSecond, current.incomePerSecond);
      near(queries.nurseryPanel(whole).provisionsPerSecond, current.provisionsProducedPerSecond);
      const probe = clone(whole); const before = probe.seeds;
      const output = economy.tickHabitats(probe, 1000, 1);
      near(output.income, panel.seedIncomePerSecond);
      near(probe.seeds - before, panel.seedIncomePerSecond, 0.000051);
      near(output.provisionsIncome, panel.habitats.reduce((sum, h) => sum + h.provisionRate, 0));
      near(output.foragedProvisions, panel.habitats.reduce((sum, h) => sum + h.foragerRate, 0));
      if (power) {
        near(whole.notables.retained[0].totalServiceTime, 60000);
        near(frames.notables.retained[0].totalServiceTime, 60000);
        near(probe.notables.retained[0].totalServiceTime, 61000);
        for (const [field, rate] of Object.entries(panel.habitats[0].notableEffectRates)) {
          near(probe.notables.retained[0][field] - whole.notables.retained[0][field], rate);
          near(frames.notables.retained[0][field], whole.notables.retained[0][field], 1e-7);
        }
      }
    }
  }
});

test("funding boundaries handle zero surplus, self-funded full work and nonpositive deficits without division", () => {
  const zero = local([26]); zero.provisions = 1;
  const plan = economy.habitatProductionPlan(zero, 1);
  assert.equal(plan.depletedFullDuty, 0);
  economy.tickHabitats(zero, plan.bankedSeconds * 1000 - 1, 1);
  assert.ok(zero.provisions > 0, "positive reserve persists until actual depletion");
  economy.tickHabitats(zero, 1, 1);
  near(zero.provisions, 0, 1e-12);
  economy.tickHabitats(zero, 1000, 1); assert.equal(zero.provisions, 0);
  near(economy.habitatProductionPlan(zero, 1).currentActivation.incomePerSecond,
    plan.baselineActivation.incomePerSecond);
  for (const counts of [[], [1], [26, 0, 0, 26]]) {
    const state = local(counts); const funded = economy.habitatProductionPlan(state, 1);
    assert.equal(funded.bankedSeconds, Infinity);
    assert.equal(funded.currentActivation, funded.fullActivation);
    assert.equal(funded.depletedFullDuty, 0);
    const net = funded.fullActivation.provisionsProducedPerSecond + funded.fullActivation.foragerProducedPerSecond - funded.fullActivation.provisionsConsumedPerSecond;
    assert.ok(net >= 0);
    economy.tickHabitats(state, 1000, 1); near(state.provisions, net);
  }
});

test("depletion just before, at and after incubation/graduation boundaries does not stall or repeat credits", () => {
  for (const depletionMs of [999, 1000, 1001]) {
    const initial = local([5, 330, 5, 1], [leader("RATIONER")]); initial.habitats.upgradeLevels[1] = 9;
    const full = economy.habitatProductionPlan(initial, 1).fullActivation;
    const deficit = full.provisionsConsumedPerSecond - full.provisionsProducedPerSecond - full.foragerProducedPerSecond;
    initial.provisions = deficit * depletionMs / 1000;
    initial.nursery = economy.createNursery({ colonyCount: 0, eggProgress: 500,
      eggElapsedMs: 299000, eggHatchDurationMs: 300000,
      hatchlings: [{ id: "a", progressMs: 899000 }, { id: "b", progressMs: 899000 }] }, 0);
    const expected = clone(initial); economy.tickEconomy(expected, 2000, { rng: () => 0.99 });
    const live = clone(initial); let elapsed = 0; let slices = 0;
    while (elapsed < 2000) { const dt = Math.min(137, 2000 - elapsed); economy.tickEconomy(live, dt, { rng: () => 0.99 }); elapsed += dt; slices += 1; }
    assertElapsedParity(live, expected, slices);
    assert.equal(expected.nursery.colonyCount, 2);
    assert.equal(expected.provisions, 0);
    near(expected.notables.retained[0].totalServiceTime, 2000);
    const unchanged = productionState(expected);
    economy.tickEconomy(expected, 0, { rng: () => 0.99 });
    assert.deepEqual(productionState(expected), unchanged, "zero elapsed time never repeats nursery credits");
    assert.ok(Number.isFinite(live.provisions) && live.provisions >= 0);
    assert.equal(economy.nestUpgradeCost(0), nurseryConfig.upgrades.nest.branchBaseCost);
    const cost = economy.nurseryUpgradeCost(0);
    assert.equal(cost.seeds, nurseryConfig.upgrades.nursery.seedBaseCost);
    assert.equal(cost.branches, nurseryConfig.upgrades.nursery.branchBaseCost);
    for (const habitat of habitatConfig.habitats) assert.equal(economy.habitatUpgradeCost(habitat, 0), habitat.upgradeCost);
  }
});
