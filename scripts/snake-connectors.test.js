const test = require("node:test");
const assert = require("node:assert/strict");
const { links, draw } = require("./snake-connectors.js");
const appearance = require("../engine/snake-appearance.js");

test("connectors join turns and fractional neighbors, skip detached pieces and trim default tail", () => {
  const points = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }];
  assert.deepEqual(links(points, { cellSize: 20, tailBaseDistance: 7.3 }), [
    [{ x: 2.5, y: 2.5 }, { x: 2.5, y: 3.5 }],
    [{ x: 2.5, y: 3.5 }, { x: 3.135, y: 3.5 }]
  ]);
  assert.equal(links([{ x: 1.2, y: 1.4 }, { x: 2.2, y: 1.4 }, null, { x: 8, y: 1 }]).length, 1);
  assert.deepEqual(links([{ x: 0, y: 0 }, { x: 7, y: 7 }]), []);
  assert.equal(links([{ x: 2.18, y: 2 }, { x: 1, y: 2 }]).length, 1, "default shield recoil keeps its neck");
});

test("wrapped adjacency yields two short seam pieces instead of a board-spanning line", () => {
  for (const points of [
    [{ x: 0, y: 4 }, { x: 19, y: 4 }], [{ x: 19, y: 4 }, { x: 0, y: 4 }],
    [{ x: 4, y: 0 }, { x: 4, y: 24 }], [{ x: 4, y: 24 }, { x: 4, y: 0 }]
  ]) {
    const edges = links(points, { columns: 20, rows: 25, wrap: true });
    assert.equal(edges.length, 2);
    for (const [a, b] of edges) assert.equal(Math.hypot(a.x - b.x, a.y - b.y), 1);
    assert.equal(links(points, { columns: 20, rows: 25 }).length, 0, "nonwrap games never join opposite edges");
  }
});

test("drawing uses default width/palette, clips wraps and restores canvas state", () => {
  const calls = []; const ctx = {};
  for (const method of ["save", "restore", "beginPath", "rect", "clip", "moveTo", "lineTo", "stroke"]) ctx[method] = (...args) => calls.push([method, ...args]);
  draw(ctx, [{ x: 0, y: 4 }, { x: 19, y: 4 }], { cellSize: 20, x: 5, y: 9, color: "#16465a", columns: 20, rows: 25, wrap: true });
  assert.equal(ctx.strokeStyle, "#195168");
  assert.equal(ctx.lineWidth, 20 * appearance.connectorWidth);
  assert.deepEqual(calls.find((c) => c[0] === "rect"), ["rect", 5, 9, 400, 500]);
  assert.equal(calls.filter((c) => c[0] === "moveTo").length, 2);
  assert.equal(calls[0][0], "save"); assert.equal(calls.at(-1)[0], "restore");
  draw(ctx, [{ x: 0, y: 0 }, { x: 1, y: 0 }], { cellSize: 10, color: "#29391f", width: 4 });
  assert.equal(ctx.strokeStyle, "#2f4224"); assert.equal(ctx.lineWidth, 4);
});
