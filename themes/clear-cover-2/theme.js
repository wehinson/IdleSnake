/* Clear Cover II: Round 2's favourite, improved: the translucent Bondi cover and its rounded pills stay;
   the retail card is now dark, the LCD is a neutral grey-green with horizontal scanlines
   instead of a blue tint and a pixel grid, every snake colour shows as chosen, and seeds
   have a Bondi centre. */
ThemeKit.register({
  id: "clear-cover-2",
  name: "Clear Cover II",
  author: "Claude",
  fonts: "https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap",
  canvas: {
    colors: {
      "#9cac77": "#d2dbd2",
      "#182413": "#1d2622",
      "#e7e1c5": "#f4f7f2",
      "#132218": "#18201c",
      "#1b2b20": "#212b26",
      "#1c2c22": "#232e28",
      "#4b562f": "#66756c",
      "#708b59": "#9fae9f",
      "#344336": "#55625a"
    },
    fonts: { "Courier New": "Jost" },
    scanlines: false,
    // Horizontal scanlines and a soft glow; no pixel grid.
    overlay: function overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        const glow = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.75);
        glow.addColorStop(0, "rgba(255, 255, 255, 0.12)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0.08)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
        ctx.restore();
      },
  },
});
