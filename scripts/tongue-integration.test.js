const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const tongue = require("../engine/tongue.js");

test("actual food drawing draws one Seed through pull, turn, pause, return and consumption", () => {
  const source = fs.readFileSync(require.resolve("../game.js"), "utf8");
  const drawn = [];
  const view = { gameMode: "snake", state: "running", snake: [{ x: 2, y: 2 }], direction: "right",
    foods: [{ x: 4, y: 2, kind: "seed" }], stepAccumulatorMs: 0, tickMs: 200 };
  let now = 0;
  let reduced = false;
  const context = vm.createContext({ gameView: view, tongueFrame: null,
    tongueTracker: tongue.createCatchTracker("gooFork", { outwardDurationScale: 0.5, returnOnCancel: true }),
    window: { IdleSnakeTongueDraw: { drawForkTongue() {} } }, ctx: {},
    boardMetrics: { cellSize: 20, x: 0, y: 0 }, performance: { now: () => now },
    snakeAnimationNow: () => now, effectiveReducedMotion: () => reduced,
    currentFoodType: () => ({}), pendingHeadDirection: () => view.direction,
    cellRect: snack => ({ x: snack.x * 20, y: snack.y * 20, size: 12 }),
    drawSnack: (snack, rect) => drawn.push({ snack, rect }) });
  vm.runInContext(source.slice(source.indexOf("function drawFood()"), source.indexOf("function drawSnack("))
    + source.slice(source.indexOf("function updateTongueFrame()"), source.indexOf("function drawScanlines()")), context);
  const draw = () => { drawn.length = 0; vm.runInContext("drawFood(); drawTongueCatch();", context); return drawn.slice(); };
  assert.equal(draw().length, 1);
  now = 60; view.stepAccumulatorMs = 120;
  const pulled = draw(); assert.equal(pulled.length, 1);
  view.direction = "up";
  assert.deepEqual(draw()[0].rect, pulled[0].rect, "no jump at cancellation");
  view.state = "paused"; now = 5000;
  assert.deepEqual(draw()[0].rect, pulled[0].rect, "pause freezes the visible Seed");
  view.state = "running"; now = 105; reduced = true;
  assert.equal(draw().length, 1);
  now = 180;
  const home = draw(); assert.equal(home.length, 1);
  assert.equal(home[0].rect.x + home[0].rect.size / 2, 90);
  assert.equal(home[0].rect.y + home[0].rect.size / 2, 50);
  view.foods = []; now = 181;
  assert.equal(draw().length, 0, "removed food cannot appear in the tongue layer");
});
