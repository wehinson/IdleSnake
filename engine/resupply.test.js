const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const resupply = require("./resupply.js");
const { resupplyConfig, historyRetentionConfig } = require("./config.js");

function localEconomy(overrides = {}) {
  return { seeds: 100_000, branches: 10_000, provisions: 10_000, nursery: { colonyCount: 50, nestEggs: [{}, {}] }, habitats: {}, notables: { retained: [{ id: "notable-1", name: "Reed", status: "ASSIGNED", assignedHabitatId: 0 }] }, ...overrides };
}
function game() {
  const source = localEconomy(); const destination = localEconomy({ nursery: { colonyCount: 20 }, notables: {} });
  return createGameSession({ save: { savedAt: 1, currencies: source, nursery: source.nursery, habitats: source.habitats, notables: source.notables, migration: { activeSettlementId: "grasslands", settlements: [
    { id: "grasslands", name: "Grasslands", status: "established", economy: source },
    { id: "wetlands", name: "Wetlands", status: "established", economy: destination }
  ] } }, now: 1, rng: () => 0.5 });
}
function routeWithWorkers(session, workers = 2) {
  session.dispatch({ type: "createTradeRoute", settlementAId: "grasslands", settlementBId: "wetlands" }); const routeId = session.snapshot().tradeRoutes[0].id;
  session.dispatch({ type: "setTradeWorkers", routeId, direction: "AToB", workersAssigned: workers }); return routeId;
}

test("completed Re-Supply history is capped without losing lifetime cargo totals", () => {
  const limit = historyRetentionConfig.completedResupplyMissions;
  const completedResupplyMissions = Array.from({ length: limit + 8 }, (_, index) => ({
    id: `resupply-${index + 1}`, notableIds: [`notable-${index}`], adultCount: 2, eggCount: 3, provisionsConsumed: 4
  }));
  const state = { tradeRoutes: [], migration: { settlements: [] } };
  const restored = resupply.createState({ completedResupplyMissions, resupplyTotals: { completedMissions: 100 } }, state);

  assert.equal(restored.completedResupplyMissions.length, limit);
  assert.equal(restored.completedResupplyMissions[0].id, "resupply-9");
  assert.deepEqual(restored.resupplyTotals, {
    completedMissions: 100,
    notablesDelivered: limit + 8,
    adultsDelivered: (limit + 8) * 2,
    eggsDelivered: (limit + 8) * 3,
    provisionsConsumed: (limit + 8) * 4
  });
  assert.equal(restored.nextResupplyMissionId, limit + 9);
});

test("Re-Supply requires a staffed direction and eligible Notable, then safely delivers cargo offline", () => {
  const session = game(); const routeId = routeWithWorkers(session);
  const departed = session.dispatch({ type: "dispatchResupply", routeId, direction: "AToB", notableIds: ["notable-1"], adultCount: 3, eggCount: 2 });
  assert.equal(departed.events[0].type, "resupplyDeparted");
  let snapshot = departed.snapshot; const mission = snapshot.activeResupplyMissions[0];
  assert.equal(mission.baseProvisionRequirement, 270); assert.equal(mission.provisionsConsumed, 270);
  assert.equal(snapshot.migration.settlements[0].economy.notables.retained.length, 0);
  assert.equal(snapshot.migration.settlements[0].economy.nursery.colonyCount, 45); assert.equal(snapshot.tradeRoutes[0].directionAToB.resupplyMissionId, mission.id);
  assert.equal(session.dispatch({ type: "setTradeWorkers", routeId, direction: "AToB", workersAssigned: 1 }).events[0].reason, "resupplyDirectionOccupied");
  session.advanceOffline(mission.arrivalTime); snapshot = session.snapshot(); const destination = snapshot.migration.settlements.find((item) => item.id === "wetlands").economy;
  assert.equal(snapshot.activeResupplyMissions.length, 0); assert.equal(snapshot.completedResupplyMissions.length, 1); assert.equal(snapshot.tradeRoutes[0].directionAToB.resupplyMissionId, null);
  assert.deepEqual(snapshot.resupplyTotals, { completedMissions: 1, notablesDelivered: 1, adultsDelivered: 3, eggsDelivered: 2, provisionsConsumed: mission.provisionsConsumed });
  assert.equal(destination.notables.retained[0].id, "notable-1"); assert.equal(destination.nursery.colonyCount, 23); assert.equal(destination.nursery.nestEggs.length + destination.nursery.resupplyEggHolding, 2);
});

test("Re-Supply costs and time use only the selected direction's upgrades and workers", () => {
  const base = { capacityLevel: 0, speedLevel: 0, efficiencyLevel: 0, workerCapLevel: 0, workersAssigned: 1 };
  const upgraded = { ...base, capacityLevel: 1, speedLevel: 2, efficiencyLevel: 1, workerCapLevel: 3, workersAssigned: 5 };
  assert.equal(resupply.baseProvisionRequirement(2, 8, 12), 720);
  assert.ok(resupply.routeDiscount(upgraded) > resupply.routeDiscount(base)); assert.ok(resupply.provisionRequirement(2, 8, 12, upgraded) < 720);
  assert.ok(resupply.travelDuration(upgraded) < resupply.travelDuration(base)); assert.ok(resupply.travelDuration(upgraded) >= resupplyConfig.resupplyMinimumTravelSeconds * 1000);
});

test("an in-transit Re-Supply mission persists its cargo and remains direction-locked after reload", () => {
  const session = game(); const routeId = routeWithWorkers(session, 1);
  session.dispatch({ type: "dispatchResupply", routeId, direction: "AToB", notableIds: ["notable-1"], adultCount: 1, eggCount: 0 });
  const restored = createGameSession({ save: session.serialize(), now: 1, rng: () => 0.5 }); const mission = restored.snapshot().activeResupplyMissions[0];
  assert.equal(mission.notables[0].id, "notable-1"); assert.equal(restored.snapshot().migration.settlements[0].economy.notables.retained.length, 0);
  assert.equal(restored.dispatch({ type: "purchaseTradeUpgrade", routeId, direction: "AToB", upgradeType: "capacity" }).events[0].reason, "resupplyDirectionOccupied");
});
