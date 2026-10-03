const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const { nurseryConfig } = require("./config.js");

const clone = (value) => JSON.parse(JSON.stringify(value));

function largeSettlementSave() {
  const save = createGameSession({ now: 0, rng: () => 0.5 }).serialize();
  const home = save.session.migration.settlements[0];
  home.economy.seeds = 1e7;
  home.economy.branches = 1e7;
  home.economy.provisions = 1e7;
  home.economy.nursery.colonyCount = 100;
  home.economy.nursery.nurseryLevel = 100;
  home.economy.nursery.eggElapsedMs = 299950;
  home.economy.nursery.eggHatchDurationMs = 300000;
  home.economy.nursery.hatchlings = Array.from({ length: 64 }, (_, index) => ({
    id: `hatchling-${index}`, x: 2, y: 4, direction: "right", progressMs: 0, tailWiggle: false, temporary: false
  }));
  home.economy.nursery.nestEggs = Array.from({ length: 64 }, () => ({ elapsedMs: 0, hatchDurationMs: 60000 }));
  home.economy.notables.retained = [{ id: "notable-1", name: "Courier", status: "INACTIVE", assignedHabitatId: null }];
  const remote = clone(home);
  remote.id = "wetlands";
  remote.name = "Wetlands";
  remote.region = "Wetlands";
  save.session.migration.settlements = [home, remote];
  return save;
}

test("settlement economy normalization survives capped nursery data and cross-settlement delivery", () => {
  const game = createGameSession({ save: largeSettlementSave(), now: 0, rng: () => 0.5 });
  assert.equal(game.snapshot().migration.settlements[0].economy.nursery.hatchlings.length, 64);
  assert.equal(game.snapshot().migration.settlements[0].economy.nursery.nestEggs.length, 64);

  game.tick(100);
  assert.equal(game.snapshot().migration.settlements[1].economy.nursery.hatchlings.length, 65);
  game.tick(100);
  assert.equal(game.snapshot().migration.settlements[1].economy.nursery.hatchlings.length, 64);

  assert.equal(game.dispatch({ type: "createTradeRoute", settlementAId: "grasslands", settlementBId: "wetlands", now: 0 }).events.at(-1).type, "tradeRouteCreated");
  const routeId = game.snapshot().tradeRoutes[0].id;
  game.dispatch({ type: "configureTradeDirection", routeId, direction: "AToB", resourceType: "seeds", shipmentTarget: 100, reserveThreshold: 0, now: 0 });
  game.dispatch({ type: "setTradeWorkers", routeId, direction: "AToB", workersAssigned: 1, now: 0 });
  game.dispatch({ type: "dispatchResupply", routeId, direction: "AToB", notableIds: ["notable-1"], adultCount: 1, eggCount: 1, now: 0 });
  game.advanceOffline(nurseryConfig.growthMs);

  const settlements = game.snapshot().migration.settlements;
  for (const settlement of settlements) {
    assert.ok(settlement.economy.nursery.hatchlings.length <= 64);
    assert.ok(settlement.economy.nursery.nestEggs.length <= 64);
    assert.ok(settlement.economy.nursery.hatchlings.every((item) => item.progressMs >= 0 && item.progressMs <= nurseryConfig.growthMs));
    assert.ok(settlement.economy.notables.retained.every((item) => item.status));
  }
});

test("inactive colony totals retain the existing normalization limit after graduation", () => {
  const save = largeSettlementSave();
  const remote = save.session.migration.settlements[1].economy;
  remote.nursery.colonyCount = Number.MAX_SAFE_INTEGER;
  remote.nursery.seedTickAccumulatorMs = nurseryConfig.seedIntervalMs - 50;
  remote.nursery.hatchlings.forEach((item) => { item.progressMs = nurseryConfig.growthMs - 50; });
  const game = createGameSession({ save, now: 0, rng: () => 0.5 });
  game.tick(100);
  assert.ok(game.snapshot().migration.settlements[1].economy.nursery.colonyCount > Number.MAX_SAFE_INTEGER);
  game.tick(100);
  assert.equal(game.snapshot().migration.settlements[1].economy.nursery.colonyCount, Number.MAX_SAFE_INTEGER);
});

test("the first live tick after a long idle step keeps the nursery movement limit", () => {
  const save = largeSettlementSave();
  // Keep hatchlings young enough to remain in the nursery after the idle step.
  const game = createGameSession({ save, now: 0, rng: () => 0.5 });
  game.advanceOffline(30000);
  const inactive = () => game.snapshot().migration.settlements[1].economy.nursery;
  assert.ok(inactive().movementAccumulatorMs > 430);
  game.tick(16);
  assert.equal(inactive().movementAccumulatorMs, 16);
});
