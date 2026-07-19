const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("./config.js");
const notables = require("./notables.js");
const economy = require("./economy.js");
const sessionApi = require("./session.js");
const snake = require("./snake.js");

function rngSequence(values, fallback = 0.5) { let index = 0; return () => values[index++] ?? fallback; }
function baseNotable(overrides = {}) {
  return { id: "n1", name: "Reed", epithet: "", createdAt: 1, sourceType: "TEST", sourceReference: "", powerType: "PRODUCTION_INCREASE", powerMagnitude: 0.5, status: "INACTIVE", assignedHabitatId: null, hasServed: false, habitatsServed: [], totalServiceTime: 0, totalProductionAdded: 0, totalConsumptionPrevented: 0, totalCapacityEnabled: 0, totalProvisionsForaged: 0, totalShortageOutputPreserved: 0, retiredAt: null, lastAssignedHabitatId: null, ...overrides };
}
function notableState(items = []) { return notables.createState({ retained: items, nextId: items.length + 1 }); }
function save(overrides = {}) {
  return { saveVersion: sessionApi.SAVE_VERSION, savedAt: 0, session: { mode: "snake", phase: "ready", seeds: 0, provisions: 0, best: 1000, upgrades: {}, selectedBoardLevel: 0, nursery: { colonyCount: 500 }, habitats: { counts: [1, 0, 0, 0, 0, 0, 0, 0] }, notables: {}, ...overrides } };
}

test("capacity is one plus active habitats and can shrink without deletion", () => {
  const state = notableState([baseNotable(), baseNotable({ id: "n2" }), baseNotable({ id: "n3" })]);
  assert.equal(notables.capacity(state, [1, 0, 2]), 3);
  assert.equal(notables.capacity(state, [0, 0, 0]), 1);
  assert.equal(notables.rosterOverCapacity(state, [0, 0, 0]), true);
  assert.equal(state.retained.length, 3);
});

test("every board has an explicit stable mastery id and reachable configured score", () => {
  assert.equal(config.boardMasteryConfig.length, config.upgradeConfig.board.levels.length);
  config.boardMasteryConfig.forEach((entry) => {
    assert.ok(entry.masteryId); assert.equal(entry.masteryScore, snake.masteryScore(snake.parseGridSize(entry.boardSize)));
  });
});

test("weighted generation is stable and queues at capacity", () => {
  const state = notableState([baseNotable()]);
  const generated = notables.generate(state, { type: "TEST", reference: "Board" }, rngSequence([0, 0, 0, 0]), 100, []);
  assert.equal(generated.notable.powerType, "PRODUCTION_INCREASE");
  assert.equal(generated.notable.powerMagnitude, 0.15);
  assert.equal(state.pending.length, 1);
  const restored = notables.createState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.pending[0], state.pending[0]);
});

test("Forager eligibility and one leader per habitat are enforced", () => {
  const forager = baseNotable({ powerType: "FORAGER", powerMagnitude: 0.1 });
  const producer = baseNotable({ id: "n2" });
  const state = notableState([forager, producer]);
  assert.equal(notables.assign(state, "n1", 3, config.habitatConfig.habitats, [1, 1, 1, 1]).accepted, false);
  assert.equal(notables.assign(state, "n1", 1, config.habitatConfig.habitats, [1, 1, 1]).accepted, false);
  assert.equal(notables.assign(state, "n1", 0, config.habitatConfig.habitats, [1]).accepted, true);
  assert.equal(notables.assign(state, "n2", 0, config.habitatConfig.habitats, [1]).accepted, true);
  assert.equal(state.retained.find((item) => item.id === "n1").status, "INACTIVE");
});

test("capacity powers floor correctly and always add at least one", () => {
  const field = config.habitatConfig.habitats[0];
  [0.1, 0.2, 0.35, 0.5, 0.75].forEach((magnitude) => assert.equal(notables.hardCapacity(field, baseNotable({ powerType: "CAPACITY_INCREASE", powerMagnitude: magnitude })), Math.floor(50 * (1 + magnitude))));
  assert.equal(notables.hardCapacity({ naturalCapacity: 1 }, baseNotable({ powerType: "CAPACITY_INCREASE", powerMagnitude: 0.1 })), 2);
});

test("pending replacement archives served leaders and dismisses unused leaders", () => {
  const served = baseNotable({ hasServed: true, assignedHabitatId: 0, status: "ASSIGNED" });
  const state = notableState([served]);
  notables.generate(state, { type: "TEST" }, rngSequence([0, 0, 0, 0]), 2, []);
  assert.equal(notables.resolvePending(state, "REPLACE", "n1", 3, []).accepted, true);
  assert.equal(state.elders.length, 1); assert.equal(state.elders[0].status, "ELDER");
  const unused = notableState([baseNotable()]);
  notables.generate(unused, { type: "TEST" }, rngSequence([0, 0, 0, 0]), 2, []);
  notables.resolvePending(unused, "REPLACE", "n1", 3, []);
  assert.equal(unused.elders.length, 0); assert.equal(unused.dismissedCount, 1);
});

test("production, Forager, and contribution tracking use final recurring output", () => {
  const leader = baseNotable({ status: "ASSIGNED", assignedHabitatId: 0, powerType: "PRODUCTION_INCREASE", powerMagnitude: 0.5 });
  const state = { seeds: 0, provisions: 0, upgrades: { foodTypeLevel: 0 }, nursery: economy.createNursery({}, 0), habitats: economy.createHabitats({ counts: [1] }), notables: notableState([leader]) };
  economy.tickHabitats(state, 1000, 1);
  assert.equal(state.seeds, 0.0075);
  assert.equal(state.notables.retained[0].totalProductionAdded, 0.0025);
  assert.equal(state.notables.retained[0].hasServed, true);
  state.notables.retained[0] = baseNotable({ status: "ASSIGNED", assignedHabitatId: 0, powerType: "FORAGER", powerMagnitude: 0.1 });
  state.seeds = 0; state.provisions = 0;
  economy.tickHabitats(state, 1000, 1);
  assert.equal(state.seeds, 0.005); assert.equal(state.provisions, 0.0005);
  assert.equal(state.notables.retained[0].totalProvisionsForaged, 0.0005);
});

test("Rationer preserves unsupported output without creating provisions", () => {
  [0.25, 0.5, 0.75].forEach((floor) => {
    const leader = baseNotable({ status: "ASSIGNED", assignedHabitatId: 0, powerType: "RATIONER", powerMagnitude: floor });
    const activation = economy.calculateHabitatActivation([26], 1, notableState([leader]));
    assert.equal(activation.idleCounts[0], 1);
    assert.equal(activation.habitatSeedOutputs[0], (25 + floor) * activation.perSnakeRates[0]);
    assert.equal(activation.foragerProducedPerSecond, 0);
  });
});

test("session direct recruitment is atomic and persists its generated result", () => {
  const game = sessionApi.createGameSession({ save: save(), now: 10, rng: rngSequence([0, 0, 0, 0]) });
  const result = game.dispatch({ type: "recruitNotable", now: 10 });
  assert.equal(result.snapshot.nursery.colonyCount, 350);
  assert.equal(result.snapshot.notables.directRecruitmentsCompleted, 1);
  const restored = sessionApi.createGameSession({ save: game.serialize(), now: 10, rng: () => 0.99 }).snapshot();
  assert.deepEqual(restored.notables.retained, result.snapshot.notables.retained);
});

test("session rejects recruitment below cost and placement above hard capacity", () => {
  const game = sessionApi.createGameSession({ save: save({ nursery: { colonyCount: 149 }, habitats: { counts: [50] } }), now: 1, rng: () => 0.5 });
  assert.equal(game.dispatch({ type: "recruitNotable" }).events.at(-1).reason, "insufficientColonySnakes");
  assert.equal(game.dispatch({ type: "placeHabitat", index: 0 }).events.at(-1).reason, "habitatOverCapacity");
});

test("each first-time placement makes one generation roll", () => {
  let calls = 0; const game = sessionApi.createGameSession({ save: save({ habitats: { counts: [] } }), now: 1, rng: () => { calls += 1; return 0.5; } });
  calls = 0; game.dispatch({ type: "placeHabitat", index: 0 });
  assert.equal(calls, 1);
});

test("batch placement can create multiple persistent candidates in order", () => {
  const game = sessionApi.createGameSession({ save: save({ habitats: { counts: [] } }), now: 1, rng: rngSequence(Array(40).fill(0)) });
  const result = game.dispatch({ type: "placeHabitat", index: 0, count: 4, now: 1 });
  assert.equal(result.snapshot.nursery.colonyCount, 496);
  assert.deepEqual(result.snapshot.notables.retained.map((item) => item.id), ["notable-1", "notable-2"]);
  assert.deepEqual(result.snapshot.notables.pending.map((item) => item.id), ["notable-3", "notable-4"]);
  const restored = sessionApi.createGameSession({ save: game.serialize(), now: 1, rng: () => 0.99 }).snapshot();
  assert.deepEqual(restored.notables.pending.map((item) => item.id), ["notable-3", "notable-4"]);
});

test("consumption reduction lowers recurring costs but never below zero", () => {
  const leader = baseNotable({ status: "ASSIGNED", assignedHabitatId: 0, powerType: "CONSUMPTION_REDUCTION", powerMagnitude: 0.5 });
  const reduced = economy.calculateHabitatActivation([26, 0, 1], 1, notableState([leader]));
  const plain = economy.calculateHabitatActivation([26, 0, 1], 1, notableState());
  assert.ok(reduced.provisionsConsumedPerSecond >= 0);
  assert.equal(reduced.provisionsConsumedPerSecond, plain.provisionsConsumedPerSecond * 0.5);
});

test("removing a capacity leader leaves population intact and marks over capacity", () => {
  const capacityLeader = baseNotable({ status: "ASSIGNED", assignedHabitatId: 0, powerType: "CAPACITY_INCREASE", powerMagnitude: 0.1 });
  const game = sessionApi.createGameSession({ save: save({ habitats: { counts: [52] }, notables: { retained: [capacityLeader] } }), now: 1, rng: () => 0.5 });
  assert.equal(game.snapshot().habitatOverCapacity[0], false);
  const result = game.dispatch({ type: "unassignNotable", notableId: "n1" });
  assert.equal(result.snapshot.habitats.counts[0], 52);
  assert.equal(result.snapshot.habitatOverCapacity[0], true);
});

test("retiring or dismissing a retained notable immediately promotes the first pending candidate", () => {
  const retained = baseNotable({ id: "kept" });
  const firstPending = baseNotable({ id: "waiting-1", status: "PENDING" });
  const secondPending = baseNotable({ id: "waiting-2", status: "PENDING" });
  const game = sessionApi.createGameSession({ save: save({ notables: { retained: [retained], pending: [firstPending, secondPending] }, habitats: { counts: [] } }), now: 1, rng: () => 0.5 });
  const result = game.dispatch({ type: "dismissNotable", notableId: "kept", now: 2 });
  assert.deepEqual(result.snapshot.notables.retained.map((item) => item.id), ["waiting-1"]);
  assert.equal(result.snapshot.notables.retained[0].status, "INACTIVE");
  assert.deepEqual(result.snapshot.notables.pending.map((item) => item.id), ["waiting-2"]);
  assert.ok(result.events.some((item) => item.type === "NOTABLE_RETAINED" && item.fromPending));
});
