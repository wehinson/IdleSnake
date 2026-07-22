const test = require("node:test");
const assert = require("node:assert/strict");
const migration = require("./migration.js");
const { migrationConfig, historyRetentionConfig } = require("./config.js");
const { createGameSession } = require("./session.js");

function sequence(values, fallback = 0) { let index = 0; return () => index < values.length ? values[index++] : fallback; }
function notable(id, experience = 0) { return { id, name: `Leader ${id}`, status: "INACTIVE", totalServiceTime: experience * 60000 }; }
function saveForMigration(overrides = {}) {
  return {
    savedAt: 1,
    currencies: { seeds: 5000, branches: 500, provisions: 10000 },
    nursery: { colonyCount: 500, nestEggs: Array.from({ length: 20 }, () => ({ elapsedMs: 0, hatchDurationMs: 300000 })) },
    habitats: { counts: [] },
    notables: { retained: [notable("n1", 1000), notable("n2", 500)], elders: [], pending: [], nextId: 3 },
    migration: { availablePoints: 10000, totalEarned: 10000, totalSpent: 0 },
    ...overrides
  };
}
function departure(game, extra = {}) {
  return game.dispatch({ type: "startMigration", originSettlementId: "grasslands", destination: "Wetlands", notableId: "n1", manifest: { adults: 20, eggs: 2, seeds: 100, branches: 20, provisions: 400 }, now: 1, ...extra });
}

test("migration history keeps the newest details while preserving lifetime outcome totals", () => {
  const limit = historyRetentionConfig.migrationPerOutcome;
  const records = (prefix, count) => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index + 1}` }));
  const state = migration.createState({
    completedMigrations: records("complete", limit + 7),
    failedMigrations: records("failed", limit + 3),
    returnedMigrations: records("returned", limit + 1),
    historyTotals: { completed: limit + 20, failed: 2, returned: limit + 1 }
  }, 0);

  assert.equal(state.completedMigrations.length, limit);
  assert.equal(state.completedMigrations[0].id, "complete-8");
  assert.equal(state.failedMigrations.length, limit);
  assert.equal(state.failedMigrations[0].id, "failed-4");
  assert.equal(state.returnedMigrations.length, limit);
  assert.equal(state.returnedMigrations[0].id, "returned-2");
  assert.deepEqual(state.historyTotals, { completed: limit + 20, failed: limit + 3, returned: limit + 1 });
});

test("settlement high-water marks credit once and only award later increases", () => {
  const state = { best: 50, active: { score: 50 }, nursery: { colonyCount: 100, nestLevel: 0, nurseryLevel: 0 }, habitats: { counts: [10] }, notables: { retained: [notable("n")], pending: [], elders: [], dismissedCount: 0, masteryRewardsClaimed: {} } };
  state.migration = migration.createState({}, 0);
  const first = migration.creditActiveSettlement(state); const same = migration.creditActiveSettlement(state);
  state.best = 200; state.active.score = 200; const increase = migration.creditActiveSettlement(state);
  assert.ok(first > 0); assert.equal(same, 0); assert.ok(increase > 0);
  assert.equal(state.migration.totalEarned, first + increase);
  assert.equal(state.migration.contributions.grasslands.totalMigrationPointsCredited, first + increase);
});

test("multiple settlements feed one global Migration Point pool", () => {
  const state = { best: 75, nursery: { colonyCount: 50, nestLevel: 0, nurseryLevel: 0 }, habitats: { counts: [5] }, notables: { retained: [notable("a")], pending: [], elders: [], dismissedCount: 0, masteryRewardsClaimed: {} } };
  state.migration = migration.createState({}, 0); const grasslands = migration.creditActiveSettlement(state);
  state.migration.settlements.push({ id: "second", name: "Second", region: "Wetlands", foundedAt: 0, status: "established", foundingRemainingMs: 0, stats: {}, economy: null });
  state.migration.activeSettlementId = "second"; state.best = 150; const second = migration.creditActiveSettlement(state);
  assert.ok(grasslands > 0 && second > 0); assert.equal(state.migration.availablePoints, grasslands + second);
});

test("convoy cost is configurable and two expeditions spend separately", () => {
  const game = createGameSession({ save: saveForMigration(), now: 1, rng: () => 0 });
  const first = departure(game); const firstCost = migration.calculateCost({ adults: 20, eggs: 2, seeds: 100, branches: 20, provisions: 400 });
  assert.equal(first.events.find((item) => item.type === "migrationDeparted").cost, firstCost);
  const second = departure(game, { notableId: "n2", destination: "Highlands", manifest: { adults: 5, eggs: 0, seeds: 0, branches: 0, provisions: 100 } });
  assert.ok(second.events.some((item) => item.type === "migrationDeparted"));
  assert.equal(game.snapshot().migration.totalSpent, firstCost + migration.calculateCost({ adults: 5, eggs: 0, seeds: 0, branches: 0, provisions: 100 }));
});

test("departure enforces one local Notable and minimum adults and Provisions", () => {
  const game = createGameSession({ save: saveForMigration(), now: 1, rng: () => 0 });
  const missing = departure(game, { notableId: null });
  const adults = departure(game, { manifest: { adults: 4, provisions: 100 } });
  const provisions = departure(game, { manifest: { adults: 5, provisions: 99 } });
  assert.ok(missing.events.some((item) => item.reason === "notableRequired"));
  assert.ok(adults.events.some((item) => item.reason === "insufficientAdultsRequired"));
  assert.ok(provisions.events.some((item) => item.reason === "insufficientProvisionsRequired"));
});

test("expeditions always leave Grasslands and claim each destination only once", () => {
  const game = createGameSession({ save: saveForMigration(), now: 1, rng: () => 0 });
  const wrongOrigin = departure(game, { originSettlementId: "wetlands" });
  assert.ok(wrongOrigin.events.some((item) => item.reason === "originMustBeGrasslands"));
  const first = departure(game);
  assert.ok(first.events.some((item) => item.type === "migrationDeparted"));
  const duplicate = departure(game, { notableId: "n2" });
  assert.ok(duplicate.events.some((item) => item.reason === "destinationAlreadySettled"));
});

test("departure deducts local assets immediately and never recalculates success", () => {
  const game = createGameSession({ save: saveForMigration(), now: 1, rng: () => 0 }); const before = game.snapshot(); departure(game); const after = game.snapshot(); const expedition = after.migration.activeExpeditions[0];
  assert.equal(after.nursery.colonyCount, before.nursery.colonyCount - 20); assert.equal(after.provisions, before.provisions - 400); assert.equal(after.seeds, before.seeds - 100); assert.equal(after.notables.retained.length, 1);
  const fixed = expedition.chanceOfSuccess; game.tick(migrationConfig.journey.travelTimePerLegMs); assert.equal(game.snapshot().migration.activeExpeditions[0].chanceOfSuccess, fixed);
});

test("success factors diminish, may exceed 100%, and nth-root stop math is exact", () => {
  const base = { adults: 0, provisions: 0, eggs: 0 }; const low = migration.calculateSuccess({ ...base, adults: 10 }, null); const medium = migration.calculateSuccess({ ...base, adults: 20 }, null); const high = migration.calculateSuccess({ ...base, adults: 30 }, null);
  assert.ok(medium - low > high - medium);
  const over = migration.calculateSuccess({ adults: 100, provisions: 2000, eggs: 20 }, notable("veteran", 1000)); assert.ok(over > 1);
  const perStop = migration.perStopChance(0.6, 5); assert.ok(Math.abs(perStop ** 5 - 0.6) < 1e-12); assert.ok(migration.perStopChance(2, 5) > 1);
});

test("ordinary attrition is per-leg, protected by uncapped success, and leaves eggs and survival floors", () => {
  assert.ok(migration.attritionRate("adults", 1) > migration.attritionRate("adults", 2));
  assert.ok(migration.attritionRate("adults", 100) >= migrationConfig.attrition.adults.minimum);
  const expedition = { chanceOfSuccess: 2, currentStopIndex: 0, nextLegAttritionMultiplier: 1, currentManifest: { adults: 2, eggs: 5, seeds: 10, provisions: 2 }, attritionHistory: [] };
  migration.applyTravelAttrition(expedition, () => 0); assert.equal(expedition.currentManifest.eggs, 5); assert.ok(expedition.currentManifest.adults >= 1); assert.ok(expedition.currentManifest.provisions >= 1); assert.equal(expedition.attritionHistory.length, 1);
});

test("journeys choose only four, five, or six stops and pause after one completed leg", () => {
  for (const roll of [0, 0.4, 0.9]) {
    const game = createGameSession({ save: saveForMigration(), now: 1, rng: sequence([roll], 0) }); departure(game); const count = game.snapshot().migration.activeExpeditions[0].stopCount; assert.ok([4, 5, 6].includes(count));
    game.tick(migrationConfig.journey.travelTimePerLegMs * 10); const stopped = game.snapshot().migration.activeExpeditions[0]; assert.equal(stopped.currentStopIndex, 1); assert.ok(["waitingStop", "waitingChallenge"].includes(stopped.state));
    const current = stopped.currentStopIndex; game.tick(migrationConfig.journey.travelTimePerLegMs * 10); assert.equal(game.snapshot().migration.activeExpeditions[0].currentStopIndex, current);
  }
});

test("every decision offers a free option", () => {
  const rolls = [0, 0.35, 0.65];
  for (const stopRoll of rolls) {
    const game = createGameSession({ save: saveForMigration(), now: 1, rng: sequence([0, 0, stopRoll], 0) }); departure(game); game.tick(migrationConfig.journey.travelTimePerLegMs); const stop = game.snapshot().migration.activeExpeditions[0].stopEvent;
    if (stop.type === "decision") assert.ok(stop.options.some((option) => option.free));
  }
});

test("failed and skipped challenges cause attrition, skip is larger, and neither destroys the expedition", () => {
  const makeChallenge = () => { const game = createGameSession({ save: saveForMigration(), now: 1, rng: sequence([0, 0, 0.95], 0) }); departure(game); game.tick(migrationConfig.journey.travelTimePerLegMs); return game; };
  const failed = makeChallenge(); const failedState = { migration: JSON.parse(JSON.stringify(failed.snapshot().migration)) }; const failedId = failedState.migration.activeExpeditions[0].id; const beforeFailed = failedState.migration.activeExpeditions[0].currentManifest.adults; migration.resolveChallenge(failedState, failedId, false, 1);
  const skipped = makeChallenge(); const skippedId = skipped.snapshot().migration.activeExpeditions[0].id; const beforeSkipped = skipped.snapshot().migration.activeExpeditions[0].currentManifest.adults; skipped.dispatch({ type: "skipMigrationChallenge", expeditionId: skippedId, now: 1 });
  assert.equal(beforeFailed - failedState.migration.activeExpeditions[0].currentManifest.adults, migrationConfig.attrition.failedChallenge.adults);
  assert.equal(beforeSkipped - skipped.snapshot().migration.activeExpeditions[0]?.currentManifest.adults, migrationConfig.attrition.skippedChallenge.adults);
  assert.ok(migrationConfig.attrition.skippedChallenge.adults > migrationConfig.attrition.failedChallenge.adults);
  assert.equal(failedState.migration.failedMigrations.length, 0);
  assert.equal(skipped.snapshot().migration.failedMigrations.length, 0);
});

test("a failed pre-stop roll alone destroys cargo, spends no refund, and resolves Notable survival", () => {
  const lowSave = saveForMigration(); lowSave.notables.retained = [notable("n1", 0), notable("n2", 0)];
  const game = createGameSession({ save: lowSave, now: 1, rng: sequence([0, 0, 0.999, 0.25], 0) });
  const started = game.dispatch({ type: "startMigration", originSettlementId: "grasslands", destination: "Wetlands", notableId: "n1", manifest: { adults: 5, eggs: 1, seeds: 10, branches: 5, provisions: 100 }, now: 1 }); const spent = started.snapshot.migration.totalSpent;
  game.tick(migrationConfig.journey.travelTimePerLegMs); const snap = game.snapshot(); assert.equal(snap.migration.activeExpeditions.length, 0); assert.equal(snap.migration.failedMigrations.length, 1); assert.equal(snap.migration.historyTotals.failed, 1); assert.equal(snap.migration.failedMigrations[0].currentManifest.adults, 0); assert.equal(snap.migration.totalSpent, spent); assert.equal(snap.migration.failedMigrations[0].notableSurvived, true);
});

test("voluntary return restores survivors and refunds only the configured fraction", () => {
  const game = createGameSession({ save: saveForMigration(), now: 1, rng: () => 0 }); const before = game.snapshot(); departure(game); const exp = game.snapshot().migration.activeExpeditions[0]; game.dispatch({ type: "returnMigration", expeditionId: exp.id, now: 2 }); const after = game.snapshot();
  assert.equal(after.nursery.colonyCount, before.nursery.colonyCount); assert.equal(after.notables.retained.length, before.notables.retained.length); assert.equal(after.migration.historyTotals.returned, 1); assert.ok(Math.abs(after.migration.returnedMigrations[0].refund - exp.migrationPointCost * migrationConfig.journey.returnRefundRate) < 1e-9);
});

test("successful stops create a founding settlement whose timer advances offline and cannot lose inactivity", () => {
  const game = createGameSession({ save: saveForMigration(), now: 1, rng: () => 0 }); departure(game);
  for (let stop = 0; stop < 4; stop += 1) { game.tick(migrationConfig.journey.travelTimePerLegMs); const exp = game.snapshot().migration.activeExpeditions[0]; game.dispatch({ type: "resolveMigrationStop", expeditionId: exp.id, optionId: "short", now: 2 + stop }); }
  const founding = game.snapshot().migration.settlements.find((item) => item.region === "Wetlands"); assert.ok(founding); assert.equal(founding.foundingRemainingMs, migrationConfig.founding.baseTimeMs); assert.equal(migrationConfig.founding.nurseryAvailable, false); assert.equal(migrationConfig.founding.colonyAvailable, false);
  game.advanceOffline(migrationConfig.founding.baseTimeMs + 1000); const established = game.snapshot().migration.settlements.find((item) => item.id === founding.id); assert.equal(established.status, "established");
});

test("active-play Snake Seeds shorten founding one second each without being consumed", () => {
  const state = { migration: migration.createState({ settlements: [{ id: "grasslands", name: "Grasslands", region: "Grasslands", status: "established" }, { id: "new", name: "New", region: "Wetlands", status: "founding", foundingRemainingMs: 600000, economy: {} }], activeSettlementId: "new" }, 0) };
  const reduced = migration.recordSnakeSeeds(state, 25); assert.equal(reduced, 25000); assert.equal(state.migration.settlements[1].foundingRemainingMs, 575000);
});

test("active travel and stop pauses survive a deterministic save round-trip", () => {
  const game = createGameSession({ save: saveForMigration(), now: 1, rng: () => 0 }); departure(game); game.tick(30000);
  const traveling = createGameSession({ save: game.serialize(), now: 1, rng: () => 0 }); assert.equal(traveling.snapshot().migration.activeExpeditions[0].travelTimeRemainingMs, 30000);
  traveling.tick(30000); const pausedSave = traveling.serialize(); const paused = createGameSession({ save: pausedSave, now: 1, rng: () => 0 }); paused.advanceOffline(3600000);
  assert.equal(paused.snapshot().migration.activeExpeditions[0].currentStopIndex, 1); assert.equal(paused.snapshot().migration.activeExpeditions[0].state, "waitingStop");
});
