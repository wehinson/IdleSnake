// Pure display geometry. Logical cells, movement, and collisions stay in snake.js.
(function attachSnakeAppearance(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeAppearance = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const connectorWidth = 0.46 * 1.5 * 0.75;
  const connectorMinimumWidth = 3 * 0.75;
  const connectorLightening = 0.15;

  function connectorColor(color) {
    // Increase brightness by 15%, preserving the selected color's hue.
    const hex = color.replace(/^#/, "");
    return "#" + [0, 2, 4].map((offset) => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16);
      return Math.min(255, Math.round(channel + channel * connectorLightening)).toString(16).padStart(2, "0");
    }).join("");
  }

  return { connectorWidth, connectorMinimumWidth, connectorLightening, connectorColor };
});
