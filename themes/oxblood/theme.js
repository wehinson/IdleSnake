// Presentation only. All sixteen snake colours retain their original hue family.
// Cache the static CRT finish per canvas size; no per-frame gradient construction.
(function () {
  let glow = null;
  let glowContext = null;
  let glowWidth = 0;
  let glowHeight = 0;
  ThemeKit.register({
    id: "oxblood",
    name: "Oxblood",
    author: "Codex",
    fonts: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    canvas: {
      colors: {
      "#29391f": "#91a66f",
      "#182413": "#d9e5bd",
      "#32204f": "#a68ad0",
      "#583b83": "#c7afe8",
      "#16465a": "#71afc9",
      "#267b91": "#a1d7e8",
      "#176052": "#64bda6",
      "#2d8b68": "#96d7bd",
      "#843b2f": "#da8b76",
      "#b3483d": "#f0b2a3",
      "#a55b25": "#dca262",
      "#b0802d": "#edce81",
      "#702c57": "#c482b0",
      "#9b477e": "#e2add2",
      "#252a32": "#9da6b1",
      "#596474": "#c8d1dd",
      "#9cac77": "#262621",
      "#e7e1c5": "#eee4cd",
      "#f2e9ba": "#eee4cd",
      "#e4c65e": "#eee4cd",
      "#38502a": "#91a66f",
      "#496536": "#64bda6",
      "#5c7840": "#96d7bd",
      "#718253": "#91a66f",
      "#708b59": "#91a66f",
      "#344336": "#64bda6",
      "#435337": "#262621",
      "#132218": "#262621",
      "#1b2b20": "#262621"
      },
      fonts: { "Courier New": "Inter", "Courier": "Inter" },
      scanlines: false,
      overlay(ctx, canvas, metrics, strength) {
        if (!glow || glowContext !== ctx || glowWidth !== canvas.width || glowHeight !== canvas.height) {
          glowContext = ctx;
          glowWidth = canvas.width;
          glowHeight = canvas.height;
          glow = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.4, 0,
            canvas.width * 0.5, canvas.height * 0.4, Math.max(canvas.width, canvas.height) * 0.7);
          glow.addColorStop(0, "rgba(226,170,109,0.055)");
          glow.addColorStop(1, "rgba(0,0,0,0)");
        }
        ctx.save();
        ctx.globalAlpha = strength;
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        for (let y = 0; y < canvas.height; y += 3) ctx.fillRect(0, y, canvas.width, 1);
        ctx.restore();
      }
    }
  });
})();
