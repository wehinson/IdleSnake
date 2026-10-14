const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const F = require("./minigame-feedback.js");
const B = require("../engine/battleship.js");
const source = fs.readFileSync(require.resolve("../game.js"), "utf8");
function functions(start, end) { return source.slice(source.indexOf(`function ${start}(`), source.indexOf(`function ${end}(`)); }

function drawingContext() {
  const ops = [], stack = [];
  const target = { globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1 };
  const ctx = new Proxy(target, { get(obj, prop) {
    if (prop in obj) return obj[prop];
    return (...args) => {
      ops.push({ method: prop, args, alpha: obj.globalAlpha, fill: obj.fillStyle, stroke: obj.strokeStyle });
      if (prop === "save") stack.push({ ...obj });
      if (prop === "restore") Object.assign(obj, stack.pop());
    };
  } });
  return { ctx, ops };
}

test("both Strike boards fill their available axis with square cells and fully contained labels/edges", () => {
  for (const [width, height] of [[504, 1040], [1040, 504]]) {
    const L = F.strikeLayout(width, height);
    assert.equal(L.boardW, L.boardH);
    for (const board of ["enemy", "player"]) {
      assert.ok(L[`${board}X`] >= 8); assert.ok(L[`${board}X`] + L.boardW <= width - 8);
      assert.ok(L[`${board}Y`] >= L.labelH + 8); assert.ok(L[`${board}Y`] + L.boardH <= height - 8);
    }
    if (width < height) { assert.equal(L.boardW, 488); assert.ok(L.boardW > 220 * 2); }
    else assert.equal(L.boardH, 470);
  }
});
test("actual click adapter maps all 200 cells, CSS scales, both layouts, and rejects labels/gutters/outside edges", () => {
  for (const [width, height] of [[504, 1040], [1040, 504]]) for (const cssWidth of [240, 280, 390, 768]) {
    const rect = { left: 23, top: 41, width: cssWidth, height: cssWidth * height / width };
    const canvas = { width, height, getBoundingClientRect: () => rect };
    const context = vm.createContext({ canvas, window: { IdleSnakeMinigameFeedback: F } });
    vm.runInContext(functions("battleshipLayout", "battleshipGhost"), context);
    const L = F.strikeLayout(width, height);
    const click = (x, y) => JSON.parse(JSON.stringify(context.battleshipCellFromEvent({ clientX: rect.left + x * rect.width / width, clientY: rect.top + y * rect.height / height })));
    for (const board of ["enemy", "player"]) {
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++)
        assert.deepEqual(click(L[`${board}X`] + (x + .5) * L.size, L[`${board}Y`] + (y + .5) * L.size), { board, x, y });
      assert.equal(click(L[`${board}X`] + L.boardW + .001, L[`${board}Y`] + L.size), null);
      assert.equal(click(L[`${board}X`] + L.size, L[`${board}Y`] - 5), null);
    }
    assert.equal(click(-1, -1), null);
    const gapX = L.wide ? L.enemyX + L.boardW + 6 : L.enemyX + L.size;
    const gapY = L.wide ? L.enemyY + L.size : L.enemyY + L.boardH + 6;
    assert.equal(click(gapX, gapY), null);
  }
});
test("actual canvas adapter selects tall/wide layouts and restores square other modes", () => {
  const classes = new Set(); let area = { width: 400, height: 700 };
  const canvas = { width: 504, height: 504, dataset: {}, parentElement: { getBoundingClientRect: () => area } };
  const gameView = { gameMode: "battleship" };
  const context = vm.createContext({ canvas, gameView, document: { body: { classList: {
    contains: (name) => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name)
  } } } });
  vm.runInContext(functions("syncStrikeCanvas", "battleshipLayout"), context);
  context.syncStrikeCanvas(); assert.equal(canvas.height, 1040); assert.equal(canvas.dataset.layout, "strike-stack");
  classes.add("is-fullscreen-mode"); area = { width: 1200, height: 500 };
  context.syncStrikeCanvas(); assert.equal(canvas.width, 1040); assert.equal(canvas.height, 504); assert.equal(canvas.dataset.layout, "strike-wide");
  gameView.gameMode = "centipede"; context.syncStrikeCanvas();
  assert.equal(canvas.width, 504); assert.equal(canvas.height, 504); assert.ok(!classes.has("has-strike-board"));
});
test("actual Strike drawing uses both layout origins, reveals only allowed fleet connectors and distinguishes X/hollow ring", () => {
  for (const [width, height] of [[504, 1040], [1040, 504]]) {
    const { ctx, ops } = drawingContext(), connectors = [];
    const fleet = B.emptyFleet(); B.placeShip(fleet, { name: "Test", length: 2 }, 1, 1, "h", 10);
    fleet.shots["1,1"] = "hit"; fleet.shots["9,9"] = "miss";
    const context = vm.createContext({ ctx, canvas: { width, height }, window: { IdleSnakeMinigameFeedback: F, IdleSnakeBattleship: B },
      gameView: { battleship: { phase: "playing", turn: "player", enemy: fleet, player: fleet, target: { x: 9, y: 9 }, lastPlayerShot: { x: 1, y: 1 }, lastAiShot: null } },
      strikeShots: {}, snakeColors: { head: "#aabbcc", body: "#778899" },
      drawSnakeConnectors: (...args) => connectors.push(args), drawRoundedRect: (...args) => ctx.fillRect(...args),
      effectiveReducedMotion: () => true, snakeAnimationNow: () => 0 });
    vm.runInContext(functions("battleshipLayout", "getBoardMetrics"), context); context.drawBattleship();
    const L = F.strikeLayout(width, height);
    assert.ok(ops.some((op) => op.method === "strokeRect" && op.args[0] === L.enemyX && op.args[1] === L.enemyY && op.args[2] === L.boardW));
    assert.ok(ops.some((op) => op.method === "strokeRect" && op.args[0] === L.playerX && op.args[1] === L.playerY && op.args[2] === L.boardW));
    assert.equal(connectors.length, 1, "hidden enemy snakes must not get connector lines");
    assert.equal(connectors[0][2].x, L.playerX); assert.equal(connectors[0][2].y, L.playerY);
    assert.ok(ops.some((op) => op.method === "arc" && Math.abs(op.args[2] - L.size * .19) < 1e-9), "hollow miss ring");
    assert.ok(ops.some((op) => op.method === "arc" && Math.abs(op.args[2] - L.size * .26) < 1e-9), "filled hit with X");
  }
});
test("shot feedback keeps coordinate/result/actor clear; reduced motion skips transient bursts and reticle never blinks", () => {
  assert.equal(F.shotLabel({ actor: "player", x: 0, y: 0, result: "hit" }), "Your strike A1: HIT");
  assert.equal(F.shotLabel({ actor: "ai", x: 9, y: 9, result: "sunk", ship: "Cave" }), "Enemy strike J10: SUNK Cave");
  const { ctx, ops } = drawingContext(); let now = 450, reduced = false;
  const context = vm.createContext({ ctx, window: { IdleSnakeMinigameFeedback: F }, effectiveReducedMotion: () => reduced, snakeAnimationNow: () => now });
  vm.runInContext(functions("drawStrikeImpact", "getBoardMetrics"), context);
  context.drawStrikeImpact(20, 30, 40, { at: 0, result: "miss" });
  assert.ok(ops.some((op) => op.method === "clip")); assert.ok(ops.some((op) => op.method === "arc"));
  ops.length = 0; reduced = true; context.drawStrikeImpact(20, 30, 40, { at: 0, result: "hit" }); assert.equal(ops.length, 0);
  const reticles = [];
  for (now of [0, 400, 800, 1200]) { ops.length = 0; context.drawBattleshipReticle(20, 30, 40); reticles.push(JSON.stringify(ops)); }
  assert.equal(new Set(reticles).size, 1);
  assert.equal(F.shotEmphasis(901, false), null);
});
test("actual Centipede mushroom alpha follows health 100/85/70/55%, independent of time/motion; shooter fits its larger cell", () => {
  const { ctx, ops } = drawingContext(), connectors = [];
  const boardMetrics = { x: 12, y: 12, cellSize: 16, width: 384 };
  const gameView = { centipede: { rows: 28, playerRows: 6, mushrooms: { "0,0": 4, "1,0": 3, "2,0": 2, "3,0": 1 },
    segments: [{ x: 5, y: 5, isHead: true }, { x: 4, y: 5 }, { x: 2, y: 5, isHead: true }, { x: 1, y: 5 }], bullet: null, player: { x: 23, y: 27 } } };
  const context = vm.createContext({ ctx, boardMetrics, gameView, window: { IdleSnakeMinigameFeedback: F }, snakeColors: { head: "#aabbcc", body: "#778899" },
    contrastingEyeColor: () => "black", drawSnakeConnectors: (points) => connectors.push(points) });
  vm.runInContext(functions("cellRect", "snakeStepped") + functions("drawCentipede", "drawVsSnake"), context);
  context.drawCentipede();
  const caps = ops.filter((op) => op.method === "arc" && op.args[3] === Math.PI);
  assert.deepEqual(caps.map((op) => op.alpha), [1, .85, .7, .55]);
  assert.ok(caps.every((op) => op.fill === "#182413")); assert.equal(ctx.globalAlpha, 1);
  assert.equal(connectors.length, 2); assert.deepEqual(connectors.map((points) => points.length), [2, 2]);
  const hero = ops.filter((op) => ["moveTo", "lineTo"].includes(op.method) && op.fill === "#e7e1c5");
  assert.ok(hero.every((op) => op.args[0] >= 12 + 23 * 16 && op.args[0] <= 12 + 24 * 16 && op.args[1] >= 12 + 27 * 16 && op.args[1] <= 12 + 28 * 16));
  assert.ok(Math.abs(hero[1].args[0] - hero[2].args[0] - .94 * 16) < 1e-9);
  assert.deepEqual([4, 3, 2, 1, 0].map((hp) => F.mushroomOpacity(hp)), [1, .85, .7, .55, 0]);
});
test("Broodline goal preserves formation and replay instructions, exposes wave/enemy/egg progress and companion effects", () => {
  const state = { round: 3, wave: 4, phase: "combat", kills: 7, armor: 1, maxArmor: 2, enemies: [{}, {}], chain: [{ kind: "egg", hatchAt: 2500 }] };
  assert.match(F.broodlineGoal(state, "running"), /R3 · Wave 4\/5 · 2 enemies.*Egg 3s/);
  state.phase = "formation"; assert.match(F.broodlineGoal(state, "running"), /Arrange companions.*continue or collect/);
  assert.match(F.broodlineGoal(state, "gameover"), /7 kills.*Start to try again/);
  assert.match(F.segmentDescription({ kind: "cave" }), /armor/);
  assert.equal(F.segmentDescription({ kind: "egg", hatchAt: 2500 }), "Hatches in 3s");
});

test("actual shot event handling retains both results and pause freezes effect age; restart clears presentation", () => {
  const { createAnimationClock } = require("./animation-clock.js");
  const clock = createAnimationClock(); let now = 100;
  const feedback = { textContent: "", hidden: true }, hints = [];
  const context = vm.createContext({ window: { IdleSnakeMinigameFeedback: F }, gameView: { gameMode: "battleship" },
    strikeShots: {}, battleshipFeedbackEl: feedback, snakeAnimationClock: clock,
    performance: { now: () => now }, snakeAnimationNow: () => clock.now(now), setScreenHint: (text) => hints.push(text) });
  vm.runInContext(functions("interpretSessionEvents", "formatDuration"), context);
  context.interpretSessionEvents([{ type: "battleshipShot", actor: "player", x: 1, y: 2, result: "hit" }]);
  now = 750;
  context.interpretSessionEvents([{ type: "battleshipShot", actor: "ai", x: 5, y: 6, result: "miss" }]);
  assert.equal(feedback.textContent, "Your strike B3: HIT\nEnemy strike F7: MISS");
  assert.equal(hints.at(-1), "Enemy strike F7: MISS");
  context.interpretSessionEvents([{ type: "paused" }]); now = 10750;
  assert.equal(clock.now(now) - context.strikeShots.ai.at, 0);
  context.interpretSessionEvents([{ type: "resumed" }]); now += 100;
  assert.equal(clock.now(now) - context.strikeShots.ai.at, 100);
  Object.assign(context, { latestFrameSnapshot: { mode: "battleship", phase: "running", active: { phase: "playing" } } });
  vm.runInContext(functions("acceptSnapshot", "dispatchSession"), context);
  context.acceptSnapshot({ mode: "battleship", phase: "ready", active: { phase: "placement" } });
  assert.equal(feedback.textContent, ""); assert.equal(feedback.hidden, false); assert.equal(Object.keys(context.strikeShots).length, 0);
  context.acceptSnapshot({ mode: "centipede", phase: "ready", active: {} }); assert.equal(feedback.hidden, true);
});

test("actual Broodline rendering uses camera-space connectors/map and reduced motion settles without easing; pause freezes camera", () => {
  const { ctx, ops } = drawingContext(), connectors = [];
  let reduced = true;
  const camera = { x: 0, y: 0 };
  const active = { head: { x: 15, y: 15 }, chain: [{ kind: "garden", pos: { x: 14, y: 15 } }], hp: 16, maxHp: 16, armor: 0,
    enemies: [{ type: "melee", pos: { x: 25, y: 25 }, hp: 7, maxHp: 7 }], pickups: [], effects: [] };
  const gameView = { broodline: active, state: "running" };
  const context = vm.createContext({ ctx, gameView, broodlineCamera: camera, broodlineView: 10, broodlineGrid: { columns: 30, rows: 30 },
    canvas: { width: 504, height: 504 }, snakeColors: { head: "#aabbcc" }, effectiveReducedMotion: () => reduced,
    drawSnakeConnectors: (...args) => connectors.push(args) });
  vm.runInContext(functions("drawBroodline", "render"), context); context.drawBroodline();
  assert.equal(camera.x, 10); assert.equal(camera.y, 10);
  assert.equal(connectors[0][0][0], active.head); assert.equal(connectors[0][2].x, -504);
  assert.ok(ops.some((op) => op.method === "fillRect" && op.fill === "#e37a47"), "offscreen enemy is present in overview map");
  camera.x = 0; camera.y = 0; gameView.state = "paused"; reduced = false; context.drawBroodline();
  assert.equal(camera.x, 0); assert.equal(camera.y, 0);
  gameView.state = "running"; context.drawBroodline(); assert.equal(camera.x, 2); assert.equal(camera.y, 2);
});

test("actual gameLoop refreshes Broodline combat HUD without input through a wave transition and preserves formation/pause/terminal hints", () => {
  const elements = Object.fromEntries(["scoreLabelEl", "bestLabelEl", "scoreEl", "bestEl", "gridLabelEl", "timerEl", "seedsTotalEl",
    "duelGridSelect", "seedIncomePerSecondEl", "lengthBonusSummaryEl", "lengthBonusMultiplierEl"].map((name) => [name, { textContent: "", hidden: false }]));
  const view = { gameMode: "broodline", state: "running", seedsTotal: 10, elapsedMs: 0,
    lengthBonus: { seedIncomePerSecond: 0, applied: false, multiplier: 1 }, broodline: null };
  let hint = "", overlay = "", frame = 0, renders = 0, scheduled = 0, hintUpdates = 0;
  const screenHint = { textContent: "" };
  const snapshots = [
    { state: "running", phase: "combat", pendingSeeds: 2, kills: 1, wave: 1, enemies: 2, armor: 2, hatchAt: 2300 },
    { state: "running", phase: "combat", pendingSeeds: 9, kills: 2, wave: 2, enemies: 5, armor: 1, hatchAt: 1100, events: [{ type: "wave", wave: 2 }] },
    { state: "running", phase: "formation", pendingSeeds: 25, kills: 6, wave: 5, enemies: 0, armor: 0, hatchAt: 1000, events: [{ type: "roundClear" }] },
    { state: "paused", phase: "formation", pendingSeeds: 25, kills: 6, wave: 5, enemies: 0, armor: 0, hatchAt: 1000 },
    { state: "gameover", phase: "ended", pendingSeeds: 25, kills: 6, wave: 5, enemies: 0, armor: 0, hatchAt: 1000,
      events: [{ type: "runEnded", mode: "broodline", reason: "Run ended", reward: 37 }] },
    { state: "gameover", phase: "ended", pendingSeeds: 25, kills: 6, wave: 5, enemies: 0, armor: 0, hatchAt: 1000 }
  ];
  const context = vm.createContext({ ...elements, screenHint, gameView: view, window: { IdleSnakeMinigameFeedback: F },
    snakeTiming: { enabled: false }, idleLastPanelAt: 0, Date: { now: () => frame * 220 },
    setText: (element, text) => { element.textContent = text; }, setHidden: (element, hidden) => { element.hidden = hidden; },
    padScore: String, padSeeds: String, formatTime: String, formatDecimal: String, formatNumber: String,
    syncPrimaryActionButton() {}, syncPanels() {}, render: () => { renders++; }, requestAnimationFrame: () => ++scheduled,
    setScreenHint: (text) => { hint = text; screenHint.textContent = text; hintUpdates++; }, showOverlay: (text) => { overlay = text; }, hideBroodlineFormation() {},
    showBroodlineFormation: () => { hint = "Arrange the chain, then continue or collect Seeds"; },
    tickIdleWorld: () => {
      const next = snapshots[frame++];
      view.state = next.state; view.elapsedMs = frame * 220;
      view.broodline = { ...next, round: 1, maxArmor: 3, enemies: Array.from({ length: next.enemies }, () => ({})),
        chain: [{ kind: "egg", hatchAt: next.hatchAt }] };
      return next.events || [];
    }
  });
  vm.runInContext(functions("gameLoop", "launchCentipede") + functions("syncHud", "syncPrimaryActionButton")
    + functions("interpretSessionEvents", "formatDuration"), context);
  context.gameLoop(220);
  assert.equal(elements.scoreEl.textContent, "2"); assert.equal(elements.bestEl.textContent, "1");
  assert.equal(elements.gridLabelEl.textContent, "R1 W1/5"); assert.equal(elements.timerEl.textContent, "220");
  assert.match(hint, /Wave 1\/5 · 2 enemies · Armor 2\/3 · Egg 3s/);
  const updates = hintUpdates; context.syncHud(); assert.equal(hintUpdates, updates, "unchanged live feedback is not re-announced");
  context.gameLoop(440);
  assert.equal(elements.scoreEl.textContent, "9"); assert.equal(elements.bestEl.textContent, "2");
  assert.equal(elements.gridLabelEl.textContent, "R1 W2/5"); assert.equal(elements.timerEl.textContent, "440");
  assert.match(hint, /Wave 2\/5 · 5 enemies · Armor 1\/3 · Egg 2s/);
  context.gameLoop(660); assert.match(hint, /Arrange companions.*continue or collect/);
  hint = "Paused"; context.gameLoop(880); assert.equal(hint, "Paused");
  context.gameLoop(1100); assert.equal(overlay, "Run ended · +37 Seeds");
  // The reward owner adds the terminal reward hint at integration. Any later
  // frame or explicit HUD refresh must leave that authoritative message alone.
  hint = "+37 Seeds earned · Start to try again";
  context.gameLoop(1320); context.syncHud();
  assert.equal(hint, "+37 Seeds earned · Start to try again"); assert.equal(overlay, "Run ended · +37 Seeds");
  assert.equal(renders, 6); assert.equal(scheduled, 6);
});
