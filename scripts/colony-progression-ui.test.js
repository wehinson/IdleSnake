const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const queries = require("../engine/queries.js");
const economy = require("../engine/economy.js");
const { createGameSession } = require("../engine/session.js");
const { habitatConfig } = require("../engine/config.js");

// A narrow DOM double executes the actual UI functions without a browser.
// It models sibling movement and identity; it does not claim layout coverage.
class Element {
  constructor() {
    this.children = []; this.parent = null; this.hidden = false;
    this.classList = { toggle() {} }; this.selectors = new Map();
  }
  detach() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
  append(child) { child.detach(); child.parent = this; this.children.push(child); }
  after(child) {
    const parent = this.parent;
    child.detach(); child.parent = parent;
    parent.children.splice(parent.children.indexOf(this) + 1, 0, child);
  }
  replaceChildren() { this.children.forEach((child) => { child.parent = null; }); this.children = []; }
  querySelector(selector) {
    if (!this.selectors.has(selector)) this.selectors.set(selector, new Element());
    return this.selectors.get(selector);
  }
  addEventListener() {}
}

function habitatRenderer() {
  const source = fs.readFileSync(require.resolve("../game.js"), "utf8");
  const list = new Element();
  const context = vm.createContext({
    habitatListEl: list, habitatCardRefs: [], habitatConfig, engineQueries: queries,
    document: { createElement: () => new Element(), getElementById: (id) => list.children.find((item) => item.id === id) },
    colonyCountEl: new Element(), colonyPlacedCountEl: new Element(), colonyProvisionTotalEl: new Element(),
    colonyBranchTotalEl: new Element(), colonySeedIncomeRateEl: new Element(), colonyProvisionIncomeRateEl: new Element(),
    colonyBranchIncomeRateEl: new Element(), colonyProvisionConsumptionRateEl: new Element(),
    gameView: { provisionsTotal: 0, branchesTotal: 0 },
    formatNumber: String, formatWholeNumber: String, formatDecimal: String, formatProvisions: String, padScore: String,
    setText: (element, value) => { element.textContent = value; }, placeSnakeInHabitat() {}, upgradeHabitat() {}
  });
  vm.runInContext(source.slice(source.indexOf("const numberFormatCache ="), source.indexOf("// Write to a text node"))
    + source.slice(source.indexOf("function buildHabitatList()"), source.indexOf("function placeSnakeInHabitat(")), context);
  vm.runInContext("buildHabitatList()", context);
  return { context, list };
}

test("actual habitat rendering places progress after the last unlocked card before preserved legacy cards", () => {
  const { context, list } = habitatRenderer();
  const progress = list.children.at(-1);
  const cards = [...context.habitatCardRefs];
  function render(counts) {
    context.latestSnapshot = createGameSession({ now: 0, save: { habitats: { counts } } }).snapshot();
    vm.runInContext("renderHabitats()", context);
    return list.children.filter((item) => !item.hidden).map((item) => {
      const index = cards.findIndex((ref) => ref.card === item);
      return index < 0 ? item.textContent : habitatConfig.habitats[index].name;
    });
  }
  assert.deepEqual(render([4, 5, 2, 1]), ["Field", "Next habitat in 1 Snakes", "Lake", "Forest", "River"]);
  for (const index of [1, 2, 3]) {
    assert.equal(cards[index].legacyProgress.hidden, false);
    assert.match(cards[index].legacyProgress.textContent, /population and production preserved/);
    assert.equal(cards[index].button.disabled, true);
  }
  assert.deepEqual(render([5, 4, 2, 1]), ["Field", "Lake", "Next habitat in 1 Snakes", "Forest", "River"]);
  assert.deepEqual(render([5, 5, 2, 1]), ["Field", "Lake", "Forest", "Next habitat in 3 Snakes", "River"]);
  assert.deepEqual(render([4, 5, 2, 1]), ["Field", "Next habitat in 1 Snakes", "Lake", "Forest", "River"]);
  assert.deepEqual(render([5, 5, 5, 5, 5, 5, 5, 0]), habitatConfig.habitats.map((item) => item.name));
  assert.equal(progress.hidden, true);
  assert.equal(list.children.filter((item) => item.id === "next-habitat-progress").length, 1);
});

test("actual habitat labels distinguish averaged idle activity from physical idle counts across funding changes", () => {
  const { context } = habitatRenderer();
  const cards = context.habitatCardRefs;
  const counts = [55, 60, 5, 1];
  function session(populations, bank = 0) {
    return createGameSession({ now: 0, rng: () => 0.99, save: {
      currencies: { provisions: bank }, habitats: { counts: populations, upgradeLevels: populations.map(() => 2) }
    } });
  }
  function render(game) {
    context.latestSnapshot = game.snapshot();
    vm.runInContext("renderHabitats()", context);
    return queries.habitatPanel(context.latestSnapshot);
  }
  let panel = render(session(counts));
  assert.equal(panel.habitats[0].idleSnakesAreAverage, true);
  assert.equal(panel.habitats[1].idleSnakesAreAverage, true);
  assert.equal(panel.habitats[2].idleSnakesAreAverage, false, "unchanged allocations remain ordinary counts");
  assert.equal(cards[0].idleSnakes.textContent, "Idle on average: 2.809 snakes");
  assert.equal(cards[1].idleSnakes.textContent, "Idle on average: 3.7453 snakes");
  assert.equal(cards[0].assignedCount.textContent, "55");
  assert.equal(cards[1].assignedCount.textContent, "60");
  assert.equal(cards[0].idleSnakes.hidden, false);
  assert.equal(cards[2].idleSnakes.hidden, true);
  assert.equal(panel.habitats[0].count, 55);
  assert.equal(panel.habitats[1].count, 60);
  assert.ok(panel.habitats[0].idleSnakes > 2 && panel.habitats[0].idleSnakes < 3, "no integer rounding of the query average");
  const plan = economy.habitatProductionPlan(context.latestSnapshot, 1);
  assert.equal(panel.habitats[0].idleSnakes, plan.currentActivation.idleCounts[0]);
  assert.equal(panel.habitats[0].seedRate, plan.currentActivation.habitatSeedOutputs[0]);

  const funded = session(counts, 1);
  panel = render(funded);
  assert.equal(panel.habitats[0].idleSnakesAreAverage, false);
  assert.equal(cards[0].idleSnakes.hidden, true);
  const untilDepleted = economy.habitatProductionPlan(funded.snapshot(), 1).bankedSeconds * 1000;
  funded.tick(untilDepleted + 1);
  assert.equal(funded.snapshot().provisions, 0);
  panel = render(funded);
  assert.equal(panel.habitats[0].idleSnakesAreAverage, true);
  assert.equal(cards[0].idleSnakes.textContent, "Idle on average: 2.809 snakes");
  assert.equal(cards[1].idleSnakes.textContent, "Idle on average: 3.7453 snakes");

  for (const [population, text] of [[26, "1 idle snake"], [27, "2 idle snakes"]]) {
    panel = render(session([population]));
    assert.equal(panel.habitats[0].idleSnakesAreAverage, false);
    assert.equal(cards[0].idleSnakes.textContent, text);
  }
  panel = render(session([25]));
  assert.equal(panel.habitats[0].idleSnakesAreAverage, false);
  assert.equal(cards[0].idleSnakes.hidden, true);
});

test("actual HUD rate formatting matches the tenfold length-bonus browser expectations", () => {
  const source = fs.readFileSync(require.resolve("../game.js"), "utf8");
  const session = createGameSession({ now: 0, rng: () => 0.5, save: {
    currencies: { seeds: 10000 }, habitats: { counts: [25] }
  } });
  session.dispatch({ type: "selectMode", mode: "snake", setup: {
    grid: { columns: 20, rows: 20 }, direction: "right", tickMs: 10000,
    snake: Array.from({ length: 15 }, (_, i) => ({ x: 15 - i, y: 10 }))
  } });
  const rate = new Element(); const summary = new Element();
  const context = vm.createContext({ seedIncomePerSecondEl: rate, lengthBonusSummaryEl: summary,
    lengthBonusMultiplierEl: new Element(), gameView: {}, syncPrimaryActionButton() {},
    setText: (element, value) => { element.textContent = value; },
    setHidden: (element, hidden) => { element.hidden = hidden; } });
  vm.runInContext(source.slice(source.indexOf("const numberFormatCache ="), source.indexOf("// Write to a text node"))
    + source.slice(source.indexOf("function syncHud()"), source.indexOf('  const isSnakebird = gameView.gameMode === "snakebird";')) + "}", context);
  function render() { context.gameView.lengthBonus = session.snapshot().hud.lengthBonus; vm.runInContext("syncHud()", context); }
  render(); assert.equal(rate.textContent, "+1.375/s"); assert.equal(summary.hidden, true);
  session.dispatch({ type: "begin" }); render();
  assert.equal(rate.textContent, "+1.5813/s"); assert.equal(summary.hidden, false);
  session.dispatch({ type: "buyUpgrade", upgrade: "lengthBonus" }); render();
  assert.equal(rate.textContent, "+2.6125/s");
  session.dispatch({ type: "pause" }); render();
  assert.equal(rate.textContent, "+1.375/s"); assert.equal(summary.hidden, true);
});
