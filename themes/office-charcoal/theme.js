/* Office Charcoal: The business phone of 1998: a tall charcoal slab with a stub antenna, dark oval keys,
   blue-grey function keys, and a yellow-green LCD with pixel rows. The menu is a pocket
   reference card: underlined tabs, small capitals, and pale solid buttons. */
ThemeKit.register({
  id: "office-charcoal",
  name: "Office Charcoal",
  author: "Claude",
  fonts: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=DotGothic16&display=swap",
  canvas: {
    colors: {
      "#9cac77": "#c8d5a8",
      "#182413": "#222c14",
      "#e7e1c5": "#e6ecd8",
      "#132218": "#1b2310",
      "#1b2b20": "#2c361d",
      "#1c2c22": "#333d23",
      "#4b562f": "#616c4c",
      "#708b59": "#939f79",
      "#344336": "#4d583a"
    },
    fonts: { "Courier New": "DotGothic16" },
    scanlines: false,
    // A dot-matrix LCD with a bezel shadow; no glow.
    overlay: function overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const step = Math.max(3, Math.round(w / 126));
        ctx.save();
        ctx.fillStyle = "rgba(34, 44, 20, 0.07)";
        for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1);
        ctx.fillStyle = "rgba(34, 44, 20, 0.16)";
        ctx.fillRect(0, 0, w, step);
        ctx.fillRect(0, step, step, h - step);
        ctx.restore();
      },
  },
});
