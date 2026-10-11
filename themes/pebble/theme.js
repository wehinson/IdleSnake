/* Pebble: The compact phone of 2000 in warm stone plastic: a small rounded pebble with square
   graphite keys and a cool grey LCD. The menu is graphite with outlined tabs, sand
   buttons, and soft square corners. */
ThemeKit.register({
  id: "pebble",
  name: "Pebble",
  author: "Claude",
  fonts: "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=VT323&display=swap",
  canvas: {
    colors: {
      "#9cac77": "#c5d1cd",
      "#182413": "#1c2a2b",
      "#e7e1c5": "#e5eae8",
      "#132218": "#162222",
      "#1b2b20": "#263435",
      "#1c2c22": "#2d3b3b",
      "#4b562f": "#5c6969",
      "#708b59": "#8f9c99",
      "#344336": "#485555"
    },
    fonts: { "Courier New": "VT323" },
    scanlines: false,
    // A dot-matrix LCD with a bezel shadow; no glow.
    overlay: function overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const step = Math.max(3, Math.round(w / 126));
        ctx.save();
        ctx.fillStyle = "rgba(28, 42, 43, 0.035)";
        for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1);
        for (let x = 0; x < w; x += step) ctx.fillRect(x, 0, 1, h);
        ctx.fillStyle = "rgba(28, 42, 43, 0.1)";
        ctx.fillRect(0, 0, w, step);
        ctx.fillRect(0, step, step, h - step);
        ctx.restore();
      },
  },
});
