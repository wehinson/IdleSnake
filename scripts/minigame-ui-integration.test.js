// Direct VM checks of the shipped UI functions; no browser or DOM automation.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createGameSession } = require("../engine/session.js");
const connectors = require("./snake-connectors.js");
const appearance = require("../engine/snake-appearance.js");
const { compileColors, mapColor } = require("../themes/theme-kit.js");
const source = fs.readFileSync(require.resolve("../game.js"), "utf8");
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}
function recorder() {
  const calls = []; const ctx = {};
  for (const method of ["save", "restore", "translate", "scale", "beginPath", "rect", "clip", "moveTo", "lineTo", "stroke", "fill", "fillRect", "roundRect", "arc", "strokeRect"]) {
    ctx[method] = (...args) => calls.push({ method, args, fill: ctx.fillStyle, stroke: ctx.strokeStyle, width: ctx.lineWidth });
  }
  return { calls, ctx };
}

test("actual Runner renderer connects all six delayed jump tiles before their bodies without changing poses", () => {
  const runner = require("../engine/runner.js");
  const colors = compileColors({ "#29391f": "#16465a" });
  const game = createGameSession({ now: 0, rng: () => 0.3 });
  game.dispatch({ type: "selectMode", mode: "duel" });
  assert.equal(game.dispatch({ type: "openMinigame", number: 9 }).snapshot.mode, "runner");
  const started = game.dispatch({ type: "playDirection", direction: "up" });
  assert.equal(started.snapshot.phase, "running"); assert.equal(started.snapshot.active.player.grounded, false);
  const { calls, ctx } = recorder(); const state = structuredClone(started.snapshot.active);
  const metrics = { x: 13, y: 27, cellSize: 20, width: 360, height: 432 };
  const context = vm.createContext({ ctx, boardMetrics: metrics, gameView: { runner: state, grid: { columns: 18, rows: 18 } },
    snakeColors: { body: "#29391f", head: "#abcdef" }, drawEyes() {}, effectiveReducedMotion: () => false,
    window: { IdleSnakeRunner: runner, IdleSnakeConnectors: connectors, ThemeKit: { color: (c) => mapColor(c, colors) } } });
  vm.runInContext(["drawRunner", "drawSnakeConnectors", "drawRoundedRect"].map(functionSource).join("\n"), context);
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} matches ${expected}`);
  // Source poses only: no movement simulation or clock loop.
  for (const elapsed of [0, 55, 220, 440, 700, 985]) {
    context.effectiveReducedMotion = () => false;
    state.jumpStartedAt = elapsed === 0 ? null : 0; state.elapsedMs = elapsed;
    calls.length = 0; vm.runInContext("drawRunner();", context);
    const tiles = calls.filter((c) => c.method === "roundRect");
    const moves = calls.filter((c) => c.method === "moveTo");
    const lines = calls.filter((c) => c.method === "lineTo");
    assert.equal(tiles.length, 6); assert.equal(moves.length, 5); assert.equal(lines.length, 5);
    const stroke = calls.findIndex((c) => c.method === "stroke");
    assert.ok(stroke >= 0 && stroke < calls.findIndex((c) => c.method === "roundRect"));
    assert.equal(calls[stroke].stroke, appearance.connectorColor("#16465a"));
    assert.equal(calls[stroke].width, state.player.size * appearance.connectorWidth);
    assert.deepEqual(calls.find((c) => c.method === "scale").args, [0.5, 0.6], "existing canvas scaling is retained");
    const centers = [];
    for (let index = 0; index < 6; index += 1) {
      const size = state.player.size * (index === 0 ? 1 : 0.88);
      const x = metrics.x + state.player.x - index * size * 0.72;
      const y = metrics.y + state.groundY - size - runner.segmentYOffset(state, index);
      const tile = tiles[5 - index];
      near(tile.args[0], x); near(tile.args[1], y); near(tile.args[2], size); near(tile.args[3], size);
      assert.equal(tile.fill, index === 0 ? "#abcdef" : "#29391f");
      centers.push([x + size / 2, y + size / 2]);
    }
    for (let index = 0; index < 5; index += 1) {
      moves[index].args.forEach((value, axis) => near(value, centers[index][axis]));
      lines[index].args.forEach((value, axis) => near(value, centers[index + 1][axis]));
    }
    // Compare visible drawing state, excluding unused styles inherited by save/translate.
    const visibleCalls = () => calls.map((c) => ({ method: c.method, args: [...c.args],
      ...(["fill", "fillRect", "roundRect"].includes(c.method) ? { fill: c.fill } : {}),
      ...(["stroke", "strokeRect"].includes(c.method) ? { stroke: c.stroke, width: c.width } : {}) }));
    const normal = visibleCalls();
    context.effectiveReducedMotion = () => true;
    calls.length = 0; vm.runInContext("drawRunner();", context);
    assert.deepEqual(visibleCalls(), normal, "connectors add no motion or change the existing reduced-motion pose");
  }
});

test("actual wrapper uses theme/player color and accepts per-mode board metric overrides", () => {
  const colors = compileColors({ "#29391f": "#16465a" });
  const { calls, ctx } = recorder();
  const context = vm.createContext({ ctx, boardMetrics: { cellSize: 20, x: 3, y: 7 }, gameView: { grid: { columns: 20, rows: 25 } }, snakeColors: { body: "#29391f" }, window: { IdleSnakeConnectors: connectors, ThemeKit: { color: (c) => mapColor(c, colors) } } });
  vm.runInContext(functionSource("drawSnakeConnectors"), context);
  vm.runInContext("drawSnakeConnectors([{x:0,y:0},{x:1,y:0}]);", context);
  assert.equal(calls.find((c) => c.method === "stroke").stroke, appearance.connectorColor("#16465a"));
  calls.length = 0;
  vm.runInContext('drawSnakeConnectors([{x:0,y:0},{x:1,y:0}], "#654321", {cellSize:30,x:40,y:60,columns:10,rows:10});', context);
  assert.deepEqual(calls.find((c) => c.method === "moveTo").args, [55, 75]);
  assert.equal(calls.find((c) => c.method === "stroke").stroke, appearance.connectorColor("#654321"));
});

test("actual Duel/Nibbler drawing connects both bodies, uses black pulse and keeps reduced motion static", () => {
  const { calls, ctx } = recorder(); let time = 0; let reduced = false;
  const view = { gameMode: "duel", grid: { columns: 20, rows: 25 }, duelFoods: [{ x: 5, y: 5 }], duelPlayer: { body: [{ x: 0, y: 2 }, { x: 19, y: 2 }] }, duelOpponent: { body: [{ x: 5, y: 2 }, { x: 6, y: 2 }] }, maze: {}, mazePath: [{ x: 3, y: 3 }, { x: 3, y: 4 }] };
  const context = vm.createContext({ ctx, gameView: view, boardMetrics: { x: 0, y: 0, cellSize: 20 }, window: { IdleSnakeConnectors: connectors }, snakeColors: { body: "#654321", head: "#abcdef" }, previousDuelPlayerBody: null, previousDuelOpponentBody: null,
    effectiveReducedMotion: () => reduced, snakeAnimationNow: () => time, isMazeOpen: () => true, contrastingEyeColor: () => "#000000", drawEyes() {} });
  vm.runInContext(["cellRect", "interpolatedPoint", "interpolatedCellRect", "drawRoundedRect", "drawSnakeConnectors", "drawVsSnake", "drawMaze"].map(functionSource).join("\n"), context);
  const draw = () => { calls.length = 0; vm.runInContext("drawVsSnake();", context); return calls.map((c) => ({ ...c })); };
  const first = draw();
  assert.equal(first[0].fill, "#000000");
  assert.equal(first.filter((c) => c.method === "stroke").length, 2, "player and opponent have necks");
  const paths = first.filter((c) => c.method === "lineTo");
  assert.equal(paths.length, 3, "wrapped player has two seam pieces; opponent has one link");
  time = 500; assert.notEqual(draw()[1].fill, first[1].fill);
  reduced = true; const staticPulse = draw()[1].fill; time = 1000; assert.equal(draw()[1].fill, staticPulse);
  view.gameMode = "maze"; view.grid = { columns: 21, rows: 21 }; calls.length = 0;
  vm.runInContext("drawMaze();", context);
  assert.equal(calls.filter((c) => c.method === "stroke").length, 1);
  assert.ok(calls.some((c) => c.method === "roundRect" && c.args[2] === 15.2), "Nibbler uses solid Duel-sized tiles");
});

test("actual Duel grid draws outlines without checker fill", () => {
  const { calls, ctx } = recorder();
  const view = { gameMode: "duel", grid: { columns: 20, rows: 25 } };
  const context = vm.createContext({ ctx, gameView: view, boardMetrics: { x: 0, y: 0, cellSize: 20, width: 400, height: 500 } });
  vm.runInContext(functionSource("setGridDrawingState") + functionSource("drawGridDirect"), context);
  vm.runInContext("drawGridDirect();", context);
  assert.equal(calls.filter((c) => c.method === "fillRect").length, 0);
  assert.equal(calls.filter((c) => c.method === "strokeRect").length, 1);
  view.gameMode = "snake"; calls.length = 0; vm.runInContext("drawGridDirect();", context);
  assert.ok(calls.some((c) => c.method === "fillRect"), "default board treatment is preserved");
});

test("Nibbler Ready/HUD and running accessibility labels consistently use the catalog name", () => {
  const html = fs.readFileSync(require.resolve("../index.html"), "utf8");
  const key = html.match(/<button[^>]*data-minigame="2"[^>]*>/)[0];
  assert.match(key, /aria-label="Nibbler"/); assert.match(key, /title="Nibbler"/);
  const labels = []; const gameStatus = {}; const canvas = { setAttribute: (key, value) => labels.push(value) };
  const context = vm.createContext({ gameView: { gameMode: "maze", state: "ready", grid: { columns: 21, rows: 21 } }, gameStatus, canvas,
    minigameCatalog: require("../engine/config.js").minigameCatalog, stateText: {}, readyStartPrompt: {}, overlay: { classList: { add() {}, remove() {} } },
    snakeAnimationClock: { reset() {} }, deathOverlayTimer: null, hideBroodlineFormation() {}, getBoardMetrics: () => ({}), clearTimeout() {},
    setScreenHint: (text) => labels.push(text) });
  vm.runInContext(["presentReadyGame", "showOverlay", "hideOverlay"].map(functionSource).join("\n"), context);
  vm.runInContext("presentReadyGame();", context);
  assert.equal(context.stateText.textContent, "Nibbler · Ready");
  assert.match(gameStatus.textContent, /^Nibbler:/);
  assert.ok(labels.every((text) => text.includes("Nibbler")));
  context.gameView.state = "running"; vm.runInContext("hideOverlay();", context);
  assert.equal(gameStatus.textContent, "Nibbler: Running");
  assert.equal(labels.at(-1), "Nibbler play field: Running");
});

test("actual picker and fullscreen handlers switch in one click and retain direction input lock", () => {
  for (const phase of ["paused", "gameover"]) {
    for (const menu of ["picker", "fullscreen"]) {
      const game = createGameSession({ now: 0, rng: () => 0.3, save: { saveVersion: 2, upgrades: { minigamesLevel: 9 } } });
      game.dispatch({ type: "selectMode", mode: "snake", setup: { grid: { columns: 5, rows: 8 }, snake: [{ x: 2, y: 0 }, { x: 2, y: 1 }], direction: "up" } });
      game.dispatch({ type: "begin" }); if (phase === "paused") game.dispatch({ type: "pause" }); else game.tick(10000);
      const handlers = {}; const key = { dataset: { minigame: "2" }, addEventListener: (name, fn) => { handlers.picker = fn; } };
      const fullscreenMinigameMenu = { hidden: false, addEventListener: (name, fn) => { handlers.fullscreen = fn; } };
      const context = vm.createContext({ directionInputLockedUntil: 123456, gameView: game.snapshot(), minigameKeys: [key], fullscreenMinigameMenu,
        fullscreenMinigamesButton: { setAttribute() {}, addEventListener() {} }, hideSnakebirdPicker() {}, hidePersonalization() {}, hideBroodlineFormation() {}, syncMinigameKeys() {},
        activatePersonalizationKey() {}, presentGameResult: () => {}, dispatchSession: (action) => game.dispatch(action) });
      vm.runInContext(source.slice(source.indexOf("function hideFullscreenMinigames()"), source.indexOf("notablesButtonEl?.addEventListener")), context);
      const before = game.snapshot().seeds;
      handlers[menu]({ target: { closest: () => ({ disabled: false, dataset: { fullscreenMinigame: "2" } }) } });
      assert.equal(game.snapshot().mode, "maze", `${phase} ${menu}`); assert.equal(game.snapshot().phase, "ready");
      assert.equal(game.snapshot().seeds, before); assert.equal(context.directionInputLockedUntil, 123456);
      if (menu === "fullscreen") assert.equal(fullscreenMinigameMenu.hidden, true);
    }
  }
});
