// Exercise the actual scoped canvas functions with a recording context in Node.
// This checks drawing/input commands without launching or automating a browser.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const breakout = require("./breakout.js");
const crossing = require("./crossing.js");
const source = fs.readFileSync(path.join(__dirname, "../game.js"), "utf8");
const renderers = source.slice(source.indexOf("function drawCrossing()"), source.indexOf("function drawCentipede()"));

function host(overrides = {}) {
  const calls = [];
  const stack = [];
  const ctx = { fillStyle: "", globalAlpha: 1 };
  for (const method of ["beginPath", "rect", "clip", "fillRect", "strokeRect", "translate", "scale", "moveTo", "lineTo", "stroke", "fill", "arc", "fillText"]) {
    ctx[method] = (...args) => calls.push({ method, args, color: ctx.fillStyle, alpha: ctx.globalAlpha });
  }
  ctx.save = () => { stack.push(ctx.globalAlpha); calls.push({ method: "save" }); };
  ctx.restore = () => { ctx.globalAlpha = stack.pop(); calls.push({ method: "restore" }); };
  const colors = { head: "#eecc22", body: "#aa33cc" };
  const state = breakout.createState();
  const sandbox = {
    ctx, Math, window: { IdleSnakeBreakout: breakout },
    boardMetrics: { x: 10, y: 20, width: 720, height: 720, cellSize: 48 },
    crossingGrid: { columns: 15, rows: 13 },
    gameView: { state: "running", elapsedMs: 0, breakout: state, crossingCars: crossing.buildCars(5, { columns: 15, rows: 13 }), crossingSnake: [{ x: 7, y: 12 }, { x: 7, y: 13 }, { x: 7, y: 14 }] },
    previousCrossingSnake: null, snakeColors: colors,
    effectiveReducedMotion: () => false,
    drawRoundedRect: (...args) => calls.push({ method: "tile", args, color: ctx.fillStyle, alpha: ctx.globalAlpha }),
    contrastingEyeColor: () => "#000",
    drawEyes: () => calls.push({ method: "eyes" }),
    drawSnakeConnectors: (...args) => calls.push({ method: "connectors", args }),
    interpolatedPoint: (_previous, current) => current,
    cellRect: (point, inset = 0) => ({ x: 10 + point.x * 48 + inset, y: 20 + point.y * 48 + inset, size: 48 - inset * 2 }),
    interpolatedCellRect: (point, inset = 0) => ({ x: 10 + point.x * 48 + inset, y: 20 + point.y * 48 + inset, size: 48 - inset * 2 }),
    ...overrides
  };
  vm.createContext(sandbox);
  vm.runInContext(renderers, sandbox);
  return { sandbox, calls, state, colors };
}

test("actual Breakout renderer draws single circles for balls/multiball and a small palette square for growth", () => {
  const { sandbox, state, calls, colors } = host();
  state.bricks = [];
  state.powerups = [breakout.createPowerup(state, "multiball", 30, 100), breakout.createPowerup(state, "seed", 60, 100)];
  sandbox.drawBreakout();
  const arcs = calls.filter((call) => call.method === "arc");
  assert.equal(arcs.length, 2);
  assert.equal(arcs[0].args[2], state.powerups[0].radius);
  assert.equal(arcs[1].args[2], state.balls[0].radius);
  assert.ok(arcs[0].args[2] < arcs[1].args[2]);
  assert.equal(arcs[0].color, arcs[1].color);
  const square = calls.find((call) => call.method === "tile" && call.args[1] < state.paddle.y);
  assert.equal(square.color, colors.body);
  assert.equal(square.args[2], square.args[3]);
  const connector = calls.find((call) => call.method === "connectors");
  assert.equal(connector.args[2].cellSize, state.segmentSize + state.gap);
  assert.ok(calls.indexOf(connector) < calls.findIndex((call) => call.method === "tile" && call.args[1] === 20 + state.paddle.y));
});

test("actual Breakout damage drawing adds progressive fracture paths and chips with current health colors", () => {
  const paths = [];
  for (const hp of [3, 2, 1]) {
    const { sandbox, state, calls } = host();
    state.bricks = [{ x: 100, y: 28, width: 65.6, height: 32, hp, maxHp: 3, color: breakout.BRICK_COLORS[hp] }];
    sandbox.drawBreakout();
    assert.ok(calls.some((call) => call.method === "fillRect" && call.color === breakout.BRICK_COLORS[hp] && call.args[2] === 65.6));
    paths.push(calls.filter((call) => call.method === "stroke").length);
  }
  assert.deepEqual(paths, [0, 1, 2]);
});

test("actual Breakout warning dims only the last tail tile, reduced motion is steady, pause stops it", () => {
  const render = (elapsedMs, reduced = false, phase = "running") => {
    const { sandbox, state, calls } = host({ effectiveReducedMotion: () => reduced });
    state.bricks = []; state.paddle.length = 4; state.seedBoosts = [30000];
    sandbox.gameView.elapsedMs = elapsedMs; sandbox.gameView.state = phase;
    sandbox.drawBreakout();
    return calls.filter((call) => call.method === "tile").map((call) => call.alpha);
  };
  assert.deepEqual(render(28200), [1, 1, 1, 1]);
  assert.deepEqual(render(28400), [0.35, 1, 1, 1]);
  assert.deepEqual(render(28200, true), [0.35, 1, 1, 1]);
  assert.deepEqual(render(28400, true), [0.35, 1, 1, 1]);
  assert.deepEqual(render(28400, false, "paused"), [1, 1, 1, 1]);
});

test("actual crossing renderer clips moving obstacles and draws opaque edge rails after the snake", () => {
  const { sandbox, calls } = host();
  sandbox.drawCrossing();
  const clip = calls.findIndex((call) => call.method === "clip");
  const firstLog = calls.findIndex((call) => call.method === "tile");
  assert.ok(clip >= 0 && clip < firstLog);
  const connector = calls.findIndex((call) => call.method === "connectors");
  const body = calls.findIndex((call) => call.method === "tile" && call.color === sandbox.snakeColors.head);
  assert.ok(connector > firstLog && connector < body);
  const rails = calls.filter((call) => call.method === "fillRect" && call.color === "#25362b");
  assert.equal(rails.length, 2);
  assert.ok(calls.indexOf(rails[0]) > calls.findIndex((call) => call.method === "eyes"));
  assert.ok(calls.findIndex((call) => call.method === "restore") < calls.indexOf(rails[0]));
});

test("crossing Start discards pre-clear/locked pointer presses and held Enter repeats", () => {
  const listeners = {};
  const sandbox = { gameView: { gameMode: "crossing", crossingPhase: "playing" }, directionInputLockedUntil: 0,
    Date: { now: () => 1000 }, started: 0,
    startGame: () => { sandbox.started++; },
    startButton: { addEventListener: (name, listener) => { listeners[name] = listener; } }
  };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(source.indexOf("let crossingStartPointerAllowed"), source.indexOf("let crossingStartPointerAllowed") + source.slice(source.indexOf("let crossingStartPointerAllowed")).indexOf("\n});") + 5), sandbox);
  // Evaluate the full click listener separately (the first block is pointerdown).
  const clickSource = source.slice(source.indexOf('startButton.addEventListener("click", (event)'), source.indexOf('startButton.addEventListener("click", (event)') + source.slice(source.indexOf('startButton.addEventListener("click", (event)')).indexOf("\n});") + 5);
  vm.runInContext(clickSource, sandbox);
  listeners.pointerdown();
  vm.runInContext("crossingStartPointerAllowed = false", sandbox); // stageClear invalidates an in-flight press.
  listeners.click({ detail: 1 });
  assert.equal(sandbox.started, 0);
  sandbox.gameView.crossingPhase = "clearing";
  listeners.pointerdown();
  sandbox.gameView.crossingPhase = "playing";
  listeners.click({ detail: 1 });
  assert.equal(sandbox.started, 0);
  listeners.pointerdown(); listeners.click({ detail: 1 });
  assert.equal(sandbox.started, 1);
  const enter = source.slice(source.indexOf('  if (event.code === "Enter") {'), source.indexOf('  if (event.code === "Enter") {') + source.slice(source.indexOf('  if (event.code === "Enter") {')).indexOf("\n  }") + 4);
  vm.runInContext(`function enter(event) { ${enter} }`, sandbox);
  sandbox.enter({ code: "Enter", repeat: true, preventDefault() {} });
  assert.equal(sandbox.started, 1);
  sandbox.enter({ code: "Enter", repeat: false, preventDefault() {} });
  assert.equal(sandbox.started, 2);
});

test("actual crossing clear/ready events refresh the length HUD and death invalidates pending Start", () => {
  let displayedLength = 0;
  const sandbox = { gameView: { gameMode: "crossing", crossingStage: 1, crossingSnake: Array(4).fill({ x: 0, y: 0 }) },
    directionInputLockedUntil: 0, crossingStartPointerAllowed: true, Date: { now: () => 1000 },
    showOverlay() {}, setScreenHint() {}, formatNumber: String,
    syncHud: () => { displayedLength = sandbox.gameView.crossingSnake.length; }
  };
  vm.createContext(sandbox);
  const eventsSource = source.slice(source.indexOf("function interpretSessionEvents(events)"), source.indexOf("function formatDuration"));
  vm.runInContext(eventsSource, sandbox);
  sandbox.interpretSessionEvents([{ type: "stageClear", reward: 15 }]);
  assert.equal(displayedLength, 4);
  assert.equal(sandbox.directionInputLockedUntil, 2000);
  assert.equal(sandbox.crossingStartPointerAllowed, false);
  displayedLength = 0;
  sandbox.interpretSessionEvents([{ type: "stageStarted", stage: 2 }]);
  assert.equal(displayedLength, 4);
  sandbox.crossingStartPointerAllowed = true;
  sandbox.interpretSessionEvents([{ type: "runEnded", mode: "crossing" }]);
  assert.equal(sandbox.crossingStartPointerAllowed, false);
});
