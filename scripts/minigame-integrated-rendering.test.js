const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const breakout = require("../engine/breakout.js");
const connectors = require("./snake-connectors.js");
const appearance = require("../engine/snake-appearance.js");
const source = fs.readFileSync(require.resolve("../game.js"), "utf8");
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

test("merged Breakout renderer uses the real shared connector wrapper in transformed paddle coordinates", () => {
  const state = breakout.createState({ bricks: [] });
  const calls = [];
  const ctx = {};
  for (const method of ["save", "restore", "translate", "scale", "beginPath", "rect", "clip", "moveTo", "lineTo", "stroke", "fill", "fillRect", "roundRect", "arc", "strokeRect"]) {
    ctx[method] = (...args) => calls.push({ method, args, color: ctx.strokeStyle, width: ctx.lineWidth });
  }
  const boardMetrics = { x: 17, y: 29, width: 360, height: 432, cellSize: 20 };
  const context = vm.createContext({ ctx, boardMetrics, gameView: { breakout: state,
    state: "running", elapsedMs: 0, grid: { columns: 18, rows: 18 } },
    snakeColors: { body: "#29391f", head: "#426070" }, effectiveReducedMotion: () => false,
    contrastingEyeColor: () => "#ffffff", window: { IdleSnakeBreakout: breakout,
      IdleSnakeConnectors: connectors, ThemeKit: { color: () => "#16465a" } } });
  vm.runInContext(["drawBreakout", "drawSnakeConnectors", "drawRoundedRect"].map(functionSource).join("\n"), context);
  vm.runInContext("drawBreakout();", context);
  const joins = calls.filter(call => call.method === "moveTo");
  const ends = calls.filter(call => call.method === "lineTo");
  assert.equal(joins.length, state.paddle.length - 1);
  assert.equal(ends.length, joins.length);
  const pitch = state.segmentSize + state.gap;
  joins.forEach((call, index) => {
    assert.ok(Math.abs(call.args[0] - (boardMetrics.x + state.paddle.x + index * pitch + state.segmentSize / 2)) < 1e-8);
    assert.ok(Math.abs(call.args[1] - (boardMetrics.y + state.paddle.y + state.segmentSize / 2)) < 1e-8);
    assert.ok(Math.abs(ends[index].args[0] - call.args[0] - pitch) < 1e-8);
  });
  const strokeIndex = calls.findIndex(call => call.method === "stroke");
  assert.ok(strokeIndex >= 0 && strokeIndex < calls.findIndex(call => call.method === "roundRect"));
  assert.equal(calls[strokeIndex].color, appearance.connectorColor("#16465a"));
  assert.equal(calls[strokeIndex].width, Math.max(appearance.connectorMinimumWidth, pitch * appearance.connectorWidth));
  assert.deepEqual(calls.find(call => call.method === "scale").args, [.5, .6]);
  assert.equal(source.includes("duelGridSelect"), false, "removed Duel selector cannot leak into merged live Broodline HUD");
});
