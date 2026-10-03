// Presentation only. All sixteen snake colours retain their original hue family.
// Cache the static CRT finish per canvas size; no per-frame gradient construction.
(function () {
  let glow = null;
  let glowContext = null;
  let glowWidth = 0;
  let glowHeight = 0;
  ThemeKit.register({
    id: "carbon",
    name: "Carbon",
    author: "Codex",
    fonts: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    canvas: {
      colors: {
      "#29391f": "#9cae87",
      "#182413": "#e4edda",
      "#32204f": "#aa8bd4",
      "#583b83": "#d1b9f0",
      "#16465a": "#76b5d2",
      "#267b91": "#b0dced",
      "#176052": "#6bc3ae",
      "#2d8b68": "#a7e1c9",
      "#843b2f": "#dd917d",
      "#b3483d": "#f4b9ab",
      "#a55b25": "#dfa767",
      "#b0802d": "#f1d58b",
      "#702c57": "#cc8bb9",
      "#9b477e": "#edbcdf",
      "#252a32": "#a0acbb",
      "#596474": "#d5dfe9",
      "#9cac77": "#18201e",
      "#e7e1c5": "#e6eceb",
      "#f2e9ba": "#e6eceb",
      "#e4c65e": "#e6eceb",
      "#38502a": "#9cae87",
      "#496536": "#6bc3ae",
      "#5c7840": "#a7e1c9",
      "#718253": "#9cae87",
      "#708b59": "#9cae87",
      "#344336": "#6bc3ae",
      "#435337": "#18201e",
      "#132218": "#18201e",
      "#1b2b20": "#18201e"
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
          glow.addColorStop(0, "rgba(230,202,160,0.025)");
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
