const test = require("node:test");
const assert = require("node:assert/strict");
const snake = require("./snake.js");
const { createGameSession } = require("./session.js");
const queries = require("./queries.js");
const { upgradeConfig } = require("./config.js");

function board(level, draw, eggBoard = true) {
  const draws = [0.5, draw, 0.5];
  return snake.createSnakeMode({ columns: 9, rows: 9 }, {
    upgrades: { eggChanceLevel: level }, eggBoard, rng: () => draws.shift() ?? 0.5
  });
}
const eggs = (state) => state.foods.filter((food) => food.kind === "egg").length;

test("egg boards start at 1/200 and add 0.5 percentage points per upgrade", () => {
  for (const [level, chance] of [[0, 0.005], [1, 0.01], [2, 0.015], [9, 0.05]]) {
    assert.ok(Math.abs(snake.eggSpawnChance({ eggChanceLevel: level }) - chance) < 1e-12);
    assert.equal(eggs(board(level, chance - 0.000001)), 1);
    assert.equal(eggs(board(level, chance)), 0);
    assert.equal(eggs(board(level, chance + 0.000001)), 0);
  }
  assert.equal(snake.eggSpawnChance({}), 0.005);
  assert.equal(eggs(board(199, 0, false)), 0, "normal boards cannot spawn eggs");
  assert.equal(eggs(board(199, 0.999999)), 1, "maximum chance is 100%");
});

test("purchasing Egg chance applies to the next Seed spawn in the current egg run", () => {
  let draws = [];
  const rng = () => draws.shift() ?? 0.99;
  const original = createGameSession({ now: 1000, rng,
    save: { savedAt: 1000, currencies: { seeds: 10000 }, eggBoardCountdown: 1 } });
  original.dispatch({ type: "selectMode", mode: "snake", setup: {
    grid: { columns: 9, rows: 9 }, tickMs: 200
  } });
  const saved = original.serialize();
  const head = saved.session.active.snake[0];
  saved.session.active.foods = [{ x: head.x, y: head.y - 1, kind: "seed" }];
  const session = createGameSession({ save: saved, now: 1000, rng });
  session.dispatch({ type: "begin" });
  const before = session.snapshot();
  const bought = session.dispatch({ type: "buyUpgrade", upgrade: "eggChance" });
  assert.equal(bought.snapshot.phase, "running");
  assert.equal(bought.snapshot.active.eggBoard, true);
  assert.deepEqual(bought.snapshot.active.snake, before.active.snake);
  assert.equal(bought.snapshot.seeds, before.seeds - upgradeConfig.eggChance.baseCost);
  assert.equal(bought.snapshot.upgrades.eggChanceLevel, 1);
  draws = [0.5, 0.0075, 0.5]; // Fails at 0.5%, succeeds at the upgraded 1%.
  assert.equal(eggs(session.tick(200).snapshot.active), 1);
  const panel = queries.upgradePanel(session.snapshot()).eggChance;
  assert.equal(panel.chance, 0.01);
  assert.equal(panel.nextChance, 0.015);
  assert.equal(panel.cost, 1250);
  const save = session.serialize();
  assert.equal(createGameSession({ save, now: save.savedAt }).snapshot().upgrades.eggChanceLevel, 1);
});

test("old saves default to zero and purchases stop at 100%", () => {
  const poor = createGameSession({ now: 0 });
  assert.equal(poor.snapshot().upgrades.eggChanceLevel, 0);
  assert.ok(poor.dispatch({ type: "buyUpgrade", upgrade: "eggChance" }).events.some((e) => e.reason === "insufficientSeeds"));
  const maxed = createGameSession({ now: 0, save: { upgrades: { eggChanceLevel: 999 }, currencies: { seeds: 1e100 } } });
  assert.equal(maxed.snapshot().upgrades.eggChanceLevel, 199);
  const before = maxed.snapshot().seeds;
  assert.equal(queries.upgradePanel(maxed.snapshot()).eggChance.maxed, true);
  assert.equal(queries.upgradePanel(maxed.snapshot()).eggChance.canBuy, false);
  assert.ok(maxed.dispatch({ type: "buyUpgrade", upgrade: "eggChance" }).events.some((e) => e.reason === "maxed"));
  assert.equal(maxed.snapshot().seeds, before);
});

test("Egg chance levels stay with their settlement", () => {
  const original = createGameSession({ now: 0, save: { currencies: { seeds: 10000 } } });
  const save = original.serialize();
  const remote = JSON.parse(JSON.stringify(save.session.migration.settlements[0]));
  remote.id = "wetlands"; remote.name = "Wetlands";
  save.session.migration.settlements.push(remote);
  const session = createGameSession({ save, now: 0 });
  session.dispatch({ type: "buyUpgrade", upgrade: "eggChance" });
  session.dispatch({ type: "selectSettlement", settlementId: "wetlands" });
  assert.equal(session.snapshot().upgrades.eggChanceLevel, 0);
  session.dispatch({ type: "selectSettlement", settlementId: "grasslands" });
  assert.equal(session.snapshot().upgrades.eggChanceLevel, 1);
});
