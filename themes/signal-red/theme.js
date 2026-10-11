/* Signal Red: The swap cover of 1999 in matte signal red: a soft rounded body, black rubber keys with
   white numerals, and a plain grey LCD that looks unlit. The menu is warm black with one
   red rule, block tabs, and off-white buttons. */
ThemeKit.register({
  id: "signal-red",
  name: "Signal Red",
  author: "Claude",
  fonts: "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&family=Pixelify+Sans:wght@400;500&display=swap",
  canvas: {
    colors: {
      "#9cac77": "#cfd3c4",
      "#182413": "#24281f",
      "#e7e1c5": "#e9ebe4",
      "#132218": "#1d2019",
      "#1b2b20": "#2e3229",
      "#1c2c22": "#353930",
      "#4b562f": "#65695e",
      "#708b59": "#989c8f",
      "#344336": "#50544a"
    },
    fonts: { "Courier New": "Pixelify Sans" },
    scanlines: false,
    // A dot-matrix LCD with a bezel shadow; no glow.
    overlay: function overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const step = Math.max(3, Math.round(w / 126));
        ctx.save();
        ctx.fillStyle = "rgba(36, 40, 31, 0.04)";
        for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1);
        for (let x = 0; x < w; x += step) ctx.fillRect(x, 0, 1, h);
        ctx.fillStyle = "rgba(36, 40, 31, 0.12)";
        ctx.fillRect(0, 0, w, step);
        ctx.fillRect(0, step, step, h - step);
        ctx.restore();
      },
  },
});
