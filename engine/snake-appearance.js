// Pure display geometry. Logical cells, movement, and collisions stay in snake.js.
(function attachSnakeAppearance(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeAppearance = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const markingSpacing = 4.5;
  const markingSpeed = 0.6; // Body blocks per second.
  const connectorWidth = 0.46 * 1.5;
  const connectorLightening = 0.10;

  function connectorColor(color) {
    // Increase brightness by 10%, preserving the selected color's hue. A 10%
    // blend toward white made dark colors much more than 10% brighter.
    const hex = color.replace(/^#/, "");
    return "#" + [0, 2, 4].map((offset) => Math.min(255, Math.round(parseInt(hex.slice(offset, offset + 2), 16) * (1 + connectorLightening))).toString(16).padStart(2, "0")).join("");
  }

  function bodyMarkings(points, { elapsedMs = 0, reducedMotion = false } = {}) {
    if (points.length < 4) return [];
    const start = 1.1;
    const end = points.length - 2.1;
    const travel = reducedMotion ? 0 : Math.max(0, elapsedMs) / 1000 * markingSpeed;
    const markings = [];
    for (let id = Math.ceil((start - 1.6 - travel) / markingSpacing); id <= Math.floor((end - 1.6 - travel) / markingSpacing); id++) {
      const position = 1.6 + id * markingSpacing + travel;
      const index = Math.floor(position);
      const fraction = position - index;
      const from = points[index]; const to = points[index + 1];
      let dx = to.x - from.x; let dy = to.y - from.y;
      // Blend orientation around bends so a small marking does not snap through
      // a right angle as it crosses a block center. Position follows the body.
      if (fraction < 0.25 && index > 0) {
        const previous = points[index - 1]; const mix = 0.5 - fraction * 2;
        dx = dx * (1 - mix) + (from.x - previous.x) * mix;
        dy = dy * (1 - mix) + (from.y - previous.y) * mix;
      } else if (fraction > 0.75 && index + 2 < points.length) {
        const next = points[index + 2]; const mix = (fraction - 0.75) * 2;
        dx = dx * (1 - mix) + (next.x - to.x) * mix;
        dy = dy * (1 - mix) + (next.y - to.y) * mix;
      }
      markings.push({
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
        angle: Math.atan2(dy, dx), position, variant: ((id % 3) + 3) % 3,
        opacity: Math.max(0, Math.min(1, (position - start) / 0.5, (end - position) / 0.5))
      });
    }
    return markings;
  }
  return { bodyMarkings, markingSpacing, markingSpeed, connectorWidth, connectorLightening, connectorColor };
});
