const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const queries = require("../engine/queries.js");
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

test("actual habitat rendering places progress after the last unlocked card before preserved legacy cards", () => {
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
  vm.runInContext(source.slice(source.indexOf("function buildHabitatList()"), source.indexOf("function placeSnakeInHabitat(")), context);
  vm.runInContext("buildHabitatList()", context);
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
