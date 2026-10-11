// Shared canvas geometry for the small necks between snake body tiles.
(function attachSnakeConnectors(root, factory) {
  const api = factory(typeof module !== "undefined" && module.exports ? require("../engine/snake-appearance.js") : root.IdleSnakeAppearance);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeConnectors = api;
})(typeof window !== "undefined" ? window : globalThis, (appearance) => {
  function links(points, { columns, rows, wrap = false, tailBaseDistance = 0, cellSize = 1 } = {}) {
    const result = [];
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]; const b = points[i];
      if (!a || !b) continue;
      let dx = b.x - a.x; let dy = b.y - a.y;
      if (wrap && columns > 2 && Math.abs(dx) > columns - 1.001) dx -= Math.sign(dx) * columns;
      if (wrap && rows > 2 && Math.abs(dy) > rows - 1.001) dy -= Math.sign(dy) * rows;
      // Disconnected pieces (or separate heads) never gain a long connector.
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length < 0.001 || length > 1.001) continue;
      const start = { x: a.x + 0.5, y: a.y + 0.5 };
      const end = { x: start.x + dx, y: start.y + dy };
      if (i === points.length - 1 && tailBaseDistance > 0) {
        const inset = Math.min(length, tailBaseDistance / cellSize);
        end.x -= dx / length * inset; end.y -= dy / length * inset;
      }
      result.push([start, end]);
      if (wrap && (Math.abs(b.x - a.x) > 1.001 || Math.abs(b.y - a.y) > 1.001)) {
        const shiftX = b.x - a.x - dx; const shiftY = b.y - a.y - dy;
        result.push([{ x: start.x + shiftX, y: start.y + shiftY }, { x: end.x + shiftX, y: end.y + shiftY }]);
      }
    }
    return result;
  }

  function draw(ctx, points, options) {
    const { cellSize, x = 0, y = 0, color, columns, rows, wrap = false, width } = options;
    if (!points || points.length < 2 || !(cellSize > 0)) return;
    ctx.save();
    if (wrap) {
      ctx.beginPath(); ctx.rect(x, y, columns * cellSize, rows * cellSize); ctx.clip();
    }
    ctx.strokeStyle = appearance.connectorColor(color);
    ctx.lineJoin = "round"; ctx.lineCap = "butt";
    ctx.lineWidth = width ?? Math.max(appearance.connectorMinimumWidth, cellSize * appearance.connectorWidth);
    ctx.beginPath();
    for (const [a, b] of links(points, options)) {
      ctx.moveTo(x + a.x * cellSize, y + a.y * cellSize);
      ctx.lineTo(x + b.x * cellSize, y + b.y * cellSize);
    }
    ctx.stroke(); ctx.restore();
  }
  return { links, draw };
});
