const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");
const queries = require("./queries.js");
const { upgradeConfig } = require("./config.js");

function game({ length = 15, counts = [25], upgrades = {}, snake, direction = "right" } = {}) {
  const session = createGameSession({ now: 1000, rng: () => 0.5,
    save: { savedAt: 1000, currencies: { seeds: 10000 }, habitats: { counts }, upgrades } });
  session.dispatch({ type: "selectMode", mode: "snake", setup: {
    grid: { columns: 20, rows: 20 }, tickMs: 200, direction,
    snake: snake || Array.from({ length }, (_, i) => ({ x: 15 - i, y: 10 }))
  } });
  return session;
}
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 0.00011, `${actual} != ${expected}`); }
function baseRate(session) { return queries.habitatPanel(session.snapshot()).activation.incomePerSecond; }

test("all segments boost passive Seeds only during an active Classic Snake run", () => {
  const session = game(); const rate = baseRate(session);
  assert.equal(session.snapshot().hud.lengthBonus.applied, false);
  near(session.snapshot().hud.lengthBonus.seedIncomePerSecond, rate);
  let before = session.snapshot().seeds;
  near(session.tick(100).snapshot.seeds - before, rate * 0.1);
  session.dispatch({ type: "begin" });
  assert.equal(session.snapshot().hud.lengthBonus.multiplier, 1.15);
  near(session.snapshot().hud.lengthBonus.seedIncomePerSecond, rate * 1.15);
  before = session.snapshot().seeds;
  const frame = session.tick(100, { snapshot: "frame" }).snapshot;
  near(frame.seeds - before, rate * 0.1 * 1.15);
  assert.deepEqual(frame.hud.lengthBonus, session.snapshot().hud.lengthBonus);
  session.dispatch({ type: "pause" });
  before = session.snapshot().seeds;
  near(session.tick(1000).snapshot.seeds - before, rate);
  assert.equal(session.snapshot().hud.lengthBonus.multiplier, 1);
  near(session.snapshot().hud.lengthBonus.seedIncomePerSecond, rate);
  session.dispatch({ type: "resume" });
  assert.equal(session.snapshot().hud.lengthBonus.multiplier, 1.15);
  session.dispatch({ type: "selectMode", mode: "runner" });
  session.dispatch({ type: "begin" });
  assert.equal(session.snapshot().hud.lengthBonus.applied, false);
  const noIncome = game({ counts: [] }); noIncome.dispatch({ type: "begin" });
  assert.equal(noIncome.snapshot().hud.lengthBonus.applied, false);
});

test("Length Bonus upgrades cost Seeds, add five percentage points, and survive reload", () => {
  const session = game(); const before = session.snapshot().seeds;
  const purchased = session.dispatch({ type: "buyUpgrade", upgrade: "lengthBonus" });
  assert.ok(purchased.events.some((e) => e.type === "upgradePurchased"));
  assert.equal(purchased.snapshot.seeds, before - upgradeConfig.lengthBonus.baseCost);
  assert.equal(purchased.snapshot.phase, "ready");
  near(purchased.snapshot.hud.lengthBonus.perSegment, 0.06);
  session.dispatch({ type: "begin" });
  near(session.snapshot().hud.lengthBonus.multiplier, 1.9);
  session.dispatch({ type: "buyUpgrade", upgrade: "lengthBonus" });
  near(session.snapshot().hud.lengthBonus.perSegment, 0.11);
  near(session.snapshot().hud.lengthBonus.multiplier, 2.65);
  const save = session.serialize();
  const restored = createGameSession({ save, now: save.savedAt });
  assert.equal(restored.snapshot().upgrades.lengthBonusLevel, 2);
  near(restored.snapshot().hud.lengthBonus.multiplier, 2.65);
  const poor = createGameSession({ now: 0 });
  assert.equal(poor.snapshot().upgrades.lengthBonusLevel, 0);
  assert.ok(poor.dispatch({ type: "buyUpgrade", upgrade: "lengthBonus" }).events.some((e) => e.reason === "insufficientSeeds"));
});

test("bonus does not increase Branches, Provisions, or egg progress", () => {
  const boosted = game({ counts: [0, 0, 10, 10] });
  const baseline = game({ counts: [0, 0, 10, 10] });
  boosted.dispatch({ type: "begin" });
  const a = boosted.tick(100).snapshot; const b = baseline.tick(100).snapshot;
  assert.ok(a.seeds > b.seeds);
  assert.equal(a.branches, b.branches);
  assert.equal(a.provisions, b.provisions);
  assert.equal(a.nursery.eggProgress, b.nursery.eggProgress);
});

test("growth changes the bonus at its deadline in both long and short frames", () => {
  const original = game({ length: 3 }); const saved = original.serialize();
  saved.session.active.foods = [{ x: 16, y: 10, kind: "seed" }];
  const a = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.5 });
  const b = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.5 });
  a.dispatch({ type: "begin" }); b.dispatch({ type: "begin" });
  const rate = baseRate(a); const before = a.snapshot().seeds;
  a.tick(250); for (let i = 0; i < 5; i++) b.tick(50);
  assert.equal(a.snapshot().active.snake.length, 4);
  near(a.snapshot().seeds - before, 1 + rate * (0.2 * 1.03 + 0.05 * 1.04));
  near(a.snapshot().seeds, b.snapshot().seeds);
});

test("long frames and offline catch-up stop the bonus at death", () => {
  const original = game({ snake: [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }] });
  original.dispatch({ type: "begin" });
  const saved = original.serialize(); const before = original.snapshot().seeds; const rate = baseRate(original);
  const end = original.tick(1000).snapshot;
  assert.equal(end.phase, "gameover");
  assert.equal(end.hud.lengthBonus.applied, false);
  near(end.seeds - before, rate * (0.32 * 1.03 + 0.68));
  const offline = createGameSession({ save: saved, now: saved.savedAt + 1000, rng: () => 0.5 });
  near(offline.advanceOffline(saved.savedAt + 1000).snapshot.seeds, end.seeds);
});

test("reload of a finished run creates a ready board and keeps durable progress", () => {
  const session = game({ upgrades: { lengthBonusLevel: 1 } });
  session.dispatch({ type: "begin" }); session.tick(10000);
  assert.equal(session.snapshot().phase, "gameover");
  const saved = session.serialize();
  const restored = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.5 });
  assert.equal(restored.snapshot().phase, "ready");
  restored.dispatch({ type: "launchGame", mode: "snake" });
  assert.equal(restored.snapshot().active.snake.length, 3);
  assert.equal(restored.snapshot().seeds, session.snapshot().seeds);
  assert.equal(restored.snapshot().best, session.snapshot().best);
  assert.equal(restored.snapshot().upgrades.lengthBonusLevel, 1);
  assert.deepEqual(restored.snapshot().habitats, session.snapshot().habitats);
});

test("only the active settlement receives the bonus and upgrades stay local", () => {
  const original = game(); const saved = original.serialize();
  const home = saved.session.migration.settlements[0];
  const remote = JSON.parse(JSON.stringify(home)); remote.id = "wetlands"; remote.name = "Wetlands";
  saved.session.migration.settlements.push(remote);
  const session = createGameSession({ save: saved, now: saved.savedAt, rng: () => 0.5 });
  session.dispatch({ type: "buyUpgrade", upgrade: "lengthBonus" });
  session.dispatch({ type: "begin" });
  const before = session.snapshot(); const after = session.tick(100).snapshot;
  near(after.seeds - before.seeds, baseRate(session) * 0.1 * 1.9);
  const other = after.migration.settlements.find((s) => s.id === "wetlands").economy;
  near(other.seeds - remote.economy.seeds, baseRate(session) * 0.1);
  session.dispatch({ type: "selectSettlement", settlementId: "wetlands" });
  assert.equal(session.snapshot().upgrades.lengthBonusLevel, 0);
});
