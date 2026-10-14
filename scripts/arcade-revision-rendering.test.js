const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const B = require("../engine/battleship.js");
const F = require("./minigame-feedback.js");
const connectors = require("./snake-connectors.js");
const source = fs.readFileSync(require.resolve("../game.js"), "utf8");
function code(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf("\nfunction ", start + 1);
  assert.ok(start >= 0, name); return source.slice(start, end < 0 ? source.length : end);
}
function host(gameView) {
  const ops = [], target = { globalAlpha: 1 }, ctx = new Proxy(target, { get(obj, name) {
    return name in obj ? obj[name] : (...args) => ops.push({ name, args, fill: obj.fillStyle, stroke: obj.strokeStyle });
  } });
  const context = vm.createContext({ ctx, gameView, battleshipGrid: { columns: 10 },
    canvas: { width: 504, height: 1040 }, boardMetrics: { x: 12, y: 12, width: 384, cellSize: 16 },
    snakeColors: { head: "#aabbcc", body: "#778899" }, window: { IdleSnakeBattleship: B, IdleSnakeMinigameFeedback: F, IdleSnakeConnectors: connectors },
    effectiveReducedMotion: () => true, snakeAnimationNow: () => 0, contrastingEyeColor: () => "black" });
  vm.runInContext(["battleshipCurrentDef", "battleshipGhost", "drawBattleshipBoard", "drawBattleshipShip", "drawSnakeConnectors",
    "drawRoundedRect", "cellRect", "drawCentipede", "drawVenomHit", "drawVenomMiss"].map(code).join("\n"), context);
  return { context, ops };
}
test("actual Python ghost has four shaped cells in each rotation and reports overlapping placement invalid", () => {
  const gameView = { battleship: { placement: { index: 2, x: 1, y: 2, orientation: "h" }, player: B.emptyFleet() }, grid: { columns: 24, rows: 28 } };
  const { context, ops } = host(gameView), L = F.strikeLayout(504, 1040);
  for (const orientation of B.orientations(B.FLEET[2])) {
    gameView.battleship.placement.orientation = orientation;
    const ghost = context.battleshipGhost(); assert.equal(ghost.cells.length, 4); assert.equal(ghost.valid, true);
    ops.length = 0; context.drawBattleshipBoard({ L, top: L.playerY, offsetX: L.playerX, fleet: gameView.battleship.player, ghost });
    const tiles = ops.filter(op => op.name === "roundRect"); assert.equal(tiles.length, 4);
    const inset = Math.max(2, L.size * .16);
    tiles.forEach((tile, i) => {
      assert.equal(tile.args[0], L.playerX + ghost.cells[i].x * L.size + inset);
      assert.equal(tile.args[1], L.playerY + ghost.cells[i].y * L.size + inset);
    });
  }
  gameView.battleship.placement.orientation = "h";
  B.placeShip(gameView.battleship.player, B.FLEET[4], 1, 2, "h"); assert.equal(context.battleshipGhost().valid, false);
});
test("actual revealed L rendering connects three adjacent ordered necks through the bend in every rotation", () => {
  const { context, ops } = host({ grid: { columns: 24, rows: 28 } });
  for (const orientation of B.orientations(B.FLEET[2])) {
    const fleet = B.emptyFleet(); B.placeShip(fleet, B.FLEET[2], 1, 2, orientation); const ship = fleet.ships[0];
    ops.length = 0; context.drawBattleshipShip(ship, 10, 20, 30, false);
    const starts = ops.filter(op => op.name === "moveTo"), ends = ops.filter(op => op.name === "lineTo");
    assert.equal(starts.length, 3); assert.equal(ends.length, 3);
    starts.forEach((op, i) => {
      assert.deepEqual(op.args, [10 + (ship.cells[i].x + .5) * 30, 20 + (ship.cells[i].y + .5) * 30]);
      assert.deepEqual(ends[i].args, [10 + (ship.cells[i + 1].x + .5) * 30, 20 + (ship.cells[i + 1].y + .5) * 30]);
      assert.equal(Math.hypot(ends[i].args[0] - op.args[0], ends[i].args[1] - op.args[1]), 30);
    });
    const tiles = ops.filter(op => op.name === "roundRect");
    assert.equal(tiles.length, 5, "four body cells plus the head redraw, no bounding-box filler");
    assert.equal(new Set(tiles.map(op => op.args.slice(0, 2).join(","))).size, 4);
    assert.ok(ops.findIndex(op => op.name === "stroke") < ops.findIndex(op => op.name === "roundRect"));
  }
});
test("enemy L is hidden until sunk or reveal-all, then four cells and the bend are visible", () => {
  const fleet = B.emptyFleet(); B.placeShip(fleet, B.FLEET[2], 1, 2, "h");
  const { context, ops } = host({ grid: { columns: 24, rows: 28 } }), L = F.strikeLayout(504, 1040);
  const draw = (revealAll) => context.drawBattleshipBoard({ L, top: L.enemyY, offsetX: L.enemyX, fleet, revealSunk: true, revealAll });
  draw(false); assert.equal(ops.filter(op => op.name === "roundRect").length, 0); assert.equal(ops.filter(op => op.name === "moveTo").length, 22, "board grid only, no hidden necks");
  ops.length = 0; draw(true); assert.equal(ops.filter(op => op.name === "roundRect").length, 5);
  fleet.ships[0].cells.forEach(c => B.fireAt(fleet, c.x, c.y)); ops.length = 0; draw(false);
  assert.equal(ops.filter(op => op.name === "roundRect").length, 5);
});
test("actual Centipede renderer draws every concurrent projectile at its own coordinate without changing HP/player presentation", () => {
  const bullets = [{ x: 1, y: 3 }, { x: 4, y: 8 }, { x: 7, y: 13 }];
  const gameView = { grid: { columns: 24, rows: 28 }, centipede: { rows: 28, playerRows: 6, bullets,
    mushrooms: {}, segments: [], player: { x: 23, y: 27 } } };
  const { context, ops } = host(gameView); context.drawCentipede();
  const shots = ops.filter(op => op.name === "fillRect" && op.fill === "#e7e1c5"); assert.equal(shots.length, 3);
  const inset = Math.max(2, 16 * .38);
  shots.forEach((op, i) => assert.deepEqual(op.args, [12 + bullets[i].x * 16 + inset, 12 + bullets[i].y * 16 + inset, 16 - inset * 2, 16 * .6]));
});
