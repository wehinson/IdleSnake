/* Brick Navy: The navy candybar of 2000: a thick matte brick with a silver-grey screen surround, pale
   grey rubber keys, and a mint dot-matrix LCD. The menu is the phone's own menu screen: an
   inverted title bar, square tabs, and plain ruled rows. */
ThemeKit.register({
  id: "brick-navy",
  name: "Brick Navy",
  author: "Claude",
  fonts: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=VT323&display=swap",
  canvas: {
    colors: {
      "#9cac77": "#c7f0d8",
      "#182413": "#2f3d2b",
      "#e7e1c5": "#e6f8ed",
      "#132218": "#263122",
      "#1b2b20": "#384835",
      "#1c2c22": "#3e4f3c",
      "#4b562f": "#69816d",
      "#708b59": "#96b7a1",
      "#344336": "#576c58"
    },
    fonts: { "Courier New": "VT323" },
    scanlines: false,
    // A dot-matrix LCD with a bezel shadow; no glow.
    overlay: function overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const step = Math.max(3, Math.round(w / 126));
        ctx.save();
        ctx.fillStyle = "rgba(47, 61, 43, 0.05)";
        for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1);
        for (let x = 0; x < w; x += step) ctx.fillRect(x, 0, 1, h);
        ctx.fillStyle = "rgba(47, 61, 43, 0.14)";
        ctx.fillRect(0, 0, w, step);
        ctx.fillRect(0, step, step, h - step);
        ctx.restore();
      },
  },
});
