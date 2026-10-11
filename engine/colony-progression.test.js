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
  near(reducer.provisions, economy.roundSeeds(1 - oldBase * 0.5 * 0.5));
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
