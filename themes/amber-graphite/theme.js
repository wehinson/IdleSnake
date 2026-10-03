/* Amber Graphite: A brushed gunmetal phone with graphite keys and a softer amber backlight with scanlines.
   The menu is near-black with a faint grid, Schibsted Grotesk, and sharp solid off-white
   buttons. The nursery is a second, green LCD. */
ThemeKit.register({
  id: "amber-graphite",
  name: "Amber Graphite",
  author: "Claude",
  fonts: "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap",
  canvas: {
    colors: {
      "#9cac77": "#d9aa5e",
      "#182413": "#2b1a05",
      "#101713": "#1b1003",
      "#e7e1c5": "#f6dfae",
      "#132218": "#24160a",
      "#1b2b20": "#2e1d0b",
      "#1c2c22": "#311f0c",
      "#4b562f": "#8a5f22",
      "#708b59": "#b98a46",
      "#344336": "#6e4b1c"
    },
    fonts: { "Courier New": "Schibsted Grotesk" },
    scanlines: false,
    // Horizontal scanlines and a soft glow; no pixel grid.
    overlay: function overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        const glow = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.75);
        glow.addColorStop(0, "rgba(255, 236, 190, 0.16)");
        glow.addColorStop(1, "rgba(43, 26, 5, 0.18)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(43, 26, 5, 0.08)";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
        ctx.restore();
      },
  },
});
