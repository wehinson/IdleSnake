/* Taxi Yellow: The bright youth phone of 1999 in matte yellow: a square-shouldered body, black keys with
   yellow numerals, and a warm cream LCD. The menu is black with a yellow top band, block
   tabs, capital headings, and square yellow buttons. */
ThemeKit.register({
  id: "taxi-yellow",
  name: "Taxi Yellow",
  author: "Claude",
  fonts: "https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Pixelify+Sans:wght@400;500&display=swap",
  canvas: {
    colors: {
      "#9cac77": "#e2dcae",
      "#182413": "#2e2a12",
      "#e7e1c5": "#f2efdb",
      "#132218": "#25220e",
      "#1b2b20": "#39351b",
      "#1c2c22": "#403c22",
      "#4b562f": "#726e4d",
      "#708b59": "#a8a37c",
      "#344336": "#5d583b"
    },
    fonts: { "Courier New": "Pixelify Sans" },
    scanlines: false,
    // A dot-matrix LCD with a bezel shadow; no glow.
    overlay: function overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const step = Math.max(3, Math.round(w / 126));
        ctx.save();
        ctx.fillStyle = "rgba(46, 42, 18, 0.05)";
        for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1);
        ctx.fillStyle = "rgba(46, 42, 18, 0.12)";
        ctx.fillRect(0, 0, w, step);
        ctx.fillRect(0, step, step, h - step);
        ctx.restore();
      },
  },
});
