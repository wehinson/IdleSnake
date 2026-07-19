const test = require("node:test");
const assert = require("node:assert/strict");
const trade = require("./trade-routes.js");
const { tradeRouteConfig } = require("./config.js");
const { createGameSession, SAVE_VERSION } = require("./session.js");

function economy(overrides = {}) {
  return { seeds: 100_000, branches: 10_000, provisions: 10_000, nursery: { colonyCount: 50 }, habitats: {}, notables: {}, ...overrides };
}
function state(overrides = {}) {
  return {
    migration: { settlements: [
      { id: "grasslands", name: "Grasslands", status: "established", economy: economy() },
      { id: "wetlands", name: "Wetlands", status: "established", economy: economy() },
      { id: "founding", name: "Founding", status: "founding", economy: economy() }
    ] },
    tradeRoutes: [], nextTradeRouteId: 1, ...overrides
  };
}
function create(s, now = 1000) {
  const out = trade.createRoute(s, { settlementAId: "wetlands", settlementBId: "grasslands" }, now);
  assert.equal(out.accepted, true); return s.tradeRoutes[0];
}

test("construction is canonical, atomic, locally funded, and rejects ineligible pairs", () => {
  const s = state(); const cost = trade.constructionCost(); const route = create(s);
  assert.equal(route.settlementAId, "grasslands"); assert.equal(route.settlementBId, "wetlands");
  assert.equal(s.migration.settlements[0].economy.seeds, 100_000 - cost.seeds);
  assert.equal(s.migration.settlements[1].economy.branches, 10_000 - cost.branches);
  assert.equal(trade.createRoute(s, { settlementAId: "grasslands", settlementBId: "wetlands" }, 2).reason, "tradeRouteExists");
  assert.equal(trade.createRoute(s, { settlementAId: "grasslands", settlementBId: "founding" }, 2).reason, "settlementNotEstablished");
  const poor = state(); poor.migration.settlements[1].economy.seeds = 0; const before = poor.migration.settlements[0].economy.seeds;
  assert.equal(trade.createRoute(poor, { settlementAId: "grasslands", settlementBId: "wetlands" }, 2).reason, "insufficientRouteContribution");
  assert.equal(poor.migration.settlements[0].economy.seeds, before);
});

test("directions configure, staff, schedule, pause, and resume independently", () => {
  const s = state(); const route = create(s); const now = 5000;
  trade.configureDirection(s, { routeId: route.id, direction: "AToB", resourceType: "seeds", shipmentTarget: 100, reserveThreshold: 50 }, now);
  assert.equal(route.directionAToB.nextShipmentAt, null);
  trade.setWorkers(s, { routeId: route.id, direction: "AToB", workersAssigned: 2 }, now);
  assert.equal(s.migration.settlements[0].economy.nursery.colonyCount, 48);
  assert.equal(route.directionAToB.nextShipmentAt, now + trade.interval(route.directionAToB));
  assert.equal(route.directionBToA.workersAssigned, 0); assert.equal(route.directionBToA.nextShipmentAt, null);
  trade.setDirectionPaused(s, { routeId: route.id, direction: "AToB", isPaused: true }, now + 1);
  assert.equal(route.directionAToB.nextShipmentAt, null);
  trade.setDirectionPaused(s, { routeId: route.id, direction: "AToB", isPaused: false }, now + 2);
  assert.equal(route.directionAToB.nextShipmentAt, now + 2 + trade.interval(route.directionAToB));
  trade.setRoutePaused(s, { routeId: route.id, isPaused: true }, now + 3); assert.equal(route.directionAToB.nextShipmentAt, null);
  trade.setRoutePaused(s, { routeId: route.id, isPaused: false }, now + 4); assert.equal(route.directionAToB.nextShipmentAt, now + 4 + trade.interval(route.directionAToB));
});

test("workers are source-local, capped, recalled, and returned by dismantling", () => {
  const s = state(); const route = create(s); const base = s.migration.settlements.map((x) => x.economy.nursery.colonyCount);
  assert.equal(trade.setWorkers(s, { routeId: route.id, direction: "AToB", workersAssigned: 6 }, 0).reason, "tradeWorkerLimitExceeded");
  trade.setWorkers(s, { routeId: route.id, direction: "AToB", workersAssigned: 3 }, 0);
  trade.setWorkers(s, { routeId: route.id, direction: "BToA", workersAssigned: 2 }, 0);
  assert.equal(s.migration.settlements[0].economy.nursery.colonyCount, base[0] - 3);
  assert.equal(s.migration.settlements[1].economy.nursery.colonyCount, base[1] - 2);
  trade.setWorkers(s, { routeId: route.id, direction: "AToB", workersAssigned: 1 }, 0);
  assert.equal(s.migration.settlements[0].economy.nursery.colonyCount, base[0] - 1);
  trade.dismantleRoute(s, { routeId: route.id });
  assert.equal(s.tradeRoutes.length, 0); assert.deepEqual(s.migration.settlements.slice(0, 2).map((x) => x.economy.nursery.colonyCount), base.slice(0, 2));
});

test("capacity, speed, efficiency, and worker-cap upgrades are directional and source-funded", () => {
  const s = state(); const route = create(s); const source = s.migration.settlements[0].economy; const reverse = route.directionBToA;
  for (const type of ["capacity", "speed", "efficiency", "workerCap"]) {
    const before = { seeds: source.seeds, branches: source.branches }; const cost = trade.upgradeCost(type, 0);
    const result = trade.purchaseUpgrade(s, { routeId: route.id, direction: "AToB", upgradeType: type }); assert.equal(result.accepted, true);
    assert.equal(source.seeds, before.seeds - cost.seeds); assert.equal(source.branches, before.branches - cost.branches);
  }
  assert.equal(route.directionAToB.capacityLevel, 1); assert.equal(route.directionAToB.speedLevel, 1);
  assert.equal(route.directionAToB.efficiencyLevel, 1); assert.equal(route.directionAToB.workerCapLevel, 1);
  assert.equal(route.directionAToB.maxWorkers, tradeRouteConfig.direction.baseMaximumWorkers + 1);
  assert.equal(reverse.capacityLevel + reverse.speedLevel + reverse.efficiencyLevel + reverse.workerCapLevel, 0);
});

test("shipments enforce reserve, capacity, partial amounts, and directional efficiency", () => {
  const s = state(); const route = create(s, 0); const a = s.migration.settlements[0].economy; const b = s.migration.settlements[1].economy;
  a.seeds = 240; b.seeds = 0;
  trade.configureDirection(s, { routeId: route.id, direction: "AToB", resourceType: "seeds", shipmentTarget: 500, reserveThreshold: 175 }, 0);
  trade.setWorkers(s, { routeId: route.id, direction: "AToB", workersAssigned: 1 }, 0);
  const due = route.directionAToB.nextShipmentAt; const result = trade.resolveDue(s, due);
  assert.equal(result.events[0].sent, 65); assert.equal(result.events[0].delivered, 52);
  assert.equal(a.seeds, 175); assert.equal(b.seeds, 52); assert.equal(route.directionAToB.lifetimeShipments, 1);
  assert.equal(route.directionAToB.lifetimeResourceSent, 65); assert.equal(route.directionAToB.lifetimeResourceDelivered, 52);
  const second = trade.resolveDue(s, route.directionAToB.nextShipmentAt); assert.equal(second.events[0].type, "tradeShipmentSkipped");
  assert.equal(route.directionAToB.lifetimeShipments, 2);
});

test("normalization accepts legacy arrays, removes duplicates, and repairs derived values", () => {
  const normalized = trade.createState([
    { id: "trade-route-7", settlementAId: "wetlands", settlementBId: "grasslands", directionAToB: { workersAssigned: 99, workerCapLevel: 2, resourceType: "bad" } },
    { settlementAId: "grasslands", settlementBId: "wetlands" }
  ]);
  assert.equal(normalized.tradeRoutes.length, 1); assert.equal(normalized.nextTradeRouteId, 8);
  const route = normalized.tradeRoutes[0]; assert.equal(route.settlementAId, "grasslands"); assert.equal(route.directionBToA.resourceType, "seeds");
  assert.equal(route.directionBToA.maxWorkers, trade.maximumWorkers(2));
});

test("simultaneous competing routes resolve in stable route and direction order", () => {
  const s = state(); s.migration.settlements[2].status = "established"; s.migration.settlements[2].id = "woodlands";
  const first = create(s, 0); const secondResult = trade.createRoute(s, { settlementAId: "grasslands", settlementBId: "woodlands" }, 0); assert.equal(secondResult.accepted, true);
  const second = s.tradeRoutes[1]; s.migration.settlements[0].economy.seeds = 150; s.migration.settlements[1].economy.seeds = 0; s.migration.settlements[2].economy.seeds = 0;
  for (const route of [first, second]) { trade.configureDirection(s, { routeId: route.id, direction: "AToB", resourceType: "seeds", shipmentTarget: 100, reserveThreshold: 0 }, 0); trade.setWorkers(s, { routeId: route.id, direction: "AToB", workersAssigned: 1 }, 0); }
  const due = first.directionAToB.nextShipmentAt; const result = trade.resolveDue(s, due);
  assert.deepEqual(result.events.map((item) => [item.routeId, item.sent]), [[first.id, 100], [second.id, 50]]);
  assert.equal(s.migration.settlements[1].economy.seeds, 80); assert.equal(s.migration.settlements[2].economy.seeds, 40);
});

test("session actions round-trip routes and tick every established settlement", () => {
  const local = economy({ habitats: { counts: [1], upgradeLevels: [] } });
  const remote = economy({ habitats: { counts: [1], upgradeLevels: [] } });
  const game = createGameSession({ save: {
    savedAt: 1, currencies: { seeds: local.seeds, branches: local.branches, provisions: local.provisions }, nursery: local.nursery,
    habitats: local.habitats, notables: local.notables,
    migration: { activeSettlementId: "grasslands", settlements: [
      { id: "grasslands", name: "Grasslands", status: "established", economy: local },
      { id: "wetlands", name: "Wetlands", status: "established", economy: remote }
    ] }
  }, now: 1, rng: () => 0.5 });
  assert.equal(game.dispatch({ type: "createTradeRoute", settlementAId: "grasslands", settlementBId: "wetlands", now: 1 }).events.at(-1).type, "tradeRouteCreated");
  const routeId = game.snapshot().tradeRoutes[0].id;
  game.dispatch({ type: "configureTradeDirection", routeId, direction: "AToB", resourceType: "seeds", shipmentTarget: 100, reserveThreshold: 0, now: 1 });
  game.dispatch({ type: "setTradeWorkers", routeId, direction: "AToB", workersAssigned: 1, now: 1 });
  const before = game.snapshot(); game.tick(1000); const after = game.snapshot();
  assert.ok(after.seeds > before.seeds);
  const remoteAfter = after.migration.settlements.find((item) => item.id === "wetlands");
  assert.ok(remoteAfter.economy.seeds > remote.seeds - trade.constructionCost().seeds);
  const restored = createGameSession({ save: game.serialize(), now: 1001, rng: () => 0.5 });
  assert.equal(restored.snapshot().saveVersion, SAVE_VERSION); assert.equal(restored.snapshot().tradeRoutes[0].id, routeId);
});

test("offline session progression resolves multiple scheduled shipments", () => {
  const game = createGameSession({ save: {
    savedAt: 1, currencies: { seeds: 100_000, branches: 10_000, provisions: 0 }, nursery: { colonyCount: 50 }, habitats: {}, notables: {},
    migration: { activeSettlementId: "grasslands", settlements: [
      { id: "grasslands", name: "Grasslands", status: "established", economy: economy() },
      { id: "wetlands", name: "Wetlands", status: "established", economy: economy() }
    ] }
  }, now: 1, rng: () => 0.5 });
  game.dispatch({ type: "createTradeRoute", settlementAId: "grasslands", settlementBId: "wetlands", now: 1 }); const routeId = game.snapshot().tradeRoutes[0].id;
  game.dispatch({ type: "configureTradeDirection", routeId, direction: "AToB", resourceType: "seeds", shipmentTarget: 100, reserveThreshold: 0, now: 1 });
  game.dispatch({ type: "setTradeWorkers", routeId, direction: "AToB", workersAssigned: 1, now: 1 });
  game.advanceOffline(1 + 3 * tradeRouteConfig.direction.baseShipmentIntervalMs);
  const route = game.snapshot().tradeRoutes[0]; const destination = game.snapshot().migration.settlements.find((item) => item.id === "wetlands");
  assert.equal(route.directionAToB.lifetimeShipments, 3); assert.equal(route.directionAToB.lifetimeResourceSent, 300);
  assert.equal(destination.economy.seeds, 100_000 - trade.constructionCost().seeds + 240);
});
