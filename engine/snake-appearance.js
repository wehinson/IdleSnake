// Pure display geometry. Logical cells, movement, and collisions stay in snake.js.
(function attachSnakeAppearance(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeAppearance = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const connectorWidth = 0.46 * 1.5 * 0.75;
  const connectorMinimumWidth = 3 * 0.75;
  const connectorLightening = 0.15;
  const bodyAreaVariance = 0.15;

  function connectorColor(color) {
    // Increase brightness by 15%, preserving the selected color's hue.
    const hex = color.replace(/^#/, "");
    return "#" + [0, 2, 4].map((offset) => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16);
      return Math.min(255, Math.round(channel + channel * connectorLightening)).toString(16).padStart(2, "0");
    }).join("");
  }

  function bodyBlockScale(index) {
    // Stable random sizes do not consume gameplay randomness or change when
    // the snake moves, grows, pauses, or reloads.
    let hash = Math.imul(index, 0x9e3779b1) ^ 0x534e414b;
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    hash = (hash ^ (hash >>> 16)) >>> 0;
    const areaScale = 1 - bodyAreaVariance + hash / 0x100000000 * bodyAreaVariance * 2;
    return Math.sqrt(areaScale);
  }
  function scaleBodyBlock(rect, index) {
    const size = rect.size * bodyBlockScale(index);
    const inset = (rect.size - size) / 2;
    return { ...rect, x: rect.x + inset, y: rect.y + inset, size };
  }
  return { bodyBlockScale, scaleBodyBlock, bodyAreaVariance, connectorWidth, connectorMinimumWidth, connectorLightening, connectorColor };
});
